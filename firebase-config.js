const FIREBASE_CONFIG = {
  apiKey:            "AIzaSyA0AwSRMmKQsRfLoY9CreGKrm3CXn0FHTc",
  authDomain:        "jarvis-bileg.firebaseapp.com",
  projectId:         "jarvis-bileg",
  storageBucket:     "jarvis-bileg.firebasestorage.app",
  messagingSenderId: "59304492638",
  appId:             "1:59304492638:web:9da4e7ceac790d1254becf"
};

firebase.initializeApp(FIREBASE_CONFIG);

const _db   = firebase.firestore();
_db.settings({ experimentalAutoDetectLongPolling: true, merge: true });
const _auth = firebase.auth();

function _uid()  { return _auth.currentUser?.uid || null; }
window._uid = _uid;
window._db  = _db;

// ── Sprint 33: Optimistic UI helpers ────────────────────────────
function _fsDebounce(fn, ms) {
  let t = null;
  return function(...args) { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

// Deep merge (source overrides target, preserving nested objects)
function _fsMerge(target, source) {
  const out = Object.assign({}, target);
  for (const k of Object.keys(source || {})) {
    if (source[k] && typeof source[k] === 'object' && !Array.isArray(source[k])) {
      out[k] = _fsMerge(target[k] || {}, source[k]);
    } else {
      out[k] = source[k];
    }
  }
  return out;
}

// Debounced Firestore workspace write: batches rapid saves into 1 write op
const _debouncedFsWorkspace = _fsDebounce(function(merged) {
  const uid = _uid();
  if (!uid || !_db) return;
  _db.doc(`users/${uid}/config/workspace`)
    .set(merged, { merge: true })
    .catch(err => console.warn('[Jarvis] Workspace sync failed:', err.code));
}, 800);
function _uref(path) {
  const uid = _uid();
  return uid ? _db.doc(`users/${uid}/${path}`) : null;
}

// ── OFFLINE-FIRST: No login modal needed ─────────────────────────
// T.H.R.E.E. OS runs locally. Firestore syncs in background if available.
function _showLoginModal() { /* disabled — offline-first mode */ }
function _hideLoginModal() { document.getElementById('login-modal')?.remove(); }

// ── ACTIVATION GATE ────────────────────────────────────────────────
const ACTIVATION_KEY_CORRECT = 'STARK-JARVIS-2026';

function _showActivationGate(user) {
  if (document.getElementById('activation-gate')) return;
  const g = document.createElement('div');
  g.id = 'activation-gate';
  g.style.cssText = `
    position:fixed;inset:0;z-index:10000;
    background:rgba(0,3,8,.97);
    display:flex;align-items:center;justify-content:center;
    font-family:'Orbitron',sans-serif;
  `;
  g.innerHTML = `
    <div style="width:440px;max-width:calc(100vw - 40px);
      background:rgba(8,8,20,.97);border:1px solid rgba(212,175,55,.2);border-radius:10px;
      padding:36px 40px;box-shadow:0 0 60px rgba(212,175,55,.08),0 0 120px rgba(0,0,0,.8);">
      <div style="font-size:9px;letter-spacing:.35em;color:rgba(212,175,55,.6);margin-bottom:20px;">STARK INDUSTRIES // ACCESS CONTROL</div>
      <div style="font-size:18px;font-weight:400;color:#e8e0c8;letter-spacing:.04em;margin-bottom:8px;">Activation Required</div>
      <div style="font-family:'JetBrains Mono',monospace;font-size:10px;color:rgba(200,180,120,.45);line-height:1.6;margin-bottom:24px;">
        Сайн байна уу, <strong style="color:rgba(212,175,55,.8)">${user.displayName || user.email}</strong>.<br>
        Энэ систем хувийн хэрэглээнд зориулагдсан.<br>
        Нэвтрэх түлхүүрийг оруулна уу.
      </div>
      <div style="margin-bottom:14px;">
        <label style="display:block;font-size:9px;letter-spacing:.12em;color:rgba(212,175,55,.5);margin-bottom:6px;">ACTIVATION KEY</label>
        <input id="ag-key-input" type="password" placeholder="STARK-JARVIS-XXXX"
          style="width:100%;background:rgba(212,175,55,.04);border:1px solid rgba(212,175,55,.18);
          border-radius:4px;color:#d8d0b8;font-family:'JetBrains Mono',monospace;font-size:12px;
          padding:10px 14px;outline:none;box-sizing:border-box;" autocomplete="off" spellcheck="false">
        <div id="ag-err" style="font-family:'JetBrains Mono',monospace;font-size:9px;color:#ff3c50;margin-top:6px;min-height:14px;"></div>
      </div>
      <button id="ag-btn" onclick="window._submitActivationKey()" style="
        width:100%;padding:12px;margin-top:4px;
        background:linear-gradient(135deg,rgba(212,175,55,.12),rgba(212,175,55,.06));
        border:1px solid rgba(212,175,55,.35);border-radius:5px;
        color:#d4af37;font-family:'Orbitron',sans-serif;font-size:11px;letter-spacing:.14em;
        cursor:pointer;transition:all .2s;
      ">VERIFY ACCESS →</button>
      <div style="margin-top:16px;text-align:center;">
        <button onclick="window._signOutFromGate()" style="background:none;border:none;
          font-family:'JetBrains Mono',monospace;font-size:9px;color:rgba(200,180,120,.3);
          cursor:pointer;letter-spacing:.05em;">← өөр аккаунтоор нэвтрэх</button>
      </div>
    </div>`;
  document.body.appendChild(g);
  // Enter → submit
  document.getElementById('ag-key-input')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') window._submitActivationKey();
  });
  setTimeout(() => document.getElementById('ag-key-input')?.focus(), 100);
}

