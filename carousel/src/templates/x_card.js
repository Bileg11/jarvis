import { hl, esc, multiline } from '../text.js';

const X_LOGO = `<svg class="x-logo" viewBox="0 0 24 24" aria-hidden="true"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>`;

const VERIFIED = `<svg class="t-badge" viewBox="0 0 24 24" aria-hidden="true"><path fill="#1D9BF0" d="M22.25 12c0-1.43-.88-2.67-2.19-3.34.46-1.39.2-2.9-.81-3.91s-2.52-1.27-3.91-.81C14.67 2.63 13.43 1.75 12 1.75s-2.67.88-3.34 2.19c-1.39-.46-2.9-.2-3.91.81s-1.27 2.52-.81 3.91C2.63 9.33 1.75 10.57 1.75 12s.88 2.67 2.19 3.34c-.46 1.39-.2 2.9.81 3.91s2.52 1.27 3.91.81c.67 1.31 1.91 2.19 3.34 2.19s2.67-.88 3.34-2.19c1.39.46 2.9.2 3.91-.81s1.27-2.52.81-3.91c1.31-.67 2.19-1.91 2.19-3.34"/><path fill="#fff" d="m10.74 15.96-3.3-3.3 1.41-1.42 1.89 1.89 4.42-4.42 1.41 1.41z"/></svg>`;

function avatar(src, cls, fallbackChar) {
  if (src) return `<img class="${cls}" src="${esc(src)}" alt="">`;
  return `<div class="${cls}" style="display:flex;align-items:center;justify-content:center;
    background:#1C2126;color:#00FF88;font-weight:900;font-size:34px">${esc(fallbackChar)}</div>`;
}

function nfmt(v) {
  if (v === undefined || v === null || v === '') return null;
  if (typeof v === 'string') return v;
  if (v >= 1_000_000) return (v / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (v >= 1_000) return (v / 1_000).toFixed(1).replace(/\.0$/, '') + 'K';
  return String(v);
}

/**
 * X_CARD slide: X (Twitter) пост + Quote-Tweet карт + Монгол орчуулга.
 * slide = {
 *   type:'x_card', eyebrow,
 *   author:{ name, handle, avatar, verified },
 *   text, image,
 *   quote:{ author:{...}, text },
 *   stats:{ views, likes, reposts, replies },
 *   translation, translationLabel
 * }
 */
export default function xCard(slide, ctx) {
  const a = slide.author ?? {};
  const eyebrow = slide.eyebrow
    ? `<div class="x-eyebrow">${esc(slide.eyebrow)}</div>`
    : '';

  const head = `
    <div class="t-head">
      ${avatar(a.avatar, 't-av', (a.name ?? 'X').slice(0, 1))}
      <div class="t-id">
        <div class="t-name">${esc(a.name ?? '')}${a.verified === false ? '' : VERIFIED}</div>
        <div class="t-handle">@${esc(String(a.handle ?? '').replace(/^@/, ''))}</div>
      </div>
      ${X_LOGO}
    </div>`;

  const image = slide.image
    ? `<div class="t-media"><img src="${esc(slide.image)}" alt=""></div>`
    : '';

  // Quote-Tweet (сэтгэгдэлтэй дахин постлох) карт
  let quote = '';
  if (slide.quote) {
    const q = slide.quote.author ?? {};
    quote = `
    <div class="quote">
      <div class="q-head">
        ${avatar(q.avatar, 'q-av', (q.name ?? 'X').slice(0, 1))}
        <span class="q-name">${esc(q.name ?? '')}</span>
        <span class="q-handle">@${esc(String(q.handle ?? '').replace(/^@/, ''))}</span>
      </div>
      <div class="q-text">${multiline(slide.quote.text ?? '')}</div>
    </div>`;
  }

  const s = slide.stats ?? {};
  const statParts = [
    ['Үзэлт', nfmt(s.views)],
    ['Like', nfmt(s.likes)],
    ['Repost', nfmt(s.reposts)],
    ['Reply', nfmt(s.replies)],
  ]
    .filter(([, v]) => v)
    .map(([k, v]) => `<span><b>${esc(v)}</b> ${esc(k)}</span>`)
    .join('');
  const stats = statParts ? `<div class="t-stats">${statParts}</div>` : '';

  const trans = slide.translation
    ? `<div class="x-trans">
         <div class="lab">${esc(slide.translationLabel ?? 'Монгол орчуулга')}</div>
         <div class="val" data-autofit="35" data-autofit-min="30">${multiline(slide.translation)}</div>
       </div>`
    : '';

  return `
<div class="slide xcard">
  ${eyebrow}
  <div class="tweet">
    ${head}
    <div class="t-text" data-autofit="36" data-autofit-min="30">${multiline(slide.text ?? '')}</div>
    ${image}
    ${quote}
    ${stats}
  </div>
  ${trans}
  <div class="brand"><span class="dot"></span>${esc(ctx.brand)}</div>
  <div class="pageno">${ctx.index}/${ctx.total}</div>
</div>`;
}
