'use strict';
// ── JARVIS TELEGRAM WEBHOOK ───────────────────────────────────────
// Vercel serverless — instant responses
// Handles: chat commands, approval callbacks, manual photo posting

const admin = require('firebase-admin');
const fetch  = require('node-fetch');

// Firebase singleton
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)),
  });
}
const db = admin.firestore();

const TG_TOKEN    = process.env.TELEGRAM_BOT_TOKEN_JARVIS;
const TG_CHAT     = process.env.TELEGRAM_ID;
const META_TOKEN  = process.env.ACCESS_TOKEN_META;
const IG_ID       = process.env.INSTAGRAM_BUSINESS_ID;
const FB_ID       = process.env.FACEBOOK_PAGE_ID;
const UID         = process.env.USER_UID;
const GH_TOKEN    = process.env.SYSTEM_USE_TOKEN;
const PEXELS_KEY  = process.env.PEXELS_API_KEY;
const UNSPLASH_KEY = process.env.UNSPLASH_ACCESS_KEY;

// ── TELEGRAM HELPERS ──────────────────────────────────────────────
async function tgCall(method, body) {
  const r = await fetch(`https://api.telegram.org/bot${TG_TOKEN}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return r.json();
}
const tgSend   = (text, extra = {}) =>
  tgCall('sendMessage', { chat_id: TG_CHAT, text, parse_mode: 'Markdown', ...extra });
const tgAnswer = (id, text = '') =>
  tgCall('answerCallbackQuery', { callback_query_id: id, text });
const tgEdit   = (msgId, caption) =>
  tgCall('editMessageCaption', { chat_id: TG_CHAT, message_id: msgId, caption, parse_mode: 'Markdown' });

// ── FIRESTORE REFS ────────────────────────────────────────────────
const pendingRef = () => db.doc(`users/${UID}/marketing/pendingPost`);
const manualRef  = () => db.doc(`users/${UID}/marketing/manualState`);

// ── META PUBLISH ──────────────────────────────────────────────────
async function publishToMeta(caption, imageUrl) {
  try {
    const igRes  = await fetch(
      `https://graph.facebook.com/v25.0/${IG_ID}/media?image_url=${encodeURIComponent(imageUrl)}&caption=${encodeURIComponent(caption)}&access_token=${META_TOKEN}`,
      { method: 'POST' }
    );
    const igData = await igRes.json();

    if (igData.id) {
      await fetch(
        `https://graph.facebook.com/v25.0/${IG_ID}/media_publish?creation_id=${igData.id}&access_token=${META_TOKEN}`,
        { method: 'POST' }
      );
    }

    const fbRes  = await fetch(
      `https://graph.facebook.com/v25.0/${FB_ID}/photos?url=${encodeURIComponent(imageUrl)}&message=${encodeURIComponent(caption)}&access_token=${META_TOKEN}`,
      { method: 'POST' }
    );
    const fbData = await fbRes.json();

    const igMsg = igData.id    ? '✅ Instagram нийтлэгдлээ!'              : '❌ Instagram алдаа';
    const fbMsg = !fbData.error ? '✅ Facebook нийтлэгдлээ!'              : `❌ FB: ${fbData.error?.message}`;
    await tgSend(`${igMsg}\n${fbMsg}`);
    return true;
  } catch (e) {
    await tgSend(`❌ Meta алдаа: ${e.message}`);
    return false;
  }
}

