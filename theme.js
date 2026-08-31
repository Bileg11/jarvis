// ══════════════════════════════════════════════════════════════════
// JARVIS — ДҮР ТӨРХ СОЛИХ СИСТЕМ
// ══════════════════════════════════════════════════════════════════
// Гурван ертөнц: Цаас (paper) · Шөнийн самбар (night) · Тод (bright)
// Шөнийн самбар доторх өнгө: cyan · amber · matrix · red · void
//
// Хэрэглэх: <head> дотор design-system.css-ийн ДАРАА
//   <link rel="stylesheet" href="design-system.css">
//   <script src="theme.js"></script>
//
// Сонгох цонх нээх:  jarvisTheme.open()
// Товч байрлуулах:   <button onclick="jarvisTheme.open()">Дүр төрх</button>
'use strict';

(function () {
  if (window.jarvisTheme) return;

  var WORLDS = [
    { id: 'paper',  name: 'Цаас',            cn: '纸',  sub: 'Тайван, уншихад хамгийн хялбар',
      swatch: ['#F7F7F4', '#FFFFFF', '#2E6B57', '#1A1C19'] },
    { id: 'night',  name: 'Шөнийн самбар',   cn: '夜',  sub: 'JARVIS — сурах дэлгэц цайвар',
      swatch: ['#0E1116', '#171C22', '#3FB6C8', '#F8F9F6'] },
    { id: 'bright', name: 'Тод',             cn: '明',  sub: 'Том товч, зузаан үсэг',
      swatch: ['#FFFFFF', '#F6F7F9', '#F0821E', '#161A20'] },
  ];

  var ACCENTS = [
    { id: 'cyan',   name: 'Цэнхэр', color: '#3FB6C8' },
    { id: 'amber',  name: 'Шар',    color: '#E5A13C' },
    { id: 'matrix', name: 'Ногоон', color: '#4ADE80' },
    { id: 'red',    name: 'Улаан',  color: '#F2705C' },
    { id: 'void',   name: 'Ягаан',  color: '#A98CF5' },
  ];

  var DEFAULT_WORLD  = 'night';
  var DEFAULT_ACCENT = 'cyan';
  var K_WORLD = 'jarvis_world', K_ACCENT = 'jarvis_accent';

  function read(k, fallback, valid) {
    try {
      var v = localStorage.getItem(k);
      if (v && valid.indexOf(v) >= 0) return v;
    } catch (e) {}
    return fallback;
  }

  var worldIds  = WORLDS.map(function (w) { return w.id; });
  var accentIds = ACCENTS.map(function (a) { return a.id; });

  // ── Хуучин theme-үүдийг шинэ систем рүү шилжүүлэх ──────────────
  // 12 хуучин theme бүгд харанхуй байсан тул Шөнийн самбар руу орно.
  var LEGACY = {
    'stark-cyan': 'cyan', 'amber': 'amber', 'matrix': 'matrix',
    'red-alert': 'red', 'void': 'void', 'marlaa': 'red',
    'aurora': 'cyan', 'sunset': 'amber', 'ocean': 'cyan',
    'forest': 'matrix', 'rose': 'red', 'mono': 'cyan',
  };
  function migrate() {
    try {
      if (localStorage.getItem(K_WORLD)) return;          // аль хэдийн шилжсэн
      var old = localStorage.getItem('jarvis_theme');
      if (old && LEGACY[old]) {
        localStorage.setItem(K_WORLD, 'night');
        localStorage.setItem(K_ACCENT, LEGACY[old]);
      }
    } catch (e) {}
  }
  migrate();

  var world  = read(K_WORLD,  DEFAULT_WORLD,  worldIds);
  var accent = read(K_ACCENT, DEFAULT_ACCENT, accentIds);

  // ── Хэрэглэх ───────────────────────────────────────────────────
  var fontLoaded = false;
  function loadBrightFont() {
    // "Тод" сонгосон үед Л Nunito татагдана — бусад үед апп хөнгөн үлдэнэ
    if (fontLoaded || document.getElementById('ds-font-bright')) return;
    fontLoaded = true;
    var l = document.createElement('link');
    l.id = 'ds-font-bright';
    l.rel = 'stylesheet';
    l.href = 'https://fonts.googleapis.com/css2?family=Nunito:wght@600;700;800;900&display=swap';
    document.head.appendChild(l);
  }

  function apply() {
    var r = document.documentElement;
    r.setAttribute('data-world', world);
    r.setAttribute('data-accent', accent);
    if (world === 'bright') loadBrightFont();
    if (document.body) document.body.classList.add('ds');
    // Хөтчийн өөрийн UI-г (нэвтрэх талбар, гүйлгэх зурвас) тааруулна
    r.style.colorScheme = (world === 'night') ? 'dark' : 'light';

    // Дүр төрх солиход хөтөч зарим өнгийг хуучнаар нь үлдээдэг тул
    // бүх хуудсыг нэг кадрын дотор дахин тооцоолуулна (нүдэнд харагдахгүй).
    if (!first && document.body) {
      var b = document.body, prev = b.style.display;
      var sx = window.scrollX, sy = window.scrollY;
      b.style.display = 'none';
      void b.offsetHeight;
      b.style.display = prev;
      window.scrollTo(sx, sy);
    }
    first = false;
  }
  var first = true;
  apply();
  if (!document.body) {
    document.addEventListener('DOMContentLoaded', function () { document.body.classList.add('ds'); });
  }

  function set(nextWorld, nextAccent) {
    if (nextWorld && worldIds.indexOf(nextWorld) >= 0) world = nextWorld;
    if (nextAccent && accentIds.indexOf(nextAccent) >= 0) accent = nextAccent;
    try {
      localStorage.setItem(K_WORLD, world);
      localStorage.setItem(K_ACCENT, accent);
    } catch (e) {}
    apply();
    render();
    // Firestore-т хадгалж бүх төхөөрөмж дээр дагана (боломжтой үед)
    try {
      if (window.firebase && firebase.auth && firebase.auth().currentUser) {
        firebase.firestore()
          .doc('users/' + firebase.auth().currentUser.uid + '/config/profile')
          .set({ world: world, accent: accent }, { merge: true })
          .catch(function () {});
      }
    } catch (e) {}
    document.dispatchEvent(new CustomEvent('jarvis:theme', { detail: { world: world, accent: accent } }));
  }

  // ── Сонгох цонх ────────────────────────────────────────────────
  var sheet = null;

  function ensureStyle() {
    if (document.getElementById('ds-theme-style')) return;
    var s = document.createElement('style');
    s.id = 'ds-theme-style';
    s.textContent = [
      '.tp-back{position:fixed;inset:0;z-index:9998;background:rgba(0,0,0,.55);opacity:0;transition:opacity .2s}',
      '.tp-back.in{opacity:1}',
      '.tp{position:fixed;left:0;right:0;bottom:0;z-index:9999;background:var(--surface);',
      '  border-top:1px solid var(--border);border-radius:var(--r-lg) var(--r-lg) 0 0;',
      '  padding:var(--sp-5) var(--sp-4) calc(var(--sp-6) + env(safe-area-inset-bottom,0px));',
      '  max-height:88vh;overflow-y:auto;transform:translateY(100%);transition:transform .25s cubic-bezier(.2,.8,.2,1);',
      '  font-family:var(--font-ui);color:var(--text)}',
      '.tp.in{transform:translateY(0)}',
      '@media(min-width:720px){.tp{left:50%;right:auto;bottom:auto;top:50%;width:640px;',
      '  transform:translate(-50%,-46%) scale(.98);border-radius:var(--r-lg);border:1px solid var(--border);opacity:0}',
      '  .tp.in{transform:translate(-50%,-50%) scale(1);opacity:1}}',
      '.tp-grip{width:38px;height:4px;border-radius:99px;background:var(--border-strong);margin:0 auto var(--sp-4)}',
      '@media(min-width:720px){.tp-grip{display:none}}',
      '.tp-h{font-size:var(--fs-xl);font-weight:var(--w-bold);margin:0 0 var(--sp-1)}',
      '.tp-s{font-size:var(--fs-sm);color:var(--text-2);margin:0 0 var(--sp-5)}',
      '.tp-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:var(--sp-3)}',
      '@media(max-width:520px){.tp-grid{grid-template-columns:1fr}}',
      '.tp-w{border:2px solid var(--border);border-radius:var(--r-md);padding:var(--sp-3);',
      '  background:var(--surface-2);cursor:pointer;text-align:left;display:flex;flex-direction:column;gap:var(--sp-2);',
      '  font-family:inherit;color:var(--text);transition:border-color .15s}',
      '.tp-w:hover{border-color:var(--border-strong)}',
      '.tp-w.on{border-color:var(--accent)}',
      '.tp-prev{height:74px;border-radius:var(--r-sm);overflow:hidden;display:flex;position:relative}',
      '.tp-prev span{flex:1}',
      '.tp-prev b{position:absolute;left:8px;bottom:6px;font-family:var(--font-hanzi);font-size:26px;font-weight:500;line-height:1}',
      '.tp-n{font-size:var(--fs-md);font-weight:var(--w-bold);display:flex;align-items:center;gap:6px}',
      '.tp-n i{font-style:normal;color:var(--accent);font-size:var(--fs-sm)}',
      '.tp-d{font-size:var(--fs-xs);color:var(--text-2);line-height:1.45}',
      '.tp-acc{margin-top:var(--sp-5);display:none}',
      '.tp-acc.show{display:block}',
      '.tp-acc-row{display:flex;gap:var(--sp-3);flex-wrap:wrap;margin-top:var(--sp-3)}',
      '.tp-a{width:52px;display:flex;flex-direction:column;align-items:center;gap:5px;background:none;border:none;',
      '  cursor:pointer;font-family:inherit;color:var(--text-2);font-size:var(--fs-xs);padding:0}',
      '.tp-a i{width:34px;height:34px;border-radius:999px;border:2px solid transparent;display:block}',
      '.tp-a.on i{border-color:var(--text)}',
      '.tp-a.on{color:var(--text);font-weight:var(--w-bold)}',
      '.tp-close{margin-top:var(--sp-6);width:100%;min-height:var(--tap);border-radius:var(--r-md);',
      '  border:none;background:var(--accent);color:var(--accent-ink);font-family:inherit;',
      '  font-size:var(--fs-md);font-weight:var(--w-cta);cursor:pointer;box-shadow:var(--sh-btn)}',
    ].join('');
    document.head.appendChild(s);
  }

  function render() {
    if (!sheet) return;
    sheet.querySelectorAll('.tp-w').forEach(function (el) {
      el.classList.toggle('on', el.dataset.w === world);
      el.setAttribute('aria-pressed', el.dataset.w === world ? 'true' : 'false');
    });
    sheet.querySelectorAll('.tp-a').forEach(function (el) {
      el.classList.toggle('on', el.dataset.a === accent);
      el.setAttribute('aria-pressed', el.dataset.a === accent ? 'true' : 'false');
    });
    var acc = sheet.querySelector('.tp-acc');
    if (acc) acc.classList.toggle('show', world === 'night');
  }

  function open() {
    ensureStyle();
    if (sheet) { close(); return; }

    var back = document.createElement('div');
    back.className = 'tp-back';
    back.addEventListener('click', close);

    sheet = document.createElement('div');
    sheet.className = 'tp';
    sheet.setAttribute('role', 'dialog');
    sheet.setAttribute('aria-label', 'Дүр төрх сонгох');

    var worldsHtml = WORLDS.map(function (w) {
      var bars = w.swatch.map(function (c) { return '<span style="background:' + c + '"></span>'; }).join('');
      return '<button class="tp-w" data-w="' + w.id + '">' +
             '<div class="tp-prev">' + bars +
               '<b style="color:' + w.swatch[3] + '">' + w.cn + '</b></div>' +
             '<div class="tp-n">' + w.name + (w.id === DEFAULT_WORLD ? ' <i>үндсэн</i>' : '') + '</div>' +
             '<div class="tp-d">' + w.sub + '</div></button>';
    }).join('');

    var accHtml = ACCENTS.map(function (a) {
      return '<button class="tp-a" data-a="' + a.id + '">' +
             '<i style="background:' + a.color + '"></i>' + a.name + '</button>';
    }).join('');

    sheet.innerHTML =
      '<div class="tp-grip"></div>' +
      '<h2 class="tp-h">Дүр төрх</h2>' +
      '<p class="tp-s">Аль нь чамд тохирохыг сонго. Хэзээ ч солиж болно.</p>' +
      '<div class="tp-grid">' + worldsHtml + '</div>' +
      '<div class="tp-acc"><div class="ds-label">Өнгө</div><div class="tp-acc-row">' + accHtml + '</div></div>' +
      '<button class="tp-close">Болсон</button>';

    document.body.appendChild(back);
    document.body.appendChild(sheet);

    sheet.querySelectorAll('.tp-w').forEach(function (el) {
      el.addEventListener('click', function () { set(el.dataset.w, null); });
    });
    sheet.querySelectorAll('.tp-a').forEach(function (el) {
      el.addEventListener('click', function () { set(null, el.dataset.a); });
    });
    sheet.querySelector('.tp-close').addEventListener('click', close);
    document.addEventListener('keydown', onKey);

    render();
    requestAnimationFrame(function () { back.classList.add('in'); sheet.classList.add('in'); });
  }

  function onKey(e) { if (e.key === 'Escape') close(); }

  function close() {
    var back = document.querySelector('.tp-back');
    if (sheet) sheet.classList.remove('in');
    if (back) back.classList.remove('in');
    document.removeEventListener('keydown', onKey);
    var s = sheet, b = back;
    sheet = null;
    setTimeout(function () { if (s) s.remove(); if (b) b.remove(); }, 260);
  }

  // ── Firestore-оос сонголтыг сэргээх (нэвтэрсэн үед) ────────────
  function syncFromCloud() {
    try {
      if (!(window.firebase && firebase.auth)) return;
      firebase.auth().onAuthStateChanged(function (u) {
        if (!u) return;
        firebase.firestore().doc('users/' + u.uid + '/config/profile').get()
          .then(function (snap) {
            if (!snap.exists) return;
            var d = snap.data() || {};
            var changed = false;
            if (d.world && worldIds.indexOf(d.world) >= 0 && d.world !== world) { world = d.world; changed = true; }
            if (d.accent && accentIds.indexOf(d.accent) >= 0 && d.accent !== accent) { accent = d.accent; changed = true; }
            if (changed) {
              try { localStorage.setItem(K_WORLD, world); localStorage.setItem(K_ACCENT, accent); } catch (e) {}
              apply(); render();
            }
          }).catch(function () {});
      });
    } catch (e) {}
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', syncFromCloud);
  else syncFromCloud();

  window.jarvisTheme = {
    open: open, close: close, set: set,
    get: function () { return { world: world, accent: accent }; },
    worlds: WORLDS, accents: ACCENTS,
  };
})();
