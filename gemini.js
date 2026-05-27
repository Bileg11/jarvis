// ── JARVIS AI ─────────────────────────────────────────────────────
// Proxy mode  (санал болгосон):  Cloudflare Worker — key байхгүй
// Direct mode (нөөц):  GitHub Models — localStorage key

const CHAT_URL   = 'https://models.inference.ai.azure.com/chat/completions';
const CHAT_MODEL = 'gpt-4o-mini';

// Proxy URL — зөвхөн URL, secret биш → localStorage-д хадгалж болно
function _getProxyUrl()  { return (localStorage.getItem('jarvis_proxy_url') || '').replace(/\/$/, ''); }
function _getChatKey()   { return localStorage.getItem('jarvis_chat_key')   || ''; }

// API хаяг болон header-г автоматаар сонгоно
function _chatEndpoint() {
  const proxy = _getProxyUrl();
  if (proxy) return { url: `${proxy}/chat`, headers: { 'Content-Type': 'application/json' } };
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
const JARVIS_SYSTEM_DEFAULT = `Та Билэгийн хувийн AI туслах юм. Билэг бол 18 настай Монгол залуу, Шанхайд амьдардаг. Түүний зорилго: фитнесс, LFS Shanghai бизнес, HSK4 хятад хэлний шалгалт.

Монгол хэлээр байнга хариулна уу. Асуултад бүрэн, байгалийн байдлаар хариулна уу.`;

// Firestore profile → profile.html тохируулна, эсвэл localStorage-с уна
function _getSystemInstruction() {
  return window._jarvisSystemInstruction
    || localStorage.getItem('jarvis_system_instruction')
    || JARVIS_SYSTEM_DEFAULT;
}

// Backward-compat alias
const JARVIS_SYSTEM = JARVIS_SYSTEM_DEFAULT;

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
const MAX_MSGS = 40;

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

// ── SEND CHAT ─────────────────────────────────────────────────────
async function sendChatMessage(userText) {
  if (!_isConfigured()) return '⚙️ Профайл хуудсанд Proxy URL эсвэл GitHub Token оруулна уу.';

  const r     = (typeof loadRoutine   === 'function') ? loadRoutine()   : {};
  const tlog  = (typeof loadTodayLog  === 'function') ? loadTodayLog()  : {};
  const score = (typeof getDailyScore === 'function') ? getDailyScore() : 0;
  const water = tlog?.water?.total_ml || 0;

  const ctx        = `[Өнөөдрийн байдал: Score ${score}/100 | Ус ${water}ml | дасгал ${r.exercise?'✓':'✗'} | 汉字 ${r.hanzi?'✓':'✗'}]`;
  const coreMemory = (localStorage.getItem('jarvis_core_memory') || '').trim();
  const sysBase    = _getSystemInstruction();
  const systemText = coreMemory
    ? `${sysBase}\n\n${ctx}\n\n[ХЭРЭГЛЭГЧИЙН ХУВИЙН КОНТЕКСТ БОЛОН САНАХ ОЙ]:\n${coreMemory}`
    : `${sysBase}\n\n${ctx}`;

  _chatHistory.push({ role: 'user', content: userText });

  const ctrl  = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 20000);

  try {
    const ep  = _chatEndpoint();
    const res = await fetch(ep.url, {
      method: 'POST', signal: ctrl.signal, headers: ep.headers,
      body: JSON.stringify({
        model: CHAT_MODEL,
        messages: [
          { role: 'system', content: systemText },
          ..._chatHistory
        ],
        max_tokens: 2048, temperature: 1.0
      })
    });
    clearTimeout(timer);

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      const msg = errBody?.error?.message || '';
      console.warn('[Chat] gpt-4o-mini', res.status, msg);
      _chatHistory.pop();
      if (res.status === 401) return '🔑 Token буруу байна. Профайл → тохиргоо шалгана уу.';
      if (res.status === 429) return '⏳ Хүсэлт хэт олон байна. 1 минут хүлээгээд дахин туршина уу.';
      return `❌ Алдаа ${res.status}. Профайл → Token шалгана уу.`;
    }

    const json  = await res.json();
    const reply = json.choices?.[0]?.message?.content?.trim() || '...';

    _chatHistory.push({ role: 'assistant', content: reply });
    if (_chatHistory.length > MAX_MSGS) _chatHistory.splice(0, 2);
    _saveHistory(_chatHistory);
    return reply;

  } catch (e) {
    clearTimeout(timer);
    _chatHistory.pop();
    if (e.name === 'AbortError') return '⏳ Хариу удаашрав (20с). Дахин туршина уу.';
    return '❌ Холболтын алдаа. Интернэт шалгана уу.';
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
