#!/usr/bin/env node
// ---------------------------------------------------------------------------
// publish.js
// output/<slug>/ доторх PNG-үүдийг Instagram carousel + Facebook Page руу нийтэлнэ.
//
//   node scripts/publish.js                 # DRY RUN (юу ч нийтлэхгүй)
//   node scripts/publish.js --yes           # жинхэнээсээ нийтэлнэ
//   node scripts/publish.js --only fb --yes
//
// HOSTING ХЭРЭГГҮЙ:
//   Facebook зургийн файлыг шууд (multipart) хүлээж авдаг тул гадны hosting
//   шаардлагагүй. Instagram нь нээлттэй URL шаарддаг ч, бид зургийг эхлээд
//   Facebook Page руу published=false-оор тавиад, Graph API-аас буцаж ирэх
//   scontent.fbcdn.net хаягийг нь Instagram-д дамжуулна.
//   Нэмэлт ашиг: Facebook зургийг JPEG болгож хувиргадаг тул Instagram-ын
//   JPEG шаардлага ч автоматаар биелнэ.
// ---------------------------------------------------------------------------

import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

/* ------------------------------------------------------------- тохиргоо -- */
// Нэрийг нь хоёр янзаар дэмжинэ: энэ төслийнх, болон jarvis repo-д хэвшсэн нэр.
const pick = (...names) => {
  for (const n of names) {
    const v = process.env[n];
    if (v && v.trim()) return v.trim();
  }
  return '';
};

const API = pick('META_API_VERSION', 'FB_API_VERSION') || 'v21.0';
const TOKEN = pick('META_ACCESS_TOKEN', 'FB_PAGE_TOKEN_AI_OFFICE', 'FB_PAGE_TOKEN', 'ACCESS_TOKEN_META');
const FB_PAGE_ID = pick('FB_PAGE_ID', 'FACEBOOK_PAGE_ID');
const IG_USER_ID = pick('IG_USER_ID', 'INSTAGRAM_BUSINESS_ID');
// Сонголт: өөрийн hosting ашиглах бол энд үндсэн хаягийг өгнө.
const MEDIA_BASE = pick('PUBLIC_MEDIA_BASE').replace(/\/+$/, '');

const GRAPH = `https://graph.facebook.com/${API}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ----------------------------------------------------------- Graph API --- */
async function graph(method, pathname, params = {}) {
  const body = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null) continue;
    body.set(k, typeof v === 'object' ? JSON.stringify(v) : String(v));
  }
  body.set('access_token', TOKEN);

  const res =
    method === 'GET'
      ? await fetch(`${GRAPH}/${pathname}?${body}`)
      : await fetch(`${GRAPH}/${pathname}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body,
        });
  return handle(res, `${method} ${pathname}`);
}

/** Зургийн файлыг ШУУД (multipart) Facebook руу илгээнэ. Hosting хэрэггүй. */
async function graphUpload(pathname, filePath, params = {}) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null) continue;
    fd.set(k, String(v));
  }
  const buf = fs.readFileSync(filePath);
  fd.set('source', new Blob([buf], { type: 'image/png' }), path.basename(filePath));
  fd.set('access_token', TOKEN);

  const res = await fetch(`${GRAPH}/${pathname}`, { method: 'POST', body: fd });
  return handle(res, `UPLOAD ${pathname}`);
}

async function handle(res, label) {
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.error) {
    const e = json.error ?? {};
    throw new Error(
      `Graph ${label} -> ${res.status}: ${e.message ?? 'тодорхойгүй алдаа'}` +
        (e.error_user_msg ? ` (${e.error_user_msg})` : '') +
        (e.code ? ` [code ${e.code}${e.error_subcode ? '/' + e.error_subcode : ''}]` : ''),
    );
  }
  return json;
}

/* --------------------------------------------------------------- манифест */
function loadManifest(slugArg) {
  const outRoot = path.join(ROOT, 'output');
  if (!fs.existsSync(outRoot)) throw new Error('output/ хавтас байхгүй. Эхлээд render хий.');

  let slug = slugArg;
  if (!slug) {
    const dirs = fs
      .readdirSync(outRoot, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => ({ name: d.name, t: fs.statSync(path.join(outRoot, d.name)).mtimeMs }))
      .sort((a, b) => b.t - a.t);
    if (!dirs.length) throw new Error('output/ дотор пост олдсонгүй.');
    slug = dirs[0].name;
  }

  const dir = path.join(outRoot, slug);
  const mf = path.join(dir, 'manifest.json');
  if (!fs.existsSync(mf)) throw new Error(`manifest.json байхгүй: ${path.relative(ROOT, mf)}`);
  return { dir, slug, manifest: JSON.parse(fs.readFileSync(mf, 'utf8')) };
}

function buildCaption(manifest) {
  const tags = (manifest.hashtags ?? []).join(' ');
  return [manifest.caption?.trim(), tags].filter(Boolean).join('\n\n').slice(0, 2190);
}

/* ------------------------------------------------------------ байршуулах - */
/**
 * Зураг бүрийг Facebook Page руу published=false-оор тавина.
 * Буцаах: [{ file, fbid, publicUrl }]
 * publicUrl нь Instagram-д хэрэглэгдэх scontent.fbcdn.net хаяг (JPEG).
 */
