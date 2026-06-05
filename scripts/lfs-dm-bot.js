'use strict';
// ── LFS DM BOT ────────────────────────────────────────────────────
// IG DM-д ирсэн мессежид автомат хариу өгдөг
// ⚠️  ШААРДЛАГА: instagram_manage_messages permission (Meta App Review)
// Meta зөвшөөрөл өгсний дараа lfs-dm-bot.yml workflow-г идэвхжүүлнэ

const admin = require('firebase-admin');
const fetch  = require('node-fetch');

const {
  INSTAGRAM_BUSINESS_ID: IG_ID,
  ACCESS_TOKEN_META:     META_TOKEN,
  TELEGRAM_BOT_TOKEN_JARVIS: TG_TOKEN,
  TELEGRAM_ID:               TG_CHAT,
  FIREBASE_SERVICE_ACCOUNT,
  USER_UID,
  SYSTEM_USE_TOKEN:          GITHUB_TOKEN,
} = process.env;

if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(JSON.parse(FIREBASE_SERVICE_ACCOUNT)) });
}
const db = admin.firestore();

async function tgNotify(text) {
  await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: TG_CHAT, text, parse_mode: 'Markdown' }),
  });
}

// ── Хариулсан DM ID-г хянана ─────────────────────────────────────
async function getRepliedDMs() {
  const snap = await db.doc(`users/${USER_UID}/marketing/repliedDMs`).get();
  return new Set(snap.exists ? (snap.data().ids || []) : []);
}

async function markReplied(id, username) {
  const ref  = db.doc(`users/${USER_UID}/marketing/repliedDMs`);
  const snap = await ref.get();
  const ids  = snap.exists ? (snap.data().ids || []) : [];
  if (!ids.includes(id)) {
    ids.push(id);
    if (ids.length > 500) ids.splice(0, ids.length - 500);
    await ref.set({ ids, updatedAt: new Date().toISOString() }, { merge: true });
  }
}

// ── IG conversations татна ────────────────────────────────────────
async function getConversations() {
  const res  = await fetch(
    `https://graph.facebook.com/v25.0/${IG_ID}/conversations?fields=id,participants,messages{id,message,from,created_time}&access_token=${META_TOKEN}`
  );
  const data = await res.json();
  if (data.error) {
    console.error('[DM] Conversations error:', data.error.message);
    return [];
  }
  return data.data || [];
}

// ── GPT auto-reply үүсгэнэ ───────────────────────────────────────
async function generateDMReply(message, username) {
  const prompt = `Та LFS Shanghai Instagram хуудасны туслах юм.
Монгол хэрэглэгч "${username}" дараах мессеж явуулсан:
"${message}"

LFS Shanghai бол Монгол аялагчдын Шанхайдах VIP туслалцааны платформ юм.

Найрсаг, мэргэжлийн, богино хариу Монголоор бич:
- 2-3 өгүүлбэр
- Тусламж санал болго
- Вебсайт руу чиглүүл: lfsshanghai.com
- Emoji 1-2
Зөвхөн хариу текстийг буцаа.`;

  try {
    const res  = await fetch('https://models.inference.ai.azure.com/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${GITHUB_TOKEN}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 200,
        temperature: 0.8,
      }),
    });
    const data = await res.json();
    return data.choices?.[0]?.message?.content?.trim() || null;
  } catch { return null; }
}

// ── DM reply явуулна ─────────────────────────────────────────────
async function sendDMReply(conversationId, message) {
  const res  = await fetch(`https://graph.facebook.com/v25.0/${conversationId}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, access_token: META_TOKEN }),
  });
  const data = await res.json();
  return !data.error;
}

// ── MAIN ──────────────────────────────────────────────────────────
async function main() {
  console.log('[DM] Checking Instagram DMs...');

  const repliedIds  = await getRepliedDMs();
  const convos      = await getConversations();
  let totalReplied  = 0;

  for (const convo of convos) {
    const messages = convo.messages?.data || [];
    if (!messages.length) continue;

    // Хамгийн сүүлийн мессежийг авна
    const lastMsg  = messages[0];

    // Өөрийн account-н мессеж алгасна
    if (lastMsg.from?.id === IG_ID) continue;

    // Аль хэдийн хариулсан бол алгасна
    if (repliedIds.has(lastMsg.id)) continue;

    // Хэт хуучин мессеж алгасна (24 цаг)
    const age = (Date.now() - new Date(lastMsg.created_time)) / 3600000;
    if (age > 24) { await markReplied(lastMsg.id, ''); continue; }

    const username = lastMsg.from?.username || 'хэрэглэгч';
    const text     = lastMsg.message || '';

    console.log(`[DM] New message from @${username}: "${text.slice(0, 50)}"`);

    const reply = await generateDMReply(text, username);
    if (!reply) continue;

    const ok = await sendDMReply(convo.id, reply);
    if (ok) {
      await markReplied(lastMsg.id, username);
      totalReplied++;

      // Telegram-д мэдэгдэл
      await tgNotify(
        `💬 *LFS DM хариу илгээлээ*\n\n` +
        `👤 @${username}\n` +
        `📩 "${text.slice(0, 80)}"\n` +
        `🤖 "${reply.slice(0, 100)}"`
      );

      await new Promise(r => setTimeout(r, 1500));
    }
  }

  if (totalReplied > 0) {
    console.log(`[DM] Done. Replied: ${totalReplied}`);
  } else {
    console.log('[DM] Шинэ DM байхгүй.');
  }
}

main().catch(e => { console.error('[DM] Fatal:', e.message); process.exit(1); });
