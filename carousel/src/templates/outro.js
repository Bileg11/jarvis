import { esc, hl } from '../text.js';

/**
 * OUTRO slide: тогтмол төгсгөлийн +FOLLOW карт.
 * slide = { type:'outro', handle, tagline, bullets:[], cta, avatar }
 * Бүх талбар optional: бичихгүй бол @khan.ai-ийн default хувилбар гарна.
 */
export default function outro(slide, ctx) {
  const handle = slide.handle ?? ctx.brand ?? '@khan.ai';
  const tagline =
    slide.tagline ?? 'Дэлхийн AI, технологийн мэдээг монголоор. Өдөрт 2 удаа.';
  const bullets =
    slide.bullets ?? ['Дэлхийн AI мэдээ', 'Юу гэсэн үг болохыг нь', 'Монголоор, тодорхой'];
  const cta = slide.cta ?? 'ДАГААРАЙ';

  const av = slide.avatar
    ? `<div class="o-av"><img src="${esc(slide.avatar)}" alt=""></div>`
    : `<div class="o-av">AI</div>`;

  const list = bullets
    .map((b) => `<div class="o-li"><span class="tick">&#10003;</span><span>${hl(b)}</span></div>`)
    .join('');

  return `
<div class="slide outro">
  <div class="o-glow"></div>
  <div class="o-inner">
    ${av}
    <div class="o-plus"><span class="s">+</span>FOLLOW</div>
    <div class="o-handle">${esc(handle)}</div>
    <div class="o-tag">${hl(tagline)}</div>
    <div class="o-list">${list}</div>
    <div class="o-cta">${esc(cta)}<span>&rarr;</span></div>
  </div>
</div>`;
}
