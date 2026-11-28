import { hl, esc, multiline } from '../text.js';

/**
 * COVER slide: арын зураг + хар gradient + том Монгол гарчиг + CTA товч.
 * slide = { type:'cover', bg, kicker, title, sub, cta }
 * Гарчигт {{гол үг}} бичвэл ногоон өнгөөр тодорно.
 */
export default function cover(slide, ctx) {
  const bg = slide.bg
    ? `<img class="bg" src="${esc(slide.bg)}" alt="">`
    : `<div class="bg bg-fallback"></div>`;

  const kicker = slide.kicker
    ? `<div class="kicker">${esc(slide.kicker)}</div>`
    : '';

  const sub = slide.sub ? `<div class="sub">${multiline(slide.sub)}</div>` : '';

  const ctaText = slide.cta ?? 'ЦААШ ГҮЙЛГЭЭРЭЙ';

  return `
<div class="slide cover">
  ${bg}
  <div class="scrim"></div>
  <div class="edge"></div>
  <div class="inner">
    ${kicker}
    <h1 data-autofit="104" data-autofit-min="58">${hl(slide.title ?? '')}</h1>
    ${sub}
    <div class="cta">${esc(ctaText)}<span class="chev">&gt;</span></div>
  </div>
  <div class="brand"><span class="dot"></span>${esc(ctx.brand)}</div>
</div>`;
}
