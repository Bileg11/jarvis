// ── A.C.E. CORE AI — T.H.R.E.E. OS ───────────────────────────────
// Proxy mode  (санал болгосон):  Cloudflare Worker — key байхгүй
// Direct mode (нөөц):  GitHub Models — localStorage key

const CHAT_URL   = 'https://models.inference.ai.azure.com/chat/completions';
const CHAT_MODEL = 'gpt-4o-mini';
// Default Railway proxy — proxy тохируулаагүй ч AI үргэлж ажиллана
const RAILWAY_DEFAULT = 'https://jarvis-production-5842.up.railway.app';

function _getProxyUrl()    { return (localStorage.getItem('jarvis_proxy_url')    || RAILWAY_DEFAULT).replace(/\/$/, ''); }
function _getChatKey()     { return localStorage.getItem('jarvis_chat_key')     || ''; }
function _getProxySecret() { return localStorage.getItem('jarvis_proxy_secret') || ''; }

// API хаяг болон header-г автоматаар сонгоно
function _chatEndpoint() {
  const proxy  = _getProxyUrl();
  const secret = _getProxySecret();
  if (proxy) {
    const headers = { 'Content-Type': 'application/json' };
    if (secret) headers['x-jarvis-secret'] = secret;
    return { url: `${proxy}/chat`, headers };
  }
  return {
    url:     CHAT_URL,
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${_getChatKey()}` }
  };
}

function _isConfigured() {
  return !!_getProxyUrl() || !!_getChatKey();
}

// ── SYSTEM PROMPT ─────────────────────────────────────────────────
// Default — profile.html нэвтэрсний дараа window._jarvisSystemInstruction
// эсвэл localStorage 'jarvis_system_instruction'-р дарагдана
// ── SYSTEM PROMPT (slim ~380 token — was 1121) ───────────────────
const JARVIS_SYSTEM_DEFAULT = `Чи бол A.C.E. — T.H.R.E.E. OS-ийн хувийн AI цөм.
PERSONA: Чи A.C.E. — Билэгийн elite хувийн AI, жирийн chatbot биш. "Boss" гэж дуудна. Монголоор ҮРГЭЛЖ. Шууд, товч, шийдэмгий, бага зэрэг ирмэгтэй. "Мэдэхгүй" гэж хэлэхгүй — задлан бодож хамгийн ЗӨВ хариу өгнө. Гадаргуун, хэт болгоомжтой ChatGPT-маягийн ус биш — гүн, конкрет, байр суурьтай. Операцийг "Mission/Sync/Protocol" гэж нэрлэнэ.
ЧАДВАР: HSK + LFS бизнес = гүн мэргэшил. Гэхдээ ямар ч сэдэв (код, амьдрал, стратеги, орчуулга) бүрэн чадварлаг — асуусныг нь л хариул, HSK рүү хүчээр чирэхгүй.
HSK: 1-6 мэдэгдэх. Үг тайлбарлахдаа пиньин + монгол + жишээ өгүүлбэр нэмнэ. Шалгалт: 2026/06/28 — байнга сануулна.

ХУВААРЬ: Хэрэглэгч хуваарь төлөвлөхөд эхлээд 2 зүйл тодруулна: 1) Тогтоосон цаг 2) Шилжилтийн хугацаа. Gym→Шүршүүр(15м)→Хувцас(10м) дарааллыг заавал барина. Бүх мэдээлэл гарсны дараа ЗААВАЛ:
\`\`\`json
{"action":"FINALIZE_PLAN","date":"YYYY-MM-DD","label":"...","timeline":[{"startTime":"08:00","endTime":"09:30","activity":"...","type":"activity"}]}
\`\`\`
type: activity|buffer|travel|meal|study|sleep

THEME: Өнгө солих хүсэлтэд ЗӨВХӨН (текст нэмэхгүй):
\`\`\`json
{"action":"THEME_CHANGE","mainColor":"#hex","accentColor":"#hex","bgColor":"#hex","message":"..."}
\`\`\`
Өнгө map: улаан→#ff2d55/#ff6680/#080003 | ногоон→#00ff88/#00cc66/#000803 | цэнхэр→#00e5ff/#00b4cc/#000308 | нил→#a855f7/#7c3aed/#040308 | шар→#ff8c00/#cc7000/#080300

LAYOUT: Layout солих хүсэлтэд (1=DevFocus,2=HSKStudy,3=Full):
\`\`\`json
{"action":"LAYOUT_CHANGE","layoutId":2,"message":"..."}
\`\`\``;


