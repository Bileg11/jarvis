// ══════════════════════════════════════════════════════════════════
// ХЯТАД ДУУДЛАГА СОНСОХ — бүх хуудсанд нийтлэг
// ══════════════════════════════════════════════════════════════════
// Ханз харагдаж буй ЛЮБОЙ элемент дээр дарахад дуудлага нь сонсогдоно.
// Интернэт шаардахгүй, төлбөргүй — браузерын өөрийн хэл яриа ашиглана.
//
// Хэрэглэх: <script src="speak.js"></script> — өөр юу ч хийх шаардлагагүй.
// Шинэ газар нэмэх бол доорх SELECTORS-д CSS сонгогч нэмнэ.
'use strict';

(function () {
  if (window.__jarvisSpeakReady) return;
  window.__jarvisSpeakReady = true;

  // Ханз харуулдаг бүх газар (хуудас бүрт зөвхөн байгаа нь ажиллана)
  const SELECTORS = [
    '.flash-hanzi',    // hsk.html — flashcard
    '.test-q',         // hsk.html — тест асуулт
    '.sentence-word',  // hsk.html — өгүүлбэр зохиох
    '.wi-hanzi',       // hsk.html — үгийн сангийн мөр
    '.weak-hanzi',     // hsk.html — сул талын жагсаалт
    '.conv-cn',        // hsk.html — AI ярилцлагын хятад мөр
    '.cram-hanzi',     // hsk.html — шахалтын горим
    '#fc-word',        // chat.html — flashcard
    '.fc-hanzi',       // chat.html — flashcard
    '.tdi-word',       // chat.html — өдрийн үг
    '#drill-hanzi',    // index.html — dashboard drill
    '.hsk-fc-hanzi',   // index.html — HSK widget flashcard
    '.quiz-hanzi',     // learn.html — асуулт
    '.match-cell',     // learn.html — тааруулах тоглоом
    '[data-cn]',       // гараар тэмдэглэсэн ямар ч элемент
  ].join(',');

  const CJK = /[㐀-䶿一-鿿豈-﫿]/;

  let voice = null;
  function pickVoice() {
    const all = window.speechSynthesis ? window.speechSynthesis.getVoices() : [];
    if (!all.length) return;
    // Эх хэлтэй хятад хоолойг эрэмбэлж сонгоно
    voice =
      all.find(v => /^zh[-_]CN/i.test(v.lang) && /Ting|Tingting|Yaoyao|Huihui|Xiaoxiao/i.test(v.name)) ||
      all.find(v => /^zh[-_]CN/i.test(v.lang)) ||
      all.find(v => /^zh/i.test(v.lang)) ||
      null;
  }
  if (window.speechSynthesis) {
    pickVoice();
    window.speechSynthesis.addEventListener('voiceschanged', pickVoice);
  }

  // Зөвхөн ханзыг үлдээнэ — пиньинь, монгол үсэг, тоо, тэмдэгтийг хасна
  function hanziOnly(text) {
    return (text || '').replace(/[^㐀-䶿一-鿿豈-﫿。，！？]/g, '').trim();
  }

  function speak(text) {
    if (!window.speechSynthesis) return false;
    const clean = hanziOnly(text);
    if (!clean) return false;
    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(clean);
      u.lang = 'zh-CN';
      u.rate = 0.8;   // сурч байгаа хүнд удаан нь тустай
      u.pitch = 1;
      if (voice) u.voice = voice;
      window.speechSynthesis.speak(u);
      return true;
    } catch { return false; }
  }

  // Дарахад дуудлага — нэг л сонсогч бүх хуудсанд
  document.addEventListener('click', function (e) {
    const el = e.target.closest && e.target.closest(SELECTORS);
    if (!el) return;
    const txt = el.getAttribute('data-cn') || el.textContent || '';
    if (!CJK.test(txt)) return;
    if (speak(txt)) {
      el.classList.add('speaking');
      setTimeout(() => el.classList.remove('speaking'), 500);
    }
  }, true);

  // "Дарж болно" гэдгийг мэдрүүлнэ — CSS-ээр (DOM ажиглалт хэрэггүй,
  // ингэснээр байнга шинэчлэгддэг хуудсанд ачаалал үүсгэхгүй)
  function boot() {
    const st = document.createElement('style');
    st.textContent =
      SELECTORS.split(',').map(s => s.trim() + '{cursor:pointer}').join('') +
      '.cn-speakable{cursor:pointer;transition:opacity .15s,transform .15s}' +
      '.cn-speakable:hover,' + SELECTORS.split(',').map(s => s.trim() + ':hover').join(',') + '{opacity:.78}' +
      '.speaking{transform:scale(1.06)}';
    document.head.appendChild(st);

    // Тайлбар (tooltip) — зөвхөн хулгана дээр очиход, нэг удаа
    document.addEventListener('mouseover', function (e) {
      const el = e.target.closest && e.target.closest(SELECTORS);
      if (!el || el.dataset.spk) return;
      el.dataset.spk = '1';
      const txt = el.getAttribute('data-cn') || el.textContent || '';
      if (CJK.test(txt) && !el.title) el.title = '🔊 Дуудлага сонсох';
    }, true);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  // Бусад код дуудаж болохоор нээлттэй болгоно
  window.jarvisSpeak = speak;
})();
