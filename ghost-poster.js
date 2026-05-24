// ── JARVIS GHOST MARKETER ─────────────────────────────────────────
// Tavily → trending topic → GPT-4o-mini caption → Pexels/Unsplash image
// → Telegram draft (approve / reject / new image / edit text)
// → Instagram publish
// Firestore-д ашигласан зурагны ID хадгалж давтахгүй

'use strict';
const admin = require('firebase-admin');

// ── ENV ───────────────────────────────────────────────────────────
const {
  PEXELS_API_KEY,
  UNSPLASH_ACCESS_KEY,
  TELEGRAM_BOT_TOKEN_JARVIS: TG_TOKEN,
  TELEGRAM_ID:               TG_CHAT,
  INSTAGRAM_BUSINESS_ID:     IG_ID,
  ACCESS_TOKEN_META:         META_TOKEN,
  FIREBASE_SERVICE_ACCOUNT,
  USER_UID,
  TAVILY_KEY,
  SYSTEM_USE_TOKEN:          GITHUB_TOKEN,
} = process.env;

// ── FIREBASE ──────────────────────────────────────────────────────
const sa = JSON.parse(FIREBASE_SERVICE_ACCOUNT);
admin.initializeApp({ credential: admin.credential.cert(sa) });
const db = admin.firestore();

// ── HELPERS ───────────────────────────────────────────────────────
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function tg(method, body) {
  const res = await fetch(`https://api.telegram.org/bot${TG_TOKEN}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.json();
}

async function tgMsg(text) {
  return tg('sendMessage', { chat_id: TG_CHAT, text, parse_mode: 'Markdown' });
}

// ── USED IMAGES (Firestore dedup) ─────────────────────────────────
async function getUsedIds() {
  const snap = await db.doc(`users/${USER_UID}/marketing/usedImages`).get();
  return new Set(snap.exists ? (snap.data().ids || []) : []);
}

async function markUsed(imageId) {
  const ref = db.doc(`users/${USER_UID}/marketing/usedImages`);
  const snap = await ref.get();
  const ids  = snap.exists ? (snap.data().ids || []) : [];
  if (ids.includes(imageId)) return;
  ids.push(imageId);
  if (ids.length > 600) ids.splice(0, ids.length - 600);
  await ref.set({ ids, updatedAt: new Date().toISOString() });
}

// ── TAVILY — TRENDING TOPIC ───────────────────────────────────────
const TOPIC_POOL = [
  'Shanghai travel tips for Mongolians 2025',
  'Shanghai tourism hidden gems attractions',
  'Shanghai street food guide Mongolian tourists',
  'Shanghai luxury experience VIP travel',
  'Mongolia expat life in Shanghai guide',
  'Shanghai Bund night skyline tourism',
  'Shanghai traditional culture modern city life',
  'China travel visa tips Mongolia tourists',
  'Shanghai medical tourism international packages',
  'Shanghai fashion shopping Nanjing Road',
  'Shanghai Disney resort family travel',
  'Shanghai business district Pudong modern life',
];

async function getTrend() {
  const q = TOPIC_POOL[Math.floor(Math.random() * TOPIC_POOL.length)];
  try {
    const res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_key: TAVILY_KEY, query: q, max_results: 3, search_depth: 'basic' }),
    });
    const data = await res.json();
    const snippets = (data.results || [])
      .map(r => r.content || r.snippet || '')
      .join(' ')
      .replace(/\s+/g, ' ')
      .slice(0, 900);
    return { query: q, snippets };
  } catch (e) {
    console.warn('[Tavily]', e.message);
    return { query: q, snippets: '' };
  }
}

// ── GPT-4o-mini — CAPTION + HASHTAGS ─────────────────────────────
async function generateCaption(query, snippets) {
  const prompt = `Та LFS Shanghai компанийн Instagram маркетинг менежер юм.
LFS Shanghai — Монгол аялагчдад зориулсан Шанхайн VIP туслалцааны платформ (bileg11.github.io).

Дараах мэдээллээс сэдэвлэн Instagram пост бич:
Сэдэв: ${query}
Мэдээлэл: ${snippets || 'Шанхай хот дэлхийн хамгийн динамик мегаполисуудын нэг.'}

Дүрэм:
- Монгол хэлээр бич
- 3-4 сэтгэл хөдөлгөм өгүүлбэр (inspire + inform)
- LFS Shanghai-г байгалийн байдлаар нэг удаа дурдана
- Emoji зохилдуулна (4-6 ш)
- Заавал "👉 bileg11.github.io" гэсэн CTA нэмнэ
- Дараа нь ШУУД 18-22 hashtag бич (Монгол + Англи + Хятад, #-тай)
  Жишээ: #Шанхай #Shanghai #上海 #LFSShanghai #МонголАялал #ШанхайАмьдрал #ChinaTravel #蒙古旅行

Зөвхөн постын текст буцаана, өөр тайлбар хэрэгтэй.`;

  try {
    const res = await fetch('https://models.inference.ai.azure.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GITHUB_TOKEN}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 700,
        temperature: 0.88,
      }),
    });
    const data = await res.json();
    return data.choices?.[0]?.message?.content?.trim() || null;
  } catch (e) {
    console.warn('[GPT]', e.message);
    return null;
  }
}

// ── IMAGE SOURCES ─────────────────────────────────────────────────
const IMG_KEYWORDS = [
  'shanghai skyline night', 'shanghai bund river', 'shanghai modern tower',
  'shanghai street food market', 'shanghai traditional garden temple',
  'china city lights luxury', 'shanghai pudong aerial view',
  'mongolia travel adventure landscape', 'shanghai fashion district',
  'china travel culture heritage', 'shanghai rooftop view city',
  'shanghai metro modern transport',
];

async function pexelsImage(usedIds) {
  const kw = IMG_KEYWORDS[Math.floor(Math.random() * IMG_KEYWORDS.length)];
  try {
    const res = await fetch(
      `https://api.pexels.com/v1/search?query=${encodeURIComponent(kw)}&per_page=20&orientation=portrait`,
      { headers: { 'Authorization': PEXELS_API_KEY } }
    );
    const data = await res.json();
    const fresh = (data.photos || []).filter(p => !usedIds.has(`px_${p.id}`));
    if (!fresh.length) return null;
    const p = fresh[Math.floor(Math.random() * Math.min(fresh.length, 8))];
    return { id: `px_${p.id}`, url: p.src.large2x || p.src.large, source: 'Pexels', keyword: kw };
  } catch { return null; }
}

