'use strict';
// ── META WEBHOOK HANDLER ──────────────────────────────────────────
// IG DM + FB Messenger real-time chatbot
// GET  /api/meta-webhook  — Meta webhook verification
// POST /api/meta-webhook  — Incoming messages

const admin = require('firebase-admin');
const fetch  = require('node-fetch');

// Firebase singleton (telegram.js-тэй хуваалцана)
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)),
  });
}
const db = admin.firestore();

const META_TOKEN    = process.env.ACCESS_TOKEN_META;
const IG_ID         = process.env.INSTAGRAM_BUSINESS_ID;
const FB_ID         = process.env.FACEBOOK_PAGE_ID;
const GH_TOKEN      = process.env.META_BOT_TOKEN || process.env.SYSTEM_USE_TOKEN;
const GEMINI_KEY    = process.env.GEMINI_API_KEY;
const VERIFY_TOKEN  = process.env.META_WEBHOOK_VERIFY_TOKEN;
const UID          = process.env.USER_UID;
const TG_TOKEN     = process.env.TELEGRAM_BOT_TOKEN_JARVIS;
const TG_CHAT      = process.env.TELEGRAM_ID;

// ── HELPERS ───────────────────────────────────────────────────────
async function tgNotify(text) {
  try {
    await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: TG_CHAT, text, parse_mode: 'Markdown' }),
    });
  } catch {}
}

async function getReplied() {
  const snap = await db.doc(`users/${UID}/marketing/repliedDMs`).get();
  return new Set(snap.exists ? (snap.data().ids || []) : []);
}

async function markReplied(id) {
  const ref  = db.doc(`users/${UID}/marketing/repliedDMs`);
  const snap = await ref.get();
  const ids  = snap.exists ? (snap.data().ids || []) : [];
  if (!ids.includes(id)) {
    ids.push(id);
    if (ids.length > 1000) ids.splice(0, ids.length - 1000);
    await ref.set({ ids, updatedAt: new Date().toISOString() }, { merge: true });
  }
}

// ── LFS KNOWLEDGE BASE ────────────────────────────────────────────
const LFS_SYSTEM = `Чи LFS Shanghai-н зочин хүлээн авагч. Монгол хэлээр богино, энгийн, хүний дуугаар хариул. Робот шиг биш — найз шиг.

ДҮРЭМ:
- Зөвхөн Монгол хэлээр
- 1-3 өгүүлбэр, товч
- Markdown, emoji, formal үг хэрэглэхгүй
- Хэрэв мессеж нь зүгээр мэндчилгээ, "ok", "баяр", тусламж хүсэхгүй casual яриа бол — яг "SKIP" гэж хариул, өөр юм бичихгүй
- Тодорхой асуулт, үнэ, захиалга, үйлчилгээ асуувал хариул

ЭРҮҮЛ МЭНДИЙН БАГЦУУД (хоёулаа адилхан шинжилгээтэй):
Аль ч багцад: цусны ерөнхий + биохими (элэг, бөөр, чихэр), ЭКГ, хэт авиан шинжилгээ, Монгол орчуулагч + хувийн сувилагч, VIP тасаг.
- Алтан багц: 2,050,000₮ — 5 хоног 4 шөнө. Шинжилгээ + хот аялал бүх өдөр + хоол + шоппинг хөтөч + нисэх буудал угтах/хүргэх. Буудал, нислэг тусдаа.
- Мөнгөн багц: 950,000₮ — 2 өдөр. Адилхан шинжилгээ + 1 өдрийн хот аялал. Нисэх буудал угтах орно. Буудал, нислэг тусдаа.

ТУСДАА ҮЙЛЧИЛГЭЭ:
- Хөтөч: 500 юань/өдөр
- Орчуулагч: 500 юань/өдөр
- Буудал захиалга: 50 юань/удаа
- Нисэх буудлаас угтах/хүргэх: 200 юань/удаа (Пүдун PVG болон Хунцяо SHA аль алинаас)
- Оюутны зөвлөгөө: 20,000₮ нэг удаа — Alipay, WeChat Pay, SIM, метро, VPN, аппууд, виз
- Группийн хөнгөлөлт боломжтой

ЗАХИАЛГА: bileg11.github.io/booking/ эсвэл Facebook. 24 цагт хариу өгнө.
ЭМНЭЛЭГ: 光明中医院 — Шанхайн шилдэг, VIP тасаг, хүлээлгүй, хариу тухайн өдрөө.
ТӨЛБӨР: Монгол банкны дансаар (₮) эсвэл Шанхайд юаниар.`;

