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

const PREFER = [
  'gemini-flash-latest', 'gemini-2.5-flash', 'gemini-2.0-flash',
  'gemini-2.5-flash-lite', 'gemini-pro-latest', 'gemini-1.5-flash',
];

const sleep = ms => new Promise(r => setTimeout(r, ms));
let MODELS = null, warned = false;

function noKey() {
  if (!warned) {
    warned = true;
    console.warn('[AI] GEMINI_API_KEY байхгүй — AI хэсэг алгасагдана.');
  }
  return null;
}

async function models(key) {
  if (MODELS) return MODELS;
  if (process.env.GEMINI_MODEL) return (MODELS = [process.env.GEMINI_MODEL]);
  try {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
    const d = await r.json();
    if (!r.ok) { console.warn('[AI] моделийн жагсаалт:', d?.error?.message || r.status); return (MODELS = PREFER.slice(0, 3)); }
    const usable = (d.models || [])
      .filter(m => (m.supportedGenerationMethods || []).includes('generateContent'))
      .map(m => String(m.name).replace(/^models\//, ''))
      .filter(m => !/embedding|aqa|image|tts|live/.test(m));
    const ordered = [
      ...PREFER.filter(p => usable.includes(p)),
      ...usable.filter(m => /flash/.test(m) && !PREFER.includes(m)),
    ];
    MODELS = ordered.length ? ordered.slice(0, 4) : PREFER.slice(0, 3);
    console.log('[AI] модель:', MODELS[0]);
    return MODELS;
  } catch (e) { console.warn('[AI] жагсаалт:', e.message); return (MODELS = PREFER.slice(0, 3)); }
}

/**
 * @param {{system?:string, messages?:Array, prompt?:string,
 *          max_tokens?:number, temperature?:number, json?:boolean, tries?:number}} opt
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

  const list  = await models(key);
  const tries = opt.tries ?? 3;
  let last = '';
  for (const model of list) {
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
        last = `${model} → ${r.status}: ${(d?.error?.message || '').slice(0, 100)}`;
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
