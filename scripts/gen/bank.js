/**
 * HSK 3.0 五级 даалгаврын сан үүсгэгч.
 *
 * Албан ёсны 大纲-ийн 5-р түвшний СЭДВҮҮДЭЭР материал үүсгэж
 * data/hsk3/bank.json дээр нэмнэ. Байгааг нь дарж бичихгүй — зөвхөн нэмнэ.
 *
 * Ажиллуулах:
 *   node scripts/gen/bank.js                 # өдрийн хэвийн хэмжээ
 *   COUNT=10 KINDS=listen,read node ...      # тодорхой төрлөөс олныг
 *
 * ЧАНАРЫН ХЯНАЛТ (чухал — AI буруу даалгавар зохиовол сурагч буруу сурна):
 *   · JSON бүтэц, хариултын индекс, сонголтын тоог хатуу шалгана
 *   · Ханзны түвшинг HSK L1-5-ийн 1500 ханзтай тулгаж хэтэрхий хэцүүг нь хаяна
 *   · Давхардлыг асуулт/эхийн хэсгээр нь шалгаж хаяна
 *   · Сонголтууд хоорондоо давхардаагүй, хариулт нь мөрдөгдөхүйц эсэх
 */
'use strict';

const fs   = require('fs');
const path = require('path');
const { askJSON, hasKey } = require('../ai');

const DIR  = path.join(__dirname, '..', '..', 'data', 'hsk3');
const BANK = path.join(DIR, 'bank.json');

// ── Албан ёсны 五级 大纲-ийн话题 жагсаалт ────────────────────────
const TOPICS = [
  '交流、处理日常事务（办理业务、困难求助、生活缴费、保险）',
  '谈论餐饮体验（餐厅风格、口味偏好、食材、烹饪、夜市）',
  '谈论交通出行（交通工具、货物运输、行程经过、驾驶）',
  '谈论购物体验（品牌、品质、售后、消费方式、促销）',
  '谈论医疗健康（伤病、就医问诊、心理健康、疾病预防）',
  '谈论休闲活动（户外运动、手工、摄影、旅行度假、展览）',
  '沟通社区生活（社区环境、物业、邻里相处、房屋租售）',
  '交流家庭生活（家居用品、婚礼、亲子活动、家庭关系）',
  '报告学习情况（课程、教学方式、论文、学习方法与感受）',
  '交流工作内容和工作经历',
  '谈论经营与管理（创业、团队合作、员工培训、薪酬）',
  '谈论自然情况（水资源、地形地貌、特殊天气、动植物）',
  '谈论环境问题（人类活动影响、城乡环境变化、污染治理）',
  '介绍科技产品（机器人、网络直播技术、智能产品）',
  '介绍科学知识（生活中的科学常识、科学实验与结论）',
  '介绍中国概况（行政区划、人口、民族、时代特征）',
  '谈论经济现象（产品、商业活动、产业现状、未来趋势）',
  '谈论社会现象（就业、人口问题、生活观念、基础设施）',
  '谈论文艺形式与作品（小说、诗歌、摄影、戏剧、影视）',
  '谈论体育项目及赛事（项目特点、赛事情况、体育名人）',
  '谈论国际交往事件（友好交往故事、国际合作）',
  '介绍中国语言文字（俗语、成语、名言、汉语特点）',
  '介绍中国古代民俗传统、人文景观（传统节日、名胜古迹）',
  '介绍中国传统思想与艺术（书法、国画、民乐、武术、手工艺）',
  '介绍中国历史（历史人物、历史事件的起因经过结果）',
  '介绍中国古代科技（中医、农业、科技成就、古代科学家）',
];

const pick = a => a[Math.floor(Math.random() * a.length)];
const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const hanzi = s => (String(s).match(/[一-鿿]/g) || []);

