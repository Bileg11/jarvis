// ── GEMINI AI ─────────────────────────────────────────────────────
// aistudio.google.com → Get API key → Create API key

const GEMINI_KEY  = "AIzaSyCTUuGEyxi6C4e2OnXMayWI-w1kalg9f0E";
const GEMINI_URL  = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${GEMINI_KEY}`;

const JARVIS_SYSTEM = `Чи бол JARVIS — Билэгийн хувийн AI туслах.
Билэг: 18 настай Монгол залуу, Шанхайд амьдардаг.
Зорилго 1: LFS Shanghai — Монгол аялагчдад VIP платформ (bileg11.github.io).
Зорилго 2: 汉字 HSK2 шалгалт — 300 үг цээжлэх.
Зорилго 3: Тогтмол фитнесс.

Дүрэм:
- Монголоор хариулна
- 2-3 өгүүлбэр — утасны дэлгэцэнд багтах
- Тодорхой тоо заавал ашигла (ml, %, streak, score)
- Шулуун, мэргэжлийн, урам зориг өгөхүйц
- Хамгийн ойрын нэг үйлдлийг санал болго`;

function _buildPrompt(d) {
  const LABELS = { exercise:'дасгал', hanzi:'汉字', read:'унших', journal:'journal', water:'ус' };
  const weakLabel = d.weakest ? (LABELS[d.weakest] || d.weakest) : 'мэдэгдэхгүй';

  return `Өгөгдөл [${d.weekday} ${d.hour}:00]:
Score: ${d.score}/100
Routine: дасгал ${d.exercise?'✓':'✗'} | 汉字 ${d.hanzi?'✓':'✗'} | унших ${d.read?'✓':'✗'} | journal ${d.journal?'✓':'✗'}
Ус: ${d.water}ml / 2000ml (${Math.round(d.water/20)}%)
Нойр: ${d.sleep ? d.sleep.toFixed(1)+'ц' : 'бүртгэгдээгүй'}
Streak: дасгал ${d.ex_streak}хоног 🔥 | 汉字 ${d.hz_streak}хоног 🔥
LFS: ${d.lfs_val}/${d.lfs_max} хэрэглэгч (${d.lfs_pct}%) — ${d.lfs_left} дутуу
HSK2: ${d.hanzi_val}/300 үг (${d.hanzi_pct}%) — ${d.hanzi_left} үлдсэн
Workout: ${d.fitness_val}/30 энэ сард
7 хоногийн хамгийн дутуу: ${weakLabel} (${d.weak_pct}%)${d.weather ? '\nШанхай цаг агаар: ' + d.weather : ''}

Дээрх өгөгдөлд тулгуурлан өнөөдрийн хамгийн чухал зүйлийг онцолж зөвлөгөө өг.`;
}

async function askGemini(d) {
  if (!GEMINI_KEY || GEMINI_KEY === "YOUR_KEY_HERE") return null;

  try {
    const res = await fetch(GEMINI_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: JARVIS_SYSTEM }] },
        contents: [{ parts: [{ text: _buildPrompt(d) }] }],
        generationConfig: {
          maxOutputTokens: 160,
          temperature: 0.85,
          topP: 0.95
        }
      })
    });

    if (!res.ok) return null;
    const json = await res.json();
    const text = json.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    return text || null;
  } catch {
    return null;
  }
}

// ── CONTEXT BUILDER ───────────────────────────────────────────────
// app.js-ийн функцуудаас өгөгдөл цуглуулж Gemini-д дамжуулна

function buildGeminiContext() {
  const DAYS = ['Ням','Даваа','Мягмар','Лхагва','Пүрэв','Баасан','Бямба'];
  const h  = new Date().getHours();
  const r  = loadRoutine();
  const tlog = loadTodayLog();
  const ylog = loadYesterdayLog();
  const s7 = get7DayStats();
  const ms = getMissionStats();

  const lfs     = ms.find(m => m.id === 'lfs')     || {};
  const hanziM  = ms.find(m => m.id === 'hanziw')  || {};
  const fitness = ms.find(m => m.id === 'fitness') || {};

  return {
    hour:       h,
    weekday:    DAYS[new Date().getDay()],
    score:      getDailyScore(),
    exercise:   r.exercise,
    hanzi:      r.hanzi,
    read:       r.read,
    journal:    r.journal,
    water:      tlog?.water?.total_ml || 0,
    sleep:      ylog?.sleep?.hours   || null,
    ex_streak:  getStreak('exercise'),
    hz_streak:  getStreak('hanzi'),
    lfs_val:    lfs.val  || 0,
    lfs_max:    lfs.max  || 100,
    lfs_pct:    lfs.pct  || 0,
    lfs_left:   lfs.left || 100,
    hanzi_val:  hanziM.val  || 0,
    hanzi_pct:  hanziM.pct  || 0,
    hanzi_left: hanziM.left || 300,
    fitness_val: fitness.val || 0,
    weakest:    s7.weakest,
    weak_pct:   s7.weakest && s7.days
                  ? Math.round(s7.items[s7.weakest] / s7.days * 100)
                  : 0,
    weather:    window._shanghaiWeather || null   // Phase 2-д нэмнэ
  };
}
