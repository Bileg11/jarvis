'use strict';
// ══════════════════════════════════════════════════════════════════
// T.H.R.E.E. OS — RUTHLESS EXECUTION ENGINE (Phase 1: Spine)
// 24-day sprint → 2026-06-30. Users: Bileg & Marlaa.
//
// PRINCIPLE: Бүх төлөв Firestore-д. Санах ойн counter БАЙХГҮЙ.
// Railway redeploy хийгдэхэд timestamp-аас дахин тооцоолж сэргэнэ.
//
// FIRESTORE SCHEMA:
//   sprint/config
//     { paused, paused_until, day_boundary_hour: 6.75,
//       night_start: 23, night_end: 6.75,
//       intensity_cap: { <uid>: 1|2|3 } }   // calibration үед бүгд 1
//   sprint_users/{uid}
//     { sprint_xp, daily_penalty, daily_reset_date, pushover_token, name }
//   schedules/{YYYY-MM-DD}
//     { is_calibrated, coop_pool_xp,
//       windows: [ {
//         id, task_id, label, user_id,
//         start (ISO), end (ISO),
//         status: PENDING|ACTIVE|COMPLETED|INTERCEPTED|ELAPSED,
//         proof_type: HARD_METRIC|SOCIAL_PROOF,
//         xp: 20, multiplier: 1,
//         escalation_level: 1, last_spam, msg_id,
//         completed_at, penalty_accrued
//       } ] }
// ══════════════════════════════════════════════════════════════════

const { dbPersonal } = require('../firebase');
const fetch = require('node-fetch');

const TG_TOKEN = process.env.TELEGRAM_BOT_TOKEN_JARVIS;

// ── Config ────────────────────────────────────────────────────────
const TZ            = 'Asia/Shanghai';
const NIGHT_START   = 23;       // 23:00 — Deep Sleep эхэлнэ
const NIGHT_END     = 6.75;     // 06:45 — өдрийн хил / daily reset
const PENALTY_FLOOR = -40;      // өдрийн дээд торгууль

// ── Helpers ───────────────────────────────────────────────────────
function shanghaiNow() {
  return new Date(new Date().toLocaleString('en-US', { timeZone: TZ }));
}
function shanghaiHourFloat(d) {
  return d.getHours() + d.getMinutes() / 60;
}
function todayKey() {
  return shanghaiNow().toLocaleDateString('sv', { timeZone: TZ }); // YYYY-MM-DD
}
function isNightBoundary(d) {
  const h = shanghaiHourFloat(d);
  return h >= NIGHT_START || h < NIGHT_END;
}

async function getUserChatId(uid) {
  try {
    const s = await dbPersonal.doc(`users/${uid}/integrations/telegram`).get();
    return s.exists ? (s.data()?.chat_id || null) : null;
  } catch { return null; }
}

async function sendTg(chatId, text, extra = {}) {
  if (!TG_TOKEN || !chatId) return null;
  try {
    const r = await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown', ...extra }),
    });
    return await r.json();
  } catch (e) { console.error('[Engine TG]', e.message); return null; }
}

// ── Daily reset (06:45 хил давах үед нэг удаа) ────────────────────
async function maybeDailyReset(uid) {
  const ref  = dbPersonal.doc(`sprint_users/${uid}`);
  const snap = await ref.get();
  const data = snap.exists ? snap.data() : {};
  const today = todayKey();
  if (data.daily_reset_date !== today) {
    await ref.set({
      daily_penalty: 0,
      daily_reset_date: today,
    }, { merge: true });
    return true;
  }
  return false;
}

