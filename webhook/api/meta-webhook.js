'use strict';
// ── META WEBHOOK HANDLER ──────────────────────────────────────────
// IG DM + FB Messenger real-time chatbot
// GET  /api/meta-webhook  — Meta webhook verification
// POST /api/meta-webhook  — Incoming messages

const fetch  = require('node-fetch');
const { admin, dbPersonal, dbLFS } = require('../firebase');

// LFS чатбот өгөгдөл → dbLFS
// Morning brief-д хувийн өгөгдөл → dbPersonal

const META_TOKEN   = process.env.ACCESS_TOKEN_META;
const IG_ID        = process.env.INSTAGRAM_BUSINESS_ID;
const FB_ID        = process.env.FACEBOOK_PAGE_ID;
const GH_TOKEN     = process.env.META_BOT_TOKEN || process.env.SYSTEM_USE_TOKEN;
const GEMINI_KEY   = process.env.GEMINI_API_KEY;
const VERIFY_TOKEN = process.env.META_WEBHOOK_VERIFY_TOKEN;
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
  const snap = await dbLFS.doc(`users/${UID}/marketing/repliedDMs`).get();
  return new Set(snap.exists ? (snap.data().ids || []) : []);
}

async function markReplied(id) {
  const ref  = dbLFS.doc(`users/${UID}/marketing/repliedDMs`);
  const snap = await ref.get();
  const ids  = snap.exists ? (snap.data().ids || []) : [];
  if (!ids.includes(id)) {
    ids.push(id);
    if (ids.length > 1000) ids.splice(0, ids.length - 1000);
    await ref.set({ ids, updatedAt: new Date().toISOString() }, { merge: true });
  }
}

// ── CHAT HISTORY (Firestore per sender, 14 хоног TTL) ─────────────
const HISTORY_LIMIT = 6;
const HISTORY_TTL   = 14 * 24 * 60 * 60 * 1000;

async function getChatHistory(senderId) {
  try {
    const snap = await dbLFS.doc(`users/${UID}/chatHistory/${senderId}`).get();
    if (!snap.exists) return [];
    const data = snap.data();
    if (data.updatedAt && Date.now() - new Date(data.updatedAt).getTime() > HISTORY_TTL) return [];
    return data.messages || [];
  } catch { return []; }
}

async function saveChatHistory(senderId, userText, botReply) {
  try {
    const ref  = dbLFS.doc(`users/${UID}/chatHistory/${senderId}`);
    const snap = await ref.get();
    const msgs = snap.exists ? (snap.data().messages || []) : [];
    msgs.push({ role: 'user',  text: userText });
    msgs.push({ role: 'model', text: botReply });
    if (msgs.length > HISTORY_LIMIT) msgs.splice(0, msgs.length - HISTORY_LIMIT);
    await ref.set({ messages: msgs, updatedAt: new Date().toISOString() });
  } catch {}
}

// ── USER PROFILE (Firestore урт хугацааны санах ой) ───────────────
async function getProfile(senderId) {
  try {
    const snap = await dbLFS.doc(`users/${UID}/profiles/${senderId}`).get();
    return snap.exists ? snap.data() : null;
  } catch { return null; }
}

async function saveProfile(senderId, updates) {
  try {
    await dbLFS.doc(`users/${UID}/profiles/${senderId}`).set(
      { ...updates, updatedAt: new Date().toISOString() },
      { merge: true }
    );
  } catch {}
}

// ── DAILY ANALYTICS ───────────────────────────────────────────────
function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

async function trackDaily(field) {
  try {
    await dbLFS.doc(`users/${UID}/analytics/${todayKey()}`).set(
      { [field]: admin.firestore.FieldValue.increment(1) },
      { merge: true }
    );
  } catch {}
}

async function trackDailyUser(senderId) {
  try {
    await dbLFS.doc(`users/${UID}/analytics/${todayKey()}`).set(
      { users: admin.firestore.FieldValue.arrayUnion(senderId) },
      { merge: true }
    );
  } catch {}
}

