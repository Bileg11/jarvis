import { hl, esc, multiline } from '../text.js';

/**
 * MEDIA slide: 1-2 мөр тайлбар + доор булан дугуйрсан мэдээний зураг / meme.
 * slide = { type:'media', eyebrow, text, sub, image, caption, source, fit:'cover'|'contain' }
 */
export default function media(slide, ctx) {
  const eyebrow = slide.eyebrow
    ? `<div class="m-eyebrow">${esc(slide.eyebrow)}</div>`
    : '';
  const sub = slide.sub ? `<div class="m-sub">${multiline(slide.sub)}</div>` : '';

  // Зураг өгөөгүй бол хоосон хүрээ зурахгүй. Оронд нь текстийг том болгож
  // голлуулна: carousel-ийн 2 дахь слайд ("яагаад энэ чухал вэ") ийм хэлбэртэй.
  const fit = slide.fit === 'contain' ? ' contain' : '';
  const frame = slide.image
    ? `<div class="m-frame${fit}"><img src="${esc(slide.image)}" alt=""></div>`
    : '';

  const cap =
    slide.caption || slide.source
      ? `<div class="m-cap">${
          slide.caption ? `<span>${esc(slide.caption)}</span>` : ''
        }${
          slide.source ? `<span class="src">${esc(slide.source)}</span>` : ''
        }</div>`
      : '';

  const bare = slide.image ? '' : ' bare';

  return `
<div class="slide media${bare}">
  ${eyebrow}
  <div class="m-text" data-autofit="${slide.image ? 52 : 80}" data-autofit-min="${slide.image ? 36 : 46}">${hl(slide.text ?? '')}</div>
  ${sub}
  ${frame}
  ${cap}
  <div class="brand"><span class="dot"></span>${esc(ctx.brand)}</div>
  <div class="pageno">${ctx.index}/${ctx.total}</div>
</div>`;
}
