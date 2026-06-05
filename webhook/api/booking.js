'use strict';
// ── LFS BOOKING HANDLER ───────────────────────────────────────────
// POST /api/booking — биелэг11 booking form-аас дуудагдана
// Хийх зүйлс:
//   1. Firestore-д хадгалах (users/${UID}/bookings)
//   2. Telegram-д confirm/cancel товчтой мэдэгдэл явуулах
//   3. Өдрийн аналитик бүртгэх

const fetch  = require('node-fetch');
const { admin, dbLFS } = require('../firebase');
const TG_TOKEN = process.env.TELEGRAM_BOT_TOKEN_LFS;
const TG_CHAT  = process.env.TELEGRAM_ID;
const UID      = process.env.USER_UID;

module.exports = async (req, res) => {
  // CORS — GitHub Pages-аас дуудахад шаардлагатай
  const origin = req.headers.origin || '';
  const allowed = ['https://lfsshanghai.com', 'http://localhost'];
  res.setHeader('Access-Control-Allow-Origin', allowed.some(o => origin.startsWith(o)) ? origin : 'https://lfsshanghai.com');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Method not allowed' });

  try {
    const {
      name, phone, email = '', service = '',
      start = '', days = '', people = '1',
      social = '', note = '', source = '', userId = '',
    } = req.body || {};

    if (!name || !phone) {
      return res.status(400).json({ error: 'Нэр болон утас шаардлагатай' });
    }

    // ── Firestore хадгалах ────────────────────────────────────────
    const bookingId = String(Date.now());
    const booking   = {
      id: bookingId,
      name, phone, email, service,
      start, days, people,
      social, note, source, userId,
      status:    'pending',
      createdAt: new Date().toISOString(),
    };

    await dbLFS.collection(`users/${UID}/bookings`).doc(bookingId).set(booking);

    // Аналитик — booking_lead тоолуур
    const today = new Date().toLocaleDateString('sv', { timeZone: 'Asia/Shanghai' });
    dbLFS.doc(`users/${UID}/analytics/${today}`).set(
      { booking_lead: admin.firestore.FieldValue.increment(1) },
      { merge: true }
    ).catch(() => {});

    // ── Telegram — confirm/cancel товчтой мэдэгдэл ──────────────
    const lines = [
      `🔔 ШИНЭ ЗАХИАЛГА`,
      ``,
      `Нэр: ${name}`,
      `Утас: ${phone}`,
      email  ? `И-мэйл: ${email}`   : null,
      `Үйлчилгээ: ${service || '—'}`,
      start  ? `Огноо: ${start}`    : null,
      days   ? `Хугацаа: ${days}`   : null,
      people ? `Хүн: ${people}`     : null,
      social ? `Social: ${social}`  : null,
      note   ? `Тэмдэглэл: ${note}` : null,
      source ? `Хаанаас: ${source}` : null,
      ``,
      `ID: ${bookingId}`,
    ].filter(l => l !== null).join('\n');

    await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: TG_CHAT,
        text:    lines,
        reply_markup: {
          inline_keyboard: [[
            { text: '✅ Баталгаажуулах', callback_data: `bkc_${bookingId}` },
            { text: '❌ Цуцлах',         callback_data: `bkx_${bookingId}` },
          ]],
        },
      }),
    });

    return res.status(200).json({ ok: true, bookingId });

  } catch (e) {
    console.error('[Booking] Error:', e.message);
    return res.status(500).json({ error: 'Серверийн алдаа' });
  }
};
