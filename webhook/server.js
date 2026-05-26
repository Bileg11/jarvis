'use strict';
// ── JARVIS WEBHOOK SERVER — Railway Express ───────────────────────
// Persistent server, timeout байхгүй
// Routes:
//   POST /api/telegram     — Telegram bot webhook
//   GET  /api/meta-webhook — Meta webhook verification
//   POST /api/meta-webhook — IG DM + FB Messenger chatbot

const express   = require('express');
const cron      = require('node-cron');
const tgHandler   = require('./api/telegram');
const { sendWeeklyReport, sendBrief } = tgHandler;
const metaHook    = require('./api/meta-webhook');
const alerts      = require('./api/alerts');
const bookingHook = require('./api/booking');

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.get('/', (req, res) => res.send('JARVIS webhook running ✅'));

// Telegram
app.post('/api/telegram', tgHandler);

// Meta (IG DM + FB Messenger)
app.get ('/api/meta-webhook', metaHook.verify);
app.post('/api/meta-webhook', metaHook.handle);

// LFS Booking form
app.post('/api/booking', bookingHook);

app.listen(PORT, () => console.log(`[JARVIS] Server running on port ${PORT}`));

// ── MORNING BRIEF — өдөр бүр 07:30 (UTC+8 = 23:30 UTC өмнөх өдөр) ─
// Railway UTC: 23:30 = Шанхайн 07:30
cron.schedule('30 23 * * *', () => {
  console.log('[JARVIS] Sending morning brief...');
  metaHook.sendMorningBrief();
});

// ── DAILY EXECUTIVE REPORT — өдөр бүр 22:00 (UTC+8 = 14:00 UTC) ──
cron.schedule('0 14 * * *', () => {
  console.log('[JARVIS] Sending daily report...');
  metaHook.sendDailyReport();
});

// ── WEEKLY REPORT — Даваа гарагийн 07:30 (UTC+8 = Ням 23:30 UTC) ─
cron.schedule('30 23 * * 0', () => {
  console.log('[J.A.R.V.I.S] Sending weekly report...');
  sendWeeklyReport().catch(e => console.error('[Weekly] Error:', e.message));
});

// ── PROACTIVE ALERTS ──────────────────────────────────────────────
// 12:00 Шанхай (04:00 UTC) — LFS идэвхгүй байдал шалгана
cron.schedule('0 4 * * *', () => {
  console.log('[JARVIS] Checking LFS activity...');
  alerts.checkLFSActivity();
});

// 20:00 Шанхай (12:00 UTC) — Routine хийгдсэн эсэх шалгана
cron.schedule('0 12 * * *', () => {
  console.log('[JARVIS] Checking evening routine...');
  alerts.checkEveningRoutine();
});

// 10:00 Шанхай (02:00 UTC) — Instagram post давтамж шалгана
cron.schedule('0 2 * * *', () => {
  console.log('[JARVIS] Checking post frequency...');
  alerts.checkPostFrequency();
});
