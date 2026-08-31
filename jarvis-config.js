// ── JARVIS CONFIG — НЭГ Л ЭХ СУРВАЛЖ ──────────────────────────────
// Шалгалтын огноо/түвшинг ЗӨВХӨН ЭНД сольж бүх апп шинэчлэгдэнэ.
// (index.html, hsk.html, chat.html, gemini.js бүгд эндээс уншина)
//
// Сервер талын хувилбарууд (тус тусдаа deploy тул энд ирж чадахгүй):
//   webhook/api/telegram.js, webhook/api/hsk3-coach.js, functions/index.js
//   — файл бүрийн дээд талд EXAM_DATE_ISO const бий, тэндээ соль.

// Firebase project config — БАС НЭГ Л ЭХ СУРВАЛЖ (өмнө нь 3 файлд давхардсан байсан).
// firebase-config.js, login.html, learn.html бүгд эндээс уншина.
// АНХААР: firebase-config.js-ээс ӨМНӨ ачаалагдсан байх ёстой.
window.FIREBASE_CONFIG = {
  apiKey:            "AIzaSyA0AwSRMmKQsRfLoY9CreGKrm3CXn0FHTc",
  authDomain:        "jarvis-bileg.firebaseapp.com",
  projectId:         "jarvis-bileg",
  storageBucket:     "jarvis-bileg.firebasestorage.app",
  messagingSenderId: "59304492638",
  appId:             "1:59304492638:web:9da4e7ceac790d1254becf"
};

window.JARVIS_EXAM_LEVEL    = 'HSK4';
window.JARVIS_EXAM_DATE_STR = '2026-10-01';
window.JARVIS_EXAM_DATE     = new Date('2026-10-01T09:00:00+08:00');
window.JARVIS_EXAM_LABEL    = window.JARVIS_EXAM_LEVEL + ' — ' + window.JARVIS_EXAM_DATE_STR;

// Шалгалт хүртэл үлдсэн хоног (хамгийн багадаа 0)
window.jarvisExamDays = function () {
  return Math.max(0, Math.floor((window.JARVIS_EXAM_DATE - Date.now()) / 86400000));
};

// Хуудасны зам: Electron-д .html өргөтгөлтэй, вэбэд өргөтгөлгүй
// (Cloudflare /learn.html → /learn redirect хийдэг тул вэбэд өргөтгөлгүй нь зөв)
window.jarvisHref = function (name) {
  return window.jarvisAPI ? name + '.html' : name;
};

// ── MIGRATION (2026-07): Railway унтарсан ─────────────────────────
// Хуучин Railway proxy override localStorage-д үлдсэн бол автоматаар
// цэвэрлэнэ → бүх хуудас шинэ Vercel default руу залгагдана.
try {
  const _oldProxy = localStorage.getItem('jarvis_proxy_url') || '';
  if (/railway\.app/i.test(_oldProxy)) {
    localStorage.removeItem('jarvis_proxy_url');
    console.log('[Migration] Хуучин Railway proxy URL цэвэрлэгдлээ');
  }
} catch {}
