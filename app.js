// ── DATA ──────────────────────────────────────────────────────────

const HANZI = [
  { char:'你好', pinyin:'nǐ hǎo',      meaning:'Сайн байна уу',    ex:'你好！我是比力格。',          br:'你(чи) + 好(сайн)' },
  { char:'谢谢', pinyin:'xiè xie',     meaning:'Баярлалаа',        ex:'谢谢你帮助我。',              br:'谢谢 = хоёрдмол баярлалаа' },
  { char:'朋友', pinyin:'péng yǒu',    meaning:'Найз',             ex:'他是我的好朋友。',            br:'朋(нэгдэх) + 友(нөхөр)' },
  { char:'学习', pinyin:'xué xí',      meaning:'Суралцах',         ex:'我每天学习汉语。',            br:'学(сурах) + 习(дасгалжих)' },
  { char:'成功', pinyin:'chéng gōng',  meaning:'Амжилт',           ex:'努力就会成功。',              br:'成(болох) + 功(гавьяа)' },
  { char:'努力', pinyin:'nǔ lì',       meaning:'Хичээх',           ex:'他很努力学习。',              br:'努(зүтгэх) + 力(хүч)' },
  { char:'梦想', pinyin:'mèng xiǎng',  meaning:'Мөрөөдөл',        ex:'坚持自己的梦想。',            br:'梦(зүүд) + 想(бодох)' },
  { char:'快乐', pinyin:'kuài lè',     meaning:'Баяр хөөр',        ex:'祝你快乐！',                 br:'快(тааламжтай) + 乐(баяр)' },
  { char:'机会', pinyin:'jī huì',      meaning:'Боломж',           ex:'抓住这个机会！',              br:'机(цаг) + 会(чадах)' },
  { char:'坚持', pinyin:'jiān chí',    meaning:'Тэвч, тогтвор',    ex:'坚持就是胜利。',              br:'坚(хатуу) + 持(барих)' },
  { char:'进步', pinyin:'jìn bù',      meaning:'Дэвших',           ex:'每天进步一点点。',            br:'进(урагш) + 步(алхам)' },
  { char:'自信', pinyin:'zì xìn',      meaning:'Өөртөө итгэх',     ex:'要有自信！',                 br:'自(өөрөө) + 信(итгэл)' },
  { char:'行动', pinyin:'xíng dòng',   meaning:'Үйлдэл хийх',      ex:'想法要变成行动。',            br:'行(явах) + 动(хөдлөх)' },
  { char:'未来', pinyin:'wèi lái',     meaning:'Ирээдүй',          ex:'未来是美好的。',              br:'未(болоогүй) + 来(ирэх)' },
  { char:'时间', pinyin:'shí jiān',    meaning:'Цаг хугацаа',      ex:'时间是宝贵的。',              br:'时(цаг) + 间(завсар)' },
  { char:'智慧', pinyin:'zhì huì',     meaning:'Мэргэн ухаан',     ex:'用智慧解决问题。',            br:'智(мэргэн) + 慧(ухаан)' },
  { char:'创造', pinyin:'chuàng zào',  meaning:'Бүтээх',           ex:'创造新的价值。',              br:'创(эхлэх) + 造(барих)' },
  { char:'力量', pinyin:'lì liàng',    meaning:'Хүч чадал',        ex:'你有力量做到。',              br:'力(хүч) + 量(хэмжих)' },
  { char:'上海', pinyin:'Shàng hǎi',   meaning:'Шанхай',           ex:'我在上海生活。',              br:'上(дээр) + 海(тэнгис)' },
  { char:'钱',   pinyin:'qián',        meaning:'Мөнгө',            ex:'钱不是一切。',               br:'钱 = мөнгө' },
];

