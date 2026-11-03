/**
 * ӨДРИЙН ТАЙЛАН — Firestore-оос өдрийн бүх дата цуглуулж reports/ дор
 * markdown файл болгон бичнэ. Энэ файлыг Claude уншиж зөвлөгөө өгнө.
 *
 * Зарчим: энэ скрипт ЗӨВХӨН баримт цуглуулна, дүгнэлт хийхгүй.
 * Дүгнэлтийг хүчтэй модель (Claude) хийнэ — тиймээс тоонуудыг
 * аль болох түүхий, бүрэн, харьцуулах боломжтой байдлаар бичнэ.
 *
 * Ажиллуулах: node scripts/daily-report.js [YYYY-MM-DD]
 * Шаардлага: FIREBASE_SERVICE_ACCOUNT, USER_UID
 */
'use strict';

const fs   = require('fs');
const path = require('path');
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

const TZ   = 'Asia/Ulaanbaatar';
const UID  = process.env.USER_UID;
const DAY  = process.argv[2] || new Date().toLocaleDateString('sv', { timeZone: TZ });
const EXAM = new Date('2026-12-13T14:00:00+08:00');
const TARGET = 240, PASS = 180;

const daysLeft = () => Math.max(0, Math.ceil((EXAM - new Date(DAY + 'T12:00:00+08:00')) / 86400000));
const shift = (d, n) => { const x = new Date(d + 'T12:00:00+08:00'); x.setDate(x.getDate() + n); return x.toLocaleDateString('sv', { timeZone: TZ }); };
const pct = (a, b) => (b ? Math.round(a / b * 100) : 0);

initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) });
const db = getFirestore();

async function get(p)  { try { const s = await db.doc(p).get(); return s.exists ? s.data() : null; } catch { return null; } }
async function list(p) { try { const s = await db.collection(p).get(); return s.docs.map(d => ({ id: d.id, ...d.data() })); } catch { return []; } }

