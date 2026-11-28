#!/usr/bin/env node
// ---------------------------------------------------------------------------
// render.js
// post.json уншаад output/ хавтсанд 1080x1350 PNG slide-уудыг үүсгэнэ.
//
//   node src/render.js                     # post.json -> output/
//   node src/render.js my-post.json        # өөр файл
//   node src/render.js post.json --out dist
// ---------------------------------------------------------------------------

import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import puppeteer from 'puppeteer-core';

import { launch } from './browser.js';
import { sanitizeDeep, hasLongDash } from './text.js';
import { TEMPLATES, TEMPLATE_NAMES } from './templates/index.js';

export const WIDTH = 1080;
export const HEIGHT = 1350;

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

/* ----------------------------------------------------------- CLI argv ---- */
function parseArgs(argv) {
  const out = { input: 'post.json', outDir: null, keepHtml: false, theme: null };
  const rest = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--out' || a === '-o') out.outDir = argv[++i];
    else if (a === '--keep-html') out.keepHtml = true;
    else if (a === '--theme') out.theme = argv[++i];
    else rest.push(a);
  }
  if (rest[0]) out.input = rest[0];
  return out;
}

/* -------------------------------------------------------------- fonts --- */
// assets/fonts/ дотор .woff2/.ttf/.otf байвал автоматаар @font-face болгоно.
// Байхгүй бол системийн фонт (Arial / Noto Sans / DejaVu) руу fallback-лана.
function fontFaces() {
  const dir = path.join(ROOT, 'assets', 'fonts');
  if (!fs.existsSync(dir)) return '';
  const files = fs
    .readdirSync(dir)
    .filter((f) => /\.(woff2|woff|ttf|otf)$/i.test(f))
    .sort();
  if (!files.length) return '';

  return files
    .map((f) => {
      const low = f.toLowerCase();
      const weight = /black|900/.test(low)
        ? 900
        : /extrabold|800/.test(low)
          ? 800
          : /bold|700/.test(low)
            ? 700
            : /semibold|600/.test(low)
              ? 600
              : /medium|500/.test(low)
                ? 500
                : 400;
      const fmt = /\.woff2$/i.test(f)
        ? 'woff2'
        : /\.woff$/i.test(f)
          ? 'woff'
          : /\.otf$/i.test(f)
            ? 'opentype'
            : 'truetype';
      const href = url.pathToFileURL(path.join(dir, f)).href;
      return `@font-face{font-family:'Display';src:url('${href}') format('${fmt}');font-weight:${weight};font-style:normal;font-display:block;}`;
    })
    .join('\n');
}

/* ------------------------------------------------------------- assets --- */
const IMAGE_KEYS = ['bg', 'image', 'avatar', 'logo', 'thumb'];

/** Локал зургийн замыг file:// болгож хөрвүүлнэ (http/data бол хөндөхгүй). */
function resolveAsset(v, warnings) {
  if (typeof v !== 'string' || !v) return v;
  if (/^(https?:|data:|file:)/i.test(v)) return v;
  const abs = path.isAbsolute(v) ? v : path.join(ROOT, v);
  if (fs.existsSync(abs)) return url.pathToFileURL(abs).href;
  warnings.push(`Зураг олдсонгүй: ${v}`);
  return '';
}

function resolveAssetsDeep(node, warnings) {
  if (Array.isArray(node)) return node.map((n) => resolveAssetsDeep(n, warnings));
  if (node && typeof node === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(node)) {
      out[k] =
        IMAGE_KEYS.includes(k) && typeof v === 'string'
          ? resolveAsset(v, warnings)
          : resolveAssetsDeep(v, warnings);
    }
    return out;
  }
  return node;
}

/* ---------------------------------------------------------------- HTML --- */
const THEMES = { khan: 't-khan', blue: 't-blue', green: '' };

function buildHtml(bodyHtml, css, faces, theme) {
  const cls = THEMES[theme] ?? '';
  return `<!doctype html>
<html lang="mn"${cls ? ` class="${cls}"` : ''}><head><meta charset="utf-8">
<style>${faces}\n${css}</style>
</head><body>${bodyHtml}</body></html>`;
}

