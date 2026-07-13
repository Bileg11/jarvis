'use strict';
// ── JARVIS PULSE — Railway-ийн cron-уудын GH Actions орлуулалт ────
// Railway унтарсан тул server.js-ийн node-cron ажлуудыг энэ скрипт
// GitHub Actions хуваарийн дагуу гүйцэтгэнэ (.github/workflows/jarvis-pulse.yml).
//
// Горим:
//   tick  (default) — Execution Engine + outbox + checkpoints (5 мин тутам)
//   hsk             — HSK өдрийн сануулга (15:00 Шанхай)
//   recap           — өдрийн тайлан (22:01 Шанхай)
//
// ENV: FIREBASE_SERVICE_ACCOUNT, TELEGRAM_BOT_TOKEN_JARVIS, TELEGRAM_ID, USER_UID

const mode = process.argv[2] || 'tick';

async function run(name, fn) {
  try { await fn(); console.log(`[Pulse] ${name} ✓`); }
  catch (e) { console.error(`[Pulse] ${name} ✗`, e.message); process.exitCode = 1; }
}

(async () => {
  const engine = require('./api/execution-engine');
  const tg     = require('./api/telegram');

  if (mode === 'tick') {
    await run('engine',      () => engine.tickEngine());
    await run('outbox',      () => tg.processOutbox());
    await run('checkpoints', () => tg.sendCheckpoints());
  } else if (mode === 'hsk') {
    await run('hskReminder', () => tg.sendHSKReminder());
  } else if (mode === 'recap') {
    await run('dailyRecap',  () => tg.sendDailyRecap());
  } else {
    console.error('[Pulse] Буруу горим:', mode, '— tick | hsk | recap');
    process.exit(1);
  }
  // firebase-admin холболт нээлттэй үлдэж hang хийхээс сэргийлнэ
  setTimeout(() => process.exit(process.exitCode || 0), 2000);
})();
