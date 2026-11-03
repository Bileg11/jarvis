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

// Боломжтой моделийг нэг удаа тодорхойлж кэшлэнэ.
// (Загварын нэрс үе үе өөрчлөгддөг тул хатуу бичихгүй.)
const PREFER = [
  'gemini-flash-latest', 'gemini-2.5-flash', 'gemini-2.0-flash',
  'gemini-2.5-flash-lite', 'gemini-pro-latest', 'gemini-1.5-flash',
];
let MODEL_CACHE = null;
const sleep = ms => new Promise(r => setTimeout(r, ms));

// Боломжтой моделиудыг эрэмбэлсэн ЖАГСААЛТААР буцаана — 503 гарвал дараагийнх руу шилжинэ
async function pickModels(key) {
  if (MODEL_CACHE) return MODEL_CACHE;
  if (process.env.GEMINI_MODEL) return (MODEL_CACHE = [process.env.GEMINI_MODEL]);
  try {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
    const d = await r.json();
    if (!r.ok) return { error: d?.error?.message || `models list ${r.status}` };
    const usable = (d.models || [])
      .filter(m => (m.supportedGenerationMethods || []).includes('generateContent'))
      .map(m => String(m.name).replace(/^models\//, ''))
      .filter(m => !/embedding|aqa|image|vision-only|tts|live/.test(m));
    const ordered = [
      ...PREFER.filter(p => usable.includes(p)),
      ...usable.filter(m => /flash/.test(m) && !PREFER.includes(m)),
    ];
    if (!ordered.length) return { error: 'Боломжтой модель олдсонгүй' };
    return (MODEL_CACHE = ordered.slice(0, 4));
  } catch (e) { return { error: e.message }; }
}

// Амжилттай бол OpenAI хэлбэрийн хариу, бүтэлгүйтвэл {error} буцаана.
async function tryGemini(body) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return { error: 'GEMINI_API_KEY байхгүй' };

  const models = await pickModels(key);
  if (models.error) return { error: 'Модель сонгох: ' + models.error };

  const msgs = body?.messages || [];
  const sys  = msgs.filter(m => m.role === 'system').map(m => m.content).join('\n');
  const contents = msgs.filter(m => m.role !== 'system')
    .map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: String(m.content || '') }] }));
  while (contents.length && contents[0].role === 'model') contents.shift();
  if (!contents.length) return { error: 'Мессеж хоосон' };

  const payload = JSON.stringify({
    systemInstruction: sys ? { parts: [{ text: sys }] } : undefined,
    contents,
    generationConfig: {
      temperature: body?.temperature ?? 0.8,
      maxOutputTokens: body?.max_tokens ?? 800,
    },
  });

  // Модель бүрийг 2 удаа оролдоно; 503/429 (сервер завгүй) бол дараагийн модель рүү
  let last = 'тодорхойгүй';
  for (const model of models) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
        const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: payload });
        const d = await r.json();
        if (r.ok) {
          const parts = d.candidates?.[0]?.content?.parts || [];
          const text = parts.filter(p => p && !p.thought && p.text).map(p => p.text).join('').trim();
          if (text) return { choices: [{ message: { role: 'assistant', content: text } }], _model: model };
          last = `${model}: хоосон (${d.promptFeedback?.blockReason || d.candidates?.[0]?.finishReason || '?'})`;
          break;   // блоклогдсон бол дахин оролдох утгагүй
        }
        last = `${model} → ${r.status}: ${(d?.error?.message || '').slice(0, 120)}`;
        if (r.status === 503 || r.status === 429) { await sleep(900); continue; }
        break;     // бусад алдаанд дараагийн модель рүү
      } catch (e) { last = `${model}: ${e.message}`; await sleep(500); }
    }
  }
  return { error: last };
}

module.exports = async (req, res) => {
  const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';
  res.setHeader('Access-Control-Allow-Origin', CORS_ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-jarvis-secret');

  if (req.method === 'OPTIONS') return res.status(204).end();

  // GET → оношлогоо: энэ түлхүүр ямар моделиудад хүрч байгааг харуулна
  if (req.method === 'GET') {
    const key = process.env.GEMINI_API_KEY;
    if (!key) return res.status(503).json({ error: 'GEMINI_API_KEY байхгүй' });
    try {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
      const d = await r.json();
      if (!r.ok) return res.status(r.status).json({ error: d?.error?.message || 'models list' });
      const list = (d.models || [])
        .filter(m => (m.supportedGenerationMethods || []).includes('generateContent'))
        .map(m => ({
          name: String(m.name).replace(/^models\//, ''),
          in: m.inputTokenLimit, out: m.outputTokenLimit,
        }));
      return res.json({ count: list.length, chosen: MODEL_CACHE, models: list });
    } catch (e) { return res.status(502).json({ error: e.message }); }
  }

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
    if (g && !g.error) return res.json(g);
    return res.status(502).json({ error: 'AI хариу өгсөнгүй', detail: g?.error || 'тодорхойгүй' });
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
};
