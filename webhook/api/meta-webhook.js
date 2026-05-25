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
const sleep = ms => new Promise(r => setTimeout(r, ms));

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

// ── CHAT HISTORY (Firestore per sender) ──────────────────────────
// 24 цаг хэрэглэхгүй байвал санах ойг цэвэрлэнэ
const HISTORY_LIMIT = 6;                        // 3 хэрэглэгч + 3 бот = 6 мессеж
const HISTORY_TTL   = 14 * 24 * 60 * 60 * 1000; // 14 хоног

async function getChatHistory(senderId) {
  try {
    const snap = await db.doc(`users/${UID}/chatHistory/${senderId}`).get();
    if (!snap.exists) return [];
    const data = snap.data();
    // 24 цаг өнгөрсөн бол хуучин санах ойг хаяна
    if (data.updatedAt) {
      const age = Date.now() - new Date(data.updatedAt).getTime();
      if (age > HISTORY_TTL) return [];
    }
    return data.messages || [];
  } catch {
    return [];
  }
}

async function saveChatHistory(senderId, userText, botReply) {
  try {
    const ref  = db.doc(`users/${UID}/chatHistory/${senderId}`);
    const snap = await ref.get();
    const msgs = snap.exists ? (snap.data().messages || []) : [];

    msgs.push({ role: 'user',  text: userText  });
    msgs.push({ role: 'model', text: botReply  });

    // Сүүлийн HISTORY_LIMIT мессежийг л хадгална
    if (msgs.length > HISTORY_LIMIT) msgs.splice(0, msgs.length - HISTORY_LIMIT);

    await ref.set({ messages: msgs, updatedAt: new Date().toISOString() });
  } catch {}
}

// ── LFS KNOWLEDGE BASE ────────────────────────────────────────────
const LFS_SYSTEM = `Чи LFS Shanghai-н залуухан менежер. Шанхайд амьдарч, ажилладаг Монгол хүн. Монгол хэлээр, дотно, найрсаг дуугаар хариул.

ЯГ ХЭРХЭН ХАРИУЛАХ:
- Зөвхөн Монгол хэлээр
- Яг л чат бичиж байгаа хүн шиг — товч, дотно, ойлгомжтой
- Formal, хэт официал, "Та бүхэн" гэх мэт хүндэтгэлийн үг хэрэглэхгүй — "та" хэрэглэж болно, гэхдээ дотно байлга
- АНХААРЛЫН ТЭМДЭГ (!) хэзээ ч хэрэглэхгүй — цэг (.) болон emoji л ашиглана
- Markdown болохгүй (** ## гэх мэт)
- Текстийг бөөгнөрүүлж бичихгүй — санаа бүрийн дараа мөр зай авна (\n\n)
- LFS-тэй огт холбогдохгүй асуулт, эсвэл мэдэхгүй бол — яг "HUMAN" гэж хариул
- Үнэ, захиалга, үйлчилгээ, шинжилгээ асуувал дэлгэрэнгүй, цэгцтэй хариул

SKIP ДҮРЭМ (зөвхөн доорх тохиолдолд л "SKIP" гэж хариул):
- Зөвхөн emoji илгээсэн ("👍", "😊", "🔥" г.м.)
- "ok", "ок", "за", "баяр", "танкс", "тэгье" гэх мэт баталгаажуулах богино үг
- Хүлээн авлаа, уншлаа гэсэн утгатай богино хариу
- Яриаг үргэлжлүүлэхгүй, асуулт агуулаагүй бол

SKIP ХИЙХГҮЙ (хариул):
- "hi", "hi байна уу", "hello", "сайн уу", "сайн байна уу", "өдрийн мэнд", "өдөр", "нөгөө" гэх мэт мэндчилгээ — товч дотно мэндчилж, юу хийж өгөх вэ гэж асуу
- Ямар ч асуулт, сонирхол агуулсан мессеж

ХАРИУЛТЫН БҮТЭЦ ЖИШЭЭ:
Асуулт: "Алтан багц яг юу орно вэ?"
Хариулт:
"Алтан багц 2,050,000₮, 5 хоног.

Эмнэлгийн тал: цусны шинжилгээ, биохими, ЭКГ, хэт авиан, нарийн мэргэжлийн эмч, VIP тасаг, Монгол орчуулагч бүтэн хугацаанд.

Нэмэлтээр хот аялал, luxury буфет, шоппинг хөтөч, нисэх буудал угтах/хүргэх орно.

Буудал, нислэгийн зардал тусдаа тооцно шүү."

ХӨТӨЧ ҮЙЛЧИЛГЭЭ — 500 юань/өдөр:
Шанхай хотын дотор бүх зүйлд туслана. Шоппинг, зах дэлгүүр, хэлмэрч, тээвэр, зүг чиг — Монгол хэлтэй, бүтэн өдрийн үйлчилгээ.

ЭРҮҮЛ МЭНДИЙН БАГЦУУД:

Алтан багц — 2,050,000₮ (5 хоног, 4 шөнө):
Цусны ерөнхий шинжилгээ, биохими (элэг, бөөр, чихэр), нарийн мэргэжлийн эмчийн үзлэг, оношилгоо, бүтэн биеийн зураг авалт, ЭКГ, хэт авиан шинжилгээ, Монгол орчуулагч + хувийн сувилагч, VIP тасаг. Нэмэлтээр: хот аялал бүх өдөр, luxury буфет хоол, шоппинг хөтөч (Xintiandi, LV г.м.), нисэх буудал угтах + хүргэх. Буудал, нислэг тусдаа.

Мөнгөн багц — 950,000₮ (2 өдөр):
Цусны ерөнхий шинжилгээ, биохими, үндсэн оношилгоо, ЭКГ, Монгол орчуулагч + хувийн сувилагч, VIP тасаг, 1 өдрийн хот аялал. Нисэх буудал угтах орно. Буудал, нислэг тусдаа.

ТУСДАА ҮЙЛЧИЛГЭЭ:
Орчуулагч: 500 юань/өдөр — Монгол-Хятад, эмнэлэг, бизнес
Буудал захиалга: 50 юань/удаа — хотын төвд, бюджетэд тохируулна
Нисэх буудлаас угтах/хүргэх: 200 юань/удаа — Пүдун (PVG) болон Хунцяо (SHA) аль алинаас
Оюутны зөвлөгөө: 20,000₮ нэг удаа — Alipay, WeChat Pay, SIM, метро, VPN, аппууд, виз (X1/X2)
Группийн болон олон өдрийн захиалгад хөнгөлөлт боломжтой.

ЗАХИАЛГА: https://bileg11.github.io/booking/ — 24 цагт хариу өгнө.
ЭМНЭЛЭГ: 光明中医院 — Шанхайн шилдэг, VIP тасаг, дараалалгүй, хариу тухайн өдрөө.
ТӨЛБӨР: Монгол банкны дансаар (₮) эсвэл Шанхайд юаниар.`;