// ── MORNING BRIEF (server.js-с cron дуудна, 07:30 Шанхай) ────────
async function sendMorningBrief() {
  try {
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

    const [analyticsSnap, bilegSnap, tasksSnap] = await Promise.all([
      dbLFS.doc(`users/${UID}/analytics/${yesterday}`).get(),
      dbPersonal.doc(`users/${UID}/bileg/profile`).get(),
      dbPersonal.collection(`users/${UID}/tasks`).where('done', '==', false).get().catch(() => ({ docs: [] })),
    ]);

    const d             = analyticsSnap.exists ? analyticsSnap.data() : {};
    const bileg         = bilegSnap.exists ? bilegSnap.data() : {};
    const tasks         = tasksSnap.docs
      .map(doc => doc.data())
      .sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''))
      .slice(0, 5)
      .map(d => d.text);
    const userCount     = (d.users    || []).length;
    const guideCount    = d.guide     || 0;
    const medicalCount  = d.medical   || 0;
    const agentCount    = d.agent     || 0;
    const escalateCount = d.escalate  || 0;

    const promptParts = [
      `LFS Shanghai өчигдрийн тоо: ${userCount} хэрэглэгч, ${guideCount} гайд, ${medicalCount} эмнэлэг, ${agentCount} ажилтан дуудсан.`,
      bileg.goal  ? `Билэгийн зорилго: "${bileg.goal}".`  : '',
      bileg.focus ? `Өнөөдрийн focus: "${bileg.focus}".` : '',
      tasks.length ? `Хийх tasks: ${tasks.slice(0,3).join(', ')}.` : '',
      'Билэгт зориулж өнөөдрийн 1-2 өгүүлбэр практик урам зоригтой зөвлөгөө өг. Монголоор, дотно, анхаарлын тэмдэггүй.',
    ].filter(Boolean).join(' ');

    let advice = 'Өнөөдөр нэг жижиг алхам хий — LFS-г өсгөх.';
    if (GEMINI_KEY) {
      try {
        const r = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_KEY}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ role: 'user', parts: [{ text: promptParts }] }],
              generationConfig: { maxOutputTokens: 150, temperature: 0.8 },
            }),
          }
        );
        const data  = await r.json();
        const parts = data.candidates?.[0]?.content?.parts || [];
        const part  = parts.find(p => !p.thought && p.text) || parts[0];
        advice = part?.text?.trim() || advice;
      } catch {}
    }

    const now     = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Shanghai' }));
    const days    = ['Ням', 'Даваа', 'Мягмар', 'Лхагва', 'Пүрэв', 'Баасан', 'Бямба'];
    const dayName = days[now.getDay()];
    const dateStr = now.toLocaleDateString('sv', { timeZone: 'Asia/Shanghai' });

    const taskSection = tasks.length
      ? '\n📋 *Хийх (' + tasks.length + '):*\n' + tasks.slice(0,5).map((t,i) => (i+1) + '. ' + t).join('\n') + '\n'
      : '';
    const goalSection = bileg.goal ? '\n🎯 _' + bileg.goal + '_\n' : '';

    const brief = [
      '🌅 *Өглөөний мэнд, Билэг.*',
      '_' + dayName + ', ' + dateStr + ' | Шанхай 07:30_',
      '`────────────────────`',
      '📊 *Өчигдрийн LFS:*',
      '• Хандсан: *' + userCount + '* · Гайд: *' + guideCount + '* · Эмнэлэг: *' + medicalCount + '* · Ажилтан: *' + agentCount + '*' + (escalateCount > 0 ? '\n• ⚠️ Бухимдсан: *' + escalateCount + '*' : ''),
      goalSection,
      taskSection,
      '💡 ' + advice,
      '',
      '⚡ _J.A.R.V.I.S ажиллаж байна._',
    ].join('\n');

    await tgNotify(brief);
  } catch (e) {
    console.error('[Brief] Morning brief error:', e.message);
  }
}