async function postToIG(imageUrl, caption, hashtags) {
  const cRes  = await fetch(`https://graph.facebook.com/v25.0/${IG_ID}/media`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image_url: imageUrl, caption, access_token: META_TOKEN }),
  });
  const cData = await cRes.json();
  if (!cData.id) return { ok: false, err: cData.error?.message || 'Container алдаа' };

  await new Promise(r => setTimeout(r, 3000));

  const pRes  = await fetch(`https://graph.facebook.com/v25.0/${IG_ID}/media_publish`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ creation_id: cData.id, access_token: META_TOKEN }),
  });
  const pData = await pRes.json();
  if (pData.error) return { ok: false, err: pData.error.message };

  if (hashtags && pData.id) {
    await new Promise(r => setTimeout(r, 1500));
    await fetch(`https://graph.facebook.com/v25.0/${pData.id}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: hashtags, access_token: META_TOKEN }),
    });
  }
  return { ok: true, postId: pData.id };
}

// ── IMAGE FETCH ───────────────────────────────────────────────────
async function fetchNewImage(query = 'shanghai') {
  try {
    if (PEXELS_KEY) {
      const r = await fetch(
        `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=5`,
        { headers: { Authorization: PEXELS_KEY } }
      );
      const d = await r.json();
      if (d.photos?.length) return d.photos[Math.floor(Math.random() * d.photos.length)].src.large2x;
    }
    if (UNSPLASH_KEY) {
      const r = await fetch(
        `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=5`,
        { headers: { Authorization: `Client-ID ${UNSPLASH_KEY}` } }
      );
      const d = await r.json();
      if (d.results?.length) return d.results[0].urls.regular;
    }
  } catch {}
  return 'https://images.unsplash.com/photo-1481627834876-b7833e8f5570';
}

// ── ROUTINE HELPERS ───────────────────────────────────────────────
const todaySH = () => new Date().toLocaleDateString('sv', { timeZone: 'Asia/Shanghai' });

async function getScore() {
  const d = todaySH();
  const [r, l] = await Promise.all([
    db.doc(`users/${UID}/routines/${d}`).get(),
    db.doc(`users/${UID}/logs/${d}`).get(),
  ]);
  const rt    = r.exists ? r.data() : {};
  const water = l.exists ? (l.data().water?.total_ml || 0) : 0;
  const done  = ['exercise','hanzi','read','journal'].filter(k => rt[k]).length;
  const score = Math.min(100, Math.round(
    (water/2000*25) + (rt.exercise?20:0) + (rt.hanzi?20:0) + (rt.read?15:0) + (rt.journal?10:0)
  ));
  return { score, done, water, routine: rt };
}

async function getStreak(key) {
  let s = 0;
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Shanghai' }));
  for (let i = 0; i < 30; i++) {
    const d = new Date(now); d.setDate(d.getDate() - i);
    const ds = d.toLocaleDateString('sv');
    const snap = await db.doc(`users/${UID}/routines/${ds}`).get();
    if (!snap.exists || !snap.data()[key]) break;
    s++;
  }
  return s;
}

async function logRoutine(key) {
  await db.doc(`users/${UID}/routines/${todaySH()}`).set(
    { [key]: true, updatedAt: new Date().toISOString() }, { merge: true }
  );
}

async function logWater(ml) {
  const d    = todaySH();
  const snap = await db.doc(`users/${UID}/logs/${d}`).get();
  const cur  = snap.exists ? (snap.data().water?.total_ml || 0) : 0;
  const total = cur + ml;
  await db.doc(`users/${UID}/logs/${d}`).set({ water: { total_ml: total } }, { merge: true });
  return total;
}

// ── GPT CAPTION ───────────────────────────────────────────────────
async function generateCaption(hint = '') {
  const prompt = hint
    ? `LFS Shanghai IG post. "${hint}" тухай 2-3 өгүүлбэр Монголоор, emoji, "👉 bileg11.github.io" нэмж бич. Дараа нь 10 hashtag зайгаар. Формат: CAPTION: ... HASHTAGS: ...`
    : `LFS Shanghai Шанхай аялал тухай 2-3 өгүүлбэр Монголоор, emoji, "👉 bileg11.github.io". Дараа нь 10 hashtag. Формат: CAPTION: ... HASHTAGS: ...`;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25000); // 25s timeout
    const r = await fetch('https://models.inference.ai.azure.com/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${GH_TOKEN}` },
      body: JSON.stringify({ model: 'gpt-4o-mini', messages: [{ role: 'user', content: prompt }], max_tokens: 280, temperature: 0.85 }),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    const d   = await r.json();
    const raw = d.choices?.[0]?.message?.content || '';
    return {
      caption:  raw.match(/CAPTION:\s*([\s\S]*?)(?=HASHTAGS:|$)/i)?.[1]?.trim() || null,
      hashtags: raw.match(/HASHTAGS:\s*([\s\S]*?)$/i)?.[1]?.trim() || null,
    };
  } catch (e) {
    console.error('[GPT] Error:', e.message);
    return { caption: null, hashtags: null };
  }
}

