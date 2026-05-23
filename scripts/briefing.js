const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore }        = require('firebase-admin/firestore');
const fetch = (...a) => import('node-fetch').then(({ default: f }) => f(...a));

// ── TIMEZONE: Shanghai (UTC+8) ────────────────────────────────────
const now   = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Shanghai' }));
const hour  = now.getHours();
const today = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
const DAYS  = ['Ням','Даваа','Мягмар','Лхагва','Пүрэв','Баасан','Бямба'];
const timeLabel = hour < 12 ? 'Өглөө' : hour < 18 ? 'Өдөр' : 'Орой';

// ── FIREBASE ADMIN ────────────────────────────────────────────────
const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
initializeApp({ credential: cert(sa) });
const db = getFirestore();

// ── GEMINI ────────────────────────────────────────────────────────
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_KEY}`;

const SYSTEM = `Чи бол JARVIS — Билэгийн хувийн AI туслах. Билэг: 18 настай Монгол залуу, Шанхайд амьдардаг. Зорилго: LFS Shanghai платформ, 汉字 HSK2, фитнесс. Монголоор 2-3 өгүүлбэр. Тодорхой тоо. Шулуун, урам зориг өгөхүйц. Нэг конкрет үйлдэл санал болго.`;

async function callGemini(prompt) {
  const res = await fetch(GEMINI_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: `${SYSTEM}\n\n${prompt}` }] }],
      generationConfig: { maxOutputTokens: 160, temperature: 0.85 }
    })
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini ${res.status}: ${err}`);
  }
  const json = await res.json();
  return json.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
}

// ── STREAK HELPER ─────────────────────────────────────────────────
async function getStreak(uid, key) {
  let streak = 0;
  for (let i = 0; i < 14; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const ds = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    const snap = await db.doc(`users/${uid}/routines/${ds}`).get();
    if (!snap.exists) break;
    const done = key === 'water' ? (snap.data().water || 0) >= 8 : !!snap.data()[key];
    if (done) streak++;
    else break;
  }
  return streak;
}

// ── MAIN ──────────────────────────────────────────────────────────
async function main() {
  const uid = process.env.USER_UID;
  if (!uid) throw new Error('USER_UID secret байхгүй байна');

  console.log(`[Jarvis] ${today} ${hour}:00 (${timeLabel}) — briefing эхлэв`);

  // Firestore-оос өгөгдөл уншина
  const [routineSnap, logSnap, missSnap] = await Promise.all([
    db.doc(`users/${uid}/routines/${today}`).get(),
    db.doc(`users/${uid}/logs/${today}`).get(),
    db.doc(`users/${uid}/meta/missions`).get(),
  ]);

  const routine  = routineSnap.exists ? routineSnap.data()            : {};
  const log      = logSnap.exists     ? logSnap.data()                : {};
  const missions = missSnap.exists    ? (missSnap.data().list || [])  : [];

  const water   = log.water?.total_ml || 0;
  const sleep   = log.sleep?.hours    || null;
  const done    = ['exercise','hanzi','read','journal'].filter(k => routine[k]).length;
  const score   = Math.min(100,
    Math.round((water/2000*25) + (routine.exercise?20:0) +
               (routine.hanzi?20:0)  + (routine.read?15:0) + (routine.journal?10:0)));

  const lfs     = missions.find(m => m.id === 'lfs')     || { val:0, max:100 };
  const hanziM  = missions.find(m => m.id === 'hanziw')  || { val:0, max:300 };
  const fitness = missions.find(m => m.id === 'fitness') || { val:0, max:30  };

  // Streak (зэрэгцээ уншина)
  const [exStreak, hzStreak] = await Promise.all([
    getStreak(uid, 'exercise'),
    getStreak(uid, 'hanzi'),
  ]);

  // Gemini prompt
  const prompt =
`[${timeLabel} ${hour}:00 | ${DAYS[now.getDay()]}]
Score: ${score}/100 | Routine: ${done}/4
Ус: ${water}ml/2000ml (${Math.round(water/20)}%) | Нойр: ${sleep ? sleep.toFixed(1)+'ц' : 'бүртгэгдээгүй'}
Дасгал: ${routine.exercise?'✓':'✗'} (${exStreak}хоног🔥) | 汉字: ${routine.hanzi?'✓':'✗'} (${hzStreak}хоног🔥)
Унших: ${routine.read?'✓':'✗'} | Journal: ${routine.journal?'✓':'✗'}
LFS: ${lfs.val}/${lfs.max} хэрэглэгч | HSK2: ${hanziM.val}/300 үг | Workout: ${fitness.val}/30`;

  const result  = await callGemini(prompt);
  const message = result;

  console.log(`[Jarvis] AI message: ${message}`);

  // Firestore-д бичнэ — PWA уншина
  await db.doc(`users/${uid}/briefings/latest`).set({
    message,
    hour,
    date:      today,
    score,
    timestamp: new Date().toISOString()
  });
  console.log('[Jarvis] Firestore-д бичигдлээ ✓');

  // ── TELEGRAM ────────────────────────────────────────────────────
  const token  = process.env.TELEGRAM_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (token && chatId && token !== 'PASTE_HERE') {
    const icons = { 'Өглөө':'🌅', 'Өдөр':'☀️', 'Орой':'🌙' };
    const text  = `${icons[timeLabel]} <b>JARVIS</b> · ${timeLabel}\n\n${message}\n\n<i>Score: ${score}/100</i>`;
    const res   = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' })
    });
    const data = await res.json();
    if (data.ok) console.log('[Jarvis] Telegram илгээгдлээ ✓');
    else         console.error('[Jarvis] Telegram алдаа:', data.description);
  }
}

main().catch(err => {
  console.error('[Jarvis] Алдаа:', err.message);
  process.exit(1);
});
