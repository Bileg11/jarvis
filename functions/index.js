// ══════════════════════════════════════════════════════════════════
// T.H.R.E.E. OS — Firebase Cloud Functions
// Sprint 30: Proactive Telegram Notifications (Coach Mode)
//
// DEPLOY: firebase deploy --only functions   (Blaze plan шаардлагатай)
// ENV:    firebase functions:config:set telegram.bot_token="xxx" telegram.chat_id="xxx"
// ══════════════════════════════════════════════════════════════════

const { onSchedule }       = require('firebase-functions/v2/scheduler');
const { onDocumentWritten,
        onDocumentCreated } = require('firebase-functions/v2/firestore');
const { defineString }     = require('firebase-functions/params');
const admin                = require('firebase-admin');
const fetch                = require('node-fetch');

admin.initializeApp();
const db = admin.firestore();

// ── Config Params ─────────────────────────────────────────────────
// Set via: firebase functions:config:set telegram.bot_token="..." telegram.chat_id="..."
// Or use Firebase Secret Manager in production
const BOT_TOKEN = defineString('TELEGRAM_BOT_TOKEN', { default: '' });
const CHAT_ID   = defineString('TELEGRAM_CHAT_ID',   { default: '' });

// ── Telegram sender ───────────────────────────────────────────────
// chatIdOverride: specific chat_id (for per-user outbox)
// Falls back to global CHAT_ID env variable
async function sendTelegram(text, chatIdOverride) {
  const token = BOT_TOKEN.value();
  const chat  = chatIdOverride || CHAT_ID.value();
  if (!token || !chat) {
    console.warn('[Telegram] Bot token or chat_id not configured.');
    return false;
  }
  try {
    const res = await fetch(
      `https://api.telegram.org/bot${token}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chat, text, parse_mode: 'HTML' }),
      }
    );
    const json = await res.json();
    if (!json.ok) console.warn('[Telegram] API error:', json.description);
    return json.ok;
  } catch (err) {
    console.error('[Telegram] Fetch error:', err.message);
    return false;
  }
}

// ── Look up user's personal Telegram chat_id ──────────────────────
async function getUserChatId(uid) {
  try {
    const snap = await db.doc(`users/${uid}/integrations/telegram`).get();
    if (snap.exists) return snap.data()?.chat_id || null;
  } catch {}
  return null;
}

// ══════════════════════════════════════════════════════════════════
// SPRINT 34 — TELEGRAM OUTBOX PROCESSOR
// Function 4: Immediate send — triggered on new outbox document
// Handles: checkpoint alerts, streak danger, done confirms, scores
// ══════════════════════════════════════════════════════════════════
exports.processTelegramOutbox = onDocumentCreated(
  { document: 'users/{uid}/telegram_outbox/{msgId}', region: 'asia-east1' },
  async (event) => {
    const uid    = event.params.uid;
    const msgId  = event.params.msgId;
    const data   = event.data?.data();
    if (!data || data.sent) return;

    // If scheduled_for is in the future — skip (processScheduledOutbox handles it)
    if (data.scheduled_for) {
      const schedTime = new Date(data.scheduled_for);
      if (schedTime > new Date(Date.now() + 60000)) {
        console.log(`[Outbox] ${msgId} scheduled for ${data.scheduled_for} — skipping immediate`);
        return;
      }
    }

    // Get user's personal chat_id
    const chatId = await getUserChatId(uid);
    if (!chatId) {
      console.warn(`[Outbox] No chat_id for uid ${uid}`);
      return;
    }

    const ok = await sendTelegram(data.message, chatId);
    await event.data.ref.update({
      sent: true,
      sent_at: new Date().toISOString(),
      delivery_ok: ok,
    }).catch(() => {});

    console.log(`[Outbox] ${msgId} sent (${data.type}) → ok:${ok}`);
  }
);

// ══════════════════════════════════════════════════════════════════
// FUNCTION 5: Scheduled Outbox Processor (every 5 min)
// Handles future-scheduled checkpoints that couldn't be sent immediately
// ══════════════════════════════════════════════════════════════════
exports.processScheduledOutbox = onSchedule(
  { schedule: 'every 5 minutes', region: 'asia-east1' },
  async () => {
    console.log('[ScheduledOutbox] Checking scheduled messages...');
    const now = new Date();
    try {
      // Find all unsent messages whose scheduled_for is past
      const usersSnap = await db.collection('users').get();
      const tasks = usersSnap.docs.map(async (userDoc) => {
        const uid = userDoc.id;
        try {
          const chatId = await getUserChatId(uid);
          if (!chatId) return;

          const outboxSnap = await db.collection(`users/${uid}/telegram_outbox`)
            .where('sent', '==', false)
            .where('scheduled_for', '<=', now.toISOString())
            .limit(20)
            .get();

          for (const doc of outboxSnap.docs) {
            const data = doc.data();
            if (!data.scheduled_for) continue; // immediate messages handled by onCreate
            const ok = await sendTelegram(data.message, chatId);
            await doc.ref.update({ sent: true, sent_at: now.toISOString(), delivery_ok: ok }).catch(() => {});
            console.log(`[ScheduledOutbox] ${doc.id} sent → ok:${ok}`);
          }
        } catch (err) {
          console.error(`[ScheduledOutbox] uid ${uid}:`, err.message);
        }
      });
      await Promise.all(tasks);
    } catch (err) {
      console.error('[ScheduledOutbox] Fatal:', err.message);
    }
  }
);

// ══════════════════════════════════════════════════════════════════
// FUNCTION 6: Telegram Webhook — incoming messages → telegram_inbox
// Bot-ийн /done, /preflight, /score командуудыг хүлээн авна
// DEPLOY: Webhook URL-г Telegram-д бүртгэнэ
// https://api.telegram.org/bot{TOKEN}/setWebhook?url={FUNCTION_URL}
// ══════════════════════════════════════════════════════════════════
const { onRequest } = require('firebase-functions/v2/https');

exports.telegramWebhook = onRequest(
  { region: 'asia-east1', cors: false },
  async (req, res) => {
    if (req.method !== 'POST') { res.status(405).send('Method Not Allowed'); return; }

    const body = req.body;
    const msg  = body?.message;
    if (!msg) { res.status(200).send('ok'); return; }

    const chatId = String(msg.chat?.id || '');
    const text   = (msg.text || '').trim();
    const msgId  = msg.message_id;

    // Look up uid from telegram_lookup
    try {
      const lookupSnap = await db.doc(`telegram_lookup/${chatId}`).get();
      if (!lookupSnap.exists) {
        // Unknown user — maybe registering
        if (text === '/start') {
          await sendTelegram(
            '🤖 T.H.R.E.E. OS Bot\n\nТаны chat_id: <code>' + chatId + '</code>\nАпп дотроос Profile → Telegram холболтоор оруулна уу.',
            chatId
          );
        }
        res.status(200).send('ok');
        return;
      }

      const uid = lookupSnap.data().uid;
      // Write to telegram_inbox — processed by JS listener in index.html
      await db.doc(`users/${uid}/telegram_inbox/${msgId}`).set({
        chat_id:    chatId,
        text,
        timestamp:  new Date().toISOString(),
        processed:  false,
        msg_id:     msgId,
      });

      // Immediate echo for /done
      if (text.toLowerCase().startsWith('/done ')) {
        const task = text.replace(/^\/done\s+/i, '').trim();
        await sendTelegram(`⏳ <code>/done ${task}</code> хүлээн авлаа — апп дотор баталгаажуулж байна...`, chatId);
      }
    } catch (err) {
      console.error('[Webhook]', err.message);
    }
    res.status(200).send('ok');
  }
);

// ── Routine builder helper ────────────────────────────────────────
function buildMorningMsg(uid, routine, coachLevel) {
  const done  = [];
  const miss  = [];
  const items = { exercise:'🏋 Дасгал', hanzi:'📖 汉字', read:'📚 Унших', journal:'📓 Journal' };
  Object.entries(items).forEach(([k, label]) => {
    if (routine[k]) done.push(label + ' ✓');
    else miss.push(label + ' ✗');
  });

  const score = Math.round(
    (routine.exercise ? 20 : 0) +
    (routine.hanzi    ? 20 : 0) +
    (routine.read     ? 15 : 0) +
    (routine.journal  ? 10 : 0) +
    Math.min(25, Math.round((routine.water || 0) / 8 * 25))
  );

  const greetings = {
    1: `🌿 Өглөөний мэнд! Өнөөдрийн score: <b>${score}/100</b>`,
    2: `⚡ T.H.R.E.E. OS — Daily Briefing\n📊 Score: <b>${score}/100</b>`,
    3: `🔥 MISSION BRIEFING — Score: <b>${score}/100</b>\nАмархан байхгүй, Boss.`,
    4: `💀 GOGGINS MODE — Score: <b>${score}/100</b>\nЧи хангалттай хийгээгүй. Яараарай.`,
  };
  const lvl  = Math.min(4, Math.max(1, coachLevel || 2));
  let msg    = greetings[lvl] + '\n\n';

  if (done.length)  msg += '✅ Дууссан:\n' + done.join('\n') + '\n\n';
  if (miss.length)  msg += '⏳ Үлдсэн:\n' + miss.join('\n') + '\n\n';

  const HSK_DATE = new Date('2026-06-28T09:00:00+08:00');
  const days = Math.max(0, Math.floor((HSK_DATE - new Date()) / 86400000));
  msg += `📅 HSK 4 шалгалт: <b>${days} хоног</b> үлдсэн\n`;
  msg += '\n<i>— A.C.E. Core · T.H.R.E.E. OS</i>';
  return msg;
}

// ══════════════════════════════════════════════════════════════════
// FUNCTION 1: Morning Briefing (08:00 Shanghai time, UTC+8 = 00:00 UTC)
// Cron: "0 0 * * *" = every day at 00:00 UTC = 08:00 Shanghai
// ══════════════════════════════════════════════════════════════════
exports.morningBriefing = onSchedule(
  { schedule: '0 0 * * *', timeZone: 'Asia/Shanghai', region: 'asia-east1' },
  async () => {
    console.log('[morningBriefing] Running daily briefing...');
    try {
      // Get all active users
      const usersSnap = await db.collection('users').get();
      const tasks = usersSnap.docs.map(async (userDoc) => {
        const uid = userDoc.id;
        try {
          const today   = new Date().toISOString().split('T')[0];
          const rSnap   = await db.doc(`users/${uid}/routines/${today}`).get();
          const wsSnap  = await db.doc(`users/${uid}/config/workspace`).get();

          const routine    = rSnap.exists    ? rSnap.data()  : {};
          const workspace  = wsSnap.exists   ? wsSnap.data() : {};
          const coachLevel = workspace.coach_level || 2;

          // Skip if coach level 1 (Gentle = no push notifications)
          if (coachLevel === 1) return;

          const msg    = buildMorningMsg(uid, routine, coachLevel);
          // Sprint 34: per-user chat_id, global CHAT_ID is fallback
          const chatId = await getUserChatId(uid);
          await sendTelegram(msg, chatId || undefined);
        } catch (err) {
          console.error(`[morningBriefing] Error for uid ${uid}:`, err.message);
        }
      });
      await Promise.all(tasks);
      console.log('[morningBriefing] Done.');
    } catch (err) {
      console.error('[morningBriefing] Fatal:', err.message);
    }
  }
);

// ══════════════════════════════════════════════════════════════════
// FUNCTION 2: Evening Check (21:00 Shanghai time = 13:00 UTC)
// Strict + Goggins mode only — workout + HSK reminder
// ══════════════════════════════════════════════════════════════════
exports.eveningCheck = onSchedule(
  { schedule: '0 13 * * *', timeZone: 'Asia/Shanghai', region: 'asia-east1' },
  async () => {
    console.log('[eveningCheck] Running evening check...');
    try {
      const usersSnap = await db.collection('users').get();
      const tasks = usersSnap.docs.map(async (userDoc) => {
        const uid = userDoc.id;
        try {
          const today  = new Date().toISOString().split('T')[0];
          const rSnap  = await db.doc(`users/${uid}/routines/${today}`).get();
          const wsSnap = await db.doc(`users/${uid}/config/workspace`).get();

          const routine    = rSnap.exists  ? rSnap.data()  : {};
          const workspace  = wsSnap.exists ? wsSnap.data() : {};
          const coachLevel = workspace.coach_level || 2;

          // Only Coach Level 3 (Strict) and 4 (Goggins) get evening push
          if (coachLevel < 3) return;

          const missed = [];
          if (!routine.exercise) missed.push('дасгал');
          if (!routine.hanzi)    missed.push('汉字 drill');

          if (!missed.length) return; // All done, no need to ping

          const HSK_DATE = new Date('2026-06-28T09:00:00+08:00');
          const days = Math.max(0, Math.floor((HSK_DATE - new Date()) / 86400000));

          const msg = coachLevel === 4
            ? `💀 21:00 — Goggins Alert!\n\n` +
              `Дутуу хийгдсэн: <b>${missed.join(', ')}</b>\n\n` +
              `HSK 4 шалгалт <b>${days} хоног</b> л үлдсэн. Унтахын өмнө хий.\n` +
              `"Чи сул тал болох уу, эсвэл тэмцэж гарах уу?"\n` +
              `\n<i>— A.C.E. Core · Full Goggins Mode</i>`
            : `🔥 Оройн дүгнэлт\n\n` +
              `Дутуу: <b>${missed.join(', ')}</b>\n` +
              `HSK 4: <b>${days}</b> хоног үлдсэн. Нойрноосоо өмнө нэг drill хий.\n` +
              `\n<i>— A.C.E. Core · Strict Mode</i>`;

          // Sprint 34: per-user chat_id
          const chatId = await getUserChatId(uid);
          await sendTelegram(msg, chatId || undefined);
        } catch (err) {
          console.error(`[eveningCheck] Error for uid ${uid}:`, err.message);
        }
      });
      await Promise.all(tasks);
      console.log('[eveningCheck] Done.');
    } catch (err) {
      console.error('[eveningCheck] Fatal:', err.message);
    }
  }
);

// ══════════════════════════════════════════════════════════════════
// FUNCTION 3: Milestone Notification (Firestore trigger)
// missions/{uid}/data/missions document дээр val өөрчлөгдөхөд
// ══════════════════════════════════════════════════════════════════
exports.missionMilestone = onDocumentWritten(
  { document: 'users/{uid}/missions/data', region: 'asia-east1' },
  async (event) => {
    const uid  = event.params.uid;
    const after  = event.data?.after?.data();
    const before = event.data?.before?.data();
    if (!after || !before) return;

    // Check each mission for milestone crossing (50%, 100%)
    const milestones = [50, 75, 100];
    const missions   = after.missions  || [];
    const prevMiss   = before.missions || [];

    // Sprint 34: look up per-user chat_id once before the loop
    const chatId = await getUserChatId(uid).catch(() => null);

    for (const m of missions) {
      const prev = prevMiss.find(x => x.id === m.id);
      if (!prev) continue;
      const nowPct  = Math.round(m.val / m.max * 100);
      const prevPct = Math.round(prev.val / prev.max * 100);

      for (const ms of milestones) {
        if (prevPct < ms && nowPct >= ms) {
          // Milestone hit!
          let emoji = ms === 100 ? '🏆' : ms === 75 ? '🔥' : '⚡';
          const msg = `${emoji} <b>${m.label}</b> — ${ms}% хүрлээ!\n` +
            `${m.val} / ${m.max} ${m.unit}\n\n` +
            `<i>— T.H.R.E.E. OS Mission Tracker</i>`;
          await sendTelegram(msg, chatId || undefined).catch(console.error);
        }
      }
    }
  }
);
