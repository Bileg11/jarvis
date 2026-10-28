// ── LFS REEL POSTER ───────────────────────────────────────────────
// reels/queue.json-оос өнөөдрийн reel-ийг Instagram болон Facebook Page руу постлоно.
// Caption-ийг ЯГ queue.json дээр бичсэнээр нь тавина (AI-аар өөрчлөхгүй).
// "first_comment" байвал пост бүрийн доор эхний коммент болгож бичнэ (pin-ийг гараар хийнэ,
// Meta API-д pin хийх функц байхгүй).
// Давхар пост хийхгүй: платформ бүр дээр өнөөдөр ижил caption-тай пост байвал алгасна.
//
//   node scripts/reel-poster.js            → өнөөдрийн reel-ийг постлоно
//   node scripts/reel-poster.js --dry-run  → токен, queue шалгаад Telegram-д preview явуулна, постлохгүй
//   node scripts/reel-poster.js --date=2026-11-02  → тухайн өдрийнхийг (гараар)

'use strict';
const fs = require('fs');
const path = require('path');

const {
  TELEGRAM_BOT_TOKEN_JARVIS: TG_TOKEN,
  TELEGRAM_ID: TG_CHAT,
  INSTAGRAM_BUSINESS_ID: IG_ID,
  FACEBOOK_PAGE_ID: FB_PAGE_ID,
  ACCESS_TOKEN_META: META_TOKEN,
  GITHUB_REPOSITORY,
  GITHUB_SHA,
} = process.env;

const VER = 'v25.0';
const API = `https://graph.facebook.com/${VER}`;
const ROOT = path.join(__dirname, '..');
const REELS_DIR = path.join(ROOT, 'reels');
const TZ = 'Asia/Shanghai';
const POST_FROM_HOUR = 19; // 19:00-оос өмнө ажиллавал постлохгүй (cron эрт ажиллах тохиолдол)

const args = process.argv.slice(2);
const DRY = args.includes('--dry-run');
const FORCE_DATE = (args.find((a) => a.startsWith('--date=')) || '').split('=')[1];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const today = () => new Date().toLocaleDateString('sv', {timeZone: TZ});
const localHour = () => Number(new Date().toLocaleString('en-GB', {timeZone: TZ, hour: '2-digit', hour12: false}));
const dateOf = (iso) => new Date(iso).toLocaleDateString('sv', {timeZone: TZ});
const firstLine = (s) => (s || '').split('\n')[0].trim();

// ── TELEGRAM ──────────────────────────────────────────────────────
async function tgText(text) {
  if (!TG_TOKEN || !TG_CHAT) return;
  try {
    await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({chat_id: TG_CHAT, text, disable_web_page_preview: true}),
    });
  } catch (e) {
    console.error('[Reel] Telegram text failed:', e.message);
  }
}

async function tgVideo(filePath, caption) {
  if (!TG_TOKEN || !TG_CHAT) return;
  try {
    const form = new FormData();
    form.append('chat_id', String(TG_CHAT));
    form.append('caption', caption.slice(0, 1000));
    form.append('supports_streaming', 'true');
    form.append('video', await fs.openAsBlob(filePath, {type: 'video/mp4'}), path.basename(filePath));
    const r = await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendVideo`, {method: 'POST', body: form});
    const d = await r.json();
    if (!d.ok) console.error('[Reel] Telegram video failed:', d.description);
  } catch (e) {
    console.error('[Reel] Telegram video failed:', e.message);
  }
}

// ── QUEUE ─────────────────────────────────────────────────────────
function loadQueue() {
  const q = JSON.parse(fs.readFileSync(path.join(REELS_DIR, 'queue.json'), 'utf8'));
  return (q.items || []).slice().sort((a, b) => a.date.localeCompare(b.date));
}

// ── META ──────────────────────────────────────────────────────────
async function graph(method, url, params = {}, token = META_TOKEN) {
  const u = `${API}/${url}`;
  const body = new URLSearchParams({...params, access_token: token});
  const res = method === 'GET' ? await fetch(`${u}?${body}`) : await fetch(u, {method, body});
  const data = await res.json();
  if (data.error) {
    const e = new Error(`${data.error.message} (code ${data.error.code}${data.error.error_subcode ? '/' + data.error.error_subcode : ''})`);
    e.meta = data.error;
    throw e;
  }
  return data;
}

async function rupload(url, token, buf) {
  const r = await fetch(url, {
    method: 'POST',
    headers: {Authorization: `OAuth ${token}`, offset: '0', file_size: String(buf.length)},
    body: buf,
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || d.success === false || d.error) throw new Error(`upload ${r.status} ${JSON.stringify(d).slice(0, 200)}`);
  return d;
}

// Page руу постлохын тулд Page token хэрэгтэй. META_TOKEN нь user token бол Page token-оо гаргаж авна.
let pageTokenCache = null;
async function pageToken() {
  if (pageTokenCache) return pageTokenCache;
  try {
    const d = await graph('GET', FB_PAGE_ID, {fields: 'access_token,name'});
    pageTokenCache = d.access_token || META_TOKEN;
  } catch {
    pageTokenCache = META_TOKEN; // аль хэдийн Page token байж магадгүй
  }
  return pageTokenCache;
}

// ── INSTAGRAM ─────────────────────────────────────────────────────
async function igAlreadyPosted(caption, date) {
  const d = await graph('GET', `${IG_ID}/media`, {fields: 'id,caption,timestamp,permalink', limit: '10'});
  return (d.data || []).find((m) => dateOf(m.timestamp) === date && firstLine(m.caption) === firstLine(caption));
}

async function igContainer(filePath, caption) {
  try {
    const c = await graph('POST', `${IG_ID}/media`, {media_type: 'REELS', upload_type: 'resumable', caption, share_to_feed: 'true'});
    await rupload(`https://rupload.facebook.com/ig-api-upload/${VER}/${c.id}`, META_TOKEN, fs.readFileSync(filePath));
    return c.id;
  } catch (e) {
    console.warn('[IG] Resumable failed, trying video_url:', e.message);
    if (!GITHUB_REPOSITORY) throw e;
    const rel = path.relative(ROOT, filePath).split(path.sep).join('/');
    const videoUrl = `https://raw.githubusercontent.com/${GITHUB_REPOSITORY}/${GITHUB_SHA || 'main'}/${rel}`;
    const c = await graph('POST', `${IG_ID}/media`, {media_type: 'REELS', video_url: videoUrl, caption, share_to_feed: 'true'});
    return c.id;
  }
}