const QUOTES = [
  { text:'Амжилт бол газар биш, зам юм.',                                       by:'Конфуци' },
  { text:'Хамгийн том алдаа бол юу ч хийлгүй суух явдал.',                       by:'Наполеон' },
  { text:'Таны хамгийн том өрсөлдөгч бол өчигдрийн өөрийнхөө хувилбар.',         by:'Anonymous' },
  { text:'Мэдлэг бол хамгийн хүчтэй зэвсэг.',                                    by:'Нельсон Мандела' },
  { text:'Боломж байдаггүй — бүтээдэг.',                                          by:'Anonymous' },
  { text:'Чадна гэж бод, чадахгүй гэж бод — аль аль нь зөв.',                    by:'Генри Форд' },
  { text:'Жижиг алхмуудаар том замыг туулна.',                                    by:'Лао-цзы' },
  { text:'Өнөөдрийн тарьсан зүйл маргаашийн ургац болно.',                        by:'Anonymous' },
  { text:'Хамгийн хол явагч нь эхэлсэн хүн.',                                    by:'Anonymous' },
  { text:'Нойрондоо хийх зүүдийг сэрүүндээ хий.',                                 by:'Anonymous' },
];

const GLOWUP = [
  { title:'Усны дэглэм',          desc:'Өдөрт 8 шил ус уу. Арьс гэрэлтэнэ, тархи идэвхжинэ, биеийн energy level нэмэгдэнэ.' },
  { title:'5 минутын медитаци',   desc:'Өглөө нүдээ нээхэд 5 минут амьсгалаа анхаарна уу. Anxiety буурч, тодорхой бодол ирнэ.' },
  { title:'Унтах биоритм',        desc:'10-11 цагт унтаж, 6-7 цагт бос. Биеийн recovery болон hormone тэнцвэр хамгийн сайн ажилладаг цаг.' },
  { title:'Утасгүй өглөө',        desc:'Нүдээ нээгээд эхний 30 минутад утас битгий хар. Өдрийн tone-г чи тохируул — алгоритм биш.' },
  { title:'Cold shower',          desc:'Шүршүүрийн сүүлийн 30 секундыг хүйтнээр дуусга. Допамин нэмэгдэж, сэрэмж болон focus нэмэгдэнэ.' },
  { title:'Нэг зүйл дуусга',      desc:'Олон зүйл эхлэхийн оронд нэгийг бүрэн дуусга. Completion energy нь дараагийнхруу хөдөлгөнө.' },
  { title:'2 минутын дүрэм',      desc:'Ямар нэг ажил 2 минутаас бага шаардвал яг одоо хий. Procrastination-г тасал.' },
  { title:'Орой 3 зорилго',       desc:'Маргаашийн 3 зорилгоо оройд бич. Ухамсар тань нойрсож байхад боловсруулна, өглөө clear байна.' },
  { title:'Хөдөлгөөний дэглэм',   desc:'20 минут л хангалттай. Өдөрт нэг удаа хөлрөх нь mental health-д physical health шиг чухал.' },
  { title:'Гэрлийн биоритм',      desc:'Орой 9 цагаас хойш дэлгэцийн brightness багасга. Мелатонин ялгарч, нойрны чанар сайжирна.' },
];

const BUSINESS = [
  { title:'Lean Startup',          desc:'Эхлээд MVP хий, дараа нь scale хий. Санаа биш баталгаа хэрэгтэй. Build → Measure → Learn давтлага.' },
  { title:'Network Effect',        desc:'Хэрэглэгч нэмэгдэх тусам бүтээгдэхүүний үнэ цэн нэмэгдэнэ. Facebook, WhatsApp, Airbnb-ийн нууц.' },
  { title:'Loss Aversion',         desc:'Хүмүүс алдахаасаа 2x их айдаг. Маркетингдаа "алдахгүйн тулд" гэсэн мессеж хэрэглэ.' },
  { title:'Pareto Principle',      desc:'20% үйлдэл нь 80% үр дүн гаргадаг. Тэр 20%-ийг ол, тэнд л цагаа зарц.' },
  { title:'Product-Market Fit',    desc:'Зах зээлийн хэрэгцээнд нийцсэн бүтээгдэхүүн л амжилттай болно. Эхлээд хэрэгцээ ол.' },
  { title:'Unit Economics',        desc:'Нэг хэрэглэгч авах зардал (CAC) vs. авчрах орлого (LTV). LTV > CAC × 3 байх ёстой.' },
  { title:'Flywheel Effect',       desc:'Жижиг ялалтууд нэгдэж том хурдасгуур болно. Amazon: хямд → хэрэглэгч → борлуулагч → хямд.' },
  { title:'Blue Ocean Strategy',   desc:'Өрсөлдөөнгүй шинэ зах зээл бий болго. LFS Shanghai — Монгол аялагчид гэсэн тусгай сегмент.' },
  { title:'Social Proof',          desc:'Бусад хийж байгааг харсан хэрэглэгч итгэлтэй болдог. Review, тоо, "X хүн ашигласан" харуул.' },
  { title:'Compound Growth',       desc:'1%-ийн өдөр тутмын өсөлт нэг жилд 37x болдог. Тогтмол жижиг дэвшил = том үр дүн.' },
];