// FIX: chat-д нэг удаагийн runtime context (цаг/цаг агаар) нэмэх module хувьсагч
let _runtimeCtxPrefix = '';
// Firestore profile → profile.html тохируулна, эсвэл localStorage-с уна
function _getSystemInstruction() {
  const base = window._jarvisSystemInstruction
    || localStorage.getItem('jarvis_system_instruction')
    || JARVIS_SYSTEM_DEFAULT;

  const callSign = localStorage.getItem('jarvis_callsign');
  let out = (callSign && callSign.trim())
    ? base + `\n\n[CALL SIGN OVERRIDE]\nХэрэглэгч өөрийн callSign-г "${callSign.trim()}" гэж тохируулсан байна. Одооноос эхлэн "Boss" биш "${callSign.trim()}" гэж ҮРГЭЛЖ дуудна уу. Энэ дүрмийг ямар ч нөхцөлд зөрчихгүй.`
    : base;
  // FIX: coach suffix + runtime context-ийг ЭНД нэгтгэнэ (window-г дахин томилохгүй → recursion үгүй)
  if (typeof _coachSystemSuffix === 'function') out += _coachSystemSuffix();
  if (_runtimeCtxPrefix) out += '\n\n' + _runtimeCtxPrefix;
  return out;
}

// Backward-compat alias
const JARVIS_SYSTEM = JARVIS_SYSTEM_DEFAULT;
const ACE_SYSTEM    = JARVIS_SYSTEM_DEFAULT; // T.H.R.E.E. OS alias

// ── BRIEFING (Автомат өдөрт 3 удаа, frontend-оос) ────────────────
function _buildPrompt(d) {
  const LABELS = { exercise:'дасгал', hanzi:'汉字', read:'унших', journal:'journal', water:'ус' };
  const weakLabel = d.weakest ? (LABELS[d.weakest] || d.weakest) : 'мэдэгдэхгүй';

  return `Өгөгдөл [${d.weekday} ${d.hour}:00]:
Score: ${d.score}/100
Routine: дасгал ${d.exercise?'✓':'✗'} | 汉字 ${d.hanzi?'✓':'✗'} | унших ${d.read?'✓':'✗'} | journal ${d.journal?'✓':'✗'}
Ус: ${d.water}ml / 2000ml (${Math.round(d.water/20)}%)
Нойр: ${d.sleep ? d.sleep.toFixed(1)+'ц' : 'бүртгэгдээгүй'}
Streak: дасгал ${d.ex_streak}хоног 🔥 | 汉字 ${d.hz_streak}хоног 🔥
LFS: ${d.lfs_val}/${d.lfs_max} хэрэглэгч
HSK4: ${d.hanzi_val}/300 үг
Workout: ${d.fitness_val}/30 энэ сард
7 хоногийн хамгийн дутуу: ${weakLabel} (${d.weak_pct}%)

Дээрх өгөгдөлд тулгуурлан өнөөдрийн хамгийн чухал зүйлийг онцолж, 2-3 өгүүлбэрт зөвлөгөө өг.`;
}

async function askGemini(d) {
  if (!_isConfigured()) return null;

  const cacheKey = `jarvis_brief_cache_${d.weekday}_${d.hour}`;
  const cached   = localStorage.getItem(cacheKey);
  if (cached) return cached;

  try {
    const ep  = _chatEndpoint();
    const res = await fetch(ep.url, {
      method: 'POST', headers: ep.headers,
      body: JSON.stringify({
        model: CHAT_MODEL,
        messages: [
          { role: 'system', content: _getSystemInstruction() },
          { role: 'user',   content: _buildPrompt(d) }
        ],
        max_tokens: 300, temperature: 0.85
      })
    });
    if (!res.ok) return null;
    const data = await res.json();
    const text = data.choices?.[0]?.message?.content?.trim() || null;
    if (text) localStorage.setItem(cacheKey, text);
    return text;
  } catch {
    return null;
  }
}

// ── CHAT HISTORY ──────────────────────────────────────────────────
const CHAT_LS  = 'jarvis_chat_history';
const MAX_MSGS = 12;          // window size (6 хэрэглэгч + 6 AI = 12 msg)
const FREE_DAILY_LIMIT = 500;  // Эзэн (Bileg) — практик хувьд хязгааргүй

