'use strict';
// ── JARVIS PROACTIVE ALERTS ───────────────────────────────────────
// Хувийн routine сануулга — Билэгийн өдрийн routine шалгана

const fetch  = require('node-fetch');
const { dbPersonal } = require('../firebase');
const TG_TOKEN = process.env.TELEGRAM_BOT_TOKEN_JARVIS;
const TG_CHAT  = process.env.TELEGRAM_ID;
const UID      = process.env.USER_UID;

async function tg(text) {
  try {
    await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: TG_CHAT, text }),
    });
  } catch {}
}

function todaySH() {
  return new Date().toLocaleDateString('sv', { timeZone: 'Asia/Shanghai' });
}

// ── Оройн routine сануулга (20:00) ────────────────────────────────
// Хийгдээгүй routine-уудыг жагсааж сануулна
async function checkEveningRoutine() {
  try {
    const snap  = await dbPersonal.doc(`users/${UID}/routines/${todaySH()}`).get();
    const rt    = snap.exists ? snap.data() : {};

    const items = [
      { key: 'exercise', label: 'Дасгал 💪'  },
      { key: 'hanzi',    label: '汉字 🈶'      },
      { key: 'read',     label: 'Уншилт 📚'  },
      { key: 'journal',  label: 'Journal 📝' },
    ];

    const missed = items.filter(r => !rt[r.key]);
    if (missed.length === 0) return;

    const list = missed.map(r => '• ' + r.label).join('\n');
    await tg(
      `⏰ J.A.R.V.I.S: 20:00 боллоо. Өнөөдөр хийгдээгүй зүйлс:\n\n${list}\n\n` +
      `Унтахаасаа өмнө нэгийг нь хийж амж.`
    );
  } catch (e) {
    console.error('[Alert] Evening routine check error:', e.message);
  }
}

module.exports = { checkEveningRoutine };