const NEWS = [
  { title:'OpenAI GPT-5 гаргахаар бэлтгэж байна',        sub:'Шинэ загвар нь бодит цагт дуу, зураг, текстийг нэгэн зэрэг боловсруулна.',       src:'TechCrunch',     time:'2 цагийн өмнө' },
  { title:'Монголын эдийн засаг 2026 онд 6.2% өслөө',     sub:'Уул уурхайн экспорт болон гадаадын хөрөнгө оруулалт нэмэгдсэнтэй холбоотой.',    src:'Монголын Мэдээ', time:'5 цагийн өмнө' },
  { title:'Шанхайд AI технологийн тусгай бүс байгуулагдана', sub:'Технологийн компаниудад зориулсан хөнгөлөлттэй бүс нутгийг засаг захиргаа зарлав.', src:'Shanghai Daily',  time:'8 цагийн өмнө' },
];

// ── UTILS ─────────────────────────────────────────────────────────

function shuffle(a) {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
}

function pick(a) { return a[Math.floor(Math.random() * a.length)]; }

function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2100);
}

// ── DATE ──────────────────────────────────────────────────────────

function renderDate() {
  const DAYS   = ['Ням','Даваа','Мягмар','Лхагва','Пүрэв','Баасан','Бямба'];
  const MONTHS = ['1-р сар','2-р сар','3-р сар','4-р сар','5-р сар','6-р сар',
                  '7-р сар','8-р сар','9-р сар','10-р сар','11-р сар','12-р сар'];
  const now = new Date();
  document.getElementById('date-txt').textContent =
    `${DAYS[now.getDay()]}, ${now.getDate()} ${MONTHS[now.getMonth()]}`;
}

// ── ROUTINE ───────────────────────────────────────────────────────

function getToday() { return new Date().toISOString().split('T')[0]; }

function loadRoutine() {
  try {
    const s = JSON.parse(localStorage.getItem('jarvis_r'));
    if (s && s.date === getToday()) return s;
  } catch {}
  return { date: getToday(), water: 0, exercise: false, hanzi: false, read: false, journal: false };
}

function saveRoutine(r) {
  localStorage.setItem('jarvis_r', JSON.stringify(r));
  localStorage.setItem('jarvis_r_' + r.date, JSON.stringify(r));
  window.DB?.saveRoutine(r);
}

// ── STREAKS & SCORE ───────────────────────────────────────────────

function getStreak(key) {
  let streak = 0;
  for (let i = 0; i < 60; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    const r = JSON.parse(localStorage.getItem('jarvis_r_' + dateStr) || 'null');
    if (!r) break;
    const done = key === 'water' ? r.water >= 8 : !!r[key];
    if (done) streak++;
    else break;
  }
  return streak;
}

function get7DayStats() {
  const stats = {
    days: 0,
    items: { exercise: 0, hanzi: 0, read: 0, journal: 0, water: 0 },
    weakest: null,
    strongest: null,
  };
  for (let i = 1; i <= 7; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const r = JSON.parse(localStorage.getItem('jarvis_r_' + d.toISOString().split('T')[0]) || 'null');
    if (!r) continue;
    stats.days++;
    ['exercise','hanzi','read','journal'].forEach(k => { if (r[k]) stats.items[k]++; });
    if (r.water >= 8) stats.items.water++;
  }
  if (stats.days > 0) {
    const keys = ['exercise','hanzi','read','journal','water'];
    let minV = Infinity, maxV = -1;
    keys.forEach(k => {
      if (stats.items[k] < minV) { minV = stats.items[k]; stats.weakest = k; }
      if (stats.items[k] > maxV) { maxV = stats.items[k]; stats.strongest = k; }
    });
  }
  return stats;
}

