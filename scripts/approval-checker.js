// ── JARVIS APPROVAL CHECKER ───────────────────────────────────────
// 2 минут тутамд ажиллаж Telegram callback шалгана
// Approve → IG+FB post / Reject → цуцлах / Expire → auto-post

const admin = require('firebase-admin');
const fetch = require('node-fetch');

if (!admin.apps.length) {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}
const db = admin.firestore();

const TG_TOKEN      = process.env.TELEGRAM_BOT_TOKEN_JARVIS;
const TG_CHAT_ID    = process.env.TELEGRAM_ID;
const META_TOKEN    = process.env.ACCESS_TOKEN_META;
const FB_PAGE_ID    = process.env.FACEBOOK_PAGE_ID || process.env.FACEBOOK_ID;
const IG_BUSINESS_ID = process.env.INSTAGRAM_BUSINESS_ID;
const PEXELS_KEY    = process.env.PEXELS_API_KEY;
const UNSPLASH_KEY  = process.env.UNSPLASH_ACCESS_KEY;
const USER_UID      = process.env.USER_UID;

const pendingRef = db.doc(`users/${USER_UID}/marketing/pendingPost`);
const configRef  = db.doc(`users/${USER_UID}/meta/settings`);

// ── TELEGRAM HELPERS ──────────────────────────────────────────────
async function tgSend(method, body) {
  const res = await fetch(`https://api.telegram.org/bot${TG_TOKEN}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.json();
}

async function tgMsg(text) {
  return tgSend('sendMessage', { chat_id: TG_CHAT_ID, text, parse_mode: 'Markdown' });
}

// ── DRAFT TELEGRAM ────────────────────────────────────────────────
async function sendTelegramDraft(caption, imageUrl) {
  const res = await tgSend('sendPhoto', {
    chat_id:    TG_CHAT_ID,
    photo:      imageUrl,
    caption:    `🤖 *Jarvis Draft Post:*\n\n${caption}`,
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [{ text: '✅ Approve', callback_data: 'approve' }, { text: '❌ Reject', callback_data: 'reject' }],
        [{ text: '🖼 New Image', callback_data: 'new_image' }, { text: '✏️ Edit Text', callback_data: 'edit_text' }],
      ],
    },
  });
  return res.result?.message_id;
}

// ── NEW IMAGE ─────────────────────────────────────────────────────
async function fetchNewImage(query) {
  try {
    const useUnsplash = Math.random() > 0.5;
    if (useUnsplash && UNSPLASH_KEY) {
      const res  = await fetch(`https://api.unsplash.com/search/photos?query=${query}&client_id=${UNSPLASH_KEY}`);
      const data = await res.json();
      if (data.results?.length > 0) return data.results[0].urls.regular;
    }
    if (PEXELS_KEY) {
      const res  = await fetch(`https://api.pexels.com/v1/search?query=${query}&per_page=1`, { headers: { Authorization: PEXELS_KEY } });
      const data = await res.json();
      if (data.photos?.length > 0) return data.photos[0].src.large2x;
    }
  } catch (e) {
    console.error('Зураг татахад алдаа:', e.message);
  }
  return 'https://images.unsplash.com/photo-1481627834876-b7833e8f5570';
}

// ── PUBLISH TO META ───────────────────────────────────────────────
async function publishToMeta(caption, imageUrl) {
  try {
    // 1. Instagram container
    const igRes  = await fetch(`https://graph.facebook.com/v25.0/${IG_BUSINESS_ID}/media?image_url=${encodeURIComponent(imageUrl)}&caption=${encodeURIComponent(caption)}&access_token=${META_TOKEN}`, { method: 'POST' });
    const igData = await igRes.json();

    if (igData.id) {
      // 2. Instagram publish
      await fetch(`https://graph.facebook.com/v25.0/${IG_BUSINESS_ID}/media_publish?creation_id=${igData.id}&access_token=${META_TOKEN}`, { method: 'POST' });
    } else {
      await tgMsg(`❌ Instagram алдаа: ${igData.error?.message || 'Container үүсгэж чадсангүй'}`);
      return false;
    }

    // 3. Facebook Page
    const fbRes  = await fetch(`https://graph.facebook.com/v25.0/${FB_PAGE_ID}/photos?url=${encodeURIComponent(imageUrl)}&message=${encodeURIComponent(caption)}&access_token=${META_TOKEN}`, { method: 'POST' });
    const fbData = await fbRes.json();

    // ✅ FIX 2: Telegram-д үр дүн мэдэгдэнэ
    const igMsg = igData.id  ? '✅ Instagram нийтлэгдлээ!'        : '❌ Instagram алдаа';
    const fbMsg = !fbData.error ? '✅ Facebook нийтлэгдлээ!'      : `❌ Facebook алдаа: ${fbData.error?.message}`;
    await tgMsg(`${igMsg}\n${fbMsg}`);

    return true;
  } catch (error) {
    console.error('Meta API алдаа:', error);
    await tgMsg(`❌ Meta API алдаа: ${error.message}`);
    return false;
  }
}

