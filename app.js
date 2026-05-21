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

function saveRoutine(r) { localStorage.setItem('jarvis_r', JSON.stringify(r)); }

function renderRoutine() {
  const r = loadRoutine();
  document.getElementById('w-num').textContent = r.water;
  document.getElementById('ri-water').classList.toggle('done', r.water >= 8);
  ['exercise','hanzi','read','journal'].forEach(k => {
    document.getElementById('ri-' + k).classList.toggle('done', !!r[k]);
  });
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

function renderFeed() {
  document.getElementById('feed').innerHTML =
    shuffle([cardNews(), cardHanzi(), cardQuote(), cardGlowup(), cardBiz()]).join('');
}

// ── INIT ──────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  renderDate();
  renderRoutine();
  renderFeed();
  setupMidnightReset();

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
});
