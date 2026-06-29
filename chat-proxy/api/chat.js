// JARVIS Chat Proxy — Vercel serverless function
// gemini.js: fetch(`${proxy}/chat`, ...) → GitHub Models (Azure) relay
//
// Энэ нь webhook/server.js-ийн POST /chat логикийн stateless хувилбар.
// Cron/Telegram бот энд БАЙХГҮЙ — зөвхөн chat relay (Vercel function богино настай).
//
// ENV (Vercel → Project → Settings → Environment Variables):
//   SYSTEM_USE_TOKEN  — GitHub PAT (gpt-4o models.inference.ai.azure.com)  [ЗААВАЛ]
//   GEMINI_API_KEY    — Gemini fallback (GitHub хоосон бол)                [сонголт]
//   CHAT_SECRET       — x-jarvis-secret header шалгалт                     [сонголт]
//   CORS_ORIGIN       — default '*'                                        [сонголт]

const CHAT_URL = 'https://models.inference.ai.azure.com/chat/completions';

async function tryGemini(body) {
  if (!process.env.GEMINI_API_KEY) return null;
  try {
    const msgs = body?.messages || [];
    const sys  = msgs.filter(m => m.role === 'system').map(m => m.content).join('\n');
    const contents = msgs.filter(m => m.role !== 'system')
      .map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content || '' }] }));
    while (contents.length && contents[0].role === 'model') contents.shift();
    const gUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`;
    const gRes = await fetch(gUrl, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: sys ? { parts: [{ text: sys }] } : undefined,
        contents,
        generationConfig: { temperature: body?.temperature ?? 0.8, maxOutputTokens: body?.max_tokens ?? 800 },
      }),
    });
    const gData = await gRes.json();
    const text  = gData.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (!text) return null;
    return { choices: [{ message: { role: 'assistant', content: text } }], _via: 'gemini' };
  } catch { return null; }
}

module.exports = async (req, res) => {
  const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';
  res.setHeader('Access-Control-Allow-Origin', CORS_ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-jarvis-secret');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST')   return res.status(405).json({ error: 'POST only' });

  // Secret header auth (сонголт)
  const CHAT_SECRET = process.env.CHAT_SECRET;
  if (CHAT_SECRET && req.headers['x-jarvis-secret'] !== CHAT_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const GH_TOKEN = process.env.SYSTEM_USE_TOKEN || process.env.META_BOT_TOKEN;
  if (!GH_TOKEN) return res.status(500).json({ error: 'SYSTEM_USE_TOKEN тохируулаагүй' });

  // Vercel req.body аль хэдийн parse хийсэн байх ёстой; эс бөгөөс гараар уншина
  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
  if (!body) body = {};

  // ── ABUSE / COST GUARDRAILS ──────────────────────────────────────
  // Нээлттэй proxy тул нэг хүн token-ыг шавхахаас сэргийлнэ.
  const msgs = Array.isArray(body.messages) ? body.messages : null;
  if (!msgs || msgs.length === 0) return res.status(400).json({ error: 'messages шаардлагатай' });
  if (msgs.length > 50)           return res.status(400).json({ error: 'Хэт олон мессеж (>50)' });
  const totalChars = msgs.reduce((n, m) => n + ((m && typeof m.content === 'string') ? m.content.length : 0), 0);
  if (totalChars > 40000)         return res.status(413).json({ error: 'Агуулга хэт урт (>40k тэмдэгт)' });
  body.max_tokens = typeof body.max_tokens === 'number' ? Math.min(body.max_tokens, 1500) : 800;

  try {
    let data = null, status = 200;
    // 1) GitHub Models (Azure)
    try {
      const upstream = await fetch(CHAT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${GH_TOKEN}` },
        body: JSON.stringify(body),
      });
      data   = await upstream.json();
      status = upstream.status;
    } catch { data = null; }

    // 2) GitHub хоосон/алдаатай бол → Gemini fallback
    const ghContent = data?.choices?.[0]?.message?.content?.trim();
    if (!ghContent) {
      const g = await tryGemini(body);
      if (g) return res.json(g);
    }
    return res.status(status).json(data || { error: 'no response' });
  } catch (e) {
    const g = await tryGemini(body);
    if (g) return res.json(g);
    res.status(502).json({ error: e.message });
  }
};
