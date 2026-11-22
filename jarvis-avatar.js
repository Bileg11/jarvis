// ══════════════════════════════════════════════════════════════════
// JARVIS AVATAR — ярьдаг дүр
// ══════════════════════════════════════════════════════════════════
// jarvis-voice.js-ийн эвентүүдийг сонсоод ам нь дууны далайцаар хөдөлнө.
//
// Хэрэглэх:
//   <script src="jarvis-voice.js"></script>
//   <script src="jarvis-avatar.js"></script>
//   JarvisAvatar.mount(document.querySelector('#avatar-box'));
//   JarvisAvatar.setState('thinking' | 'idle' | 'speaking');
//
// Өнгө нь design-system.css-ийн --accent-аас автоматаар авна —
// ертөнц/өнгө солиход дүр нь хамт өөрчлөгдөнө.
'use strict';

(function () {
  if (window.JarvisAvatar) return;

  var MOUTH_Y = 106;
  var mounts = [];
  var level = 0, shown = 0;
  var rafId = 0;
  var curState = 'idle';

  var SVG =
    '<svg class="jv-av-svg" viewBox="0 0 200 250" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
      '<defs>' +
        '<radialGradient id="jvGlow" cx="50%" cy="42%" r="54%">' +
          '<stop offset="0%" stop-color="var(--accent,#39d)" stop-opacity=".40"/>' +
          '<stop offset="65%" stop-color="var(--accent,#39d)" stop-opacity=".07"/>' +
          '<stop offset="100%" stop-color="var(--accent,#39d)" stop-opacity="0"/>' +
        '</radialGradient>' +
        // Саарал тунамал давхарга — гэрэл/харанхуй аль ч дэвсгэр дээр
        // дүрсний контур тодорхой харагдана (--surface ашиглавал уусна)
        '<linearGradient id="jvBody" x1="0" y1="0" x2="0" y2="1">' +
          '<stop offset="0%" stop-color="rgb(148,160,178)" stop-opacity=".34"/>' +
          '<stop offset="100%" stop-color="rgb(148,160,178)" stop-opacity=".15"/>' +
        '</linearGradient>' +
      '</defs>' +

      '<ellipse cx="100" cy="108" rx="96" ry="114" fill="url(#jvGlow)"/>' +

      // ── бие ──
      '<g class="jv-av-body">' +
        // хүзүү — толгойг биетэй холбоно (мөр доогуур эхэлнэ)
        '<rect x="86" y="118" width="28" height="44" rx="12" fill="url(#jvBody)" ' +
              'stroke="var(--border-strong,rgba(127,127,127,.4))" stroke-width="1.5"/>' +
        // мөр ба цээж
        '<path d="M34 250v-44c0-34 29-56 66-56s66 22 66 56v44z" fill="url(#jvBody)" ' +
              'stroke="var(--border-strong,rgba(127,127,127,.4))" stroke-width="1.8"/>' +
        // ороолт — ганц тод өнгө, хүзүү ба биеийн заагийг таглана
        '<path d="M64 158c10 10 22 15 36 15s26-5 36-15c6 4 10 10 12 17-14 12-30 18-48 18'
             + 's-34-6-48-18c2-7 6-13 12-17z" fill="var(--accent,#39d)" opacity=".95"/>' +
        '<path d="M141 176c5 3 8 7 10 12l-9 36-14-4z" fill="var(--accent,#39d)" opacity=".6"/>' +
        // цээжний цөм
        '<circle class="jv-av-core" cx="100" cy="222" r="9" fill="var(--accent,#39d)" opacity=".85"/>' +
      '</g>' +

      // ── толгой ──
      '<g class="jv-av-head">' +
        '<rect x="50" y="28" width="100" height="102" rx="33" fill="url(#jvBody)" ' +
              'stroke="var(--border-strong,rgba(127,127,127,.42))" stroke-width="1.8"/>' +
        // антен
        '<path d="M100 28V14" stroke="var(--accent,#39d)" stroke-width="3" stroke-linecap="round"/>' +
        '<circle class="jv-av-ant" cx="100" cy="10" r="5" fill="var(--accent,#39d)"/>' +
        // нүүрний хавтан
        '<rect x="62" y="48" width="76" height="46" rx="22" fill="rgba(0,0,0,.42)"/>' +
        // нүд
        '<g class="jv-av-eyes">' +
          '<rect x="76" y="63" width="15" height="15" rx="7.5" fill="var(--accent,#39d)"/>' +
          '<rect x="109" y="63" width="15" height="15" rx="7.5" fill="var(--accent,#39d)"/>' +
        '</g>' +
        // ам — өндөр нь дууны далайцаар өөрчлөгдөнө
        '<rect class="jv-av-mouth" x="86" y="106" width="28" height="4" rx="2" ' +
              'fill="var(--accent,#39d)" opacity=".9"/>' +
      '</g>' +
    '</svg>';

  var CSS = [
    '.jv-avatar{position:relative;display:block;width:100%;max-width:220px;margin:0 auto;',
    'line-height:0;user-select:none;-webkit-user-select:none}',
    '.jv-av-svg{width:100%;height:auto;overflow:visible}',

    '.jv-av-body{transform-origin:100px 250px;animation:jvBreath 4.2s ease-in-out infinite}',
    '.jv-av-head{transform-origin:100px 130px;animation:jvBob 4.2s ease-in-out infinite}',
    '@keyframes jvBreath{0%,100%{transform:scaleY(1)}50%{transform:scaleY(1.012)}}',
    '@keyframes jvBob{0%,100%{transform:translateY(0)}50%{transform:translateY(-3px)}}',

    '.jv-av-eyes{transform-origin:100px 70px;animation:jvBlink 6.5s infinite}',
    '@keyframes jvBlink{0%,92%,100%{transform:scaleY(1)}95%{transform:scaleY(.12)}}',

    '.jv-av-core{animation:jvCore 2.6s ease-in-out infinite}',
    '@keyframes jvCore{0%,100%{opacity:.5;r:8}50%{opacity:.95;r:10}}',
    '.jv-av-ant{animation:jvAnt 2.6s ease-in-out infinite}',
    '@keyframes jvAnt{0%,100%{opacity:.45}50%{opacity:1}}',

    // бодож байна — нүд нь зөөлөн анивчина, антен хурдан
    '.jv-avatar.is-thinking .jv-av-eyes{animation:jvThink 1.1s ease-in-out infinite}',
    '@keyframes jvThink{0%,100%{opacity:1}50%{opacity:.35}}',
    '.jv-avatar.is-thinking .jv-av-ant{animation-duration:.8s}',

    // ярьж байна — гэрэлтэнэ
    '.jv-avatar.is-speaking .jv-av-svg{filter:drop-shadow(0 0 14px rgba(var(--accent-rgb,51,153,221),.45))}',

    '@media (prefers-reduced-motion:reduce){',
    '.jv-av-body,.jv-av-head,.jv-av-eyes,.jv-av-core,.jv-av-ant{animation:none!important}}',
  ].join('');

  function injectCss() {
    if (document.getElementById('jv-avatar-css')) return;
    var st = document.createElement('style');
    st.id = 'jv-avatar-css';
    st.textContent = CSS;
    document.head.appendChild(st);
  }

  // ── Амны хөдөлгөөн ───────────────────────────────────────────
  // applyMouth — одоогийн `shown` утгаар SVG-г бичнэ (цэвэр геометр)
  function applyMouth() {
    var h = 4 + shown * 26;            // 4 → 30
    var w = 28 + shown * 8;            // яриад байхад бага зэрэг өргөсөнө
    var y = MOUTH_Y - (h - 4) / 2;
    mounts.forEach(function (m) {
      var mo = m.el.querySelector('.jv-av-mouth');
      if (!mo) return;
      mo.setAttribute('height', h.toFixed(1));
      mo.setAttribute('width', w.toFixed(1));
      mo.setAttribute('x', (100 - w / 2).toFixed(1));
      mo.setAttribute('y', y.toFixed(1));
      mo.setAttribute('rx', Math.min(10, h / 2).toFixed(1));
    });
  }

  // step — нэг зөөлрүүлэх алхам. Тасралтгүй, байгалийн хөдөлгөөн өгнө.
  function step() {
    shown += (level - shown) * 0.35;
    if (shown < 0.004 && level < 0.004) shown = 0;
    applyMouth();
  }

  function paint() {
    step();
    if (shown > 0.004 || level > 0.004) rafId = requestAnimationFrame(paint);
    else rafId = 0;
  }

  function paintOnce() { shown = 0; applyMouth(); }

  function kick() { if (!rafId) rafId = requestAnimationFrame(paint); }

  // Гаднаас амыг шууд хөдөлгөх (эвентгүйгээр ч ажиллана)
  function setLevel(v) {
    level = Math.max(0, Math.min(1, +v || 0));
    step();        // шууд нэг алхам — rAF удаашралтай ч хариу өгнө
    kick();        // үлдсэнийг нь жигд үргэлжлүүлнэ
  }

  function setState(s) {
    curState = s;
    mounts.forEach(function (m) {
      m.el.classList.toggle('is-thinking', s === 'thinking');
      m.el.classList.toggle('is-speaking', s === 'speaking');
    });
  }

  // ── Эвентүүд ─────────────────────────────────────────────────
  window.addEventListener('jarvis-voice-level', function (e) {
    setLevel((e.detail && e.detail.level) || 0);
  });
  window.addEventListener('jarvis-voice-start', function () { setState('speaking'); });
  window.addEventListener('jarvis-voice-end', function () {
    // Ам заавал хаагдана. rAF-д найдаж болохгүй: өөр таб руу шилжихэд
    // браузер rAF-ийг зогсоодог тул ам онгорхой хөлдөх эрсдэлтэй.
    level = 0;
    if (rafId) { cancelAnimationFrame(rafId); rafId = 0; }
    paintOnce();
    setState(curState === 'thinking' ? 'thinking' : 'idle');
  });

  // Таб руу буцаж ирэхэд хөдөлгөөнийг сэргээнэ
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) return;
    if (level > 0) kick();
    else paintOnce();
  });

  // ── Байрлуулах ───────────────────────────────────────────────
  function mount(parent, opts) {
    if (!parent) return null;
    injectCss();
    opts = opts || {};
    var box = document.createElement('div');
    box.className = 'jv-avatar';
    if (opts.maxWidth) box.style.maxWidth = opts.maxWidth;
    box.innerHTML = SVG;
    // Дарвал ярьж байгааг нь зогсооно
    box.addEventListener('click', function () {
      if (window.JarvisVoice && window.JarvisVoice.status().speaking) window.JarvisVoice.stop();
    });
    parent.appendChild(box);
    mounts.push({ el: box });
    paintOnce();
    setState(curState);
    return box;
  }

  window.JarvisAvatar = {
    mount: mount,
    setState: setState,
    setLevel: setLevel,
    state: function () { return curState; },
  };
})();
