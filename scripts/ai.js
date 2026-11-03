/**
 * JARVIS-ийн AI дуудлагын ГАНЦ цэг (Node скриптүүдэд).
 *
 * ТЭМДЭГЛЭЛ (2026-11): GitHub Models (models.inference.ai.azure.com) үйлчилгээ
 * 2026-07-30-нд бүрмөсөн хаагдсан. Бүх скрипт Gemini рүү шилжсэн.
 *
 * Хоёр зүйлийг онцгойлон анхаарсан:
 *   · Загварын нэрийг ХАТУУ бичихгүй — боломжтойг нь жагсаалтаас сонгоно
 *     (нэр солигдоход чимээгүй унахаас сэргийлнэ).
 *   · Үнэгүй багц 503 "high demand" байнга буцаадаг — дахин оролдож,
 *     шаардвал өөр модель рүү шилжинэ.
 *
 * GEMINI_API_KEY байхгүй бол null буцаана (програм унахгүй).
 */
'use strict';


// ── Моделийн сонголт — нэрийг хатуу бичихгүй, боломжтойгоос нь эрэмбэлнэ ──
// tier: 'pro'   — чухал ажил (бичвэр шалгах, даалгавар зохиох, орчуулга)
//       'flash' — энгийн ажил (чат, зөвлөгөө, хураангуй)
const SKIP_MODEL = /embedding|aqa|image|tts|transcribe|live|lyria|banana|veo|imagen|deep-research|customtools|omni/;

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
  return fit * 1000 + ver * 10 + stable;
}

function chooseModels(all, tier, n = 4) {
  return all.map(name => ({ name, r: rankModel(name, tier) }))
    .filter(x => x.r !== null).sort((a, b) => b.r - a.r)
    .slice(0, n).map(x => x.name);
}

const FALLBACK = { pro: ['gemini-pro-latest', 'gemini-2.5-pro'], flash: ['gemini-flash-latest', 'gemini-2.5-flash'] };

const sleep = ms => new Promise(r => setTimeout(r, ms));
let ALL = null, warned = false;

// Квот дууссан моделийг нэг удаа тэмдэглээд, тухайн ажиллалтын туршид
// дахин оролдохгүй — эс бөгөөс дуудлага бүр 20+ секунд дэмий хүлээнэ.
const EXHAUSTED = new Set();


function noKey() {
  if (!warned) {
    warned = true;
    console.warn('[AI] GEMINI_API_KEY байхгүй — AI хэсэг алгасагдана.');
  }
  return null;
}

async function allModels(key) {
  if (ALL) return ALL;
  try {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
    const d = await r.json();
    if (!r.ok) { console.warn('[AI] моделийн жагсаалт:', d?.error?.message || r.status); return (ALL = []); }
    ALL = (d.models || [])
      .filter(m => (m.supportedGenerationMethods || []).includes('generateContent'))
      .map(m => String(m.name).replace(/^models\//, ''));
    return ALL;
  } catch (e) { console.warn('[AI] жагсаалт:', e.message); return (ALL = []); }
}

async function models(key, tier) {
  if (process.env.GEMINI_MODEL) return [process.env.GEMINI_MODEL];
  const all = await allModels(key);
  const list = all.length ? chooseModels(all, tier) : [];
  const out = list.length ? list : FALLBACK[tier] || FALLBACK.flash;
  if (!models._logged) { models._logged = {}; }
  if (!models._logged[tier]) { models._logged[tier] = 1; console.log(`[AI] ${tier}: ${out.join(' → ')}`); }
  return out;
}

/**
 * @param {{system?:string, messages?:Array, prompt?:string,
 *          max_tokens?:number, temperature?:number, json?:boolean, tries?:number,
 *          tier?:'pro'|'flash'}} opt
 * @returns {Promise<string|null>} хариу текст, эсвэл null
 */
async function ask(opt = {}) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return noKey();

  const msgs = opt.messages || (opt.prompt ? [{ role: 'user', content: opt.prompt }] : []);
  const sys  = [opt.system, ...msgs.filter(m => m.role === 'system').map(m => m.content)]
    .filter(Boolean).join('\n');
  const contents = msgs.filter(m => m.role !== 'system')
    .map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: String(m.content || '') }] }));
  while (contents.length && contents[0].role === 'model') contents.shift();
  if (!contents.length) return null;

  const payload = JSON.stringify({
    contents,
    systemInstruction: sys ? { parts: [{ text: sys }] } : undefined,
    generationConfig: {
      temperature: opt.temperature ?? 0.7,
      maxOutputTokens: opt.max_tokens ?? 800,
      ...(opt.json ? { responseMimeType: 'application/json' } : {}),
    },
  });

  const list  = await models(key, opt.tier === 'pro' ? 'pro' : 'flash');
  const tries = opt.tries ?? 3;
  let last = '';
  for (const model of list) {
    if (EXHAUSTED.has(model)) continue;
    for (let i = 0; i < tries; i++) {
      try {
        const r = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
          { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: payload });
        const d = await r.json();
        if (r.ok) {
          const parts = d.candidates?.[0]?.content?.parts || [];
          const text = parts.filter(p => p && !p.thought && p.text).map(p => p.text).join('').trim();
          if (text) return text;
          last = `${model}: хоосон (${d.promptFeedback?.blockReason || d.candidates?.[0]?.finishReason || '?'})`;
          break;
        }
        const msg = d?.error?.message || '';
        last = `${model} → ${r.status}: ${msg.slice(0, 100)}`;
        if (r.status === 429 && /quota/i.test(msg)) {
          EXHAUSTED.add(model);                       // өдрийн квот — хүлээгээд нэмэргүй
          console.warn(`[AI] ${model}: квот дууслаа, дараагийн модель руу`);
          break;
        }
        if (r.status === 503 || r.status === 429) { await sleep(4000 * (i + 1)); continue; }
        break;
      } catch (e) { last = `${model}: ${e.message}`; await sleep(2500 * (i + 1)); }
    }
  }
  console.warn('[AI]', last);
  return null;
}

/** JSON хариу хүсэх — задлаад объект/массив буцаана, бүтэлгүйтвэл null */
async function askJSON(opt = {}) {
  const raw = await ask({ ...opt, json: true });
  if (!raw) return null;
  try { return JSON.parse(raw); } catch {}
  const m = raw.match(/[[{][\s\S]*[\]}]/);
  if (m) { try { return JSON.parse(m[0]); } catch {} }
  return null;
}

module.exports = { ask, askJSON, hasKey: () => !!process.env.GEMINI_API_KEY };
