'use strict';
// ── LFS SHANGHAI TELEGRAM BOT ─────────────────────────────────────
// Зөвхөн LFS бизнесийн зүйлс:
//   /bookings, /income, /revenue, /week
//   IG/FB post workflow (зураг → caption → нийтлэх)
//   Booking confirm/cancel callbacks

const fetch  = require('node-fetch');
const { admin, dbPersonal, dbLFS } = require('../firebase');

const TG_TOKEN   = process.env.TELEGRAM_BOT_TOKEN_LFS;
const TG_CHAT    = process.env.TELEGRAM_ID;
const META_TOKEN = process.env.ACCESS_TOKEN_META;
const IG_ID      = process.env.INSTAGRAM_BUSINESS_ID;
const FB_ID      = process.env.FACEBOOK_PAGE_ID;
const UID        = process.env.USER_UID;
const GH_TOKEN   = process.env.SYSTEM_USE_TOKEN;
const PEXELS_KEY = process.env.PEXELS_API_KEY;
const UNSPLASH_KEY = process.env.UNSPLASH_ACCESS_KEY;

// ── HELPERS ───────────────────────────────────────────────────────
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

const todaySH = () => new Date().toLocaleDateString('sv', { timeZone: 'Asia/Shanghai' });

// Firestore refs
const pendingRef = () => dbLFS.doc(`users/${UID}/marketing/pendingPost`);
const manualRef  = () => dbLFS.doc(`users/${UID}/marketing/manualState`);

// ── META PUBLISH ──────────────────────────────────────────────────
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
  // Сүүлийн post цагийг хадгална
  dbLFS.doc(`users/${UID}/marketing/lastPost`).set({ postedAt: new Date().toISOString() }).catch(() => {});
  return { ok: true, postId: pData.id };
}

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

async function generateCaption(hint = '') {
  const prompt = hint
    ? `LFS Shanghai IG post. "${hint}" тухай 2-3 өгүүлбэр Монголоор, emoji, "👉 bileg11.github.io" нэмж бич. Дараа нь 10 hashtag. Формат: CAPTION: ... HASHTAGS: ...`
    : `LFS Shanghai Шанхай аялал тухай 2-3 өгүүлбэр Монголоор, emoji, "👉 bileg11.github.io" бич. Дараа нь 10 hashtag. Формат: CAPTION: ... HASHTAGS: ...`;
  try {
    const r = await fetch('https://models.inference.ai.azure.com/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${GH_TOKEN}` },
      body: JSON.stringify({ model: 'gpt-4o-mini', messages: [{ role: 'user', content: prompt }], max_tokens: 280, temperature: 0.85 }),
    });
    const d   = await r.json();
    const raw = d.choices?.[0]?.message?.content || '';
    return {
      caption:  raw.match(/CAPTION:\s*([\s\S]*?)(?=HASHTAGS:|$)/i)?.[1]?.trim() || null,
      hashtags: raw.match(/HASHTAGS:\s*([\s\S]*?)$/i)?.[1]?.trim() || null,
    };
  } catch {
    return { caption: null, hashtags: null };
  }
}