function getDailyScore() {
  const r = loadRoutine();
  let score = 0;
  score += Math.round((r.water / 8) * 25);
  if (r.exercise) score += 20;
  if (r.hanzi)    score += 20;
  if (r.read)     score += 15;
  if (r.journal)  score += 10;
  const tlog = loadTodayLog();
  if (tlog?.shower) score += 10;
  return score;
}

function renderScore() {
  const chip = document.getElementById('score-chip');
  if (!chip) return;
  const s = getDailyScore();
  chip.textContent = `⚡ ${s}/100`;
}

function renderStreaks() {
  ['water','exercise','hanzi','read','journal'].forEach(key => {
    const el = document.getElementById('ri-' + key);
    if (!el) return;
    const streak = getStreak(key);
    let badge = el.querySelector('.streak-badge');
    if (streak >= 2) {
      if (!badge) {
        badge = document.createElement('div');
        badge.className = 'streak-badge';
        el.querySelector('.r-circle').appendChild(badge);
      }
      badge.textContent = streak + '🔥';
    } else if (badge) {
      badge.remove();
    }
  });
}

function renderRoutine() {
  const r = loadRoutine();
  document.getElementById('w-num').textContent = r.water;
  document.getElementById('ri-water').classList.toggle('done', r.water >= 8);
  ['exercise','hanzi','read','journal'].forEach(k => {
    document.getElementById('ri-' + k).classList.toggle('done', !!r[k]);
  });
  renderStreaks();
  renderScore();
}

function changeWater(delta) {
  const r = loadRoutine();
  r.water = Math.max(0, Math.min(8, r.water + delta));
  saveRoutine(r);
  renderRoutine();
  if (r.water === 8) showToast('🎉 8 шил дүүрлээ!');
}

function toggleR(key) {
  const r = loadRoutine();
  r[key] = !r[key];
  saveRoutine(r);
  renderRoutine();
  const L = { exercise:'Дасгал', hanzi:'汉字', read:'Унших', journal:'Journal' };
  showToast(r[key] ? `✅ ${L[key]} хийлээ!` : `❌ ${L[key]} цуцлав`);
}

function setupMidnightReset() {
  const now = new Date();
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  setTimeout(() => {
    saveRoutine({ date: getToday(), water: 0, exercise: false, hanzi: false, read: false, journal: false });
    renderRoutine();
    setupMidnightReset();
  }, midnight - now);
}

// ── MISSIONS ──────────────────────────────────────────────────────

const DEFAULT_MISSIONS = [
  {
    id: 'lfs',
    label: 'LFS Shanghai',
    icon: '🚀',
    val: 0, max: 100, unit: 'хэрэглэгч',
    context: 'Монгол аялагчдад зориулсан VIP платформ — bileg11.github.io',
    weekly: 5,       // target per week
    step: 1,
  },
  {
    id: 'hanziw',
    label: '汉字 HSK2',
    icon: '汉',
    val: 0, max: 300, unit: 'үг',
    context: 'HSK2 шалгалт — 300 үг цээжлэх шаардлагатай',
    weekly: 15,
    step: 1,
  },
  {
    id: 'fitness',
    label: 'Workout',
    icon: '💪',
    val: 0, max: 30, unit: 'workout',
    context: 'Энэ сарын нийт workout тоо',
    weekly: 5,
    step: 1,
  },
];

function loadMissions() {
  try {
    const stored = JSON.parse(localStorage.getItem('jarvis_missions'));
    if (stored && stored.length) {
      // merge new fields if missing (schema evolution)
      return DEFAULT_MISSIONS.map(def => {
        const s = stored.find(x => x.id === def.id) || {};
        return { ...def, ...s, context: def.context, weekly: def.weekly, step: def.step };
      });
    }
  } catch {}
  return DEFAULT_MISSIONS.map(m => ({ ...m }));
}