// ── DAILY EXECUTIVE REPORT (server.js-с cron дуудна) ─────────────
async function sendDailyReport() {
  try {
    const today = todayKey();
    const [analyticsSnap, revenueSnap] = await Promise.all([
      dbLFS.doc(`users/${UID}/analytics/${today}`).get(),
      dbPersonal.doc(`users/${UID}/revenue/${today}`).get(),
    ]);
    const d = analyticsSnap.exists ? analyticsSnap.data() : {};

    const userCount     = (d.users || []).length;
    const guideCount    = d.guide        || 0;
    const medicalCount  = d.medical      || 0;
    const bookingCount  = d.booking      || 0;
    const bookingLeads  = d.booking_lead || 0;
    const agentCount    = d.agent        || 0;
    const escalateCount = d.escalate     || 0;
    const revenue       = revenueSnap.exists ? (revenueSnap.data().total || 0) : 0;

    const report =
`📊 *J.A.R.V.I.SЫН ӨДРИЙН ТАЙЛАН*
_${today}_
\`------------------------\`
Сайхан амарч байна уу, Билэг менежер.

Өнөөдөр системд дараах хөдөлгөөнүүд хийгдлээ:
• Нийт хандсан хэрэглэгч: *${userCount}* хүн
• Шанхай гайд сонирхсон: *${guideCount}* хүн
• Эмнэлгийн багц сонирхсон: *${medicalCount}* хүн
• Захиалгын form дуусгасан: *${bookingLeads}* захиалга
• Захиалгын линк харуулсан: *${bookingCount}* удаа
• Ажилтантай холбогдсон: *${agentCount}* удаа
• Автомат сэрэмжлүүлэг: *${escalateCount}* удаа${revenue ? `\n• Бүртгэгдсэн орлого: *${revenue.toLocaleString()}₮*` : ''}

Маргаашийн ажилд чинь амжилт хүсье. 🚀`;

    await tgNotify(report);

    // Sprint 1: LFS статистикийг dbPersonal-д sync хийх → вэб dashboard уншина
    dbPersonal.doc(`users/${UID}/analytics/${today}`).set({
      lfs_users_today:  userCount,
      lfs_leads_today:  bookingLeads,
      lfs_guide_today:  guideCount,
      lfs_medical_today: medicalCount,
      lfs_revenue_today: revenue,
      syncedAt:         new Date().toISOString(),
    }, { merge: true }).catch(() => {});

  } catch (e) {
    console.error('[Report] Daily report error:', e.message);
  }
}

// ── TAG PARSER (Gemini нууц тагуудыг шүүж авна) ──────────────────
function parseTags(raw) {
  let text     = raw || '';
  let tag      = null;
  let name     = null;
  let escalate = false;

  const tagMatch = text.match(/\[TAG:\s*(guide|medical)\]/i);
  if (tagMatch) {
    tag  = tagMatch[1].toLowerCase();
    text = text.replace(tagMatch[0], '').trim();
  }

  const nameMatch = text.match(/\[NAME:\s*([^\]]{1,30})\]/i);
  if (nameMatch) {
    name = nameMatch[1].trim();
    text = text.replace(nameMatch[0], '').trim();
  }

  if (/\[ESCALATE\]/i.test(text)) {
    escalate = true;
    text = text.replace(/\[ESCALATE\]/gi, '').trim();
  }

  return { text, tag, name, escalate };
}