// ── MAIN ──────────────────────────────────────────────────────────
async function run() {
  const pendingSnap = await pendingRef.get();
  if (!pendingSnap.exists) {
    console.log('[1] Pending post байхгүй байна.');
    return;
  }

  const postData    = pendingSnap.data();
  const diffMinutes = (Date.now() - new Date(postData.createdAt).getTime()) / 60000;

  // [2] 15 мин expire → auto-post
  if (diffMinutes >= 15) {
    console.log('[2] 15 минут өнгөрсөн → автомат post...');
    await tgMsg('⏰ 15 минут дууслаа — автомат нийтэлж байна...');
    const ok = await publishToMeta(postData.caption, postData.imageUrl);
    if (ok) await pendingRef.delete();
    return;
  }

  // [3] Telegram offset авна
  const configSnap = await configRef.get();
  let tgOffset     = configSnap.exists ? (configSnap.data().tgOffset || 0) : 0;

  const tgRes  = await fetch(`https://api.telegram.org/bot${TG_TOKEN}/getUpdates?offset=${tgOffset}`);
  const tgData = await tgRes.json();

  if (!tgData.ok || !tgData.result.length) {
    console.log('[3] Шинэ Telegram команд ирээгүй байна.');
    return;
  }

  let latestOffset = tgOffset;

  for (const update of tgData.result) {
    latestOffset = update.update_id + 1;

    // [4.A] Callback товчлуурууд
    if (update.callback_query) {
      const { data: command, message, id: cbId } = update.callback_query;
      const msgId = message.message_id;

      // answerCallbackQuery — товч "дарагдсан" харагдана
      await tgSend('answerCallbackQuery', { callback_query_id: cbId });

      // ✅ FIX 1: != ашиглана (type mismatch зөвшөөрнө)
      if (msgId != postData.telegramMsgId) continue;

      if (command === 'approve') {
        console.log('✅ Approve дарагдлаа...');
        await tgMsg('⏳ Нийтэлж байна...');
        const ok = await publishToMeta(postData.caption, postData.imageUrl);
        if (ok) {
          await tgSend('editMessageCaption', {
            chat_id: TG_CHAT_ID, message_id: msgId,
            caption: `✅ *Амжилттай нийтлэгдлээ!*\n\n${postData.caption}`,
            parse_mode: 'Markdown',
          });
          await pendingRef.delete();
        }
      }

      else if (command === 'reject') {
        console.log('❌ Reject дарагдлаа...');
        await tgSend('editMessageCaption', {
          chat_id: TG_CHAT_ID, message_id: msgId,
          caption: '❌ *Постыг цуцалсан.*', parse_mode: 'Markdown',
        });
        await pendingRef.delete();
      }

      else if (command === 'new_image') {
        console.log('🖼 Шинэ зураг хайж байна...');
        const newImgUrl = await fetchNewImage(postData.topic || 'shanghai');
        const newMsgId  = await sendTelegramDraft(postData.caption, newImgUrl);
        await pendingRef.update({ imageUrl: newImgUrl, telegramMsgId: newMsgId, createdAt: new Date().toISOString() });
      }

      else if (command === 'edit_text') {
        await tgMsg('✏️ Шинэ текстаа reply хийж бичнэ үү:');
        await pendingRef.update({ waitingForText: true });
      }
    }

    // [4.B] Хэрэглэгчийн шинэ текст
    if (update.message?.text && postData.waitingForText) {
      const newText  = update.message.text;
      console.log(`✏️ Текст засагдлаа: ${newText}`);
      const newMsgId = await sendTelegramDraft(newText, postData.imageUrl);
      await pendingRef.update({
        caption: newText, telegramMsgId: newMsgId,
        waitingForText: false, createdAt: new Date().toISOString(),
      });
    }
  }

  // Offset хадгалах
  await configRef.set({ tgOffset: latestOffset }, { merge: true });
}

run().catch(console.error);