// ── AI REPLY (Gemini 2.0 Flash, fallback → GitHub Models) ────────
async function generateReply(userText, history = []) {
  const ctrl = new AbortController();
  const t    = setTimeout(() => ctrl.abort(), 20000);

  try {
    let raw = null;

    if (GEMINI_KEY) {
      // ── Gemini 1.5 Flash (v1) ────────────────────────────────────
      const contents = [
        ...history.map(m => ({ role: m.role, parts: [{ text: m.text }] })),
        { role: 'user', parts: [{ text: userText }] },
      ];

      const r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${GEMINI_KEY}`,
        {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            system_instruction: { parts: [{ text: LFS_SYSTEM }] },
            contents,
            generationConfig: { maxOutputTokens: 2048, temperature: 0.7 },
          }),
          signal: ctrl.signal,
        }
      );
      const d = await r.json();
      if (d.error) console.error('[Gemini] API error:', JSON.stringify(d.error));
      // thinking model-д parts[0] = thought, parts[1] = хариу
      // thought биш эхний part-г авна
      const parts = d.candidates?.[0]?.content?.parts || [];
      const textPart = parts.find(p => !p.thought && p.text) || parts[0];
      raw = textPart?.text?.trim() || null;

    } else {
      // ── GitHub Models fallback — history OpenAI format ──────────
      const messages = [
        { role: 'system', content: LFS_SYSTEM },
        ...history.map(m => ({
          role:    m.role === 'model' ? 'assistant' : 'user',
          content: m.text,
        })),
        { role: 'user', content: userText },
      ];

      const r = await fetch('https://models.inference.ai.azure.com/chat/completions', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${GH_TOKEN}` },
        body: JSON.stringify({ model: 'gpt-4o-mini', messages, max_tokens: 200, temperature: 0.7 }),
        signal: ctrl.signal,
      });
      const d = await r.json();
      raw = d.choices?.[0]?.message?.content?.trim() || null;
    }

    clearTimeout(t);
    if (!raw || raw.trim() === 'SKIP') return null;  // casual → илгээхгүй
    return raw;

  } catch {
    clearTimeout(t);
    return null;
  }
}

// ── SENDER ACTIONS (mark seen + typing) ──────────────────────────
async function senderAction(recipientId, action, accessToken) {
  try {
    await fetch('https://graph.facebook.com/v25.0/me/messages', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recipient:     { id: recipientId },
        sender_action: action,
        access_token:  accessToken,
      }),
    });
  } catch {}
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

