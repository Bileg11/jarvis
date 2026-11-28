import { hl, esc, multiline } from '../text.js';

/**
 * STEPS slide: ногоон дугаартай гарчиг + "→" сумтай богино алхмууд.
 * slide = { type:'steps', eyebrow, title, steps:[{ n, title, text }] }
 */
export default function steps(slide, ctx) {
  const items = (slide.steps ?? [])
    .map((st, i) => {
      const num = String(st.n ?? i + 1).padStart(2, '0');
      const text = st.text
        ? `<div class="s-text" data-autofit="33" data-autofit-min="30" data-autofit-group="step-text"><span class="arrow">&rarr;</span><span>${multiline(st.text)}</span></div>`
        : '';
      return `
      <div class="s-item">
        <div class="s-num">${esc(num)}</div>
        <div class="s-body">
          <div class="s-title" data-autofit="42" data-autofit-min="34" data-autofit-group="step-title">${hl(st.title ?? '')}</div>
          ${text}
        </div>
      </div>`;
    })
    .join('');

  const eyebrow = slide.eyebrow
    ? `<div class="s-eyebrow">${esc(slide.eyebrow)}</div>`
    : '';

  return `
<div class="slide steps">
  <div class="s-head">
    ${eyebrow}
    <h2 data-autofit="74" data-autofit-min="46">${hl(slide.title ?? '')}</h2>
    <div class="s-rule"></div>
  </div>
  <div class="s-list" data-fit-group>${items}</div>
  <div class="brand"><span class="dot"></span>${esc(ctx.brand)}</div>
  <div class="pageno">${ctx.index}/${ctx.total}</div>
</div>`;
}
