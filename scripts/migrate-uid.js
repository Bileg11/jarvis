/**
 * ЭРХ НЭГТГЭХ: хуучин uid-ийн датаг шинэ uid рүү хуулна.
 *
 * Билэгийн вэб апп, Telegram бот хоёр өөр бүртгэл дээр ажиллаж байсан.
 * Шинэ эрх дээр аль хэдийн байгаа бичлэгийг ДАРЖ БИЧИХГҮЙ — зөвхөн
 * байхгүйг нь нэмнэ (аюулгүй тал руу нь).
 *
 * Ажиллуулах: FROM_UID=... TO_UID=... node scripts/migrate-uid.js [--apply]
 * --apply өгөхгүй бол зөвхөн юу хуулахыг ХАРУУЛНА, юу ч өөрчлөхгүй.
 */
'use strict';
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

let FROM  = process.env.FROM_UID;
let TO    = process.env.TO_UID;
const APPLY = process.argv.includes('--apply');

/** Бүтэн uid эсвэл эхний хэдэн тэмдэгтээр нь олно — бүтэн дугаарыг
 *  хаана ч бичих шаардлагагүй болгохын тулд. */
async function resolve(db, key, label) {
  if (!key) throw new Error(label + ' шаардлагатай');
  const docs = await db.collection('users').listDocuments();
  const ids  = docs.map(d => d.id);
  if (ids.includes(key)) return key;
  const hits = ids.filter(id => id.startsWith(key));
  if (hits.length === 1) return hits[0];
  if (hits.length === 0) throw new Error(`${label}: "${key}"-аар эхэлсэн эрх олдсонгүй`);
  throw new Error(`${label}: "${key}"-аар эхэлсэн ${hits.length} эрх байна — илүү урт бич`);
}

initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) });
const db = getFirestore();

async function copyCollection(path, depth = 0) {
  const src = `users/${FROM}/${path}`;
  const dst = `users/${TO}/${path}`;
  let snap;
  try { snap = await db.collection(src).get(); } catch { return { copied: 0, skipped: 0 }; }
  let copied = 0, skipped = 0;
  for (const doc of snap.docs) {
    const target = db.doc(`${dst}/${doc.id}`);
    const existing = await target.get();
    if (existing.exists) { skipped++; }
    else {
      if (APPLY) await target.set(doc.data());
      copied++;
    }
    // Дэд цуглуулга (2 түвшин хүртэл)
    if (depth < 2) {
      for (const sub of await doc.ref.listCollections()) {
        const r = await copyCollection(`${path}/${doc.id}/${sub.id}`, depth + 1);
        copied += r.copied; skipped += r.skipped;
      }
    }
  }
  return { copied, skipped };
}

(async () => {
  FROM = await resolve(db, FROM, 'FROM_UID');
  TO   = await resolve(db, TO,   'TO_UID');
  if (FROM === TO) throw new Error('Ижил эрх — хуулах зүйл алга');
  console.log(`${APPLY ? 'ХУУЛЖ БАЙНА' : 'ЗӨВХӨН ХАРУУЛЖ БАЙНА (--apply өгөөгүй)'}`);
  console.log(`${FROM.slice(0,6)}… → ${TO.slice(0,6)}…\n`);

  const cols = await db.doc(`users/${FROM}`).listCollections();
  if (!cols.length) { console.log('Хуучин эрхэд цуглуулга алга.'); return; }

  let total = 0, kept = 0;
  for (const c of cols) {
    const r = await copyCollection(c.id);
    total += r.copied; kept += r.skipped;
    console.log(`  ${c.id.padEnd(16)} хуулах ${r.copied}  ·  шинэ эрхэд аль хэдийн байгаа ${r.skipped}`);
  }
  console.log(`\nНийт: ${total} бичлэг хуулна, ${kept}-г хөндөхгүй.`);
  if (!APPLY) console.log('Жинхэнэ хуулбарлахын тулд --apply нэм.');
})().catch(e => { console.error('Алдаа:', e.message); process.exit(1); });