// ── CALLBACK HANDLER ──────────────────────────────────────────────
async function handleCallback(cb) {
  const { data: cmd, message, id: cbId } = cb;
  const msgId = message.message_id;
  await tgAnswer(cbId);

  // ── Booking confirm/cancel ─────────────────────────────────────
  if (cmd.startsWith('bkc_') || cmd.startsWith('bkx_')) {
    const isConfirm = cmd.startsWith('bkc_');
    const bookingId = cmd.slice(4);
    const bkRef     = dbLFS.collection(`users/${UID}/bookings`).doc(bookingId);
    const bkSnap    = await bkRef.get();

    if (!bkSnap.exists) {
      await tgCall('sendMessage', { chat_id: TG_CHAT, text: '⚠️ Захиалга олдсонгүй.' });
      return;
    }
    const bk  = bkSnap.data();
    const now = new Date().toISOString();

    if (isConfirm) {
      await bkRef.update({ status: 'confirmed', confirmedAt: now });
      await tgCall('editMessageReplyMarkup', { chat_id: TG_CHAT, message_id: msgId, reply_markup: { inline_keyboard: [] } });
      await tgCall('sendMessage', { chat_id: TG_CHAT, text: `✅ Баталгаажлаа.\n\nНэр: ${bk.name}\nУтас: ${bk.phone}\nҮйлчилгээ: ${bk.service || '—'}\nОгноо: ${bk.start || '—'}` });
    } else {
      await bkRef.update({ status: 'cancelled', cancelledAt: now });
      await tgCall('editMessageReplyMarkup', { chat_id: TG_CHAT, message_id: msgId, reply_markup: { inline_keyboard: [] } });
      await tgCall('sendMessage', { chat_id: TG_CHAT, text: `❌ Цуцлагдлаа.\n\nНэр: ${bk.name} · ${bk.phone}` });
    }
    return;
  }

  // ── Sprint 4: Marketing content queue approve/reject ─────────────
  if (cmd.startsWith('mkq_')) {
    const ideaId = cmd.slice(4);
    try {
      const qRef  = dbLFS.doc(`users/${UID}/marketing/weeklyQueue`);
      const qSnap = await qRef.get();
      const qData = qSnap.exists ? qSnap.data() : {};
      const pendingKey  = `pending_${ideaId}`;
      const approvedKey = `approved_${ideaId}`;
      const ideaData    = qData[pendingKey] || {};

      // approved-д шилжүүлж, pending-г устгах
      await qRef.set({
        [approvedKey]: { ...ideaData, status: 'approved', approvedAt: new Date().toISOString() },
        [pendingKey]:  admin.firestore.FieldValue.delete(),
      }, { merge: true });
    } catch (e) {
      console.error('[Marketing] Approve error:', e.message);
    }
    await tgCall('editMessageReplyMarkup', {
      chat_id: TG_CHAT, message_id: msgId, reply_markup: { inline_keyboard: [] },
    });
    await tgSend('✅ Постын санаа queue-д нэмэгдлээ.');
    await tgAnswer(cbId, 'Queue-д нэмэгдлээ ✅');
    return;
  }

  if (cmd.startsWith('mkx_')) {
    await tgCall('editMessageReplyMarkup', {
      chat_id: TG_CHAT, message_id: msgId, reply_markup: { inline_keyboard: [] },
    });
    await tgAnswer(cbId, 'Орхилоо');
    return;
  }

  // ── Ghost post approval ────────────────────────────────────────
  const pSnap = await pendingRef().get();
  if (pSnap.exists) {
    const post = pSnap.data();
    if (msgId == post.telegramMsgId) {
      if (cmd === 'approve') {
        await tgSend('⏳ Нийтэлж байна...');
        const igResult = await postToIG(post.imageUrl, post.caption, post.hashtags);
        if (igResult.ok) {
          await tgCall('editMessageCaption', { chat_id: TG_CHAT, message_id: msgId, caption: `✅ *Нийтлэгдлээ!*\n\n${post.caption}`, parse_mode: 'Markdown' });
          await pendingRef().delete();
        } else {
          await tgSend(`❌ IG алдаа: ${igResult.err}`);
        }
        return;
      }
      if (cmd === 'reject') {
        await tgCall('editMessageCaption', { chat_id: TG_CHAT, message_id: msgId, caption: '❌ *Цуцлагдлаа.*', parse_mode: 'Markdown' });
        await pendingRef().delete();
        return;
      }
      if (cmd === 'new_image') {
        const newImg = await fetchNewImage(post.topic || 'shanghai');
        const r = await tgCall('sendPhoto', {
          chat_id: TG_CHAT, photo: newImg,
          caption: `🤖 *Шинэ зураг:*\n\n${post.caption}`, parse_mode: 'Markdown',
          reply_markup: { inline_keyboard: [
            [{ text: '✅ Approve', callback_data: 'approve' }, { text: '❌ Reject', callback_data: 'reject' }],
            [{ text: '🖼 New Image', callback_data: 'new_image' }, { text: '✏️ Edit Text', callback_data: 'edit_text' }],
          ]},
        });
        await pendingRef().update({ imageUrl: newImg, telegramMsgId: r.result?.message_id });
        return;
      }
      if (cmd === 'edit_text') {
        await tgSend('✏️ Шинэ текстаа бичнэ үү:');
        await pendingRef().update({ waitingForText: true });
        return;
      }
    }
  }

  // ── Manual poster ──────────────────────────────────────────────
  const mSnap = await manualRef().get();
  if (!mSnap.exists) return;
  const ms = mSnap.data();

  if (ms.status === 'waiting_choice') {
    if (cmd === 'ai_caption') {
      await tgSend('🤖 Caption үүсгэж байна...');
      const gen     = await generateCaption();
      const caption  = gen.caption  || 'LFS Shanghai 🌆\n👉 bileg11.github.io';
      const hashtags = gen.hashtags || '#LFSShanghai #Shanghai';
      const draft = await tgCall('sendPhoto', {
        chat_id: TG_CHAT, photo: ms.fileId || ms.photoUrl,
        caption: `📋 *Draft:*\n\n${caption}`, parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: [[
          { text: '✅ Post хийх', callback_data: 'manual_post' },
          { text: '❌ Цуцлах',   callback_data: 'manual_cancel' },
        ]]},
      });
      await manualRef().set({ status: 'waiting_final', photoUrl: ms.photoUrl, fileId: ms.fileId, caption, hashtags, draftMsgId: draft.result?.message_id });
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

  if (ms.status === 'waiting_final') {
    if (cmd === 'manual_post') {
      await tgSend('⏳ IG + FB-д нийтэлж байна...');
      const igResult = await postToIG(ms.photoUrl, ms.caption, ms.hashtags);

      let fbMsg = '';
      try {
        const ptRes  = await fetch(`https://graph.facebook.com/v25.0/${FB_ID}?fields=access_token&access_token=${META_TOKEN}`);
        const ptData = await ptRes.json();
        const pageToken = ptData.access_token || META_TOKEN;
        const fbRes  = await fetch(`https://graph.facebook.com/v25.0/${FB_ID}/photos`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: ms.photoUrl, message: ms.caption, access_token: pageToken }),
        });
        const fbData = await fbRes.json();
        fbMsg = !fbData.error ? '✅ FB нийтлэгдлээ!' : `❌ FB: ${fbData.error?.message}`;
      } catch (e) { fbMsg = `❌ FB алдаа: ${e.message}`; }

      await tgSend(igResult.ok ? `✅ *IG нийтлэгдлээ!*\n${fbMsg}` : `❌ IG алдаа: ${igResult.err}\n${fbMsg}`);
      await manualRef().delete();
      return;
    }
    if (cmd === 'manual_cancel') {
      await tgSend('❌ Цуцлагдлаа.'); await manualRef().delete(); return;
    }
  }
}

