import { hl, esc, multiline, noEmDash } from '../text.js';

/**
 * PROMPT slide: "PROMPT:" гарчиг + хар саарал чат хайрцаг + ногоон "↑" товч.
 * slide = { type:'prompt', label, title, placeholder, text, note }
 */
export default function prompt(slide, ctx) {
  const label = slide.label ?? 'PROMPT:';
  const title = slide.title
    ? `<div class="p-title" data-autofit="50" data-autofit-min="34">${hl(slide.title)}</div>`
    : '';
  const ph = slide.placeholder
    ? `<div class="ph">${esc(slide.placeholder)}</div>`
    : '';
  const note = slide.note
    ? `<div class="p-note"><span class="arrow">&rarr;</span><span>${multiline(slide.note)}</span></div>`
    : '';

  // Prompt-ийн бие: мөр дамжуулалтыг хадгална (white-space:pre-wrap)
  const body = esc(noEmDash(slide.text ?? ''));

  return `
<div class="slide prompt">
  <div class="p-label"><span class="bar"></span>${esc(label)}</div>
  ${title}
  <div class="chatbox">
    ${ph}
    <div class="body" data-autofit="36" data-autofit-min="28">${body}</div>
    <div class="send">&uarr;</div>
  </div>
  ${note}
  <div class="brand"><span class="dot"></span>${esc(ctx.brand)}</div>
  <div class="pageno">${ctx.index}/${ctx.total}</div>
</div>`;
}
