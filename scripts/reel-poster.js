// ── LFS REEL POSTER ───────────────────────────────────────────────
// reels/queue.json-оос өнөөдрийн reel-ийг Instagram руу постлоно.
// Caption-ийг ЯГ queue.json дээр бичсэнээр нь тавина (AI-аар өөрчлөхгүй).
// Давхар пост хийхгүй: IG дээр өнөөдөр ижил caption-тай пост байвал алгасна.
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
  ACCESS_TOKEN_META: META_TOKEN,
  GITHUB_REPOSITORY,
  GITHUB_SHA,
} = process.env;

const API = 'https://graph.facebook.com/v25.0';
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
async function graph(method, url, params = {}) {
  const u = new URL(`${API}/${url}`);
  const body = new URLSearchParams({...params, access_token: META_TOKEN});
  const res = method === 'GET'
    ? await fetch(`${u}?${body}`)
    : await fetch(u, {method, body});
  const data = await res.json();
  if (data.error) {
    const e = new Error(`${data.error.message} (code ${data.error.code}${data.error.error_subcode ? '/' + data.error.error_subcode : ''})`);
    e.meta = data.error;
    throw e;
  }
  return data;
}

async function alreadyPosted(caption, date) {
  const first = caption.split('\n')[0].trim();
  const d = await graph('GET', `${IG_ID}/media`, {fields: 'id,caption,timestamp,permalink', limit: '10'});
  return (d.data || []).find((m) => {
    const mDate = new Date(m.timestamp).toLocaleDateString('sv', {timeZone: TZ});
    return mDate === date && (m.caption || '').split('\n')[0].trim() === first;
  });
}

// Файлаа шууд Meta руу upload хийнэ (resumable). Амжилтгүй бол public URL-аар.
async function createContainer(filePath, caption) {
  try {
    const c = await graph('POST', `${IG_ID}/media`, {
      media_type: 'REELS',
      upload_type: 'resumable',
      caption,
      share_to_feed: 'true',
    });
    const buf = fs.readFileSync(filePath);
    const up = await fetch(`https://rupload.facebook.com/ig-api-upload/v25.0/${c.id}`, {
      method: 'POST',
      headers: {Authorization: `OAuth ${META_TOKEN}`, offset: '0', file_size: String(buf.length)},
      body: buf,
    });
    const upData = await up.json().catch(() => ({}));
    if (!up.ok || upData.success === false) throw new Error(`upload ${up.status} ${JSON.stringify(upData).slice(0, 200)}`);
    console.log('[Reel] Uploaded (resumable):', c.id);
    return c.id;
  } catch (e) {
    console.warn('[Reel] Resumable failed, trying video_url:', e.message);
    if (!GITHUB_REPOSITORY) throw e;
    const rel = path.relative(ROOT, filePath).split(path.sep).join('/');
    const videoUrl = `https://raw.githubusercontent.com/${GITHUB_REPOSITORY}/${GITHUB_SHA || 'main'}/${rel}`;
    const c = await graph('POST', `${IG_ID}/media`, {media_type: 'REELS', video_url: videoUrl, caption, share_to_feed: 'true'});
    console.log('[Reel] Container (video_url):', c.id);
    return c.id;
  }
}

async function waitReady(containerId) {
  for (let i = 0; i < 40; i++) {
    const s = await graph('GET', containerId, {fields: 'status_code,status'});
    console.log(`[Reel] status: ${s.status_code}`);
    if (s.status_code === 'FINISHED') return;
    if (s.status_code === 'ERROR' || s.status_code === 'EXPIRED') throw new Error(`Container ${s.status_code}: ${s.status || ''}`);
    await sleep(15000);
  }
  throw new Error('Container 10 минутын дотор бэлэн болсонгүй');
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
    const me = await graph('GET', IG_ID, {fields: 'username,media_count'});
    const lines = [
      'REEL POSTER · шалгалт (постлоогүй)',
      `IG: @${me.username} · токен ажиллаж байна`,
      `Queue: ${queue.filter((x) => !x.skip).length} reel`,
      ...queue.map((x) => `${x.skip ? '⏭' : '•'} ${x.date}  ${x.file}`),
      next || item ? `Дараагийнх: ${(item || next).date} 19:30` : 'Queue хоосон',
    ];
    await tgText(lines.join('\n'));
    const show = item || next;
    if (show) await tgVideo(path.join(REELS_DIR, show.file), `Preview · ${show.date}\n\n${show.caption}`);
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

  const dup = await alreadyPosted(item.caption, date);
  if (dup) {
    console.log('[Reel] Аль хэдийн постлосон:', dup.permalink);
    return;
  }

  const containerId = await createContainer(filePath, item.caption);
  await waitReady(containerId);
  const pub = await graph('POST', `${IG_ID}/media_publish`, {creation_id: containerId});
  let link = '';
  try {
    link = (await graph('GET', pub.id, {fields: 'permalink'})).permalink || '';
  } catch {}
  console.log('[Reel] Published:', pub.id, link);

  await tgText(
    [
      `✅ Reel нийтлэгдлээ · ${date}`,
      link,
      '',
      'Эхний 30 минутад коммент бүрт хариул.',
      next ? `Дараагийнх: ${next.date} · ${next.file}` : 'Queue дууслаа. Шинэ reel нэмэх хэрэгтэй.',
    ].join('\n'),
  );
}

main().catch(async (e) => {
  console.error('[Reel] Fatal:', e.message);
  const hint = /token|session|OAuth|code 190/i.test(e.message)
    ? '\nMeta токены хугацаа дууссан байж магадгүй. ACCESS_TOKEN_META secret-ийг шинэчил.'
    : '';
  await tgText(`❌ Reel пост амжилтгүй (${FORCE_DATE || today()})\n${e.message}${hint}`);
  process.exit(1);
});
