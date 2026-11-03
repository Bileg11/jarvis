/**
 * JARVIS-ийн AI дуудлагын ГАНЦ цэг (Node скриптүүдэд).
 *
 * ТЭМДЭГЛЭЛ (2026-11): GitHub Models (models.inference.ai.azure.com) үйлчилгээ
 * 2026-07-30-нд бүрмөсөн хаагдсан — DNS нь ч байхгүй болсон. Тиймээс бүх
 * скрипт Gemini рүү шилжсэн. GEMINI_API_KEY байхгүй бол null буцаана
 * (програм унахгүй, дуудсан тал нь fallback-аа ашиглана).
 */
'use strict';

const MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
const sleep = ms => new Promise(r => setTimeout(r, ms));

let warned = false;
function noKey() {
  if (!warned) {
    warned = true;
    console.warn('[AI] GEMINI_API_KEY байхгүй — AI хэсэг алгасагдана. ' +
      'Google AI Studio-гоос ҮНЭГҮЙ түлхүүр авч GitHub secret-д нэм.');
  }
  return null;
}

/**
 * @param {{system?:string, messages?:Array, prompt?:string,
 *          max_tokens?:number, temperature?:number, json?:boolean}} opt
 * @returns {Promise<string|null>} хариу текст, эсвэл null
 */
async function ask(opt = {}) {
  const KEY = process.env.GEMINI_API_KEY;
  if (!KEY) return noKey();

  const msgs = opt.messages || (opt.prompt ? [{ role: 'user', content: opt.prompt }] : []);
  const sys  = [opt.system, ...msgs.filter(m => m.role === 'system').map(m => m.content)]
    .filter(Boolean).join('\n');
  const contents = msgs.filter(m => m.role !== 'system')
    .map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: String(m.content || '') }] }));
  while (contents.length && contents[0].role === 'model') contents.shift();
  if (!contents.length) return null;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${KEY}`;
  const body = {
    contents,
    systemInstruction: sys ? { parts: [{ text: sys }] } : undefined,
    generationConfig: {
      temperature: opt.temperature ?? 0.7,
      maxOutputTokens: opt.max_tokens ?? 800,
      ...(opt.json ? { responseMimeType: 'application/json' } : {}),
    },
  };

  for (let i = 0; i < 4; i++) {
    try {
      const r = await fetch(url, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      if (r.status === 429 || r.status >= 500) { await sleep(6000 * (i + 1)); continue; }
      if (!r.ok) { console.warn('[AI] Gemini', r.status, (await r.text()).slice(0, 160)); return null; }
      const d = await r.json();
      const parts = d.candidates?.[0]?.content?.parts || [];
      const text = parts.filter(p => p && !p.thought && p.text).map(p => p.text).join('').trim();
      if (text) return text;
      return null;
    } catch (e) { console.warn('[AI] алдаа:', e.message); await sleep(3000 * (i + 1)); }
  }
  return null;
}

module.exports = { ask, hasKey: () => !!process.env.GEMINI_API_KEY };