/**
 * Хуудсан дээр текстийг хайрцагт тааруулж багасгана.
 * data-autofit="<эхлэх px>" data-autofit-min="<доод хязгаар>"
 */
/**
 * Хуудсан дээр ажиллах autofit (page.evaluate-д ФУНКЦ хэлбэрээр дамжина).
 *
 * ЧУХАЛ: энэ кодыг template literal болгож болохгүй. Тэгвэл `\(`, `\s` зэрэг
 * regex escape-ийг JS өөрөө залгиж, regex нь чимээгүйхэн буруу ажиллана.
 *
 * data-autofit="<эхлэх px>" data-autofit-min="<доод хязгаар>" гэсэн элементүүдийн
 * фонтыг агуулга зурагт багтах хүртэл багасгана.
 */
function autofitInPage(H) {
  // Чимэглэлийн давхаргууд (зориудаар бүтэн дүүргэдэг тул хэмжилтээс хасна)
  const decor = new Set(
    document.querySelectorAll('.bg, .scrim, .edge, .brand, .pageno, .o-glow'),
  );
  const hasBrand = !!document.querySelector('.brand');

  // Агуулга доод brand мөрөнд хүрэхгүй байх ёстой
  const LIMIT = hasBrand ? H - 118 : H - 36;

  const hasDirectText = (el) =>
    [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim() !== '');

  // Дэвсгэр өнгө / хүрээтэй элемент = нүдэнд харагдах хайрцаг. Түүний padding
  // хүртэл зураг дээр харагддаг тул хэмжилтэд орно (.s-item, .chatbox, .tweet).
  const isVisibleBox = (el) => {
    const cs = getComputedStyle(el);
    const bg = cs.backgroundColor || '';
    const transparent =
      bg === '' || bg === 'transparent' || bg.endsWith(', 0)') || bg.endsWith(',0)');
    const bordered = ['Top', 'Right', 'Bottom', 'Left'].some(
      (side) => parseFloat(cs['border' + side + 'Width']) > 0,
    );
    return !transparent || (cs.backgroundImage && cs.backgroundImage !== 'none') || bordered;
  };

  const nodes = [...document.querySelectorAll('.slide *')].filter(
    (el) =>
      !decor.has(el) &&
      !el.closest('.brand, .pageno') &&
      (el.tagName === 'IMG' ||
        el.children.length === 0 ||
        hasDirectText(el) ||
        isVisibleBox(el)),
  );

  // getBoundingClientRect нь overflow:hidden үед ч layout-ын жинхэнэ байрлалыг
  // өгдөг тул таслагдсан, эсвэл flex-shrink-ээр шахагдсан агуулга ч илэрнэ.
  let deepest = null;
  const contentBottom = () => {
    let max = 0;
    deepest = null;
    for (const el of nodes) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) continue;
      if (r.bottom > max) {
        max = r.bottom;
        deepest = el;
      }
    }
    return max;
  };
  const over = () => contentBottom() > LIMIT;

  // data-autofit-group="нэр" өгсөн элементүүд ХАМТДАА багасна. Ингэснээр жишээ нь
  // алхам бүрийн гарчиг өөр өөр хэмжээтэй болж, эвгүй харагдахаас сэргийлнэ.
  const groups = [];
  const byName = new Map();
  for (const el of document.querySelectorAll('[data-autofit]')) {
    const size = parseFloat(el.dataset.autofit);
    const min = parseFloat(el.dataset.autofitMin || '20');
    const name = el.dataset.autofitGroup;
    if (name && byName.has(name)) {
      byName.get(name).els.push(el);
      continue;
    }
    const g = { els: [el], size, min };
    groups.push(g);
    if (name) byName.set(name, g);
  }

  const apply = () =>
    groups.forEach((g) => g.els.forEach((el) => { el.style.fontSize = g.size + 'px'; }));

  const shrinkLargest = (rounds) => {
    let guard = 0;
    while (over() && guard++ < rounds) {
      const live = groups.filter((g) => g.size > g.min).sort((a, b) => b.size - a.size);
      if (!live.length) return false;
      live[0].size = Math.max(live[0].min, live[0].size - 2);
      apply();
    }
    return !over();
  };

  apply();

  // 1) Хамгийн том фонтоос эхлэн аажмаар багасгана
  shrinkLargest(600);

  // 2) Бас хэтэрч байвал зай / padding-г шатлан агшуулж, дахин тохируулна
  const relief = [
    () => document.documentElement.style.setProperty('--pad', '64px'),
    () => document.querySelectorAll('.s-item, .x-trans, .quote')
            .forEach((n) => { n.style.padding = '26px 30px'; }),
    () => document.querySelectorAll('.s-list, .o-list')
            .forEach((n) => { n.style.gap = '20px'; }),
    () => document.querySelectorAll('.tweet')
            .forEach((n) => { n.style.gap = '18px'; n.style.padding = '32px'; }),
    () => document.querySelectorAll('.t-media img')
            .forEach((n) => { n.style.maxHeight = '300px'; }),
    () => document.documentElement.style.setProperty('--pad', '48px'),
  ];
  for (const step of relief) {
    if (!over()) break;
    step();
    shrinkLargest(300);
  }

  const describe = (el) => {
    if (!el) return null;
    const cls = String(el.getAttribute('class') || '').split(' ').filter(Boolean);
    return el.tagName.toLowerCase() + (cls.length ? '.' + cls.join('.') : '');
  };

  const overflow = over();
  return {
    overflow,
    docHeight: Math.round(contentBottom()),
    limit: LIMIT,
    culprit: describe(deepest),
    sizes: groups.map((g) => Math.round(g.size)),
  };
}