function _hideActivationGate() {
  const g = document.getElementById('activation-gate');
  if (!g) return;
  g.style.transition = 'opacity .5s ease';
  g.style.opacity = '0';
  setTimeout(() => g.remove(), 500);
}

window._submitActivationKey = async function () {
  const inp  = document.getElementById('ag-key-input');
  const errEl = document.getElementById('ag-err');
  const btn   = document.getElementById('ag-btn');
  const key   = (inp?.value || '').trim();

  if (key !== ACTIVATION_KEY_CORRECT) {
    if (inp) inp.style.borderColor = 'rgba(255,60,80,.6)';
    if (errEl) errEl.textContent = '✗ Буруу түлхүүр. Дахин оролдоно уу.';
    setTimeout(() => {
      if (inp) inp.style.borderColor = 'rgba(212,175,55,.18)';
      if (errEl) errEl.textContent = '';
    }, 2000);
    return;
  }

  // Correct — save to Firestore
  if (btn) { btn.disabled = true; btn.textContent = 'VERIFYING...'; }
  const uid = _uid();
  if (uid && _db) {
    try {
      await _db.doc('users/' + uid).set({ activationKeyValidated: true }, { merge: true });
    } catch(e) { console.warn('Gate save error:', e); }
  }

  // localStorage backup
  localStorage.setItem('jarvis_activated', '1');

  _hideActivationGate();

  // Proceed: check onboarding
  if (typeof checkSystemGenesis === 'function') checkSystemGenesis();
};

window._signOutFromGate = function () {
  _auth.signOut();
  _hideActivationGate();
};

// ── AUTH STATE ─────────────────────────────────────────────────────
// Rate-limit: syncDown runs at most once per 30 minutes
let _lastSyncAt = 0;
const SYNC_INTERVAL_MS = 30 * 60 * 1000; // 30 min

function _syncDownThrottled() {
  const now = Date.now();
  if (now - _lastSyncAt < SYNC_INTERVAL_MS) {
    // Cache ашиглан render хийнэ, Firestore руу ханддаггүй
    document.dispatchEvent(new Event('jarvis:ready'));
    return;
  }
  _lastSyncAt = now;
  DB.syncDown().then(() => {
    document.dispatchEvent(new Event('jarvis:ready'));
  }).catch(() => {
    document.dispatchEvent(new Event('jarvis:ready')); // still fire even on error
  });
}

// ══════════════════════════════════════════════════════════════════
// SPRINT 34 — USER PROFILE SYSTEM (Bileg vs Marlaa routing)
// users/{uid}/config/profile — role, theme_preset, module defaults
// ══════════════════════════════════════════════════════════════════