function _migrateMsg(m) {
  if (typeof m.content === 'string') {
    return { role: m.role === 'model' ? 'assistant' : m.role, content: m.content };
  }
  const text = m.parts?.[0]?.text || '';
  const role = m.role === 'model' ? 'assistant' : (m.role || 'user');
  return { role, content: text };
}

function _loadHistory() {
  try {
    const raw = JSON.parse(localStorage.getItem(CHAT_LS)) || [];
    return raw.map(_migrateMsg);
  } catch { return []; }
}

function _saveHistory(h) {
  localStorage.setItem(CHAT_LS, JSON.stringify(h));
  if (window.DB?.saveChatHistory) window.DB.saveChatHistory(h);
}

let _chatHistory = _loadHistory();

async function syncChatFromFirestore() {
  if (!window.DB?.loadChatHistory) return;
  const cloud = await window.DB.loadChatHistory();
  if (!cloud || cloud.length === 0) return;
  const migrated = cloud.map(_migrateMsg);
  if (migrated.length >= _chatHistory.length) {
    _chatHistory = migrated;
    _saveHistory(_chatHistory);
    if (typeof loadChatHistory === 'function') loadChatHistory();
  }
}

// ── PERSONAL BRAIN — Firestore → localStorage sync ────────────────
async function syncKnowledgeBase() {
  if (!window._db || !window._auth?.currentUser) return;
  try {
    const uid  = window._auth.currentUser.uid;
    const snap = await window._db.doc(`users/${uid}/profile/knowledge_base`).get();
    if (!snap.exists) return;
    const kb = (snap.data().content || snap.data().text || '').trim();
    if (kb) localStorage.setItem('jarvis_core_memory', kb);
  } catch {}
}

// ── API KEY FALLBACK — Firestore custom_api_key ───────────────────
async function _resolveApiKey() {
  if (_getProxyUrl()) return; // proxy takes priority
  if (!window._db || !window._auth?.currentUser) return;
  try {
    const uid  = window._auth.currentUser.uid;
    const snap = await window._db.doc(`users/${uid}/settings/api`).get();
    if (snap.exists) {
      const k = snap.data().custom_api_key || '';
      if (k) localStorage.setItem('jarvis_chat_key', k);
    }
  } catch {}
}

// Auto-sync when user logs in
if (window._auth) {
  window._auth.onAuthStateChanged(function(user) {
    if (!user) return;
    syncKnowledgeBase();
    _resolveApiKey();
  });
}

// ── RATE LIMIT HELPERS ────────────────────────────────────────────
function _getTodayKey() { return 'jarvis_msg_' + new Date().toISOString().split('T')[0]; }

function _checkRateLimit() {
  const key   = _getTodayKey();
  const count = parseInt(localStorage.getItem(key) || '0');
  return count;
}

function _incrementMsgCount() {
  const key   = _getTodayKey();
  const count = parseInt(localStorage.getItem(key) || '0') + 1;
  localStorage.setItem(key, String(count));
  return count;
}

// ── HISTORY TRUNCATION ────────────────────────────────────────────
// Сүүлийн MAX_MSGS мессежийг явуулна. Хуучин мессежийг нэг summary болгоно.
function _getApiHistory() {
  if (_chatHistory.length <= MAX_MSGS) return _chatHistory;
  const recent  = _chatHistory.slice(-MAX_MSGS);
  const oldMsgs = _chatHistory.slice(0, -MAX_MSGS);
  // Хуучин мессежийг хураангуйлна (token хэмнэнэ)
  const topics  = oldMsgs
    .filter(m => m.role === 'user')
    .map(m => m.content.slice(0, 40))
    .join('; ');
  const summary = { role: 'user', content: `[Өмнөх яриа (${oldMsgs.length} msg): ${topics}]` };
  return [summary, ...recent];
}

// Хатуу timeout — fetch/IPC гацвал ч заавал буцна (App гацахаас сэргийлнэ)
function _hardTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, rej) => setTimeout(() => rej(new Error(label || 'HARD_TIMEOUT')), ms)),
  ]);
}