// ── REPLY WITH BUTTONS (FB only, IG plain text) ──────────────────
async function sendWithButtons(recipientId, text, platform, accessToken) {
  // IG template дэмждэггүй тул plain text явуулна
  if (platform === 'ig') return sendReply(recipientId, text, accessToken);

  try {
    const r = await fetch('https://graph.facebook.com/v25.0/me/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recipient:    { id: recipientId },
        message: {
          attachment: {
            type: 'template',
            payload: {
              template_type: 'button',
              text: text.slice(0, 640),   // FB limit
              buttons: [
                { type: 'web_url',  url: 'https://bileg11.github.io/booking/', title: 'Захиалга өгөх' },
                { type: 'postback', payload: 'CONNECT_AGENT', title: 'Ажилтан дуудах' },
              ],
            },
          },
        },
        access_token: accessToken,
      }),
    });
    const d = await r.json();
    return !d.error;
  } catch {
    return false;
  }
}

// ── WELCOME MESSAGE (Get Started / шинэ хэрэглэгч) ───────────────
async function sendWelcome(recipientId, accessToken) {
  try {
    const r = await fetch('https://graph.facebook.com/v25.0/me/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recipient: { id: recipientId },
        message: {
          attachment: {
            type: 'template',
            payload: {
              template_type: 'button',
              text: 'Сайн байна уу! LFS Shanghai-д тавтай морил. Та юу мэдмээр байна вэ?',
              buttons: [
                { type: 'postback', payload: 'GUIDE_INFO',    title: 'Шанхай гайд' },
                { type: 'postback', payload: 'MEDICAL_INFO',  title: 'Эмнэлгийн багц' },
                { type: 'postback', payload: 'CONNECT_AGENT', title: 'Менежер дуудах' },
              ],
            },
          },
        },
        access_token: accessToken,
      }),
    });
    const d = await r.json();
    if (d.error) console.error('[Meta] sendWelcome error:', JSON.stringify(d.error));
  } catch (e) { console.error('[Meta] sendWelcome catch:', e.message); }
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

  // 1.5с хүлээгээд "уншсан" болгоно — хүн шиг санагдуулна
  await sleep(1500);
  await senderAction(senderId, 'mark_seen', accessToken);
  await sleep(1000);
  await senderAction(senderId, 'typing_on', accessToken);

  // Хэрэглэгчийн өмнөх яриаг уншина
  const history = await getChatHistory(senderId);
  const reply = await generateReply(text, history);
  await senderAction(senderId, 'typing_off', accessToken);

  // SKIP авбал FB-д welcome товчлуур явуул
  if (!reply) {
    if (platform === 'fb') {
      await sendWelcome(senderId, accessToken);
      await markReplied(mid);
    }
    return;
  }

  // HUMAN → ажилтан дуудах, Telegram alert
  if (reply.trim() === 'HUMAN') {
    await sendReply(senderId, 'Менежерт мэдэгдэл явуулаа. 🙌\n\nЗавтай болмогц таны чатад эргэж хариу өгнө. Тэр болтол өөр асуух зүйл байвал би бэлэн байна.', accessToken);
    await markReplied(mid);
    await tgNotify(`⚠️ *Ажилтан дуудсан!*\nID: ${senderId}\nМессеж: "${text.slice(0, 100)}"`);
    return;
  }

  const ok = await sendWithButtons(senderId, reply, platform, accessToken);
  if (ok) {
    await markReplied(mid);
    await saveChatHistory(senderId, text, reply);
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
          if (!senderId || senderId === IG_ID || senderId === FB_ID) continue;

          // ── Postback (товч дарах, Get Started) ──────────────────
          if (event.postback) {
            const payload = event.postback.payload;
            const pid     = `pb_${senderId}_${Date.now()}`;
            if (payload === 'GET_STARTED' || payload === 'WELCOME_MESSAGE') {
              sendWelcome(senderId, accessToken).catch(e => console.error('[Meta] sendWelcome error:', e.message));
            } else if (payload === 'GUIDE_INFO') {
              processMessage(senderId, 'Хөтөч үйлчилгээний үнэ болон дэлгэрэнгүй мэдээллийг хэлнэ үү', pid, platform, accessToken).catch(() => {});
            } else if (payload === 'MEDICAL_INFO') {
              processMessage(senderId, 'Эмнэлгийн багцуудын үнэ болон дэлгэрэнгүй мэдээллийг хэлнэ үү', pid, platform, accessToken).catch(() => {});
            } else if (payload === 'CONNECT_AGENT') {
              sendReply(senderId, 'Менежерт мэдэгдэл явуулаа. 🙌\n\nЗавтай болмогц таны чатад эргэж хариу өгнө. Тэр болтол өөр асуух зүйл байвал би бэлэн байна.', accessToken).catch(() => {});
              tgNotify(`⚠️ *Ажилтан дуудсан!*\nFB ID: ${senderId}`).catch(() => {});
            }
            continue;
          }

          // ── Энгийн мессеж ────────────────────────────────────────
          const msg = event.message;
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
