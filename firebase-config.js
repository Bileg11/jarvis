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
function _uref(path) {
  const uid = _uid();
  return uid ? _db.doc(`users/${uid}/${path}`) : null;
}

// ── LOGIN MODAL ────────────────────────────────────────────────────
function _showLoginModal() {
  if (document.getElementById('login-modal')) return;
  const m = document.createElement('div');
  m.id = 'login-modal';
  m.innerHTML = `
    <div class="login-box">
      <div class="login-title">🔐 JARVIS</div>
      <input id="lm-email" type="email"    placeholder="Email"    autocomplete="email">
      <input id="lm-pass"  type="password" placeholder="Нууц үг" autocomplete="current-password">
      <button id="lm-btn"  onclick="window._doLogin()">Нэвтрэх</button>
      <div  id="lm-err" class="lm-err"></div>
    </div>`;
  document.body.appendChild(m);

  // Enter → нэвтрэх
  m.querySelectorAll('input').forEach(inp => {
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') window._doLogin(); });
  });
  setTimeout(() => document.getElementById('lm-email')?.focus(), 100);
}

function _hideLoginModal() {
  document.getElementById('login-modal')?.remove();
}

window._doLogin = async function () {
  const email = document.getElementById('lm-email')?.value.trim();
  const pass  = document.getElementById('lm-pass')?.value;
  const errEl = document.getElementById('lm-err');
  const btn   = document.getElementById('lm-btn');

  if (!email || !pass) { errEl.textContent = 'Email болон нууц үг оруулна уу'; return; }

  btn.textContent = '...';
  btn.disabled = true;

  try {
    await _auth.signInWithEmailAndPassword(email, pass);
    // onAuthStateChanged дуудагдаж modal хаагдана
  } catch (e) {
    btn.textContent = 'Нэвтрэх';
    btn.disabled = false;
    errEl.textContent =
      e.code === 'auth/wrong-password' || e.code === 'auth/user-not-found' || e.code === 'auth/invalid-credential'
        ? 'Email эсвэл нууц үг буруу'
        : e.code === 'auth/invalid-email'
        ? 'Email буруу форматтай'
        : 'Алдаа: ' + e.message;
  }
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

  // ── PROFILE (SaaS: name, telegram_chat_id, system_instruction ...) ─
  async saveProfile(patch) {
    const uid = _uid();
    if (!uid) return;
    await _db.doc(`users/${uid}/meta/profile`).set(
      { ...patch, updatedAt: new Date().toISOString() },
      { merge: true }
    );
    // Telegram chat_id-г reverse lookup-д бас хадгал
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

  // ── SETTINGS (API key-үүд бүх төхөөрөмж дээр sync) ──────────────
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

  async syncDown() {
    const uid = _uid();
    if (!uid) return;
    const today = new Date().toISOString().split('T')[0];

    try {
      const [rSnap, mSnap, lSnap, bSnap, sSnap, pSnap] = await Promise.all([
        _db.doc(`users/${uid}/routines/${today}`).get(),
        _db.doc(`users/${uid}/meta/missions`).get(),
        _db.doc(`users/${uid}/logs/${today}`).get(),
        _db.doc(`users/${uid}/briefings/latest`).get(),
        _db.doc(`users/${uid}/meta/settings`).get(),
        _db.doc(`users/${uid}/meta/profile`).get(),         // ← SaaS profile
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

      // ── Settings sync: Firestore → localStorage ─────────────────
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
          if (s[field]) {
            localStorage.setItem(lsKey, s[field]);
            changed = true;
          }
        });
        // Profile хуудас дээр байвал дахин render хийнэ
        if (changed && typeof renderUser === 'function') {
          renderUser(_auth.currentUser);
        }
      }

      // ── Profile sync: custom_api_key + system_instruction → localStorage
      if (pSnap.exists) {
        const p = pSnap.data();
        // custom_api_key → jarvis_chat_key (зөвхөн localStorage хоосон үед seed хийнэ)
        if (p.custom_api_key && !localStorage.getItem('jarvis_chat_key')) {
          localStorage.setItem('jarvis_chat_key', p.custom_api_key);
        }
        // system_instruction → window + localStorage (хэзээд шинэчилнэ)
        if (p.system_instruction) {
          localStorage.setItem('jarvis_system_instruction', p.system_instruction);
          if (typeof window !== 'undefined') {
            window._jarvisSystemInstruction = p.system_instruction;
          }
        }
      }

      if (typeof syncChatFromFirestore === 'function') syncChatFromFirestore();
      DB.ready = true;

    } catch (e) {
      console.warn('[Jarvis] Firestore sync алдаа:', e.message);
    }
  }
};

// ── AUTH STATE ─────────────────────────────────────────────────────
_auth.onAuthStateChanged(user => {
  if (user) {
    _hideLoginModal();
    DB.syncDown().then(() => {
      // Notify pages that auth + sync is ready (e.g. chat.html HSK init)
      document.dispatchEvent(new Event('jarvis:ready'));
    });
  } else {
    _showLoginModal();
  }
});

window.signOut = function () { _auth.signOut(); };
