// ── JARVIS INTEL HUB ──────────────────────────────────────────────
// Tavily Search API → raw results → gpt-4o-mini → Монгол брифинг
// Tavily free tier: 1000 хайлт/сар — tavily.com

const TAVILY_URL = 'https://api.tavily.com/search';

function _getTavilyKey() {
  return localStorage.getItem('jarvis_tavily_key') || '';
}

// ── ХАЙЛТЫН ЗАПРОСУУД ─────────────────────────────────────────────
const INTEL_QUERIES = [
  {
    id:    'ai_tech',
    label: '🤖 AI & Технологи',
    query: 'new AI model release artificial intelligence breakthrough technology news today 2026'
  },
  {
    id:    'social',
    label: '🐦 X / Нийгмийн медиа',
    query: 'Elon Musk Donald Trump X Twitter post statement announcement today'
  },
  {
    id:    'world',
    label: '🌍 Дэлхий & Монгол',
    query: 'Mongolia world breaking news major events today 2026'
  }
];

// ── НЭГЖ ХАЙЛТ ────────────────────────────────────────────────────
async function _tavilySearch(query, key) {
  const ctrl  = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 12000);
  try {
    const res = await fetch(TAVILY_URL, {
      method:  'POST',
      signal:  ctrl.signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key:         key,
        query,
        search_depth:    'basic',
        include_answer:  true,
        max_results:     5,
        include_domains: [],
        exclude_domains: []
      })
    });
    clearTimeout(timer);
    if (!res.ok) {
      const e = await res.json().catch(() => ({}));
      console.warn('[Intel] Tavily', res.status, e?.detail || '');
      return null;
    }
    return await res.json();
  } catch (e) {
    clearTimeout(timer);
    if (e.name !== 'AbortError') console.warn('[Intel] fetch:', e.message);
    return null;
  }
}

// ── БРИФИНГ PROMPT ҮҮСГЭХ ─────────────────────────────────────────
function _buildIntelPrompt(results) {
  const ts = new Date().toLocaleString('mn-MN', {
    timeZone: 'Asia/Shanghai',
    month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
  });

  let raw = `Хайлтын үр дүн [${ts} Шанхайн цаг]:\n\n`;

  results.forEach((r, i) => {
    const q = INTEL_QUERIES[i];
    raw += `--- ${q.label} ---\n`;
    if (!r) { raw += '(Хайлт амжилтгүй болсон)\n\n'; return; }

    if (r.answer) raw += `AI нэгтгэл: ${r.answer}\n\n`;

    (r.results || []).slice(0, 4).forEach(item => {
      const snippet = (item.content || '').slice(0, 300).replace(/\s+/g, ' ');
      raw += `• [${item.title}]\n  ${snippet}\n  🔗 ${item.url}\n\n`;
    });
  });

  return `${raw}
──────────────────────────────────────────
Дээрх бодит цагийн хайлтын мэдээллийг "JARVIS Intel Брифинг" болгон Монгол хэлээр нэгтгэ.

Дараах бүтэцтэй байлга:

🤖 **AI & ТЕХНОЛОГИ**
• [Шинэ model/tool/update байвал онцол, байхгүй бол "Өнөөдөр том мэдэгдэл гараагүй" гэ]

🐦 **ELON & TRUMP — X МЭДЭГДЭЛ**
• [Тэдний чухал мэдэгдэл, post, statement]

🌍 **ДЭЛХИЙ & МОНГОЛ**
• [Том үйл явдал, Монгол мэдээ байвал онцол]

⚡ **JARVIS ЗӨВЛӨГӨӨ**
[Энэ мэдээллийн дагуу Билэгт нэг практик зөвлөгөө]

Товч, конкрет, хэрэгтэй мэдлэгт л анхаар. Хоосон мэдэгдэл бүү бич.`;
}

// ── ҮНДСЭН ФУНКЦ ──────────────────────────────────────────────────
async function fetchLiveIntel(onProgress) {
  const tavilyKey = _getTavilyKey();
  const chatKey   = localStorage.getItem('jarvis_chat_key') || '';

  if (!tavilyKey) {
    return `⚙️ **Tavily API key байхгүй байна.**

Профайл хуудсанд очиж Tavily key тавина уу:
→ tavily.com дээр бүртгүүл (үнэгүй, 1000 хайлт/сар)
→ Профайл → 🌐 Intel Hub → key оруул`;
  }
  if (!chatKey) {
    return '⚙️ Профайл → GitHub Token оруулна уу.';
  }

  // Progress callback
  if (onProgress) onProgress('🔍 Дэлхийн мэдээ хайж байна...');

  // 3 хайлтыг зэрэг явуулна
  const rawResults = await Promise.all(
    INTEL_QUERIES.map(q => _tavilySearch(q.query, tavilyKey))
  );

  const successCount = rawResults.filter(Boolean).length;
  if (successCount === 0) {
    return '❌ Хайлт бүхэлдээ амжилтгүй болсон. Tavily key шалгана уу.';
  }

  if (onProgress) onProgress(`📡 ${successCount}/3 хайлт амжилтай — AI нэгтгэж байна...`);

  const prompt = _buildIntelPrompt(rawResults);

  // gpt-4o-mini-д нэгтгүүлнэ
  const ctrl  = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 25000);

  try {
    const res = await fetch('https://models.inference.ai.azure.com/chat/completions', {
      method:  'POST',
      signal:  ctrl.signal,
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${chatKey}`
      },
      body: JSON.stringify({
        model:       'gpt-4o-mini',
        messages:    [
          { role: 'system', content: 'Та JARVIS — Билэгийн хувийн AI туслах. Монголоор хариулна уу. Markdown bold (**текст**) ашиглаж болно.' },
          { role: 'user',   content: prompt }
        ],
        max_tokens:  1200,
        temperature: 0.6
      })
    });
    clearTimeout(timer);

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.warn('[Intel] GPT', res.status, err?.error?.message || '');
      return `❌ AI алдаа ${res.status}. Token шалгана уу.`;
    }

    const json  = await res.json();
    const reply = json.choices?.[0]?.message?.content?.trim() || '...';
    return reply;

  } catch (e) {
    clearTimeout(timer);
    if (e.name === 'AbortError') return '⏳ AI хариу удаашрав (25с). Дахин туршина уу.';
    return '❌ Холболтын алдаа: ' + e.message;
  }
}