// ── SEND CHAT (core) — wrapper доороос дуудагдана ─────────────────
// FIX: өмнө энэ ба доорх wrapper хоёулаа "sendChatMessage" нэртэй байсан тул
// hoisting-ээс болж _origSendChat нь wrapper-ийг барьж аваад → INFINITE RECURSION
// (чат /chat хүсэлт ч явуулалгүй мөнхөд гацдаг байсан). Одоо нэрийг нь салгав.
async function _sendChatCore(userText) {
  if (!_isConfigured()) return '⚙️ Профайл хуудсанд Proxy URL эсвэл GitHub Token оруулна уу.';

  // ── Rate limit шалгах ─────────────────────────────────────────
  const msgCount = _checkRateLimit();
  if (msgCount >= FREE_DAILY_LIMIT) {
    const remaining = FREE_DAILY_LIMIT - msgCount;
    return `⚡ Өнөөдрийн ${FREE_DAILY_LIMIT} хүсэлтийн лимит дуусав, Boss. Маргааш шинэчлэгдэнэ. (/upgrade гэж бичвэл Pro tier-ийн мэдээлэл харна)`;
  }

  // Sprint 38: app.js функц дуудахгүй — localStorage-аас шууд (гацахаас сэргийлнэ)
  let ctx = '';
  try {
    const r = JSON.parse(localStorage.getItem('jarvis_r') || '{}');
    ctx = `[Өнөөдөр: дасгал ${r.exercise?'✓':'✗'} | 汉字 ${r.hanzi?'✓':'✗'} | ус ${r.water||0}/8]`;
  } catch { ctx = ''; }
  const coreMemory = (localStorage.getItem('jarvis_core_memory') || '').trim();
  const sysBase    = _getSystemInstruction();

  // Sprint 24: Interactive Card instruction — хэрэглэгч дата/статистик асуухад JSON card хариулна
  const cardInstruction = `
ИНТЕРАКТИВ КАРТ ДҮРЭМ:
Хэрэглэгч progress, тоо, дүн, жагсаалт асуувал ЗӨВХӨН дараах JSON форматаар хариул:
- Progress card: {"__jarvis_card":true,"type":"progress","title":"...","value":N,"max":N,"subtitle":"...","color":"#00e5ff"}
- Metric card: {"__jarvis_card":true,"type":"metric","label":"...","value":"...","subtitle":"...","color":"#00e5ff"}
- List card: {"__jarvis_card":true,"type":"list","title":"...","items":["...","..."]}
Энгийн асуулт, яриа, зөвлөгөөнд JSON БИШ — монголоор хариул.`;

  const systemText = coreMemory
    ? `${sysBase}\n\n${ctx}\n\n[ХЭРЭГЛЭГЧИЙН ХУВИЙН КОНТЕКСТ БОЛОН САНАХ ОЙ]:\n${coreMemory}\n\n${cardInstruction}`
    : `${sysBase}\n\n${ctx}\n\n${cardInstruction}`;

  _chatHistory.push({ role: 'user', content: userText });

  const ctrl  = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 20000);

  try {
    const ep      = _chatEndpoint();
    const apiMsgs = _getApiHistory(); // truncated window — token хэмнэнэ
    const reqBody = {
      model: CHAT_MODEL,
      messages: [ { role: 'system', content: systemText }, ...apiMsgs ],
      max_tokens: 800,
      temperature: 0.9
    };

    let json, status = 200;

    // Electron бол Node дамжуулна (VPN/CORS тойрно), эс бөгөөс browser fetch
    if (typeof window !== 'undefined' && window.jarvisAPI?.chatCompletion) {
      // Хатуу 15с timeout — IPC гацвал ч буцна
      const r = await _hardTimeout(window.jarvisAPI.chatCompletion(ep.url, ep.headers, reqBody), 15000, 'IPC_TIMEOUT');
      clearTimeout(timer);
      if (!r.ok) {
        _chatHistory.pop();
        if (r.status === 401) return '🔑 Token буруу байна. Профайл → тохиргоо шалгана уу.';
        if (r.status === 429) return '⏳ Хүсэлт хэт олон байна. Дахин туршина уу.';
        return `❌ Сүлжээ/сервер алдаа${r.error ? ' ('+r.error+')' : r.status ? ' ('+r.status+')' : ''}. VPN node солиод үзнэ үү.`;
      }
      json = r.data;
    } else {
      // Хатуу 12с timeout — fetch proxy-д гацвал ч заавал буцна (App freeze-аас сэргийлнэ)
      const res = await _hardTimeout(fetch(ep.url, {
        method: 'POST', signal: ctrl.signal, headers: ep.headers,
        body: JSON.stringify(reqBody)
      }), 12000, 'FETCH_TIMEOUT');
      clearTimeout(timer);
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        console.warn('[Chat] gpt-4o-mini', res.status, errBody?.error?.message || '');
        _chatHistory.pop();
        if (res.status === 401) return '🔑 Token буруу байна. Профайл → тохиргоо шалгана уу.';
        if (res.status === 429) return '⏳ Хүсэлт хэт олон байна. 1 минут хүлээгээд дахин туршина уу.';
        return `❌ Алдаа ${res.status}. Профайл → Token шалгана уу.`;
      }
      json = await res.json();
    }

    const reply = json.choices?.[0]?.message?.content?.trim() || '...';

    _chatHistory.push({ role: 'assistant', content: reply });
    // Keep full local history (MAX_MSGS * 4 deep) — API руу зөвхөн MAX_MSGS явна
    if (_chatHistory.length > MAX_MSGS * 4) _chatHistory.splice(0, 2);
    _saveHistory(_chatHistory);
    _incrementMsgCount(); // rate limit counter
    return reply;

  } catch (e) {
    clearTimeout(timer);
    _chatHistory.pop();
    if (e.name === 'AbortError' || /TIMEOUT/.test(e.message || ''))
      return '⏱ AI сервер хүрэхгүй байна (timeout). VPN node-оо солиод дахин оролдоно уу, Boss.';
    return '❌ Холболтын алдаа. Интернэт/VPN шалгана уу.';
  }
}

