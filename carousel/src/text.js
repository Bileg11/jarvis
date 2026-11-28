// ---------------------------------------------------------------------------
// Текст цэвэрлэх хэрэгслүүд.
// Гол зорилго: AI-аар үүсгэсэн Монгол текстээс урт зураас (— – ―) бүрэн зайлуулах.
// ---------------------------------------------------------------------------

const LONG_DASHES = '—–―−‒‐﹘﹣－';
const DASH_CLASS = `[${LONG_DASHES}]`;

/**
 * Урт зураасыг Монгол бичгийн зөв тэмдэгтээр сольж устгана.
 *
 *   "ChatGPT — шинэ функц"  ->  "ChatGPT, шинэ функц"
 *   "5—10 минут"            ->  "5-10 минут"
 *   "Сайн—уу"               ->  "Сайн уу"
 *   "AI -- хэрэгсэл"        ->  "AI, хэрэгсэл"
 *
 * @param {string} input
 * @returns {string}
 */
export function noEmDash(input) {
  if (typeof input !== 'string') return input;

  let s = input;

  // Үл харагдах тэмдэгтүүдийг цэвэрлэх (AI output-д их таардаг)
  s = s.replace(/[​-‍﻿­]/g, '');

  // ASCII хос зураас "--" ба "---" -> урт зураастай адил үзнэ
  s = s.replace(/\s*-{2,}\s*/g, ' — ');

  // 1) Тооны хооронд (хугацаа, хэмжээ): 5—10 -> 5-10
  s = s.replace(new RegExp(`(\\d)\\s*${DASH_CLASS}\\s*(\\d)`, 'g'), '$1-$2');

  // 2) Хоёр талдаа зайтай: "AI — хэрэгсэл" -> "AI, хэрэгсэл"
  s = s.replace(new RegExp(`\\s+${DASH_CLASS}\\s+`, 'g'), ', ');

  // 3) Мөрийн/өгүүлбэрийн эхэнд: "— Сайн уу" -> "Сайн уу"
  s = s.replace(new RegExp(`(^|\\n)\\s*${DASH_CLASS}\\s*`, 'g'), '$1');

  // 4) Зайгүй дундуур: "Сайн—уу" -> "Сайн уу"
  s = s.replace(new RegExp(DASH_CLASS, 'g'), ' ');

  // Цэвэрлэсний дараах давхар зай / сул цэг
  s = s.replace(/[ \t]{2,}/g, ' ');
  s = s.replace(/\s+,/g, ',');
  s = s.replace(/,\s*,/g, ',');
  s = s.replace(/,(\s*[.!?:;])/g, '$1');
  s = s.replace(/^[,\s]+/g, '');

  return s.trim();
}

/** Урт зураас үлдсэн эсэхийг шалгах (тест / CI-д хэрэгтэй). */
export function hasLongDash(s) {
  return typeof s === 'string' && new RegExp(DASH_CLASS).test(s);
}

/**
 * Обьект / массив дотор байгаа БҮХ string-д noEmDash() хэрэглэнэ.
 * post.json-г рендерлэхээс өмнө дамжуулдаг гол шүүлтүүр.
 */
export function sanitizeDeep(value) {
  if (typeof value === 'string') return noEmDash(value);
  if (Array.isArray(value)) return value.map(sanitizeDeep);
  if (value && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = sanitizeDeep(v);
    return out;
  }
  return value;
}

/** HTML-д оруулахын өмнө тусгай тэмдэгтүүдийг escape хийх. */
export function esc(s = '') {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * {{гол үг}} -> ногоон өнгөтэй span.
 * Монгол гарчигт гол үгийг тодруулахад хэрэглэнэ.
 *   "ChatGPT-ийн {{шинэ}} функц" -> 'ChatGPT-ийн <span class="hl">шинэ</span> функц'
 */
export function hl(s = '') {
  return esc(s).replace(/\{\{(.+?)\}\}/g, '<span class="hl">$1</span>');
}

/** Мөр бүрийг <br>-ээр хуваах (escape + highlight-тай). */
export function multiline(s = '') {
  return hl(s).replace(/\n/g, '<br>');
}
