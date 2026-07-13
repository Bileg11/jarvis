// ХАНЗ SIGNUP — шинэ хэрэглэгчийн мэдэгдэл (Vercel serverless)
// hsk-signup.html → POST /api/hsk-signup → Telegram notify Билэгт.
// Үгийн сан seeding-ийг одоо hsk.html client талдаа өөрөө хийдэг
// (нэвтрэх үед хоосон бол auto-seed) тул энд зөвхөн мэдэгдэл явна.
//
// ENV (Vercel): TELEGRAM_BOT_TOKEN_JARVIS, TELEGRAM_ID

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', process.env.CORS_ORIGIN || '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST')   return res.status(405).json({ ok: false, error: 'POST only' });

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
  const { uid, name, email, level } = body || {};
  if (!uid) return res.status(400).json({ ok: false, error: 'uid required' });

  // Spam хамгаалалт: талбарын урт хязгаарлана
  const clean = v => String(v || '?').slice(0, 120);

  const TG_TOKEN = process.env.TELEGRAM_BOT_TOKEN_JARVIS;
  const TG_CHAT  = process.env.TELEGRAM_ID;
  if (TG_TOKEN && TG_CHAT) {
    const msg = `🎉 *ХАНЗ — Шинэ хэрэглэгч*\n\n` +
      `👤 *${clean(name)}*\n` +
      `📧 ${clean(email)}\n` +
      `📚 HSK ${clean(level) || 1} (үгийн сан app дотроо автоматаар үүснэ)\n\n` +
      `_Премиум идэвхжүүлэх:_ Firebase → users/${clean(uid)}/config/profile → premium: true`;
    await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: TG_CHAT, text: msg, parse_mode: 'Markdown' }),
    }).catch(() => {});
  }

  res.json({ ok: true });
};