async function unsplashImage(usedIds) {
  const kw = IMG_KEYWORDS[Math.floor(Math.random() * IMG_KEYWORDS.length)];
  try {
    const res = await fetch(
      `https://api.unsplash.com/search/photos?query=${encodeURIComponent(kw)}&per_page=20&orientation=portrait`,
      { headers: { 'Authorization': `Client-ID ${UNSPLASH_ACCESS_KEY}` } }
    );
    const data = await res.json();
    const fresh = (data.results || []).filter(p => !usedIds.has(`us_${p.id}`));
    if (!fresh.length) return null;
    const p = fresh[Math.floor(Math.random() * Math.min(fresh.length, 8))];
    return { id: `us_${p.id}`, url: p.urls.regular, source: 'Unsplash', keyword: kw };
  } catch { return null; }
}

async function fetchImage(usedIds, excludeId = null) {
  const excl = new Set([...usedIds, ...(excludeId ? [excludeId] : [])]);
  const usePx = Math.random() > 0.5;
  let img = usePx ? await pexelsImage(excl) : await unsplashImage(excl);
  if (!img) img = usePx ? await unsplashImage(excl) : await pexelsImage(excl);
  return img;
}

// ── INSTAGRAM PUBLISH ─────────────────────────────────────────────
async function postToIG(imageUrl, caption) {
  try {
    const cRes = await fetch(`https://graph.facebook.com/v25.0/${IG_ID}/media`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image_url: imageUrl, caption, access_token: META_TOKEN }),
    });
    const cData = await cRes.json();
    if (cData.error || !cData.id) {
      return { ok: false, err: cData.error?.message || 'Container ID алдаа' };
    }

    await sleep(4000); // Media processing

    const pRes = await fetch(`https://graph.facebook.com/v25.0/${IG_ID}/media_publish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ creation_id: cData.id, access_token: META_TOKEN }),
    });
    const pData = await pRes.json();
    if (pData.error) return { ok: false, err: pData.error.message };
    return { ok: true, postId: pData.id };
  } catch (e) {
    return { ok: false, err: e.message };
  }
}

// ── TELEGRAM DRAFT UI ─────────────────────────────────────────────
function draftText(caption, source, keyword, slot) {
  const label = slot === 'morning' ? '🌅 Өглөөний пост' : '🌆 Оройн пост';
  return `🤖 *JARVIS GHOST MARKETER*\n${label} · 📸 ${source} (${keyword})\n\n${caption}\n\n_Доорх товчлуурыг дарж үйлдлийг сонгоно уу._`;
}

function draftKeyboard() {
  return {
    inline_keyboard: [
      [
        { text: '✅ Пост болгох',  callback_data: 'approve'   },
        { text: '❌ Цуцлах',       callback_data: 'reject'    },
      ],
      [
        { text: '🖼️ Зураг солих', callback_data: 'new_image' },
        { text: '✏️ Текст засах', callback_data: 'edit_text' },
      ],
    ],
  };
}

async function sendDraft(caption, img, slot) {
  const res = await tg('sendPhoto', {
    chat_id:      TG_CHAT,
    photo:        img.url,
    caption:      draftText(caption, img.source, img.keyword, slot),
    parse_mode:   'Markdown',
    reply_markup: draftKeyboard(),
  });
  return res.result?.message_id || null;
}

async function editDraftCaption(msgId, caption, img, slot) {
  await tg('editMessageCaption', {
    chat_id:      TG_CHAT,
    message_id:   msgId,
    caption:      draftText(caption, img.source, img.keyword, slot),
    parse_mode:   'Markdown',
    reply_markup: draftKeyboard(),
  });
}

// ── APPROVAL LOOP ─────────────────────────────────────────────────
async function approvalLoop({ msgId, caption, img, slot, usedIds }) {
  let curCaption = caption;
  let curImg     = img;
  let curMsgId   = msgId;
  let state      = 'approval';   // 'approval' | 'waiting_text'
  let editMsgId  = null;
  let offset     = 0;

  const DEADLINE = Date.now() + 15 * 60 * 1000; // 15 min

  while (Date.now() < DEADLINE) {
    let res;
    try {
      res = await fetch(
        `https://api.telegram.org/bot${TG_TOKEN}/getUpdates?offset=${offset}&timeout=5`
      );
      res = await res.json();
    } catch { await sleep(3000); continue; }

    for (const upd of (res.result || [])) {
      offset = upd.update_id + 1;

      // ── Button press ────────────────────────────────────
      const cb = upd.callback_query;
      if (state === 'approval' && cb?.message?.message_id === curMsgId) {
        await tg('answerCallbackQuery', { callback_query_id: cb.id });

        if (cb.data === 'approve') {
          await tgMsg('⏳ Instagram-д нийтэлж байна...');
          const r = await postToIG(curImg.url, curCaption);
          if (r.ok) {
            await markUsed(curImg.id);
            await tgMsg(`✅ Амжилттай нийтлэгдлээ!\n🆔 Post ID: \`${r.postId}\``);
          } else {
            await tgMsg(`❌ Instagram алдаа:\n\`${r.err}\``);
          }
          return;
        }

        if (cb.data === 'reject') {
          await tgMsg('❌ Пост цуцлагдлаа.');
          return;
        }

        if (cb.data === 'new_image') {
          await tgMsg('🔍 Шинэ зураг хайж байна...');
          const newImg = await fetchImage(usedIds, curImg.id);
          if (!newImg) {
            await tgMsg('⚠️ Шинэ зураг олдсонгүй. Одоогийн зургаа хэрэглэнэ.');
          } else {
            curImg = newImg;
            // Telegram-д зураг засах боломжгүй → шинэ мессеж илгээнэ
            const nr = await sendDraft(curCaption, curImg, slot);
            if (nr) curMsgId = nr;
          }
        }

        if (cb.data === 'edit_text') {
          state = 'waiting_text';
          const er = await tg('sendMessage', {
            chat_id:      TG_CHAT,
            text:         '✏️ Шинэ постын текстийг энд reply хийж бичнэ үү:',
            reply_markup: { force_reply: true, selective: false },
          });
          editMsgId = er.result?.message_id;
        }
      }

      // ── Text reply (after ✏️) ───────────────────────────
      const msg = upd.message;
      if (
        state === 'waiting_text' &&
        msg?.reply_to_message?.message_id === editMsgId &&
        msg?.text
      ) {
        curCaption = msg.text;
        state      = 'approval';
        await editDraftCaption(curMsgId, curCaption, curImg, slot);
        await tgMsg('✅ Текст шинэчлэгдлээ. Draft-аас үргэлжлүүлнэ үү.');
      }
    }

    await sleep(2000);
  }

  await tgMsg('⏰ 15 минут дууслаа. Пост цуцлагдлаа.');
}