function saveMissions(missions) {
  localStorage.setItem('jarvis_missions', JSON.stringify(missions));
  window.DB?.saveMissions(missions);
}

function changeMission(id, delta) {
  const missions = loadMissions();
  const m = missions.find(x => x.id === id);
  if (!m) return;
  m.val = Math.max(0, Math.min(m.max, m.val + delta * (m.step || 1)));
  saveMissions(missions);

  const pct = Math.round(m.val / m.max * 100);
  const valEl  = document.getElementById('mv-' + id);
  const fillEl = document.getElementById('mf-' + id);
  const pctEl  = document.getElementById('mp-' + id);
  if (valEl)  valEl.textContent  = m.val + ' / ' + m.max + ' ' + m.unit;
  if (fillEl) fillEl.style.width = pct + '%';
  if (pctEl)  pctEl.textContent  = pct + '%';

  // Milestone toasts
  if (pct >= 100) showToast(`🏆 ${m.label} — дууслаа!`);
  else if (pct >= 75 && pct - Math.round((m.val - 1) / m.max * 100) < 75) showToast(`🔥 ${m.label} 75% хүрлээ!`);
  else if (pct >= 50 && pct - Math.round((m.val - 1) / m.max * 100) < 50) showToast(`⚡ ${m.label} дунд шугам!`);

  renderMissions();
  typeJarvis(generateJarvisMessage());
}

function getMissionStats() {
  const missions = loadMissions();
  return missions.map(m => {
    const pct = Math.round(m.val / m.max * 100);
    const left = m.max - m.val;
    const weeksLeft = left > 0 ? Math.ceil(left / m.weekly) : 0;
    return { ...m, pct, left, weeksLeft };
  });
}

function renderMissions() {
  const el = document.getElementById('mission-section');
  if (!el) return;
  const mstats = getMissionStats();
  const rows = mstats.map(m => {
    const statusColor = m.pct >= 100 ? 'var(--green)' : m.pct >= 50 ? 'var(--accent)' : 'var(--yellow)';
    return `<div class="mission-item">
      <div class="mission-row">
        <div class="mission-label">
          <span class="mission-icon">${m.icon}</span>${m.label}
        </div>
        <div class="mission-controls">
          <button class="m-btn" onclick="changeMission('${m.id}',-1)">−</button>
          <span class="m-val" id="mv-${m.id}">${m.val} / ${m.max} ${m.unit}</span>
          <button class="m-btn" onclick="changeMission('${m.id}',1)">+</button>
        </div>
      </div>
      <div class="mission-meta-row">
        <span class="mission-context">${m.context}</span>
        <span class="mission-pct" id="mp-${m.id}" style="color:${statusColor}">${m.pct}%</span>
      </div>
      <div class="mission-bar">
        <div class="mission-fill" id="mf-${m.id}" style="width:${m.pct}%"></div>
      </div>
      ${m.left > 0
        ? `<div class="mission-eta">≈ ${m.weeksLeft} долоо хоног · долоо хоногт ${m.weekly} ${m.unit}</div>`
        : '<div class="mission-eta" style="color:var(--green)">✅ Дууссан!</div>'}
    </div>`;
  }).join('');
  el.innerHTML = `<div class="mission-card">
    ${rows}
  </div>`;
}

// ── FEED CARDS ────────────────────────────────────────────────────

function cardNews() {
  const d = pick(NEWS);
  return `<div class="card card-news">
    <span class="card-tag">🌐 ДЭЛХИЙН МЭДЭЭ</span>
    <div class="c-title">${d.title}</div>
    <div class="c-sub">${d.sub}</div>
    <div class="c-meta">${d.src} · ${d.time}</div>
  </div>`;
}

