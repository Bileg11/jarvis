// ══════════════════════════════════════════════════════════════════
// JARVIS — ӨДӨР ТУТМЫН ДАТА (ус, дасгал) + доороос гарах самбар
// ══════════════════════════════════════════════════════════════════
// Ус, дасгал хоёр өмнө нь Нүүр, Амьдрал, Тэмдэглэл гурван хуудсанд
// тус тусдаа хадгалагддаг байсан тул тоо нь хоорондоо зөрдөг байв.
// Одоо БҮГД эндээс уншиж, эндээс бичнэ.
//
// Хэрэглэх: <script src="jarvis-daily.js"></script>
'use strict';

function jvToday() { return window.jarvisDay ? jarvisDay() : new Date().toISOString().slice(0,10); }

// Өдрийн дэвтэр (ус, дасгал, унших, тэмдэглэл — тэмдэглэгээ)
function jvLoad() {
  try {
    var v = JSON.parse(localStorage.getItem('jarvis_r'));
    if (v && v.date === jvToday()) return v;
  } catch (e) {}
  return { date: jvToday(), water: 0, exercise: false, hanzi: false, read: false, journal: false };
}
function jvSave(r) {
  localStorage.setItem('jarvis_r', JSON.stringify(r));
  localStorage.setItem('jarvis_r_' + r.date, JSON.stringify(r));
  try { window.DB && window.DB.saveRoutine && window.DB.saveRoutine(r); } catch (e) {}
}

// ══ УС ═════════════════════════════════════════════════════════════
// Ус хоёр газар бүртгэгддэг байсан: нүүр хуудсанд аягаар,
// Тэмдэглэл хуудсанд мл-ээр. Одоо НЭГ дата — мл нь гол,
// аяга нь зөвхөн харуулах хэлбэр. Хаанаас нэмсэн ч хоёул харагдана.
function jvCfg() {
  var c = { goalMl: 2000, cupMl: 250 };
  try {
    var v = JSON.parse(localStorage.getItem('jarvis_water_cfg') || 'null');
    if (v && v.goalMl > 0 && v.cupMl > 0) c = v;
  } catch (e) {}
  // Зорилтыг Тэмдэглэл хуудас өдрийн бүртгэлдээ хадгалдаг — тэр нь давуу
  var log = jvLog0();
  if (log && log.water && log.water.goal_ml > 0) c.goalMl = log.water.goal_ml;
  return c;
}
function jvSaveCfg(c) {
  localStorage.setItem('jarvis_water_cfg', JSON.stringify(c));
  var log = jvLog0() || {};
  log.date  = jvToday();
  log.water = log.water || { total_ml: 0, goal_ml: c.goalMl, entries: [] };
  log.water.goal_ml = c.goalMl;
  jvSaveLog0(log);
}
function jvLog0() {
  try { return JSON.parse(localStorage.getItem('jarvis_log_' + jvToday()) || 'null'); }
  catch (e) { return null; }
}
function jvSaveLog0(log) {
  localStorage.setItem('jarvis_log_' + jvToday(), JSON.stringify(log));
  try { window.DB && window.DB.saveLog && window.DB.saveLog(jvToday(), log); } catch (e) {}
}
function jvCups() { var c = jvCfg(); return Math.max(1, Math.round(c.goalMl / c.cupMl)); }

// Өнөөдөр уусан ус (мл)
function jvWaterMl() {
  var log = jvLog0();
  if (log && log.water && typeof log.water.total_ml === 'number') return log.water.total_ml;
  return (jvLoad().water || 0) * jvCfg().cupMl;   // хуучин дата — аягаас хөрвүүлнэ
}
// Ус нэмэх / тохируулах — хоёр газарт зэрэг бичнэ
function jvSetWaterMl(ml) {
  var c = jvCfg();
  ml = Math.max(0, Math.round(ml));
  var log = jvLog0() || { date: jvToday(), sleep: {}, shower: false, study: [], note: '' };
  log.date  = jvToday();
  log.water = log.water || { total_ml: 0, goal_ml: c.goalMl, entries: [] };
  var diff = ml - (log.water.total_ml || 0);
  if (diff > 0) {
    log.water.entries = log.water.entries || [];
    // Тэмдэглэл хуудасны хэлбэртэй ижил байх ёстой: { id, time, ml }
    var n = new Date();
    log.water.entries.push({
      id: Date.now(), ml: diff,
      time: String(n.getHours()).padStart(2,'0') + ':' + String(n.getMinutes()).padStart(2,'0')
    });
  }
  log.water.total_ml = ml;
  log.water.goal_ml  = c.goalMl;
  jvSaveLog0(log);

  var r = jvLoad();
  r.water = Math.round(ml / c.cupMl);   // хуучин оноо, streak-д хэрэгтэй
  jvSave(r);
}

