'use strict';
// ── JARVIS NOTION LOGGER ──────────────────────────────────────────
// Өдөр бүр 22:00 Шанхайд өдрийн summary Notion-д нэмдэг

const admin = require('firebase-admin');
const fetch  = require('node-fetch');

const {
  FIREBASE_SERVICE_ACCOUNT,
  USER_UID,
  NOTION_TOKEN,
  NOTION_JARVIS_PAGE_ID,
} = process.env;

if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(JSON.parse(FIREBASE_SERVICE_ACCOUNT)) });
}
const db = admin.firestore();

async function notionAppend(blocks) {
  const res = await fetch(`https://api.notion.com/v1/blocks/${NOTION_JARVIS_PAGE_ID}/children`, {
    method: 'PATCH',
    headers: {
      'Authorization':   `Bearer ${NOTION_TOKEN}`,
      'Content-Type':    'application/json',
      'Notion-Version':  '2022-06-28',
    },
    body: JSON.stringify({ children: blocks }),
  });
  return res.json();
}

function rt(text, bold = false, color = 'default') {
  return [{ type: 'text', text: { content: text }, annotations: { bold, color } }];
}

async function run() {
  const now   = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Shanghai' }));
  const today = now.toLocaleDateString('sv');
  const DAYS  = ['Ням','Даваа','Мягмар','Лхагва','Пүрэв','Баасан','Бямба'];
  const dayName = DAYS[now.getDay()];

  console.log(`[NotionLog] ${today} (${dayName}) data цуглуулж байна...`);

  // ── Firestore-с data авна ─────────────────────────────────────
  const [routineSnap, logSnap, commentSnap, pendingSnap] = await Promise.all([
    db.doc(`users/${USER_UID}/routines/${today}`).get(),
    db.doc(`users/${USER_UID}/logs/${today}`).get(),
    db.doc(`users/${USER_UID}/marketing/commentLog`).get(),
    db.doc(`users/${USER_UID}/marketing/pendingPost`).get(),
  ]);

  const routine  = routineSnap.exists ? routineSnap.data() : {};
  const log      = logSnap.exists     ? logSnap.data()     : {};
  const comments = commentSnap.exists ? (commentSnap.data()?.[today] || []) : [];
  const water    = log.water?.total_ml || 0;
  const done     = ['exercise','hanzi','read','journal'].filter(k => routine[k]).length;
  const score    = Math.min(100, Math.round(
    (water/2000*25) + (routine.exercise?20:0) +
    (routine.hanzi?20:0) + (routine.read?15:0) + (routine.journal?10:0)
  ));
  const posted   = pendingSnap.exists && pendingSnap.data().status !== 'pending' ? 1 : 0;

  // ── Маргааш хийх зүйлс ───────────────────────────────────────
  const tomorrow = [];
  if (!routine.exercise) tomorrow.push('Дасгал хийх');
  if (!routine.hanzi)    tomorrow.push('汉字 судлах');
  if (!routine.read)     tomorrow.push('Ном унших');
  if (!routine.journal)  tomorrow.push('Journal бичих');
  if (water < 2000)      tomorrow.push(`Ус ${2000 - water}мл нэмэх`);
  if (tomorrow.length === 0) tomorrow.push('Бүгдийг гүйцэтгэсэн! 🎉');

  // ── Notion blocks үүсгэнэ ────────────────────────────────────
  const emoji  = score >= 80 ? '🟢' : score >= 50 ? '🟡' : '🔴';
  const header = `${emoji} ${dayName}, ${today} — Score ${score}/100`;

  const commentLines = comments.length > 0
    ? comments.slice(0, 3).map(c => `@${c.username}: "${c.text.slice(0,60)}"`)
    : ['Шинэ comment байсангүй'];

  const blocks = [
    // Toggle хэлбэрээр нэмнэ — compact харагдана
    {
      object: 'block', type: 'toggle',
      toggle: {
        rich_text: rt(header, true),
        children: [
          // Routine
          { object: 'block', type: 'heading_3', heading_3: { rich_text: rt('📋 Routine') } },
          { object: 'block', type: 'bulleted_list_item', bulleted_list_item: { rich_text: rt(`${routine.exercise?'✅':'❌'} Дасгал   ${routine.hanzi?'✅':'❌'} 汉字   ${routine.read?'✅':'❌'} Унших   ${routine.journal?'✅':'❌'} Journal`) } },
          { object: 'block', type: 'bulleted_list_item', bulleted_list_item: { rich_text: rt(`💧 Ус: ${water}мл/2000мл`) } },

          // LFS Stats
          { object: 'block', type: 'heading_3', heading_3: { rich_text: rt('📱 LFS Stats') } },
          { object: 'block', type: 'bulleted_list_item', bulleted_list_item: { rich_text: rt(`Post нийтлэгдсэн: ~2 (өглөө + орой)`) } },
          { object: 'block', type: 'bulleted_list_item', bulleted_list_item: { rich_text: rt(`Comment хариулсан: ${comments.length}`) } },
          ...commentLines.map(line => ({
            object: 'block', type: 'bulleted_list_item',
            bulleted_list_item: { rich_text: rt(`  └ ${line}`, false, 'gray') }
          })),

          // Маргааш
          { object: 'block', type: 'heading_3', heading_3: { rich_text: rt('🎯 Маргааш') } },
          ...tomorrow.map(item => ({
            object: 'block', type: 'to_do',
            to_do: { rich_text: rt(item), checked: false }
          })),
        ]
      }
    },
  ];

  const result = await notionAppend(blocks);
  if (result.object === 'list') {
    console.log(`[NotionLog] ✅ Notion-д нэмэгдлээ: ${header}`);
  } else {
    console.error('[NotionLog] Notion алдаа:', result.message);
  }
}

run().catch(console.error);