// ── XP / penalty mutation (floor-aware) ───────────────────────────
async function applyPenalty(uid, points) {
  const ref  = dbPersonal.doc(`sprint_users/${uid}`);
  const snap = await ref.get();
  const d    = snap.exists ? snap.data() : { sprint_xp: 0, daily_penalty: 0 };
  // Daily floor: өдөрт -40-аас илүү хасахгүй
  if ((d.daily_penalty || 0) <= PENALTY_FLOOR) return false;
  const newDaily = Math.max(PENALTY_FLOOR, (d.daily_penalty || 0) - points);
  const realLoss = (d.daily_penalty || 0) - newDaily;
  await ref.set({
    sprint_xp:     (d.sprint_xp || 0) - realLoss,
    daily_penalty: newDaily,
  }, { merge: true });
  return realLoss > 0;
}

// ── Main tick — server.js setInterval(30s)-аас дуудагдана ─────────
async function tickEngine() {
  const now = shanghaiNow();

  // 1. Config + pause шалгах
  let cfg = {};
  try {
    const c = await dbPersonal.doc('sprint/config').get();
    cfg = c.exists ? c.data() : {};
  } catch { return; }

  // Sprint-level PAUSE (Kill Switch) — бүх дарамт зогсоно
  if (cfg.paused) {
    if (cfg.paused_until && new Date(cfg.paused_until) < new Date()) {
      // pause хугацаа дууссан → автоматаар сэргээнэ
      await dbPersonal.doc('sprint/config').set({ paused: false, paused_until: null }, { merge: true });
    } else {
      return; // паузтай — юу ч хийхгүй
    }
  }

  // 2. Шөнийн хил — Deep Sleep (penalty/escalation зогсоно)
  if (isNightBoundary(now)) {
    // Гэхдээ daily reset-ийг 06:45 хүрэхэд хийх тул энд зөвхөн гарна
    return;
  }

  // 3. Өдрийн хуваарь
  const dateK = todayKey();
  let sched = {};
  try {
    const s = await dbPersonal.doc(`schedules/${dateK}`).get();
    if (!s.exists) return;       // өнөөдөр хуваарь алга → торгуульгүй
    sched = s.data();
  } catch { return; }
  if (!sched.is_calibrated || !Array.isArray(sched.windows)) return;

  // 4. Window бүрийг боловсруулах
  let dirty = false;
  const resetDone = new Set();

  for (const w of sched.windows) {
    if (w.status === 'COMPLETED' || w.status === 'INTERCEPTED') continue;

    // Daily reset (хэрэглэгч бүрт нэг удаа)
    if (!resetDone.has(w.user_id)) {
      await maybeDailyReset(w.user_id);
      resetDone.add(w.user_id);
    }

    const start = new Date(w.start);
    const end   = new Date(w.end);
    const nowMs = Date.now();

    // PENDING → ACTIVE (цонх нээгдэв)
    if (w.status === 'PENDING' && nowMs >= start.getTime()) {
      w.status = 'ACTIVE';
      w.escalation_level = 1;
      dirty = true;
      const chatId = await getUserChatId(w.user_id);
      await sendTg(chatId,
        `🟢 *Цонх нээгдлээ:* ${w.label}\n` +
        `⏰ ${start.toTimeString().slice(0,5)} – ${end.toTimeString().slice(0,5)}\n` +
        `Гүйцэтгээд баталгаажуул: \`/done ${w.task_id}\``);
    }

    // ACTIVE → ELAPSED (цонх хаагдсан, дуусгаагүй) → penalty эхэлнэ
    if ((w.status === 'ACTIVE' || w.status === 'PENDING') && nowMs > end.getTime()) {
      if (w.status !== 'ELAPSED') { w.status = 'ELAPSED'; dirty = true; }
    }

    // ELAPSED → penalty -1/мин (end-ээс хойш), floor-той
    if (w.status === 'ELAPSED') {
      const lostPts = await applyPenalty(w.user_id, 1);
      w.penalty_accrued = (w.penalty_accrued || 0) + (lostPts ? 1 : 0);
      dirty = true;
      // Phase 2: escalation spam (editMessageText countdown, partner alert, Pushover)
      // Одоохондоо 5 минут тутамд нэг сануулга
      const elapsedMin = Math.floor((nowMs - end.getTime()) / 60000);
      const lastSpam   = w.last_spam ? new Date(w.last_spam).getTime() : 0;
      if (nowMs - lastSpam >= 5 * 60000) {
        w.last_spam = new Date().toISOString();
        const chatId = await getUserChatId(w.user_id);
        await sendTg(chatId,
          `🔴 *${w.label}* — цонх хаагдсан, ${elapsedMin} мин хэтэрлээ!\n` +
          `Торгууль: -${w.penalty_accrued} XP (өдрийн floor -40)\n` +
          `Одоо ч болсон хий: \`/done ${w.task_id}\``);
      }
    }
  }

  // 5. Өөрчлөлт хадгалах
  if (dirty) {
    try { await dbPersonal.doc(`schedules/${dateK}`).set({ windows: sched.windows }, { merge: true }); }
    catch (e) { console.error('[Engine] save windows:', e.message); }
  }
}