const USER_PROFILES = {
  bileg: {
    role:           'bileg',
    theme_preset:   'stark-cyan',
    default_modules: ['missions','hsk','fx','intel','routine','telem'],
    coach_level:    3,
    features:       ['hsk_blitz','terminal','missions','fx'],
    hsk_target:     4,
    exam_date:      '2026-06-28',
  },
  marlaa: {
    role:           'marlaa',
    theme_preset:   'marlaa',
    default_modules: ['life_logic','missions','routine','calendar_sync','habit'],
    coach_level:    2,
    features:       ['life_logic','calendar_sync','pre_flight','master_memory'],
    hsk_target:     null,
    exam_date:      null,
  },
};

// Load user profile from Firestore → dispatch 'jarvis:profile' event
async function _loadUserProfile(uid) {
  // 1. Fast: localStorage cache
  const cached = localStorage.getItem('jarvis_user_profile');
  if (cached) {
    try {
      const p = JSON.parse(cached);
      document.dispatchEvent(new CustomEvent('jarvis:profile', { detail: p }));
    } catch {}
  }
  // 2. Firestore: config/profile
  if (!uid || !_db) return;
  try {
    const snap = await _db.doc(`users/${uid}/config/profile`).get({ source: 'cache' })
      .catch(() => _db.doc(`users/${uid}/config/profile`).get());
    if (snap && snap.exists) {
      const p = snap.data();
      localStorage.setItem('jarvis_user_profile', JSON.stringify(p));
      document.dispatchEvent(new CustomEvent('jarvis:profile', { detail: p }));
    }
  } catch {}
}

async function _saveUserProfile(uid, patch) {
  if (!uid || !_db) return;
  const ref = _db.doc(`users/${uid}/config/profile`);
  // Optimistic local update
  try {
    const cur = JSON.parse(localStorage.getItem('jarvis_user_profile') || '{}');
    const merged = _fsMerge(cur, patch);
    localStorage.setItem('jarvis_user_profile', JSON.stringify(merged));
    document.dispatchEvent(new CustomEvent('jarvis:profile', { detail: merged }));
  } catch {}
  // Async Firestore
  ref.set(patch, { merge: true }).catch(e => console.warn('[Profile]', e.code));
}

_auth.onAuthStateChanged(async user => {
  if (user) {
    _hideLoginModal();
    // Load user profile FIRST (role → theme), then syncDown
    await _loadUserProfile(user.uid);
    _syncDownThrottled();

    // Sprint 34: Watch outbox pending count for badge
    DB.listenOutboxPending?.(user.uid, (count) => {
      const badge   = document.getElementById('telegram-outbox-badge');
      const countEl = document.getElementById('outbox-count');
      if (badge)   badge.classList.toggle('has-pending', count > 0);
      if (countEl) countEl.textContent = count;
    });
  }
  // No login modal — app works offline-first
});

window.signOut = function () {
  localStorage.removeItem('jarvis_activated');
  _auth.signOut();
};

