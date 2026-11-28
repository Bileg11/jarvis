#!/usr/bin/env node
// ---------------------------------------------------------------------------
// brand.js
// KHAN AI-ийн брэнд материалыг (profile picture, cover) рендерлэнэ.
//   node scripts/brand.js            -> output/brand/*.png
// ---------------------------------------------------------------------------

import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import puppeteer from 'puppeteer-core';
import { launch } from '../src/browser.js';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'output', 'brand');

/* ------------------------------------------------------------- токенууд -- */
const BASE = `
  :root{
    --bg:#0A0A0C;
    --gold:#E8B44A;
    --gold-2:#F7DC9A;
    --white:#FFFFFF;
    --muted:#8E8779;
    --font:'Arial','Helvetica Neue',Helvetica,'Noto Sans','DejaVu Sans',sans-serif;
  }
  *,*::before,*::after{margin:0;padding:0;box-sizing:border-box}
  html,body{width:100%;height:100%;background:var(--bg);overflow:hidden}
  body{font-family:var(--font);color:var(--white);-webkit-font-smoothing:antialiased}
  .c{position:relative;width:100%;height:100%;overflow:hidden;background:var(--bg);
     display:flex;align-items:center;justify-content:center}
  /* эзэнт гүрний тор */
  .grid{position:absolute;inset:0;
    background-image:
      linear-gradient(rgba(232,180,74,.07) 1px,transparent 1px),
      linear-gradient(90deg,rgba(232,180,74,.07) 1px,transparent 1px);
    background-size:54px 54px}
  .glow{position:absolute;border-radius:50%;pointer-events:none;
    background:radial-gradient(circle,rgba(232,180,74,.26) 0%,rgba(232,180,74,0) 68%)}
`;

// Геометр K тэмдэг
const K_MARK = (stroke = 26) => `
<svg viewBox="0 0 200 200" width="100%" height="100%">
  <g stroke="var(--gold)" stroke-width="${stroke}" fill="none"
     stroke-linecap="butt" stroke-linejoin="miter">
    <path d="M60 28 V172"/>
    <path d="M56 100 L152 30"/>
    <path d="M56 100 L152 170"/>
  </g>
</svg>`;

// Мэдээ дамжуулах сүлжээ (өртөөний зам)
const NETWORK = `
<svg viewBox="0 0 600 500" width="100%" height="100%">
  <g stroke="var(--gold)" stroke-opacity=".45" stroke-width="2" fill="none">
    <path d="M60 390 L170 250 L300 300 L410 150 L520 210"/>
    <path d="M170 250 L240 120 L410 150"/>
    <path d="M300 300 L360 420 L520 210"/>
    <path d="M60 390 L240 120"/>
  </g>
  <g fill="var(--gold)">
    <circle cx="60" cy="390" r="7"/><circle cx="170" cy="250" r="10"/>
    <circle cx="300" cy="300" r="8"/><circle cx="240" cy="120" r="9"/>
    <circle cx="410" cy="150" r="13"/><circle cx="520" cy="210" r="8"/>
    <circle cx="360" cy="420" r="7"/>
  </g>
  <g fill="none" stroke="var(--gold)" stroke-opacity=".35" stroke-width="2">
    <circle cx="410" cy="150" r="30"/><circle cx="410" cy="150" r="52"/>
  </g>
</svg>`;

