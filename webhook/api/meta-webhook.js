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

const META_TOKEN   = process.env.ACCESS_TOKEN_META;
const IG_ID        = process.env.INSTAGRAM_BUSINESS_ID;
const FB_ID        = process.env.FACEBOOK_PAGE_ID;
const GH_TOKEN     = process.env.META_BOT_TOKEN || process.env.SYSTEM_USE_TOKEN;
const VERIFY_TOKEN = process.env.META_WEBHOOK_VERIFY_TOKEN;
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
const LFS_SYSTEM = `You are a friendly customer support assistant for LFS Shanghai (bileg11.github.io).
LFS Shanghai provides VIP travel assistance for Mongolian tourists visiting Shanghai, China.
Always reply in Mongolian language. Be concise (2-4 sentences). Never use markdown formatting.

SERVICES & PRICING:
- Golden Package (most popular): 2,050,000₮ per person — 5 days, 4 nights
  Includes: airport pickup, VIP medical checkup, personal nurse/translator, city tour all days, luxury buffet meals, shopping guide (Xintiandi, LV, Starbucks), airport drop-off. Hotel and flights NOT included.
- Guide service: 500 yuan/day — Mongolian-speaking, city navigation, restaurant/shop recommendations
- Translator: 500 yuan/day — Mongolian-Chinese translation, medical translation, business negotiations
- Hotel booking: 50 yuan/time — central Shanghai hotels, tailored to budget and location
- Airport pickup/drop-off: 200 yuan/time — both Pudong (PVG) and Hongqiao (SHA) airports
- Student/Young traveler digital consultation: 20,000₮ one-time — covers Alipay/WeChat Pay setup, SIM card, metro card, cheap restaurants, VPN setup, essential apps, visa (X1/X2) advice, safety tips
- Group discounts available for large groups or multi-day bookings

BOOKING:
- Website: bileg11.github.io/booking/
- Facebook: facebook.com/profile.php?id=100076380514835
- We respond within 24 hours after receiving booking info

KEY FACTS:
- Private service only — no group tours with strangers
- Mongolian-speaking staff (also Chinese and English)
- Operating hours: Mon-Sun 09:00-21:00 Shanghai time
- Services available: health/medical tourism, city tours, shopping, business interpreter, student guidance

When asked about price, always mention the Golden Package first, then individual services.
When asked how to book, direct them to bileg11.github.io or Facebook.
If unsure about a specific question, invite them to contact us directly via Facebook or the website.`;

// ── GPT REPLY ─────────────────────────────────────────────────────
async function generateReply(userText, platform) {
  const prompt = `A customer sent this message to LFS Shanghai: "${userText}". Write a helpful reply in Mongolian language (2-4 sentences, no markdown). If relevant, mention bileg11.github.io. Return only the reply text.`;

  try {
    const ctrl = new AbortController();
    const t    = setTimeout(() => ctrl.abort(), 20000);
    const r    = await fetch('https://models.inference.ai.azure.com/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${GH_TOKEN}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: LFS_SYSTEM },
          { role: 'user',   content: prompt },
        ],
        max_tokens: 250,
        temperature: 0.7,
      }),
      signal: ctrl.signal,
    });
    clearTimeout(t);
    const d = await r.json();
    return d.choices?.[0]?.message?.content?.trim() || null;
  } catch {
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

  const reply = await generateReply(text, platform);
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