function cardHanzi() {
  const d = pick(HANZI);
  const id = 'hz' + Math.random().toString(36).slice(2);
  return `<div class="card card-hanzi">
    <span class="card-tag">汉字 · ӨДРИЙН ҮГ</span>
    <div class="hanzi-flip" onclick="flipHz('${id}')">
      <div class="hanzi-inner" id="${id}">
        <div class="hanzi-front">
          <div class="hanzi-char">${d.char}</div>
          <div class="hanzi-hint">дарж утгыг харна уу →</div>
        </div>
        <div class="hanzi-back">
          <div class="hanzi-pinyin">${d.pinyin}</div>
          <div class="hanzi-meaning">${d.meaning}</div>
          <div class="hanzi-ex">"${d.ex}"</div>
          <div class="hanzi-break">${d.br}</div>
        </div>
      </div>
    </div>
    <div class="hanzi-btns">
      <button class="h-btn forgot" onclick="hzResult('${d.char}',false)">😅 Мартсан</button>
      <button class="h-btn knew"   onclick="hzResult('${d.char}',true)">✅ Мэднэ</button>
    </div>
  </div>`;
}

function cardQuote() {
  const d = pick(QUOTES);
  return `<div class="card card-quote">
    <span class="card-tag">💬 ӨДРИЙН ЭШЛЭЛ</span>
    <div class="q-text">"${d.text}"</div>
    <div class="q-author">— ${d.by}</div>
  </div>`;
}

function cardGlowup() {
  const d = pick(GLOWUP);
  return `<div class="card card-glowup">
    <span class="card-tag">🔥 GLOW-UP</span>
    <div class="c-title">${d.title}</div>
    <div class="c-desc">${d.desc}</div>
  </div>`;
}

function cardBiz() {
  const d = pick(BUSINESS);
  return `<div class="card card-biz">
    <span class="card-tag">💼 БИЗНЕС</span>
    <div class="c-title">${d.title}</div>
    <div class="c-desc">${d.desc}</div>
  </div>`;
}

function flipHz(id) {
  document.getElementById(id)?.classList.toggle('flipped');
}

function hzResult(char, knew) {
  showToast(knew ? `✅ ${char} — сайн!` : `📝 ${char} — дахин харна уу`);
}

// Smart feed: priority-based ordering
function renderFeed() {
  const r = loadRoutine();
  const h = new Date().getHours();

  const priority = [];
  const rest = [];

  // Hanzi first if not done
  if (!r.hanzi) priority.push(cardHanzi());
  else rest.push(cardHanzi());

  // Glow-up front if no exercise in morning/afternoon
  if (!r.exercise && h < 18) priority.push(cardGlowup());
  else rest.push(cardGlowup());

  rest.push(cardBiz());

  if (h < 11) priority.push(cardNews());
  else rest.push(cardNews());

  rest.push(cardQuote());

  const ordered = [...shuffle(priority), ...shuffle(rest)];
  document.getElementById('feed').innerHTML = ordered.join('');
  observeCards();
}

// ── JARVIS INTELLIGENCE ───────────────────────────────────────────

function loadTodayLog() {
  try { return JSON.parse(localStorage.getItem('jarvis_log_' + getToday())) || null; } catch { return null; }
}

function loadYesterdayLog() {
  const d = new Date(); d.setDate(d.getDate() - 1);
  try { return JSON.parse(localStorage.getItem('jarvis_log_' + d.toISOString().split('T')[0])) || null; } catch { return null; }
}

function fmtH(hours) {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return h + 'ц' + (m > 0 ? ' ' + m + 'мин' : '');
}

