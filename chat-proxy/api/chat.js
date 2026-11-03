// JARVIS Chat Proxy — Vercel serverless function
// gemini.js: fetch(`${proxy}/chat`, ...) → GitHub Models (Azure) relay
//
// Энэ нь webhook/server.js-ийн POST /chat логикийн stateless хувилбар.
// Cron/Telegram бот энд БАЙХГҮЙ — зөвхөн chat relay (Vercel function богино настай).
//
// ENV (Vercel → Project → Settings → Environment Variables):
//   GEMINI_API_KEY    — Google AI Studio-гийн ҮНЭГҮЙ түлхүүр               [ЗААВАЛ]
//   CHAT_SECRET       — x-jarvis-secret header шалгалт                     [сонголт]
//   CORS_ORIGIN       — default '*'                                        [сонголт]
//
// ТЭМДЭГЛЭЛ (2026-11): GitHub Models (models.inference.ai.azure.com) үйлчилгээ
// 2026-07-30-нд БҮРМӨСӨН хаагдсан — DNS нь ч байхгүй. Тиймээс Gemini цорын
// ганц нийлүүлэгч болов. GEMINI_API_KEY байхгүй бол ойлгомжтой алдаа буцаана.

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

  if (!process.env.GEMINI_API_KEY) {
    return res.status(503).json({
      error: 'AI түлхүүр тохируулаагүй',
      detail: 'GEMINI_API_KEY байхгүй. Google AI Studio-гоос ҮНЭГҮЙ түлхүүр авч ' +
              'GitHub secret-д GEMINI_API_KEY нэрээр нэмээд "Sync Secrets to Vercel" ажлыг ажиллуул.',
    });
  }

  try {
    const g = await tryGemini(body);
    if (g) return res.json(g);
    return res.status(502).json({ error: 'AI хариу өгсөнгүй', detail: 'Gemini хүсэлт амжилтгүй — түлхүүр эсвэл хязгаарыг шалга.' });
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
};
