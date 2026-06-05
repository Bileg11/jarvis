// ── JARVIS MANUAL POSTER ──────────────────────────────────────────
// Telegram-д зураг явуулахад → caption оруулах / AI үүсгэх → IG post
// Firestore-д сүүлийн шалгасан update_id хадгалдаг

'use strict';
const admin = require('firebase-admin');

const {
  TELEGRAM_BOT_TOKEN_JARVIS: TG_TOKEN,
  TELEGRAM_ID:               TG_CHAT,
  INSTAGRAM_BUSINESS_ID:     IG_ID,
  ACCESS_TOKEN_META:         META_TOKEN,
  FIREBASE_SERVICE_ACCOUNT,
  USER_UID,
  SYSTEM_USE_TOKEN:          GITHUB_TOKEN,
} = process.env;

const sa = JSON.parse(FIREBASE_SERVICE_ACCOUNT);
admin.initializeApp({ credential: admin.credential.cert(sa) });
const db = admin.firestore();

const sleep = ms => new Promise(r => setTimeout(r, ms));

// ── TELEGRAM HELPERS ──────────────────────────────────────────────
async function tg(method, body) {
  const res = await fetch(`https://api.telegram.org/bot${TG_TOKEN}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.json();
}

async function tgMsg(text, extra = {}) {
  return tg('sendMessage', { chat_id: TG_CHAT, text, parse_mode: 'Markdown', ...extra });
}

// ── FIRESTORE: сүүлийн offset хадгална ───────────────────────────
async function getLastOffset() {
  const snap = await db.doc(`users/${USER_UID}/marketing/manualPosterState`).get();
  return snap.exists ? (snap.data().offset || 0) : 0;
}

async function saveOffset(offset) {
  await db.doc(`users/${USER_UID}/marketing/manualPosterState`).set({
    offset, updatedAt: new Date().toISOString()
  }, { merge: true });
}

// ── TELEGRAM: зурагны file URL авна ──────────────────────────────
async function getPhotoUrl(fileId) {
  const res  = await fetch(`https://api.telegram.org/bot${TG_TOKEN}/getFile?file_id=${fileId}`);
  const data = await res.json();
  const path = data.result?.file_path;
  if (!path) return null;
  return `https://api.telegram.org/file/bot${TG_TOKEN}/${path}`;
}

// ── GPT: caption үүсгэнэ ──────────────────────────────────────────
async function generateCaption(userHint = '') {
  const prompt = `Та LFS Shanghai Instagram маркетинг менежер юм.
${userHint ? `Хэрэглэгчийн тэмдэглэл: "${userHint}"` : 'Шанхайн LFS брэндтэй холбоотой пост бич.'}

CAPTION:
[3-4 өгүүлбэр, Монгол хэлээр, 4-6 emoji, "👉 lfsshanghai.com" CTA]

HASHTAGS:
[18-22 hashtag Монгол+Англи+Хятад, зайгаар тусгаарласан]

Зөвхөн CAPTION: болон HASHTAGS: хэсгүүдийг буцаана.`;

  try {
    const res = await fetch('https://models.inference.ai.azure.com/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${GITHUB_TOKEN}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 600, temperature: 0.88,
      }),
    });
    const data = await res.json();
    const raw  = data.choices?.[0]?.message?.content?.trim() || '';
    const cap  = raw.match(/CAPTION:\s*([\s\S]*?)(?=HASHTAGS:|$)/i)?.[1]?.trim();
    const hash = raw.match(/HASHTAGS:\s*([\s\S]*?)$/i)?.[1]?.trim();
    return { caption: cap || null, hashtags: hash || null };
  } catch { return { caption: null, hashtags: null }; }
}