// ══════════════════════════════════════════════════════════════════
// CALLBACK QUERY HANDLER
// ══════════════════════════════════════════════════════════════════
async function handleCallback(cb) {
  const { data: cmd, message, id: cbId } = cb;
  const msgId = message.message_id;
  console.log('[Callback] cmd:', cmd);
  await tgAnswer(cbId);

  // ── Ghost post approval ───────────────────────────────────────
  const pSnap = await pendingRef().get();
  if (pSnap.exists) {
    const post = pSnap.data();
    if (msgId == post.telegramMsgId) {

      if (cmd === 'approve') {
        await tgSend('⏳ Нийтэлж байна...');
        const ok = await publishToMeta(post.caption, post.imageUrl);
        if (ok) {
          await tgEdit(msgId, `✅ *Нийтлэгдлээ!*\n\n${post.caption}`);
          await pendingRef().delete();
        }
        return;
      }

      if (cmd === 'reject') {
        await tgEdit(msgId, '❌ *Цуцлагдлаа.*');
        await pendingRef().delete();
        return;
      }

      if (cmd === 'new_image') {
        const newImg = await fetchNewImage(post.topic || 'shanghai');
        const r = await tgCall('sendPhoto', {
          chat_id: TG_CHAT, photo: newImg,
          caption: `🤖 *Шинэ зураг:*\n\n${post.caption}`, parse_mode: 'Markdown',
          reply_markup: { inline_keyboard: [
            [{ text: '✅ Approve', callback_data: 'approve' },  { text: '❌ Reject',    callback_data: 'reject' }],
            [{ text: '🖼 New Image', callback_data: 'new_image' }, { text: '✏️ Edit Text', callback_data: 'edit_text' }],
          ]},
        });
        await pendingRef().update({ imageUrl: newImg, telegramMsgId: r.result?.message_id, createdAt: new Date().toISOString() });
        return;
      }

      if (cmd === 'edit_text') {
        await tgSend('✏️ Шинэ текстаа бичнэ үү:');
        await pendingRef().update({ waitingForText: true });
        return;
      }
    }
  }

  // ── Manual poster callbacks ───────────────────────────────────
  const mSnap = await manualRef().get();
  if (!mSnap.exists) return;
  const ms = mSnap.data();

  // Caption сонголт
  if (ms.status === 'waiting_choice') {
    if (cmd === 'ai_caption') {
      await tgSend('🤖 Caption үүсгэж байна...');
      console.log('[GPT] Calling generateCaption, GH_TOKEN prefix:', GH_TOKEN?.slice(0,5));
      const gen      = await generateCaption();
      console.log('[GPT] Result:', JSON.stringify(gen));
      const caption  = gen.caption  || 'LFS Shanghai 🌆\n👉 bileg11.github.io';
      const hashtags = gen.hashtags || '#LFSShanghai #Shanghai';
      const draft    = await tgCall('sendPhoto', {
        chat_id: TG_CHAT, photo: ms.fileId || ms.photoUrl,
        caption: `📋 *Draft:*\n\n${caption}`, parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: [[
          { text: '✅ Post хийх', callback_data: 'manual_post' },
          { text: '❌ Цуцлах',   callback_data: 'manual_cancel' },
        ]]},
      });
      console.log('[Draft] sendPhoto result:', JSON.stringify(draft).slice(0, 100));
      await manualRef().set({ status: 'waiting_final', photoUrl: ms.photoUrl, fileId: ms.fileId, caption, hashtags, draftMsgId: draft.result?.message_id || null });
      return;
    }
    if (cmd === 'manual_cap') {
      await tgSend('✏️ Caption бичнэ үү:');
      await manualRef().update({ status: 'waiting_text' });
      return;
    }
    if (cmd === 'cancel') {
      await tgSend('❌ Цуцлагдлаа.'); await manualRef().delete(); return;
    }
  }

  // Final approve
  if (ms.status === 'waiting_final') {
    if (cmd === 'manual_post') {
      await tgSend('⏳ IG + FB-д нийтэлж байна...');
      console.log('[Post] Starting IG post, photoUrl:', ms.photoUrl?.slice(0,60));
      const igResult = await postToIG(ms.photoUrl, ms.caption, ms.hashtags);
      console.log('[Post] IG result:', JSON.stringify(igResult));

      // FB post — 15s timeout
      let fbMsg = '';
      try {
        const fbCtrl = new AbortController();
        const fbTimeout = setTimeout(() => fbCtrl.abort(), 15000);
        // Page Access Token авна
        const ptRes  = await fetch(`https://graph.facebook.com/v25.0/${FB_ID}?fields=access_token&access_token=${META_TOKEN}`);
        const ptData = await ptRes.json();
        const pageToken = ptData.access_token || META_TOKEN;

        const fbRes  = await fetch(
          `https://graph.facebook.com/v25.0/${FB_ID}/photos`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: ms.photoUrl, message: ms.caption, access_token: pageToken }),
            signal: fbCtrl.signal,
          }
        );
        clearTimeout(fbTimeout);
        const fbData = await fbRes.json();
        console.log('[Post] FB result:', JSON.stringify(fbData).slice(0,150));
        fbMsg = !fbData.error ? '✅ FB нийтлэгдлээ!' : `❌ FB: ${fbData.error?.message}`;
      } catch (e) {
        fbMsg = `❌ FB алдаа: ${e.message}`;
        console.log('[Post] FB error:', e.message);
      }

      // Telegram-д үр дүн явуулна
      if (igResult.ok) {
        await tgSend(`✅ *IG нийтлэгдлээ!*\n${fbMsg}`);
      } else {
        await tgSend(`❌ IG алдаа: ${igResult.err}\n${fbMsg}`);
      }
      await manualRef().delete();
      return;
    }
    if (cmd === 'manual_cancel') {
      await tgSend('❌ Цуцлагдлаа.'); await manualRef().delete(); return;
    }
  }
}