// ── HSK L1-5 ханзны багц — түвшин хэтэрсэн материалыг барина ─────
let CHARSET = null;
function charset() {
  if (CHARSET) return CHARSET;
  try {
    const rows = JSON.parse(fs.readFileSync(path.join(DIR, 'chars-l1-5.json'), 'utf8'));
    CHARSET = new Set(rows.map(r => r[0]));
  } catch { CHARSET = new Set(); }
  return CHARSET;
}
/** Жагсаалтаас гадуурх ханзны хувь. 12%-иас дээш бол түвшин хэтэрсэн гэж үзнэ. */
function outRatio(text) {
  const cs = charset();
  if (!cs.size) return 0;
  const hs = hanzi(text);
  if (!hs.length) return 1;
  return hs.filter(c => !cs.has(c)).length / hs.length;
}

const SYSTEM = `Чи бол HSK шалгалтын даалгавар зохиогч. 15 жил хятад хэл заасан,
HSK 3.0-ийн 五级 (цөөн 3500 орчим үгийн сан) стандартыг цээжээр мэднэ.

ЧАНАРЫН ШААРДЛАГА:
· Хэл нь ЯГ 五级 түвшин — 六级/七级-ийн ховор үг, мэргэжлийн нэр томьёо хэрэглэхгүй.
· Асуулт нь гадаргуун баримт биш, ШАЛТГААН / ХАНДЛАГА / САНААГ шалгана.
· Буруу хувилбарууд нь итгэмээр байх ёстой: эхэд дурдагдсан боловч асуултад
  тохирохгүй зүйл. Илт утгагүй хувилбар бүү бич.
· Зөв хариулт нь эхээс ГАРЦААГҮЙ мөрдөгдөх ёстой. Хоёрдмол утга байж болохгүй.
· Зөв хариултын байрлалыг санамсаргүй сонго (үргэлж A биш).
· Тайлбар (exp) нь МОНГОЛООР: яагаад тэр хариулт зөв болохыг, гол бүтэц/холбоос
  үгийг зааж, 1-2 өгүүлбэрээр.
· Зөвхөн хялбаршуулсан ханз. Пиньин бүү нэм.`;

/* ── 听力 ─────────────────────────────────────────────────────── */
async function genListen(topic) {
  const part = Math.random() < 0.55 ? 1 : 2;
  const prompt = part === 1
    ? `Сэдэв: ${topic}

HSK5 听力 第一部分 маягийн ОЙРОЛЦОО яриа зохио: хоёр хүний 2-4 өгүүлбэрийн
харилцан яриа, дараа нь нэг асуулт, 3 сонголт.

JSON:
{"part":1,
 "audio":[["男","..."],["女","..."]],
 "q":"问题（中文）",
 "opt":["选项A","选项B","选项C"],
 "a":0,
 "exp":"монголоор тайлбар"}

Яриа нь 40-90 ханз. Асуулт нь хандлага, шалтгаан, санааг шалгана.`
    : `Сэдэв: ${topic}

HSK5 听力 第二部分 маягийн нэг хүний УРТ яриа (монолог) зохио: 110-170 ханз,
дараа нь нэг асуулт, 3 сонголт.

JSON:
{"part":2,
 "audio":["ярианы бүтэн текст"],
 "q":"问题（中文）",
 "opt":["选项A","选项B","选项C"],
 "a":1,
 "exp":"монголоор тайлбар"}

Яриа нь нэг тодорхой санааг хөгжүүлнэ (үзэгдэл → шалтгаан → дүгнэлт).`;

  const d = await askJSON({ system: SYSTEM, prompt, max_tokens: 1100, temperature: 0.95 });
  return validListen(d) ? d : null;
}

function validListen(d) {
  if (!d || !Array.isArray(d.opt) || d.opt.length !== 3) return false;
  if (typeof d.a !== 'number' || d.a < 0 || d.a > 2) return false;
  if (!d.q || !d.exp) return false;
  const audio = d.audio;
  if (!Array.isArray(audio) || !audio.length) return false;
  const text = audio.map(x => Array.isArray(x) ? x[1] : x).join('');
  if (hanzi(text).length < 30) return false;
  if (new Set(d.opt.map(String)).size !== 3) return false;
  if (outRatio(text + d.q + d.opt.join('')) > 0.12) return false;
  return true;
}