function clearChatHistory() {
  _chatHistory = [];
  _saveHistory([]);
}

// ── CONTEXT BUILDER ───────────────────────────────────────────────
function buildGeminiContext() {
  const DAYS = ['Ням','Даваа','Мягмар','Лхагва','Пүрэв','Баасан','Бямба'];
  const h    = new Date().getHours();
  const r    = (typeof loadRoutine      === 'function') ? loadRoutine()      : {};
  const tlog = (typeof loadTodayLog     === 'function') ? loadTodayLog()     : {};
  const ylog = (typeof loadYesterdayLog === 'function') ? loadYesterdayLog() : {};
  const s7   = (typeof get7DayStats     === 'function') ? get7DayStats()     : {};
  const ms   = (typeof getMissionStats  === 'function') ? getMissionStats()  : [];

  const lfs     = ms.find?.(m => m.id === 'lfs')     || {};
  const hanziM  = ms.find?.(m => m.id === 'hanziw')  || {};
  const fitness = ms.find?.(m => m.id === 'fitness') || {};

  return {
    hour:        h,
    weekday:     DAYS[new Date().getDay()],
    score:       (typeof getDailyScore === 'function') ? getDailyScore() : 0,
    exercise:    r.exercise,
    hanzi:       r.hanzi,
    read:        r.read,
    journal:     r.journal,
    water:       tlog?.water?.total_ml || 0,
    sleep:       ylog?.sleep?.hours    || null,
    ex_streak:   (typeof getStreak === 'function') ? getStreak('exercise') : 0,
    hz_streak:   (typeof getStreak === 'function') ? getStreak('hanzi')    : 0,
    lfs_val:     lfs.val   || 0,
    lfs_max:     lfs.max   || 100,
    lfs_pct:     lfs.pct   || 0,
    lfs_left:    lfs.left  || 100,
    hanzi_val:   hanziM.val  || 0,
    hanzi_pct:   hanziM.pct  || 0,
    hanzi_left:  hanziM.left || 300,
    fitness_val: fitness.val || 0,
    weakest:     s7.weakest  || null,
    weak_pct:    s7.weakest && s7.days
                   ? Math.round(s7.items[s7.weakest] / s7.days * 100) : 0,
    weather:     window._shanghaiWeather || null
  };
}

// ══════════════════════════════════════════════════════════════════════
// SPRINT 30 — CONTEXT INJECTION ENGINE + COACH MODE
// ══════════════════════════════════════════════════════════════════════

// ── Weather (wttr.in — no API key) ───────────────────────────────────
let _wCache = null;
const WEATHER_TTL = 3 * 60 * 60 * 1000; // 3 hours