// ── IG: post хийнэ ────────────────────────────────────────────────
async function postToIG(imageUrl, caption, hashtags) {
  const cRes = await fetch(`https://graph.facebook.com/v25.0/${IG_ID}/media`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image_url: imageUrl, caption, access_token: META_TOKEN }),
  });
  const cData = await cRes.json();
  if (cData.error || !cData.id) return { ok: false, err: cData.error?.message || 'Container алдаа' };

  await sleep(4000);

  const pRes = await fetch(`https://graph.facebook.com/v25.0/${IG_ID}/media_publish`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ creation_id: cData.id, access_token: META_TOKEN }),
  });
  const pData = await pRes.json();
  if (pData.error) return { ok: false, err: pData.error.message };

  // Hashtag → first comment
  if (hashtags && pData.id) {
    await sleep(2000);
    await fetch(`https://graph.facebook.com/v25.0/${pData.id}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: hashtags, access_token: META_TOKEN }),
    });
  }
  return { ok: true, postId: pData.id };
}

// ── APPROVAL FLOW ─────────────────────────────────────────────────
async function runFlow(photoUrl, userCaption) {
  // 1. Caption шийдэх
  let caption, hashtags;

  if (userCaption) {
    // Хэрэглэгч caption явуулсан бол AI-аар сайжруулна
    const gen = await generateCaption(userCaption);
    caption  = gen.caption  || userCaption;
    hashtags = gen.hashtags || '#LFSShanghai #Shanghai #Шанхай';
  } else {
    // Caption байхгүй бол сонголт өгнө
    const choiceRes = await tgMsg('📸 Зураг хүлээн авлаа!\n\nCaption яаж хийх вэ?', {
      reply_markup: {
        inline_keyboard: [[
          { text: '🤖 AI үүсгэх',      callback_data: 'ai_caption'  },
          { text: '✏️ Өөрөө бичих',    callback_data: 'manual_cap'  },
          { text: '❌ Цуцлах',          callback_data: 'cancel'      },
        ]],
      },
    });
    const choiceMsgId = choiceRes.result?.message_id;

    // Wait for choice (5 min)
    const deadline = Date.now() + 5 * 60 * 1000;
    let offset = 0;
    let chosen = null;

    while (Date.now() < deadline && !chosen) {
      const r = await fetch(`https://api.telegram.org/bot${TG_TOKEN}/getUpdates?offset=${offset}&timeout=5`);
      const d = await r.json();
      for (const upd of (d.result || [])) {
        offset = upd.update_id + 1;
        const cb = upd.callback_query;
        if (cb?.message?.message_id === choiceMsgId) {
          await tg('answerCallbackQuery', { callback_query_id: cb.id });
          chosen = cb.data;
        }
      }
      if (!chosen) await sleep(2000);
    }

    if (!chosen || chosen === 'cancel') {
      await tgMsg('❌ Цуцлагдлаа.');
      return;
    }

    if (chosen === 'ai_caption') {
      await tgMsg('🤖 Caption үүсгэж байна...');
      const gen = await generateCaption();
      caption  = gen.caption  || 'LFS Shanghai 🌆';
      hashtags = gen.hashtags || '#LFSShanghai #Shanghai';
    }

    if (chosen === 'manual_cap') {
      const askRes = await tgMsg('✏️ Caption-г энд reply хийж бичнэ үү:', {
        reply_markup: { force_reply: true, selective: false },
      });
      const askMsgId = askRes.result?.message_id;

      // Wait for text (10 min)
      const d2 = Date.now() + 10 * 60 * 1000;
      let textReceived = null;
      while (Date.now() < d2 && !textReceived) {
        const r = await fetch(`https://api.telegram.org/bot${TG_TOKEN}/getUpdates?offset=${offset}&timeout=5`);
        const d = await r.json();
        for (const upd of (d.result || [])) {
          offset = upd.update_id + 1;
          if (upd.message?.reply_to_message?.message_id === askMsgId && upd.message?.text) {
            textReceived = upd.message.text;
          }
        }
        if (!textReceived) await sleep(2000);
      }

      if (!textReceived) { await tgMsg('⏰ Хугацаа дууслаа.'); return; }
      const gen = await generateCaption(textReceived);
      caption  = gen.caption  || textReceived;
      hashtags = gen.hashtags || '#LFSShanghai #Shanghai';
    }
  }

  // 2. Preview draft
  await tgMsg(
    `📋 *Draft preview:*\n\n${caption}\n\n_Hashtag: first comment-д орно_`,
    {
      reply_markup: {
        inline_keyboard: [[
          { text: '✅ Post хийх', callback_data: 'post_now' },
          { text: '❌ Цуцлах',   callback_data: 'cancel'   },
        ]],
      },
    }
  );

  // Wait for final approve (5 min)
  const d3 = Date.now() + 5 * 60 * 1000;
  let offset2 = 0;
  let approved = null;
  while (Date.now() < d3 && !approved) {
    const r = await fetch(`https://api.telegram.org/bot${TG_TOKEN}/getUpdates?offset=${offset2}&timeout=5`);
    const d = await r.json();
    for (const upd of (d.result || [])) {
      offset2 = upd.update_id + 1;
      const cb = upd.callback_query;
      if (cb?.data === 'post_now' || cb?.data === 'cancel') {
        await tg('answerCallbackQuery', { callback_query_id: cb.id });
        approved = cb.data;
      }
    }
    if (!approved) await sleep(2000);
  }

  if (approved !== 'post_now') { await tgMsg('❌ Цуцлагдлаа.'); return; }

  // 3. Post to IG
  await tgMsg('⏳ Instagram-д нийтэлж байна...');
  const r = await postToIG(photoUrl, caption, hashtags);
  if (r.ok) {
    await tgMsg(`✅ Нийтлэгдлээ!\n🆔 Post ID: \`${r.postId}\``);
  } else {
    await tgMsg(`❌ Алдаа: \`${r.err}\``);
  }
}

// ── MAIN ──────────────────────────────────────────────────────────
async function main() {
  console.log('[ManualPoster] Checking Telegram...');

  const lastOffset = await getLastOffset();
  let offset = lastOffset;

  const res  = await fetch(`https://api.telegram.org/bot${TG_TOKEN}/getUpdates?offset=${offset}&limit=20`);
  const data = await res.json();
  const updates = data.result || [];

  if (updates.length === 0) {
    console.log('[ManualPoster] No new messages.');
    return;
  }

  // Save latest offset immediately
  const newOffset = updates[updates.length - 1].update_id + 1;
  await saveOffset(newOffset);

  // Find photo messages from our chat
  for (const upd of updates) {
    const msg = upd.message;
    if (!msg) continue;
    if (String(msg.chat?.id) !== String(TG_CHAT)) continue;
    if (!msg.photo) continue;

    // Telegram-н хамгийн өндөр нарийвчлалтай зургийг авна
    const photos  = msg.photo;
    const bestPhoto = photos[photos.length - 1];
    const fileId  = bestPhoto.file_id;
    const photoUrl = await getPhotoUrl(fileId);

    if (!photoUrl) {
      await tgMsg('⚠️ Зургийн URL авах боломжгүй байна.');
      continue;
    }

    const userCaption = msg.caption || '';
    console.log(`[ManualPoster] Photo detected. Caption: "${userCaption}"`);

    await runFlow(photoUrl, userCaption);
  }

  console.log('[ManualPoster] Done.');
}

main().catch(e => {
  console.error('[ManualPoster] Fatal:', e.message);
  process.exit(1);
});