// ── LFS KNOWLEDGE BASE ────────────────────────────────────────────
const LFS_SYSTEM = `Чи LFS Shanghai-н залуухан менежер. Шанхайд амьдарч, ажилладаг Монгол хүн. Монгол хэлээр, дотно, найрсаг дуугаар хариул.

ЯГ ХЭРХЭН ХАРИУЛАХ:
- Зөвхөн Монгол хэлээр
- Яг л чат бичиж байгаа хүн шиг — товч, дотно, ойлгомжтой
- Formal, хэт официал үг, "Та бүхэн" хэрэглэхгүй
- АНХААРЛЫН ТЭМДЭГ (!) хэзээ ч хэрэглэхгүй — цэг (.) болон emoji л ашиглана
- Markdown болохгүй (** ## гэх мэт)
- Текстийг бөөгнөрүүлж бичихгүй — санаа бүрийн дараа мөр зай авна
- LFS-тэй огт холбогдохгүй асуулт, эсвэл мэдэхгүй бол — яг "HUMAN" гэж хариул

SKIP ДҮРЭМ (яг "SKIP" гэж хариулах тохиолдол):
- Зөвхөн emoji: "👍", "😊", "🔥" г.м.
- Баталгаажуулах богино үг: "ok", "ок", "за", "баяр", "танкс", "тэгье", "сайн"
- Яриаг үргэлжлүүлэхгүй, асуулт агуулаагүй богино хариу

SKIP ХИЙХГҮЙ (заавал хариулах):
- "hi", "hello", "сайн байна уу", "сайн уу", "өдрийн мэнд" гэх мэт мэндчилгээнд — мэндчилгээг нь үгчлэн хуулж буцааж болохгүй. Өөрийн дотно үгээр богиноор мэндэлж, LFS-д тавтай морил гэж хэлээд юу хийж өгөх вэ гэж асуу
- LFS-ийн үйлчилгээтэй холбоотой ямар ч асуулт

НУУЦ ТАГ СИСТЕМ (хэрэглэгчид харагдахгүй, хариултын хамгийн төгсгөлд л нэмнэ):
- Хэрэглэгч хөтөч, аялал, шоппинг сонирхсон бол: [TAG: guide]
- Хэрэглэгч эмнэлэг, багц, шинжилгээ сонирхсон бол: [TAG: medical]
- Хэрэглэгч нэрээ дурдсан бол: [NAME: Нэр]
- Хэрэглэгч уурласан, бухимдсан, яарсан өнгө аястай бол ("яасан удаан", "хүн байна уу", болъё г.м.): [ESCALATE]
- Нэг хариулт дотор хэрэгтэй тагуудаа л хавсарга, бусад тохиолдолд таг нэмэхгүй

ХАРИУЛТЫН БҮТЭЦ ЖИШЭЭ:
Асуулт: "Алтан багц яг юу орно вэ?"
Хариулт:
"Алтан багц 2,050,000₮, 5 хоног.

Эмнэлгийн тал: цусны шинжилгээ, биохими, ЭКГ, хэт авиан, нарийн мэргэжлийн эмч, VIP тасаг, Монгол орчуулагч бүтэн хугацаанд.

Нэмэлтээр хот аялал, luxury буфет, шоппинг хөтөч, нисэх буудал угтах/хүргэх орно.

Буудал, нислэгийн зардал тусдаа тооцно шүү. [TAG: medical]"

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

ЗАХИАЛГА: https://lfsshanghai.com/booking/ — 24 цагт хариу өгнө.
ЭМНЭЛЭГ: 光明中医院 — Шанхайн шилдэг, VIP тасаг, дараалалгүй, хариу тухайн өдрөө.
ТӨЛБӨР: Монгол банкны дансаар (₮) эсвэл Шанхайд юаниар.`;