(async () => {
  if (!UID) throw new Error('USER_UID байхгүй');

  const [hsk5, profile, tasksRaw] = await Promise.all([
    get(`users/${UID}/hsk5/state`),
    get(`users/${UID}/bileg/profile`),
    list(`users/${UID}/tasks`),
  ]);

  // Сүүлийн 7 хоногийн дэглэм
  const days = [];
  for (let i = 6; i >= 0; i--) days.push(shift(DAY, -i));
  const [routines, logs] = await Promise.all([
    Promise.all(days.map(d => get(`users/${UID}/routines/${d}`))),
    Promise.all(days.map(d => get(`users/${UID}/logs/${d}`))),
  ]);

  const S   = hsk5 || {};
  const sc  = S.scores || {};
  const srs = S.srs || {};
  const L   = [];
  const w   = s => L.push(s);

  // ── Толгой ────────────────────────────────────────────────────
  w(`# JARVIS өдрийн тайлан — ${DAY}`);
  w('');
  w(`HSK5 шалгалт: **2026-12-13** · үлдсэн **${daysLeft()} хоног** · зорилт **${TARGET}/300** (босго ${PASS})`);
  w('');
  w('> Энэ файлыг автоматаар үүсгэсэн. Зөвхөн баримт — дүгнэлт байхгүй.');
  w('');

  // ── 1. Шалгалтын таамаг ───────────────────────────────────────
  w('## 1. Таамагласан оноо');
  w('');
  if (sc.diagDone) {
    const tot = Math.round((sc.listen || 0) + (sc.read || 0) + (sc.write || 0));
    w('| Хэсэг | Одоо | Зорилт | Зөрүү |');
    w('|---|---|---|---|');
    w(`| 听力 | ${Math.round(sc.listen ?? 0)}/100 | 80 | ${Math.round((sc.listen ?? 0) - 80)} |`);
    w(`| 阅读 | ${Math.round(sc.read ?? 0)}/100 | 80 | ${Math.round((sc.read ?? 0) - 80)} |`);
    w(`| 写作 | ${Math.round(sc.write ?? 0)}/100 | 80 | ${Math.round((sc.write ?? 0) - 80)} |`);
    w(`| **Нийт** | **${tot}/300** | ${TARGET} | **${tot - TARGET}** |`);
    w('');
    w(`Онош хийсэн: ${sc.diagAt || '?'} · тэр үеийн үгийн сан ${sc.vocabKnown ?? '?'}`);
    const need = TARGET - tot, d = daysLeft();
    w(`Зорилтод хүрэхэд өдөрт дунджаар **${d ? (need / d).toFixed(2) : need} оноо** нэмэх хэрэгтэй.`);
  } else {
    w('**Онош тест хийгээгүй** — бодит түвшин тодорхойгүй.');
  }
  w('');

  // ── 2. Үгийн сан ──────────────────────────────────────────────
  const boxes = [0, 0, 0, 0, 0, 0];
  let missTotal = 0;
  const weak = [];
  for (const [h, c] of Object.entries(srs)) {
    boxes[Math.min(5, c.box || 0)]++;
    if (c.miss) { missTotal += c.miss; weak.push([h, c.miss, c.lv]); }
  }
  weak.sort((a, b) => b[1] - a[1]);
  const seen = Object.keys(srs).length;
  const mastered = boxes[3] + boxes[4] + boxes[5];
  const levels = S.vocab_levels || [4, 5];
  const SIZE = { 1: 500, 2: 772, 3: 973, 4: 1000, 5: 1071 };
  const pool = levels.reduce((a, lv) => a + (SIZE[lv] || 0), 0);

  w('## 2. Үгийн сан');
  w('');
  w(`Судалж буй түвшин: HSK ${levels.join(', ')} — нийт **${pool}** үг`);
  w(`Үзсэн: **${seen}** (${pct(seen, pool)}%) · эзэмшсэн (3+ давталт): **${mastered}** (${pct(mastered, pool)}%)`);
  w('');
  w(`Давталтын хайрцгууд: шинэ/алдсан ${boxes[0]} · 1-р ${boxes[1]} · 2-р ${boxes[2]} · 3-р ${boxes[3]} · 4-р ${boxes[4]} · 5-р ${boxes[5]}`);
  const left = pool - seen, d2 = Math.max(1, daysLeft() - 5);
  w(`Үзээгүй үлдсэн: **${left}** → өдөрт **${Math.ceil(left / d2)}** шинэ үг (шалгалтаас 5 хоногийн өмнө дуусгахаар)`);
  w('');
  if (weak.length) {
    w(`Хамгийн их алддаг үгс (нийт ${missTotal} алдаа):`);
    w('');
    w('```');
    weak.slice(0, 25).forEach(([h, m, lv]) => w(`${h}  ${m} удаа  HSK${lv || '?'}`));
    w('```');
    w('');
  }

  // ── 3. Өнөөдрийн ажил ─────────────────────────────────────────
  const todayLog = S['log_' + DAY] || [];
  const pomo = (S['pomo_' + DAY] || {}).done || 0;
  const plan = S['plan_' + DAY] || [];
  const byKind = {};
  todayLog.forEach(x => {
    const k = byKind[x.k] = byKind[x.k] || { ok: 0, n: 0, c: 0 };
    k.ok += x.ok || 0; k.n += x.n || 0; k.c++;
  });

  w('## 3. Өнөөдөр хийсэн ажил');
  w('');
  w(`Pomodoro: **${pomo}/12** (${pomo * 25} минут) · төлөвлөгөөний блок: ${plan.length}/12`);
  w('');
  if (Object.keys(byKind).length) {
    w('| Төрөл | Хийсэн | Зөв | Хувь |');
    w('|---|---|---|---|');
    const NAME = { vocab: '词汇', listen: '听力', read: '阅读', dictation: '听写', write: '写作', diag: 'Онош' };
    Object.entries(byKind).forEach(([k, v]) =>
      w(`| ${NAME[k] || k} | ${v.n} | ${v.ok} | ${pct(v.ok, v.n)}% |`));
  } else {
    w('**Өнөөдөр юу ч хийгээгүй бүртгэгдсэн байна.**');
  }
  w('');

  // ── 4. 7 хоногийн чиг хандлага ────────────────────────────────
  w('## 4. Сүүлийн 7 хоног');
  w('');
  w('| Огноо | Pomodoro | Үг | 听力 | 阅读 | Дэглэм | Ус | Нойр |');
  w('|---|---|---|---|---|---|---|---|');
  days.forEach((dd, i) => {
    const lg = S['log_' + dd] || [];
    const p  = (S['pomo_' + dd] || {}).done || 0;
    const q  = k => lg.filter(x => x.k === k).reduce((a, x) => a + (x.n || 0), 0);
    const acc = k => { const a = lg.filter(x => x.k === k); const n = a.reduce((s, x) => s + (x.n || 0), 0); const o = a.reduce((s, x) => s + (x.ok || 0), 0); return n ? pct(o, n) + '%' : '—'; };
    const rt = routines[i] || {};
    const doneR = ['exercise', 'hanzi', 'read', 'journal'].filter(k => rt[k]).length;
    const lo = logs[i] || {};
    w(`| ${dd}${dd === DAY ? ' ←' : ''} | ${p} | ${q('vocab')} | ${acc('listen')} | ${acc('read')} | ${doneR}/4 | ${lo.water?.total_ml || 0}мл | ${lo.sleep?.hours ? lo.sleep.hours.toFixed(1) + 'ц' : '—'} |`);
  });
  w('');

  // ── 5. Mock шалгалтууд ────────────────────────────────────────
  const mocks = S.mock_hist || [];
  w('## 5. Mock шалгалтууд');
  w('');
  if (mocks.length) {
    w('| Огноо | 听力 | 阅读 | 写作 | Нийт |');
    w('|---|---|---|---|---|');
    mocks.slice(-10).forEach(m => w(`| ${m.date} | ${m.listen} | ${m.read} | ${m.write ?? '—'} | **${m.total}** |`));
  } else {
    w('**Mock хийгээгүй.** Долоо хоногт 1 удаа заавал хийх ёстой — бодит түвшний цорын ганц хэмжүүр.');
  }
  w('');

  // ── 6. Бичсэн эссэнүүд ────────────────────────────────────────
  const writes = (S.write_hist || []).filter(h => h.date === DAY);
  w('## 6. Өнөөдөр бичсэн зохион бичлэг');
  w('');
  if (writes.length) {
    writes.forEach((h, i) => {
      w(`### ${i + 1}. ${h.type === 'pic' ? '看图写作' : '话题作文'} — ${h.chars} ханз, оноо ${h.score ?? '—'}/50`);
      w('');
      w('```');
      w(h.text || '');
      w('```');
      w('');
    });
    w('> Эдгээрийг дүрэм, үгийн сонголт, бүтцийн талаас нь шалгаж, ЯГ юуг засахыг зааж өгөх хэрэгтэй.');
  } else {
    w('Өнөөдөр зохион бичлэг бичээгүй.');
  }
  w('');

  // ── 7. Дэглэм ─────────────────────────────────────────────────
  const rToday = routines[routines.length - 1] || {};
  const lToday = logs[logs.length - 1] || {};
  w('## 7. Өдрийн дэглэм');
  w('');
  w(`Дасгал ${rToday.exercise ? '✓' : '✗'} · 汉字 ${rToday.hanzi ? '✓' : '✗'} · Унших ${rToday.read ? '✓' : '✗'} · Journal ${rToday.journal ? '✓' : '✗'}`);
  w(`Ус ${lToday.water?.total_ml || 0}мл · Нойр ${lToday.sleep?.hours ? lToday.sleep.hours.toFixed(1) + ' цаг' : 'бүртгэгдээгүй'}`);
  const open = tasksRaw.filter(t => !t.done);
  if (open.length) {
    w('');
    w(`Дуусаагүй ажил (${open.length}):`);
    open.slice(0, 8).forEach(t => w(`- ${t.text}`));
  }
  if (profile?.goal) { w(''); w(`Зорилго: ${profile.goal}`); }
  w('');

  // ── 8. Юуг шийдэх вэ ──────────────────────────────────────────
  w('## 8. Шийдвэр гаргахад хэрэгтэй асуултууд');
  w('');
  w('- Аль чадвар зорилтоос хамгийн их хоцорч байна, өнөөдрийн ажил түүнд нийцэж байсан уу?');
  w('- Үгийн сангийн хурд шалгалтад амжих хэмнэлтэй байна уу?');
  w('- Давтагдаж буй алдаа юу вэ (ижил үг, ижил төрлийн асуулт, ижил дүрэм)?');
  w('- Маргааш юуг ӨӨРЧЛӨХ ёстой вэ — тодорхой, хэмжигдэхүйц нэг өөрчлөлт?');
  w('');

  const dir = path.join(__dirname, '..', 'reports');
  fs.mkdirSync(dir, { recursive: true });
  const out = path.join(dir, `${DAY}.md`);
  fs.writeFileSync(out, L.join('\n'));
  console.log(`Тайлан бичигдлээ: reports/${DAY}.md (${L.join('\n').length} тэмдэгт)`);
})().catch(e => { console.error('Алдаа:', e.message); process.exit(1); });