/* --------------------------------------------------------------- хөрөнгө - */
const ASSETS = [
  // ---------- A: тамга ----------
  {
    name: 'profile-a-tamga',
    w: 1080,
    h: 1080,
    css: `
      .seal{position:relative;width:620px;height:620px;border:16px solid var(--gold);
        border-radius:96px;display:flex;align-items:center;justify-content:center;
        box-shadow:0 0 90px rgba(232,180,74,.30), inset 0 0 70px rgba(232,180,74,.10)}
      .seal .k{width:330px;height:330px}
      .glow{width:1000px;height:1000px}`,
    body: `<div class="c"><div class="grid"></div><div class="glow"></div>
      <div class="seal"><div class="k">${K_MARK(24)}</div></div></div>`,
  },

  // ---------- B: монограм ----------
  {
    name: 'profile-b-monogram',
    w: 1080,
    h: 1080,
    css: `
      .k{width:660px;height:660px;filter:drop-shadow(0 0 60px rgba(232,180,74,.45))}
      .glow{width:980px;height:980px}`,
    body: `<div class="c"><div class="grid"></div><div class="glow"></div>
      <div class="k">${K_MARK(30)}</div></div>`,
  },

  // ---------- C: нэрийн тамга ----------
  {
    name: 'profile-c-wordmark',
    w: 1080,
    h: 1080,
    css: `
      .stack{position:relative;display:flex;flex-direction:column;align-items:center;gap:26px}
      .kh{font-size:196px;font-weight:900;letter-spacing:-.04em;color:var(--gold);
        line-height:.92;text-shadow:0 0 70px rgba(232,180,74,.45)}
      .ai{font-size:120px;font-weight:900;letter-spacing:.22em;color:var(--white);
        line-height:1;padding-left:.22em}
      .rule{width:420px;height:7px;background:var(--gold);border-radius:4px}
      .glow{width:1000px;height:1000px}`,
    body: `<div class="c"><div class="grid"></div><div class="glow"></div>
      <div class="stack"><div class="kh">KHAN</div><div class="rule"></div>
      <div class="ai">AI</div></div></div>`,
  },

  // ---------- Facebook cover (820x312 -> 2x) ----------
  {
    name: 'cover-facebook',
    w: 1640,
    h: 624,
    scale: 1,
    css: `
      .c{justify-content:flex-start}
      .grid{background-size:80px 80px}
      .glow{width:1100px;height:1100px;right:-180px;top:-280px}
      .left{position:relative;z-index:3;padding-left:200px;display:flex;
        flex-direction:column;gap:26px;max-width:900px}
      .mark{display:flex;align-items:center;gap:28px}
      .mark .box{width:104px;height:104px;border:7px solid var(--gold);border-radius:24px;
        display:flex;align-items:center;justify-content:center;flex:0 0 auto}
      .mark .box .k{width:62px;height:62px}
      .name{font-size:92px;font-weight:900;letter-spacing:-.02em;line-height:1}
      .name .g{color:var(--gold)}
      .tag{font-size:40px;font-weight:700;color:#D8D2C4;line-height:1.35}
      .bar{width:150px;height:7px;background:var(--gold);border-radius:4px}
      .net{position:absolute;right:60px;top:50%;transform:translateY(-50%);
        width:760px;height:620px;opacity:.85;z-index:2}`,
    body: `<div class="c"><div class="grid"></div><div class="glow"></div>
      <div class="net">${NETWORK}</div>
      <div class="left">
        <div class="mark">
          <div class="box"><div class="k">${K_MARK(28)}</div></div>
          <div class="name">KHAN <span class="g">AI</span></div>
        </div>
        <div class="bar"></div>
        <div class="tag">Дэлхийн AI, технологийн мэдээ монголоор.<br>Өдөрт 2 удаа.</div>
      </div></div>`,
  },

  // ---------- Facebook cover: ChatGPT дэвсгэр + нэр ----------
  {
    name: 'cover-facebook-final',
    w: 2032,
    h: 774,
    css: `
      .c{justify-content:flex-start}
      .bg{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
      .left{position:relative;z-index:3;padding-left:360px;display:flex;
        flex-direction:column;gap:22px;max-width:980px}
      .name{font-size:104px;font-weight:900;letter-spacing:-.02em;line-height:1;
        text-shadow:0 6px 40px rgba(0,0,0,.85)}
      .name .g{color:var(--gold)}
      .bar{width:132px;height:7px;background:var(--gold);border-radius:4px}
      .tag{font-size:38px;font-weight:700;color:#DCD5C6;line-height:1.35;
        text-shadow:0 4px 24px rgba(0,0,0,.85)}`,
    body: `<div class="c">
      <img class="bg" src="${url.pathToFileURL(path.join(ROOT, 'inbox', 'cover.png')).href}" alt="">
      <div class="left">
        <div class="name">KHAN <span class="g">AI</span></div>
        <div class="bar"></div>
        <div class="tag">Дэлхийн технологийн мэдээ монголоор</div>
      </div></div>`,
  },
];

/* ---------------------------------------------------------------- main --- */
async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const tmpDir = path.join(ROOT, '.render-tmp');
  fs.mkdirSync(tmpDir, { recursive: true });
  const tmpHtml = path.join(tmpDir, 'brand.html');
  const { browser, executablePath } = await launch(puppeteer);
  console.log(`Chrome: ${executablePath}\n`);

  try {
    const page = await browser.newPage();
    for (const a of ASSETS) {
      await page.setViewport({ width: a.w, height: a.h, deviceScaleFactor: a.scale ?? 1 });
      const html = `<!doctype html><html><head><meta charset="utf-8">
        <style>${BASE}\n${a.css ?? ''}</style></head><body>${a.body}</body></html>`;
      fs.writeFileSync(tmpHtml, html, 'utf8');
      await page.goto(url.pathToFileURL(tmpHtml).href + '?a=' + a.name, { waitUntil: 'load' });
      await page.evaluate('document.fonts.ready');
      await page.evaluate(`Promise.all([...document.images].map(i =>
        i.complete ? 1 : new Promise(r => { i.onload = i.onerror = r; })))`);

      const file = path.join(OUT, `${a.name}.png`);
      await page.screenshot({ path: file, type: 'png',
        clip: { x: 0, y: 0, width: a.w, height: a.h } });
      console.log(`  ${a.name}.png  ${a.w}x${a.h}  ${(fs.statSync(file).size / 1024).toFixed(0)} KB`);
    }
  } finally {
    await browser.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
  console.log(`\nБэлэн -> ${path.relative(ROOT, OUT)}/`);
}

main().catch((e) => { console.error(e?.message ?? e); process.exit(1); });
