'use strict';
// ── LFS SHANGHAI TELEGRAM BOT v2.0 ───────────────────────────────
// Sprint 4+: AI Marketing Content Intelligence
//   1. LFS Brand Voice — бүх caption-д тусгасан
//   2. Post Memory    — сүүлийн 14 постыг санаж давтахгүй
//   3. /weekplan      — 7 хоногийн 14 пост, тус бүрийг approve
//   4. Format support — single / carousel / reel

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
const GEMINI_KEY = process.env.GEMINI_API_KEY;

// ── LFS BRAND VOICE ───────────────────────────────────────────────
const LFS_BRAND = `
Брэнд: LFS Shanghai (lfsshanghai.com)
Үйлчилгээ:
  - Монгол аялагчдад Шанхайн VIP туслалцаа
  - Эмнэлгийн орчуулга, эмнэлэгт дагалдах
  - Хот хоорондын зочны зохион байгуулалт
  - Шанхайн аялал, хөтөч үйлчилгээ

Зорилтот хэрэглэгч:
  - 25–45 насны Монголчууд
  - Эмнэлгийн зорилгоор Шанхайд ирэгсэд
  - Анх удаа болон дахин аялагчид
  - Хятад хэл мэдэхгүй, итгэлтэй туслагч хэрэгтэй

Брэнд дуу хоолой:
  - Найрсаг, итгэлтэй — рекламчлал биш, найзын зөвлөгөө мэт
  - Шанхайд бодитоор амьдарч буй Монгол хүний туршлагаас
  - Аялагчийн жинхэнэ асуудлыг шийдэж буй тодорхой жишээ
  - Хятад хэлний хаалт, гадаад орчинд төөрөх зэргийг хэрхэн давах
  - Урт, цэгтэй өгүүлбэр — богино мессеж биш

CTA (заавал оруулах): "👉 lfsshanghai.com руу орж үнэгүй зөвлөгөө авна уу"
Emoji: байх ёстой, хэт олон биш (3-5 ширхэг)
Хэл: Монгол (зарим Хятад үг нэмж болно)
`;

// ── FORMAT GUIDE ──────────────────────────────────────────────────
const FORMAT_GUIDE = {
  single:   '1 зурагтай пост — товч, хүчтэй нэг гол санаа, 130–180 тэмдэгт caption',
  carousel: 'Carousel (5–7 слайд) — гарчиг + алхам алхамаар тайлбар, 150–200 тэмдэгт',
  reel:     'Reels видео — анхны 3 секунд анхаарал татах hook, хурдан темп, 100–140 тэмдэгт',
};
const FORMAT_EMOJI = { single: '📸', carousel: '🎠', reel: '🎬' };

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

// ── POST MEMORY ───────────────────────────────────────────────────
// Сүүлийн 14 approve хийсэн постыг санана — давтахаас зайлсхийнэ
async function getPostHistory() {
  try {
    const snap = await dbLFS.doc(`users/${UID}/marketing/postHistory`).get();
    return snap.exists ? (snap.data().posts || []) : [];
  } catch { return []; }
}

async function saveToPostHistory(post) {
  try {
    const history = await getPostHistory();
    history.push({
      title:    post.title || post.topic || '—',
      caption:  (post.caption || '').slice(0, 120),
      format:   post.format || 'single',
      topic:    post.topic || post.angle || post.title || '',
      savedAt:  new Date().toISOString(),
    });
    if (history.length > 14) history.splice(0, history.length - 14);
    await dbLFS.doc(`users/${UID}/marketing/postHistory`).set({
      posts: history,
      updatedAt: new Date().toISOString(),
    });
  } catch (e) { console.error('[PostHistory] Save error:', e.message); }
}

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
  dbLFS.doc(`users/${UID}/marketing/lastPost`)
    .set({ postedAt: new Date().toISOString() }).catch(() => {});
  return { ok: true, postId: pData.id };
}