async function igWaitReady(containerId) {
  for (let i = 0; i < 40; i++) {
    const s = await graph('GET', containerId, {fields: 'status_code,status'});
    console.log(`[IG] status: ${s.status_code}`);
    if (s.status_code === 'FINISHED') return;
    if (s.status_code === 'ERROR' || s.status_code === 'EXPIRED') throw new Error(`Container ${s.status_code}: ${s.status || ''}`);
    await sleep(15000);
  }
  throw new Error('Container 10 минутын дотор бэлэн болсонгүй');
}

async function postIG(item, date, filePath) {
  const dup = await igAlreadyPosted(item.caption, date);
  if (dup) return {status: 'skip', link: dup.permalink};
  const containerId = await igContainer(filePath, item.caption);
  await igWaitReady(containerId);
  const pub = await graph('POST', `${IG_ID}/media_publish`, {creation_id: containerId});
  let link = '';
  try {
    link = (await graph('GET', pub.id, {fields: 'permalink'})).permalink || '';
  } catch {}
  let commented = false;
  if (item.first_comment) {
    try {
      await sleep(3000);
      await graph('POST', `${pub.id}/comments`, {message: item.first_comment});
      commented = true;
    } catch (e) {
      console.warn('[IG] comment failed:', e.message);
    }
  }
  return {status: 'ok', link, commented};
}

// ── FACEBOOK PAGE (Reels) ─────────────────────────────────────────
async function fbAlreadyPosted(caption, date, token) {
  try {
    const d = await graph('GET', `${FB_PAGE_ID}/video_reels`, {fields: 'id,description,created_time,permalink_url', limit: '10'}, token);
    return (d.data || []).find((v) => dateOf(v.created_time) === date && firstLine(v.description) === firstLine(caption));
  } catch {
    return null;
  }
}

async function postFB(item, date, filePath) {
  const token = await pageToken();
  const dup = await fbAlreadyPosted(item.caption, date, token);
  if (dup) return {status: 'skip', link: dup.permalink_url ? `https://www.facebook.com${dup.permalink_url}` : ''};

  const start = await graph('POST', `${FB_PAGE_ID}/video_reels`, {upload_phase: 'start'}, token);
  const videoId = start.video_id;
  await rupload(start.upload_url || `https://rupload.facebook.com/video-upload/${VER}/${videoId}`, token, fs.readFileSync(filePath));
  await graph('POST', `${FB_PAGE_ID}/video_reels`, {
    upload_phase: 'finish',
    video_id: videoId,
    video_state: 'PUBLISHED',
    description: item.caption,
  }, token);

  // Боловсруулж дуусахыг хүлээнэ
  for (let i = 0; i < 40; i++) {
    const s = await graph('GET', videoId, {fields: 'status'}, token).catch(() => ({}));
    const vs = s.status?.video_status;
    const ph = s.status?.publishing_phase?.status;
    console.log(`[FB] status: ${vs} / publish: ${ph}`);
    if (vs === 'error' || ph === 'error') throw new Error(`FB video error: ${JSON.stringify(s.status).slice(0, 200)}`);
    if (vs === 'ready' && (ph === 'complete' || ph === undefined)) break;
    await sleep(15000);
  }

  let link = '';
  try {
    const v = await graph('GET', videoId, {fields: 'permalink_url'}, token);
    link = v.permalink_url ? `https://www.facebook.com${v.permalink_url}` : '';
  } catch {}
  let commented = false;
  if (item.first_comment) {
    try {
      await graph('POST', `${videoId}/comments`, {message: item.first_comment}, token);
      commented = true;
    } catch (e) {
      console.warn('[FB] comment failed:', e.message);
    }
  }
  return {status: 'ok', link, commented};
}