// ══════════════════════════════════════════════════════════════════
// PHOTO HANDLER
// ══════════════════════════════════════════════════════════════════
async function handlePhoto(msg) {
  const fileId = msg.photo[msg.photo.length - 1].file_id;
  const fRes   = await fetch(`https://api.telegram.org/bot${TG_TOKEN}/getFile?file_id=${fileId}`);
  const fData  = await fRes.json();
  const photoUrl = `https://api.telegram.org/file/bot${TG_TOKEN}/${fData.result?.file_path}`;

  const userCaption = msg.caption || '';

  if (userCaption) {
    await tgSend('🤖 Caption бэлдэж байна...');
    const gen      = await generateCaption(userCaption);
    const caption  = gen.caption  || userCaption;
    const hashtags = gen.hashtags || '#LFSShanghai #Shanghai';
    const draft    = await tgCall('sendPhoto', {
      chat_id: TG_CHAT, photo: fileId,  // file_id ашиглана
      caption: `📋 *Draft:*\n\n${caption}`, parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: [[
        { text: '✅ Post хийх', callback_data: 'manual_post' },
        { text: '❌ Цуцлах',   callback_data: 'manual_cancel' },
      ]]},
    });
    await manualRef().set({ status: 'waiting_final', photoUrl, fileId, caption, hashtags, draftMsgId: draft.result?.message_id || null });
  } else {
    const choice = await tgCall('sendMessage', {
      chat_id: TG_CHAT,
      text: '📸 Зураг хүлээн авлаа! Caption яаж хийх вэ?',
      reply_markup: { inline_keyboard: [[
        { text: '🤖 AI үүсгэх',   callback_data: 'ai_caption' },
        { text: '✏️ Өөрөө бичих', callback_data: 'manual_cap' },
        { text: '❌ Цуцлах',       callback_data: 'cancel'     },
      ]]},
    });
    await manualRef().set({ status: 'waiting_choice', photoUrl, fileId, choiceMsgId: choice.result?.message_id });
  }
}