async function fetchNewImage(query = 'shanghai') {
  try {
    if (PEXELS_KEY) {
      const r = await fetch(
        `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=10`,
        { headers: { Authorization: PEXELS_KEY } }
      );
      const d = await r.json();
      if (d.photos?.length) {
        // Санамсаргүй сонгох — давхардахгүй байхын тулд
        const idx = Math.floor(Math.random() * d.photos.length);
        return d.photos[idx].src.large2x;
      }
    }
    if (UNSPLASH_KEY) {
      const r = await fetch(
        `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=10`,
        { headers: { Authorization: `Client-ID ${UNSPLASH_KEY}` } }
      );
      const d = await r.json();
      if (d.results?.length) {
        const idx = Math.floor(Math.random() * Math.min(d.results.length, 5));
        return d.results[idx].urls.regular;
      }
    }
  } catch {}
  return 'https://images.unsplash.com/photo-1481627834876-b7833e8f5570';
}

// ── CAPTION GENERATOR v2.0 ────────────────────────────────────────
// GitHub Models (gpt-4o-mini) — Gemini quota-аас хамааралгүй
async function generateCaption(hint = '', format = 'single') {
  if (!GH_TOKEN) return {
    caption: hint || 'LFS Shanghai 🌆', hashtags: '#LFSShanghai #Shanghai',
    fullCaption: `${hint || 'LFS Shanghai 🌆'}\n\n👉 lfsshanghai.com`, format,
  };

  const fGuide = FORMAT_GUIDE[format] || FORMAT_GUIDE.single;

  const prompt =
    `${LFS_BRAND}\n\n` +
    `Формат: ${fGuide}\n` +
    (hint ? `Сэдэв: "${hint}"\n\n` : 'Өдөр тутмын LFS контент.\n\n') +
    `Дараах зүйлсийг бэлд:\n` +
    `HOOK: (1-2 мөр, 40 тэмдэгтийн дотор — анхаарал татах, асуулт эсвэл bold мэдэгдэл)\n` +
    `CAPTION: (130-180 тэмдэгт, цэгтэй гүйцэд өгүүлбэрүүд, emoji, бодит туршлагаас)\n` +
    `CTA: (нэг мөр, заавал "👉 lfsshanghai.com" оруулах)\n` +
    `HASHTAGS: (15 хамааралтай hashtag: Монгол, Шанхай, эмнэлэг, аялал гэх мэт)\n` +
    (format === 'carousel' ? `SLIDES: (5 слайдын гарчиг, тус бүр товч)\n` : '') +
    (format === 'reel'     ? `SCRIPT: (15 секундын товч script, 3 хэсэг)\n` : '');

  try {
    const r = await fetch('https://models.inference.ai.azure.com/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${GH_TOKEN}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 600,
        temperature: 0.85,
      }),
    });
    const d   = await r.json();
    const raw = d.choices?.[0]?.message?.content || '';

    const hook     = raw.match(/HOOK:\s*([\s\S]*?)(?=CAPTION:|$)/i)?.[1]?.trim() || '';
    const caption  = raw.match(/CAPTION:\s*([\s\S]*?)(?=CTA:|$)/i)?.[1]?.trim() || '';
    const cta      = raw.match(/CTA:\s*([\s\S]*?)(?=HASHTAGS:|$)/i)?.[1]?.trim()
                     || '👉 lfsshanghai.com руу орж үнэгүй зөвлөгөө авна уу';
    const hashtags = raw.match(/HASHTAGS:\s*([\s\S]*?)(?=SLIDES:|SCRIPT:|$)/i)?.[1]?.trim()
                     || '#LFSShanghai #Шанхай #МонголАялал';
    const extra    = raw.match(/(?:SLIDES|SCRIPT):\s*([\s\S]*?)$/i)?.[1]?.trim() || '';

    // Нийтлэх caption = hook + caption + cta нэгтгэсэн
    const fullCaption = [hook, caption, cta].filter(Boolean).join('\n\n');

    return { hook, caption: fullCaption, hashtags, fullCaption, extra, format };
  } catch (e) {
    console.error('[Caption] Error:', e.message);
    return {
      hook: '', caption: hint || 'LFS Shanghai 🌆',
      hashtags: '#LFSShanghai #Шанхай', fullCaption: `${hint || 'LFS Shanghai'}\n\n👉 lfsshanghai.com`,
      extra: '', format,
    };
  }
}