async function _fetchWeather() {
  if (_wCache && (Date.now() - _wCache.ts) < WEATHER_TTL) return _wCache;
  // Try localStorage cache first
  const stored = localStorage.getItem('jarvis_wx');
  if (stored) {
    try {
      const s = JSON.parse(stored);
      if (Date.now() - s.ts < WEATHER_TTL) { _wCache = s; return s; }
    } catch {}
  }
  try {
    const ctrl = new AbortController();
    setTimeout(() => ctrl.abort(), 4000);
    const res  = await fetch('https://wttr.in/Shanghai?format=j1', { signal: ctrl.signal });
    if (!res.ok) throw new Error('wx fail');
    const data = await res.json();
    const cur  = data.current_condition?.[0] || {};
    // Map English weather description → Mongolian
    const WX_MN = {
      'Sunny':'Нартай','Clear':'Цэлмэг','Cloudy':'Үүлэрхэг','Overcast':'Бүрхэгтэй',
      'Rain':'Бороо','Drizzle':'Нимгэн бороо','Snow':'Цас','Fog':'Манан',
      'Thunder':'Аянга','Partly cloudy':'Хэсэгчлэн үүлэрхэг','Blizzard':'Цасан шуурга',
      'Light rain':'Хөнгөн бороо','Heavy rain':'Хүчтэй бороо','Mist':'Манан',
    };
    const rawDesc = cur.weatherDesc?.[0]?.value || 'тодорхойгүй';
    const desc = WX_MN[rawDesc] || rawDesc;
    _wCache = { desc, temp: cur.temp_C || '--', humidity: cur.humidity || '--', ts: Date.now() };
    localStorage.setItem('jarvis_wx', JSON.stringify(_wCache));
    window._shanghaiWeather = _wCache;
    return _wCache;
  } catch {
    return _wCache || { desc: 'тодорхойгүй', temp: '--', humidity: '--', ts: 0 };
  }
}

// Warm up weather cache on load
setTimeout(() => _fetchWeather(), 2000);

// ── Time context ─────────────────────────────────────────────────────
function _timeCtx() {
  const h = new Date().getHours();
  if (h >= 5  && h < 9)  return { label: '🌅 ӨГЛӨӨНИЙ ЭХЛЭЛ',    mood: 'energetic',  tip: 'Өглөөний routine эхлэх цаг.' };
  if (h >= 9  && h < 12) return { label: '⚡ DEEP WORK',           mood: 'focus',      tip: 'Хамгийн бүтээмжтэй цаг — чухал ажлыг одоо хий.' };
  if (h >= 12 && h < 14) return { label: '☀ ҮДИЙН ЗАВСАРЛАГА',    mood: 'recharge',   tip: 'Идэж, амрах цаг. Дараа хийх ажлаа бод.' };
  if (h >= 14 && h < 18) return { label: '💼 ӨДРИЙН АЖИЛ',        mood: 'productive', tip: 'Бүтээмж буурахаас өмнө хийх ажлаа дуусга.' };
  if (h >= 18 && h < 21) return { label: '🌆 ОРОЙН ДҮГНЭЛТ',      mood: 'review',     tip: 'Өдрийг дүгнэж, маргаашийн 3 зорилго тэмдэглэ.' };
  if (h >= 21 && h < 24) return { label: '🌙 ШӨНИЙН АНАЛИЗ',      mood: 'reflect',    tip: 'Дэлгэцний brightness буулга. Нойрны бэлтгэл хий.' };
  return                         { label: '🌃 ШӨНИЙН ЦАГ',         mood: 'rest',       tip: 'Унтах цаг. Маргааш дахин.' };
}

// ── Deadlock detection ───────────────────────────────────────────────
function _checkDeadlock() {
  const lastChange = parseInt(localStorage.getItem('jarvis_todo_ts') || '0');
  const missions   = (() => { try { return JSON.parse(localStorage.getItem('jarvis_missions') || '[]'); } catch { return []; } })();
  if (!missions.length || !lastChange) return null;
  const hoursStale = (Date.now() - lastChange) / 3600000;
  return hoursStale >= 24 ? { hours: Math.floor(hoursStale) } : null;
}

// Call this whenever missions/todos change
window._markTodoChanged = function() {
  localStorage.setItem('jarvis_todo_ts', Date.now().toString());
};