// ══ ДАСГАЛ ═════════════════════════════════════════════════════════
var JV_WORKOUTS = ['Цээж','Нуруу','Хөл','Мөр','Гар','Гэдэс','Бүтэн бие','Гүйлт','Алхалт','Амралт'];

function jvPlan() {
  try {
    var p = JSON.parse(localStorage.getItem('jarvis_workout_plan') || 'null');
    if (p) return p;
  } catch (e) {}
  return { 0:'Амралт', 1:'Цээж', 2:'Нуруу', 3:'Хөл', 4:'Мөр', 5:'Бүтэн бие', 6:'Амралт' };
}
function jvSavePlan(p) { localStorage.setItem('jarvis_workout_plan', JSON.stringify(p)); }
function jvTodayPlan() { return jvPlan()[new Date().getDay()] || ''; }

function jvLog(dateStr) {
  try { return JSON.parse(localStorage.getItem('jarvis_workout_' + (dateStr || jvToday())) || 'null'); }
  catch (e) { return null; }
}
function jvSaveLog(log) {
  localStorage.setItem('jarvis_workout_' + jvToday(), JSON.stringify(log));
}

// ══ ДООРООС ГАРАХ САМБАР ═══════════════════════════════════════════
var _sheet = null, _sheetBack = null;
function jvSheet(title, sub, bodyHtml, onDone) {
  jvCloseSheet();
  _sheetBack = document.createElement('div');
  _sheetBack.className = 'jv-sheet-back';
  _sheetBack.addEventListener('click', jvCloseSheet);

  _sheet = document.createElement('div');
  _sheet.className = 'jv-sheet';
  _sheet.setAttribute('role', 'dialog');
  _sheet.innerHTML = '<div class="jv-sheet-grip"></div><h2>' + title + '</h2>' +
                     '<p class="sub">' + sub + '</p>' + bodyHtml +
                     '<button class="jv-sheet-done">Болсон</button>';

  document.body.appendChild(_sheetBack);
  document.body.appendChild(_sheet);
  requestAnimationFrame(function () {
    _sheetBack.classList.add('in'); _sheet.classList.add('in');
  });
  _sheet.querySelector('.jv-sheet-done').addEventListener('click', function () {
    if (onDone) onDone(_sheet);
    jvCloseSheet();
    renderAll();
  });
  document.addEventListener('keydown', _sheetKey);
}
function _sheetKey(e) { if (e.key === 'Escape') jvCloseSheet(); }
function jvCloseSheet() {
  document.removeEventListener('keydown', _sheetKey);
  [_sheet, _sheetBack].forEach(function (el) {
    if (!el) return;
    el.classList.remove('in');
    setTimeout(function () { el.remove(); }, 250);
  });
  _sheet = _sheetBack = null;
}

