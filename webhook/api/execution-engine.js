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

// editMessageText — нэг мессежийг шинэчилнэ (Flood ban-аас сэргийлнэ)
async function editTg(chatId, msgId, text, extra = {}) {
  if (!TG_TOKEN || !chatId || !msgId) return null;
  try {
    const r = await fetch(`https://api.telegram.org/bot${TG_TOKEN}/editMessageText`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, message_id: msgId, text, parse_mode: 'Markdown', ...extra }),
    });
    return await r.json();
  } catch (e) { return null; }
}

// Pushover Critical Alert (priority 2 — DND нэвт гарна, баталгаажтал давтана)
const PUSHOVER_APP = process.env.PUSHOVER_APP_TOKEN;
async function sendPushover(userToken, title, message) {
  if (!PUSHOVER_APP || !userToken) return false;
  try {
    const r = await fetch('https://api.pushover.net/1/messages.json', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: PUSHOVER_APP, user: userToken,
        title, message,
        priority: 2,        // Emergency — DND нэвт
        retry: 60,          // 60 сек тутам давтана
        expire: 600,        // 10 мин хүртэл
        sound: 'siren',
      }),
    });
    const j = await r.json();
    return j.status === 1;
  } catch (e) { console.error('[Pushover]', e.message); return false; }
}