// ── WEEK PLAN GENERATOR ───────────────────────────────────────────
async function generateWeekPlan() {
  if (!GH_TOKEN) { await tgSend('⚠️ GH_TOKEN тохиргоогүй.'); return; }

  await tgSend('📅 *7 хоногийн 14 пост бэлдэж байна...*\nЗахиалга болгоно уу 30 секунд.');

  const history    = await getPostHistory();
  const usedTopics = history.length
    ? history.map(p => p.title).filter(Boolean).join(', ')
    : '';

  const today = todaySH();
  const DAYS  = ['Ням', 'Даваа', 'Мягмар', 'Лхагва', 'Пүрэв', 'Баасан', 'Бямба'];

  const prompt =
    `${LFS_BRAND}\n\n` +
    `Өнөөдөр: ${today}\n` +
    (usedTopics ? `Сүүлд хийсэн постуудын сэдэв (ЯАГААД ЧИ ДАВТАХГҮЙ): ${usedTopics}\n\n` : '\n') +
    `7 хоногийн 14 постын контент план үүсгэ.\n` +
    `Өдөр бүр 2 пост: өглөө (single/carousel) + орой (reel/single).\n\n` +
    `Агуулгын өнцгүүдийг БҮГДИЙГ хамруулах (давтахгүйгээр):\n` +
    `- Шанхайн нуугдмал газрууд, хоол, амьдрал\n` +
    `- Эмнэлгийн туршлага (орчуулга, эмчтэй яриа, яаралтай тусламж)\n` +
    `- Аялалын практик зөвлөгөө (виз, нисэх онгоц, хотоор явах)\n` +
    `- LFS үйлчилгээний бодит кейс (нэр дурдахгүй)\n` +
    `- Монгол аялагчдын нийтлэг асуулт, буруу ойлголт\n` +
    `- Шанхайн соёл, хэл, ёс заншил\n` +
    `- Хямд vs үнэтэй аялал: ямар ялгаа байдаг\n\n` +
    `Форматын тараалт: single 6ш, carousel 5ш, reel 3ш.\n\n` +
    `Хариу: JSON array ЗӨВХӨН (тайлбар текст огт хэрэггүй):\n` +
    `[\n` +
    `  {\n` +
    `    "day": 1,\n` +
    `    "slot": "morning",\n` +
    `    "format": "single|carousel|reel",\n` +
    `    "title": "Постын нэр",\n` +
    `    "hook": "Анхны 1-2 мөр (40 тэмдэгт, маш хүчтэй)",\n` +
    `    "caption": "130-180 тэмдэгт, цэгтэй өгүүлбэр, emoji бүхий",\n` +
    `    "cta": "👉 lfsshanghai.com ... (нэг мөр)",\n` +
    `    "hashtags": "#LFSShanghai #tag1 #tag2 ...(15 hashtag)",\n` +
    `    "imageSearch": "pexels/unsplash-д хайх keyword (English, тодорхой)",\n` +
    `    "extra": "carousel слайдуудын гарчиг эсвэл reel script (format=single бол хоосон)"\n` +
    `  }\n` +
    `]`;

  try {
    const r = await fetch('https://models.inference.ai.azure.com/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${GH_TOKEN}` },
      body: JSON.stringify({
        model:       'gpt-4o-mini',
        messages:    [{ role: 'user', content: prompt }],
        max_tokens:  4000,
        temperature: 0.9,
      }),
    });
    const d   = await r.json();
    const raw = d.choices?.[0]?.message?.content?.trim() || '';
    console.log('[WeekPlan] Raw length:', raw.length);

    const arrMatch = raw.match(/\[[\s\S]*\]/);
    if (!arrMatch) {
      console.error('[WeekPlan] JSON array гарсангүй. Raw:', raw.slice(0, 200));
      await tgSend('❌ Контент план гарсангүй. Дахин `/weekplan` оруулна уу.');
      return;
    }

    const posts = JSON.parse(arrMatch[0]);

    // Dates for 7 days
    const dates = [];
    for (let i = 0; i < 7; i++) {
      const dt = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Shanghai' }));
      dt.setDate(dt.getDate() + i);
      dates.push(dt.toLocaleDateString('sv'));
    }

    // Save to Firestore
    const planRef  = dbLFS.doc(`users/${UID}/marketing/weekPlan`);
    const planData = { createdAt: new Date().toISOString() };

    for (const post of posts) {
      const dayIdx = Math.min(Math.max((post.day || 1) - 1, 0), 6);
      const date   = dates[dayIdx];
      const slot   = post.slot === 'evening' ? 'evening' : 'morning';
      const postId = `wp_d${dayIdx}_${slot}`;
      planData[postId] = { ...post, postId, date, status: 'pending', createdAt: new Date().toISOString() };
    }
    await planRef.set(planData);

    // Send to Telegram — 14 individual post cards
    let sentCount = 0;
    for (const post of posts.slice(0, 14)) {
      const dayIdx  = Math.min(Math.max((post.day || 1) - 1, 0), 6);
      const date    = dates[dayIdx];
      const dayName = DAYS[new Date(date + 'T12:00:00').getDay()];
      const slot    = post.slot === 'evening' ? '🌆 Орой' : '🌅 Өглөө';
      const fEmoji  = FORMAT_EMOJI[post.format] || '📸';
      const postId  = `wp_d${dayIdx}_${(post.slot === 'evening' ? 'evening' : 'morning')}`;

      const fullText =
        `${fEmoji} *${dayName} ${slot}* — \`${post.format}\`\n` +
        `📌 *${post.title}*\n\n` +
        `🪝 _${post.hook}_\n\n` +
        `${post.caption}\n\n` +
        `${post.cta}\n` +
        `${post.hashtags}` +
        (post.extra ? `\n\n📋 _${post.extra.slice(0, 200)}_` : '');

      const trimmed = fullText.length > 3800 ? fullText.slice(0, 3800) + '...' : fullText;

      await tgCall('sendMessage', {
        chat_id:      TG_CHAT,
        text:         trimmed,
        parse_mode:   'Markdown',
        reply_markup: { inline_keyboard: [[
          { text: '✅ Approve', callback_data: `wkp_ok_${postId}` },
          { text: '⏭ Skip',    callback_data: `wkp_no_${postId}` },
        ]]},
      });

      sentCount++;
      await new Promise(res => setTimeout(res, 500));
    }

    await tgSend(
      `✅ *7 хоногийн план бэлэн!*\n\n` +
      `📊 Нийт ${sentCount} пост\n` +
      `📸 Single · 🎠 Carousel · 🎬 Reel\n\n` +
      `Тус бүрийг ✅ Approve эсвэл ⏭ Skip хийнэ үү.`
    );

  } catch (e) {
    console.error('[WeekPlan] Error:', e.message);
    await tgSend(`❌ Week plan алдаа: ${e.message.slice(0, 100)}`);
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
      await tgCall('sendMessage', {
        chat_id: TG_CHAT,
        text: `✅ Баталгаажлаа.\n\nНэр: ${bk.name}\nУтас: ${bk.phone}\nҮйлчилгээ: ${bk.service || '—'}\nОгноо: ${bk.start || '—'}`,
      });
    } else {
      await bkRef.update({ status: 'cancelled', cancelledAt: now });
      await tgCall('editMessageReplyMarkup', { chat_id: TG_CHAT, message_id: msgId, reply_markup: { inline_keyboard: [] } });
      await tgCall('sendMessage', { chat_id: TG_CHAT, text: `❌ Цуцлагдлаа.\n\nНэр: ${bk.name} · ${bk.phone}` });
    }
    return;
  }

  // ── Week Plan approve/skip ─────────────────────────────────────
  if (cmd.startsWith('wkp_ok_') || cmd.startsWith('wkp_no_')) {
    const isApprove = cmd.startsWith('wkp_ok_');
    const postId    = cmd.slice(7);

    try {
      const planRef  = dbLFS.doc(`users/${UID}/marketing/weekPlan`);
      const planSnap = await planRef.get();
      const planData = planSnap.exists ? planSnap.data() : {};
      const post     = planData[postId];

      if (!post) { await tgAnswer(cbId, 'Пост олдсонгүй'); return; }

      if (isApprove) {
        await planRef.update({ [`${postId}.status`]: 'approved' });
        await saveToPostHistory(post);
        await tgCall('editMessageReplyMarkup', {
          chat_id: TG_CHAT, message_id: msgId,
          reply_markup: { inline_keyboard: [[{ text: '✅ Approved', callback_data: 'noop' }]] },
        });
        await tgAnswer(cbId, '✅ Approve хийлаа');
      } else {
        await planRef.update({ [`${postId}.status`]: 'skipped' });
        await tgCall('editMessageReplyMarkup', {
          chat_id: TG_CHAT, message_id: msgId,
          reply_markup: { inline_keyboard: [[{ text: '⏭ Skipped', callback_data: 'noop' }]] },
        });
        await tgAnswer(cbId, '⏭ Skip хийлаа');
      }
    } catch (e) {
      console.error('[WeekPlan CB] Error:', e.message);
      await tgAnswer(cbId, 'Алдаа гарлаа');
    }
    return;
  }

  // ── Marketing content queue approve/reject ─────────────────────
  if (cmd.startsWith('mkq_')) {
    const ideaId = cmd.slice(4);
    try {
      const qRef        = dbLFS.doc(`users/${UID}/marketing/weeklyQueue`);
      const qSnap       = await qRef.get();
      const qData       = qSnap.exists ? qSnap.data() : {};
      const pendingKey  = `pending_${ideaId}`;
      const approvedKey = `approved_${ideaId}`;
      const ideaData    = qData[pendingKey] || {};

      await qRef.set({
        [approvedKey]: { ...ideaData, status: 'approved', approvedAt: new Date().toISOString() },
        [pendingKey]:  admin.firestore.FieldValue.delete(),
      }, { merge: true });

      // Post memory-д хадгалах
      await saveToPostHistory(ideaData);
    } catch (e) {
      console.error('[Marketing] Approve error:', e.message);
    }
    await tgCall('editMessageReplyMarkup', {
      chat_id: TG_CHAT, message_id: msgId,
      reply_markup: { inline_keyboard: [[{ text: '✅ Approved', callback_data: 'noop' }]] },
    });
    await tgSend('✅ Постын санаа queue-д нэмэгдлээ.');
    return;
  }

  if (cmd.startsWith('mkx_')) {
    await tgCall('editMessageReplyMarkup', {
      chat_id: TG_CHAT, message_id: msgId,
      reply_markup: { inline_keyboard: [[{ text: '❌ Skipped', callback_data: 'noop' }]] },
    });
    return;
  }

  if (cmd === 'noop') return;

  // ── Ghost post approval ────────────────────────────────────────
  const pSnap = await pendingRef().get();
  if (pSnap.exists) {
    const post = pSnap.data();
    if (msgId == post.telegramMsgId) {
      if (cmd === 'approve') {
        await tgSend('⏳ Нийтэлж байна...');
        const igResult = await postToIG(post.imageUrl, post.caption, post.hashtags);
        if (igResult.ok) {
          await tgCall('editMessageCaption', {
            chat_id: TG_CHAT, message_id: msgId,
            caption: `✅ *Нийтлэгдлээ!*\n\n${post.caption}`, parse_mode: 'Markdown',
          });
          await saveToPostHistory({ title: 'Manual post', caption: post.caption, format: 'single' });
          await pendingRef().delete();
        } else {
          await tgSend(`❌ IG алдаа: ${igResult.err}`);
        }
        return;
      }
      if (cmd === 'reject') {
        await tgCall('editMessageCaption', {
          chat_id: TG_CHAT, message_id: msgId,
          caption: '❌ *Цуцлагдлаа.*', parse_mode: 'Markdown',
        });
        await pendingRef().delete();
        return;
      }
      if (cmd === 'new_image') {
        const newImg = await fetchNewImage(post.topic || 'shanghai china');
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
      const gen      = await generateCaption('', 'single');
      const caption  = gen.fullCaption || 'LFS Shanghai 🌆\n\n👉 lfsshanghai.com';
      const hashtags = gen.hashtags   || '#LFSShanghai #Шанхай';
      const draft = await tgCall('sendPhoto', {
        chat_id: TG_CHAT, photo: ms.fileId || ms.photoUrl,
        caption: `📋 *Draft:*\n\n${caption}`, parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: [[
          { text: '✅ Post хийх', callback_data: 'manual_post' },
          { text: '❌ Цуцлах',   callback_data: 'manual_cancel' },
        ]]},
      });
      await manualRef().set({
        status: 'waiting_final',
        photoUrl: ms.photoUrl, fileId: ms.fileId,
        caption, hashtags,
        draftMsgId: draft.result?.message_id,
      });
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
        const ptRes   = await fetch(`https://graph.facebook.com/v25.0/${FB_ID}?fields=access_token&access_token=${META_TOKEN}`);
        const ptData  = await ptRes.json();
        const pageTok = ptData.access_token || META_TOKEN;
        const fbRes   = await fetch(`https://graph.facebook.com/v25.0/${FB_ID}/photos`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: ms.photoUrl, message: ms.caption, access_token: pageTok }),
        });
        const fbData = await fbRes.json();
        fbMsg = !fbData.error ? '✅ FB нийтлэгдлээ!' : `❌ FB: ${fbData.error?.message}`;
      } catch (e) { fbMsg = `❌ FB алдаа: ${e.message}`; }

      if (igResult.ok) {
        await saveToPostHistory({ title: 'Manual post', caption: ms.caption, format: 'single' });
      }
      await tgSend(igResult.ok
        ? `✅ *IG нийтлэгдлээ!*\n${fbMsg}`
        : `❌ IG алдаа: ${igResult.err}\n${fbMsg}`);
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
  const photoUrl    = `https://api.telegram.org/file/bot${TG_TOKEN}/${fData.result?.file_path}`;
  const userCaption = msg.caption || '';

  if (userCaption) {
    await tgSend('🤖 Caption бэлдэж байна...');
    const gen      = await generateCaption(userCaption, 'single');
    const caption  = gen.fullCaption || userCaption;
    const hashtags = gen.hashtags   || '#LFSShanghai #Шанхай';
    const draft = await tgCall('sendPhoto', {
      chat_id: TG_CHAT, photo: fileId,
      caption: `📋 *Draft:*\n\n${caption}`, parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: [[
        { text: '✅ Post хийх', callback_data: 'manual_post' },
        { text: '❌ Цуцлах',   callback_data: 'manual_cancel' },
      ]]},
    });
    await manualRef().set({
      status: 'waiting_final', photoUrl, fileId,
      caption, hashtags,
      draftMsgId: draft.result?.message_id,
    });
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
    const gen      = await generateCaption(raw, 'single');
    const caption  = gen.fullCaption || raw;
    const hashtags = gen.hashtags   || '#LFSShanghai #Шанхай';
    const draft = await tgCall('sendPhoto', {
      chat_id: TG_CHAT, photo: ms.photoUrl,
      caption: `📋 *Draft:*\n\n${caption}`, parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: [[
        { text: '✅ Post хийх', callback_data: 'manual_post' },
        { text: '❌ Цуцлах',   callback_data: 'manual_cancel' },
      ]]},
    });
    await manualRef().set({
      status: 'waiting_final', photoUrl: ms.photoUrl,
      caption, hashtags,
      draftMsgId: draft.result?.message_id,
    });
    return;
  }

  // ── /weekplan ────────────────────────────────────────────────────
  if (text === '/weekplan') {
    await generateWeekPlan();
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
    const d          = todaySH();
    const todaySnap  = await dbPersonal.doc(`users/${UID}/revenue/${d}`).get();
    const todayData  = todaySnap.exists ? todaySnap.data() : { total: 0, entries: [] };
    const monthPfx   = d.slice(0, 7);
    const allRevSnap = await dbPersonal.collection(`users/${UID}/revenue`).get().catch(() => ({ docs: [] }));
    const monthTotal = allRevSnap.docs
      .filter(doc => doc.id.startsWith(monthPfx))
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

  // ── /week ─────────────────────────────────────────────────────────
  if (text === '/week') {
    const planSnap = await dbLFS.doc(`users/${UID}/marketing/weekPlan`).get();
    if (!planSnap.exists) {
      await tgSend('📅 Долоо хоногийн план байхгүй байна.\n\n`/weekplan` командаар шинэ план үүсгэнэ үү.');
      return;
    }
    const plan = planSnap.data();
    const DAYS = ['Ня', 'Да', 'Мя', 'Лх', 'Пү', 'Ба', 'Бя'];
    let msg = '📅 *7 Хоногийн Post Хуваарь*\n\n';
    const posts = Object.values(plan)
      .filter(p => p && p.date && p.title)
      .sort((a, b) => (a.date + a.slot).localeCompare(b.date + b.slot));

    for (const p of posts) {
      const day  = DAYS[new Date(p.date + 'T12:00:00').getDay()];
      const icon = FORMAT_EMOJI[p.format] || '📸';
      const stat = p.status === 'approved' ? '✅' : p.status === 'skipped' ? '⏭' : '⏳';
      const slot = p.slot === 'evening' ? '🌆' : '🌅';
      msg += `${stat} *${day}* ${slot} ${icon} ${(p.title || '').slice(0, 40)}\n`;
    }
    await tgSend(msg);
    return;
  }

  // ── /history — post memory ────────────────────────────────────────
  if (text === '/history') {
    const history = await getPostHistory();
    if (!history.length) {
      await tgSend('📝 Пост түүх хоосон байна.');
      return;
    }
    let msg = `📝 *Сүүлийн ${history.length} пост:*\n\n`;
    history.slice().reverse().forEach((p, i) => {
      const fIcon = FORMAT_EMOJI[p.format] || '📸';
      msg += `${i + 1}. ${fIcon} *${p.title}*\n`;
      msg += `   _${(p.caption || '').slice(0, 60)}..._\n`;
      msg += `   ${new Date(p.savedAt).toLocaleDateString('mn-MN', { timeZone: 'Asia/Shanghai' })}\n\n`;
    });
    await tgSend(msg.length > 3800 ? msg.slice(0, 3800) + '...' : msg);
    return;
  }

  // ── /help ────────────────────────────────────────────────────────
  if (text === '/help') {
    await tgSend(
      `🏢 *LFS Shanghai Bot v2.0*\n\n` +
      `*📋 Захиалга*\n` +
      `/bookings — хүлээгдэж буй захиалгууд\n\n` +
      `*💰 Орлого*\n` +
      `/income [дүн] [тэмдэглэл] — орлого бүртгэх\n` +
      `/revenue — орлогын тайлан\n\n` +
      `*📸 IG/FB Post*\n` +
      `/weekplan — 7 хоногийн 14 пост үүсгэх 🆕\n` +
      `/week — одоогийн пост хуваарь\n` +
      `/history — approve хийсэн постын түүх 🆕\n` +
      `_Зураг явуулахад → AI caption + нийтлэх_\n\n` +
      `*🤖 AI features*\n` +
      `• LFS brand voice caption\n` +
      `• Single / Carousel / Reel формат\n` +
      `• Post memory — давтахгүй`
    );
    return;
  }
}