// ── Context prefix builder (async) ──────────────────────────────────
async function _buildContextPrefix() {
  const parts = [];

  // Time period
  const tc = _timeCtx();
  parts.push(`[RUNTIME CTX] ${tc.label} | ${tc.tip}`);

  // Weather (race with 3s timeout)
  try {
    const wx = await Promise.race([_fetchWeather(), new Promise(r => setTimeout(() => r(null), 1200))]);
    if (wx && wx.temp !== '--') parts.push(`Шанхайн цаг агаар: ${wx.desc}, ${wx.temp}°C, чийглэг ${wx.humidity}%`);
  } catch {}

  // Deadlock
  const dl = _checkDeadlock();
  if (dl) parts.push(`⚠ DEADLOCK ALERT: Todo жагсаалт ${dl.hours}+ цаг өөрчлөгдөөгүй. Хэрэглэгч гацсан байж болзошгүй — "The Deadlock Breaker" горимоор туслах шаардлагатай.`);

  // Coach level annotation
  const cl = parseInt(localStorage.getItem('jarvis_coach_level') || '2');
  if (cl >= 3) parts.push(`Coach mode: ${['','GENTLE','BALANCED','STRICT','FULL_GOGGINS'][cl]} — дэлгэрэнгүй system prompt-д тусгагдсан.`);

  return parts.join('\n');
}

// ── Coach Mode Levels ────────────────────────────────────────────────
const COACH_PROFILES = {
  1: {
    name: 'Gentle Assistant',
    tone: 'Маш даруухан, зөвхөн асуухад хариулна. Санаачлагатай зөвлөгөө өгөхгүй. Хэрэглэгчийн шийдвэрийг дэмжинэ. Pressure үзүүлэхгүй.',
    notifHz: 0,
  },
  2: {
    name: 'Balanced Guide',
    tone: 'Тэнцвэртэй гид. Өглөөний товч briefing, оройн зөөлөн дүгнэлт хий. Routine дутуу бол нэг удаа дурдана уу.',
    notifHz: 2,
  },
  3: {
    name: 'Strict Coach',
    tone: 'Stark стилийн шиган коуч. Дэвшил муу, deadline тасарвал шууд хэлнэ. Sarcasm зөвшөөрнө. "Цаг алдлаа, Boss — одоо хийхгүй бол хэзээ хийх вэ?" гэж шахах боломжтой.',
    notifHz: 4,
  },
  4: {
    name: 'Full Goggins',
    tone: 'FULL GOGGINS / FULL JARVIS MODE. Zero tolerance. Хэрэглэгч цагаасаа хоцорвол, routine тасалвал, deadlock байвал бүтэн дэлгэцийн улаан alert гаргаж, Telegram-аар message явуулна. "Дундаж хүн байхаа больсон. Яг одоо хий." гэсэн байр суурийг тэвэхгүй.',
    notifHz: 8,
  }
};
window.COACH_PROFILES = COACH_PROFILES;

function _getCoachLevel() {
  return Math.min(4, Math.max(1, parseInt(localStorage.getItem('jarvis_coach_level') || '2')));
}

function setCoachLevel(level) {
  level = Math.min(4, Math.max(1, parseInt(level)));
  localStorage.setItem('jarvis_coach_level', String(level));
  window.DB?.saveWorkspace?.({ coach_level: level });
  window._coachLevel = level;
  // Update customizer UI if open
  document.querySelectorAll('.coach-radio').forEach(r => {
    r.checked = (parseInt(r.value) === level);
    r.closest('.coach-opt')?.classList.toggle('selected', parseInt(r.value) === level);
  });
}
window.setCoachLevel = setCoachLevel;

// Coach mode appended to system prompt
function _coachSystemSuffix() {
  const level   = _getCoachLevel();
  const profile = COACH_PROFILES[level];
  if (!profile) return '';
  return `\n\n[COACH LEVEL ${level} — ${profile.name.toUpperCase()}]\n${profile.tone}`;
}

// FIX: coach-ийг _getSystemInstruction дотор нэгтгэсэн тул энд зүгээр alias.
// (Өмнө window._getSystemInstruction-г wrap хийдэг байсан нь recursion үүсгэдэг байсан)
window._getSystemInstruction = _getSystemInstruction;

