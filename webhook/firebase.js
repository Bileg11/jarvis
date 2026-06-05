'use strict';
// ── FIREBASE SINGLETON — JARVIS (jarvis-bileg) ────────────────────
// Зөвхөн jarvis-bileg Firebase ашиглана
// tasks, routines, HSK, meta/profile, bileg/profile

const admin = require('firebase-admin');

function getOrInit(name, envKey) {
  const found = admin.apps.find(a => a.name === name);
  if (found) return found;
  const json = process.env[envKey];
  if (!json) throw new Error(`[Firebase] ${envKey} env var тохируулаагүй`);
  return admin.initializeApp(
    { credential: admin.credential.cert(JSON.parse(json)) },
    name
  );
}

// ── Хувийн JARVIS (jarvis-bileg) ──────────────────────────────────
const personalApp = getOrInit('personal', 'FIREBASE_SERVICE_ACCOUNT');
const dbPersonal  = personalApp.firestore();

module.exports = { admin, dbPersonal };