/* ------------------------------------------------------------- render --- */
export async function renderPost(post, { outDir, keepHtml = false, theme: themeOverride = null } = {}) {
  const warnings = [];

  // 1) Урт зураас устгах шүүлтүүр (ЭНД бүх текст дамжина)
  const clean = sanitizeDeep(post);

  // 2) Локал зургуудыг file:// болгох
  const data = resolveAssetsDeep(clean, warnings);

  const slides = data.slides ?? [];
  if (!slides.length) throw new Error('post.json дотор "slides" массив хоосон байна.');

  const brand = data.meta?.brand ?? '@khan.ai';
  const theme = themeOverride ?? data.meta?.theme ?? 'khan';

  // Брэндийн лого: outro дээр avatar бичээгүй үед хэрэглэнэ
  const logoPath = path.join(ROOT, 'assets', 'img', 'avatar.svg');
  const logo = fs.existsSync(logoPath) ? url.pathToFileURL(logoPath).href : '';
  if (!(theme in THEMES)) {
    throw new Error(`Танихгүй theme: "${theme}". Боломжит: ${Object.keys(THEMES).join(', ')}`);
  }
  const slug = data.meta?.slug ?? 'post';
  const dir = outDir ?? path.join(ROOT, 'output', slug);
  fs.mkdirSync(dir, { recursive: true });

  const css = fs.readFileSync(path.join(__dirname, 'templates', 'base.css'), 'utf8');
  const faces = fontFaces();

  // Chrome нь about:blank хуудаснаас file:// зураг ачаалахыг хориглодог тул
  // slide бүрийг түр .html файл болгож file:// -ээр нээнэ.
  const tmpDir = path.join(ROOT, '.render-tmp');
  fs.mkdirSync(tmpDir, { recursive: true });
  const tmpHtml = path.join(tmpDir, 'slide.html');

  const { browser, executablePath } = await launch(puppeteer);
  console.log(`Chrome: ${executablePath}`);
  console.log(`Фонт:   ${faces ? 'assets/fonts/ (өөрийн фонт)' : 'системийн fallback (Arial/Noto/DejaVu)'}`);
  console.log(`Theme:  ${theme}`);

  const files = [];
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: WIDTH, height: HEIGHT, deviceScaleFactor: 1 });

    for (let i = 0; i < slides.length; i++) {
      const slide = slides[i];
      const tpl = TEMPLATES[slide.type];
      if (!tpl) {
        throw new Error(
          `Танихгүй slide type: "${slide.type}". Боломжит: ${TEMPLATE_NAMES.join(', ')}`,
        );
      }

      const ctx = { brand, logo, index: i + 1, total: slides.length };
      const html = buildHtml(tpl(slide, ctx), css, faces, theme);

      fs.writeFileSync(tmpHtml, html, 'utf8');
      await page.goto(url.pathToFileURL(tmpHtml).href + '?i=' + i, { waitUntil: 'load' });
      // Фонт + зураг бүрэн ачаалахыг хүлээнэ
      await page.evaluate(`document.fonts.ready`);
      await page.evaluate(`Promise.all([...document.images].map(img =>
        img.complete ? 1 : new Promise(r => { img.onload = img.onerror = r; })))`);

      const fit = await page.evaluate(autofitInPage, HEIGHT);
      if (fit.overflow) {
        warnings.push(
          `Slide ${i + 1} (${slide.type}): агуулга хэтэрсэн (${fit.docHeight}px > ${fit.limit}px, <${fit.culprit}>). Текстийг богиносгоно уу.`,
        );
      }

      // 3) Рендер хийгдсэн текстэд урт зураас үлдээгүйг шалгах
      const visible = await page.evaluate(`document.body.innerText`);
      if (hasLongDash(visible)) {
        warnings.push(`Slide ${i + 1} (${slide.type}): рендер дээр урт зураас үлдсэн байна.`);
      }

      const name = `${String(i + 1).padStart(2, '0')}-${slide.type}.png`;
      const file = path.join(dir, name);
      await page.screenshot({
        path: file,
        type: 'png',
        clip: { x: 0, y: 0, width: WIDTH, height: HEIGHT },
        captureBeyondViewport: false,
      });

      if (keepHtml) fs.writeFileSync(file.replace(/\.png$/, '.html'), html, 'utf8');

      const kb = (fs.statSync(file).size / 1024).toFixed(0);
      console.log(`  [${i + 1}/${slides.length}] ${name}  ${WIDTH}x${HEIGHT}  ${kb} KB`);
      files.push(name);
    }
  } finally {
    await browser.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }

  // 4) publish.js-д хэрэглэх manifest
  const manifest = {
    slug,
    createdAt: new Date().toISOString(),
    width: WIDTH,
    height: HEIGHT,
    theme,
    caption: data.meta?.caption ?? '',
    hashtags: data.meta?.hashtags ?? [],
    files,
  };
  fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify(manifest, null, 2));

  return { dir, files, warnings, manifest };
}

/* ---------------------------------------------------------------- main --- */
async function main() {
  const args = parseArgs(process.argv.slice(2));
  const inputPath = path.isAbsolute(args.input) ? args.input : path.join(ROOT, args.input);

  if (!fs.existsSync(inputPath)) {
    console.error(`post.json олдсонгүй: ${inputPath}`);
    process.exit(1);
  }

  const post = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
  console.log(`Уншсан: ${path.relative(ROOT, inputPath)}  (${post.slides?.length ?? 0} slide)`);

  const t0 = Date.now();
  const { dir, files, warnings } = await renderPost(post, {
    outDir: args.outDir ? path.resolve(ROOT, args.outDir) : null,
    keepHtml: args.keepHtml,
    theme: args.theme,
  });

  console.log(`\nБэлэн: ${files.length} зураг -> ${path.relative(ROOT, dir)}/  (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
  if (warnings.length) {
    console.log('\nСанамж:');
    warnings.forEach((w) => console.log('  ! ' + w));
  }
}

if (import.meta.url === url.pathToFileURL(process.argv[1]).href) {
  main().catch((e) => {
    console.error('\nРендер амжилтгүй:\n' + (e?.message ?? e));
    process.exit(1);
  });
}
