// ── GEMINI AI ─────────────────────────────────────────────────────
// API key: app дотор Settings → тавьсны дараа localStorage-д хадгалагдана
// GitHub-д хэзээ ч upload хийгдэхгүй — аюулгүй

const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

// localStorage-аас key уншина (app дотроос тавьдаг)
function _getKey() {
  return localStorage.getItem('jarvis_gemini_key') || '';
}

function _getUrl(model = 'gemini-2.5-flash') {
  return `${BASE_URL}/${model}:generateContent?key=${_getKey()}`;
}

const JARVIS_SYSTEM = `Чи бол JARVIS — Билэгийн хувийн AI туслах.
Билэг: 18 настай Монгол залуу, Шанхайд амьдардаг.
Зорилго 1: Тогтмол фитнесс — биеийн байдал, хүч чадал сайжруулах.
Зорилго 2: Өөрийн бизнес эхлүүлэх — LFS Shanghai-г бодит, том бизнес болгох.
Зорилго 3: HSK4 шалгалт өгөх — хятад хэлний дунд шатны мэдлэг.
Зорилго 4: LFS Shanghai өргөжүүлэх — Монгол аялагчдад үйлчлэх том платформ.

Дүрэм:
- Монголоор хариулна
- 2-3 өгүүлбэр — утасны дэлгэцэнд багтах
- Тодорхой тоо заавал ашигла (ml, %, streak, score)
- Шулуун, мэргэжлийн, урам зориг өгөхүйц
- Хамгийн ойрын нэг үйлдлийг санал болго`;

// ── BRIEFING (автомат, өдөрт 3 удаа) ────────────────────────────
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
HSK2: ${d.hanzi_val}/300 үг
Workout: ${d.fitness_val}/30 энэ сард
7 хоногийн хамгийн дутуу: ${weakLabel} (${d.weak_pct}%)

Дээрх өгөгдөлд тулгуурлан өнөөдрийн хамгийн чухал зүйлийг онцолж зөвлөгөө өг.`;
}

async function askGemini(d) {
  const key = _getKey();
  if (!key) return null;

  try {
    const res = await fetch(_getUrl(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `${JARVIS_SYSTEM}\n\n${_buildPrompt(d)}` }] }],
        generationConfig: { maxOutputTokens: 160, temperature: 0.85, topP: 0.95 }
      })
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || null;
  } catch {
    return null;
  }
}

// ── CHAT (интерактив) ─────────────────────────────────────────────
const CHAT_KEY = 'jarvis_chat_history';
const MAX_MSGS = 40; // хадгалах дээд хэмжээ (20 солилцоо)

function _loadHistory() {
  try { return JSON.parse(localStorage.getItem(CHAT_KEY)) || []; }
  catch { return []; }
}
function _saveHistory(h) {
  localStorage.setItem(CHAT_KEY, JSON.stringify(h));
}

// Хуудас ачаалахад localStorage-аас уншина
let _chatHistory = _loadHistory();

async function sendChatMessage(userText) {
  const key = _getKey();
  if (!key) return '⚙️ Эхлээд Settings-д Gemini API key оруул.';

  const r     = (typeof loadRoutine === 'function')   ? loadRoutine()   : {};
  const tlog  = (typeof loadTodayLog === 'function')  ? loadTodayLog()  : {};
  const score = (typeof getDailyScore === 'function') ? getDailyScore() : 0;
  const water = tlog?.water?.total_ml || 0;

  const ctx        = `[Өнөөдрийн байдал: Score ${score}/100 | Ус ${water}ml | дасгал ${r.exercise?'✓':'✗'} | 汉字 ${r.hanzi?'✓':'✗'}]`;
  const systemText = `${JARVIS_SYSTEM}\n\n${ctx}`;

  _chatHistory.push({ role: 'user', parts: [{ text: userText }] });

  try {
    const res = await fetch(_getUrl(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemText }] },
        contents: _chatHistory,
        generationConfig: { maxOutputTokens: 300, temperature: 0.9 }
      })
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      _chatHistory.pop();
      if (err?.error?.code === 429) return '⏳ API quota дүүрсэн. Хэсэг хүлээгээд дахин туршина уу.';
      return '❌ Алдаа гарлаа. Дахин туршина уу.';
    }

    const json  = await res.json();
    const reply = json.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '...';
    _chatHistory.push({ role: 'model', parts: [{ text: reply }] });

    // Хэт урт болвол хуучин мессежийг устга
    if (_chatHistory.length > MAX_MSGS) _chatHistory.splice(0, 2);

    _saveHistory(_chatHistory); // localStorage-д хадгал
    return reply;
  } catch {
    _chatHistory.pop();
    return '❌ Холболт алдаатай байна.';
  }
}

// Chat history цэвэрлэх (гадаас дуудна)
function clearChatHistory() {
  _chatHistory = [];
  _saveHistory([]);
}

// ── CONTEXT BUILDER ───────────────────────────────────────────────
function buildGeminiContext() {
  const DAYS = ['Ням','Даваа','Мягмар','Лхагва','Пүрэв','Баасан','Бямба'];
  const h    = new Date().getHours();
  const r    = (typeof loadRoutine === 'function')    ? loadRoutine()    : {};
  const tlog = (typeof loadTodayLog === 'function')   ? loadTodayLog()   : {};
  const ylog = (typeof loadYesterdayLog === 'function')? loadYesterdayLog(): {};
  const s7   = (typeof get7DayStats === 'function')   ? get7DayStats()   : {};
  const ms   = (typeof getMissionStats === 'function')? getMissionStats() : [];

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