// ── DB OBJECT ──────────────────────────────────────────────────────
window.DB = {
  ready: false,

  saveRoutine(r) {
    const ref = _uref(`routines/${r.date}`);
    if (!ref) return;
    const { date, ...data } = r;
    ref.set(data, { merge: true }).catch(() => {});
  },

  saveMissions(missions) {
    const ref = _uref('meta/missions');
    if (!ref) return;
    ref.set({ list: missions }).catch(() => {});
  },

  saveLog(date, log) {
    const ref = _uref(`logs/${date}`);
    if (!ref) return;
    ref.set(log).catch(() => {});
  },

  saveChatHistory(history) {
    const ref = _uref('meta/chat');
    if (!ref) return;
    ref.set({ history, updatedAt: new Date().toISOString() }).catch(() => {});
  },

  async loadChatHistory() {
    const ref = _uref('meta/chat');
    if (!ref) return null;
    try {
      const snap = await ref.get();
      if (snap.exists) return snap.data().history || [];
    } catch {}
    return null;
  },

  async saveProfile(patch) {
    const uid = _uid();
    if (!uid) return;
    await _db.doc(`users/${uid}/meta/profile`).set(
      { ...patch, updatedAt: new Date().toISOString() },
      { merge: true }
    );
    if (patch.telegram_chat_id) {
      await _db.doc(`telegram_lookup/${patch.telegram_chat_id}`).set(
        { uid, updatedAt: new Date().toISOString() },
        { merge: true }
      );
    }
  },

  async loadProfile() {
    const uid = _uid();
    if (!uid) return null;
    try {
      const snap = await _db.doc(`users/${uid}/meta/profile`).get();
      return snap.exists ? snap.data() : null;
    } catch { return null; }
  },

  saveSettings(patch) {
    const ref = _uref('meta/settings');
    if (!ref) return;
    ref.set({ ...patch, updatedAt: new Date().toISOString() }, { merge: true }).catch(() => {});
  },

  async loadSettings() {
    const ref = _uref('meta/settings');
    if (!ref) return null;
    try {
      const snap = await ref.get();
      return snap.exists ? snap.data() : null;
    } catch { return null; }
  },

  // ══════════════════════════════════════════════════════════════════
  // SPRINT 30 — WORKSPACE SCHEMA (Modular Widget Layout System)
  // Single document, minimal reads. Schema:
  // { current_layout, layouts: { moodName: { theme, widgets:{id:{visible,opacity,order}} } },
  //   coach_level, telegram_chat_id }
  // ══════════════════════════════════════════════════════════════════

  // ── Sprint 33: Optimistic UI save ──────────────────────────────
  // 1. Merge with existing localStorage snapshot immediately (0ms)
  // 2. Debounce Firestore write (800ms) → batch all rapid changes
  saveWorkspace(ws) {
    // Deep-merge with existing localStorage data
    let merged = ws;
    try {
      const existing = JSON.parse(localStorage.getItem('jarvis_workspace') || '{}');
      merged = _fsMerge(existing, ws);
    } catch {}
    // OPTIMISTIC: write to localStorage immediately (zero latency)
    localStorage.setItem('jarvis_workspace', JSON.stringify(merged));
    // DEFERRED: Firestore write debounced — batches rapid calls
    _debouncedFsWorkspace(merged);
  },

  async loadWorkspace() {
    // 1. localStorage cache (fast, offline-safe)
    const local = localStorage.getItem('jarvis_workspace');
    if (local) { try { return JSON.parse(local); } catch {} }
    // 2. Firestore cache-first, then server
    const uid = _uid();
    if (!uid || !_db) return null;
    try {
      let snap;
      try   { snap = await _db.doc(`users/${uid}/config/workspace`).get({ source: 'cache' }); }
      catch { snap = await _db.doc(`users/${uid}/config/workspace`).get(); }
      if (snap && snap.exists) {
        const d = snap.data();
        localStorage.setItem('jarvis_workspace', JSON.stringify(d));
        return d;
      }
    } catch {}
    return null;
  },

  // Default workspace schema — used on first run
  defaultWorkspace() {
    return {
      current_layout: 'default',
      layouts: {
        default: {
          name:    'Default OS',
          theme:   'stark-cyan',
          widgets: {
            chat:       { visible: true,  opacity: 0.9, order: 1 },
            hsk:        { visible: true,  opacity: 0.9, order: 2 },
            routine:    { visible: true,  opacity: 0.9, order: 3 },
            telem:      { visible: true,  opacity: 0.9, order: 4 },
            missions:   { visible: true,  opacity: 0.9, order: 5 },
            intel_feed: { visible: true,  opacity: 0.9, order: 6 },
            fx:         { visible: true,  opacity: 0.85, order: 7 },
            gym:        { visible: false, opacity: 0.9, order: 8 },
          }
        }
      },
      coach_level: 2,
      telegram_chat_id: ''
    };
  },

  // ── Save user preferences (opacity, layout) ──────────────────────
  savePreferences(patch) {
    const uid = _uid();
    if (!uid || !_db) return;
    _db.doc(`users/${uid}/settings/preferences`).set(patch, { merge: true }).catch(() => {});
  },

  async loadPreferences() {
    const uid = _uid();
    if (!uid || !_db) return null;
    try {
      const snap = await _db.doc(`users/${uid}/settings/preferences`).get();
      return snap.exists ? snap.data() : null;
    } catch { return null; }
  },

  async syncDown() {
    const uid = _uid();
    if (!uid) return;
    const today = new Date().toISOString().split('T')[0];

    // ── CACHE-FIRST: Firestore SDK local cache ашиглана ──────────
    // source:'cache' → network хүсэлт гаргахгүй, offline-д ч ажиллана
    // source:'server' → force network (зөвхөн шаардлагатай үед)
    const getOpts = { source: 'cache' };

    try {
      const [rSnap, mSnap, lSnap, bSnap, sSnap, pSnap, prefSnap, wsSnap, tgSnap] = await Promise.all([
        _db.doc(`users/${uid}/routines/${today}`).get(getOpts),
        _db.doc(`users/${uid}/meta/missions`).get(getOpts),
        _db.doc(`users/${uid}/logs/${today}`).get(getOpts),
        _db.doc(`users/${uid}/briefings/latest`).get(getOpts),
        _db.doc(`users/${uid}/meta/settings`).get(getOpts),
        _db.doc(`users/${uid}/meta/profile`).get(getOpts),
        _db.doc(`users/${uid}/settings/preferences`).get(getOpts),
        _db.doc(`users/${uid}/config/workspace`).get(getOpts),
        // Sprint 34: check Telegram link status on every boot
        _db.doc(`users/${uid}/integrations/telegram`).get(getOpts).catch(() => null),
      ]);

      if (rSnap.exists) {
        const data = { ...rSnap.data(), date: today };
        localStorage.setItem('jarvis_r', JSON.stringify(data));
        localStorage.setItem('jarvis_r_' + today, JSON.stringify(data));
        if (typeof renderRoutine === 'function') renderRoutine();
        if (typeof renderScore   === 'function') renderScore();
        if (typeof renderStreaks === 'function') renderStreaks();
      }

      if (mSnap.exists && mSnap.data()?.list) {
        localStorage.setItem('jarvis_missions', JSON.stringify(mSnap.data().list));
        if (typeof renderMissions === 'function') renderMissions();
      }

      if (lSnap.exists) {
        localStorage.setItem('jarvis_log_' + today, JSON.stringify(lSnap.data()));
        if (typeof renderFromLog === 'function') renderFromLog(lSnap.data());
      }

      if (bSnap.exists) {
        const { message, timestamp } = bSnap.data();
        const ageHours = (Date.now() - new Date(timestamp)) / 3600000;
        if (ageHours < 7 && message && typeof typeJarvis === 'function') {
          setTimeout(() => typeJarvis(message), 800);
        }
      }

      if (sSnap.exists) {
        const s = sSnap.data();
        const MAP = {
          chat_key:    'jarvis_chat_key',
          gh_trigger:  'jarvis_gh_trigger',
          proxy_url:   'jarvis_proxy_url',
          core_memory: 'jarvis_core_memory',
        };
        let changed = false;
        Object.entries(MAP).forEach(([field, lsKey]) => {
          if (s[field]) { localStorage.setItem(lsKey, s[field]); changed = true; }
        });
        if (changed && typeof renderUser === 'function') renderUser(_auth.currentUser);
      }

      if (pSnap.exists) {
        const p = pSnap.data();
        if (p.custom_api_key && !localStorage.getItem('jarvis_chat_key')) {
          localStorage.setItem('jarvis_chat_key', p.custom_api_key);
        }
        if (p.system_instruction) {
          localStorage.setItem('jarvis_system_instruction', p.system_instruction);
          if (typeof window !== 'undefined') window._jarvisSystemInstruction = p.system_instruction;
        }
      }

      // ── Load preferences (opacity + layout) ──────────────────────
      if (prefSnap.exists) {
        const pref = prefSnap.data();
        if (pref.opacity != null) {
          localStorage.setItem('jarvis_opacity', pref.opacity);
          if (typeof _applyOpacity === 'function') _applyOpacity(pref.opacity);
        }
        if (pref.layoutOrder) {
          localStorage.setItem('jarvis_layout_order', JSON.stringify(pref.layoutOrder));
          if (typeof _applyLayoutOrder === 'function') _applyLayoutOrder(pref.layoutOrder);
        }
      }

      // ── Sprint 30: Load workspace (coach level + moods) ──────────
      if (wsSnap && wsSnap.exists) {
        const ws = wsSnap.data();
        localStorage.setItem('jarvis_workspace', JSON.stringify(ws));
        if (ws.coach_level != null)
          localStorage.setItem('jarvis_coach_level', String(ws.coach_level));
        if (typeof _applyWorkspace === 'function') _applyWorkspace(ws);
      }

      // ── Sprint 34: Telegram link status sync ──────────────────────
      // Аппыг дахин нэвтрэх бүрт Telegram холбоотой эсэхийг шалгана.
      // index.html-д _listenTelegramInbox()-г дуудахад хэрэгтэй.
      if (tgSnap && tgSnap.exists) {
        const tgData = tgSnap.data();
        if (tgData?.linked === true) {
          localStorage.setItem('jarvis_telegram_linked', '1');
          if (tgData.chat_id) localStorage.setItem('jarvis_telegram_chat_id', String(tgData.chat_id));
        }
      }

      if (typeof syncChatFromFirestore === 'function') syncChatFromFirestore();
      DB.ready = true;

    } catch (e) {
      // Cache miss эсвэл offline — network-аас нэг удаа татна
      if (e.code === 'unavailable' || e.message?.includes('cache')) {
        console.info('[Jarvis] Cache miss — server-аас нэг удаа sync хийнэ');
        try {
          const [rSnap, mSnap, lSnap, bSnap, sSnap, pSnap, prefSnap] = await Promise.all([
            _db.doc(`users/${uid}/routines/${today}`).get(),
            _db.doc(`users/${uid}/meta/missions`).get(),
            _db.doc(`users/${uid}/logs/${today}`).get(),
            _db.doc(`users/${uid}/briefings/latest`).get(),
            _db.doc(`users/${uid}/meta/settings`).get(),
            _db.doc(`users/${uid}/meta/profile`).get(),
            _db.doc(`users/${uid}/settings/preferences`).get(),
          ]);
          // Reuse same processing logic — just re-call with server data
          if (rSnap.exists) {
            const data = { ...rSnap.data(), date: today };
            localStorage.setItem('jarvis_r', JSON.stringify(data));
            localStorage.setItem('jarvis_r_' + today, JSON.stringify(data));
            if (typeof renderRoutine === 'function') renderRoutine();
          }
          if (mSnap.exists && mSnap.data()?.list) {
            localStorage.setItem('jarvis_missions', JSON.stringify(mSnap.data().list));
            if (typeof renderMissions === 'function') renderMissions();
          }
          DB.ready = true;
        } catch (e2) {
          console.warn('[Jarvis] Server sync ч алдаа:', e2.message);
        }
      } else {
        console.warn('[Jarvis] Firestore sync алдаа:', e.message);
      }
    }
  },

  // ══════════════════════════════════════════════════════════════════
  // SPRINT 34 — LIFE LOGIC DB (Marlaa's Dependency Engine)
  // Schema: users/{uid}/life_logic/{doc}
  // ══════════════════════════════════════════════════════════════════

  // Master Memory: activity time estimates learned from behavior
  async saveMasterMemory(activityId, actualMins) {
    const uid = _uid(); if (!uid) return;
    const ref = _db.doc(`users/${uid}/life_logic/master_memory`);
    // Optimistic localStorage update
    try {
      const mem = JSON.parse(localStorage.getItem('jarvis_master_memory') || '{}');
      const entry = mem[activityId] || { samples: [], avg_mins: null, confirmed: false };
      entry.samples.push({ mins: actualMins, ts: Date.now() });
      // Keep last 14 samples
      if (entry.samples.length > 14) entry.samples = entry.samples.slice(-14);
      // Weighted average (recent samples have 2x weight)
      const total = entry.samples.reduce((s, x, i) => {
        const w = i >= entry.samples.length - 3 ? 2 : 1;
        return { sum: s.sum + x.mins * w, w: s.w + w };
      }, { sum: 0, w: 0 });
      entry.avg_mins = Math.round(total.sum / total.w);
      // Auto-confirm after 7 samples
      if (entry.samples.length >= 7 && !entry.confirmed) {
        entry.confirmed = true;
        entry.confirmed_at = new Date().toISOString();
        document.dispatchEvent(new CustomEvent('jarvis:memory-confirmed', {
          detail: { activityId, avg_mins: entry.avg_mins }
        }));
      }
      mem[activityId] = entry;
      localStorage.setItem('jarvis_master_memory', JSON.stringify(mem));
      // Debounced Firestore write
      _debouncedFsWorkspace({ _lifeMemory: mem }); // reuse debounce
      ref.set({ [activityId]: entry }, { merge: true }).catch(() => {});
    } catch (e) { console.warn('[MasterMemory]', e); }
  },

  async loadMasterMemory() {
    // Fast path: localStorage
    const cached = localStorage.getItem('jarvis_master_memory');
    if (cached) try { return JSON.parse(cached); } catch {}
    const uid = _uid(); if (!uid) return {};
    try {
      const snap = await _db.doc(`users/${uid}/life_logic/master_memory`).get();
      if (snap.exists) {
        const d = snap.data();
        localStorage.setItem('jarvis_master_memory', JSON.stringify(d));
        return d;
      }
    } catch {}
    return {};
  },

  // Daily Plans: draft + confirmed schedule
  async saveDayPlan(date, plan) {
    const uid = _uid(); if (!uid) return;
    localStorage.setItem('jarvis_plan_' + date, JSON.stringify(plan));
    _db.doc(`users/${uid}/plans/${date}`).set(plan, { merge: true }).catch(() => {});
  },

  async loadDayPlan(date) {
    const cached = localStorage.getItem('jarvis_plan_' + date);
    if (cached) try { return JSON.parse(cached); } catch {}
    const uid = _uid(); if (!uid) return null;
    try {
      const snap = await _db.doc(`users/${uid}/plans/${date}`).get();
      if (snap.exists) { localStorage.setItem('jarvis_plan_' + date, JSON.stringify(snap.data())); return snap.data(); }
    } catch {}
    return null;
  },

  // Locations: frequently visited places
  async saveLocation(loc) {
    // loc: { id, name, address, avg_stay_mins }
    const uid = _uid(); if (!uid) return;
    const locs = JSON.parse(localStorage.getItem('jarvis_locations') || '[]');
    const idx  = locs.findIndex(l => l.id === loc.id);
    if (idx >= 0) locs[idx] = { ...locs[idx], ...loc };
    else locs.push(loc);
    localStorage.setItem('jarvis_locations', JSON.stringify(locs));
    _db.doc(`users/${uid}/life_logic/locations`).set({ places: locs }, { merge: false }).catch(() => {});
  },

  getLocations() {
    try { return JSON.parse(localStorage.getItem('jarvis_locations') || '[]'); }
    catch { return []; }
  },

  // Calendar events (for full sync)
  async saveCalendarEvent(evt) {
    // evt: { id, title, type, start, end, recurrence, source_id, color }
    const uid = _uid(); if (!uid) return;
    const events = JSON.parse(localStorage.getItem('jarvis_cal_events') || '[]');
    const idx = events.findIndex(e => e.id === evt.id);
    if (idx >= 0) events[idx] = evt; else events.push(evt);
    localStorage.setItem('jarvis_cal_events', JSON.stringify(events));
    _db.doc(`users/${uid}/calendar/events`).set(
      { items: events, last_push: new Date().toISOString() }, { merge: false }
    ).catch(() => {});
  },

  getCalendarEvents() {
    try { return JSON.parse(localStorage.getItem('jarvis_cal_events') || '[]'); }
    catch { return []; }
  },

  // ══════════════════════════════════════════════════════════════════
  // SPRINT 34 — JUNE CHALLENGE
  // Shared path: challenge/june2026/daily/{date} → { bileg:{}, marlaa:{} }
  // Streak:      challenge/june2026/streaks/{uid}
  // ══════════════════════════════════════════════════════════════════

  async saveChallengeScore(date, role, scoreData) {
    // scoreData: { pct, done, total }
    const uid = _uid();
    // 1. Shared challenge collection (both users can read each other)
    const dailyRef  = _db.doc(`challenge/june2026/daily/${date}`);
    const streakRef = _db.doc(`challenge/june2026/streaks/${uid}`);

    try {
      // Optimistic local cache
      const cached = JSON.parse(localStorage.getItem('jarvis_ch_scores_' + date) || '{}');
      cached[role] = { ...scoreData, uid, updatedAt: new Date().toISOString() };
      localStorage.setItem('jarvis_ch_scores_' + date, JSON.stringify(cached));

      // Firestore: daily score
      await dailyRef.set({ [role]: { ...scoreData, uid } }, { merge: true });

      // Streak logic
      const streakSnap = await streakRef.get().catch(() => null);
      const streakData = streakSnap?.exists ? streakSnap.data() : { current: 0, best: 0, total_days: 0, last_date: '' };
      // GAP-10: UTC → Asia/Shanghai timezone
      const yesterday  = new Date(Date.now() - 86400000)
        .toLocaleDateString('sv', { timeZone: 'Asia/Shanghai' });
      const isStreak   = streakData.last_date === yesterday && scoreData.pct >= 50;
      const isBroken   = streakData.last_date && streakData.last_date !== yesterday && streakData.last_date !== date;

      const newCurrent = scoreData.pct >= 50
        ? (isStreak ? (streakData.current || 0) + 1 : 1)
        : 0;
      const newBest    = Math.max(newCurrent, streakData.best || 0);
      const newTotal   = (streakData.total_days || 0) + (streakData.last_date !== date ? 1 : 0);

      // GAP-03: merge: true — Electron/Railway race condition сэргийлэх
      await streakRef.set({
        current:    newCurrent,
        best:       newBest,
        total_days: newTotal,
        last_date:  date,
        role,
        updatedAt:  new Date().toISOString(),
      }, { merge: true });

      // Streak broken notification
      if (isBroken && streakData.current >= 3) {
        this.addToTelegramOutbox(uid,
          `💔 Streak тасарлаа (${streakData.current} өдөр). Өнөөдрөөс шинээр эхэл. 💪`,
          'streak_broken', null
        );
      }
    } catch (e) {
      console.warn('[Challenge] saveChallengeScore:', e.code);
    }
  },

  // ── Telegram Outbox (Bidirectional) ──────────────────────────────
  // Cloud Function watches this collection and sends via Bot API
  addToTelegramOutbox(uid, message, type, scheduledFor) {
    if (!uid || !_db) return;
    const docId = type + '_' + Date.now();
    _db.doc(`users/${uid}/telegram_outbox/${docId}`).set({
      message, type,
      scheduled_for: scheduledFor || null,
      created_at:    new Date().toISOString(),
      sent:          false,
    }).catch(() => {});
  },

  // Listen for outbox updates (to update badge in UI)
  listenOutboxPending(uid, onUpdate) {
    if (!uid || !_db) return () => {};
    return _db.collection(`users/${uid}/telegram_outbox`)
      .where('sent', '==', false)
      .onSnapshot(snap => onUpdate(snap.size), () => {});
  },

  // HSK Progress (Bileg's SRS)
  async saveHSKProgress(progress) {
    const uid = _uid(); if (!uid) return;
    localStorage.setItem('jarvis_hsk_progress', JSON.stringify(progress));
    _db.doc(`users/${uid}/hsk/progress`).set(progress, { merge: true }).catch(() => {});
  },

  async loadHSKProgress() {
    const cached = localStorage.getItem('jarvis_hsk_progress');
    if (cached) try { return JSON.parse(cached); } catch {}
    const uid = _uid(); if (!uid) return null;
    try {
      const snap = await _db.doc(`users/${uid}/hsk/progress`).get();
      if (snap.exists) { localStorage.setItem('jarvis_hsk_progress', JSON.stringify(snap.data())); return snap.data(); }
    } catch {}
    return null;
  },

  async saveHSKSession(date, session) {
    const uid = _uid(); if (!uid) return;
    _db.doc(`users/${uid}/hsk/sessions/${date}`).set(session, { merge: true }).catch(() => {});
  },
};