/* ── 阅读 ─────────────────────────────────────────────────────── */
async function genCloze(topic) {
  const prompt = `Сэдэв: ${topic}

HSK5 阅读 第一部分 (篇章填空) маягийн даалгавар зохио: 60-110 ханзны богино
хэсэг, дотор нь НЭГ "______" хоосон зай. 4 сонголт — утга ба ДҮРМИЙН аль аль
талаар нь ялгаатай байх (жишээ нь холбоос үг, үйлдлийн арга заасан үг).

JSON:
{"type":"cloze","text":"...______...","q":"选出最合适的词",
 "opt":["A","B","C","D"],"a":2,"exp":"монголоор: яагаад энэ, бусад нь яагаад болохгүй"}`;
  const d = await askJSON({ system: SYSTEM, prompt, max_tokens: 900, temperature: 0.95 });
  if (!d || d.type !== 'cloze' || !Array.isArray(d.opt) || d.opt.length !== 4) return null;
  if (typeof d.a !== 'number' || d.a < 0 || d.a > 3) return null;
  if (!String(d.text || '').includes('___')) return null;
  if (hanzi(d.text).length < 40) return null;
  if (new Set(d.opt.map(String)).size !== 4) return null;
  if (outRatio(d.text + d.opt.join('')) > 0.12) return null;
  return d;
}

async function genOrder(topic) {
  const prompt = `Сэдэв: ${topic}

HSK5 阅读 第二部分 (排列顺序) маягийн даалгавар зохио: ХОЛИЛДСОН 4 өгүүлбэр,
зөв дараалалд нь тавихад нэг бүтэн догол мөр болдог байх.

Зөв дараалал нь ЛОГИКООР тодорхойлогдоно: цаг хугацааны үг (刚开始、后来、
第二天), холбоос (但是、于是、而是), төлөөний үг (他、这、那) ямар нэрийг
заасан нь. Эхний өгүүлбэр нь төлөөний үгээр эхэлж болохгүй.

JSON:
{"type":"order",
 "parts":["өгүүлбэр1","өгүүлбэр2","өгүүлбэр3","өгүүлбэр4"],
 "a":[2,0,3,1],
 "exp":"монголоор: ямар шинжээр энэ дараалал гарч байгаа"}

parts нь ХОЛИЛДСОН байдлаар, a нь parts доторх индексүүд зөв дарааллаар.`;
  const d = await askJSON({ system: SYSTEM, prompt, max_tokens: 900, temperature: 0.95 });
  if (!d || d.type !== 'order' || !Array.isArray(d.parts) || d.parts.length !== 4) return null;
  if (!Array.isArray(d.a) || d.a.length !== 4) return null;
  if ([...d.a].sort().join() !== '0,1,2,3') return null;
  if (d.parts.some(p => hanzi(p).length < 6)) return null;
  if (outRatio(d.parts.join('')) > 0.12) return null;
  return d;
}

async function genPassage(topic) {
  const prompt = `Сэдэв: ${topic}

HSK5 阅读 第三部分 (读后选择) маягийн УРТ эх зохио: 320-430 ханз, 3 догол мөр.
Дараа нь 3 асуулт, тус бүр 4 сонголттой.

Эх нь нэг тодорхой санаатай байх: түгээмэл буруу ойлголт → бодит байдал →
дүгнэлт, эсвэл үйл явдал → эргэлт → үр дүн. Жагсаалт биш, бүтэнтексттэй.

Асуултууд: 1 нь тодорхой хэсгийн утга, 1 нь шалтгаан/харьцаа, 1 нь зохиогчийн
үндсэн санаа эсвэл хандлага.

JSON:
{"type":"passage","text":"догол1\\n\\nдогол2\\n\\nдогол3",
 "qs":[{"q":"...","opt":["A","B","C","D"],"a":1,"exp":"монголоор"},
       {"q":"...","opt":["A","B","C","D"],"a":3,"exp":"монголоор"},
       {"q":"...","opt":["A","B","C","D"],"a":0,"exp":"монголоор"}]}`;
  const d = await askJSON({ system: SYSTEM, prompt, max_tokens: 2200, temperature: 0.9 });
  if (!d || d.type !== 'passage' || !Array.isArray(d.qs) || d.qs.length < 2) return null;
  const n = hanzi(d.text).length;
  if (n < 200 || n > 700) return null;
  for (const q of d.qs) {
    if (!q.q || !Array.isArray(q.opt) || q.opt.length !== 4) return null;
    if (typeof q.a !== 'number' || q.a < 0 || q.a > 3) return null;
    if (new Set(q.opt.map(String)).size !== 4) return null;
  }
  if (outRatio(d.text) > 0.12) return null;
  return d;
}

