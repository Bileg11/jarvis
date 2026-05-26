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
    // Сүүлийн post цагийг хадгална (post frequency alert-д хэрэгтэй)
    if (igData.id) {
      db.doc(`users/${UID}/marketing/lastPost`).set({ postedAt: new Date().toISOString() }).catch(() => {});
    }
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

// ── MORNING BRIEF (telegram.js-с шууд дуудна) ────────────────────
async function sendBrief() {
  const GEMINI_KEY = process.env.GEMINI_API_KEY;

  const now       = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Shanghai' }));
  const todaySHx  = now.toLocaleDateString('sv', { timeZone: 'Asia/Shanghai' });
  const yesterday = new Date(Date.now() - 86400000).toLocaleDateString('sv', { timeZone: 'Asia/Shanghai' });

  // Бүх өгөгдлийг зэрэг уншина
  const [analyticsSnap, bilegSnap, tasksRaw, routineSnap, logSnap, revenueSnap] = await Promise.all([
    db.doc(`users/${UID}/analytics/${yesterday}`).get(),
    db.doc(`users/${UID}/bileg/profile`).get(),
    db.collection(`users/${UID}/tasks`).where('done', '==', false).get().catch(() => ({ docs: [] })),
    db.doc(`users/${UID}/routines/${yesterday}`).get(),
    db.doc(`users/${UID}/logs/${yesterday}`).get(),
    db.doc(`users/${UID}/revenue/${yesterday}`).get(),
  ]);

  // LFS аналитик
  const lfs           = analyticsSnap.exists ? analyticsSnap.data() : {};
  const userCount     = (lfs.users || []).length;
  const guideCount    = lfs.guide       || 0;
  const medicalCount  = lfs.medical     || 0;
  const agentCount    = lfs.agent       || 0;
  const escalateCount = lfs.escalate    || 0;
  const bookingLeads  = lfs.booking_lead || 0;

  // Өчигдрийн орлого
  const revenue = revenueSnap.exists ? (revenueSnap.data().total || 0) : 0;

  // Билэгийн мэдээлэл
  const bileg = bilegSnap.exists ? bilegSnap.data() : {};

  // Хийх tasks
  const tasks = tasksRaw.docs
    .map(doc => doc.data())
    .sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''))
    .slice(0, 5)
    .map(t => t.text);

  // Өчигдрийн routine
  const rt    = routineSnap.exists ? routineSnap.data() : {};
  const water = logSnap.exists ? (logSnap.data().water?.total_ml || 0) : 0;
  const routineItems = [
    { key: 'exercise', label: 'Дасгал',  emoji: '💪' },
    { key: 'hanzi',    label: '汉字',     emoji: '🈶' },
    { key: 'read',     label: 'Уншилт',  emoji: '📚' },
    { key: 'journal',  label: 'Journal', emoji: '📝' },
  ];
  const done   = routineItems.filter(r => rt[r.key]);
  const missed = routineItems.filter(r => !rt[r.key]);

  // Gemini-д бүх контекст өгч proactive зөвлөгөө авна
  const context = [
    `Өнөөдөр: ${todaySHx}.`,
    `LFS өчигдөр: ${userCount} хэрэглэгч, ${guideCount} гайд, ${medicalCount} эмнэлэг, ${agentCount} ажилтан.`,
    done.length   ? `Хийсэн: ${done.map(r => r.label).join(', ')}.`   : 'Өчигдөр routine хийгээгүй.',
    missed.length ? `Хийгээгүй: ${missed.map(r => r.label).join(', ')}.` : '',
    `Ус: ${water}мл.`,
    bileg.goal    ? `Зорилго: "${bileg.goal}".`  : '',
    tasks.length  ? `Хийх tasks: ${tasks.slice(0,3).join(', ')}.` : '',
    `Чи бол Билэгийн хувийн ЖАРВИС. Өчигдрийн үр дүнд тулгуурлан өнөөдрийн 2-3 өгүүлбэр проактив, шууд, дотно зөвлөгөө өг. Хийгээгүй зүйлийг сануул. Монголоор, анхаарлын тэмдэггүй.`,
  ].filter(Boolean).join(' ');

  let advice = 'Өнөөдөр нэг алхам урагш.';
  if (GEMINI_KEY) {
    try {
      const r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${GEMINI_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: context }] }],
            generationConfig: { maxOutputTokens: 200, temperature: 0.85 },
          }),
        }
      );
      const data  = await r.json();
      const parts = data.candidates?.[0]?.content?.parts || [];
      const part  = parts.find(p => !p.thought && p.text) || parts[0];
      advice = part?.text?.trim() || advice;
    } catch {}
  }

  const days    = ['Ням', 'Даваа', 'Мягмар', 'Лхагва', 'Пүрэв', 'Баасан', 'Бямба'];
  const dayName = days[now.getDay()];

  let msg = '';
  msg += `🌅 Өглөөний мэнд, Билэг.\n`;
  msg += `${dayName}, ${todaySHx} | Шанхай 07:30\n\n`;

  // Өчигдрийн үр дүн
  msg += `📊 Өчигдрийн тойм:\n`;
  msg += `LFS: ${userCount} хандсан · Гайд: ${guideCount} · Эмнэлэг: ${medicalCount}`;
  if (agentCount)    msg += ` · Ажилтан: ${agentCount}`;
  if (bookingLeads)  msg += `\n📋 Захиалга: ${bookingLeads} lead`;
  if (revenue)       msg += ` · 💰 ${revenue.toLocaleString()}₮`;
  if (escalateCount) msg += `\n⚠️ Бухимдсан: ${escalateCount}`;
  msg += `\n`;
  msg += `Routine: `;
  msg += done.length   ? done.map(r => r.emoji + r.label).join(' ') : 'хийгдээгүй';
  msg += ` | Ус: ${water}мл\n`;

  // Хийх зүйлс
  if (tasks.length) {
    msg += `\n📋 Хийх (${tasks.length}):\n`;
    tasks.forEach((t, i) => { msg += `${i + 1}. ${t}\n`; });
  }

  // Зорилго
  if (bileg.goal) msg += `\n🎯 ${bileg.goal}\n`;

  // Жарвисын зөвлөгөө
  msg += `\n💡 Жарвис:\n${advice}\n`;
  msg += `\n⚡ Жарвис ажиллаж байна.`;

  await tgCall('sendMessage', { chat_id: TG_CHAT, text: msg });
}