function generateJarvisMessage() {
  const h    = new Date().getHours();
  const r    = loadRoutine();
  const tlog = loadTodayLog();
  const ylog = loadYesterdayLog();
  const s7   = get7DayStats();

  const water = tlog?.water?.total_ml || 0;
  const WATER_GOAL = 2000;
  const done  = ['exercise','hanzi','read','journal'].filter(k => r[k]).length;
  const undone = ['exercise','hanzi','read','journal'].filter(k => !r[k]);
  const sleep = ylog?.sleep?.hours || null;
  const score = getDailyScore();
  const LABELS = { exercise:'дасгал', hanzi:'汉字', read:'унших', journal:'journal', water:'ус' };

  // Pattern data — always compute, even with 1 day
  const daysTracked = s7.days;
  const weakKey    = s7.weakest;
  const strongKey  = s7.strongest;
  const weakPct    = weakKey  && daysTracked ? Math.round(s7.items[weakKey]  / daysTracked * 100) : 0;
  const strongPct  = strongKey && daysTracked ? Math.round(s7.items[strongKey] / daysTracked * 100) : 0;

  // Mission awareness
  const mstats = getMissionStats();
  const lfs     = mstats.find(m => m.id === 'lfs');
  const hanziM  = mstats.find(m => m.id === 'hanziw');
  const fitnessM = mstats.find(m => m.id === 'fitness');

  // Streak data
  const exStreak = getStreak('exercise');
  const hzStreak = getStreak('hanzi');
  const wStreak  = getStreak('water');

  // ── 0–5 Late night
  if (h < 5)
    return `Хожуу байна. Унтах цаг болсон. Score: ${score}/100 — маргааш илүү сайн байна.`;

  // ── 5–10 Morning
  if (h < 10) {
    const sleepLine = sleep
      ? (sleep >= 7.5 ? `${fmtH(sleep)} унтсан ✓` : sleep < 6 ? `${fmtH(sleep)} л унтсан — бага байлаа` : `${fmtH(sleep)} унтсан`)
      : 'Унтсан цагаа tracker-т тэмдэглэ';

    if (daysTracked >= 2 && weakPct < 50)
      return `Өглөө. ${sleepLine}. ${daysTracked} хоногийн pattern: ${LABELS[weakKey]} ${s7.items[weakKey]}/${daysTracked} өдөр (${weakPct}%) — хамгийн дутуу. Өнөөдөр тэндээс эхэл.`;

    if (lfs && lfs.val > 0)
      return `Өглөөний мэнд. ${sleepLine}. LFS: ${lfs.val}/${lfs.max} хэрэглэгч — ${lfs.left} дутуу. Routine эхлэх цаг.`;

    return `Өглөөний мэнд, Билэг. ${sleepLine}. Routine эхлэх цаг боллоо.`;
  }

  // ── Water critically behind
  const expectedWater = Math.round(((h - 7) / 15) * WATER_GOAL);
  if (water < expectedWater - 400 && h < 21) {
    const waterPct = Math.round(water / WATER_GOAL * 100);
    return `${h} цаг — ус ${water}ml (${waterPct}%). ${WATER_GOAL - water}ml үлдлээ. Score одоо ${score}/100, ус дүүргэвэл ${score + Math.round(((WATER_GOAL - water) / WATER_GOAL) * 25)} болно.`;
  }

  // ── All done
  if (done === 4 && water >= WATER_GOAL && h >= 15) {
    const best = strongKey ? `${LABELS[strongKey]} хамгийн тогтмол (${strongPct}%).` : '';
    return `Бүх зорилго биелсэн. Score: ${score}/100. ${best} Journal бич, LFS: ${lfs?.val}/${lfs?.max}.`;
  }

  // ── Streak milestones
  if (exStreak >= 7) return `Дасгал ${exStreak} хоног дараалан! 🔥 Score: ${score}/100. Routine: ${done}/4. Ус: ${water}ml/${WATER_GOAL}ml.`;
  if (hzStreak >= 7) return `汉字 ${hzStreak} хоног дараалан! 坚持就是胜利. HSK2: ${hanziM?.val}/${hanziM?.max} үг (${hanziM?.pct}%). Score: ${score}/100.`;
  if (wStreak  >= 7) return `Ус ${wStreak} хоног дараалан бүрэн уусан! 💧 Score: ${score}/100. Routine: ${done}/4.`;

  // ── Night wrap-up 21+
  if (h >= 21) {
    const tail = undone.length ? `Үлдсэн: ${undone.map(k => LABELS[k]).join(', ')}.` : 'Бүгд ✓.';
    const patternLine = daysTracked >= 2
      ? ` ${daysTracked} хоногийн дунд: ${LABELS[weakKey]} ${weakPct}%, ${LABELS[strongKey]} ${strongPct}%.`
      : '';
    return `Score: ${score}/100. ${tail}${patternLine} Journal бичиж унт.`;
  }

  // ── Pattern nudge afternoon
  if (daysTracked >= 1 && weakPct < 50 && h >= 13 && h < 18) {
    const isUndone = weakKey === 'water' ? water < WATER_GOAL : !r[weakKey];
    if (isUndone)
      return `Pattern: ${LABELS[weakKey]} ${daysTracked > 1 ? daysTracked + ' хоногийн дотор ' + weakPct + '%' : 'өнөөдөр хийгдээгүй'} — одоо хий. Score: ${score}/100. Routine: ${done}/4.`;
  }

  // ── Evening missing
  if (h >= 17 && undone.length)
    return `${undone.map(k => LABELS[k]).join(' + ')} үлдсэн. Score: ${score}/100 → ${score + undone.reduce((a,k)=>a+({exercise:20,hanzi:20,read:15,journal:10}[k]||0),0)} болно дуусгавал.`;

  // ── Midday exercise nudge
  if (!r.exercise && h >= 10 && h < 14)
    return `${h} цаг. Дасгал хийгээгүй — score одоо ${score}/100, хийвэл ${score+20} болно. LFS: ${lfs?.val}/${lfs?.max} хэрэглэгч.`;

  // ── Hanzi nudge
  if (!r.hanzi && h >= 13 && h < 18)
    return `汉字 хийсэн үү? HSK2: ${hanziM?.val}/${hanziM?.max} үг (${hanziM?.pct}%). Routine: ${done}/4. Score: ${score}/100.`;

  // ── LFS insight midday
  if (lfs && lfs.val > 0 && h >= 10 && h < 14)
    return `LFS Shanghai: ${lfs.val}/${lfs.max} хэрэглэгч — ${lfs.left} дутуу, ≈${lfs.weeksLeft} долоо хоног. Score: ${score}/100. Routine: ${done}/4.`;

  // ── Default: always show numbers
  return `Score: ${score}/100. Routine: ${done}/4. Ус: ${water}ml/${WATER_GOAL}ml. LFS: ${lfs?.val ?? 0}/${lfs?.max}.`;
}

