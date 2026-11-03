/* ══════════════════════════════════════════════════════════════════
   HSK5 — шалгалтын бэлтгэлийн систем (HSK 3.0 стандарт)
   Шалгалт: 2026-12-13 · 72 асуулт · 110 мин · 300 оноо · босго 180
   ────────────────────────────────────────────────────────────────
   Дата:  data/hsk3/words-l{1..5}.json   [үг, пиньин, POS, англи]
          data/hsk3/mn-l{1..5}.json      ["монгол", ...]
          data/hsk3/grammar-l1-5.json    [түвшин, бүлэг, ангилал, дэд, агуулга]
          data/hsk3/bank.json            сонсгол/унших/бичих/ярианы даалгаврууд
   ══════════════════════════════════════════════════════════════════ */
'use strict';

/* ── ТОГТМОЛ ─────────────────────────────────────────────────── */
const EXAM      = window.JARVIS_EXAM_DATE || new Date('2026-12-13T14:00:00+08:00');
const TARGET    = window.JARVIS_EXAM_TARGET || 240;
const PASS      = 180;
const POMO_WORK = 25, POMO_BREAK = 5, POMO_GOAL = 12;
const LS        = 'hsk5_';
const PROXY     = (localStorage.getItem('jarvis_proxy_url') || 'https://jarvis-chat-proxy.vercel.app').replace(/\/$/, '');

const today = () => (window.jarvisDay ? window.jarvisDay() : new Date().toISOString().slice(0, 10));
const daysLeft = () => Math.max(0, Math.ceil((EXAM - Date.now()) / 86400000));
const $  = id => document.getElementById(id);
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function toast(msg, ms = 2200) {
  const t = $('toast'); if (!t) return;
  t.textContent = msg; t.classList.add('on');
  clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('on'), ms);
}

/* ── ХАДГАЛАЛТ — localStorage үндсэн, Firestore нөөц ─────────── */
const Store = {
  get(k, d)  { try { const v = localStorage.getItem(LS + k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v)  { try { localStorage.setItem(LS + k, JSON.stringify(v)); } catch {} this._sync(k, v); },
  _db: null, _uid: null, _t: {}, cloudState: 'шалгаж байна',
  async initCloud() {
    try {
      if (!window.firebase?.apps?.length) { this.cloudState = 'firebase алга'; return; }
      const auth = firebase.auth();
      await new Promise(r => auth.onAuthStateChanged(u => { this._uid = u?.uid || null; r(); }));
      if (!this._uid) { this.cloudState = 'нэвтрээгүй'; return; }
      this.cloudState = 'холбогдсон';
      this._db = firebase.firestore();
      const ref  = this._db.doc(`users/${this._uid}/hsk5/state`);
      const snap = await ref.get();
      const cloud   = snap.exists ? (snap.data() || {}) : null;
      const cloudAt = cloud?.updatedAt || 0;
      const localAt = this.get('updatedAt', 0);

      // Үүлэн дэх хувилбар шинэ бол татаж авна
      if (cloud && cloudAt > localAt) {
        Object.keys(cloud).forEach(k => {
          if (k !== 'updatedAt') localStorage.setItem(LS + k, JSON.stringify(cloud[k]));
        });
        localStorage.setItem(LS + 'updatedAt', JSON.stringify(cloudAt));
        return true;   // дахин зурах шаардлагатай
      }

      // Эсрэгээр: энэ хөтөч дээр хийсэн ажил үүлэнд ороогүй бол ӨГСГӨНӨ.
      // (Нэвтрэхээс өмнө хийсэн онош, давталт ингэж алдагддаг байв.)
      const local = {};
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key || !key.startsWith(LS) || key === LS + 'updatedAt') continue;
        try { local[key.slice(LS.length)] = JSON.parse(localStorage.getItem(key)); } catch {}
      }
      const hasLocal = Object.keys(local).length > 0;
      if (hasLocal && localAt >= cloudAt) {
        const at = Date.now();
        await ref.set({ ...local, updatedAt: at }, { merge: true });
        localStorage.setItem(LS + 'updatedAt', JSON.stringify(at));
        console.log('[HSK5] Энэ хөтчийн явцыг үүлэн рүү хадгаллаа');
      }
    } catch (e) { this.cloudState = 'алдаа: ' + e.message; console.warn('[HSK5] үүл:', e.message); }
    return false;
  },
  _sync(k, v) {
    if (!this._db || !this._uid) return;
    clearTimeout(this._t[k]);
    this._t[k] = setTimeout(() => {
      const at = Date.now();
      try { localStorage.setItem(LS + 'updatedAt', JSON.stringify(at)); } catch {}
      this._db.doc(`users/${this._uid}/hsk5/state`)
        .set({ [k]: v, updatedAt: at }, { merge: true }).catch(() => {});
    }, 1500);
  },
};

/* ── ДАТА ────────────────────────────────────────────────────── */
const Data = {
  words: {}, mn: {}, grammar: null, bank: null,
  async words_(lv) {
    if (this.words[lv]) return this.words[lv];
    const [w, m] = await Promise.all([
      fetch(`data/hsk3/words-l${lv}.json`).then(r => r.json()).catch(() => []),
      fetch(`data/hsk3/mn-l${lv}.json`).then(r => r.json()).catch(() => []),
    ]);
    this.words[lv] = w.map((x, i) => ({ h: x[0], p: x[1], pos: x[2], en: x[3], mn: m[i] || '', lv }));
    return this.words[lv];
  },
  async all(levels = [1, 2, 3, 4, 5]) {
    const out = []; for (const lv of levels) out.push(...await this.words_(lv)); return out;
  },
  async grammar_() {
    if (this.grammar) return this.grammar;
    this.grammar = await fetch('data/hsk3/grammar-l1-5.json').then(r => r.json()).catch(() => []);
    return this.grammar;
  },
  async bank_() {
    if (this.bank) return this.bank;
    this.bank = await fetch('data/hsk3/bank.json').then(r => r.json())
      .catch(() => ({ listen: [], read: [], write: [], speak: [] }));
    return this.bank;
  },
};

/* ── AI (chat-proxy) ─────────────────────────────────────────── */
const AI = {
  ok: null,
  async ask(system, user, maxTokens = 700, tier = 'pro') {
    const headers = { 'Content-Type': 'application/json' };
    const secret = localStorage.getItem('jarvis_proxy_secret') || '';
    if (secret) headers['x-jarvis-secret'] = secret;
    try {
      const res = await Promise.race([
        fetch(PROXY + '/chat', {
          method: 'POST', headers,
          body: JSON.stringify({
            tier,
            messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
            max_tokens: maxTokens, temperature: 0.4,
          }),
        }),
        new Promise((_, rj) => setTimeout(() => rj(new Error('timeout')), 30000)),
      ]);
      if (!res.ok) throw new Error('http ' + res.status);
      const d = await res.json();
      const t = d.choices?.[0]?.message?.content?.trim();
      if (!t) throw new Error('хоосон');
      this.ok = true; return t;
    } catch (e) { this.ok = false; return null; }
  },
};

/* ══ POMODORO ════════════════════════════════════════════════ */
const Pomo = {
  left: POMO_WORK * 60, running: false, onBreak: false, task: '', _iv: null,
  init() {
    const s = Store.get('pomo_' + today(), { done: 0 });
    this.done = s.done || 0;
    this.render();
  },
  setTask(t) { this.task = t; this.render(); },
  toggle() {
    this.running = !this.running;
    if (this.running && !this._iv) this._iv = setInterval(() => this.tick(), 1000);
    this.render();
  },
  reset() {
    this.left = (this.onBreak ? POMO_BREAK : POMO_WORK) * 60;
    this.running = false; this.render();
  },
  tick() {
    if (!this.running) return;
    this.left--;
    if (this.left <= 0) {
      if (!this.onBreak) {
        this.done++;
        Store.set('pomo_' + today(), { done: this.done });
        this.ding(); toast('Pomodoro дууслаа — 5 минут амар');
        this.onBreak = true; this.left = POMO_BREAK * 60;
      } else {
        this.ding(); toast('Амралт дууслаа — үргэлжлүүл');
        this.onBreak = false; this.left = POMO_WORK * 60; this.running = false;
      }
      Plan.render();
    }
    this.render();
  },
  ding() {
    try {
      const a = new (window.AudioContext || window.webkitAudioContext)();
      const o = a.createOscillator(), g = a.createGain();
      o.connect(g); g.connect(a.destination);
      o.frequency.value = 880; g.gain.setValueAtTime(0.0001, a.currentTime);
      g.gain.exponentialRampToValueAtTime(0.25, a.currentTime + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + 0.7);
      o.start(); o.stop(a.currentTime + 0.75);
    } catch {}
  },
  render() {
    const m = Math.floor(this.left / 60), s = this.left % 60;
    $('pomo-time').textContent = `${m}:${String(s).padStart(2, '0')}`;
    $('pomo-task').textContent = this.onBreak ? 'Амралт' : (this.task || 'Эхлэхэд бэлэн');
    $('pomo-count').textContent = `${this.done}/${POMO_GOAL}`;
    $('pomo-btn').textContent = this.running ? 'Түр зогс' : 'Эхлэх';
    $('pomo-btn').classList.toggle('on', this.running);
    $('pomo').className = this.onBreak ? 'brk' : (this.running ? 'run' : '');
  },
};

/* ══ ТӨЛӨВЛӨГӨӨ ══════════════════════════════════════════════
   6 цаг = 12 pomodoro. Жинг үлдсэн хоног + сул талаас тооцно.    */
const Plan = {
  build() {
    const d = daysLeft();
    const st = Scores.get();
    // Үе шат: эхлээд үг, дараа нь чадвар, эцэст нь mock
    const phase = d > 20 ? 'vocab' : d > 7 ? 'skill' : 'mock';
    const base = phase === 'vocab' ? { vocab: 6, listen: 2, read: 2, write: 1, speak: 1 }
               : phase === 'skill' ? { vocab: 4, listen: 3, read: 3, write: 1, speak: 1 }
               :                     { vocab: 2, listen: 3, read: 3, write: 2, speak: 1, mock: 1 };
    // Хамгийн сул чадварт нэг pomodoro нэмж, хамгийн сайнаас хасна
    const sk = ['listen', 'read', 'write'].map(k => ({ k, v: st[k] ?? 50 })).sort((a, b) => a.v - b.v);
    if (st.diagDone) { base[sk[0].k] = (base[sk[0].k] || 0) + 1; base[sk[2].k] = Math.max(1, (base[sk[2].k] || 1) - 1); }
    const LABEL = {
      vocab:  ['词', 'Үгийн сан', 'шинэ үг + давталт'],
      listen: ['听', 'Сонсгол',   '听写 + сонсоод сонгох'],
      read:   ['读', 'Унших',     'хурд + ойлголт'],
      write:  ['写', 'Бичих',     '看图写作 / 话题作文'],
      speak:  ['说', 'Яриа',      'HSKK — 复述, 看图, 问答'],
      mock:   ['考', 'Mock',      'бүтэн шалгалт, цагтай'],
    };
    const out = [];
    Object.entries(base).forEach(([k, n]) => {
      for (let i = 0; i < n; i++) out.push({ k, i, label: LABEL[k] });
    });
    return out;
  },
  render() {
    const blocks = this.build();
    const done = Store.get('plan_' + today(), []);
    const el = $('plan-list'); if (!el) return;
    const nowIdx = blocks.findIndex((b, i) => !done.includes(i));
    el.innerHTML = blocks.map((b, i) => {
      const isDone = done.includes(i);
      const cls = isDone ? 'done' : (i === nowIdx ? 'now' : '');
      return `<button class="blk ${cls}" onclick="Plan.start(${i},'${b.k}')">
        <span class="blk-i">${b.label[0]}</span>
        <span class="blk-t"><b>${b.label[1]}</b><s>${b.label[2]}</s></span>
        <span class="blk-m">${isDone ? '✓' : '25м'}</span></button>`;
    }).join('');
    $('plan-sum').textContent = `${done.length}/${blocks.length} блок · ${Math.round(blocks.length * 0.5)} цаг`;
  },
  start(i, k) {
    const done = Store.get('plan_' + today(), []);
    if (!done.includes(i)) { done.push(i); Store.set('plan_' + today(), done); }
    const names = { vocab: '词汇', listen: '听力', read: '阅读', write: '写作', speak: '口语', mock: 'Mock' };
    Pomo.setTask(names[k] || k);
    if (!Pomo.running) Pomo.toggle();
    this.render();
    go(k);
  },
};