// ── PHOTO HANDLER ─────────────────────────────────────────────────
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
    const draft = await tgCall('sendPhoto', {
      chat_id: TG_CHAT, photo: fileId,
      caption: `📋 *Draft:*\n\n${caption}`, parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: [[
        { text: '✅ Post хийх', callback_data: 'manual_post' },
        { text: '❌ Цуцлах',   callback_data: 'manual_cancel' },
      ]]},
    });
    await manualRef().set({ status: 'waiting_final', photoUrl, fileId, caption, hashtags, draftMsgId: draft.result?.message_id });
  } else {
    await tgCall('sendMessage', {
      chat_id: TG_CHAT,
      text: '📸 Зураг хүлээн авлаа! Caption яаж хийх вэ?',
      reply_markup: { inline_keyboard: [[
        { text: '🤖 AI үүсгэх',   callback_data: 'ai_caption' },
        { text: '✏️ Өөрөө бичих', callback_data: 'manual_cap' },
        { text: '❌ Цуцлах',       callback_data: 'cancel'     },
      ]]},
    });
    await manualRef().set({ status: 'waiting_choice', photoUrl, fileId });
  }
}

// ── TEXT HANDLER ──────────────────────────────────────────────────
async function handleText(msg) {
  const raw  = msg.text || '';
  const text = raw.toLowerCase().trim();

  // Pending post: edit_text state
  const pSnap = await pendingRef().get();
  if (pSnap.exists && pSnap.data().waitingForText && !raw.startsWith('/')) {
    const post = pSnap.data();
    const r    = await tgCall('sendPhoto', {
      chat_id: TG_CHAT, photo: post.imageUrl,
      caption: `🤖 *Draft:*\n\n${raw}`, parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: [
        [{ text: '✅ Approve', callback_data: 'approve' }, { text: '❌ Reject', callback_data: 'reject' }],
        [{ text: '🖼 New Image', callback_data: 'new_image' }, { text: '✏️ Edit Text', callback_data: 'edit_text' }],
      ]},
    });
    await pendingRef().update({ caption: raw, telegramMsgId: r.result?.message_id, waitingForText: false });
    return;
  }

  // Manual: waiting_text state
  const mSnap = await manualRef().get();
  if (mSnap.exists && mSnap.data().status === 'waiting_text' && !raw.startsWith('/')) {
    const ms       = mSnap.data();
    const gen      = await generateCaption(raw);
    const caption  = gen.caption  || raw;
    const hashtags = gen.hashtags || '#LFSShanghai #Shanghai';
    const draft = await tgCall('sendPhoto', {
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

  // ── /bookings ────────────────────────────────────────────────────
  if (text === '/bookings') {
    const snap = await dbLFS.collection(`users/${UID}/bookings`)
      .where('status', '==', 'pending').get().catch(() => ({ docs: [] }));

    const bookings = snap.docs
      .map(d => d.data())
      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
      .slice(0, 8);

    if (!bookings.length) {
      await tgCall('sendMessage', { chat_id: TG_CHAT, text: '📋 Хүлээгдэж буй захиалга байхгүй байна.' });
      return;
    }
    for (const bk of bookings) {
      const lines = [
        `📋 ${bk.name}`,
        `📞 ${bk.phone}`,
        bk.service ? `🏥 ${bk.service}` : null,
        bk.start   ? `📅 ${bk.start} · ${bk.days || '—'}` : null,
        bk.people  ? `👥 ${bk.people} хүн` : null,
        bk.note    ? `📝 ${bk.note}` : null,
        `\n🕐 ${new Date(bk.createdAt).toLocaleDateString('mn-MN', { timeZone: 'Asia/Shanghai' })}`,
      ].filter(Boolean).join('\n');
      await tgCall('sendMessage', {
        chat_id: TG_CHAT, text: lines,
        reply_markup: { inline_keyboard: [[
          { text: '✅ Баталгаажуулах', callback_data: `bkc_${bk.id}` },
          { text: '❌ Цуцлах',         callback_data: `bkx_${bk.id}` },
        ]]},
      });
    }
    return;
  }

  // ── /income ──────────────────────────────────────────────────────
  const incomeMatch = raw.match(/^\/income\s+(\d+)\s*(.*)?$/i);
  if (incomeMatch) {
    const amount  = parseInt(incomeMatch[1]);
    const note    = (incomeMatch[2] || '').trim() || 'Тодорхойгүй';
    const d       = todaySH();
    const ref     = dbPersonal.doc(`users/${UID}/revenue/${d}`);
    const snap    = await ref.get();
    const cur     = snap.exists ? snap.data() : { total: 0, entries: [] };
    const entries = [...(cur.entries || []), { amount, note, time: new Date().toISOString() }];
    const total   = (cur.total || 0) + amount;
    await ref.set({ total, entries, updatedAt: new Date().toISOString() }, { merge: true });
    await tgCall('sendMessage', {
      chat_id: TG_CHAT,
      text: `💰 Орлого бүртгэгдлээ.\n\n+${amount.toLocaleString()}₮ — ${note}\nӨнөөдрийн нийт: ${total.toLocaleString()}₮`,
    });
    return;
  }

  // ── /revenue ─────────────────────────────────────────────────────
  if (text === '/revenue') {
    const d         = todaySH();
    const todaySnap = await dbPersonal.doc(`users/${UID}/revenue/${d}`).get();
    const todayData = todaySnap.exists ? todaySnap.data() : { total: 0, entries: [] };
    const monthPrefix = d.slice(0, 7);
    const allRevSnap  = await dbPersonal.collection(`users/${UID}/revenue`).get().catch(() => ({ docs: [] }));
    const monthTotal  = allRevSnap.docs
      .filter(doc => doc.id.startsWith(monthPrefix))
      .reduce((sum, doc) => sum + (doc.data().total || 0), 0);
    const analyticsSnap = await dbLFS.doc(`users/${UID}/analytics/${d}`).get();
    const leads = analyticsSnap.exists ? (analyticsSnap.data().booking_lead || 0) : 0;
    const entries = (todayData.entries || []).slice(-5).reverse();
    let msg = `💰 *LFS Орлогын тайлан*\n\n`;
    msg += `Өнөөдөр: *${(todayData.total || 0).toLocaleString()}₮*\n`;
    msg += `${d.slice(0, 7)}-р сар: *${monthTotal.toLocaleString()}₮*\n`;
    msg += `Захиалгын lead: *${leads}*\n`;
    if (entries.length) {
      msg += `\nСүүлийн орлогууд:\n`;
      entries.forEach(e => { msg += `• +${Number(e.amount).toLocaleString()}₮ — ${e.note}\n`; });
    }
    msg += `\n_/income [дүн] [тэмдэглэл]_`;
    await tgCall('sendMessage', { chat_id: TG_CHAT, text: msg, parse_mode: 'Markdown' });
    return;
  }

  // ── /week ────────────────────────────────────────────────────────
  if (text === '/week') {
    const qSnap = await dbLFS.doc(`users/${UID}/marketing/weeklyQueue`).get();
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

  // ── /help ────────────────────────────────────────────────────────
  if (text === '/help') {
    await tgSend(
      `🏢 *LFS Shanghai Bot*\n\n` +
      `*📋 Захиалга*\n` +
      `/bookings — хүлээгдэж буй захиалгууд\n\n` +
      `*💰 Орлого*\n` +
      `/income [дүн] [тэмдэглэл] — орлого бүртгэх\n` +
      `/revenue — орлогын тайлан\n\n` +
      `*📸 IG/FB Post*\n` +
      `/week — долоо хоногийн post хуваарь\n` +
      `_Зураг явуулахад → caption + нийтлэх_`
    );
    return;
  }
}

// ── SPRINT 4: AI MARKETING CONTENT INTELLIGENCE ───────────────────
// server.js-ийн cron-оор дуудагдана (13:00 Шанхай / 05:00 UTC)
async function generateMarketingIdeas() {
  const GEMINI_KEY = process.env.GEMINI_API_KEY;
  if (!GEMINI_KEY) { console.warn('[Marketing] GEMINI_API_KEY тохиргоогүй'); return; }

  const today = new Date().toLocaleDateString('sv', { timeZone: 'Asia/Shanghai' });

  const prompt =
    `LFS Shanghai бизнесийн хувьд өнөөдөр (${today}) Instagram/Facebook постод тохирох 3 санаа бэлдэж өгнө үү.\n` +
    `Зорилтот хэрэглэгч: Шанхайд аялах сонирхолтой Монголчууд.\n\n` +
    `Хариу: JSON array ЗӨВХӨН (тайлбар текст хэрэггүй):\n` +
    `[\n` +
    `  {\n` +
    `    "title": "Постын гарчиг",\n` +
    `    "hook": "Анхны 2 мөр (attention-grabbing)",\n` +
    `    "caption": "Caption 100-150 тэмдэгт, дотно хэлбэр, анхаарлын тэмдэггүй",\n` +
    `    "hashtags": "#LFSShanghai #Шанхай #Монгол",\n` +
    `    "angle": "Ямар өнцгөөс авсан"\n` +
    `  }\n` +
    `]\n\n` +
    `Сэдэв: Шанхай аялал, эмнэлгийн багц, хөтөч үйлчилгээ, амьдралын хэв маяг.`;

  try {
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_KEY}`,
      {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: 1500, temperature: 0.9 },
        }),
      }
    );
    const data    = await r.json();
    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    const arrMatch = rawText?.match(/\[[\s\S]*\]/);
    if (!arrMatch) { console.error('[Marketing] JSON array гарсангүй'); return; }

    const ideas = JSON.parse(arrMatch[0]);

    for (let i = 0; i < Math.min(ideas.length, 3); i++) {
      const idea   = ideas[i];
      const ideaId = `mk_${Date.now()}_${i}`;

      // Firestore-д pending хэлбэрт хадгалах
      await dbLFS.doc(`users/${UID}/marketing/weeklyQueue`).set({
        [`pending_${ideaId}`]: {
          ...idea,
          ideaId,
          status:    'pending',
          createdAt: new Date().toISOString(),
        },
      }, { merge: true });

      const msg =
        `💡 *Постын санаа ${i + 1}/3*\n\n` +
        `📌 *${idea.title}*\n\n` +
        `🪝 *Hook:*\n${idea.hook}\n\n` +
        `📝 *Caption:*\n${idea.caption}\n\n` +
        `🏷 ${idea.hashtags}\n` +
        `📐 _${idea.angle}_`;

      await tgCall('sendMessage', {
        chat_id:      TG_CHAT,
        text:         msg,
        parse_mode:   'Markdown',
        reply_markup: {
          inline_keyboard: [[
            { text: '✅ Зөвшөөрөх', callback_data: `mkq_${ideaId}` },
            { text: '❌ Орхих',      callback_data: `mkx_${ideaId}` },
          ]],
        },
      });

      await new Promise(res => setTimeout(res, 800));
    }
  } catch (e) {
    console.error('[Marketing] generateMarketingIdeas error:', e.message);
  }
}

// ── WEBHOOK HANDLER ───────────────────────────────────────────────
module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(200).send('LFS Bot OK');
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
    console.error('[LFS Bot] Error:', e.message);
  }
};

// Бусад модулиас дуудах боломжтой
module.exports.tgCall               = tgCall;
module.exports.tgSend               = (text) => tgCall('sendMessage', { chat_id: TG_CHAT, text, parse_mode: 'Markdown' });
module.exports.generateMarketingIdeas = generateMarketingIdeas;
