// ── JARVIS COMMENT REPLIER ────────────────────────────────────────
// IG пост дээрх шинэ comment-үүдийг олж GPT-аар хариу бичнэ
// Firestore-д хариулсан comment ID-г хадгалж давтахгүй

'use strict';
const admin = require('firebase-admin');

const {
  INSTAGRAM_BUSINESS_ID: IG_ID,
  ACCESS_TOKEN_META:     META_TOKEN,
  FIREBASE_SERVICE_ACCOUNT,
  USER_UID,
  SYSTEM_USE_TOKEN:      GITHUB_TOKEN,
  TELEGRAM_BOT_TOKEN_JARVIS: TG_TOKEN,
  TELEGRAM_ID:               TG_CHAT,
} = process.env;

const sa = JSON.parse(FIREBASE_SERVICE_ACCOUNT);
admin.initializeApp({ credential: admin.credential.cert(sa) });
const db = admin.firestore();

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function tgMsg(text) {
  await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: TG_CHAT, text, parse_mode: 'Markdown' }),
  });
}

// ── FIRESTORE: хариулсан comment ID-г хадгална ───────────────────
async function getRepliedIds() {
  const snap = await db.doc(`users/${USER_UID}/marketing/repliedComments`).get();
  return new Set(snap.exists ? (snap.data().ids || []) : []);
}

async function markReplied(id) {
  const ref  = db.doc(`users/${USER_UID}/marketing/repliedComments`);
  const snap = await ref.get();
  const ids  = snap.exists ? (snap.data().ids || []) : [];
  if (!ids.includes(id)) {
    ids.push(id);
    if (ids.length > 2000) ids.splice(0, ids.length - 2000);
    await ref.set({ ids, updatedAt: new Date().toISOString() });
  }
}

// ── IG: сүүлийн постуудыг авна ────────────────────────────────────
async function getRecentMedia(limit = 8) {
  const res = await fetch(
    `https://graph.facebook.com/v25.0/${IG_ID}/media?fields=id,caption,timestamp&limit=${limit}&access_token=${META_TOKEN}`
  );
  const data = await res.json();
  return data.data || [];
}

// ── IG: post дээрх comment-үүдийг авна ───────────────────────────
async function getComments(mediaId) {
  const res = await fetch(
    `https://graph.facebook.com/v25.0/${mediaId}/comments?fields=id,text,username,timestamp,replies{id}&access_token=${META_TOKEN}`
  );
  const data = await res.json();
  return data.data || [];
}

// ── GPT: comment-д хариу үүсгэнэ ─────────────────────────────────
async function generateReply(commentText, username) {
  const prompt = `Та LFS Shanghai Instagram хуудасны менежер юм.
Дараах comment-д Монгол хэлээр найрсаг, богино хариу бич:

Хэрэглэгч: @${username}
Comment: "${commentText}"

Дүрэм:
- 1-2 өгүүлбэр, хэт урт биш
- Найрсаг, authentic — robot мэт биш
- Заримдаа асуулт тавьж engagement нэмнэ
- LFS Shanghai-г хэт ихэр дурдахгүй
- Emoji 1-2 ашиглана
- Зөвхөн хариу текстийг буцаана`;

  try {
    const res = await fetch('https://models.inference.ai.azure.com/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${GITHUB_TOKEN}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 150,
        temperature: 0.9,
      }),
    });
    const data = await res.json();
    return data.choices?.[0]?.message?.content?.trim() || null;
  } catch { return null; }
}

// ── IG: comment-д хариу post хийнэ ───────────────────────────────
async function postReply(commentId, message) {
  const res = await fetch(`https://graph.facebook.com/v25.0/${commentId}/replies`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, access_token: META_TOKEN }),
  });
  const data = await res.json();
  return !data.error;
}

// ── MAIN ──────────────────────────────────────────────────────────
async function main() {
  console.log('[CommentReply] Starting...');

  const repliedIds = await getRepliedIds();
  const media      = await getRecentMedia(8);

  let totalReplied = 0;

  for (const post of media) {
    const comments = await getComments(post.id);

    for (const comment of comments) {
      // Top-level comment л авна (reply биш)
      if (repliedIds.has(comment.id)) continue;

      // Өөрийн account-н comment-г алгасна
      if (!comment.text || comment.username === 'lfs.shanghai') continue;

      // Хэт хуучин comment алгасна (48 цаасаас хэтэрсэн)
      const age = (Date.now() - new Date(comment.timestamp)) / 3600000;
      if (age > 48) { await markReplied(comment.id); continue; }

      const reply = await generateReply(comment.text, comment.username || 'хэрэглэгч');
      if (!reply) continue;

      const ok = await postReply(comment.id, reply);
      if (ok) {
        await markReplied(comment.id);
        totalReplied++;
        console.log(`[CommentReply] Replied to @${comment.username}: "${comment.text.slice(0, 40)}..."`);
        await sleep(2000); // Rate limit
      }
    }
  }

  // Зөвхөн хариулсан үед Telegram-д мэдэгдэнэ (spam болгохгүй)
  if (totalReplied > 0) {
    await tgMsg(`💬 *Comment Reply:* ${totalReplied} comment-д хариулав`);
  }

  console.log(`[CommentReply] Done. Replied: ${totalReplied}`);
}

main().catch(e => {
  console.error('[CommentReply] Fatal:', e.message);
  process.exit(1);
});