/* ══ ОНОО — таамаглал ════════════════════════════════════════ */
const Scores = {
  get() { return Store.get('scores', { listen: null, read: null, write: null, vocab: null, diagDone: false }); },
  set(patch) { const s = { ...this.get(), ...patch }; Store.set('scores', s); return s; },
  // 0-100 хувь → 100 онооны хэсгийн оноо
  total() {
    const s = this.get();
    const L = s.listen ?? 0, R = s.read ?? 0, W = s.write ?? 0;
    return Math.round(L + R + W);
  },
  render() {
    const s = this.get(), tot = this.total();
    $('sc-total').textContent = s.diagDone ? tot : '—';
    const tag = $('sc-tag');
    if (!s.diagDone) { tag.textContent = 'онош хийгээгүй'; tag.className = 'score-tag'; }
    else if (tot >= TARGET) { tag.textContent = `зорилт ${TARGET} давсан`; tag.className = 'score-tag good'; }
    else if (tot >= PASS)   { tag.textContent = `тэнцэнэ, зорилтоос ${TARGET - tot} дутуу`; tag.className = 'score-tag warn'; }
    else                    { tag.textContent = `босгоос ${PASS - tot} дутуу`; tag.className = 'score-tag bad'; }

    const put = (k, val, max, mark) => {
      const b = $('bar-' + k), v = $('val-' + k), u = $('mk-' + k);
      if (!b) return;
      const pct = val == null ? 0 : Math.min(100, val / max * 100);
      b.style.width = pct + '%';
      b.style.background = val == null ? 'var(--track)'
        : (val / max >= mark / max ? 'var(--ok)' : val / max >= 0.6 ? 'var(--warn)' : 'var(--danger)');
      v.textContent = val == null ? '—' : `${Math.round(val)}/${max}`;
      if (u) u.style.left = (mark / max * 100) + '%';
    };
    put('listen', s.listen, 100, 80);
    put('read',   s.read,   100, 80);
    put('write',  s.write,  100, 80);
    const vm = Vocab.mastered();
    put('vocab', vm.pct, 100, 85);
    $('val-vocab').textContent = `${vm.known}/${vm.total}`;

    // Зөвлөгөө — хамгийн сул талаас
    const adv = $('sc-advice');
    if (!s.diagDone) return;
    const arr = [['听力', s.listen], ['阅读', s.read], ['写作', s.write]].sort((a, b) => a[1] - b[1]);
    const d = daysLeft(), need = TARGET - tot;
    // Эхлээд ТЭНЦЭХ (180), дараа нь зорилт (240). Босгоос доогуур байхад
    // 240-ийн тоог нүүлгэх нь утгагүй — эхний даваа нь 180.
    const toPass = PASS - tot;
    if (toPass > 0) {
      adv.innerHTML =
        `<b>Эхний даваа: ${PASS} оноо (тэнцэх).</b> Одоо ${tot} — дутуу <b>${toPass}</b>, ` +
        `${d} хоног үлдлээ, өдөрт дунджаар <b>${(toPass / Math.max(1, d)).toFixed(1)} оноо</b>.<br>` +
        `Хамгийн сул тал: <b>${arr[0][0]}</b> (${Math.round(arr[0][1])}/100) — өнөөдөр энэ дээр хамгийн их цаг зарцуул.<br>` +
        `<span class="muted">${TARGET} бол дараагийн даваа. Эхлээд босгыг дав.</span>`;
    } else if (need > 0) {
      adv.innerHTML =
        `<b>Босго давсан (${tot}/300).</b> Одоо ${TARGET} руу — дутуу <b>${need}</b>, ` +
        `өдөрт <b>${(need / Math.max(1, d)).toFixed(1)} оноо</b>. ` +
        `Хамгийн сул тал: <b>${arr[0][0]}</b> (${Math.round(arr[0][1])}/100).`;
    } else {
      adv.innerHTML = `Зорилтод хүрсэн. Одоо тогтвортой байлгах — өдөр бүр нэг mock, алдсанаа засах.`;
    }
  },
};

/* ══ ҮГИЙН САН — SRS ═════════════════════════════════════════
   Шалгалтын өдрийг харгалзсан давталт: интервалыг үлдсэн хоногийн
   талаас хэтрүүлэхгүй — бүх үг шалгалтаас өмнө дахин эргэж ирнэ.   */
const Vocab = {
  LEVELS: [4, 5],           // онош дүнгээс хамаарч өөрчлөгдөнө
  srs: null, queue: [], cur: null, shown: false, sessionN: 0, sessionOk: 0,

  state() { if (!this.srs) this.srs = Store.get('srs', {}); return this.srs; },
  save()  { Store.set('srs', this.srs || {}); },

  levels() { return Store.get('vocab_levels', this.LEVELS); },

  mastered() {
    const s = this.state();
    const lvs = this.levels();
    const total = lvs.reduce((a, lv) => a + ({ 1: 500, 2: 772, 3: 973, 4: 1000, 5: 1071 }[lv] || 0), 0);
    const known = Object.values(s).filter(c => c.box >= 3).length;
    return { known, total, pct: total ? Math.round(known / total * 100) : 0 };
  },

  // Интервал — хайрцаг (box) тутам, шалгалтын өдрөөр хязгаарлав
  nextDue(box) {
    const plan = [0, 1, 2, 4, 8, 15];
    const cap  = Math.max(1, Math.floor(daysLeft() / 2));
    const days = Math.min(plan[Math.min(box, plan.length - 1)], cap);
    return today_plus(days);
  },

  async build() {
    const lvs = this.levels();
    const all = await Data.all(lvs);
    const s = this.state(), t = today();
    const due = [], fresh = [];
    for (const w of all) {
      const c = s[w.h];
      if (!c) fresh.push(w);
      else if (c.due <= t && c.box < 5) due.push(w);
    }
    const perDay = this.perDay(all.length);
    this.queue = [...due, ...fresh.slice(0, perDay)];
    shuffle(this.queue);
    return { due: due.length, fresh: fresh.length, perDay };
  },

  perDay(total) {
    const s = this.state();
    const left = total - Object.keys(s).length;
    return Math.max(20, Math.min(90, Math.ceil(left / Math.max(1, daysLeft() - 5))));
  },

  async open() {
    const info = await this.build();
    this.sessionN = 0; this.sessionOk = 0;
    if (!this.queue.length) {
      $('vocab-body').innerHTML = `<div class="note">Өнөөдрийн үг дууслаа 🎉<br>
        Давтах үг: ${info.due} · Шинэ үг нөөцөд: ${info.fresh}</div>
        <button class="big pri" style="width:100%" onclick="Vocab.extra()">Нэмж 20 үг хийх</button>`;
      return;
    }
    this.next();
  },
  async extra() {
    const all = await Data.all(this.levels());
    const s = this.state();
    this.queue = all.filter(w => !s[w.h]).slice(0, 20);
    if (!this.queue.length) { toast('Бүх үгийг үзсэн байна'); return; }
    this.next();
  },

  next() {
    if (!this.queue.length) {
      const pct = this.sessionN ? Math.round(this.sessionOk / this.sessionN * 100) : 0;
      $('vocab-body').innerHTML = `<div class="note"><b>Дасгал дууслаа</b><br>
        ${this.sessionN} үг · зөв ${this.sessionOk} (${pct}%)</div>
        <button class="big pri" style="width:100%" onclick="go('home')">Төлөвлөгөө рүү</button>`;
      Scores.render(); Analytics.log('vocab', this.sessionOk, this.sessionN);
      return;
    }
    this.cur = this.queue[0]; this.shown = false; this.render();
  },

  render() {
    const w = this.cur;
    $('vocab-prog').textContent = `${this.queue.length} үлдлээ`;
    const box = (this.state()[w.h]?.box) ?? 0;
    $('vocab-body').innerHTML = `
      <div class="card" onclick="Vocab.flip()">
        <div class="hz cn">${esc(w.h)}</div>
        ${this.shown ? `
          <div class="py">${esc(w.p)}</div>
          ${w.mn ? `<div class="mn">${esc(w.mn)}</div>` : ''}
          <div class="en">${esc(w.en)}</div>
          <div class="pos">${esc(w.pos)} · HSK${w.lv}${box ? ' · ' + box + '-р давталт' : ''}</div>
        ` : `<div class="hint">дарж утгыг нь хар</div>`}
      </div>
      ${this.shown ? `<div class="row3">
          <button class="big no" onclick="Vocab.grade(0)">Мэдэхгүй</button>
          <button class="big"    onclick="Vocab.grade(1)">Бараг</button>
          <button class="big ok" onclick="Vocab.grade(2)">Мэднэ</button>
        </div>` : `<div class="row2">
          <button class="big" onclick="Vocab.say()">🔊 Сонсох</button>
          <button class="big pri" onclick="Vocab.flip()">Харах</button>
        </div>`}`;
  },
  flip() { this.shown = true; this.render(); this.say(); },
  say() {
    try {
      const u = new SpeechSynthesisUtterance(this.cur.h);
      u.lang = 'zh-CN'; u.rate = 0.85;
      speechSynthesis.cancel(); speechSynthesis.speak(u);
    } catch {}
  },
  grade(g) {
    const w = this.cur, s = this.state();
    const c = s[w.h] || { box: 0, miss: 0 };
    if (g === 2)      c.box = Math.min(5, c.box + 1);
    else if (g === 1) c.box = Math.max(1, c.box);
    else              { c.box = 0; c.miss = (c.miss || 0) + 1; }
    c.due = this.nextDue(c.box);
    c.lv = w.lv;
    s[w.h] = c; this.save();
    this.sessionN++; if (g === 2) this.sessionOk++;
    this.queue.shift();
    if (g === 0) this.queue.splice(Math.min(6, this.queue.length), 0, w);   // удахгүй дахин харуулна
    this.next();
  },
  weakest(n = 20) {
    const s = this.state();
    return Object.entries(s).filter(([, c]) => (c.miss || 0) > 0)
      .sort((a, b) => (b[1].miss || 0) - (a[1].miss || 0)).slice(0, n).map(([h]) => h);
  },
};

function today_plus(d) {
  const t = new Date(); t.setDate(t.getDate() + d);
  return (window.jarvisDay ? window.jarvisDay(t) : t.toISOString().slice(0, 10));
}
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; }

