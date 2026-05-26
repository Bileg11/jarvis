'use strict';
// ── FIREBASE SINGLETON ────────────────────────────────────────────
// Хоёр database тусдаа:
//   dbPersonal  — jarvis-bileg   (Билэгийн хувийн өгөгдөл)
//   dbLFS       — lfs-shanghai   (LFS бизнесийн өгөгдөл)
//
// FIREBASE_LFS env var тавиагүй байвал dbLFS = dbPersonal (fallback)
// → LFS Firebase service account нэмэхэд л автоматаар тусгаарлагдана

const admin = require('firebase-admin');

function getOrInit(name, envKey) {
  const found = admin.apps.find(a => a.name === name);
  if (found) return found;
  const json = process.env[envKey] || process.env.FIREBASE_SERVICE_ACCOUNT;
  return admin.initializeApp(
    { credential: admin.credential.cert(JSON.parse(json)) },
    name
  );
}

// ── Хувийн JARVIS (jarvis-bileg) ──────────────────────────────────
// routines, logs, tasks, revenue, bileg/profile
const personalApp = getOrInit('personal', 'FIREBASE_SERVICE_ACCOUNT');
const dbPersonal  = personalApp.firestore();

// ── LFS бизнес (lfs-shanghai) ─────────────────────────────────────
// analytics, profiles, chatHistory, marketing, bookings
// FIREBASE_LFS тавиагүй бол jarvis-bileg-ийг ашиглана (fallback)
const lfsApp = getOrInit('lfs', 'FIREBASE_LFS');
const dbLFS  = lfsApp.firestore();

module.exports = { admin, dbPersonal, dbLFS };
