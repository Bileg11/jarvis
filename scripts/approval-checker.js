// ── JARVIS APPROVAL CHECKER ───────────────────────────────────────
// 2 минут тутамд ажиллаж Telegram callback шалгана
// Approve → IG+FB post / Reject → цуцлах / Expire → auto-post

'use strict';
const admin = require('firebase-admin');

const {
  TELEGRAM_BOT_TOKEN_JARVIS: TG_TOKEN,
  TELEGRAM_ID:               TG_CHAT,
  INSTAGRAM_BUSINESS_ID:     IG_ID,
  FACEBOOK_PAGE_ID:          FB_PAGE_ID,
  ACCESS_TOKEN_META:         META_TOKEN,
  FIREBASE_SERVICE_ACCOUNT,
  USER_UID,
  SYSTEM_USE_TOKEN:          GITHUB_TOKEN,
  PEXELS_API_KEY,
  UNSPLASH_ACCESS_KEY,
} = process.env;

const sa = JSON.parse(FIREBASE_SERVICE_ACCOUNT);
admin.initializeApp({ credential: admin.credential.cert(sa) });
const db = admin.firestore();

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function tg(method, body) {
  const res = await fetch(`https://api.telegram.org/bot${TG_TOKEN}/${method}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  return res.json();
}
const tgMsg = text => tg('sendMessage', { chat_id: TG_CHAT, text, parse_mode: 'Markdown' });

// ── FIRESTORE STATE ───────────────────────────────────────────────
async function getPending() {
  const snap = await db.doc(`users/${USER_UID}/marketing/pendingPost`).get();
  if (!snap.exists) return null;
  const d = snap.data();
  if (d.status !== 'pending') return null;
  return d;
}

async function clearPending() {
  await db.doc(`users/${USER_UID}/marketing/pendingPost`).set({ status: 'done', clearedAt: new Date().toISOString() });
}

async function markImageUsed(imageId) {
  const ref  = db.doc(`users/${USER_UID}/marketing/usedImages`);
  const snap = await ref.get();
  const ids  = snap.exists ? (snap.data().ids || []) : [];
  if (!ids.includes(imageId)) {
    ids.push(imageId);
    if (ids.length > 600) ids.splice(0, ids.length - 600);
    await ref.set({ ids, updatedAt: new Date().toISOString() });
  }
}

// ── FETCH WITH TIMEOUT ────────────────────────────────────────────
async function fetchT(url, opts, ms = 15000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try { return await fetch(url, { ...opts, signal: ctrl.signal }); }
  finally { clearTimeout(t); }
}

// ── IG POST ───────────────────────────────────────────────────────
async function postToIG(imageUrl, caption, hashtags) {
  try {
    const cRes  = await fetchT(`https://graph.facebook.com/v25.0/${IG_ID}/media`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image_url: imageUrl, caption, access_token: META_TOKEN }),
    });
    const cData = await cRes.json();
    if (cData.error || !cData.id) return { ok: false, err: cData.error?.message || 'Container алдаа' };

    await sleep(3000);

    const pRes  = await fetchT(`https://graph.facebook.com/v25.0/${IG_ID}/media_publish`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ creation_id: cData.id, access_token: META_TOKEN }),
    });
    const pData = await pRes.json();
    if (pData.error) return { ok: false, err: pData.error.message };

    if (hashtags && pData.id) {
      fetchT(`https://graph.facebook.com/v25.0/${pData.id}/comments`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: hashtags, access_token: META_TOKEN }),
      }).catch(() => {});
    }
    return { ok: true, postId: pData.id };
  } catch (e) { return { ok: false, err: e.message }; }
}

// ── FB POST ───────────────────────────────────────────────────────
async function postToFB(imageUrl, caption, hashtags) {
  if (!FB_PAGE_ID) return { ok: false, err: 'FACEBOOK_PAGE_ID байхгүй' };
  try {
    const res  = await fetchT(`https://graph.facebook.com/v25.0/${FB_PAGE_ID}/photos`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: imageUrl, message: `${caption}\n\n${hashtags || ''}`.trim(), access_token: META_TOKEN }),
    });
    const data = await res.json();
    if (data.error) return { ok: false, err: data.error.message };
    return { ok: true, postId: data.id };
  } catch (e) { return { ok: false, err: e.message }; }
}