// ── MAIN ──────────────────────────────────────────────────────────
async function main() {
  const utcH = new Date().getUTCHours();
  const slot  = utcH < 6 ? 'morning' : 'evening'; // 08:00 / 18:00 Shanghai
  console.log(`[JARVIS] Ghost Marketer — ${slot} | ${new Date().toISOString()}`);

  // 1. Used image IDs from Firestore
  const usedIds = await getUsedIds();
  console.log(`[JARVIS] Used images: ${usedIds.size}`);

  // 2. Trending topic via Tavily
  const { query, snippets } = await getTrend();
  console.log(`[JARVIS] Topic: ${query}`);

  // 3. AI caption via GPT-4o-mini
  let caption = await generateCaption(query, snippets);
  if (!caption) {
    caption = `Шанхай хот — Монгол аялагчдын хамгийн их сонирхдог газруудын нэг! 🌆✨\n\nБунд дахь гэрэлтэй тэнгэр, орчин үеийн архитектур, баялаг хоол — LFS Shanghai бүгдийг нэг дор санал болгодог.\n\n👉 bileg11.github.io\n\n#Шанхай #Shanghai #上海 #LFSShanghai #МонголАялал #ШанхайАмьдрал #ChinaTravel #蒙古旅行 #ShanghaiLife #AmazingShanghai #TravelChina #上海旅游 #МонголШанхай #VIPTravel #ШанхайХот #ShanghaiSkyline #ExploreShanghai #Mongols #TravelAsia #旅行`;
  }

  // 4. Fresh image (not used before)
  const img = await fetchImage(usedIds);
  if (!img) {
    await tgMsg('⚠️ Зураг олдсонгүй — Pexels/Unsplash нөөц дууссан байж болно.');
    process.exit(1);
  }
  console.log(`[JARVIS] Image: ${img.source} ${img.id}`);

  // 5. Send Telegram draft
  const msgId = await sendDraft(caption, img, slot);
  if (!msgId) {
    console.error('[JARVIS] Telegram draft failed');
    process.exit(1);
  }
  console.log(`[JARVIS] Draft sent. MsgID: ${msgId}`);

  // 6. Approval loop (15 min)
  await approvalLoop({ msgId, caption, img, slot, usedIds });

  console.log('[JARVIS] Done.');
  process.exit(0);
}

main().catch(e => {
  console.error('[JARVIS] Fatal:', e.message);
  process.exit(1);
});
