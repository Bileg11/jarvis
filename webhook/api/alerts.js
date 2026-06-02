'use strict';
// ── JARVIS PROACTIVE ALERTS ───────────────────────────────────────
// Цаг тутамд шалгаж, Билэгт автоматаар мэдэгдэл явуулна

const fetch  = require('node-fetch');
const { dbPersonal, dbLFS } = require('../firebase');
const TG_TOKEN_LFS      = process.env.TELEGRAM_BOT_TOKEN_LFS;
const TG_TOKEN_PERSONAL = process.env.TELEGRAM_BOT_TOKEN_JARVIS;
const TG_CHAT  = process.env.TELEGRAM_ID;
const UID      = process.env.USER_UID;

// LFS alert → LFS bot, Personal alert → JARVIS bot
async function tg(text, token = TG_TOKEN_LFS) {
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: TG_CHAT, text }),
    });
  } catch {}
}

function todaySH() {
  return new Date().toLocaleDateString('sv', { timeZone: 'Asia/Shanghai' });
}

// ── 1. LFS идэвхгүй байдлын alert (өдрийн 12:00) ─────────────────
// Хэрэв 12 цаг болтол хэн ч LFS-д хандаагүй бол → сануулга
async function checkLFSActivity() {
  try {
    const snap = await dbLFS.doc(`users/${UID}/analytics/${todaySH()}`).get();
    const users = snap.exists ? (snap.data().users || []) : [];
    if (users.length === 0) {
      await tg(
        '⚠️ J.A.R.V.I.S: Өнөөдөр 12:00 болтол LFS-д хэн ч хандаагүй байна.\n\n' +
        'Story, post, эсвэл story reply хийж идэвхжүүлэх үү?'
      );
    }
  } catch (e) {
    console.error('[Alert] LFS activity check error:', e.message);
  }
}

// ── 2. Оройн routine сануулга (20:00) ────────────────────────────
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
    if (missed.length === 0) return; // Бүгд хийсэн — alert хэрэггүй

    const list = missed.map(r => '• ' + r.label).join('\n');
    await tg(
      `⏰ J.A.R.V.I.S: 20:00 боллоо. Өнөөдөр хийгдээгүй зүйлс:\n\n${list}\n\n` +
      `Унтахаасаа өмнө нэгийг нь хийж амж.`,
      TG_TOKEN_PERSONAL
    );
  } catch (e) {
    console.error('[Alert] Evening routine check error:', e.message);
  }
}

// ── 3. Instagram post давтамжийн alert (10:00) ────────────────────
// Хэрэв 2+ хоног post хийгдээгүй бол → сануулга
async function checkPostFrequency() {
  try {
    const snap = await dbLFS.doc(`users/${UID}/marketing/lastPost`).get();
    if (!snap.exists) return;

    const lastPostAt = snap.data().postedAt;
    if (!lastPostAt) return;

    const diffDays = (Date.now() - new Date(lastPostAt).getTime()) / (1000 * 60 * 60 * 24);
    if (diffDays >= 2) {
      const days = Math.floor(diffDays);
      await tg(
        `📸 J.A.R.V.I.S: ${days} хоног Instagram-д post хийгдээгүй байна.\n\n` +
        `LFS-ийн engagement буурч байж магадгүй. Өнөөдөр нэг post хийх үү?`
      );
    }
  } catch (e) {
    console.error('[Alert] Post frequency check error:', e.message);
  }
}

module.exports = { checkLFSActivity, checkEveningRoutine, checkPostFrequency };