// ── Усны самбар ───────────────────────────────────────────────────
function jvWaterSheet() {
  var c = jvCfg();
  jvSheet('Ус', 'Өдрийн зорилтоо болон аяганыхаа хэмжээг тохируул.',
    '<div class="jv-field"><label>Өдрийн зорилт</label>' +
      '<div class="jv-num"><input id="w-goal" type="number" min="200" max="6000" step="100" value="' + c.goalMl + '"><span>мл</span></div></div>' +
    '<div class="jv-field"><label>Нэг аяга / шил</label>' +
      '<div class="jv-num"><input id="w-cup" type="number" min="50" max="1500" step="50" value="' + c.cupMl + '"><span>мл</span></div></div>' +
    '<div class="jv-field"><label>Өнөөдөр уусан</label>' +
      '<div class="jv-num"><input id="w-now" type="number" min="0" max="8000" step="50" value="' + jvWaterMl() + '"><span>мл</span></div></div>',
    function (sh) {
      var goal = parseInt(sh.querySelector('#w-goal').value, 10);
      var cup  = parseInt(sh.querySelector('#w-cup').value, 10);
      var now  = parseInt(sh.querySelector('#w-now').value, 10);
      if (goal > 0 && cup > 0) jvSaveCfg({ goalMl: goal, cupMl: cup });
      if (!isNaN(now)) jvSetWaterMl(now);
    });
}

// ── Дасгалын самбар ───────────────────────────────────────────────
function jvWorkoutSheet() {
  var log = jvLog() || { type: jvTodayPlan(), mins: 45 };
  var chips = JV_WORKOUTS.map(function (t) {
    return '<button class="jv-chip' + (t === log.type ? ' on' : '') + '" data-t="' + t + '">' + t + '</button>';
  }).join('');

  jvSheet('Дасгал', 'Ямар дасгал хийснээ тэмдэглэ.',
    '<div class="jv-field"><label>Төрөл</label><div class="jv-chips" id="w-types">' + chips + '</div></div>' +
    '<div class="jv-field"><label>Хугацаа</label>' +
      '<div class="jv-num"><input id="w-mins" type="number" min="5" max="300" step="5" value="' + (log.mins || 45) + '"><span>минут</span></div></div>' +
    '<div class="jv-field"><button class="jv-chip" id="w-open-plan" style="width:100%">Долоо хоногийн төлөвлөгөө →</button></div>',
    function (sh) {
      var on = sh.querySelector('.jv-chip.on');
      var mins = parseInt(sh.querySelector('#w-mins').value, 10) || 45;
      jvSaveLog({ type: on ? on.dataset.t : jvTodayPlan(), mins: mins });
      var rr = jvLoad();
      rr.exercise = true;
      jvSave(rr);
    });

  _sheet.querySelector('#w-types').addEventListener('click', function (e) {
    var b = e.target.closest('.jv-chip'); if (!b) return;
    _sheet.querySelectorAll('#w-types .jv-chip').forEach(function (x) { x.classList.remove('on'); });
    b.classList.add('on');
  });
  _sheet.querySelector('#w-open-plan').addEventListener('click', function () {
    jvCloseSheet(); setTimeout(jvPlanSheet, 260);
  });
}

// ── Долоо хоногийн төлөвлөгөө ─────────────────────────────────────
function jvPlanSheet() {
  var names = ['Ням','Даваа','Мягмар','Лхагва','Пүрэв','Баасан','Бямба'];
  var p = jvPlan(), today = new Date().getDay();
  var rows = names.map(function (n, i) {
    var opts = JV_WORKOUTS.map(function (t) {
      return '<option' + (p[i] === t ? ' selected' : '') + '>' + t + '</option>';
    }).join('');
    return '<div class="jv-plan-row' + (i === today ? ' today' : '') + '">' +
           '<b>' + n + '</b><select data-d="' + i + '">' + opts + '</select></div>';
  }).join('');

  jvSheet('Долоо хоногийн төлөвлөгөө', 'Өдөр бүр ямар дасгал хийхээ товло. Нүүр хуудсанд өнөөдрийнх нь харагдана.',
    '<div class="jv-plan">' + rows + '</div>',
    function (sh) {
      var np = {};
      sh.querySelectorAll('.jv-plan-row select').forEach(function (sel) {
        np[sel.dataset.d] = sel.value;
      });
      jvSavePlan(np);
    });
}


// Өнөөдөр тэмдэглэл бичсэн эсэх — Тэмдэглэл хуудасны бичвэрээс уншина
function jvHasNote() {
  var log = jvLog0();
  return !!(log && log.note && log.note.trim());
}