// ── Window completion (Telegram /done эсвэл app-аас дуудна) ────────
async function completeWindow(uid, taskId, dateK) {
  dateK = dateK || todayKey();
  const ref  = dbPersonal.doc(`schedules/${dateK}`);
  const snap = await ref.get();
  if (!snap.exists) return { ok: false, error: 'no schedule' };
  const windows = snap.data().windows || [];
  const w = windows.find(x => x.task_id === taskId && x.user_id === uid &&
                              x.status !== 'COMPLETED');
  if (!w) return { ok: false, error: 'window not found' };

  // Sequential hygiene multiplier (1.5x) — өмнөх dependency COMPLETED бол
  let mult = w.multiplier || 1;
  // (Phase 4: dependency chain шалгах) — одоохондоо тогтсон multiplier
  const award = Math.round((w.xp || 20) * mult);

  w.status = 'COMPLETED';
  w.completed_at = new Date().toISOString();
  await ref.set({ windows }, { merge: true });

  // XP нэмэх
  const uref = dbPersonal.doc(`sprint_users/${uid}`);
  const us   = await uref.get();
  const cur  = us.exists ? (us.data().sprint_xp || 0) : 0;
  await uref.set({ sprint_xp: cur + award }, { merge: true });

  return { ok: true, award, label: w.label };
}

// ══════════════════════════════════════════════════════════════════
// SETUP & MANAGEMENT (Telegram командуудаас дуудагдана)
// ══════════════════════════════════════════════════════════════════

// Sprint config анх үүсгэх (calibration горимоор эхэлнэ)
async function setupSprint(uid, name) {
  const cfgRef = dbPersonal.doc('sprint/config');
  const cfg    = await cfgRef.get();
  const data   = cfg.exists ? cfg.data() : {};
  const caps   = data.intensity_cap || {};
  caps[uid]    = caps[uid] || 1;  // calibration → cap = Level 1
  await cfgRef.set({
    paused: false, paused_until: null,
    day_boundary_hour: NIGHT_END,
    night_start: NIGHT_START, night_end: NIGHT_END,
    intensity_cap: caps,
    end_date: '2026-06-30',
  }, { merge: true });

  await dbPersonal.doc(`sprint_users/${uid}`).set({
    name: name || uid,
    sprint_xp: 0, daily_penalty: 0,
    daily_reset_date: todayKey(),
  }, { merge: true });
  return { ok: true };
}