async function uploadAll(dir, files) {
  console.log(`\nFacebook руу зураг байршуулж байна (${files.length})`);
  const out = [];

  for (const [i, file] of files.entries()) {
    const full = path.join(dir, file);
    const photo = await graphUpload(`${FB_PAGE_ID}/photos`, full, { published: 'false' });

    // Нийтэд нээлттэй хаягийг нь асууна. images нь хэмжээ бүрээр ирдэг тул
    // хамгийн өргөнийг нь сонгоно.
    const meta = await graph('GET', photo.id, { fields: 'images' });
    const best = (meta.images ?? []).slice().sort((a, b) => (b.width ?? 0) - (a.width ?? 0))[0];
    if (!best?.source) {
      throw new Error(`Зургийн нээлттэй хаяг олдсонгүй (photo ${photo.id}).`);
    }

    console.log(`  [${i + 1}/${files.length}] ${file} -> ${photo.id} (${best.width}px)`);
    out.push({ file, fbid: photo.id, publicUrl: best.source });
  }
  return out;
}

/* ------------------------------------------------------------- Facebook -- */
/** Олон зурагтай нэг пост: аль хэдийн байршуулсан зургуудыг хавсаргана. */
async function publishFacebook(uploads, message) {
  console.log(`\nFacebook Page пост (${uploads.length} зураг)`);
  const post = await graph('POST', `${FB_PAGE_ID}/feed`, {
    message,
    attached_media: uploads.map((u) => ({ media_fbid: u.fbid })),
  });
  console.log(`  НИЙТЛЭГДЛЭЭ: ${post.id}`);
  return post.id;
}

/* ------------------------------------------------------------ Instagram -- */
/** IG carousel: item container -> carousel container -> publish. */
async function publishInstagram(urls, caption) {
  console.log(`\nInstagram carousel (${urls.length} зураг)`);

  const children = [];
  for (const [i, imageUrl] of urls.entries()) {
    const r = await graph('POST', `${IG_USER_ID}/media`, {
      image_url: imageUrl,
      is_carousel_item: true,
    });
    console.log(`  [${i + 1}/${urls.length}] item ${r.id}`);
    children.push(r.id);
  }

  const carousel = await graph('POST', `${IG_USER_ID}/media`, {
    media_type: 'CAROUSEL',
    children: children.join(','),
    caption,
  });
  console.log(`  carousel container ${carousel.id}`);

  // Meta зургуудыг боловсруулж дуустал хүлээнэ
  for (let i = 0; i < 30; i++) {
    const st = await graph('GET', carousel.id, { fields: 'status_code,status' });
    if (st.status_code === 'FINISHED') break;
    if (st.status_code === 'ERROR') throw new Error(`IG container алдаа: ${st.status ?? ''}`);
    await sleep(3000);
  }

  const published = await graph('POST', `${IG_USER_ID}/media_publish`, {
    creation_id: carousel.id,
  });
  console.log(`  НИЙТЛЭГДЛЭЭ: ${published.id}`);
  return published.id;
}

/* ---------------------------------------------------------------- main --- */
async function main() {
  const argv = process.argv.slice(2);
  const get = (f) => {
    const i = argv.indexOf(f);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const live = argv.includes('--yes');
  const only = get('--only'); // 'ig' | 'fb'

  const { dir, slug, manifest } = loadManifest(get('--slug'));
  const caption = buildCaption(manifest);

  // Өөрийн hosting өгсөн бол FB байршуулалтыг зөвхөн IG-д хэрэглэхгүй
  const ownHosting = Boolean(MEDIA_BASE);
  const needUpload = only !== 'ig' || !ownHosting;

  console.log(`Пост:   ${slug}  (${path.relative(ROOT, dir)})`);
  console.log(`Theme:  ${manifest.theme ?? 'green'}`);
  console.log(`Зураг:  ${manifest.files.length}`);
  console.log(`Зорилт: ${only === 'ig' ? 'Instagram' : only === 'fb' ? 'Facebook' : 'Instagram + Facebook'}`);
  console.log(
    `Hosting: ${ownHosting ? MEDIA_BASE : 'хэрэггүй (Facebook CDN ашиглана)'}`,
  );
  console.log(`\nТайлбар (${caption.length} тэмдэгт):\n${caption}\n`);

  if (!live) {
    console.log('='.repeat(64));
    console.log('DRY RUN: юу ч нийтлээгүй, зураг ч байршуулаагүй.');
    console.log('Жинхэнээсээ нийтлэхийн тулд --yes нэмнэ үү.');
    console.log('='.repeat(64));
    return;
  }

  const missing = [
    !TOKEN && 'META_ACCESS_TOKEN (эсвэл FB_PAGE_TOKEN_AI_OFFICE)',
    needUpload && !FB_PAGE_ID && 'FB_PAGE_ID (эсвэл FACEBOOK_PAGE_ID)',
    only !== 'fb' && !IG_USER_ID && 'IG_USER_ID (эсвэл INSTAGRAM_BUSINESS_ID)',
  ].filter(Boolean);
  if (missing.length) throw new Error('Дутуу тохиргоо: ' + missing.join(', '));

  const uploads = needUpload ? await uploadAll(dir, manifest.files) : [];

  const igUrls = ownHosting
    ? manifest.files.map((f) => `${MEDIA_BASE}/${f}`)
    : uploads.map((u) => u.publicUrl);

  const results = {};
  if (only !== 'fb') results.instagram = await publishInstagram(igUrls, caption);
  if (only !== 'ig') results.facebook = await publishFacebook(uploads, caption);

  fs.writeFileSync(
    path.join(dir, 'published.json'),
    JSON.stringify(
      { ...results, photos: uploads.map((u) => u.fbid), publishedAt: new Date().toISOString() },
      null,
      2,
    ),
  );
  console.log('\nДууслаа.');
}

main().catch((e) => {
  console.error('\nНийтлэх амжилтгүй:\n' + (e?.message ?? e));
  process.exit(1);
});