// ── AI REPLY (Gemini flash-latest + profile context) ─────────────
async function generateReply(userText, history = [], profile = null) {
  const ctrl = new AbortController();
  const t    = setTimeout(() => ctrl.abort(), 20000);

  // Хэрэглэгчийн профайл context бэлдэнэ
  let profileCtx = '';
  if (profile) {
    const parts = [];
    if (profile.name)      parts.push(`Нэр: ${profile.name}`);
    if (profile.interests) parts.push(`Өмнө нь ${profile.interests === 'guide' ? 'хөтөч/аялал' : 'эмнэлгийн багц'} сонирхож байсан`);
    if (parts.length > 0)  profileCtx = `[Хэрэглэгчийн профайл: ${parts.join(', ')}]\n\n`;
  }

  const systemText = profileCtx + LFS_SYSTEM;

  try {
    let raw = null;

    if (GEMINI_KEY) {
      const contents = [
        ...history.map(m => ({ role: m.role, parts: [{ text: m.text }] })),
        { role: 'user', parts: [{ text: userText }] },
      ];

      const r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_KEY}`,
        {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            system_instruction: { parts: [{ text: systemText }] },
            contents,
            generationConfig: { maxOutputTokens: 2048, temperature: 0.7 },
          }),
          signal: ctrl.signal,
        }
      );
      const d = await r.json();
      if (d.error) console.error('[Gemini] API error:', JSON.stringify(d.error));
      const parts = d.candidates?.[0]?.content?.parts || [];
      const textPart = parts.find(p => !p.thought && p.text) || parts[0];
      raw = textPart?.text?.trim() || null;

    } else {
      // GitHub Models fallback
      const messages = [
        { role: 'system', content: systemText },
        ...history.map(m => ({
          role:    m.role === 'model' ? 'assistant' : 'user',
          content: m.text,
        })),
        { role: 'user', content: userText },
      ];

      const r = await fetch('https://models.inference.ai.azure.com/chat/completions', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${GH_TOKEN}` },
        body: JSON.stringify({ model: 'gpt-4o-mini', messages, max_tokens: 400, temperature: 0.7 }),
        signal: ctrl.signal,
      });
      const d = await r.json();
      raw = d.choices?.[0]?.message?.content?.trim() || null;
    }

    clearTimeout(t);
    if (!raw || raw.trim() === 'SKIP') return null;
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
  } catch { return false; }
}

// ── REPLY WITH BUTTONS (FB only, IG plain text) ──────────────────
async function sendWithButtons(recipientId, text, platform, accessToken) {
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
              text: text.slice(0, 640),
              buttons: [
                { type: 'web_url',  url: 'https://lfsshanghai.com/booking/', title: 'Захиалга өгөх' },
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
  } catch { return false; }
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
              text: 'Сайн байна уу. LFS Shanghai-д тавтай морил. Та юу мэдмээр байна вэ?',
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
  } catch { return META_TOKEN; }
}

