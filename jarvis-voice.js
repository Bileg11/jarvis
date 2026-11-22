// ══════════════════════════════════════════════════════════════════
// JARVIS VOICE — Jarvis-ийн хариуг МОНГОЛООР чангаар унших
// ══════════════════════════════════════════════════════════════════
// Хэрэглэх:
//   <script src="jarvis-voice.js"></script>
//   JarvisVoice.speak('Сайн байна уу');
//   JarvisVoice.mountToggle(document.querySelector('#somewhere'));
//
// Дуу хаанаас гардаг вэ:
//   voice/start.sh ажиллаж байвал → локал сервер (монгол хоолой, чанартай)
//   ажиллахгүй бол                → дуу гарахгүй, товч нь заавар харуулна
//
// Бусад кодтой холбогдох арга — window дээрх эвентүүд:
//   jarvis-voice-start  (detail: {text})
//   jarvis-voice-level  (detail: {level: 0..1})   ← дүрийн ам хөдөлгөнө
//   jarvis-voice-end
'use strict';

(function () {
  if (window.JarvisVoice) return;

  var SERVER = 'http://127.0.0.1:7788';
  var LS_ON = 'jarvis_voice_on';
  var LS_VOICE = 'jarvis_voice_name';
  var SS_PROBE = 'jarvis_voice_probe';

  var state = {
    mode: 'unknown',     // unknown | local | none
    checking: null,      // Promise
    speaking: false,
    lastError: '',
  };

  var audioEl = null;
  var ctx = null, srcNode = null, analyser = null, dataArr = null;
  var rafId = 0;
  var curUrl = '';
  var curAbort = null;
  var toggles = [];

  // ── Жижиг туслахууд ──────────────────────────────────────────
  function ls(k, v) {
    try {
      if (v === undefined) return localStorage.getItem(k);
      localStorage.setItem(k, v); return v;
    } catch (e) { return null; }
  }

  function emit(name, detail) {
    try { window.dispatchEvent(new CustomEvent(name, { detail: detail || {} })); } catch (e) {}
  }

  function timeoutSignal(ms) {
    if (typeof AbortSignal !== 'undefined' && AbortSignal.timeout) {
      try { return AbortSignal.timeout(ms); } catch (e) {}
    }
    var ac = new AbortController();
    setTimeout(function () { try { ac.abort(); } catch (e) {} }, ms);
    return ac.signal;
  }

  function isEnabled() { return ls(LS_ON) === '1'; }

  function voiceName() { return ls(LS_VOICE) || 'bataa'; }

  // ── Сервер ажиллаж байна уу? ─────────────────────────────────
  function probe(force) {
    if (!force && state.checking) return state.checking;
    if (!force) {
      try {
        var cached = sessionStorage.getItem(SS_PROBE);
        if (cached === 'local' || cached === 'none') {
          state.mode = cached;
          state.checking = Promise.resolve(cached);
          return state.checking;
        }
      } catch (e) {}
    }
    state.checking = fetch(SERVER + '/health', { signal: timeoutSignal(1800), cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) {
        state.mode = (j && j.ok) ? 'local' : 'none';
        state.health = j || null;
        return state.mode;
      })
      .catch(function () { state.mode = 'none'; return 'none'; })
      .then(function (m) {
        try { sessionStorage.setItem(SS_PROBE, m); } catch (e) {}
        paintToggles();
        return m;
      });
    return state.checking;
  }

  // ── Аудио хоолой (нэг удаа үүснэ) ────────────────────────────
  function ensureAudio() {
    if (audioEl) return;
    audioEl = new Audio();
    audioEl.preload = 'auto';
    audioEl.crossOrigin = 'anonymous';
    audioEl.addEventListener('ended', finish);
    audioEl.addEventListener('error', function () { finish(); });
  }

  // AudioContext зөвхөн хэрэглэгчийн үйлдлийн дараа л эхэлнэ (браузерын дүрэм).
  // Амжилтгүй болбол дуу гарсаар байна — зөвхөн амны хөдөлгөөн л алга болно.
  function ensureAnalyser() {
    if (analyser || !audioEl) return;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try {
      ctx = ctx || new AC();
      srcNode = ctx.createMediaElementSource(audioEl);
      analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.75;
      dataArr = new Uint8Array(analyser.frequencyBinCount);
      srcNode.connect(analyser);
      analyser.connect(ctx.destination);
    } catch (e) {
      analyser = null;   // амны хөдөлгөөнгүйгээр үргэлжилнэ
    }
  }

  function tickLevel() {
    if (!state.speaking) return;
    var level = 0;
    if (analyser && dataArr) {
      analyser.getByteFrequencyData(dataArr);
      var sum = 0;
      // Хүний яриа голдуу доод давтамжид — эхний 32 нүдийг авна
      var n = Math.min(32, dataArr.length);
      for (var i = 0; i < n; i++) sum += dataArr[i];
      level = Math.min(1, (sum / n) / 110);
    } else {
      // Анализатор байхгүй бол зүгээр хэмнэлтэй хөдөлгөөн
      level = 0.35 + 0.3 * Math.abs(Math.sin(Date.now() / 110));
    }
    emit('jarvis-voice-level', { level: level });
    rafId = requestAnimationFrame(tickLevel);
  }

  function finish() {
    if (!state.speaking) return;
    state.speaking = false;
    if (rafId) cancelAnimationFrame(rafId);
    rafId = 0;
    emit('jarvis-voice-level', { level: 0 });
    emit('jarvis-voice-end', {});
    paintToggles();
    if (curUrl) { try { URL.revokeObjectURL(curUrl); } catch (e) {} curUrl = ''; }
  }

  function stop() {
    if (curAbort) { try { curAbort.abort(); } catch (e) {} curAbort = null; }
    if (audioEl) { try { audioEl.pause(); audioEl.currentTime = 0; } catch (e) {} }
    finish();
  }

  // ── Гол үйлдэл ───────────────────────────────────────────────
  function speak(text, opts) {
    opts = opts || {};
    if (!text || (!isEnabled() && !opts.force)) return Promise.resolve(false);

    return probe().then(function (mode) {
      if (mode !== 'local') return false;

      stop();
      ensureAudio();
      ensureAnalyser();
      if (ctx && ctx.state === 'suspended') { try { ctx.resume(); } catch (e) {} }

      var ac = new AbortController();
      curAbort = ac;

      return fetch(SERVER + '/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: String(text),
          voice: opts.voice || voiceName(),
          provider: opts.provider || '',
          rate: opts.rate || '',
          pitch: opts.pitch || '',
        }),
        signal: ac.signal,
      }).then(function (r) {
        if (r.status === 422) return null;            // уншихгүй (JSON action гэх мэт) — алдаа биш
        if (!r.ok) throw new Error('TTS ' + r.status);
        return r.blob();
      }).then(function (blob) {
        if (!blob) return false;
        curUrl = URL.createObjectURL(blob);
        audioEl.src = curUrl;
        state.speaking = true;
        state.lastError = '';
        emit('jarvis-voice-start', { text: text });
        paintToggles();
        rafId = requestAnimationFrame(tickLevel);
        return audioEl.play().then(function () { return true; }).catch(function (e) {
          // Автомат тоглуулахыг браузер хориглосон — хэрэглэгч дарах хэрэгтэй
          state.lastError = 'autoplay';
          finish();
          return false;
        });
      }).catch(function (e) {
        if (e && e.name === 'AbortError') return false;
        state.lastError = String(e && e.message || e);
        finish();
        return false;
      }).then(function (v) { curAbort = null; return v; });
    });
  }

  // ── Асаах/унтраах товч ───────────────────────────────────────
  var ICON_ON =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" ' +
    'stroke-linecap="round" stroke-linejoin="round"><path d="M4 9.5h3.5L12 5.5v13L7.5 14.5H4z"/>' +
    '<path d="M16 9a4.5 4.5 0 0 1 0 6"/><path d="M18.8 6.2a8.5 8.5 0 0 1 0 11.6"/></svg>';
  var ICON_OFF =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" ' +
    'stroke-linecap="round" stroke-linejoin="round"><path d="M4 9.5h3.5L12 5.5v13L7.5 14.5H4z"/>' +
    '<path d="m16.5 9.5 5 5"/><path d="m21.5 9.5-5 5"/></svg>';

  function paintToggles() {
    toggles.forEach(function (b) {
      var on = isEnabled();
      var ok = state.mode !== 'none';
      b.innerHTML = on ? ICON_ON : ICON_OFF;
      b.classList.toggle('on', on);
      b.classList.toggle('speaking', state.speaking);
      b.classList.toggle('unavailable', on && !ok);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
      b.title = !on
        ? 'Дуу хоолой унтраалттай — асаахаар дар'
        : (ok ? 'Jarvis чангаар уншина — унтраахаар дар'
              : 'Дуу хоолойн сервер асаагүй: voice/start.sh ажиллуулна уу');
    });
  }

  function mountToggle(parent, cls) {
    if (!parent) return null;
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'jv-voice-btn' + (cls ? ' ' + cls : '');
    b.setAttribute('aria-label', 'Дуу хоолой');
    b.addEventListener('click', function () {
      var next = isEnabled() ? '0' : '1';
      ls(LS_ON, next);
      if (next === '1') {
        ensureAudio(); ensureAnalyser();
        if (ctx && ctx.state === 'suspended') { try { ctx.resume(); } catch (e) {} }
        probe(true).then(function (m) {
          paintToggles();
          if (m === 'local') speak('Дуу хоолой асаалаа.', { force: true });
        });
      } else {
        stop();
      }
      paintToggles();
    });
    parent.appendChild(b);
    toggles.push(b);
    paintToggles();
    probe();
    return b;
  }

  // ── Хэв маяг ─────────────────────────────────────────────────
  function injectCss() {
    if (document.getElementById('jv-voice-css')) return;
    var st = document.createElement('style');
    st.id = 'jv-voice-css';
    st.textContent = [
      '.jv-voice-btn{display:inline-flex;align-items:center;justify-content:center;',
      'width:38px;height:38px;flex:0 0 auto;border-radius:12px;cursor:pointer;',
      'background:var(--surface-2,rgba(127,127,127,.12));color:var(--text-2,#9aa);',
      'border:1px solid var(--border,rgba(127,127,127,.25));',
      'transition:color .18s,background .18s,border-color .18s,transform .12s}',
      '.jv-voice-btn svg{width:19px;height:19px}',
      '.jv-voice-btn:hover{transform:translateY(-1px)}',
      '.jv-voice-btn.on{color:var(--accent,#39d);border-color:var(--accent,#39d);',
      'background:var(--accent-soft,rgba(51,153,221,.14))}',
      '.jv-voice-btn.unavailable{color:#d9803b;border-color:#d9803b;background:rgba(217,128,59,.12)}',
      '.jv-voice-btn.speaking{animation:jvVoicePulse 1.1s ease-in-out infinite}',
      '@keyframes jvVoicePulse{0%,100%{box-shadow:0 0 0 0 rgba(var(--accent-rgb,51,153,221),.45)}',
      '50%{box-shadow:0 0 0 7px rgba(var(--accent-rgb,51,153,221),0)}}',
      '@media (prefers-reduced-motion:reduce){.jv-voice-btn.speaking{animation:none}}',
    ].join('');
    document.head.appendChild(st);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', injectCss);
  else injectCss();

  window.JarvisVoice = {
    speak: speak,
    stop: stop,
    probe: probe,
    mountToggle: mountToggle,
    isEnabled: isEnabled,
    setEnabled: function (v) { ls(LS_ON, v ? '1' : '0'); paintToggles(); },
    voice: voiceName,
    setVoice: function (v) { ls(LS_VOICE, v === 'yesui' ? 'yesui' : 'bataa'); },
    status: function () { return { mode: state.mode, speaking: state.speaking, error: state.lastError }; },
    health: function () { return state.health || null; },
    server: SERVER,
  };
})();
