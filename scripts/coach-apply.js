/**
 * ЗӨВЛӨГӨӨГ АПП РУУ БУЦААХ.
 *
 * Claude нь reports/YYYY-MM-DD-coach.md файл бичнэ. Энэ скрипт түүнийг
 * уншиж Firestore-д тавьснаар JARVIS болон HSK5 хуудсанд харагдана,
 * мөн Telegram-аар илгээнэ.
 *
 * Файлын бүтэц (Claude дагах ёстой):
 *   ## ТОВЧ            — 1-2 өгүүлбэр, өнөөдөр юу болсон
 *   ## МАРГААШ         — хийх ёстой зүйлс (жагсаалт)
 *   ## АНХААРУУЛГА     — байвал: эрсдэл, хоцорч буй зүйл
 *   ## ТӨЛӨВЛӨГӨӨ      — байвал: блокийн жин, жишээ "listen+2 vocab-1"
 *
 * Ажиллуулах: node scripts/coach-apply.js [YYYY-MM-DD]
 */
'use strict';

const fs   = require('fs');
const path = require('path');
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

const TZ  = 'Asia/Ulaanbaatar';
const UID = process.env.USER_UID;
const DAY = process.argv[2] || new Date().toLocaleDateString('sv', { timeZone: TZ });
const FILE = path.join(__dirname, '..', 'reports', `${DAY}-coach.md`);

const TG_TOKEN = process.env.TELEGRAM_BOT_TOKEN_JARVIS;
const TG_CHAT  = process.env.TELEGRAM_ID;

/** Markdown-ийг «## ГАРЧИГ» хэсгүүдээр нь задална */
function sections(md) {
  const out = {};
  let cur = null, buf = [];
  for (const line of md.split('\n')) {
    const m = line.match(/^#{2,3}\s*(.+?)\s*$/);
    if (m) { if (cur) out[cur] = buf.join('\n').trim(); cur = m[1].toUpperCase(); buf = []; }
    else if (cur) buf.push(line);
  }
  if (cur) out[cur] = buf.join('\n').trim();
  return out;
}

const pickSection = (s, ...names) => {
  for (const n of names) {
    const hit = Object.keys(s).find(k => k.includes(n));
    if (hit && s[hit]) return s[hit];
  }
  return '';
};

/** Telegram-ийн Markdown-д тэнцвэргүй тэмдэгт мессежийг бүхэлд нь унагаадаг */
const mdSafe = t => String(t || '').replace(/[*_`[\]]/g, '');

(async () => {
  if (!UID) throw new Error('USER_UID байхгүй');
  if (!fs.existsSync(FILE)) { console.log(`${path.basename(FILE)} алга — алгаслаа.`); return; }

  const md = fs.readFileSync(FILE, 'utf8').trim();
  if (md.length < 40) { console.log('Файл хэт богино — алгаслаа.'); return; }

  const s = sections(md);
  const payload = {
    date:      DAY,
    summary:   pickSection(s, 'ТОВЧ', 'SUMMARY'),
    tomorrow:  pickSection(s, 'МАРГААШ', 'TOMORROW'),
    warning:   pickSection(s, 'АНХААРУУЛГА', 'WARNING'),
    planHint:  pickSection(s, 'ТӨЛӨВЛӨГӨӨ', 'PLAN'),
    full:      md,
    by:        'claude',
    createdAt: new Date().toISOString(),
  };

  initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) });
  const db = getFirestore();
  await Promise.all([
    db.doc(`users/${UID}/coach/latest`).set(payload),
    db.doc(`users/${UID}/coach/${DAY}`).set(payload),
  ]);
  console.log('Firestore ✓');

  if (TG_TOKEN && TG_CHAT) {
    let text = `🧠 *Өдрийн дүгнэлт* · ${DAY}\n`;
    if (payload.summary)  text += `\n${mdSafe(payload.summary)}\n`;
    if (payload.warning)  text += `\n⚠️ ${mdSafe(payload.warning)}\n`;
    if (payload.tomorrow) text += `\n*Маргааш:*\n${mdSafe(payload.tomorrow)}\n`;
    text = text.slice(0, 3800);
    const r = await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: TG_CHAT, text, parse_mode: 'Markdown' }),
    });
    const d = await r.json();
    console.log(d.ok ? 'Telegram ✓' : 'Telegram алдаа: ' + d.description);
  } else {
    console.log('Telegram тохируулаагүй — алгаслаа.');
  }
})().catch(e => { console.error('Алдаа:', e.message); process.exit(1); });
