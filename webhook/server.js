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
const alerts      = require('./api/alerts');
const { sendWeeklyReport, sendBrief, sendHSKReminder,
        sendCheckpoints, sendDailyRecap, processOutbox } = tgHandler;

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.get('/', (req, res) => res.send('JARVIS webhook running ✅'));

// ── CHAT PROXY — Electron desktop app-аас дуудагдана ────────────────
// gemini.js: fetch(`${proxy}/chat`, ...) → GitHub Models relay
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';
app.post('/chat', async (req, res) => {
  // GAP-09: Secret header auth
  const CHAT_SECRET = process.env.CHAT_SECRET;
  if (CHAT_SECRET && req.headers['x-jarvis-secret'] !== CHAT_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const GH_TOKEN = process.env.SYSTEM_USE_TOKEN || process.env.META_BOT_TOKEN;
  if (!GH_TOKEN) return res.status(500).json({ error: 'SYSTEM_USE_TOKEN тохируулаагүй' });

  res.setHeader('Access-Control-Allow-Origin', CORS_ORIGIN);
  try {
    const upstream = await fetch('https://models.inference.ai.azure.com/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${GH_TOKEN}` },
      body: JSON.stringify(req.body),
    });
    const data = await upstream.json();
    res.status(upstream.status).json(data);
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});

app.options('/chat', (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', CORS_ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.sendStatus(204);
});

// ── SPRINT 35: WORLD NEWS PROXY — Focus Chat дэлхийн мэдээ ─────────
// Хятадаас BBC блоклогддог тул Railway (US) дамжуулж татна.
// Electron: fetch(`${proxy}/world`) → categorized headlines + FX
const WORLD_FEEDS = {
  politics:      'https://feeds.bbci.co.uk/news/world/us_and_canada/rss.xml',
  world:         'https://feeds.bbci.co.uk/news/world/rss.xml',
  business:      'https://feeds.bbci.co.uk/news/business/rss.xml',
  ai:            'https://feeds.bbci.co.uk/news/technology/rss.xml',
  entertainment: 'https://feeds.bbci.co.uk/news/entertainment_and_arts/rss.xml',
};

function _parseRSS(xml, limit = 4) {
  const items = [];
  const rx = /<item[^>]*>([\s\S]*?)<\/item>/g;
  let m;
  while ((m = rx.exec(xml)) !== null && items.length < limit) {
    const tm = m[1].match(/<title[^>]*>([\s\S]*?)<\/title>/);
    let title = tm ? tm[1] : '';
    title = title.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/, '$1').replace(/<[^>]+>/g, '').trim();
    if (title) items.push({ title });
  }
  return items;
}

let _worldCache = { ts: 0, data: null };
app.get('/world', async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', CORS_ORIGIN);
  // 15-минутын cache (RSS их дуудахаас сэргийлэх)
  if (_worldCache.data && Date.now() - _worldCache.ts < 15 * 60 * 1000) {
    return res.json(_worldCache.data);
  }
  try {
    const categories = {};
    await Promise.all(Object.entries(WORLD_FEEDS).map(async ([cat, url]) => {
      try {
        const r   = await fetch(url, { headers: { 'User-Agent': 'THREE-OS/35' } });
        const xml = await r.text();
        categories[cat] = _parseRSS(xml, 4);
      } catch { categories[cat] = []; }
    }));
    const total = Object.values(categories).reduce((n, a) => n + a.length, 0);
    const data = { ok: total > 0, categories, ts: Date.now() };
    _worldCache = { ts: Date.now(), data };
    res.json(data);
  } catch (e) {
    res.status(502).json({ ok: false, error: e.message });
  }
});

app.options('/world', (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', CORS_ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.sendStatus(204);
});

// Telegram — хувийн JARVIS
app.post('/api/telegram', tgHandler);


app.listen(PORT, () => console.log(`[JARVIS] Server running on port ${PORT}`));


// ── WEEKLY REPORT — Даваа гарагийн 07:30 (UTC+8 = Ням 23:30 UTC) ─
cron.schedule('30 23 * * 0', () => {
  console.log('[J.A.R.V.I.S] Sending weekly report...');
  sendWeeklyReport().catch(e => console.error('[Weekly] Error:', e.message));
});


// ── HSK 3 DAILY REMINDER — 15:00 Шанхай (07:00 UTC) ─────────────
cron.schedule('0 7 * * *', () => {
  console.log('[JARVIS] Sending HSK daily reminder...');
  if (typeof sendHSKReminder === 'function') {
    sendHSKReminder().catch(e => console.error('[HSK Reminder] Error:', e.message));
  }
});

// ── GAP-12: OUTBOX PROCESSOR — 2 минут бүр ───────────────────────
cron.schedule('*/2 * * * *', () => {
  if (typeof processOutbox === 'function') {
    processOutbox().catch(e => console.error('[Outbox] Cron error:', e.message));
  }
});

// ── SPRINT 34: CHECKPOINT ENGINE — 5 минут бүр ───────────────────
// T-30, T-15, End-20, End+5 alerts — хуваарийн task бүрт
cron.schedule('*/5 * * * *', () => {
  if (typeof sendCheckpoints === 'function') {
    sendCheckpoints().catch(e => console.error('[Checkpoint] Error:', e.message));
  }
});

// ── SPRINT 34: DAILY RECAP — 22:00 Шанхай (14:00 UTC) ────────────
// Өдрийн тайлан + маргаашийн pre-flight prompt
cron.schedule('0 14 1 * * *', () => {
  // Note: morningBriefing already uses '0 14 * * *' → conflict болохгүйн тулд
  // UTC 14:01 дээр явуулна (Шанхай 22:01)
}).destroy(); // placeholder — below uses correct time

cron.schedule('1 14 * * *', () => {
  console.log('[JARVIS] Sending daily recap (22:00 Shanghai)...');
  if (typeof sendDailyRecap === 'function') {
    sendDailyRecap().catch(e => console.error('[DailyRecap] Error:', e.message));
  }
});

// ── PROACTIVE ALERTS ──────────────────────────────────────────────
// 20:00 Шанхай (12:00 UTC) — Routine хийгдсэн эсэх шалгана
cron.schedule('0 12 * * *', () => {
  console.log('[JARVIS] Checking evening routine...');
  alerts.checkEveningRoutine();
});