let _typeTimer = null;
function typeJarvis(text) {
  const el = document.getElementById('j-msg');
  if (!el) return;
  if (_typeTimer) { clearInterval(_typeTimer); _typeTimer = null; }
  el.innerHTML = '';
  const cursor = document.createElement('span');
  cursor.className = 'j-cursor';
  el.appendChild(cursor);
  let i = 0;
  _typeTimer = setInterval(() => {
    if (!cursor.parentNode) { clearInterval(_typeTimer); _typeTimer = null; return; }
    if (i >= text.length) {
      clearInterval(_typeTimer); _typeTimer = null;
      setTimeout(() => cursor.remove(), 2000);
      return;
    }
    el.insertBefore(document.createTextNode(text[i++]), cursor);
  }, 20);
}

async function refreshJarvis() {
  // Rule-based message — instant, no latency
  typeJarvis(generateJarvisMessage());

  // Gemini upgrade — fires in background, replaces when ready
  if (typeof askGemini !== 'function') return;
  const aiMsg = await askGemini(buildGeminiContext());
  if (aiMsg) typeJarvis(aiMsg);
}

// ── SCROLL ANIMATIONS ─────────────────────────────────────────────

function observeCards() {
  const obs = new IntersectionObserver((entries) => {
    entries.forEach((e, i) => {
      if (e.isIntersecting) {
        setTimeout(() => e.target.classList.add('in-view'), i * 60);
        obs.unobserve(e.target);
      }
    });
  }, { threshold: 0.08 });

  document.querySelectorAll('.card').forEach(el => obs.observe(el));
}

// ── INIT ──────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  renderDate();
  renderRoutine();
  renderMissions();
  renderFeed();
  setupMidnightReset();

  setTimeout(() => refreshJarvis(), 400);
  setInterval(() => refreshJarvis(), 5 * 60 * 1000);

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
});