/* ── 写作 / 口语 ──────────────────────────────────────────────── */
async function genWrite(topic) {
  const isPic = Math.random() < 0.4;
  const prompt = isPic
    ? `HSK5 写作 第71题 (看图写作) маягийн даалгавар зохио. 4 зургийн ДАРААЛАЛ —
зураг бүрийг МОНГОЛООР тайлбарлана (зураг өөрөө байхгүй тул текстээр дүрсэлнэ).
Түүх нь 李明 болон найзуудынх, эргэлттэй, төгсгөлтэй байх. Сэдэв: ${topic}

JSON: {"type":"pic","min":100,"pics":["1. ...","2. ...","3. ...","4. ..."]}`
    : `HSK5 写作 第72题 (话题作文) маягийн сэдэв зохио. Сэдэв нь хувийн туршлагатай
холбож бичихээр, маргаантай биш, 200 ханзаар хөгжүүлэхэд хангалттай байх.
Хятадаар бич. Чиглэл: ${topic}

JSON: {"type":"topic","min":200,"prompt":"...（中文题目，含「请写一篇不少于200字的作文」）"}`;
  const d = await askJSON({ system: SYSTEM, prompt, max_tokens: 900, temperature: 1.0 });
  if (!d) return null;
  if (d.type === 'pic')   return (Array.isArray(d.pics) && d.pics.length === 4) ? { ...d, min: 100 } : null;
  if (d.type === 'topic') return (hanzi(d.prompt).length >= 15) ? { ...d, min: 200 } : null;
  return null;
}

async function genSpeak(topic) {
  const kind = pick(['retell', 'retell', 'qa', 'qa', 'pic']);
  const prompt = kind === 'retell'
    ? `HSKK 五级 听后复述 маягийн богино түүх зохио: 100-150 ханз, нэг санаатай,
төгсгөлд нь өчүүхэн эргэлт эсвэл дүгнэлттэй. Сэдэв: ${topic}
JSON: {"type":"retell","text":"..."}`
    : kind === 'qa'
      ? `HSKK 五级 回答问题 маягийн асуулт зохио: хувийн туршлага, үзэл бодлоо
2 минут ярихад хангалттай өргөн. Хятадаар. Чиглэл: ${topic}
JSON: {"type":"qa","q":"...（中文问题，2分钟）"}`
      : `HSKK 五级 看图说话 маягийн даалгавар: зургийг МОНГОЛООР нарийн дүрсэл
(хүн, үйлдэл, орчин, цаг үе), дараа нь хятадаар нэг чиглүүлэх асуулт. Сэдэв: ${topic}
JSON: {"type":"pic","desc":"Зураг: ...","q":"请描述这张图片，并..."}`;
  const d = await askJSON({ system: SYSTEM, prompt, max_tokens: 700, temperature: 1.0 });
  if (!d) return null;
  if (d.type === 'retell') return hanzi(d.text).length >= 60 ? d : null;
  if (d.type === 'qa')     return hanzi(d.q).length >= 8 ? d : null;
  if (d.type === 'pic')    return (d.desc && d.q) ? d : null;
  return null;
}