// ── PROCESS MESSAGE ───────────────────────────────────────────────
async function processMessage(senderId, text, mid, platform, accessToken) {
  if (!text || !mid) return;

  const replied = await getReplied();
  if (replied.has(mid)) return;

  await sleep(1500);
  await senderAction(senderId, 'mark_seen', accessToken);
  await sleep(1000);
  await senderAction(senderId, 'typing_on', accessToken);

  // Хэрэглэгчийг өдрийн статистикт бүртгэнэ
  trackDailyUser(senderId);

  // History + Profile зэрэг уншина
  const [history, profile] = await Promise.all([
    getChatHistory(senderId),
    getProfile(senderId),
  ]);

  const rawReply = await generateReply(text, history, profile);
  await senderAction(senderId, 'typing_off', accessToken);

  // SKIP → FB-д welcome товчлуур
  if (!rawReply) {
    if (platform === 'fb') {
      await sendWelcome(senderId, accessToken);
      await markReplied(mid);
    }
    return;
  }

  // Нууц тагуудыг шүүж авна
  const { text: cleanReply, tag, name, escalate } = parseTags(rawReply);

  // HUMAN → ажилтан дуудах
  if (cleanReply.trim() === 'HUMAN') {
    await sendReply(
      senderId,
      'Менежерт мэдэгдэл явуулаа. 🙌\n\nЗавтай болмогц таны чатад эргэж хариу өгнө. Тэр болтол өөр асуух зүйл байвал би бэлэн байна.',
      accessToken
    );
    await markReplied(mid);
    const displayName = profile?.name || `ID: ${senderId}`;
    await tgNotify(`⚠️ *Ажилтан дуудсан.*\nХэрэглэгч: ${displayName}\nМессеж: "${text.slice(0, 100)}"`);
    trackDaily('agent');
    return;
  }

  // Профайл шинэчлэлт
  if (tag || name) {
    const updates = {};
    if (tag)  { updates.interests = tag; updates.last_topic = tag; }
    if (name) { updates.name = name; }
    if (!profile?.firstSeen) updates.firstSeen = new Date().toISOString();
    saveProfile(senderId, updates);
    if (tag) trackDaily(tag);
  }

  // Автомат ESCALATE сэрэмжлүүлэг
  if (escalate) {
    const displayName = profile?.name || `ID: ${senderId}`;

    tgNotify(
      `🚨 *СЭРЭМЖЛҮҮЛЭГ:* Хэрэглэгч *${displayName}* бухимдалтай байна. Чатыг шалгана уу.\n` +
      `_Мессеж: "${text.slice(0, 100)}"_`
    ).catch(() => {});
    trackDaily('escalate');

    // Sprint 7: Firestore-д бичих → вэбсайт дэлгэц дээр realtime red alert
    const alertPayload = {
      type:        'escalate',
      senderId,
      displayName,
      message:     text.slice(0, 200),
      platform,
      triggeredAt: new Date().toISOString(),
      resolved:    false,
    };
    // dbLFS — сервер талын хадгалалт
    dbLFS.doc(`users/${UID}/alerts/current`).set(alertPayload)
      .catch(e => console.error('[Alert] LFS write error:', e.message));
    // dbPersonal — вэб dashboard (jarvis-bileg SDK) уншдаг
    dbPersonal.doc(`users/${UID}/alerts/current`).set(alertPayload)
      .catch(e => console.error('[Alert] Personal write error:', e.message));
  }

  const ok = await sendWithButtons(senderId, cleanReply, platform, accessToken);
  if (ok) {
    await markReplied(mid);
    await saveChatHistory(senderId, text, cleanReply);
    // Захиалгын линк харуулсан бол бүртгэнэ
    if (cleanReply.includes('lfsshanghai.com/booking')) trackDaily('booking');
  }
}

// ══════════════════════════════════════════════════════════════════
// EXPRESS HANDLERS
// ══════════════════════════════════════════════════════════════════
module.exports = {
  sendMorningBrief,
  sendDailyReport,

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

  async handle(req, res) {
    res.sendStatus(200);

    try {
      const body = req.body;
      if (body.object !== 'instagram' && body.object !== 'page') return;

      const isIG        = body.object === 'instagram';
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
              trackDaily('guide');
              processMessage(senderId, 'Хөтөч үйлчилгээний үнэ болон дэлгэрэнгүй мэдээллийг хэлнэ үү', pid, platform, accessToken).catch(() => {});
            } else if (payload === 'MEDICAL_INFO') {
              trackDaily('medical');
              processMessage(senderId, 'Эмнэлгийн багцуудын үнэ болон дэлгэрэнгүй мэдээллийг хэлнэ үү', pid, platform, accessToken).catch(() => {});
            } else if (payload === 'CONNECT_AGENT') {
              sendReply(
                senderId,
                'Менежерт мэдэгдэл явуулаа. 🙌\n\nЗавтай болмогц таны чатад эргэж хариу өгнө. Тэр болтол өөр асуух зүйл байвал би бэлэн байна.',
                accessToken
              ).catch(() => {});
              tgNotify(`⚠️ *Ажилтан дуудсан.*\nFB ID: ${senderId}`).catch(() => {});
              trackDaily('agent');
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
