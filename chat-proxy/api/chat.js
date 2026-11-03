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
// ── Моделийн сонголт — нэрийг хатуу бичихгүй, боломжтойгоос нь эрэмбэлнэ ──
// tier: 'pro'   — чухал ажил (HSK бичвэр шалгах, даалгавар зохиох)
//       'flash' — энгийн чат, зөвлөгөө
const SKIP_MODEL = /embedding|aqa|image|tts|transcribe|live|lyria|banana|veo|imagen|deep-research|customtools|omni/;
const FALLBACK = { pro: ['gemini-pro-latest', 'gemini-2.5-pro'], flash: ['gemini-flash-latest', 'gemini-2.5-flash'] };
let MODEL_CACHE = null;   // бүх боломжит моделийн түүхий жагсаалт
// Квот дууссан моделийг нэг удаа тэмдэглээд, тухайн ажиллалтын туршид
// дахин оролдохгүй — эс бөгөөс дуудлага бүр 20+ секунд дэмий хүлээнэ.
const EXHAUSTED = new Set();

const sleep = ms => new Promise(r => setTimeout(r, ms));

function rankModel(name, tier) {
  if (SKIP_MODEL.test(name)) return null;
  const isPro = /\bpro\b|-pro/.test(name), isLite = /lite/.test(name), isFlash = /flash/.test(name);
  if (!isPro && !isFlash) return null;
  const m = name.match(/gemini-(\d+(?:\.\d+)?)/);
  const ver = m ? parseFloat(m[1]) : (/latest/.test(name) ? 99 : 0);
  const fit = tier === 'pro'
    ? (isPro ? 3 : (isFlash && !isLite ? 2 : 1))
    : ((isFlash && !isLite) ? 3 : (isLite ? 2 : 1));
  const stable = /preview|exp/.test(name) ? 0 : 1;
  // «-latest» нэрс нь хамгийн шинэ модель рүү зааж, квот нь хурдан дуусдаг.
  // Тодорхой хувилбартайг нь түрүүлж оролдвол ажиллах магадлал өндөр.
  const alias = /latest/.test(name) ? -5 : 0;
  return fit * 1000 + ver * 10 + stable + alias;
}

async function allModels(key) {
  if (MODEL_CACHE) return MODEL_CACHE;
  try {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
    const d = await r.json();
    if (!r.ok) return { error: d?.error?.message || `models list ${r.status}` };
    MODEL_CACHE = (d.models || [])
      .filter(m => (m.supportedGenerationMethods || []).includes('generateContent'))
      .map(m => String(m.name).replace(/^models\//, ''));
    return MODEL_CACHE;
  } catch (e) { return { error: e.message }; }
}

async function pickModels(key, tier) {
  if (process.env.GEMINI_MODEL) return [process.env.GEMINI_MODEL];
  const all = await allModels(key);
  if (all.error) return all;
  const list = all.map(name => ({ name, r: rankModel(name, tier) }))
    .filter(x => x.r !== null).sort((a, b) => b.r - a.r).slice(0, 6).map(x => x.name);
  return list.length ? list : (FALLBACK[tier] || FALLBACK.flash);
}

// Амжилттай бол OpenAI хэлбэрийн хариу, бүтэлгүйтвэл {error} буцаана.
async function tryGemini(body) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return { error: 'GEMINI_API_KEY байхгүй' };

  const tier = body?.tier === 'pro' ? 'pro' : 'flash';
  const models = await pickModels(key, tier);
  if (models.error) return { error: 'Модель сонгох: ' + models.error };

  const msgs = body?.messages || [];
  const sys  = msgs.filter(m => m.role === 'system').map(m => m.content).join('\n');
  const contents = msgs.filter(m => m.role !== 'system')
    .map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: String(m.content || '') }] }));
  while (contents.length && contents[0].role === 'model') contents.shift();
  if (!contents.length) return { error: 'Мессеж хоосон' };

  // ШИНЭ МОДЕЛИУД «БОДДОГ»: дотоод бодолт нь гаралтын төсвийг идээд
  // харагдах текст үлдэхгүй болдог (finishReason = MAX_TOKENS).
  // · flash — бодолтыг унтрааж, бүх төсвийг хариуд нь өгнө
  // · pro   — бодолт нь чанарын гол давуу тал тул үлдээж, төсвийг нь өргөжүүлнэ
  const want = Math.max(256, body?.max_tokens ?? 800);
  const gen = {
    temperature: body?.temperature ?? 0.8,
    maxOutputTokens: tier === 'pro' ? Math.max(4096, want * 4) : want,
  };
  if (tier !== 'pro') gen.thinkingConfig = { thinkingBudget: 0 };
  const payload = JSON.stringify({
    systemInstruction: sys ? { parts: [{ text: sys }] } : undefined,
    contents, generationConfig: gen,
  });

  // Модель бүрийг 2 удаа оролдоно; 503/429 (сервер завгүй) бол дараагийн модель рүү
  // Vercel функц тасрахаас өмнө заавал хариу буцаахын тулд цагийн төсөвтэй
  const DEADLINE = Date.now() + 45000;
  let last = 'тодорхойгүй';
  const trail = [];   // модель бүрийн үр дүн — оношлоход
  for (const model of models) {
    if (EXHAUSTED.has(model)) continue;
    if (Date.now() > DEADLINE) { last = 'цаг дууслаа: ' + last; break; }
    for (let attempt = 0; attempt < 2; attempt++) {
      if (Date.now() > DEADLINE) break;
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
        const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: payload });
        const d = await r.json();
        if (r.ok) {
          const parts = d.candidates?.[0]?.content?.parts || [];
          const text = parts.filter(p => p && !p.thought && p.text).map(p => p.text).join('').trim();
          if (text) return { choices: [{ message: { role: 'assistant', content: text } }], _model: model };
          last = `${model}: хоосон (${d.promptFeedback?.blockReason || d.candidates?.[0]?.finishReason || '?'})`;
          trail.push(last);
          break;   // блоклогдсон бол дахин оролдох утгагүй
        }
        const msg = d?.error?.message || '';
        last = `${model} → ${r.status}: ${msg.slice(0, 120)}`;
        trail.push(last);
        // 404 = энэ түлхүүрт боломжгүй модель, 429+quota = квот дууссан
        if (r.status === 404 || (r.status === 429 && /quota/i.test(msg))) { EXHAUSTED.add(model); break; }
        if (r.status === 503 || r.status === 429) { await sleep(900); continue; }
        break;     // бусад алдаанд дараагийн модель рүү
      } catch (e) { last = `${model}: ${e.message}`; await sleep(500); }
    }
  }
  return { error: last, trail };
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
      return res.json({
        count: list.length,
        pro:   await pickModels(key, 'pro'),
        flash: await pickModels(key, 'flash'),
        models: list,
      });
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
    return res.status(502).json({ error: 'AI хариу өгсөнгүй', detail: g?.error || 'тодорхойгүй', trail: g?.trail });
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
};