// ── AI REPLY (Gemini 2.0 Flash, fallback → GitHub Models) ────────
async function generateReply(userText) {
  const userPrompt = `Хэрэглэгч: "${userText}"`;

  const ctrl = new AbortController();
  const t    = setTimeout(() => ctrl.abort(), 20000);

  try {
    let raw = null;

    if (GEMINI_KEY) {
      // ── Gemini 2.0 Flash (үнэгүй) ──────────────────────────────
      const r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_KEY}`,
        {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            system_instruction: { parts: [{ text: LFS_SYSTEM }] },
            contents:           [{ role: 'user', parts: [{ text: userPrompt }] }],
            generationConfig:   { maxOutputTokens: 200, temperature: 0.7 },
          }),
          signal: ctrl.signal,
        }
      );
      const d = await r.json();
      raw = d.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || null;
    } else {
      // ── GitHub Models fallback ──────────────────────────────────
      const r = await fetch('https://models.inference.ai.azure.com/chat/completions', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${GH_TOKEN}` },
        body: JSON.stringify({
          model:    'gpt-4o-mini',
          messages: [
            { role: 'system', content: LFS_SYSTEM },
            { role: 'user',   content: userPrompt },
          ],
          max_tokens:  200,
          temperature: 0.7,
        }),
        signal: ctrl.signal,
      });
      const d = await r.json();
      raw = d.choices?.[0]?.message?.content?.trim() || null;
    }

    clearTimeout(t);
    if (!raw || raw === 'SKIP') return null;   // SKIP → хариу илгээхгүй
    return raw;

  } catch {
    clearTimeout(t);
    return null;
  }
}

// ── SEND MESSAGE ──────────────────────────────────────────────────
async function sendReply(recipientId, text, accessToken) {
  try {
    const r = await fetch('https://graph.facebook.com/v25.0/me/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recipient:    { id: recipientId },
        message:      { text },
        access_token: accessToken,
      }),
    });
    const d = await r.json();
    return !d.error;
  } catch {
    return false;
  }
}

// ── FB Page Access Token ──────────────────────────────────────────
async function getPageToken() {
  try {
    const r = await fetch(
      `https://graph.facebook.com/v25.0/${FB_ID}?fields=access_token&access_token=${META_TOKEN}`
    );
    const d = await r.json();
    return d.access_token || META_TOKEN;
  } catch {
    return META_TOKEN;
  }
}

// ── PROCESS MESSAGE ───────────────────────────────────────────────
async function processMessage(senderId, text, mid, platform, accessToken) {
  if (!text || !mid) return;

  const replied = await getReplied();
  if (replied.has(mid)) return;

  const reply = await generateReply(text);
  if (!reply) return;

  const ok = await sendReply(senderId, reply, accessToken);
  if (ok) await markReplied(mid);

  // Telegram мэдэгдэл
  const icon = platform === 'fb' ? '💬 FB' : '📸 IG';
  if (ok) {
    await tgNotify(
      `${icon} *DM хариу илгээлээ*\n\n` +
      `📩 ${text}\n\n` +
      `🤖 ${reply}`
    );
  } else {
    await tgNotify(`${icon} *DM reply алдаа*\n📩 "${text.slice(0, 80)}"`);
  }
}

// ══════════════════════════════════════════════════════════════════
// EXPRESS HANDLERS
// ══════════════════════════════════════════════════════════════════
module.exports = {
  // GET — Meta webhook verification
  verify(req, res) {
    const mode      = req.query['hub.mode'];
    const token     = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      console.log('[Meta] Webhook verified ✅');
      return res.status(200).send(challenge);
    }
    console.warn('[Meta] Webhook verification failed');
    return res.sendStatus(403);
  },

  // POST — Incoming messages
  async handle(req, res) {
    // Meta-д ШУУД 200 хариулна
    res.sendStatus(200);

    try {
      const body = req.body;
      if (body.object !== 'instagram' && body.object !== 'page') return;

      const isIG = body.object === 'instagram';
      const accessToken = isIG ? META_TOKEN : await getPageToken();
      const platform    = isIG ? 'ig' : 'fb';

      for (const entry of (body.entry || [])) {
        // Messaging events (IG DM + FB Messenger)
        for (const event of (entry.messaging || [])) {
          const senderId = event.sender?.id;
          const msg      = event.message;

          // Өөрийн page/account-н мессеж алгасна
          if (!senderId || senderId === IG_ID || senderId === FB_ID) continue;
          // Echo / delivery / read алгасна
          if (!msg || msg.is_echo || event.delivery || event.read) continue;

          const text = msg.text || '';
          const mid  = msg.mid  || '';

          if (text && mid) {
            processMessage(senderId, text, mid, platform, accessToken).catch(
              e => console.error('[Meta] processMessage error:', e.message)
            );
          }
        }

        // IG webhook changes format (backup)
        for (const change of (entry.changes || [])) {
          if (change.field !== 'messages') continue;
          const v        = change.value;
          const senderId = v.sender?.id;
          const msg      = v.message;

          if (!senderId || senderId === IG_ID) continue;
          if (!msg || msg.is_echo) continue;

          const text = msg.text || '';
          const mid  = msg.mid  || '';

          if (text && mid) {
            processMessage(senderId, text, mid, 'ig', META_TOKEN).catch(
              e => console.error('[Meta] IG changes error:', e.message)
            );
          }
        }
      }
    } catch (e) {
      console.error('[Meta] Webhook error:', e.message);
    }
  },
};