// Хамтрагчийн uid (sprint_users-аас нөгөө хүн)
async function getPartnerUid(uid) {
  try {
    const snap = await dbPersonal.collection('sprint_users').get();
    const other = snap.docs.find(d => d.id !== uid);
    return other ? other.id : null;
  } catch { return null; }
}
async function getUserPushToken(uid) {
  try {
    const s = await dbPersonal.doc(`sprint_users/${uid}`).get();
    return s.exists ? (s.data().pushover_token || null) : null;
  } catch { return null; }
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

  // Multi-sig downgrade timeout (шөнө 30+ мин хариугүй → auto-escape)
  if (cfg.pending_downgrade) { try { await checkDowngradeTimeout(); } catch {} }

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

    // ELAPSED → penalty + ESCALATION (time × intensity-cap)
    if (w.status === 'ELAPSED') {
      const cap = (cfg.intensity_cap || {})[w.user_id] || 1;
      // Level 1 (Gentle / Calibration) = penalty байхгүй
      const lostPts = cap >= 2 ? await applyPenalty(w.user_id, 1) : false;
      w.penalty_accrued = (w.penalty_accrued || 0) + (lostPts ? 1 : 0);
      dirty = true;

      const elapsedMin = Math.floor((nowMs - end.getTime()) / 60000);
      const chatId = await getUserChatId(w.user_id);

      // ── ESCALATION PROFILE (time-driven, capped by intensity) ────
      // 0-5 мин:  countdown (editMessageText, 30s тутам) — бүх level
      // 5-15 мин: + partner alert (cap≥2, Toxic Coach)
      // 15+ мин:  + Pushover Critical Alert (cap≥3, Scorched Earth)

      const countdownText =
        `🔴 *${w.label}* — ЦОНХ ХААГДСАН\n` +
        `⏱ ${elapsedMin} мин хэтэрлээ` + (cap >= 2 ? ` · -${w.penalty_accrued} XP` : ' (calibration)') + `\n\n` +
        (cap >= 3 && elapsedMin >= 15 ? '💀 SCORCHED EARTH идэвхтэй\n' :
         cap >= 2 && elapsedMin >= 5  ? '⚡ Toxic Coch горим\n' : '') +
        `Одоо ч болсон хий: \`/done ${w.task_id}\``;

      // Countdown — 30s тутам нэг мессеж edit (flood-safe)
      if (!w.msg_id) {
        const res = await sendTg(chatId, countdownText);
        if (res?.result?.message_id) { w.msg_id = res.result.message_id; }
      } else {
        await editTg(chatId, w.msg_id, countdownText);
      }

      // Level 2 (cap≥2): 5-15 мин — partner alert (нэг удаа)
      if (cap >= 2 && elapsedMin >= 5 && !w.partner_alerted) {
        w.partner_alerted = true;
        const partnerUid = await getPartnerUid(w.user_id);
        const partnerChat = partnerUid ? await getUserChatId(partnerUid) : null;
        const uname = (await dbPersonal.doc(`sprint_users/${w.user_id}`).get()).data()?.name || 'Хамтрагч';
        if (partnerChat) await sendTg(partnerChat,
          `👀 *${uname}* "${w.label}" цонхоо алдаж байна (${elapsedMin} мин).\n` +
          `Түлхэц өг — \`/poke\` эсвэл шууд бич!`);
      }

      // Level 3 (cap≥3): 15+ мин — Pushover Critical Alert (нэг удаа)
      if (cap >= 3 && elapsedMin >= 15 && !w.pushover_sent) {
        w.pushover_sent = true;
        const token = await getUserPushToken(w.user_id);
        const ok = await sendPushover(token,
          '💀 SCORCHED EARTH',
          `${w.label} — ${elapsedMin} мин хэтэрлээ! Босоод хий. ${w.penalty_accrued} XP алдсан.`);
        if (!ok && chatId) await sendTg(chatId,
          `📞 *CRITICAL ALERT* (Pushover тохируулаагүй)\n${w.label} — ОДОО ХИЙ! 💀`);
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

  // Multipliers
  let mult = w.multiplier || 1;

  // Hygiene multiplier 1.5x — dependency гинж (Gym→Shower г.м)
  const DEP = { shower: 'gym', makeup: 'shower' };
  if (DEP[taskId]) {
    const dep = windows.find(x => x.task_id === DEP[taskId] && x.user_id === uid && x.status === 'COMPLETED');
    if (dep) mult *= 1.5;
  }

  // Comeback 2x — өдөр торгууль идсэн (penalty ≤ -20) атлаа сэргэвэл
  const us0 = await dbPersonal.doc(`sprint_users/${uid}`).get();
  const dailyPen = us0.exists ? (us0.data().daily_penalty || 0) : 0;
  let comeback = false;
  if (dailyPen <= -20) { mult *= 2; comeback = true; }

  const award = Math.round((w.xp || 20) * mult);

  w.status = 'COMPLETED';
  w.completed_at = new Date().toISOString();

  // Countdown мессежийг "дууссан" болгож edit (spam зогсоно)
  if (w.msg_id) {
    const chatId = await getUserChatId(uid);
    await editTg(chatId, w.msg_id, `✅ *${w.label}* — ДУУСЛАА! +${award} XP 🔥`);
  }
  await ref.set({ windows }, { merge: true });

  // XP нэмэх
  const cur = us0.exists ? (us0.data().sprint_xp || 0) : 0;
  await dbPersonal.doc(`sprint_users/${uid}`).set({ sprint_xp: cur + award }, { merge: true });

  // ── Co-op pool шалгах: хоёулаа өдрийн threshold давсан бол celebrate
  await _checkCoopProgress(dateK);

  // ── Hype-man: partner-д ялалт мэдэгдэх (өндөр award эсвэл comeback)
  if (comeback || mult >= 1.5) {
    const partnerUid = await getPartnerUid(uid);
    const partnerChat = partnerUid ? await getUserChatId(partnerUid) : null;
    const uname = us0.data()?.name || 'Хамтрагч';
    if (partnerChat) await sendTg(partnerChat,
      comeback
        ? `🔥 *${uname}* COMEBACK хийлээ! Унасан газраасаа боссон — ${award} XP (2x). Бахарх!`
        : `⚡ *${uname}* hygiene гинж барьж ${award} XP (1.5x) авлаа. Beast!`);
  }

  return { ok: true, award, label: w.label, mult, comeback };
}

// Co-op pool — хоёулаа өдрийн ≥3 цонх дуусгавал pool "нээгдсэн" гэж тэмдэглэх
async function _checkCoopProgress(dateK) {
  try {
    const snap = await dbPersonal.doc(`schedules/${dateK}`).get();
    if (!snap.exists) return;
    const windows = snap.data().windows || [];
    const byUser = {};
    windows.forEach(w => {
      byUser[w.user_id] = byUser[w.user_id] || { total: 0, done: 0 };
      byUser[w.user_id].total++;
      if (w.status === 'COMPLETED') byUser[w.user_id].done++;
    });
    const uids = Object.keys(byUser);
    if (uids.length < 2) return;
    // Хоёулаа 100% дуусгасан бол
    const allDone = uids.every(u => byUser[u].done === byUser[u].total && byUser[u].total > 0);
    if (allDone && !snap.data().coop_celebrated) {
      await dbPersonal.doc(`schedules/${dateK}`).set({ coop_celebrated: true }, { merge: true });
      for (const u of uids) {
        const chat = await getUserChatId(u);
        if (chat) await sendTg(chat,
          `🎉 *CO-OP ЯЛАЛТ!* Та хоёр өнөөдрийн БҮХ цонхоо дуусгалаа!\n` +
          `Дундын сан өслөө. 6.30-д Монголд хамт тэмдэглэнэ! 🇲🇳🔥`);
      }
    }
  } catch (e) { console.error('[Coop]', e.message); }
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

// ── MULTI-SIG DOWNGRADE TREATY ────────────────────────────────────
// Upgrade unilateral. Downgrade нь partner-ийн зөвшөөрөл шаардана.
// requestDowngrade → pending хадгална, partner-д товч илгээнэ
async function requestDowngrade(uid, level) {
  const partnerUid = await getPartnerUid(uid);
  if (!partnerUid) {
    // Хамтрагчгүй бол шууд зөвшөөрнө
    await setIntensityCap(uid, level);
    return { ok: true, soloApplied: true, level };
  }
  await dbPersonal.doc('sprint/config').set({
    pending_downgrade: {
      requester: uid, target_level: level,
      partner: partnerUid, requested_at: new Date().toISOString(),
    },
  }, { merge: true });
  return { ok: true, partnerUid, level };
}

// resolveDowngrade — partner approve/deny
async function resolveDowngrade(approverUid, approve) {
  const ref = dbPersonal.doc('sprint/config');
  const c   = await ref.get();
  const pd  = c.exists ? c.data().pending_downgrade : null;
  if (!pd || pd.partner !== approverUid) return { ok: false, error: 'no pending request' };

  await ref.set({ pending_downgrade: null }, { merge: true });
  if (approve) {
    await setIntensityCap(pd.requester, pd.target_level);
    return { ok: true, approved: true, requester: pd.requester, level: pd.target_level };
  } else {
    // Denied → intensify (Level 3 руу буцаана, social shame)
    await setIntensityCap(pd.requester, 3);
    return { ok: true, approved: false, requester: pd.requester };
  }
}

// Auto-escape: pending downgrade 30+ мин хариугүй + шөнө бол автоматаар зөвшөөрнө
async function checkDowngradeTimeout() {
  const ref = dbPersonal.doc('sprint/config');
  const c   = await ref.get();
  const pd  = c.exists ? c.data().pending_downgrade : null;
  if (!pd) return;
  const ageMin = (Date.now() - new Date(pd.requested_at).getTime()) / 60000;
  const isNight = isNightBoundary(shanghaiNow());
  // Зөвхөн шөнө 30+ мин хариугүй бол auto-escape (өдөр multi-sig хүчинтэй)
  if (ageMin >= 30 && isNight) {
    await ref.set({ pending_downgrade: null }, { merge: true });
    await setIntensityCap(pd.requester, pd.target_level);
    const chat = await getUserChatId(pd.requester);
    if (chat) await sendTg(chat, `🌙 Хамтрагч унтаж байна — шөнийн auto-escape: Level ${pd.target_level} болголоо. Амраарай.`);
  }
}

module.exports = {
  tickEngine, completeWindow, sendTg, getUserChatId, todayKey,
  setupSprint, addWindow, quickstartDay, getSprintStatus,
  pauseSprint, resumeSprint, setIntensityCap,
  requestDowngrade, resolveDowngrade, checkDowngradeTimeout, getPartnerUid,
};