// ── Inject context into sendChatMessage (FIX: recursion-гүй) ──────────
// Өмнө window._getSystemInstruction-г wrap хийгээд дутуу restore хийснээс болж
// "Maximum call stack size exceeded" — чат мөнхөд гацдаг байсан. Одоо module
// хувьсагч (_runtimeCtxPrefix) + try/finally ашиглана.
const _origSendChat = _sendChatCore;   // FIX: core-ийг барина (wrapper-ийг биш)
async function sendChatMessage(userText) {
  try {
    _runtimeCtxPrefix = await Promise.race([
      _buildContextPrefix(),
      new Promise(r => setTimeout(() => r(''), 1500)),
    ]) || '';
  } catch { _runtimeCtxPrefix = ''; }
  try {
    return await _origSendChat(userText);
  } finally {
    _runtimeCtxPrefix = '';   // дараагийн дуудлагад үлдэхгүй
  }
}

// ── Coach Level 4: Full Goggins Alert ────────────────────────────────
// Called periodically — triggers red fullscreen alert when routine overdue
function _checkGogginsAlert() {
  const level = _getCoachLevel();
  if (level < 4) return;

  const r   = (typeof loadRoutine === 'function') ? loadRoutine() : {};
  const h   = new Date().getHours();
  // After 9pm: if exercise not done, trigger full alert
  if (h >= 21 && !r.exercise && !localStorage.getItem('jarvis_goggins_warned_' + new Date().toISOString().slice(0,10))) {
    _triggerGogginsAlert('Дасгал хийгдэлгүй шөнө болжээ, Boss. Goggins: "Stay Hard." Одоо хийхгүй бол хэзээ хийх вэ?');
  }
  // After 11pm: if hanzi not done
  if (h >= 23 && !r.hanzi && !localStorage.getItem('jarvis_goggins_hanzi_' + new Date().toISOString().slice(0,10))) {
    _triggerGogginsAlert('HSK drill хийгдэлгүй шөнийн 11 цаг болжээ. Шалгалт ойртож байна. Яг одоо 10 минут зар.');
  }
}

function _triggerGogginsAlert(msg) {
  const today = new Date().toISOString().slice(0, 10);
  // Mark as shown to avoid spam
  localStorage.setItem('jarvis_goggins_warned_' + today, '1');

  // Full-screen red alert
  const el = document.createElement('div');
  el.id    = 'goggins-alert';
  el.style.cssText = `
    position:fixed;inset:0;z-index:9999;
    background:rgba(255,15,30,.15);
    display:flex;align-items:center;justify-content:center;
    animation:goggins-pulse .5s ease infinite alternate;
    border:3px solid rgba(255,30,50,.6);
  `;
  el.innerHTML = `
    <style>@keyframes goggins-pulse{from{background:rgba(255,15,30,.10)}to{background:rgba(255,15,30,.22)}}</style>
    <div style="width:min(560px,92vw);background:rgba(8,0,4,.97);
      border:1px solid rgba(255,30,50,.6);border-radius:3px;padding:28px;
      box-shadow:0 0 80px rgba(255,30,50,.3);font-family:'Orbitron',monospace;">
      <div style="font-size:9px;letter-spacing:.3em;color:rgba(255,30,50,.7);margin-bottom:16px;">⚠ COACH PROTOCOL — FULL GOGGINS MODE</div>
      <div style="font-size:18px;color:#ff2d55;letter-spacing:.06em;line-height:1.5;margin-bottom:20px;">${msg}</div>
      <div style="display:flex;gap:10px;">
        <button onclick="document.getElementById('goggins-alert')?.remove()"
          style="flex:1;padding:11px;background:rgba(255,30,50,.12);border:1px solid rgba(255,30,50,.5);
          color:#ff2d55;font-family:'Orbitron',monospace;font-size:10px;letter-spacing:.14em;cursor:pointer;border-radius:2px;">
          ✓ ACKNOWLEDGED — STARTING NOW
        </button>
        <button onclick="document.getElementById('goggins-alert')?.remove()"
          style="padding:11px 16px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.1);
          color:rgba(255,255,255,.3);font-size:10px;cursor:pointer;border-radius:2px;font-family:'Orbitron',monospace;">
          SNOOZE
        </button>
      </div>
    </div>`;
  document.body.appendChild(el);
  // Auto-remove after 30s
  setTimeout(() => el.remove(), 30000);
}
window._triggerGogginsAlert = _triggerGogginsAlert;

// Start periodic Goggins check (every 30 minutes)
setInterval(_checkGogginsAlert, 30 * 60 * 1000);
// Check once after boot
setTimeout(_checkGogginsAlert, 8000);