// ══════════════════════════════════════════════════════════════════
// TEXT HANDLER
// ══════════════════════════════════════════════════════════════════
async function handleText(msg) {
  const raw  = msg.text || '';
  const text = raw.toLowerCase().trim();

  // Pending post: edit_text state
  const pSnap = await pendingRef().get();
  if (pSnap.exists && pSnap.data().waitingForText && !raw.startsWith('/')) {
    const post    = pSnap.data();
    const r       = await tgCall('sendPhoto', {
      chat_id: TG_CHAT, photo: post.imageUrl,
      caption: `🤖 *JARVIS Draft:*\n\n${raw}`, parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: [
        [{ text: '✅ Approve', callback_data: 'approve' }, { text: '❌ Reject',    callback_data: 'reject' }],
        [{ text: '🖼 New Image', callback_data: 'new_image' }, { text: '✏️ Edit Text', callback_data: 'edit_text' }],
      ]},
    });
    await pendingRef().update({ caption: raw, telegramMsgId: r.result?.message_id, waitingForText: false, createdAt: new Date().toISOString() });
    return;
  }

  // Manual poster: waiting_text state
  const mSnap = await manualRef().get();
  if (mSnap.exists && mSnap.data().status === 'waiting_text' && !raw.startsWith('/')) {
    const ms       = mSnap.data();
    const gen      = await generateCaption(raw);
    const caption  = gen.caption  || raw;
    const hashtags = gen.hashtags || '#LFSShanghai #Shanghai';
    const draft    = await tgCall('sendPhoto', {
      chat_id: TG_CHAT, photo: ms.photoUrl,
      caption: `📋 *Draft:*\n\n${caption}`, parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: [[
        { text: '✅ Post хийх', callback_data: 'manual_post' },
        { text: '❌ Цуцлах',   callback_data: 'manual_cancel' },
      ]]},
    });
    await manualRef().set({ status: 'waiting_final', photoUrl: ms.photoUrl, caption, hashtags, draftMsgId: draft.result?.message_id });
    return;
  }

  // ── Commands ──────────────────────────────────────────────────
  if (text === '/score' || text === 'score') {
    const { score, done, water, routine } = await getScore();
    const [exS, hzS] = await Promise.all([getStreak('exercise'), getStreak('hanzi')]);
    await tgSend(
      `📊 *Өнөөдрийн Score: ${score}/100*\n\n` +
      `${routine.exercise?'✅':'❌'} Дасгал (${exS}🔥)\n` +
      `${routine.hanzi   ?'✅':'❌'} 汉字 (${hzS}🔥)\n` +
      `${routine.read    ?'✅':'❌'} Унших\n` +
      `${routine.journal ?'✅':'❌'} Journal\n` +
      `💧 Ус: ${water}мл/2000мл`
    );
    return;
  }

  if (text === '/dasgal' || text.includes('дасгал') || text.includes('workout')) {
    await logRoutine('exercise');
    const { score } = await getScore();
    const s = await getStreak('exercise');
    await tgSend(`💪 Дасгал тэмдэглэлээ! ${s} хоног дараалал 🔥\nScore: ${score}/100`);
    return;
  }

  if (text === '/hanzi' || text.includes('汉字') || text.includes('hanzi')) {
    await logRoutine('hanzi');
    const { score } = await getScore();
    const s = await getStreak('hanzi');
    await tgSend(`🈶 汉字 тэмдэглэлээ! ${s} хоног дараалал 🔥\nScore: ${score}/100`);
    return;
  }

  if (text === '/nom' || text.includes('уншлаа') || text.includes('ном уншсан')) {
    await logRoutine('read');
    const { score } = await getScore();
    await tgSend(`📚 Уншилт тэмдэглэлээ! Score: ${score}/100`);
    return;
  }

  if (text === '/journal' || text.includes('journal')) {
    await logRoutine('journal');
    const { score } = await getScore();
    await tgSend(`📝 Journal тэмдэглэлээ! Score: ${score}/100`);
    return;
  }

  const waterMatch = raw.match(/(\d+)\s*(мл|ml)/i);
  if (text === '/us' || waterMatch) {
    const ml    = waterMatch ? parseInt(waterMatch[1]) : 250;
    const total = await logWater(ml);
    await tgSend(`💧 +${ml}мл! Нийт: ${total}мл/2000мл (${Math.round(total/20)}%) ${total >= 2000 ? '🎉' : ''}`);
    return;
  }

  if (text === '/week' || text === 'week') {
    const qSnap = await db.doc(`users/${UID}/marketing/weeklyQueue`).get();
    if (!qSnap.exists) { await tgSend('📅 Долоо хоногийн план байхгүй байна.'); return; }
    const q   = qSnap.data();
    const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Shanghai' }));
    const DAYS = ['Ня','Да','Мя','Лх','Пү','Ба','Бя'];
    let msg = '📅 *Долоо хоногийн Post Хуваарь*\n\n';
    for (let i = 0; i < 7; i++) {
      const d = new Date(now); d.setDate(d.getDate() + i);
      const ds = d.toLocaleDateString('sv');
      const m  = q[`${ds}-morning`];
      const e  = q[`${ds}-evening`];
      if (m || e) {
        msg += `*${DAYS[d.getDay()]}* ${ds}\n`;
        if (m) msg += `  🌅 ${(m.topic||'').slice(0,45)}\n`;
        if (e) msg += `  🌆 ${(e.topic||'').slice(0,45)}\n`;
      }
    }
    await tgSend(msg);
    return;
  }

  if (text === '/help' || text === 'help') {
    await tgSend(
      `🤖 *JARVIS Commands*\n\n` +
      `/score — Өнөөдрийн score + streak\n` +
      `/dasgal — Дасгал хийлээ ✅\n` +
      `/hanzi — 汉字 судалсан ✅\n` +
      `/nom — Ном уншсан ✅\n` +
      `/journal — Journal бичсэн ✅\n` +
      `/us 500 — 500мл ус 💧\n` +
      `/week — Долоо хоногийн post план\n\n` +
      `_Зураг явуулахад → IG post_`
    );
    return;
  }
}

// ══════════════════════════════════════════════════════════════════
// VERCEL HANDLER
// ══════════════════════════════════════════════════════════════════
module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(200).send('JARVIS webhook OK');

  // Telegram-д ШУУД хариулна — retry хийхгүй
  res.status(200).json({ ok: true });

  try {
    const upd = req.body;
    if (!upd || !UID) return;

    if (upd.callback_query) {
      await handleCallback(upd.callback_query);
    } else if (upd.message?.photo && String(upd.message.chat.id) === String(TG_CHAT)) {
      await handlePhoto(upd.message);
    } else if (upd.message?.text && String(upd.message.chat.id) === String(TG_CHAT)) {
      await handleText(upd.message);
    }
  } catch (e) {
    console.error('[Webhook] Error:', e.message);
  }

};