// ── SPRINT 4: AI MARKETING CONTENT INTELLIGENCE ───────────────────
// server.js-ийн cron-оор дуудагдана (13:00 Шанхай / 05:00 UTC)
async function generateMarketingIdeas() {
  if (!GEMINI_KEY) { console.warn('[Marketing] GEMINI_API_KEY тохиргоогүй'); return; }

  const today   = todaySH();
  const history = await getPostHistory();
  const usedTopics = history.length
    ? history.map(p => p.title).filter(Boolean).join(', ')
    : '';

  const formats   = ['single', 'carousel', 'reel'];
  const formatPick = formats[Math.floor(Math.random() * formats.length)];

  const prompt =
    `${LFS_BRAND}\n\n` +
    `Өнөөдөр: ${today}\n` +
    (usedTopics ? `Сүүлд хийсэн постуудын сэдэв (ДАВТАХГҮЙ): ${usedTopics}\n\n` : '\n') +
    `Өнөөдрийн Instagram/Facebook постод тохирох 3 санаа бэлдэж өгнө үү.\n` +
    `Форматыг ижил биш болго: 1x single, 1x carousel, 1x reel.\n\n` +
    `Хариу: JSON array ЗӨВХӨН (тайлбар текст хэрэггүй):\n` +
    `[\n` +
    `  {\n` +
    `    "title": "Постын нэр",\n` +
    `    "format": "single|carousel|reel",\n` +
    `    "hook": "Анхны 1-2 мөр (маш хүчтэй, 40 тэмдэгт)",\n` +
    `    "caption": "130-180 тэмдэгт, цэгтэй өгүүлбэр, emoji",\n` +
    `    "cta": "👉 lfsshanghai.com мөр",\n` +
    `    "hashtags": "#LFSShanghai #tag (15 ширхэг)",\n` +
    `    "imageSearch": "Pexels хайх keyword (English)",\n` +
    `    "angle": "Ямар өнцгөөс авсан"\n` +
    `  }\n` +
    `]`;

  try {
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_KEY}`,
      {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: 2000, temperature: 0.9 },
        }),
      }
    );
    const data     = await r.json();
    if (data.error) { console.error('[Marketing] Gemini error:', data.error.message); return; }

    const rawText  = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    const arrMatch = rawText?.match(/\[[\s\S]*\]/);
    if (!arrMatch) { console.error('[Marketing] JSON array гарсангүй'); return; }

    const ideas = JSON.parse(arrMatch[0]);

    for (let i = 0; i < Math.min(ideas.length, 3); i++) {
      const idea   = ideas[i];
      const ideaId = `mk_${Date.now()}_${i}`;
      const fEmoji = FORMAT_EMOJI[idea.format] || '📸';

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
        `${fEmoji} *${idea.title}* — \`${idea.format}\`\n\n` +
        `🪝 *Hook:*\n${idea.hook}\n\n` +
        `📝 *Caption:*\n${idea.caption}\n\n` +
        `${idea.cta}\n\n` +
        `🏷 ${idea.hashtags}\n` +
        `📐 _${idea.angle}_`;

      await tgCall('sendMessage', {
        chat_id:      TG_CHAT,
        text:         msg.length > 3800 ? msg.slice(0, 3800) : msg,
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

module.exports.tgCall                 = tgCall;
module.exports.tgSend                 = (text) => tgCall('sendMessage', { chat_id: TG_CHAT, text, parse_mode: 'Markdown' });
module.exports.generateMarketingIdeas = generateMarketingIdeas;
