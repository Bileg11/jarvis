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
const _auth = firebase.auth();

function _uid()  { return _auth.currentUser?.uid || null; }
function _uref(path) {
  const uid = _uid();
  return uid ? _db.doc(`users/${uid}/${path}`) : null;
}

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

  async syncDown() {
    const uid = _uid();
    if (!uid) return;
    const today = new Date().toISOString().split('T')[0];

    try {
      const [rSnap, mSnap, lSnap, bSnap] = await Promise.all([
        _db.doc(`users/${uid}/routines/${today}`).get(),
        _db.doc(`users/${uid}/meta/missions`).get(),
        _db.doc(`users/${uid}/logs/${today}`).get(),
        _db.doc(`users/${uid}/briefings/latest`).get(),
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

      if (typeof syncChatFromFirestore === 'function') syncChatFromFirestore();

      DB.ready = true;
      const bar = document.getElementById('sync-bar');
      if (bar) bar.style.display = 'none';

    } catch (e) {
      console.warn('[Jarvis] Firestore sync алдаа:', e.message);
    }
  }
};

// ── AUTO SIGN IN — хэрэглэгч юу ч хийхгүй ────────────────────────
_auth.onAuthStateChanged(user => {
  if (user) {
    DB.syncDown();
  } else {
    // Anonymous-аар автоматаар нэвтрүүлнэ
    _auth.signInAnonymously().catch(e => {
      console.warn('[Jarvis] Anonymous auth алдаа:', e.message);
    });
  }
});

window.signOut = function () { _auth.signOut(); };
