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

// ── AI: Gemini primary → GitHub fallback ─────────────────────────
const GEMINI_URL   = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';
const GEMINI_KEY   = process.env.GEMINI_API_KEY;
const GITHUB_URL   = 'https://models.inference.ai.azure.com/chat/completions';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

const SYSTEM = `Чи бол JARVIS — Билэгийн хувийн AI туслах. Билэг: 18 настай Монгол залуу, Шанхайд амьдардаг. Зорилго: тогтмол фитнесс, LFS Shanghai бизнес, HSK4 шалгалт. Монголоор 2-3 өгүүлбэр. Тодорхой тоо. Шулуун, урам зориг өгөхүйц. Нэг конкрет үйлдэл санал болго.`;

async function callAI(prompt) {
  // Gemini primary
  if (GEMINI_KEY) {
    try {
      console.log('[Jarvis] Gemini 2.0 Flash руу хүсэлт...');
      const res = await fetch(`${GEMINI_URL}?key=${GEMINI_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: SYSTEM }] },
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: 250, temperature: 0.85 }
        })
      });
      if (res.ok) {
        const d = await res.json();
        const text = d.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
        if (text) { console.log('[Jarvis] Gemini OK'); return text; }
      } else {
        console.warn(`[Jarvis] Gemini ${res.status} — GitHub fallback`);
      }
    } catch (e) { console.warn('[Jarvis] Gemini error:', e.message); }
  }

  // GitHub Models fallback
  if (!GITHUB_TOKEN) { console.warn('[Jarvis] AI байхгүй'); return null; }
  console.log('[Jarvis] GitHub Models fallback...');
  try {
    const res = await fetch(GITHUB_URL, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${GITHUB_TOKEN}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'system', content: SYSTEM }, { role: 'user', content: prompt }],
        max_tokens: 200, temperature: 0.85
      })
    });

    if (res.status === 429) {
      console.warn('[Jarvis] GitHub rate limit');
      return null;
    }
    if (!res.ok) {
      const err = await res.text();
      console.warn(`[Jarvis] GitHub → ${res.status}: ${err.slice(0,120)}`);
      return null;
    }

    const json = await res.json();
    const text = json.choices?.[0]?.message?.content?.trim();
    if (text) {
      console.log('[Jarvis] gpt-4o-mini ✓');
      return text;
    }
  } catch (e) {
    console.warn('[Jarvis] fetch алдаа:', e.message);
  }
  return null;
}

// ── FALLBACK MESSAGE ──────────────────────────────────────────────
function buildFallbackMessage(score, done, water, routine, exStreak, hzStreak) {
  const items = [];
  if (!routine.exercise) items.push('дасгал хий');
  if (!routine.hanzi)    items.push('汉字 давта');
  if (!routine.read)     items.push('ном унши');
  if (!routine.journal)  items.push('journal бич');
  if (water < 2000)      items.push(`ус ${2000-water}ml уу`);

  const next = items[0] || 'бүгдийг гүйцэтгэлээ 🎉';
  return `Score ${score}/100 | ${done}/4 routine. Дасгал ${exStreak}🔥 | 汉字 ${hzStreak}🔥. Дараагийн алхам: ${next}.`;
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

  const [routineSnap, logSnap, missSnap, commentLogSnap] = await Promise.all([
    db.doc(`users/${uid}/routines/${today}`).get(),
    db.doc(`users/${uid}/logs/${today}`).get(),
    db.doc(`users/${uid}/meta/missions`).get(),
    db.doc(`users/${uid}/marketing/commentLog`).get(),
  ]);

  const routine  = routineSnap.exists ? routineSnap.data()           : {};
  const log      = logSnap.exists     ? logSnap.data()               : {};
  const missions = missSnap.exists    ? (missSnap.data().list || []) : [];

  // Өдрийн comment лог (зөвхөн орой харуулна)
  const todayComments = commentLogSnap.exists ? (commentLogSnap.data()?.[today] || []) : [];

  const water   = log.water?.total_ml || 0;
  const sleep   = log.sleep?.hours    || null;
  const done    = ['exercise','hanzi','read','journal'].filter(k => routine[k]).length;
  const score   = Math.min(100,
    Math.round((water/2000*25) + (routine.exercise?20:0) +
               (routine.hanzi?20:0)  + (routine.read?15:0) + (routine.journal?10:0)));

  const lfs     = missions.find(m => m.id === 'lfs')     || { val:0, max:100 };
  const hanziM  = missions.find(m => m.id === 'hanziw')  || { val:0, max:300 };
  const fitness = missions.find(m => m.id === 'fitness') || { val:0, max:30  };

  const [exStreak, hzStreak] = await Promise.all([
    getStreak(uid, 'exercise'),
    getStreak(uid, 'hanzi'),
  ]);

  // Орой дээр comment brief нэмнэ
  const commentSection = (timeLabel === 'Орой' && todayComments.length > 0)
    ? `\nIG Comment: ${todayComments.length} comment хариулав\n${todayComments.slice(0,3).map(c=>`  • @${c.username}: "${c.text.slice(0,50)}"`).join('\n')}`
    : '';

  const prompt =
`[${timeLabel} ${hour}:00 | ${DAYS[now.getDay()]}]
Score: ${score}/100 | Routine: ${done}/4
Ус: ${water}ml/2000ml (${Math.round(water/20)}%) | Нойр: ${sleep ? sleep.toFixed(1)+'ц' : 'бүртгэгдээгүй'}
Дасгал: ${routine.exercise?'✓':'✗'} (${exStreak}хоног🔥) | 汉字: ${routine.hanzi?'✓':'✗'} (${hzStreak}хоног🔥)
Унших: ${routine.read?'✓':'✗'} | Journal: ${routine.journal?'✓':'✗'}
LFS: ${lfs.val}/${lfs.max} хэрэглэгч | HSK4: ${hanziM.val}/300 үг | Workout: ${fitness.val}/30${commentSection}`;

  const aiMsg   = await callAI(prompt);
  const message = aiMsg || buildFallbackMessage(score, done, water, routine, exStreak, hzStreak);

  if (!aiMsg) console.log('[Jarvis] AI хариу өгсөнгүй — fallback ашигласан');
  console.log(`[Jarvis] Message: ${message}`);

  await db.doc(`users/${uid}/briefings/latest`).set({
    message,
    hour,
    date:      today,
    score,
    ai:        !!aiMsg,
    timestamp: new Date().toISOString()
  });
  console.log('[Jarvis] Firestore ✓');

  // ── TELEGRAM ─────────────────────────────────────────────────
  const token  = process.env.TELEGRAM_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (token && chatId && token !== 'PASTE_HERE') {
    const icons = { 'Өглөө':'🌅', 'Өдөр':'☀️', 'Орой':'🌙' };
    const label = aiMsg ? '' : ' _(fallback)_';
    const text  = `${icons[timeLabel]} <b>JARVIS</b> · ${timeLabel}${label}\n\n${message}\n\n<i>Score: ${score}/100</i>`;
    const res   = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' })
    });
    const data = await res.json();
    if (data.ok) console.log('[Jarvis] Telegram ✓');
    else         console.error('[Jarvis] Telegram алдаа:', data.description);
  }
}

main().catch(err => {
  console.error('[Jarvis] Алдаа:', err.message);
  process.exit(1);
});
