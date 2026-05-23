// ── JARVIS INTEL HUB ──────────────────────────────────────────────
// GitHub Actions (TAVILY_KEY + GITHUB_TOKEN secrets) → Firestore → Апп
// Апп тал зөвхөн "trigger token" хадгална (workflow scope л байхад хангалттай)

const INTEL_REPO     = 'Bileg11/jarvis';
const INTEL_WORKFLOW = 'intel.yml';

function _getTriggerToken() { return localStorage.getItem('jarvis_gh_trigger') || ''; }
function _getProxyUrl()     { return (localStorage.getItem('jarvis_proxy_url') || '').replace(/\/$/, ''); }

// ── FIRESTORE-ООС УНШИНА ──────────────────────────────────────────
async function loadIntelFromFirestore() {
  if (!window.DB?._db && !window._db) return null;
  const db  = window._db || window.DB?._db;
  const uid = window._uid?.() || firebase?.auth?.()?.currentUser?.uid;
  if (!uid || !db) return null;
  try {
    const snap = await db.doc(`users/${uid}/intel/latest`).get();
    if (!snap.exists) return null;
    return snap.data();
  } catch { return null; }
}

// ── GITHUB ACTIONS TRIGGER ────────────────────────────────────────
async function triggerIntelWorkflow(token) {
  const res = await fetch(
    `https://api.github.com/repos/${INTEL_REPO}/actions/workflows/${INTEL_WORKFLOW}/dispatches`,
    {
      method:  'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept':        'application/vnd.github+json',
        'Content-Type':  'application/json'
      },
      body: JSON.stringify({ ref: 'main' })
    }
  );
  return res.status === 204; // 204 = амжилтай
}

// ── FIRESTORE POLL (workflow дуустал хүлээнэ) ─────────────────────
async function pollFirestoreForIntel(maxWait = 90000) {
  const start    = Date.now();
  const today    = new Date().toISOString().split('T')[0];
  const interval = 4000;

  return new Promise(resolve => {
    const check = async () => {
      const data = await loadIntelFromFirestore();
      if (data?.date === today && data?.message) {
        resolve(data.message);
        return;
      }
      if (Date.now() - start > maxWait) {
        resolve(null);
        return;
      }
      setTimeout(check, interval);
    };
    setTimeout(check, interval);
  });
}

// ── ҮНДСЭН ФУНКЦ ──────────────────────────────────────────────────
async function fetchLiveIntel(onProgress) {

  // 1. Firestore-д өнөөдрийн intel байвал шууд буцаана (cache)
  if (onProgress) onProgress('📂 Хадгалагдсан мэдээ шалгаж байна...');
  const cached = await loadIntelFromFirestore();
  if (cached?.date === new Date().toISOString().split('T')[0] && cached?.message) {
    return cached.message + '\n\n_⏱ Кэш: ' + new Date(cached.timestamp).toLocaleTimeString('mn-MN', {hour:'2-digit',minute:'2-digit'}) + '_';
  }

  // 2. Proxy горим (Cloudflare Worker)
  const proxyUrl = _getProxyUrl();
  if (proxyUrl) {
    if (onProgress) onProgress('🔍 Proxy-гаар хайж байна...');
    try {
      const res = await fetch(`${proxyUrl}/intel`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ts: Date.now() })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.message) return data.message;
      }
    } catch {}
  }

  // 3. GitHub Actions trigger горим
  const triggerToken = _getTriggerToken();
  if (triggerToken) {
    if (onProgress) onProgress('⚡ GitHub Actions эхлүүлж байна...');
    const triggered = await triggerIntelWorkflow(triggerToken);

    if (!triggered) {
      return '❌ Workflow trigger амжилтгүй. Профайл → Trigger Token шалгана уу.';
    }

    if (onProgress) onProgress('⏳ Actions ажиллаж байна (~30с)... Firestore хүлээж байна');

    const result = await pollFirestoreForIntel(90000);
    if (result) return result;
    return '⏳ Actions дуусаагүй байна. 1 минутын дараа дахин дарна уу.';
  }

  // 4. Тохиргоо байхгүй
  return `⚙️ **Intel Hub тохируулаагүй байна.**

Профайл → **⚡ Trigger Token** оруул:
→ github.com → Settings → Developer settings
→ Personal access tokens → Fine-grained
→ Repository: jarvis → Permission: Actions = Read & Write
→ Token-г Профайл хуудсанд хадгал

*(Энэ token зөвхөн workflow эхлүүлдэг — code эсвэл secret унших эрхгүй)*`;
}