/* ══ ШИНЖИЛГЭЭ — хийсэн бүхнийг бүртгэнэ ════════════════════ */
const Analytics = {
  log(kind, ok, total, extra) {
    const key = 'log_' + today();
    const arr = Store.get(key, []);
    arr.push({ k: kind, ok, n: total, t: Date.now(), ...(extra || {}) });
    Store.set(key, arr);
    // Чадварын оноог хөдөлгөнө (жигнэсэн дундаж)
    if (['listen', 'read'].includes(kind) && total >= 4) {
      const s = Scores.get();
      const pct = ok / total * 100;
      const prev = s[kind] ?? pct;
      Scores.set({ [kind]: Math.round(prev * 0.7 + pct * 0.3) });
    }
  },
  history(days = 14) {
    const out = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = today_plus(-i);
      out.push({ d, items: Store.get('log_' + d, []) });
    }
    return out;
  },
};

/* ══ ЗАМ ШИЛЖИЛТ ═════════════════════════════════════════════ */
function go(view) {
  Audio_.stop();   // өмнөх хэсгийн бичлэг цаана үргэлжлэхээс сэргийлнэ
  document.querySelectorAll('.view').forEach(v => v.classList.remove('on'));
  $('v-' + view)?.classList.add('on');
  window.scrollTo(0, 0);
  const init = { vocab: () => Vocab.open(), listen: () => Listen.open(), read: () => Read.open(),
                 write: () => Write.open(), speak: () => Speak.open(), grammar: () => Grammar.open(),
                 mock: () => Mock.open(), stats: () => Stats.open(), diag: () => Diag.open(),
                 home: () => { Scores.render(); Plan.render(); refreshHome(); } };
  init[view]?.();
}
window.go = go;

/* ══ ЭХЛЭЛ ═══════════════════════════════════════════════════ */
async function refreshHome() {
  $('cd-days').textContent = daysLeft();
  const s = Scores.get();
  const vm = Vocab.mastered();
  $('home-sub').textContent = `${EXAM.toISOString().slice(0, 10)} 14:00 · зорилт ${TARGET}/300 · HSKK 16:20`;
  $('m-vocab').textContent = `${vm.known}/${vm.total} эзэмшсэн`;
  const g = await Data.grammar_();
  $('m-grammar').textContent = `${g.filter(x => x[0] >= 4).length} дүрэм (L4–5)`;

  // Даалгаврын сангийн хэмжээ — өдөр бүр автоматаар нэмэгддэг
  const b = await Data.bank_();
  const nRead = (b.read || []).reduce((a, r) => a + (r.qs ? r.qs.length : 1), 0);
  $('m-listen').textContent = `${(b.listen || []).length} даалгавар + 听写`;
  $('m-read').textContent   = `${nRead} асуулт · 3 төрөл`;
  $('m-write').textContent  = `${(b.write || []).length} сэдэв`;
  $('m-speak').textContent  = `${(b.speak || []).length} даалгавар`;

  // Үүлэнд хадгалагдаж байгаа эсэх — хамгийн чухал анхааруулга.
  // Хадгалагдахгүй бол дүн зөвхөн энэ хөтөчид үлдэж, өөр төхөөрөмжөөс
  // харагдахгүй, шөнийн хяналтад ч хүрэхгүй.
  const cloudBox = $('cloud-box');
  if (cloudBox) {
    cloudBox.innerHTML = (Store.cloudState === 'холбогдсон') ? '' : `
      <div class="warn-box">
        <b>Явц чинь үүлэнд хадгалагдахгүй байна</b> (${esc(Store.cloudState)}).<br>
        Ингэвэл: өөр хөтөч/утаснаас харагдахгүй, шөнийн дүгнэлт хоосон гарна,
        хөтчийн дата цэвэрлэхэд бүгд устана.
        <div style="margin-top:10px">
          <button class="big pri" onclick="location.href=(window.jarvisHref?jarvisHref('login'):'login')">
            Нэвтрэх</button>
        </div>
      </div>`;
  }

  // Claude-ийн өдрийн дүгнэлт — Firestore-оос
  try {
    if (Store._db && Store._uid) {
      const snap = await Store._db.doc(`users/${Store._uid}/coach/latest`).get();
      const c = snap.exists ? snap.data() : null;
      const box = $('coach-box');
      if (c && box) {
        const fresh = c.date === today() || c.date === today_plus(-1);
        box.innerHTML = `
          <div class="note" style="border-left:3px solid var(--accent)">
            <div class="muted" style="margin-bottom:6px">🧠 Claude-ийн дүгнэлт · ${esc(c.date)}${fresh ? '' : ' (хуучин)'}</div>
            ${c.summary  ? `<div style="margin-bottom:8px">${esc(c.summary)}</div>` : ''}
            ${c.warning  ? `<div style="color:var(--warn);margin-bottom:8px">⚠️ ${esc(c.warning)}</div>` : ''}
            ${c.tomorrow ? `<div style="white-space:pre-line">${esc(c.tomorrow)}</div>` : ''}
          </div>`;
      }
    }
  } catch {}

  // Сонсголын дуу 2026-11-04-нд зассан. Түүнээс өмнө хийсэн оношийн
  // 听力 оноо нь таамаглалаар гарсан тул найдвартай биш.
  const AUDIO_FIX = '2026-11-04';
  if (s.diagDone && (s.diagAt || '') < AUDIO_FIX) {
    $('diag-cta').innerHTML = `
      <div class="warn-box">
        <b>Оношоо дахин хийх хэрэгтэй.</b> Чиний онош хийх үед сонсголын дуу
        гарахгүй байсан — 听力 ${Math.round(s.listen ?? 0)}/100 гэдэг тоо
        таамаглалаар гарсан, бодит түвшин биш. Одоо дуу ажиллаж байна.
        <div style="margin-top:10px">
          <button class="big pri" onclick="Diag.retake()">Оношоо дахин хийх (15 мин)</button>
        </div>
      </div>`;
    return;
  }

  $('diag-cta').innerHTML = s.diagDone ? '' : `
    <div class="warn-box">
      <b>Эхлээд онош тест хий.</b> 15 минут. Үүнгүйгээр систем чиний бодит түвшнийг
      мэдэхгүй тул төлөвлөгөө таамаг дээр тогтоно.
      <div style="margin-top:10px"><button class="big pri" onclick="go('diag')">Онош тест эхлүүлэх</button></div>
    </div>`;
}

(async function init() {
  Pomo.init();
  Scores.render();
  Plan.render();
  await refreshHome();
  const changed = await Store.initCloud();
  // Үүлэнд холбогдсоны ДАРАА заавал дахин зурна — Claude-ийн дүгнэлт
  // Firestore-оос ирдэг тул эхний зурахад хараахан байхгүй байдаг.
  if (changed) { Vocab.srs = null; Scores.render(); Plan.render(); }
  await refreshHome();
})();

/* ══ ОНОШ ТЕСТ ═══════════════════════════════════════════════
   A. Үгийн сан — түвшин тус бүрээс түүвэрлэж бодит хэмжээг олно
   B. Сонсгол 6 асуулт   C. Унших 6 асуулт
   Үр дүн: чадвар тус бүрийн эхлэлийн оноо + судлах түвшин       */
const Diag = {
  step: 0, vocabItems: [], vocabHit: {}, qItems: [], qIdx: 0, qOk: 0, answers: [],

  async open() {
    if (Scores.get().diagDone && !this._retake) {
      $('diag-body').innerHTML = `<div class="note">Онош аль хэдийн хийгдсэн.</div>
        <button class="big" style="width:100%" onclick="Diag.retake()">Дахин хийх</button>`;
      return;
    }
    $('diag-body').innerHTML = `<div class="note">Ачаалж байна…</div>`;
    // Түвшин бүрээс 12 үг санамсаргүй түүвэрлэнэ (L2–L5)
    this.vocabItems = [];
    for (const lv of [2, 3, 4, 5]) {
      const w = await Data.words_(lv);
      this.vocabItems.push(...shuffle([...w]).slice(0, 12));
    }
    shuffle(this.vocabItems);
    this.vocabHit = { 2: [0, 0], 3: [0, 0], 4: [0, 0], 5: [0, 0] };
    this.step = 0; this.qOk = 0; this.qIdx = 0;
    this.renderVocab();
  },
  retake() {
    // Нүүрнээс дуудагдвал дэлгэц солигдоогүй байж болзошгүй
    this._retake = true;
    document.querySelectorAll('.view').forEach(v => v.classList.remove('on'));
    $('v-diag')?.classList.add('on');
    window.scrollTo(0, 0);
    this.open();
  },

  renderVocab() {
    const i = this.step, w = this.vocabItems[i];
    if (!w) return this.startQs();
    $('diag-prog').textContent = `${i + 1}/${this.vocabItems.length + 12}`;
    $('diag-body').innerHTML = `
      <div class="note">Энэ үгийн утгыг <b>мэдэж байна уу?</b> Үнэнээр хариул —
        энэ тестийн чанар чиний 40 хоногийн төлөвлөгөөг тодорхойлно.</div>
      <div class="card"><div class="hz cn">${esc(w.h)}</div>
        <div class="hint">HSK ${w.lv}</div></div>
      <div class="row2">
        <button class="big no" onclick="Diag.vocabAns(0)">Мэдэхгүй</button>
        <button class="big ok" onclick="Diag.vocabAns(1)">Мэднэ</button>
      </div>
      <div class="row2"><button class="big" onclick="Diag.peek()">Утгыг нь харах</button></div>
      <div id="diag-peek"></div>`;
  },
  peek() {
    const w = this.vocabItems[this.step];
    $('diag-peek').innerHTML = `<div class="exp">${esc(w.p)} — ${esc(w.mn || w.en)}</div>`;
  },
  vocabAns(ok) {
    const w = this.vocabItems[this.step];
    this.vocabHit[w.lv][1]++; if (ok) this.vocabHit[w.lv][0]++;
    this.step++; this.renderVocab();
  },

  async startQs() {
    const bank = await Data.bank_();
    const ls = shuffle([...(bank.listen || [])]).slice(0, 6);
    const rd = shuffle([...(bank.read || [])].filter(r => r.type === 'passage' || r.type === 'cloze')).slice(0, 6);
    this.qItems = [...ls.map(x => ({ ...x, skill: 'listen' })), ...rd.map(x => ({ ...x, skill: 'read' }))];
    this.qIdx = 0; this.qOk = 0; this.answers = [];
    if (!this.qItems.length) return this.finish();
    this.renderQ();
  },
  renderQ() {
    const it = this.qItems[this.qIdx];
    if (!it) return this.finish();
    $('diag-prog').textContent = `${this.vocabItems.length + this.qIdx + 1}/${this.vocabItems.length + this.qItems.length}`;
    if (it.skill === 'listen') {
      Audio_.register('diag:' + this.qIdx, it.audio || [it.text || '']);
      $('diag-body').innerHTML = `
        <div class="note">Сонсоод хариул. Жинхэнэ шалгалт дээр бичлэг <b>ганц удаа</b> тавигддаг.
          ${Audio_.status() ? '<br><b>' + esc(Audio_.status()) + '</b>' : ''}</div>
        <div class="q">
          <button class="big pri" style="width:100%" onclick="Audio_.play(${this.qIdx},'diag')">🔊 Бичлэг тавих</button>
          <div class="q-txt" style="margin-top:var(--sp-4)">${esc(it.q)}</div>
          ${(it.opt || []).map((o, i) => `<button class="opt" onclick="Diag.ans(${i})"><b>${'ABC'[i]}</b>${esc(o)}</button>`).join('')}
        </div>`;
    } else {
      const body = it.type === 'cloze'
        ? `<div class="q-pas cn">${esc(it.text)}</div>
           <div class="q-txt">${esc(it.q || 'Хоосон зайд тохирохыг сонго')}</div>`
        : `<div class="q-pas cn">${esc(it.text)}</div>
           <div class="q-txt">${esc(it.qs ? it.qs[0].q : it.q)}</div>`;
      const opts = it.qs ? it.qs[0].opt : it.opt;
      $('diag-body').innerHTML = `<div class="q">${body}
        ${(opts || []).map((o, i) => `<button class="opt" onclick="Diag.ans(${i})"><b>${'ABCD'[i]}</b>${esc(o)}</button>`).join('')}
      </div>`;
    }
  },
  ans(i) {
    Audio_.stop();
    const it = this.qItems[this.qIdx];
    const correct = it.qs ? it.qs[0].a : it.a;
    if (i === correct) this.qOk++;
    this.answers.push({ skill: it.skill, ok: i === correct });
    this.qIdx++; this.renderQ();
  },

  finish() {
    // Үгийн сангийн тооцоо — түвшин бүрийн мэдэлтийн хувиар
    const SIZE = { 1: 500, 2: 772, 3: 973, 4: 1000, 5: 1071 };
    let known = 500;   // L1-ийг мэднэ гэж үзнэ
    const rate = {};
    for (const lv of [2, 3, 4, 5]) {
      const [ok, n] = this.vocabHit[lv];
      rate[lv] = n ? ok / n : 0;
      known += rate[lv] * SIZE[lv];
    }
    known = Math.round(known);

    // Чадварын оноо: асуултын хувь + үгийн сангийн таазаар хязгаарлав
    const byS = k => {
      const a = this.answers.filter(x => x.skill === k);
      return a.length ? a.filter(x => x.ok).length / a.length : null;
    };
    const ceil = Math.min(100, known / 3562 * 100);          // 3562 = L5-ын шаардлага
    const listen = Math.round(Math.min(ceil, (byS('listen') ?? 0.5) * 100) * 0.9);
    const read   = Math.round(Math.min(ceil, (byS('read')   ?? 0.5) * 100));
    const write  = Math.round(ceil * 0.45);                   // бичих нь хамгийн сүүлд ирдэг чадвар

    // Судлах түвшинг тогтооно
    const levels = rate[4] < 0.55 ? [3, 4, 5] : rate[5] < 0.4 ? [4, 5] : [5];
    Store.set('vocab_levels', levels);
    Scores.set({ listen, read, write, diagDone: true, vocabKnown: known, diagAt: today() });
    Analytics.log('diag', this.qOk, this.qItems.length, { known });

    const total = listen + read + write;
    const d = daysLeft();
    $('diag-body').innerHTML = `
      <div class="score">
        <div class="score-top"><div><span class="score-num">${total}</span>
          <span class="score-of">/ 300 өнөөдрийн түвшин</span></div></div>
        <div class="exp">
          Таамагласан үгийн сан: <b>${known}</b> үг. HSK5-д ойролцоогоор <b>3562</b> үг шаардана
          — дутуу <b>${Math.max(0, 3562 - known)}</b> үг.<br>
          Үлдсэн ${d} хоногт өдөрт <b>${Math.ceil(Math.max(0, 3562 - known) / Math.max(1, d - 5))}</b> шинэ үг
          эзэмшвэл амжина.<br>
          Судлах түвшин: <b>HSK ${levels.join(', ')}</b>.
        </div>
      </div>
      <div class="note">
        听力 ${listen}/100 · 阅读 ${read}/100 · 写作 ${write}/100 (тооцоолол)<br>
        Зорилт ${TARGET} — одоогоор <b>${Math.max(0, TARGET - total)} оноо</b> дутуу.
        ${total < PASS ? '<br><b>Анхаар:</b> одоогийн түвшингээр бол тэнцэхгүй. Энэ бол эхлэл — өдөр тутмын төлөвлөгөөг дага.' : ''}
      </div>
      <button class="big pri" style="width:100%" onclick="go('home')">Төлөвлөгөө харах</button>`;
    $('diag-prog').textContent = '';
    Scores.render(); Plan.render();
  },
};