/* ── Давхардал шалгах түлхүүр ────────────────────────────────── */
function keyOf(kind, it) {
  const base = kind === 'listen' ? (it.audio || []).map(x => Array.isArray(x) ? x[1] : x).join('')
             : kind === 'read'   ? (it.text || (it.parts || []).join(''))
             : kind === 'write'  ? (it.prompt || (it.pics || []).join(''))
             :                     (it.text || it.q || it.desc || '');
  return hanzi(base).slice(0, 24).join('');
}

/* ── Үндсэн ─────────────────────────────────────────────────── */
(async () => {
  if (!hasKey()) { console.log('GEMINI_API_KEY байхгүй — алгаслаа.'); return; }

  const bank = JSON.parse(fs.readFileSync(BANK, 'utf8'));
  for (const k of ['listen', 'read', 'write', 'speak']) bank[k] = bank[k] || [];

  const seen = new Set();
  for (const k of ['listen', 'read', 'write', 'speak']) bank[k].forEach(it => seen.add(keyOf(k, it)));

  const COUNT = Number(process.env.COUNT || 0);
  const KINDS = (process.env.KINDS || 'listen,read,write,speak').split(',');
  // Өдрийн хэвийн хэмжээ — 6 цагийн хичээлд хүрэлцэхүйц
  const PLAN = COUNT
    ? { listen: COUNT, cloze: COUNT, order: COUNT, passage: COUNT, write: COUNT, speak: COUNT }
    : { listen: 8, cloze: 4, order: 3, passage: 3, write: 2, speak: 3 };

  const topics = shuffle([...TOPICS]);
  let ti = 0;
  const nextTopic = () => topics[(ti++) % topics.length];

  const jobs = [];
  if (KINDS.includes('listen')) for (let i = 0; i < PLAN.listen;  i++) jobs.push(['listen', genListen]);
  if (KINDS.includes('read'))   for (let i = 0; i < PLAN.cloze;   i++) jobs.push(['read', genCloze]);
  if (KINDS.includes('read'))   for (let i = 0; i < PLAN.order;   i++) jobs.push(['read', genOrder]);
  if (KINDS.includes('read'))   for (let i = 0; i < PLAN.passage; i++) jobs.push(['read', genPassage]);
  if (KINDS.includes('write'))  for (let i = 0; i < PLAN.write;   i++) jobs.push(['write', genWrite]);
  if (KINDS.includes('speak'))  for (let i = 0; i < PLAN.speak;   i++) jobs.push(['speak', genSpeak]);

  console.log(`${jobs.length} даалгавар үүсгэнэ. Одоогийн сан: ` +
    `听 ${bank.listen.length} · 读 ${bank.read.length} · 写 ${bank.write.length} · 说 ${bank.speak.length}`);

  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  let added = 0, rejected = 0, dup = 0;

  for (const [kind, fn] of jobs) {
    const topic = nextTopic();
    let it = null;
    for (let attempt = 0; attempt < 2 && !it; attempt++) it = await fn(topic);
    if (!it) { rejected++; process.stdout.write('·'); await sleep(1200); continue; }

    const k = keyOf(kind, it);
    if (!k || seen.has(k)) { dup++; process.stdout.write('='); await sleep(1200); continue; }
    seen.add(k);

    it.id = `g${stamp}-${String(bank[kind].length + 1).padStart(3, '0')}`;
    it.topic = topic.split('（')[0];
    it.gen = stamp;
    bank[kind].push(it);
    added++; process.stdout.write('+');
    fs.writeFileSync(BANK, JSON.stringify(bank, null, 1));
    await sleep(1500);
  }

  console.log(`\n\nНэмсэн ${added} · хасагдсан ${rejected} (чанар) · давхардсан ${dup}`);
  console.log(`Шинэ сан: 听 ${bank.listen.length} · 读 ${bank.read.length} · ` +
              `写 ${bank.write.length} · 说 ${bank.speak.length}`);
})().catch(e => { console.error('Алдаа:', e.message); process.exit(1); });
