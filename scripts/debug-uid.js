/**
 * ОНОШЛОГОО: аль хэрэглэгчийн эрхэнд HSK5-ийн дата байгааг олно.
 * Тайлан USER_UID-аар уншдаг; хөтөч өөр эрхээр нэвтэрсэн бол дата
 * өөр газар очиж, тайлан хоосон гардаг.
 */
'use strict';
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');

initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) });
const db = getFirestore();
const mask = u => u ? u.slice(0, 6) + '…' + u.slice(-4) : '(хоосон)';

(async () => {
  console.log('Тайлангийн уншдаг USER_UID:', mask(process.env.USER_UID));
  console.log('');
  const users = await db.collection('users').listDocuments();
  console.log(`users/ доор ${users.length} бичлэг:`);
  for (const u of users) {
    const snap = await db.doc(`users/${u.id}/hsk5/state`).get().catch(() => null);
    const d = snap?.exists ? snap.data() : null;
    const marks = [];
    if (d) {
      marks.push('hsk5 ✓');
      if (d.scores?.diagDone) marks.push(`онош ${Math.round((d.scores.listen||0)+(d.scores.read||0)+(d.scores.write||0))}/300`);
      if (d.srs) marks.push(`${Object.keys(d.srs).length} үг`);
      if (d.updatedAt) marks.push(new Date(d.updatedAt).toISOString().slice(0, 16));
    }
    // Өөр дата байгаа эсэх
    const other = [];
    for (const c of ['routines', 'logs', 'tasks', 'coach']) {
      const s = await db.collection(`users/${u.id}/${c}`).limit(1).get().catch(() => ({ empty: true }));
      if (!s.empty) other.push(c);
    }
    // Имэйлийг хэсэгчлэн далдална — лог руу бүтнээр бичихгүй
    let who = '?';
    try {
      const rec = await getAuth().getUser(u.id);
      const e = rec.email || '';
      who = e ? e.replace(/^(.{2}).*(@.*)$/, '$1***$2') : (rec.providerData?.[0]?.providerId || 'нууц үггүй');
    } catch { who = 'бүртгэл алга'; }
    const me = u.id === process.env.USER_UID ? '  ← USER_UID (тайлан үүнийг уншдаг)' : '';
    console.log(`  ${mask(u.id)}  ${who.padEnd(22)} ${marks.join(' · ') || 'hsk5 алга'}  [${other.join(',') || '—'}]${me}`);
  }
})().catch(e => { console.error('Алдаа:', e.message); process.exit(1); });