// ── BILEG PERSONAL MEMORY ────────────────────────────────────────
async function getBilegProfile() {
  try {
    const snap = await db.doc(`users/${UID}/bileg/profile`).get();
    return snap.exists ? snap.data() : {};
  } catch { return {}; }
}

async function saveBilegProfile(updates) {
  try {
    await db.doc(`users/${UID}/bileg/profile`).set(
      { ...updates, updatedAt: new Date().toISOString() },
      { merge: true }
    );
  } catch {}
}

// ── TASK MANAGER ──────────────────────────────────────────────────
async function getTasks() {
  try {
    const snap = await db.collection(`users/${UID}/tasks`)
      .where('done', '==', false)
      .orderBy('createdAt', 'asc')
      .get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch { return []; }
}

async function addTask(text) {
  try {
    await db.collection(`users/${UID}/tasks`).add({
      text,
      done: false,
      createdAt: new Date().toISOString(),
    });
  } catch {}
}

async function doneTask(index) {
  try {
    const tasks = await getTasks();
    const task  = tasks[index - 1];
    if (!task) return null;
    await db.doc(`users/${UID}/tasks/${task.id}`).update({ done: true, doneAt: new Date().toISOString() });
    return task.text;
  } catch { return null; }
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
    ? `LFS Shanghai IG post. "${hint}" тухай 2-3 өгүүлбэр Монголоор, emoji, "👉 bileg11.github.io" гэж энгийн текстээр нэмж бич (link format хэрэггүй). Дараа нь 10 hashtag зайгаар. Формат: CAPTION: ... HASHTAGS: ...`
    : `LFS Shanghai Шанхай аялал тухай 2-3 өгүүлбэр Монголоор, emoji, "👉 bileg11.github.io" гэж энгийн текстээр бич (link format хэрэггүй). Дараа нь 10 hashtag. Формат: CAPTION: ... HASHTAGS: ...`;
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
  await tgAnswer(cbId);

  // ── Booking confirm / cancel ──────────────────────────────────
  if (cmd.startsWith('bkc_') || cmd.startsWith('bkx_')) {
    const isConfirm = cmd.startsWith('bkc_');
    const bookingId = cmd.slice(4);
    const bkRef     = db.collection(`users/${UID}/bookings`).doc(bookingId);
    const bkSnap    = await bkRef.get();

    if (!bkSnap.exists) {
      await tgCall('sendMessage', { chat_id: TG_CHAT, text: '⚠️ Захиалга олдсонгүй (ID устсан байж магадгүй).' });
      return;
    }

    const bk = bkSnap.data();
    const now = new Date().toISOString();

    if (isConfirm) {
      await bkRef.update({ status: 'confirmed', confirmedAt: now });
      // Товчлуурыг устгах
      await tgCall('editMessageReplyMarkup', {
        chat_id: TG_CHAT, message_id: msgId,
        reply_markup: { inline_keyboard: [] },
      });
      await tgCall('sendMessage', {
        chat_id: TG_CHAT,
        text: `✅ Баталгаажлаа.\n\nНэр: ${bk.name}\nУтас: ${bk.phone}\nҮйлчилгээ: ${bk.service || '—'}\nОгноо: ${bk.start || '—'}`,
      });
    } else {
      await bkRef.update({ status: 'cancelled', cancelledAt: now });
      await tgCall('editMessageReplyMarkup', {
        chat_id: TG_CHAT, message_id: msgId,
        reply_markup: { inline_keyboard: [] },
      });
      await tgCall('sendMessage', {
        chat_id: TG_CHAT,
        text: `❌ Цуцлагдлаа.\n\nНэр: ${bk.name} · ${bk.phone}`,
      });
    }
    return;
  }

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
      const gen      = await generateCaption();
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
      const igResult = await postToIG(ms.photoUrl, ms.caption, ms.hashtags);

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
        fbMsg = !fbData.error ? '✅ FB нийтлэгдлээ!' : `❌ FB: ${fbData.error?.message}`;
      } catch (e) {
        fbMsg = `❌ FB алдаа: ${e.message}`;
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

  // ── Task manager ─────────────────────────────────────────────────
  if (raw.startsWith('/task ') || raw.startsWith('/task\n')) {
    const taskText = raw.slice(6).trim();
    if (!taskText) { await tgSend('⚠️ Яг юу хийх вэ? `/task [тайлбар]`'); return; }
    await addTask(taskText);
    const tasks = await getTasks();
    await tgSend(`✅ Task нэмэгдлээ.\n\n📋 Нийт хийх: *${tasks.length}* зүйл`);
    return;
  }

  if (text === '/tasks' || text === 'tasks') {
    const tasks = await getTasks();
    if (!tasks.length) { await tgSend('📋 Хийх зүйл байхгүй байна. 🎉'); return; }
    const list = tasks.map((t, i) => `${i + 1}. ${t.text}`).join('\n');
    await tgSend(`📋 *Хийх зүйлүүд:*\n\n${list}\n\n_/done [дугаар] — дуусгасан гэж тэмдэглэх_`);
    return;
  }

  const doneMatch = raw.match(/^\/done\s+(\d+)/i);
  if (doneMatch) {
    const n    = parseInt(doneMatch[1]);
    const text = await doneTask(n);
    if (!text) { await tgSend('⚠️ Тийм дугаартай task байхгүй байна.'); return; }
    const remaining = await getTasks();
    await tgSend(`✅ *Дууслаа:* ${text}\n\n📋 Үлдсэн: *${remaining.length}* зүйл`);
    return;
  }

  // ── Bileg personal memory ─────────────────────────────────────────
  if (raw.startsWith('/goal ') || raw.startsWith('/goal\n')) {
    const goal = raw.slice(6).trim();
    await saveBilegProfile({ goal });
    await tgSend(`🎯 Зорилго хадгаллаа:\n_"${goal}"_\n\nЖарвис өглөө бүр үүнийг чамд сануулна.`);
    return;
  }

  if (text === '/goal') {
    const p = await getBilegProfile();
    if (!p.goal) { await tgSend('🎯 Зорилго тавиагүй байна.\n`/goal [зорилгоо бичнэ үү]`'); return; }
    await tgSend(`🎯 *Одоогийн зорилго:*\n_"${p.goal}"_`);
    return;
  }

  if (raw.startsWith('/focus ')) {
    const focus = raw.slice(7).trim();
    await saveBilegProfile({ focus });
    await tgSend(`🔥 Өнөөдрийн focus хадгаллаа:\n_"${focus}"_`);
    return;
  }

  // ── Booking management ────────────────────────────────────────────
  if (text === '/bookings' || text === 'bookings') {
    const snap = await db.collection(`users/${UID}/bookings`)
      .where('status', '==', 'pending')
      .get()
      .catch(() => ({ docs: [] }));

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
        `📋 Захиалга — ${bk.name}`,
        `Утас: ${bk.phone}`,
        bk.service ? `Үйлчилгээ: ${bk.service}` : null,
        bk.start   ? `Огноо: ${bk.start} · ${bk.days || '—'}` : null,
        bk.people  ? `Хүн: ${bk.people}` : null,
        bk.email   ? `И-мэйл: ${bk.email}` : null,
        bk.note    ? `Тэмдэглэл: ${bk.note}` : null,
        `\n${new Date(bk.createdAt).toLocaleDateString('mn-MN', { timeZone: 'Asia/Shanghai' })}`,
      ].filter(Boolean).join('\n');

      await tgCall('sendMessage', {
        chat_id: TG_CHAT,
        text:    lines,
        reply_markup: {
          inline_keyboard: [[
            { text: '✅ Баталгаажуулах', callback_data: `bkc_${bk.id}` },
            { text: '❌ Цуцлах',         callback_data: `bkx_${bk.id}` },
          ]],
        },
      });
    }
    return;
  }

  // ── Revenue tracking ──────────────────────────────────────────────
  const incomeMatch = raw.match(/^\/income\s+(\d+)\s*(.*)?$/i);
  if (incomeMatch) {
    const amount = parseInt(incomeMatch[1]);
    const note   = (incomeMatch[2] || '').trim() || 'Тодорхойгүй';
    const d      = todaySH();
    const ref    = db.doc(`users/${UID}/revenue/${d}`);
    const snap   = await ref.get();
    const cur    = snap.exists ? snap.data() : { total: 0, entries: [] };
    const entries = [...(cur.entries || []), { amount, note, time: new Date().toISOString() }];
    const total   = (cur.total || 0) + amount;
    await ref.set({ total, entries, updatedAt: new Date().toISOString() }, { merge: true });
    await tgCall('sendMessage', {
      chat_id: TG_CHAT,
      text: `💰 Орлого бүртгэгдлээ.\n\n+${amount.toLocaleString()}₮ — ${note}\nӨнөөдрийн нийт: ${total.toLocaleString()}₮`,
    });
    return;
  }

  if (text === '/revenue') {
    const d         = todaySH();
    const todaySnap = await db.doc(`users/${UID}/revenue/${d}`).get();
    const todayData = todaySnap.exists ? todaySnap.data() : { total: 0, entries: [] };

    // Энэ сарын нийт
    const monthPrefix = d.slice(0, 7); // "2026-05"
    const allRevSnap  = await db.collection(`users/${UID}/revenue`).get().catch(() => ({ docs: [] }));
    const monthTotal  = allRevSnap.docs
      .filter(doc => doc.id.startsWith(monthPrefix))
      .reduce((sum, doc) => sum + (doc.data().total || 0), 0);

    // Booking lead count
    const analyticsSnap = await db.doc(`users/${UID}/analytics/${d}`).get();
    const leads = analyticsSnap.exists ? (analyticsSnap.data().booking_lead || 0) : 0;

    const entries = (todayData.entries || []).slice(-5).reverse();
    let msg = `💰 Орлогын тайлан\n\n`;
    msg += `Өнөөдөр: ${(todayData.total || 0).toLocaleString()}₮\n`;
    msg += `${d.slice(0, 7)}-р сар: ${monthTotal.toLocaleString()}₮\n`;
    msg += `Өнөөдөр захиалга: ${leads} lead\n`;
    if (entries.length) {
      msg += `\nСүүлийн орлогууд:\n`;
      entries.forEach(e => { msg += `• +${Number(e.amount).toLocaleString()}₮ — ${e.note}\n`; });
    } else {
      msg += `\nОрлого бүртгэгдээгүй байна.\n`;
    }
    msg += `\n/income [дүн] [тэмдэглэл] — бүртгэх`;
    await tgCall('sendMessage', { chat_id: TG_CHAT, text: msg });
    return;
  }

  // ── Manual brief trigger ──────────────────────────────────────────
  if (raw.replace(/@\w+/, '').trim().toLowerCase() === '/brief') {
    await tgCall('sendMessage', { chat_id: TG_CHAT, text: '⏳ Брифинг бэлдэж байна...' });
    try {
      await sendBrief();
    } catch (e) {
      await tgCall('sendMessage', { chat_id: TG_CHAT, text: '❌ Brief алдаа: ' + e.message });
    }
    return;
  }

  if (text === '/help' || text === 'help') {
    await tgSend(
      `🤖 *JARVIS Commands*\n\n` +
      `*📋 Task Manager*\n` +
      `/task [зүйл] — шинэ task нэмэх\n` +
      `/tasks — бүх task харах\n` +
      `/done [n] — task дуусгах\n\n` +
      `*🧠 Санах ой*\n` +
      `/goal [зорилго] — зорилго хадгалах\n` +
      `/focus [зүйл] — өнөөдрийн focus\n` +
      `/brief — өглөөний брифинг одоо авах\n\n` +
      `*🏢 LFS Бизнес*\n` +
      `/bookings — хүлээгдэж буй захиалгууд\n` +
      `/income [дүн] [тэмдэглэл] — орлого бүртгэх\n` +
      `/revenue — орлогын тайлан\n\n` +
      `*💪 Routine*\n` +
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
