/**
 * HSK 3.0 үгсийн МОНГОЛ тайлбарыг багцаар үүсгэнэ (Gemini).
 *
 * Оролт : data/hsk3/words-l{1..5}.json   [үг, пиньин, POS, англи]
 * Гаралт: data/hsk3/mn-l{1..5}.json      ["монгол тайлбар", ...]  (индекс нь таарна)
 *
 * Дахин ажиллуулахад аль хэдийн бэлэн болсон хэсгийг алгасна — тасалдсан
 * газраасаа үргэлжилнэ. GEMINI_API_KEY шаардана.
 */
'use strict';
const fs   = require('fs');
const path = require('path');

const { askJSON, hasKey } = require('../ai');

const DIR    = path.join(__dirname, '..', '..', 'data', 'hsk3');
const BATCH  = 40;
const LEVELS = (process.env.LEVELS || '5,4,3,2,1').split(',').map(Number);
const sleep  = ms => new Promise(r => setTimeout(r, ms));

const SYSTEM = `Чи бол 15 жил хятад хэл заасан, монгол хэлээр тайлбарладаг багш.
Хятад үг бүрийг МОНГОЛООР богино, ойлгомжтой тайлбарла.

ДҮРЭМ:
- 1-4 үгээр. Тодорхойлолт биш, ОРЧУУЛГА. Кирилл үсгээр.
- Үйл үг бол "-х" төгсгөлтэй (жишээ: тайвшруулах).
- Үндсэн, хамгийн түгээмэл утгыг нь өг. Хоёр гол утгатай бол таслалаар тусгаарла.
- Хятад ханз, пиньин, англи үг бүү оруул.
- Монголчуудын өдөр тутам хэрэглэдэг энгийн үг сонго.

ЖИШЭЭ:
安慰 ānwèi (V) to comfort → тайвшруулах
显然 xiǎnrán (Adj) obvious → илэрхий, тодорхой
不得不 bùdébù (Adv) have no choice but → заавал, аргагүй
把握 bǎwò (V/N) to grasp; certainty → атгах, итгэлтэй байдал`;

const BAD = /[一-鿿]|[a-zA-Z]{3,}/;   // ханз эсвэл англи үг үлдсэн эсэх

async function doLevel(lv) {
  const wordsPath = path.join(DIR, `words-l${lv}.json`);
  const outPath   = path.join(DIR, `mn-l${lv}.json`);
  const words = JSON.parse(fs.readFileSync(wordsPath, 'utf8'));
  let out = fs.existsSync(outPath) ? JSON.parse(fs.readFileSync(outPath, 'utf8')) : [];
  while (out.length < words.length) out.push('');

  const todo = words.map((_, i) => i).filter(i => !out[i]);
  console.log(`\n── L${lv}: ${words.length} үг, ${todo.length} дутуу ──`);
  if (!todo.length) return;

  for (let s = 0; s < todo.length; s += BATCH) {
    const idxs  = todo.slice(s, s + BATCH);
    const lines = idxs.map((i, n) => {
      const [w, p, pos, en] = words[i];
      return `${n + 1}. ${w} ${p} (${pos}) — ${en.slice(0, 70)}`;
    }).join('\n');

    const prompt =
      `Доорх ${idxs.length} хятад үгийн монгол тайлбарыг өг.\n` +
      `ЗӨВХӨН JSON буцаа, ийм хэлбэрээр: {"mn":["тайлбар1","тайлбар2",...]} — ` +
      `массивт яг ${idxs.length} элемент, өгсөн дарааллаар.\n\n${lines}`;

    const parsed = await askJSON({ tier: 'pro', system: SYSTEM, prompt, max_tokens: 2048, temperature: 0.2 });
    const arr = Array.isArray(parsed) ? parsed
              : (parsed && Object.values(parsed).find(v => Array.isArray(v))) || null;
    if (!Array.isArray(arr) || arr.length !== idxs.length) {
      console.warn(`  ✗ ${s}-${s + idxs.length}: хариу тохирсонгүй (${Array.isArray(arr) ? arr.length : 'JSON биш'})`);
      await sleep(2000);
      continue;
    }

    let ok = 0;
    arr.forEach((mn, n) => {
      mn = String(mn || '').trim();
      if (!mn || BAD.test(mn) || mn.length > 60) return;   // чанар хангаагүйг хоосон орхино
      out[idxs[n]] = mn; ok++;
    });
    fs.writeFileSync(outPath, JSON.stringify(out, null, 0));
    console.log(`  ✓ ${s + idxs.length}/${todo.length} (${ok}/${idxs.length} хүлээн авав)`);
    await sleep(2500);   // үнэгүй багцын хурдны хязгаарт тохируулав
  }

  const done = out.filter(Boolean).length;
  console.log(`── L${lv} дүн: ${done}/${words.length} (${Math.round(done / words.length * 100)}%)`);
}

(async () => {
  if (!hasKey()) {
    console.log('GEMINI_API_KEY байхгүй — алгаслаа.');
    return;   // алдаа биш
  }
  for (const lv of LEVELS) await doLevel(lv);
  console.log('\nДууслаа.');
})().catch(e => { console.error('Алдаа:', e.message); process.exit(1); });
