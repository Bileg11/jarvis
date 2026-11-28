import { hl, esc, multiline } from '../text.js';

/**
 * RECAP slide: постын бүх санааг нэг жагсаалт болгосон "screenshot слайд".
 * Хүмүүс үүнийг хадгалж, найздаа илгээдэг тул бие даан ойлгогдох ёстой.
 * slide = { type:'recap', eyebrow, title, items:[ "мөр", ... ], note }
 */
export default function recap(slide, ctx) {
  const items = (slide.items ?? [])
    .map((it, i) => {
      const text = typeof it === 'string' ? it : (it.text ?? '');
      return `
      <div class="r-item">
        <div class="r-num">${i + 1}</div>
        <div class="r-text" data-autofit="40" data-autofit-min="30"
             data-autofit-group="recap-item">${multiline(text)}</div>
      </div>`;
    })
    .join('');

  const eyebrow = slide.eyebrow
    ? `<div class="r-eyebrow">${esc(slide.eyebrow)}</div>`
    : '<div class="r-eyebrow">Хураангуй</div>';

  const note = slide.note
    ? `<div class="r-note">${multiline(slide.note)}</div>`
    : '';

  return `
<div class="slide recap">
  ${eyebrow}
  <h2 data-autofit="68" data-autofit-min="44">${hl(slide.title ?? '')}</h2>
  <div class="r-rule"></div>
  <div class="r-list">${items}</div>
  ${note}
  <div class="brand"><span class="dot"></span>${esc(ctx.brand)}</div>
  <div class="pageno">${ctx.index}/${ctx.total}</div>
</div>`;
}
