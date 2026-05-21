// Storage helpers
function getToday() {
  return new Date().toISOString().split('T')[0];
}

function getRoutine() {
  const key = 'routine_' + getToday();
  const defaults = { water: 0, exercise: false, hanzi: false };
  try {
    return JSON.parse(localStorage.getItem(key)) || defaults;
  } catch {
    return defaults;
  }
}

function saveRoutine(data) {
  localStorage.setItem('routine_' + getToday(), JSON.stringify(data));
}

// Toast notification
function showToast(msg) {
  let toast = document.getElementById('toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast';
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2200);
}

// Clock
function startClock() {
  const timeEl = document.getElementById('clock-time');
  const dateEl = document.getElementById('clock-date');
  if (!timeEl) return;

  const days = ['Ням', 'Даваа', 'Мягмар', 'Лхагва', 'Пүрэв', 'Баасан', 'Бямба'];
  const months = ['1-р сар', '2-р сар', '3-р сар', '4-р сар', '5-р сар', '6-р сар',
    '7-р сар', '8-р сар', '9-р сар', '10-р сар', '11-р сар', '12-р сар'];

  function update() {
    const now = new Date();
    const h = String(now.getHours()).padStart(2, '0');
    const m = String(now.getMinutes()).padStart(2, '0');
    timeEl.textContent = h + ':' + m;
    if (dateEl) {
      dateEl.textContent = days[now.getDay()] + ', ' + now.getDate() + ' ' + months[now.getMonth()];
    }
  }
  update();
  setInterval(update, 1000);
}

// Build morning brief prompt
function buildPrompt() {
  const r = getRoutine();
  const water = r.water + '/8';
  const exercise = r.exercise ? 'тийм ✓' : 'үгүй ✗';
  const hanzi = r.hanzi ? 'тийм ✓' : 'үгүй ✗';
  return `Өнөөдөр миний routine: Ус ${water}, Дасгал ${exercise}, 汉字 ${hanzi}.

Надад өнөөдрийн brief өг:
1. 1 motivational thought
2. 1 бизнесийн concept
3. 1 сануулга`;
}
