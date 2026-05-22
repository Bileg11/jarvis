// ══════════════════════════════════════════════════════════════
//  FIREBASE SETUP ЗААВАР
//  1. console.firebase.google.com → New Project → "jarvis-bileg"
//  2. Project Settings → Your apps → </> Web → Register app
//  3. Config object-ийн утгуудыг доор буулга
//  4. Build → Firestore Database → Create → Production mode
//     → Region: asia-east1 (Taiwan, Шанхайд ойр)
//  5. Build → Authentication → Sign-in method → Google → Enable
//  6. Firestore → Rules → дараах rule-г paste хий:
//
//     rules_version = '2';
//     service cloud.firestore {
//       match /databases/{database}/documents {
//         match /users/{userId}/{document=**} {
//           allow read, write: if request.auth != null
//                              && request.auth.uid == userId;
//         }
//       }
//     }
// ══════════════════════════════════════════════════════════════

const FIREBASE_CONFIG = {
  apiKey:            "AIzaSyA0AwSRMmKQsRfLoY9CreGKrm3CXn0FHTc",
  authDomain:        "jarvis-bileg.firebaseapp.com",
  projectId:         "jarvis-bileg",
  storageBucket:     "jarvis-bileg.firebasestorage.app",
  messagingSenderId: "59304492638",
  appId:             "1:59304492638:web:9da4e7ceac790d1254becf"
};

// ── CONFIG БӨГЛӨӨГҮЙ БОЛ SKIP ─────────────────────────────────
if (FIREBASE_CONFIG.apiKey === "PASTE_HERE") {
  console.log('[Jarvis] Firebase config бөглөөгүй — localStorage горимд ажиллана.');
  window.DB = null;
} else {
  _initFirebase();
}

function _initFirebase() {
  firebase.initializeApp(FIREBASE_CONFIG);

  const _db   = firebase.firestore();
  const _auth = firebase.auth();

  function _uid()  { return _auth.currentUser?.uid || null; }
  function _uref(path) {
    const uid = _uid();
    return uid ? _db.doc(`users/${uid}/${path}`) : null;
  }

  // ── SYNC INDICATOR ───────────────────────────────────────────
  function setSyncState(state) {
    // state: 'off' | 'ok' | 'err'
    const bar = document.getElementById('sync-bar');
    if (!bar) return;
    if (state === 'ok')  { bar.style.display = 'none'; return; }
    bar.style.display = 'flex';
    if (state === 'off') {
      bar.innerHTML = `<span>☁️ Cloud sync идэвхгүй —</span>
        <button onclick="signInGoogle()">Google-аар нэвтрэх</button>`;
    }
    if (state === 'err') {
      bar.innerHTML = `<span>⚠️ Firestore холболт алдаатай</span>`;
    }
  }

  // ── DB OBJECT ────────────────────────────────────────────────
  window.DB = {
    ready: false,

    // Fire-and-forget writes — localStorage аль хэдийн update болсон
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

    // Pull Firestore → localStorage → re-render UI
    async syncDown() {
      const uid = _uid();
      if (!uid) return;
      const today = new Date().toISOString().split('T')[0];

      try {
        // Routine
        const rSnap = await _db.doc(`users/${uid}/routines/${today}`).get();
        if (rSnap.exists) {
          const data = { ...rSnap.data(), date: today };
          localStorage.setItem('jarvis_r', JSON.stringify(data));
          localStorage.setItem('jarvis_r_' + today, JSON.stringify(data));
          if (typeof renderRoutine  === 'function') renderRoutine();
          if (typeof renderScore    === 'function') renderScore();
          if (typeof renderStreaks  === 'function') renderStreaks();
        }

        // Missions
        const mSnap = await _db.doc(`users/${uid}/meta/missions`).get();
        if (mSnap.exists && mSnap.data()?.list) {
          localStorage.setItem('jarvis_missions', JSON.stringify(mSnap.data().list));
          if (typeof renderMissions === 'function') renderMissions();
        }

        // Today log
        const lSnap = await _db.doc(`users/${uid}/logs/${today}`).get();
        if (lSnap.exists) {
          localStorage.setItem('jarvis_log_' + today, JSON.stringify(lSnap.data()));
          if (typeof renderFromLog  === 'function') renderFromLog(lSnap.data());
        }

        // Load pre-computed AI briefing from GitHub Actions
        const bSnap = await _db.doc(`users/${uid}/briefings/latest`).get();
        if (bSnap.exists) {
          const { message, timestamp } = bSnap.data();
          const ageHours = (Date.now() - new Date(timestamp)) / 3600000;
          if (ageHours < 7 && message && typeof typeJarvis === 'function') {
            setTimeout(() => typeJarvis(message), 800);
          }
        }

        setSyncState('ok');
        DB.ready = true;

      } catch (e) {
        console.warn('[Jarvis] Firestore sync алдаа:', e.message);
        setSyncState('err');
      }
    }
  };

  // ── AUTH STATE ───────────────────────────────────────────────
  _auth.onAuthStateChanged(user => {
    if (user) {
      setSyncState('ok');
      DB.syncDown();
    } else {
      setSyncState('off');
    }
  });

  window.signInGoogle = function () {
    const provider = new firebase.auth.GoogleAuthProvider();
    _auth.signInWithPopup(provider).catch(e => {
      console.warn('[Jarvis] Google sign-in алдаа:', e.message);
    });
  };

  window.signOut = function () {
    _auth.signOut();
    setSyncState('off');
  };
}
