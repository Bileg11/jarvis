// ── JARVIS CONFIG — НЭГ Л ЭХ СУРВАЛЖ ──────────────────────────────
// Шалгалтын огноо/түвшинг ЗӨВХӨН ЭНД сольж бүх апп шинэчлэгдэнэ.
// (index.html, hsk.html, chat.html, gemini.js бүгд эндээс уншина)
//
// Сервер талын хувилбарууд (тус тусдаа deploy тул энд ирж чадахгүй):
//   webhook/api/telegram.js, webhook/api/hsk3-coach.js, functions/index.js
//   — файл бүрийн дээд талд EXAM_DATE_ISO const бий, тэндээ соль.

window.JARVIS_EXAM_LEVEL    = 'HSK4';
window.JARVIS_EXAM_DATE_STR = '2026-09-01';
window.JARVIS_EXAM_DATE     = new Date('2026-09-01T09:00:00+08:00');
window.JARVIS_EXAM_LABEL    = window.JARVIS_EXAM_LEVEL + ' — ' + window.JARVIS_EXAM_DATE_STR;

// Шалгалт хүртэл үлдсэн хоног (хамгийн багадаа 0)
window.jarvisExamDays = function () {
  return Math.max(0, Math.floor((window.JARVIS_EXAM_DATE - Date.now()) / 86400000));
};