/* ══ АУДИО — TTS-ээр бичлэг тоглуулна ════════════════════════ */
const Audio_ = {
  playing: false, _items: {}, voice: null, ready: false,

  /** Хятад хоолойг ОНЦГОЙЛОН сонгоно.
   *  Зөвхөн u.lang='zh-CN' гэж өгөхөд Safari ихэвчлэн англи хоолой сонгоод
   *  ханзыг огт уншдаггүй — энэ нь дуу гарахгүй байсан жинхэнэ шалтгаан. */
  pick() {
    if (!window.speechSynthesis) return null;
    const all = speechSynthesis.getVoices() || [];
    if (!all.length) return null;
    this.voice =
      all.find(v => /^zh[-_]CN/i.test(v.lang) && /Ting|Tingting|Yaoyao|Huihui|Xiaoxiao|Li-?mu|Yu-?shu/i.test(v.name)) ||
      all.find(v => /^zh[-_](CN|Hans)/i.test(v.lang)) ||
      all.find(v => /^zh/i.test(v.lang)) ||
      all.find(v => /chinese|mandarin|普通话|中文/i.test(v.name)) ||
      null;
    this.ready = true;
    return this.voice;
  },

  init() {
    if (!window.speechSynthesis) return;
    this.pick();
    speechSynthesis.addEventListener('voiceschanged', () => this.pick());
    // Safari заримдаа хоцорч ачаална
    setTimeout(() => { if (!this.voice) this.pick(); }, 900);
    setTimeout(() => { if (!this.voice) this.pick(); }, 2500);
  },

  /** Хятад хоолой байхгүй бол шалтгааныг хэрэглэгчид ойлгомжтой хэлнэ */
  status() {
    if (!window.speechSynthesis) return 'Энэ хөтөч дуу уншихыг дэмжихгүй байна.';
    if (!this.voice) {
      this.pick();
      if (!this.voice) {
        return 'Хятад хоолой олдсонгүй. macOS: Тохиргоо → Хүртээмж → Яриа → ' +
               'Систем хоолой → Тохируулах → Chinese (Mandarin) татаж ав. ' +
               'Эсвэл Chrome хөтчөөр ор.';
      }
    }
    return '';
  },

  register(key, segs) { this._items[key] = segs; },

  /** Яриаг тэр дор нь зогсооно — дараагийн асуулт руу орохоос өмнө */
  stop() { try { speechSynthesis.cancel(); } catch {} this.playing = false; },

  async play(idx, scope) {
    const segs = this._items[scope + ':' + idx];
    if (this.playing) return;
    // Бүртгэгдээгүй бичлэгийг чимээгүй алгасвал алдаа нь үл мэдэгдэнэ
    if (!segs) { toast('Бичлэг олдсонгүй — хуудсаа шинэчилж үзнэ үү', 3500); return; }
    if (!window.speechSynthesis) { toast('Хөтөч дуу уншихыг дэмжихгүй'); return; }
    if (!this.voice) this.pick();
    if (!this.voice) { toast('Хятад хоолой олдсонгүй — доорх зааврыг хар', 4000); return; }

    this.playing = true;
    try {
      speechSynthesis.cancel();
      for (const seg of segs) {
        const text = String(Array.isArray(seg) ? seg[1] : seg).trim();
        if (!text) continue;
        await new Promise(res => {
          let done = false;
          const fin = () => { if (!done) { done = true; res(); } };
          const u = new SpeechSynthesisUtterance(text);
          u.voice = this.voice;                     // ← энэ мөр дутуу байсан
          u.lang  = this.voice.lang || 'zh-CN';
          u.rate  = Number(localStorage.getItem(LS + 'rate') || 0.95);
          u.onend = fin; u.onerror = fin;
          speechSynthesis.speak(u);
          setTimeout(fin, 3000 + text.length * 450);   // гацахаас сэргийлнэ
        });
      }
    } finally { this.playing = false; }
  },

  /** Товч дарж шалгах — дуу гарч байгаа эсэхийг шууд мэдэхийн тулд */
  test() {
    const msg = this.status();
    if (msg) { toast(msg, 6000); return; }
    this.register('test:0', ['你好，这是中文发音测试。']);
    this.play(0, 'test');
    toast('Хоолой: ' + (this.voice.name || this.voice.lang), 3000);
  },
};
Audio_.init();
window.Audio_ = Audio_;

/* ══ 听力 СОНСГОЛ ════════════════════════════════════════════
   Хоёр горим:
   · 听写 (сонсоод бичих) — үгийн сангаас, банк шаардахгүй
   · 听后选择 — банкны даалгавар, 3 сонголт, бичлэг нэг удаа     */