async function postToBoth(p) {
  const [ig, fb] = await Promise.all([
    postToIG(p.imageUrl, p.caption, p.hashtags),
    postToFB(p.imageUrl, p.caption, p.hashtags),
  ]);
  return { ig, fb };
}

async function publishAndNotify(p, label = '') {
  // IG эхэлж post хийнэ
  const ig = await postToIG(p.imageUrl, p.caption, p.hashtags);
  await markImageUsed(p.imageId);
  await clearPending();

  // IG үр дүнг шууд мэдэгдэнэ
  if (ig.ok) {
    await tgMsg(`${label}✅ Instagram нийтлэгдлээ!`);
  } else {
    await tgMsg(`${label}❌ Instagram алдаа: ${ig.err}`);
    return;
  }

  // FB-г тусдаа явуулна (алдаа гарсан ч IG-г блок болохгүй)
  const fb = await postToFB(p.imageUrl, p.caption, p.hashtags);
  if (fb.ok) {
    await tgMsg(`✅ Facebook нийтлэгдлээ!`);
  } else {
    await tgMsg(`❌ Facebook алдаа: ${fb.err}`);
  }
}

// ── NEW IMAGE ─────────────────────────────────────────────────────
const IMG_KW = ['shanghai skyline night','shanghai bund river','shanghai modern architecture','shanghai street food','china luxury city','mongolia landscape'];

async function getNewImage(usedImageId) {
  const usedSnap = await db.doc(`users/${USER_UID}/marketing/usedImages`).get();
  const usedIds  = new Set(usedSnap.exists ? (usedSnap.data().ids || []) : []);
  usedIds.add(usedImageId);

  const kw  = IMG_KW[Math.floor(Math.random() * IMG_KW.length)];
  const usePx = Math.random() > 0.5;

  async function tryPexels() {
    const res  = await fetch(`https://api.pexels.com/v1/search?query=${encodeURIComponent(kw)}&per_page=15&orientation=portrait`, { headers: { 'Authorization': PEXELS_API_KEY } });
    const data = await res.json();
    const fresh = (data.photos || []).filter(p => !usedIds.has(`px_${p.id}`));
    if (!fresh.length) return null;
    const p = fresh[Math.floor(Math.random() * Math.min(fresh.length, 8))];
    return { id: `px_${p.id}`, url: p.src.large2x || p.src.large };
  }
  async function tryUnsplash() {
    const res  = await fetch(`https://api.unsplash.com/search/photos?query=${encodeURIComponent(kw)}&per_page=15&orientation=portrait`, { headers: { 'Authorization': `Client-ID ${UNSPLASH_ACCESS_KEY}` } });
    const data = await res.json();
    const fresh = (data.results || []).filter(p => !usedIds.has(`us_${p.id}`));
    if (!fresh.length) return null;
    const p = fresh[Math.floor(Math.random() * Math.min(fresh.length, 8))];
    return { id: `us_${p.id}`, url: p.urls.regular };
  }

  let img = usePx ? await tryPexels() : await tryUnsplash();
  if (!img) img = usePx ? await tryUnsplash() : await tryPexels();
  return img;
}

// ── SEND NEW DRAFT ────────────────────────────────────────────────
async function sendNewDraft(p, newImg) {
  const label = p.slot === 'morning' ? '🌅 Өглөөний' : '🌆 Оройн';
  const text  = `🤖 *JARVIS GHOST MARKETER*\n${label} пост · 🖼️ Шинэ зураг\n\n${p.caption}\n\n_Approve хийхгүй бол автомат нийтлэгдэнэ._`;
  const res = await tg('sendPhoto', {
    chat_id: TG_CHAT, photo: newImg.url, caption: text, parse_mode: 'Markdown',
    reply_markup: { inline_keyboard: [
      [{ text: '✅ Пост болгох', callback_data: 'approve' }, { text: '❌ Цуцлах', callback_data: 'reject' }],
      [{ text: '🖼️ Зураг солих', callback_data: 'new_image' }, { text: '✏️ Текст засах', callback_data: 'edit_text' }],
    ]},
  });
  return res.result?.message_id || null;
}