// Window нэмэх. start/end "HH:MM" (Shanghai). Өнөөдрийн schedule-д.
async function addWindow(uid, { time, taskId, label, proofType, xp }, dateK) {
  dateK = dateK || todayKey();
  const m = String(time).match(/^(\d{1,2}):(\d{2})-(\d{1,2}):(\d{2})$/);
  if (!m) return { ok: false, error: 'time format: HH:MM-HH:MM' };
  const [, h1, m1, h2, m2] = m;
  const pad = n => String(n).padStart(2, '0');
  const start = `${dateK}T${pad(h1)}:${m1}:00+08:00`;
  const end   = `${dateK}T${pad(h2)}:${m2}:00+08:00`;

  const ref  = dbPersonal.doc(`schedules/${dateK}`);
  const snap = await ref.get();
  const data = snap.exists ? snap.data() : {};
  const windows = data.windows || [];
  windows.push({
    id: taskId + '_' + Date.now(),
    task_id: taskId,
    label: label || taskId,
    user_id: uid,
    start, end,
    status: 'PENDING',
    proof_type: proofType || 'SOCIAL_PROOF',
    xp: xp || 20,
    multiplier: 1,
    escalation_level: 1,
    penalty_accrued: 0,
  });
  await ref.set({
    is_calibrated: true,
    coop_pool_xp: data.coop_pool_xp || 500,
    windows,
  }, { merge: true });
  return { ok: true, count: windows.filter(w => w.user_id === uid).length };
}

// Өдрийн стандарт template (HSK + Gym + Business) — хурдан эхлэх
async function quickstartDay(uid, dateK) {
  dateK = dateK || todayKey();
  const tmpl = [
    { time: '09:00-10:30', taskId: 'hsk',      label: '📚 HSK Drill блок',    proofType: 'HARD_METRIC',  xp: 20 },
    { time: '15:00-16:30', taskId: 'business', label: '💼 Business / LFS OBT', proofType: 'SOCIAL_PROOF', xp: 20 },
    { time: '18:00-19:30', taskId: 'gym',      label: '💪 Gym / Дасгал',      proofType: 'SOCIAL_PROOF', xp: 20 },
  ];
  for (const t of tmpl) await addWindow(uid, t, dateK);
  return { ok: true, count: tmpl.length };
}

// Sprint status (өнөөдрийн window + XP + penalty)
async function getSprintStatus(uid, dateK) {
  dateK = dateK || todayKey();
  const [uSnap, sSnap, cSnap] = await Promise.all([
    dbPersonal.doc(`sprint_users/${uid}`).get(),
    dbPersonal.doc(`schedules/${dateK}`).get(),
    dbPersonal.doc('sprint/config').get(),
  ]);
  const u   = uSnap.exists ? uSnap.data() : {};
  const cfg = cSnap.exists ? cSnap.data() : {};
  const windows = (sSnap.exists ? (sSnap.data().windows || []) : [])
    .filter(w => w.user_id === uid);
  return {
    xp: u.sprint_xp || 0,
    daily_penalty: u.daily_penalty || 0,
    intensity_cap: (cfg.intensity_cap || {})[uid] || 1,
    paused: !!cfg.paused,
    coop_pool: sSnap.exists ? (sSnap.data().coop_pool_xp || 0) : 0,
    windows,
  };
}

// Sprint-level PAUSE (Kill Switch)
async function pauseSprint(hours) {
  const until = new Date(Date.now() + (hours || 24) * 3600000).toISOString();
  await dbPersonal.doc('sprint/config').set({ paused: true, paused_until: until }, { merge: true });
  return { ok: true, until };
}
async function resumeSprint() {
  await dbPersonal.doc('sprint/config').set({ paused: false, paused_until: null }, { merge: true });
  return { ok: true };
}

// Intensity cap өөрчлөх (Level 1/2/3). Calibration дуусгахад 3 болгоно.
async function setIntensityCap(uid, level) {
  const ref = dbPersonal.doc('sprint/config');
  const c   = await ref.get();
  const caps = (c.exists ? c.data().intensity_cap : {}) || {};
  caps[uid] = Math.max(1, Math.min(3, level));
  await ref.set({ intensity_cap: caps }, { merge: true });
  return { ok: true, level: caps[uid] };
}

module.exports = {
  tickEngine, completeWindow, sendTg, getUserChatId, todayKey,
  setupSprint, addWindow, quickstartDay, getSprintStatus,
  pauseSprint, resumeSprint, setIntensityCap,
};