const Listen = {
  mode: 'dict', items: [], idx: 0, ok: 0, played: 0, answered: false, dictWords: [], dictIdx: 0,

  async open() {
    const bank = await Data.bank_();
    const n = (bank.listen || []).length;
    $('listen-body').innerHTML = `
      <div class="tabs">
        <button class="tab ${this.mode === 'dict' ? 'on' : ''}" onclick="Listen.set('dict')">听写 Сонсоод бичих</button>
        <button class="tab ${this.mode === 'mcq' ? 'on' : ''}" onclick="Listen.set('mcq')">听后选择 (${n})</button>
        <button class="tab" onclick="Listen.speed()">Хурд: ${Number(localStorage.getItem(LS + 'rate') || 0.95).toFixed(2)}×</button>
        <button class="tab" onclick="Audio_.test()">🔊 Дуу шалгах</button>
      </div>
      ${Audio_.status() ? `<div class="warn-box">${esc(Audio_.status())}</div>` : ''}
      <div id="listen-inner"></div>`;
    this.mode === 'dict' ? this.startDict() : this.startMcq(bank);
  },
  set(m) { this.mode = m; this.open(); },
  speed() {
    const cur = Number(localStorage.getItem(LS + 'rate') || 0.95);
    const next = cur >= 1.15 ? 0.8 : Math.round((cur + 0.1) * 100) / 100;
    localStorage.setItem(LS + 'rate', next); this.open();
    toast('Жинхэнэ шалгалтын хурд ≈ 1.0× — эцэст нь 1.1×-д дасгалж бай');
  },

  /* ── 听写 — сонсоод ханзаар бич ───────────────────────────── */
  async startDict() {
    const all = await Data.all(Vocab.levels());
    const srs = Vocab.state();
    // Сурч буй үгсээ эхэлж сонсгоно — давхар давталт болно
    const learning = all.filter(w => srs[w.h]);
    const pool = learning.length >= 20 ? learning : all;
    this.dictWords = shuffle([...pool]).slice(0, 15);
    this.dictIdx = 0; this.ok = 0;
    this.renderDict();
  },
  renderDict() {
    const w = this.dictWords[this.dictIdx];
    if (!w) {
      $('listen-inner').innerHTML = `<div class="note"><b>听写 дууслаа</b><br>
        ${this.dictWords.length} үг · зөв ${this.ok}</div>
        <button class="big pri" style="width:100%" onclick="Listen.startDict()">Дахин 15 үг</button>`;
      Analytics.log('dictation', this.ok, this.dictWords.length);
      return;
    }
    $('listen-prog').textContent = `${this.dictIdx + 1}/${this.dictWords.length}`;
    Audio_.register('dict:' + this.dictIdx, [w.h]);
    $('listen-inner').innerHTML = `
      <div class="note">Сонсоод <b>ханзаар</b> бич. Мэдэхгүй бол пиньинээр бичсэн ч болно.</div>
      <div class="q">
        <button class="big pri" style="width:100%" onclick="Audio_.play(${this.dictIdx},'dict')">🔊 Дахин сонсох</button>
        <input class="ds-input ds-input--hanzi" id="dict-in" style="width:100%;margin-top:var(--sp-3)"
               placeholder="сонссоноо бич" autocomplete="off"
               onkeydown="if(event.key==='Enter')Listen.checkDict()">
        <div class="row2">
          <button class="big" onclick="Listen.skipDict()">Алгасах</button>
          <button class="big pri" onclick="Listen.checkDict()">Шалгах</button>
        </div>
        <div id="dict-res"></div>
      </div>`;
    setTimeout(() => $('dict-in')?.focus(), 200);
    // Автоматаар тоглуулахгүй — Safari хэрэглэгчийн дарлагагүй дуу гаргахыг хориглодог
  },
  checkDict() {
    const w = this.dictWords[this.dictIdx];
    const v = ($('dict-in')?.value || '').trim();
    const pyOk = v && w.p.replace(/[\s·]/g, '').toLowerCase().replace(/[āáǎà]/g, 'a').replace(/[ēéěè]/g, 'e')
                      .replace(/[īíǐì]/g, 'i').replace(/[ōóǒò]/g, 'o').replace(/[ūúǔù]/g, 'u').replace(/[ǖǘǚǜü]/g, 'v')
                 === v.replace(/[\s']/g, '').toLowerCase();
    const right = v === w.h || pyOk;
    if (right) this.ok++;
    $('dict-res').innerHTML = `<div class="exp">
      ${right ? '<b style="color:var(--ok)">Зөв</b>' : '<b style="color:var(--danger)">Буруу</b>'} —
      <span class="cn" style="font-size:var(--fs-lg)">${esc(w.h)}</span>
      <span class="mono">${esc(w.p)}</span> — ${esc(w.mn || w.en)}</div>
      <button class="big pri" style="width:100%;margin-top:8px" onclick="Listen.nextDict()">Дараах →</button>`;
    if (!right) {
      const s = Vocab.state(); const c = s[w.h] || { box: 0, miss: 0 };
      c.miss = (c.miss || 0) + 1; c.box = 0; c.due = today(); c.lv = w.lv; s[w.h] = c; Vocab.save();
    }
  },
  skipDict() { this.checkDict(); },
  nextDict() { Audio_.stop(); this.dictIdx++; this.renderDict(); },

  /* ── 听后选择 ─────────────────────────────────────────────── */
  startMcq(bank) {
    this.items = shuffle([...(bank.listen || [])]).slice(0, 10);
    this.idx = 0; this.ok = 0;
    if (!this.items.length) {
      $('listen-inner').innerHTML = `<div class="note">Сонсголын даалгаврын сан хоосон байна.
        Одоохондоо <b>听写</b> горимоор дасгал хий — энэ нь сонсголын суурийг хамгийн хурдан босгодог.</div>`;
      return;
    }
    this.renderMcq();
  },
  renderMcq() {
    const it = this.items[this.idx];
    if (!it) {
      const pct = Math.round(this.ok / this.items.length * 100);
      $('listen-inner').innerHTML = `<div class="note"><b>Дууслаа</b> — ${this.ok}/${this.items.length} (${pct}%)<br>
        Жинхэнэ шалгалтад 35 асуулт, 25 минут.</div>
        <button class="big pri" style="width:100%" onclick="Listen.open()">Дахин</button>`;
      Analytics.log('listen', this.ok, this.items.length);
      Scores.render();
      return;
    }
    $('listen-prog').textContent = `${this.idx + 1}/${this.items.length}`;
    this.played = 0; this.answered = false;
    Audio_.register('mcq:' + this.idx, it.audio || [it.text || '']);
    $('listen-inner').innerHTML = `
      <div class="q">
        <button class="big pri" style="width:100%" id="play-btn" onclick="Listen.play()">🔊 Бичлэг тавих (1 удаа)</button>
        <div class="q-txt" style="margin-top:var(--sp-4)">${esc(it.q)}</div>
        ${(it.opt || []).map((o, i) => `<button class="opt" id="o${i}" onclick="Listen.ans(${i})"><b>${'ABC'[i]}</b>${esc(o)}</button>`).join('')}
        <div id="l-res"></div>
      </div>`;
  },
  play() {
    if (this.played >= 1) { toast('Жинхэнэ шалгалтад нэг л удаа тавигдана'); }
    this.played++;
    Audio_.play(this.idx, 'mcq');
    if (this.played === 1) $('play-btn').textContent = '🔊 Дахин (шалгалтад байхгүй)';
  },
  ans(i) {
    if (this.answered) return;
    this.answered = true;
    const it = this.items[this.idx];
    if (i === it.a) this.ok++;
    $('o' + i).classList.add(i === it.a ? 'right' : 'wrong');
    if (i !== it.a) $('o' + it.a).classList.add('right');
    const script = (it.audio || []).map(s => Array.isArray(s) ? `${s[0]}：${s[1]}` : s).join('\n');
    $('l-res').innerHTML = `
      <div class="q-pas cn" style="margin-top:var(--sp-3)">${esc(script)}</div>
      ${it.exp ? `<div class="exp">${esc(it.exp)}</div>` : ''}
      <button class="big pri" style="width:100%;margin-top:8px" onclick="Listen.next()">Дараах →</button>`;
  },
  next() { Audio_.stop(); this.idx++; this.renderMcq(); },
};

/* ══ 阅读 УНШИХ ══════════════════════════════════════════════
   3 төрөл: 篇章填空 (cloze) · 排列顺序 (order) · 读后选择 (passage) */
const Read = {
  type: 'passage', items: [], idx: 0, ok: 0, n: 0, order: [],

  async open() {
    const bank = await Data.bank_();
    const by = t => (bank.read || []).filter(r => r.type === t).length;
    $('read-body').innerHTML = `
      <div class="tabs">
        <button class="tab ${this.type === 'cloze' ? 'on' : ''}"   onclick="Read.set('cloze')">篇章填空 (${by('cloze')})</button>
        <button class="tab ${this.type === 'order' ? 'on' : ''}"   onclick="Read.set('order')">排列顺序 (${by('order')})</button>
        <button class="tab ${this.type === 'passage' ? 'on' : ''}" onclick="Read.set('passage')">读后选择 (${by('passage')})</button>
      </div><div id="read-inner"></div>`;
    this.items = shuffle((bank.read || []).filter(r => r.type === this.type));
    this.idx = 0; this.ok = 0; this.n = 0;
    if (!this.items.length) {
      $('read-inner').innerHTML = `<div class="note">Энэ төрлийн даалгавар одоогоор байхгүй.
        Шинээр нэмэгдсэн даалгавар бүр шууд энд харагдана.</div>`;
      return;
    }
    this.render();
  },
  set(t) { this.type = t; this.open(); },

  render() {
    const it = this.items[this.idx];
    if (!it) {
      const pct = this.n ? Math.round(this.ok / this.n * 100) : 0;
      $('read-inner').innerHTML = `<div class="note"><b>Дууслаа</b> — ${this.ok}/${this.n} (${pct}%)</div>
        <button class="big pri" style="width:100%" onclick="Read.open()">Дахин</button>`;
      Analytics.log('read', this.ok, this.n); Scores.render();
      return;
    }
    $('read-prog').textContent = `${this.idx + 1}/${this.items.length}`;
    if (it.type === 'order')   return this.renderOrder(it);
    if (it.type === 'cloze')   return this.renderCloze(it);
    return this.renderPassage(it);
  },

  renderPassage(it) {
    $('read-inner').innerHTML = `
      <div class="q"><div class="q-pas cn">${esc(it.text)}</div></div>
      <div id="rq"></div>`;
    this._qi = 0; this.renderPQ(it);
  },
  renderPQ(it) {
    const q = it.qs[this._qi];
    if (!q) { $('rq').innerHTML = `<button class="big pri" style="width:100%" onclick="Read.next()">Дараах эх →</button>`; return; }
    $('rq').innerHTML = `<div class="q">
      <div class="q-txt">${this._qi + 1}. ${esc(q.q)}</div>
      ${q.opt.map((o, i) => `<button class="opt" id="rq${i}" onclick="Read.ansPQ(${i})"><b>${'ABCD'[i]}</b>${esc(o)}</button>`).join('')}
      <div id="rq-res"></div></div>`;
  },
  ansPQ(i) {
    const it = this.items[this.idx], q = it.qs[this._qi];
    if (this._done) return; this._done = true;
    this.n++; if (i === q.a) this.ok++;
    $('rq' + i).classList.add(i === q.a ? 'right' : 'wrong');
    if (i !== q.a) $('rq' + q.a).classList.add('right');
    $('rq-res').innerHTML = `${q.exp ? `<div class="exp">${esc(q.exp)}</div>` : ''}
      <button class="big pri" style="width:100%;margin-top:8px" onclick="Read.nextPQ()">Үргэлжлүүлэх →</button>`;
  },
  nextPQ() { this._done = false; this._qi++; this.renderPQ(this.items[this.idx]); },

  renderCloze(it) {
    $('read-inner').innerHTML = `
      <div class="q"><div class="q-pas cn">${esc(it.text)}</div>
        <div class="q-txt">${esc(it.q || 'Хоосон зайд юу тохирох вэ?')}</div>
        ${it.opt.map((o, i) => `<button class="opt" id="c${i}" onclick="Read.ansCloze(${i})"><b>${'ABCD'[i]}</b>${esc(o)}</button>`).join('')}
        <div id="c-res"></div></div>`;
  },
  ansCloze(i) {
    if (this._done) return; this._done = true;
    const it = this.items[this.idx];
    this.n++; if (i === it.a) this.ok++;
    $('c' + i).classList.add(i === it.a ? 'right' : 'wrong');
    if (i !== it.a) $('c' + it.a).classList.add('right');
    $('c-res').innerHTML = `${it.exp ? `<div class="exp">${esc(it.exp)}</div>` : ''}
      <button class="big pri" style="width:100%;margin-top:8px" onclick="Read.next()">Дараах →</button>`;
  },

  renderOrder(it) {
    this.order = [];
    $('read-inner').innerHTML = `
      <div class="note">Өгүүлбэрүүдийг <b>зөв дарааллаар</b> дар. Логик холбоос, холбоос үг,
        төлөөний үг (他、这、那) хаана заасныг анхаар.</div>
      <div class="q" id="ord-q">
        ${it.parts.map((p, i) => `<button class="opt" id="p${i}" onclick="Read.pick(${i})"><b>${'ABCDE'[i]}</b>${esc(p)}</button>`).join('')}
        <div class="q-txt mono" id="ord-pick" style="margin-top:var(--sp-3)">Дараалал: —</div>
        <div id="ord-res"></div></div>`;
  },
  pick(i) {
    if (this._done) return;
    if (this.order.includes(i)) return;
    this.order.push(i);
    $('p' + i).classList.add('sel');
    const it = this.items[this.idx];
    $('ord-pick').textContent = 'Дараалал: ' + this.order.map(x => 'ABCDE'[x]).join(' → ');
    if (this.order.length === it.parts.length) {
      this._done = true;
      const right = JSON.stringify(this.order) === JSON.stringify(it.a);
      this.n++; if (right) this.ok++;
      $('ord-res').innerHTML = `<div class="exp">
        ${right ? '<b style="color:var(--ok)">Зөв дараалал</b>'
                : `<b style="color:var(--danger)">Буруу.</b> Зөв нь: ${it.a.map(x => 'ABCDE'[x]).join(' → ')}`}
        ${it.exp ? '<br>' + esc(it.exp) : ''}</div>
        <div class="q-pas cn">${esc(it.a.map(x => it.parts[x]).join(''))}</div>
        <button class="big pri" style="width:100%" onclick="Read.next()">Дараах →</button>`;
    }
  },
  next() { this._done = false; this.idx++; this.render(); },
};

/* ══ 写作 БИЧИХ ══════════════════════════════════════════════
   71: 看图写作 ≥100 ханз · 72: 话题作文 ≥200 ханз · нийт 40 мин   */
const Write = {
  task: null, started: 0, _iv: null,

  async open() {
    this.stopTimer();
    const bank = await Data.bank_();
    const tasks = bank.write || [];
    const pics  = tasks.filter(t => t.type === 'pic');
    const tops  = tasks.filter(t => t.type === 'topic');
    const hist  = Store.get('write_hist', []);
    $('write-body').innerHTML = `
      <div class="note">
        <b>写作 — 40 минут, 100 оноо.</b> Хоёр даалгавар:<br>
        71. 看图写作 — 4 зургаар түүх, <b>≥100 ханз</b><br>
        72. 话题作文 — сэдвээр эссэ, <b>≥200 ханз</b><br>
        Компьютер дээр пиньинээр бичнэ. Ханз цөөн бичвэл оноо шууд хасагдана.
      </div>
      <div class="row2">
        <button class="big pri" onclick="Write.pick('pic')">71. 看图写作 (${pics.length})</button>
        <button class="big pri" onclick="Write.pick('topic')">72. 话题作文 (${tops.length})</button>
      </div>
      <div class="row2"><button class="big" onclick="Write.full()">Хоёуланг цуг — 40 мин (шалгалтын горим)</button></div>
      ${hist.length ? `<div class="sec"><h2>Өмнөх бичвэрүүд</h2><span>${hist.length}</span></div>
        <div class="glist">${hist.slice(-6).reverse().map((h, i) => `
          <div class="gitem"><div class="gl">${h.date} · ${h.type === 'pic' ? '看图写作' : '话题作文'} · ${h.chars} ханз
            ${h.score != null ? ` · <b>${h.score}/${h.max}</b>` : ''}</div>
            <div class="gc" style="font-size:var(--fs-sm);max-height:4.5em;overflow:hidden">${esc(h.text.slice(0, 120))}…</div>
          </div>`).join('')}</div>` : ''}`;
  },

  async pick(type) {
    const bank = await Data.bank_();
    const pool = (bank.write || []).filter(t => t.type === type);
    if (!pool.length) { toast('Даалгаврын сан хоосон'); return; }
    this.task = pool[Math.random() * pool.length | 0];
    this.render(type === 'pic' ? 15 : 25);
  },
  async full() {
    const bank = await Data.bank_();
    const p = (bank.write || []).filter(t => t.type === 'pic');
    const t = (bank.write || []).filter(t => t.type === 'topic');
    if (!p.length || !t.length) { toast('Даалгаврын сан дутуу'); return; }
    this._queue = [p[Math.random() * p.length | 0], t[Math.random() * t.length | 0]];
    this.task = this._queue.shift(); this.render(40);
  },

  render(minutes) {
    const t = this.task;
    const body = t.type === 'pic'
      ? `<div class="note"><b>第71题：看图写作。</b>
           请根据下面四张图，写一篇不少于 ${t.min || 100} 字的作文。</div>
         <div class="q">${(t.pics || []).map((p, i) => `
           <div class="gitem" style="margin-bottom:7px"><div class="gl">Зураг ${i + 1}</div>
           <div class="gc">${esc(p)}</div></div>`).join('')}</div>`
      : `<div class="note"><b>第72题：话题作文。</b></div>
         <div class="q"><div class="q-pas cn">${esc(t.prompt)}</div>
           <div class="muted">不少于 ${t.min || 200} 字</div></div>`;
    $('write-body').innerHTML = `${body}
      <textarea class="ds-input" id="w-in" placeholder="这里写作文…" oninput="Write.count()"></textarea>
      <div class="count" id="w-count">0 / ${t.min || 100} ханз</div>
      <div class="row2">
        <button class="big" onclick="Write.open()">Болих</button>
        <button class="big pri" onclick="Write.submit()">Дуусгаад шалгуулах</button>
      </div>
      <div id="w-res"></div>`;
    this.startTimer(minutes);
    setTimeout(() => $('w-in')?.focus(), 150);
  },
  count() {
    const v = $('w-in').value || '';
    const n = (v.match(/[一-鿿]/g) || []).length;
    const min = this.task.min || 100;
    const el = $('w-count');
    el.textContent = `${n} / ${min} ханз`;
    el.className = 'count' + (n >= min ? ' ok' : '');
  },
  startTimer(min) {
    this.stopTimer();
    let left = min * 60;
    const tick = () => {
      const m = Math.floor(left / 60), s = left % 60;
      const el = $('write-timer');
      if (el) { el.textContent = `${m}:${String(s).padStart(2, '0')}`; el.classList.toggle('low', left < 300); }
      if (left-- <= 0) { this.stopTimer(); toast('Цаг дууслаа — шалгалтад энд зогсоно'); }
    };
    tick(); this._iv = setInterval(tick, 1000);
  },
  stopTimer() { clearInterval(this._iv); this._iv = null; const el = $('write-timer'); if (el) el.textContent = ''; },

  async submit() {
    const text = ($('w-in')?.value || '').trim();
    const n = (text.match(/[一-鿿]/g) || []).length;
    const min = this.task.min || 100;
    if (n < 30) { toast('Дэндүү богино байна'); return; }
    this.stopTimer();

    // Хэмжигдэх зүйлсийг эхлээд өөрөө шалгана (AI байхгүй ч ажиллана)
    const sentences = text.split(/[。！？!?]/).filter(s => s.trim().length > 1).length;
    const avgLen = sentences ? Math.round(n / sentences) : n;
    const conns = ['虽然', '但是', '因为', '所以', '不但', '而且', '于是', '然而', '首先', '其次',
                   '最后', '如果', '却', '由于', '因此', '总之', '另外', '与其', '不如', '甚至'];
    const used = conns.filter(c => text.includes(c));
    let local = 0;
    local += n >= min ? 30 : Math.round(30 * n / min);          // урт
    local += Math.min(20, used.length * 4);                      // холбоос үг
    local += (avgLen >= 12 && avgLen <= 32) ? 15 : 7;            // өгүүлбэрийн урт
    local += sentences >= 5 ? 10 : sentences * 2;                // бүтэц

    $('w-res').innerHTML = `
      <div class="note"><b>Хэмжилт</b><br>
        Ханз: ${n}/${min} ${n >= min ? '✓' : '✗ дутуу — оноо шууд хасагдана'}<br>
        Өгүүлбэр: ${sentences} · дундаж урт ${avgLen} ханз<br>
        Холбоос үг: ${used.length ? used.join('、') : '<b>байхгүй — HSK5-д заавал хэрэгтэй</b>'}
      </div>
      <div class="note" id="ai-box">AI багш уншиж байна…</div>`;

    const sys = `Чи 15 жилийн туршлагатай HSK шалгалтын шалгагч багш. HSK 3.0 五级 写作 хэсгийг
албан ёсны шалгуураар дүгнэдэг: агуулга бүрэн эсэх, бүтэц, үгийн баялаг, дүрмийн зөв байдал, ханзны тоо.
Монгол хэлээр, богино, шулуун хариул. Магтахгүй — алдааг нь зааж, ЯГ хэрхэн сайжруулахыг хэл.`;
    const usr = `Даалгавар: ${this.task.type === 'pic' ? '看图写作 (4 зураг, ≥' + min + '字)' : '话题作文 (≥' + min + '字)'}
${this.task.type === 'pic' ? 'Зургууд: ' + (this.task.pics || []).join(' / ') : 'Сэдэв: ' + this.task.prompt}

Оюутны бичсэн (${n} ханз):
${text}

Дараах хэлбэрээр хариул:
ОНОО: X/50
АЛДАА: (хамгийн чухал 3, ханзаар нь эш татаж, зөв хувилбарыг нь бич)
ДУТУУ: (агуулгын хувьд юу дутсан)
ДАРААГИЙН АЛХАМ: (яг юуг давтах)`;

    const out = await AI.ask(sys, usr, 800);
    let score = null;
    if (out) {
      const m = out.match(/ОНОО[:：]\s*(\d+)/);
      if (m) score = Math.min(50, parseInt(m[1]));
      $('ai-box').innerHTML = `<div style="white-space:pre-line;line-height:var(--lh-body)">${esc(out)}</div>`;
    } else {
      $('ai-box').innerHTML = `<b>AI багш холбогдохгүй байна.</b><br>
        Өөрийн хэмжилтээр ойролцоогоор <b>${Math.round(local / 75 * 50)}/50</b>.
        AI холбогдвол дүрэм, үгийн сонголтыг нарийн шалгана.`;
    }
    const final = score != null ? score : Math.round(local / 75 * 50);

    const hist = Store.get('write_hist', []);
    hist.push({ date: today(), type: this.task.type, chars: n, text, score: final, max: 50, ai: !!out });
    Store.set('write_hist', hist.slice(-40));
    // 写作 оноог шинэчилнэ (2 даалгавар × 50 = 100)
    const recent = hist.slice(-4);
    const avg = recent.reduce((a, h) => a + (h.score || 0), 0) / recent.length;
    Scores.set({ write: Math.round(avg * 2) });
    Analytics.log('write', final, 50, { chars: n });
    Scores.render();

    $('w-res').insertAdjacentHTML('beforeend',
      this._queue && this._queue.length
        ? `<button class="big pri" style="width:100%;margin-top:8px" onclick="Write.nextInSet()">72-р даалгавар →</button>`
        : `<button class="big pri" style="width:100%;margin-top:8px" onclick="Write.open()">Дуусгах</button>`);
  },
  nextInSet() { this.task = this._queue.shift(); this.render(25); },
};

/* ══ 口语 HSKK ═══════════════════════════════════════════════
   5 даалгавар ~23 мин: 听后复述 ×2 · 看图说话 ×1 · 回答问题 ×2    */
const Speak = {
  items: [], idx: 0, rec: null, chunks: [], url: null, _iv: null,

  async open() {
    this.stop();
    const bank = await Data.bank_();
    const all = bank.speak || [];
    const pick = t => shuffle(all.filter(s => s.type === t));
    this.items = [...pick('retell').slice(0, 2), ...pick('pic').slice(0, 1), ...pick('qa').slice(0, 2)];
    $('speak-body').innerHTML = `
      <div class="note"><b>HSKK 五级 — 5 даалгавар, ~23 минут, 12 сарын 13-ны 16:20.</b><br>
        1–2. 听后复述 — сонсоод өөрийн үгээр ярих<br>
        3. 看图说话 — зураг тайлбарлах<br>
        4–5. 回答问题 — асуултад 2 минут ярих<br>
        Бичлэгээ өөрөө сонсох нь хамгийн хурдан засдаг арга.</div>
      ${this.items.length
        ? `<button class="big pri" style="width:100%" onclick="Speak.start()">Эхлэх (${this.items.length} даалгавар)</button>`
        : `<div class="warn-box">Ярианы даалгаврын сан хоосон байна.</div>`}`;
  },
  start() { this.idx = 0; this.render(); },

  render() {
    const it = this.items[this.idx];
    if (!it) {
      $('speak-body').innerHTML = `<div class="note"><b>Дууслаа.</b> Бичлэгээ сонсоод
        дараах 3 зүйлийг өөрөө тэмдэглэ: тасалдал, давтсан үг, дуудлагын алдаа.</div>
        <button class="big pri" style="width:100%" onclick="Speak.open()">Дахин</button>`;
      this.stop(); return;
    }
    const prep = it.type === 'qa' ? 10 : it.type === 'pic' ? 10 : 0;
    const talk = it.type === 'qa' ? 120 : it.type === 'pic' ? 90 : 60;
    Audio_.register('sp:' + this.idx, [it.text || '']);
    $('speak-body').innerHTML = `
      <div class="muted">${this.idx + 1}/${this.items.length} · ${
        it.type === 'retell' ? '听后复述' : it.type === 'pic' ? '看图说话' : '回答问题'}</div>
      <div class="q">
        ${it.type === 'retell'
          ? `<button class="big pri" style="width:100%" onclick="Audio_.play(${this.idx},'sp')">🔊 Сонсох</button>
             <div class="muted" style="margin-top:8px">Бичвэрийг урьдчилан бүү хар — сонсоод ярь.</div>
             <details style="margin-top:8px"><summary class="muted">Бичвэрийг харах</summary>
               <div class="q-pas cn" style="margin-top:8px">${esc(it.text)}</div></details>`
          : it.type === 'pic'
            ? `<div class="q-pas cn">${esc(it.desc || it.text)}</div>`
            : `<div class="q-txt">${esc(it.q || it.text)}</div>`}
        <div class="row2">
          <button class="big" id="rec-btn" onclick="Speak.toggleRec()">● Бичлэг эхлүүлэх</button>
          <button class="big" onclick="Speak.next()">Алгасах →</button>
        </div>
        <div class="muted" style="margin-top:6px">Бэлтгэх ${prep}с · ярих ${talk}с</div>
        <div id="sp-res"></div>
      </div>`;
  },
  async toggleRec() {
    if (this.rec && this.rec.state === 'recording') { this.rec.stop(); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.chunks = [];
      this.rec = new MediaRecorder(stream);
      this.rec.ondataavailable = e => this.chunks.push(e.data);
      this.rec.onstop = () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(this.chunks, { type: 'audio/webm' });
        if (this.url) URL.revokeObjectURL(this.url);
        this.url = URL.createObjectURL(blob);
        $('rec-btn').textContent = '● Дахин бичих';
        $('sp-res').innerHTML = `<audio controls src="${this.url}" style="width:100%;margin-top:10px"></audio>
          <button class="big pri" style="width:100%;margin-top:8px" onclick="Speak.next()">Дараах →</button>`;
        clearInterval(this._iv); $('speak-timer').textContent = '';
      };
      this.rec.start();
      $('rec-btn').textContent = '■ Зогсоох';
      let s = 0;
      clearInterval(this._iv);
      this._iv = setInterval(() => { s++; $('speak-timer').textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; }, 1000);
    } catch (e) {
      toast('Микрофон нээгдсэнгүй — зөвшөөрлөө шалга');
    }
  },
  next() { Audio_.stop(); this.stop(); this.idx++; this.render(); },
  stop() {
    try { if (this.rec?.state === 'recording') this.rec.stop(); } catch {}
    clearInterval(this._iv); const el = $('speak-timer'); if (el) el.textContent = '';
  },
};

/* ══ 语法 ДҮРЭМ ══════════════════════════════════════════════ */
const Grammar = {
  lv: 5,
  async open() {
    const g = await Data.grammar_();
    const learned = Store.get('gram_learned', []);
    const rows = g.filter(x => x[0] === this.lv);
    $('grammar-prog').textContent = `${learned.length} тэмдэглэсэн`;
    $('grammar-body').innerHTML = `
      <div class="tabs">
        ${[3, 4, 5].map(l => `<button class="tab ${this.lv === l ? 'on' : ''}" onclick="Grammar.set(${l})">HSK${l} (${g.filter(x => x[0] === l).length})</button>`).join('')}
      </div>
      <div class="note">Албан ёсны 等级标准-ийн дүрмийн жагсаалт. Мэдэхгүйг нь дарж тэмдэглэ —
        шинжилгээнд сул тал болж харагдана.</div>
      <div class="glist">${rows.map((r, i) => {
        const key = `${r[0]}:${i}`;
        const on = learned.includes(key);
        return `<div class="gitem" style="${on ? 'opacity:.5' : ''}" onclick="Grammar.mark('${key}')">
          <div class="gl">${esc(r[1])} · ${esc(r[2])}${r[3] ? ' · ' + esc(r[3]) : ''} ${on ? '✓' : ''}</div>
          <div class="gc">${esc(r[4])}</div></div>`;
      }).join('')}</div>`;
  },
  set(l) { this.lv = l; this.open(); },
  mark(key) {
    const l = Store.get('gram_learned', []);
    const i = l.indexOf(key);
    if (i >= 0) l.splice(i, 1); else l.push(key);
    Store.set('gram_learned', l); this.open();
  },
};

/* ══ MOCK ШАЛГАЛТ ════════════════════════════════════════════
   听力 25мин → 阅读 35мин → 写作 40мин. Хэсэг тус бүр ТУСДАА
   цагтай; цаг дуусмагц автоматаар дараагийн хэсэг рүү шилжинэ
   (жинхэнэ шалгалттай адил буцаж засах боломжгүй).              */
const Mock = {
  SPEC: { listen: { n: 35, min: 25 }, read: { n: 35, min: 35 }, write: { n: 2, min: 40 } },
  on: false, sec: null, items: [], idx: 0, ans: {}, left: 0, _iv: null, result: null,

  async open() {
    if (this.on) return;
    const bank = await Data.bank_();
    const nL = (bank.listen || []).length;
    const nR = (bank.read || []).reduce((a, r) => a + (r.qs ? r.qs.length : 1), 0);
    const hist = Store.get('mock_hist', []);
    const ready = nL >= 5 && nR >= 5;
    $('mock-title').textContent = 'Mock шалгалт';
    $('mock-body').innerHTML = `
      <div class="note"><b>Бүтэн шалгалт — 110 минут.</b><br>
        听力 35 асуулт · 25 мин → 阅读 35 асуулт · 35 мин → 写作 2 даалгавар · 40 мин<br>
        Хэсэг бүр <b>тусдаа цагтай</b>. Цаг дуусмагц автоматаар дараагийн хэсэг рүү шилжинэ —
        жинхэнэ шалгалттай яг адил. Бичлэг <b>нэг л удаа</b> тавигдана.<br>
        <b>Эхлэхээсээ өмнө:</b> утсаа унтраа, 110 минут тасалдалгүй суу.</div>
      ${ready ? '' : `<div class="warn-box">Даалгаврын сан одоогоор дутуу
        (сонсгол ${nL}, унших ${nR}). Mock-ийг байгаа хэмжээгээр нь хийж,
        оноог хувь тэнцүүлж тооцно — чиглэл өгөхөд хангалттай, гэхдээ бүтэн биш.</div>`}
      <div class="row2">
        <button class="big pri" onclick="Mock.start('full')">Бүтэн шалгалт</button>
        <button class="big" onclick="Mock.start('listen')">Зөвхөн 听力</button>
      </div>
      <div class="row2">
        <button class="big" onclick="Mock.start('read')">Зөвхөн 阅读</button>
        <button class="big" onclick="go('write')">Зөвхөн 写作</button>
      </div>
      ${hist.length ? `<div class="sec"><h2>Өмнөх дүн</h2><span>${hist.length}</span></div>
        <div class="glist">${hist.slice(-8).reverse().map(h => `
          <div class="gitem"><div class="gl">${h.date}</div>
            <div class="gc" style="font-size:var(--fs-md)">
              <b class="mono">${h.total}</b>/300 · 听 ${h.listen} · 读 ${h.read} · 写 ${h.write ?? '—'}
              ${h.total >= TARGET ? ' 🎯' : h.total >= PASS ? ' ✓' : ''}</div></div>`).join('')}</div>` : ''}`;
  },

  async start(mode) {
    const bank = await Data.bank_();
    this.mode = mode; this.on = true; this.ans = {}; this.result = { listen: null, read: null, write: null };
    this.plan = mode === 'full' ? ['listen', 'read', 'write'] : [mode];
    this.planIdx = 0;
    this.bank = bank;
    this.runSection();
  },
  runSection() {
    const sec = this.plan[this.planIdx];
    if (!sec) return this.finish();
    this.sec = sec; this.idx = 0;
    if (sec === 'listen') {
      this.items = shuffle([...(this.bank.listen || [])]).slice(0, this.SPEC.listen.n);
    } else if (sec === 'read') {
      // Асуулт болгон задална (эх бүрийн дэд асуултууд)
      const flat = [];
      shuffle([...(this.bank.read || [])]).forEach(r => {
        if (r.qs) r.qs.forEach((q, i) => flat.push({ ...r, q: q.q, opt: q.opt, a: q.a, exp: q.exp, _p: i === 0 }));
        else flat.push(r);
      });
      this.items = flat.slice(0, this.SPEC.read.n);
    } else {
      const p = (this.bank.write || []).filter(t => t.type === 'pic');
      const t = (this.bank.write || []).filter(t => t.type === 'topic');
      this.items = [p[Math.random() * p.length | 0], t[Math.random() * t.length | 0]].filter(Boolean);
    }
    if (!this.items.length) { this.planIdx++; return this.runSection(); }
    this.startTimer(this.SPEC[sec].min);
    this.render();
  },
  startTimer(min) {
    clearInterval(this._iv);
    this.left = min * 60;
    const tick = () => {
      const m = Math.floor(this.left / 60), s = this.left % 60;
      const el = $('mock-timer');
      if (el) { el.textContent = `${m}:${String(s).padStart(2, '0')}`; el.classList.toggle('low', this.left < 180); }
      if (this.left-- <= 0) { clearInterval(this._iv); toast('Хэсгийн цаг дууслаа'); this.endSection(); }
    };
    tick(); this._iv = setInterval(tick, 1000);
  },

  render() {
    const sec = this.sec, it = this.items[this.idx];
    const NAMES = { listen: '听力', read: '阅读', write: '写作' };
    $('mock-title').textContent = `${NAMES[sec]} — ${this.idx + 1}/${this.items.length}`;
    if (!it) return this.endSection();

    if (sec === 'write') {
      $('mock-body').innerHTML = `
        ${it.type === 'pic'
          ? `<div class="note"><b>第71题：看图写作。</b>不少于 ${it.min || 100} 字。</div>
             <div class="q">${(it.pics || []).map((p, i) => `<div class="gl">Зураг ${i + 1}</div><div class="gc cn">${esc(p)}</div>`).join('')}</div>`
          : `<div class="note"><b>第72题：话题作文。</b>不少于 ${it.min || 200} 字。</div>
             <div class="q"><div class="q-pas cn">${esc(it.prompt)}</div></div>`}
        <textarea class="ds-input" id="mk-in" oninput="Mock.wcount(${it.min || 100})"></textarea>
        <div class="count" id="mk-count">0 / ${it.min || 100} ханз</div>
        <button class="big pri" style="width:100%" onclick="Mock.saveWrite()">
          ${this.idx + 1 < this.items.length ? 'Дараагийн даалгавар →' : 'Хэсгийг дуусгах'}</button>`;
      setTimeout(() => { const t = $('mk-in'); if (t) t.value = this.ans['w' + this.idx] || ''; }, 50);
      return;
    }

    const isL = sec === 'listen';
    if (isL) Audio_.register('mock:' + this.idx, it.audio || [it.text || '']);
    const letters = isL ? 'ABC' : 'ABCD';
    $('mock-body').innerHTML = `
      ${isL ? `<button class="big pri" style="width:100%" id="mk-play" onclick="Mock.play()">🔊 Бичлэг тавих (1 удаа)</button>` : ''}
      <div class="q">
        ${!isL && it.text ? `<div class="q-pas cn">${esc(it.text)}</div>` : ''}
        ${it.type === 'order'
          ? `<div class="q-txt">Зөв дарааллыг сонго</div>
             ${(it.parts || []).map((p, i) => `<div class="opt">${'ABCDE'[i]} ${esc(p)}</div>`).join('')}
             <input class="ds-input" id="mk-ord" placeholder="жишээ: CABDE" style="margin-top:8px"
                    value="${esc(this.ans[this.idx] || '')}" oninput="Mock.setOrd(this.value)">`
          : `<div class="q-txt">${esc(it.q || '')}</div>
             ${(it.opt || []).map((o, i) => `<button class="opt ${this.ans[this.idx] === i ? 'sel' : ''}"
                 onclick="Mock.setAns(${i})"><b>${letters[i]}</b>${esc(o)}</button>`).join('')}`}
      </div>
      <div class="row2">
        <button class="big" onclick="Mock.move(-1)" ${this.idx === 0 ? 'disabled' : ''}>← Өмнөх</button>
        <button class="big pri" onclick="Mock.move(1)">
          ${this.idx + 1 < this.items.length ? 'Дараах →' : 'Хэсгийг дуусгах'}</button>
      </div>
      <div class="muted" style="margin-top:8px">Хариулсан: ${Object.keys(this.ans).filter(k => !k.startsWith('w')).length}/${this.items.length}</div>`;
  },
  play() {
    if (this._played === this.idx) { toast('Нэг л удаа'); return; }
    this._played = this.idx;
    Audio_.play(this.idx, 'mock');
    $('mk-play').textContent = '🔊 Тавигдсан';
  },
  setAns(i) { this.ans[this.idx] = i; this.render(); },
  setOrd(v) { this.ans[this.idx] = v.toUpperCase().replace(/[^A-E]/g, ''); },
  wcount(min) {
    const n = (($('mk-in').value || '').match(/[一-鿿]/g) || []).length;
    const el = $('mk-count'); el.textContent = `${n} / ${min} ханз`;
    el.className = 'count' + (n >= min ? ' ok' : '');
  },
  saveWrite() {
    this.ans['w' + this.idx] = $('mk-in')?.value || '';
    this.move(1);
  },
  move(d) {
    Audio_.stop();
    if (this.sec === 'write' && d > 0) this.ans['w' + this.idx] = $('mk-in')?.value ?? this.ans['w' + this.idx];
    const n = this.idx + d;
    if (n < 0) return;
    if (n >= this.items.length) return this.endSection();
    this.idx = n; this.render();
  },

  endSection() {
    clearInterval(this._iv);
    const sec = this.sec;
    if (sec === 'listen' || sec === 'read') {
      let ok = 0;
      this.items.forEach((it, i) => {
        if (it.type === 'order') {
          const want = (it.a || []).map(x => 'ABCDE'[x]).join('');
          if ((this.ans[i] || '') === want) ok++;
        } else if (this.ans[i] === it.a) ok++;
      });
      this.result[sec] = Math.round(ok / this.items.length * 100);
      this._detail = this._detail || {};
      this._detail[sec] = { ok, n: this.items.length, items: this.items, ans: { ...this.ans } };
      Analytics.log(sec, ok, this.items.length, { mock: true });
    } else if (sec === 'write') {
      let pts = 0;
      this.items.forEach((it, i) => {
        const t = this.ans['w' + i] || '';
        const n = (t.match(/[一-鿿]/g) || []).length;
        const min = it.min || 100;
        pts += Math.min(50, Math.round(n / min * 32) + (t.split(/[。！？]/).length >= 4 ? 10 : 4));
      });
      this.result.write = Math.min(100, pts);
      this._writeTexts = this.items.map((it, i) => ({ it, text: this.ans['w' + i] || '' }));
    }
    this.ans = {}; this.planIdx++; this.runSection();
  },

  finish() {
    clearInterval(this._iv); this.on = false;
    $('mock-timer').textContent = '';
    const r = this.result;
    const parts = ['listen', 'read', 'write'].filter(k => r[k] != null);
    const total = parts.reduce((a, k) => a + r[k], 0);
    const hist = Store.get('mock_hist', []);
    hist.push({ date: today(), listen: r.listen ?? '—', read: r.read ?? '—', write: r.write ?? null, total });
    Store.set('mock_hist', hist.slice(-30));
    // Чадварын оноог mock-оос шууд шинэчилнэ (хамгийн бодит хэмжүүр)
    const patch = {}; parts.forEach(k => { patch[k] = r[k]; });
    Scores.set(patch); Scores.render();

    const d = daysLeft();
    $('mock-title').textContent = 'Дүн';
    $('mock-body').innerHTML = `
      <div class="score">
        <div class="score-top"><div><span class="score-num">${total}</span>
          <span class="score-of">/ ${parts.length * 100}</span></div>
          <span class="score-tag ${total >= TARGET ? 'good' : total >= PASS ? 'warn' : 'bad'}">
            ${total >= TARGET ? 'зорилтод хүрлээ' : total >= PASS ? 'тэнцэнэ' : 'тэнцэхгүй'}</span></div>
        <div class="exp">
          ${parts.map(k => `${{ listen: '听力', read: '阅读', write: '写作' }[k]} ${r[k]}/100`).join(' · ')}<br>
          ${d} хоног үлдлээ. ${total < TARGET
            ? `Зорилт ${TARGET} хүртэл ${TARGET - total} оноо дутуу — хамгийн бага онооны хэсэгт өдөрт
               2 pomodoro нэмж өг.`
            : 'Зорилтод хүрсэн. Одоо түвшингээ тогтвортой барих нь гол.'}
        </div>
      </div>
      ${this._detail ? `<div class="sec"><h2>Алдсан асуултууд</h2><span>дахин хар</span></div>
        <div class="glist">${this.missedList()}</div>` : ''}
      <button class="big pri" style="width:100%;margin-top:var(--sp-4)" onclick="go('home')">Төлөвлөгөө рүү</button>`;
    this._detail = null;
  },
  missedList() {
    let out = '';
    for (const [sec, d] of Object.entries(this._detail || {})) {
      d.items.forEach((it, i) => {
        const got = d.ans[i];
        const right = it.type === 'order'
          ? (got || '') === (it.a || []).map(x => 'ABCDE'[x]).join('')
          : got === it.a;
        if (right) return;
        const letters = sec === 'listen' ? 'ABC' : 'ABCD';
        out += `<div class="gitem"><div class="gl">${sec === 'listen' ? '听力' : '阅读'} ${i + 1} ·
          чиний хариулт ${got == null ? 'хоосон' : (typeof got === 'number' ? letters[got] : got)} ·
          зөв ${it.type === 'order' ? (it.a || []).map(x => 'ABCDE'[x]).join('') : letters[it.a]}</div>
          <div class="gc">${esc(it.q || it.text || '')}</div>
          ${it.exp ? `<div class="exp">${esc(it.exp)}</div>` : ''}</div>`;
      });
    }
    return out || '<div class="note">Алдаа гаргаагүй.</div>';
  },
  quit() {
    if (this.on && !confirm('Шалгалтыг зогсоох уу? Дүн хадгалагдахгүй.')) return;
    clearInterval(this._iv); this.on = false; $('mock-timer').textContent = ''; go('home');
  },
};

/* ══ ШИНЖИЛГЭЭ ═══════════════════════════════════════════════ */
const Stats = {
  async open() {
    const hist = Analytics.history(14);
    const mock = Store.get('mock_hist', []);
    const s = Scores.get();
    const vm = Vocab.mastered();
    const srs = Vocab.state();
    const boxes = [0, 0, 0, 0, 0, 0];
    Object.values(srs).forEach(c => { boxes[Math.min(5, c.box || 0)]++; });

    // Сул үгс
    const weak = Vocab.weakest(24);
    const all = await Data.all(Vocab.levels());
    const byH = Object.fromEntries(all.map(w => [w.h, w]));

    // Чадвар тус бүрийн 14 хоногийн нийлбэр
    const sum = k => hist.map(d => d.items.filter(x => x.k === k)
      .reduce((a, x) => a + (x.n || 0), 0));
    const totalQ = ['listen', 'read', 'dictation', 'vocab'].map(k => [k, sum(k).reduce((a, b) => a + b, 0)]);

    const maxDay = Math.max(1, ...hist.map(d => d.items.reduce((a, x) => a + (x.n || 0), 0)));
    $('stats-body').innerHTML = `
      <div class="sec"><h2>Өнөөдрийн байдал</h2><span>${daysLeft()} хоног үлдлээ</span></div>
      <div class="note">
        Таамагласан оноо <b>${s.diagDone ? Scores.total() : '—'}</b>/300 · зорилт ${TARGET} · босго ${PASS}<br>
        Үгийн сан: <b>${vm.known}</b>/${vm.total} эзэмшсэн (${vm.pct}%)<br>
        ${mock.length ? `Сүүлийн mock: <b>${mock[mock.length - 1].total}</b> (${mock[mock.length - 1].date})`
                      : 'Mock хийгээгүй — долоо хоногт 1 удаа заавал хий.'}
      </div>

      <div class="sec"><h2>Үгсийн давталтын байдал</h2><span>хайрцаг тус бүр</span></div>
      <div class="glist">
        ${boxes.map((n, i) => `<div class="skill">
          <span class="skill-n">${i === 0 ? 'шинэ/алдсан' : i + '-р давт'}</span>
          <span class="bar"><i style="width:${Math.round(n / Math.max(1, Object.keys(srs).length) * 100)}%;
            background:${i >= 3 ? 'var(--ok)' : i >= 1 ? 'var(--warn)' : 'var(--danger)'}"></i></span>
          <span class="skill-v">${n}</span></div>`).join('')}
      </div>

      <div class="sec"><h2>14 хоногийн ачаалал</h2><span>асуулт/өдөр</span></div>
      <div style="display:flex;gap:3px;align-items:flex-end;height:70px">
        ${hist.map(d => {
          const n = d.items.reduce((a, x) => a + (x.n || 0), 0);
          return `<div title="${d.d}: ${n}" style="flex:1;height:${Math.max(3, n / maxDay * 70)}px;
            background:${n ? 'var(--accent)' : 'var(--track)'};border-radius:3px 3px 0 0"></div>`;
        }).join('')}
      </div>
      <div class="muted" style="margin-top:6px">${totalQ.map(([k, n]) =>
        `${{ listen: '听力', read: '阅读', dictation: '听写', vocab: '词汇' }[k]} ${n}`).join(' · ')}</div>

      <div class="sec"><h2>Хамгийн их алддаг үгс</h2><span>${weak.length}</span></div>
      <div class="glist">${weak.length ? weak.map(h => {
        const w = byH[h];
        return `<div class="gitem"><div class="gc cn">${esc(h)}
          <span class="mono muted" style="font-size:var(--fs-sm)">${esc(w?.p || '')}</span></div>
          <div class="gl">${esc(w?.mn || w?.en || '')} · ${srs[h].miss} удаа алдсан</div></div>`;
      }).join('') : '<div class="note">Одоохондоо алдсан үг бүртгэгдээгүй.</div>'}</div>

      ${mock.length > 1 ? `<div class="sec"><h2>Mock-ийн явц</h2><span>${mock.length} удаа</span></div>
        <div class="glist">${mock.slice(-10).reverse().map(m => `<div class="gitem">
          <div class="gl">${m.date}</div><div class="gc mono">${m.total}/300 ·
          听 ${m.listen} · 读 ${m.read} · 写 ${m.write ?? '—'}</div></div>`).join('')}</div>` : ''}

      <div class="jv-nav-space"></div>`;
  },
};

window.Pomo = Pomo; window.Plan = Plan; window.Vocab = Vocab; window.Diag = Diag;
window.Listen = Listen; window.Read = Read; window.Write = Write; window.Speak = Speak;
window.Grammar = Grammar; window.Mock = Mock; window.Stats = Stats; window.Scores = Scores;
