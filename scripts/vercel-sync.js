/**
 * GitHub secret → Vercel project env рүү зөв синк хийнэ.
 *
 * Хуучин bash хувилбар нь env-ийг KEY нэрээр DELETE хийхийг оролддог байсан
 * (Vercel нь env-ийн ID шаарддаг) тул аль хэдийн байгаа хувьсагчийг
 * шинэчилж чаддаггүй, алдааны мессежийг нь ч хэвлэж чаддаггүй байв.
 *
 * Энэ скрипт:
 *   1. Token хүчинтэй эсэхийг шалгана
 *   2. Төслийн нэрийг хэвлэнэ (аль төсөлтэй ажиллаж байгаа нь тодорхой болно)
 *   3. Байгаа env-үүдийг жагсааж, ID-гаар нь зөв шинэчилнэ
 *   4. Алдаа гарвал Vercel-ийн ЖИНХЭНЭ мессежийг хэвлэнэ
 *
 * Нууц утгыг хэзээ ч хэвлэхгүй — зөвхөн түлхүүрийн нэр, урт.
 */
'use strict';

const TOKEN   = process.env.VERCEL_TOKEN;
const PROJECT = process.env.VERCEL_PROJECT_ID;
const TEAM    = process.env.VERCEL_TEAM_ID || '';
const TARGETS = ['production', 'preview', 'development'];

const KEYS = [
  'TELEGRAM_BOT_TOKEN_JARVIS', 'TELEGRAM_ID', 'FIREBASE_SERVICE_ACCOUNT', 'USER_UID',
  'ACCESS_TOKEN_META', 'INSTAGRAM_BUSINESS_ID', 'FACEBOOK_PAGE_ID', 'SYSTEM_USE_TOKEN',
  'PEXELS_API_KEY', 'UNSPLASH_ACCESS_KEY', 'NOTION_TOKEN', 'NOTION_JARVIS_PAGE_ID',
  'TAVILY_KEY', 'GEMINI_API_KEY', 'TG_WEBHOOK_SECRET',
  'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_REFRESH_TOKEN', 'GOOGLE_REFRESH_TOKEN_GMAIL',
];

const q = (p) => p + (TEAM ? (p.includes('?') ? '&' : '?') + 'teamId=' + TEAM : '');

async function api(method, path, body) {
  const r = await fetch('https://api.vercel.com' + q(path), {
    method,
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try { data = await r.json(); } catch {}
  return { ok: r.ok, status: r.status, data };
}

(async () => {
  if (!TOKEN)   throw new Error('VERCEL_TOKEN байхгүй');
  if (!PROJECT) throw new Error('VERCEL_PROJECT_ID байхгүй');

  // 1. Token
  const me = await api('GET', '/v2/user');
  if (!me.ok) {
    console.error(`✗ VERCEL_TOKEN ажиллахгүй байна (HTTP ${me.status}): ${me.data?.error?.message || ''}`);
    console.error('  → Vercel дээр шинэ token үүсгээд GitHub secret-ээ шинэчил.');
    process.exit(1);
  }
  console.log(`✓ Token хүчинтэй — хэрэглэгч: ${me.data?.user?.username || me.data?.user?.email || '?'}`);

  // 2. Төсөл
  const proj = await api('GET', `/v9/projects/${PROJECT}`);
  if (!proj.ok) {
    console.error(`✗ Төсөл олдсонгүй (HTTP ${proj.status}): ${proj.data?.error?.message || ''}`);
    console.error(`  VERCEL_PROJECT_ID = ${PROJECT.slice(0, 8)}…`);
    const list = await api('GET', '/v9/projects?limit=20');
    if (list.ok) {
      console.error('  Энэ дансанд байгаа төслүүд:');
      (list.data?.projects || []).forEach(p => console.error(`    · ${p.name}  (${p.id})`));
    }
    process.exit(1);
  }
  console.log(`✓ Төсөл: ${proj.data?.name}`);
  console.log(`  ORG_ID=${proj.data?.accountId || ''}`);   // Vercel CLI-д хэрэгтэй

  // 3. Байгаа env-үүд
  const envRes = await api('GET', `/v10/projects/${PROJECT}/env?decrypt=false`);
  if (!envRes.ok) {
    console.error(`✗ env жагсаалт авч чадсангүй (HTTP ${envRes.status}): ${envRes.data?.error?.message || ''}`);
    process.exit(1);
  }
  const existing = {};
  (envRes.data?.envs || []).forEach(e => { (existing[e.key] = existing[e.key] || []).push(e); });
  console.log(`  Одоо байгаа env: ${Object.keys(existing).length} ширхэг\n`);

  // 4. Синк
  let added = 0, updated = 0, skipped = 0, failed = 0;
  for (const key of KEYS) {
    const val = process.env['S_' + key];
    if (!val) { console.log(`⚠ ${key} — GitHub secret хоосон, алгаслаа`); skipped++; continue; }

    const have = existing[key] || [];
    if (have.length) {
      // Байгаа бүртгэл бүрийг ID-гаар нь шинэчилнэ
      let allOk = true;
      for (const e of have) {
        const r = await api('PATCH', `/v9/projects/${PROJECT}/env/${e.id}`, { value: val, target: TARGETS });
        if (!r.ok) { allOk = false; console.log(`✗ ${key} шинэчлэхэд алдаа (HTTP ${r.status}): ${r.data?.error?.message || ''}`); }
      }
      if (allOk) { console.log(`↻ ${key} шинэчлэв (${val.length} тэмдэгт)`); updated++; } else failed++;
    } else {
      const r = await api('POST', `/v10/projects/${PROJECT}/env`, {
        key, value: val, type: 'encrypted', target: TARGETS,
      });
      if (r.ok) { console.log(`+ ${key} нэмэв (${val.length} тэмдэгт)`); added++; }
      else { console.log(`✗ ${key} нэмэхэд алдаа (HTTP ${r.status}): ${r.data?.error?.message || ''}`); failed++; }
    }
  }

  console.log(`\nДүн: нэмсэн ${added} · шинэчилсэн ${updated} · алгассан ${skipped} · алдаа ${failed}`);
  if (failed) process.exit(1);
})().catch(e => { console.error('Алдаа:', e.message); process.exit(1); });