// ── MAIN ──────────────────────────────────────────────────────────
async function main() {
  const missing = ['TELEGRAM_BOT_TOKEN_JARVIS', 'TELEGRAM_ID', 'INSTAGRAM_BUSINESS_ID', 'ACCESS_TOKEN_META'].filter((k) => !process.env[k]);
  if (missing.length) throw new Error(`Secret дутуу: ${missing.join(', ')}`);

  const date = FORCE_DATE || today();
  const queue = loadQueue();
  const item = queue.find((x) => x.date === date && !x.skip);
  const next = queue.find((x) => x.date > date && !x.skip);
  console.log(`[Reel] ${date} ${localHour()}h | item: ${item ? item.file : '-'} | next: ${next ? next.date : '-'} | dry: ${DRY}`);

  if (DRY) {
    const me = await graph('GET', IG_ID, {fields: 'username'});
    let fbLine = 'FB Page: FACEBOOK_PAGE_ID secret алга, FB руу постлохгүй';
    if (FB_PAGE_ID) {
      try {
        const pt = await pageToken();
        const p = await graph('GET', FB_PAGE_ID, {fields: 'name'}, pt);
        fbLine = `FB Page: ${p.name} · токен ажиллаж байна`;
      } catch (e) {
        fbLine = `FB Page: АЛДАА ${e.message}`;
      }
    }
    const lines = [
      'REEL POSTER · шалгалт (постлоогүй)',
      `IG: @${me.username} · токен ажиллаж байна`,
      fbLine,
      `Queue: ${queue.filter((x) => !x.skip).length} reel`,
      ...queue.map((x) => `${x.skip ? '⏭' : '•'} ${x.date}  ${x.file}`),
      next || item ? `Дараагийнх: ${(item || next).date} 19:30` : 'Queue хоосон',
    ];
    await tgText(lines.join('\n'));
    const show = item || next;
    if (show) {
      await tgVideo(
        path.join(REELS_DIR, show.file),
        `Preview · ${show.date}\n\n${show.caption}${show.first_comment ? `\n\n💬 Эхний коммент:\n${show.first_comment}` : ''}`,
      );
    }
    console.log('[Reel] Dry run OK');
    return;
  }

  if (!item) {
    console.log('[Reel] Өнөөдөр reel байхгүй.');
    return;
  }
  if (!FORCE_DATE && localHour() < POST_FROM_HOUR) {
    console.log(`[Reel] Хэт эрт (${localHour()}ц). ${POST_FROM_HOUR}:00-оос хойш постлоно.`);
    return;
  }

  const filePath = path.join(REELS_DIR, item.file);
  if (!fs.existsSync(filePath)) throw new Error(`Файл олдсонгүй: reels/${item.file}`);

  // Платформ бүрийг тусад нь. Нэг нь унавал нөгөө нь гарна.
  const results = {};
  const targets = [['IG', postIG]];
  if (FB_PAGE_ID) targets.push(['FB', postFB]);
  for (const [name, fn] of targets) {
    try {
      results[name] = await fn(item, date, filePath);
      console.log(`[${name}]`, JSON.stringify(results[name]));
    } catch (e) {
      console.error(`[${name}] failed:`, e.message);
      results[name] = {status: 'error', err: e.message};
    }
  }

  const line = (name, r) => {
    if (!r) return `${name}: (тохиргоогүй)`;
    if (r.status === 'ok') return `${name}: ✅ ${r.link}${item.first_comment ? (r.commented ? '\n   коммент бичсэн → PIN хий' : '\n   ⚠️ коммент бичиж чадсангүй') : ''}`;
    if (r.status === 'skip') return `${name}: аль хэдийн постлосон ${r.link || ''}`;
    const tokenHint = /token|session|OAuth|code 190/i.test(r.err) ? ' (Meta токен дууссан байж магадгүй)' : '';
    return `${name}: ❌ ${r.err}${tokenHint}`;
  };

  await tgText(
    [
      `Reel · ${date} · ${item.file}`,
      line('IG', results.IG),
      line('FB', results.FB),
      '',
      'Эхний 30 минутад коммент бүрт хариул.',
      next ? `Дараагийнх: ${next.date} · ${next.file}` : '⚠️ Queue дууслаа. Шинэ reel нэмэх хэрэгтэй.',
    ].join('\n'),
  );

  if (Object.values(results).some((r) => r.status === 'error')) process.exit(1);
}

main().catch(async (e) => {
  console.error('[Reel] Fatal:', e.message);
  const hint = /token|session|OAuth|code 190/i.test(e.message)
    ? '\nMeta токены хугацаа дууссан байж магадгүй. ACCESS_TOKEN_META secret-ийг шинэчил.'
    : '';
  await tgText(`❌ Reel пост амжилтгүй (${FORCE_DATE || today()})\n${e.message}${hint}`);
  process.exit(1);
});