// ── MAIN ──────────────────────────────────────────────────────────
async function main() {
  console.log('[Checker] Running...');

  const p = await getPending();
  if (!p) { console.log('[Checker] No pending post.'); return; }
  console.log(`[Checker] Pending post found. msgId: ${p.msgId}`);

  // ── Expire шалга → auto-post ─────────────────────────────────
  if (new Date() > new Date(p.expiresAt)) {
    console.log('[Checker] Expired → auto-posting...');
    await tgMsg('⏰ 15 минут дууслаа — автомат нийтэлж байна...');
    await publishAndNotify(p, '🤖 Автомат:');
    return;
  }

  // ── Telegram updates авна ────────────────────────────────────
  const updRes  = await fetch(`https://api.telegram.org/bot${TG_TOKEN}/getUpdates?offset=${p.tgOffset}&limit=50`);
  const updData = await updRes.json();
  const updates = updData.result || [];

  if (updates.length === 0) {
    console.log('[Checker] No new Telegram updates.');
    return;
  }

  // Offset шинэчилнэ
  const newOffset = updates[updates.length - 1].update_id + 1;
  await db.doc(`users/${USER_UID}/marketing/pendingPost`).set({ tgOffset: newOffset }, { merge: true });

  // ── Update-үүдийг боловсруулна ───────────────────────────────
  for (const upd of updates) {
    const cb = upd.callback_query;
    // != ашиглана: Firestore number vs Telegram number type mismatch-г зөвшөөрнө
    if (!cb || cb.message?.message_id != p.msgId) continue;

    await tg('answerCallbackQuery', { callback_query_id: cb.id });

    if (cb.data === 'approve') {
      await tgMsg('⏳ Нийтэлж байна...');
      await publishAndNotify(p, '');
      return;
    }

    if (cb.data === 'reject') {
      await clearPending();
      await tgMsg('❌ Пост цуцлагдлаа.');
      return;
    }

    if (cb.data === 'new_image') {
      const newImg = await getNewImage(p.imageId);
      if (!newImg) { await tgMsg('⚠️ Шинэ зураг олдсонгүй.'); return; }
      const newMsgId = await sendNewDraft(p, newImg);
      await db.doc(`users/${USER_UID}/marketing/pendingPost`).set({
        imageUrl: newImg.url, imageId: newImg.id, msgId: newMsgId,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      }, { merge: true });
      return;
    }

    if (cb.data === 'edit_text') {
      await tgMsg('✏️ Шинэ текстийг Telegram-д тусдаа мессежээр явуул — дараагийн шалгалтад авна.');
      return;
    }
  }

  // ── edit_text-н хариу мессеж шалга ──────────────────────────
  for (const upd of updates) {
    const msg = upd.message;
    if (msg?.text && msg.chat?.id?.toString() === TG_CHAT?.toString() && !msg.photo) {
      // Хэрэглэгч текст явуулсан → caption болгоно
      const newCaption = msg.text;
      await db.doc(`users/${USER_UID}/marketing/pendingPost`).set({ caption: newCaption }, { merge: true });
      await tgMsg(`✅ Caption шинэчлэгдлээ. Дараагийн шалгалтад draft харагдана.`);

      // Шинэ draft явуулна
      const label = p.slot === 'morning' ? '🌅 Өглөөний' : '🌆 Оройн';
      const text  = `🤖 *JARVIS GHOST MARKETER*\n${label} пост\n\n${newCaption}\n\n_Approve хийхгүй бол автомат нийтлэгдэнэ._`;
      const r = await tg('sendPhoto', {
        chat_id: TG_CHAT, photo: p.imageUrl, caption: text, parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: [
          [{ text: '✅ Пост болгох', callback_data: 'approve' }, { text: '❌ Цуцлах', callback_data: 'reject' }],
          [{ text: '🖼️ Зураг солих', callback_data: 'new_image' }, { text: '✏️ Текст засах', callback_data: 'edit_text' }],
        ]},
      });
      if (r.result?.message_id) {
        await db.doc(`users/${USER_UID}/marketing/pendingPost`).set({ msgId: r.result.message_id }, { merge: true });
      }
      return;
    }
  }

  console.log('[Checker] No matching action found.');
}

main().catch(e => { console.error('[Checker] Fatal:', e.message); process.exit(1); });
