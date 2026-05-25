'use strict';
// ── JARVIS WEBHOOK SERVER — Railway Express ───────────────────────
// Persistent server, timeout байхгүй
// Routes:
//   POST /api/telegram     — Telegram bot webhook
//   GET  /api/meta-webhook — Meta webhook verification
//   POST /api/meta-webhook — IG DM + FB Messenger chatbot

const express   = require('express');
const cron      = require('node-cron');
const tgHandler = require('./api/telegram');
const metaHook  = require('./api/meta-webhook');

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.get('/', (req, res) => res.send('JARVIS webhook running ✅'));

// Telegram
app.post('/api/telegram', tgHandler);

// Meta (IG DM + FB Messenger)
app.get ('/api/meta-webhook', metaHook.verify);
app.post('/api/meta-webhook', metaHook.handle);

app.listen(PORT, () => console.log(`[JARVIS] Server running on port ${PORT}`));

// ── DAILY EXECUTIVE REPORT — өдөр бүр 22:00 (UTC+8 = 14:00 UTC) ──
// Railway UTC цаг дээр ажилладаг тул 14:00 UTC = Шанхайн 22:00
cron.schedule('0 14 * * *', () => {
  console.log('[JARVIS] Sending daily report...');
  metaHook.sendDailyReport();
});
