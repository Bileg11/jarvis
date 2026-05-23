/**
 * JARVIS Proxy — Cloudflare Worker
 *
 * Secrets (CF Dashboard → Worker → Settings → Variables):
 *   GITHUB_TOKEN  — GitHub PAT (gpt-4o-mini via GitHub Models)
 *   TAVILY_KEY    — Tavily search API key
 *
 * CORS: зөвхөн bileg11.github.io-оос л хүсэлт зөвшөөрнө
 */

const ALLOWED_ORIGIN = 'https://bileg11.github.io';
const CHAT_URL       = 'https://models.inference.ai.azure.com/chat/completions';
const TAVILY_URL     = 'https://api.tavily.com/search';

// ── CORS helpers ──────────────────────────────────────────────────
function corsHeaders(origin) {
  const allow = origin === ALLOWED_ORIGIN || origin === 'http://localhost:5500'
    ? origin : ALLOWED_ORIGIN;
  return {
    'Access-Control-Allow-Origin':  allow,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

function json(data, status = 200, origin = '') {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) }
  });
}

// ── MAIN HANDLER ──────────────────────────────────────────────────
export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';

    // Preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    if (request.method !== 'POST') {
      return json({ error: 'POST only' }, 405, origin);
    }

    const url = new URL(request.url);

    // ── /ping ──────────────────────────────────────────────────────
    if (url.pathname === '/ping') {
      return json({
        ok: true,
        chat:   !!env.GITHUB_TOKEN,
        intel:  !!env.TAVILY_KEY,
        ts:     new Date().toISOString()
      }, 200, origin);
    }

    // ── /chat ──────────────────────────────────────────────────────
    if (url.pathname === '/chat') {
      if (!env.GITHUB_TOKEN) return json({ error: 'GITHUB_TOKEN secret тавигдаагүй' }, 500, origin);

      let body;
      try { body = await request.json(); } catch { return json({ error: 'Invalid JSON' }, 400, origin); }

      const res = await fetch(CHAT_URL, {
        method:  'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${env.GITHUB_TOKEN}`
        },
        body: JSON.stringify(body)
      });

      const data = await res.json();
      return json(data, res.status, origin);
    }

    // ── /intel ─────────────────────────────────────────────────────
    if (url.pathname === '/intel') {
      if (!env.TAVILY_KEY)    return json({ error: 'TAVILY_KEY secret тавигдаагүй'    }, 500, origin);
      if (!env.GITHUB_TOKEN) return json({ error: 'GITHUB_TOKEN secret тавигдаагүй' }, 500, origin);

      const QUERIES = [
        'new AI model release artificial intelligence technology news today 2026',
        'Elon Musk Donald Trump X Twitter post statement announcement today',
        'Mongolia world breaking news major events today 2026'
      ];
      const LABELS = ['🤖 AI & Технологи', '🐦 X / Нийгмийн медиа', '🌍 Дэлхий & Монгол'];

      // 3 Tavily хайлт зэрэг
      const searches = await Promise.all(QUERIES.map(q =>
        fetch(TAVILY_URL, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            api_key: env.TAVILY_KEY, query: q,
            search_depth: 'basic', include_answer: true, max_results: 5
          })
        }).then(r => r.ok ? r.json() : null).catch(() => null)
      ));

      // Raw context үүсгэх
      const ts = new Date().toLocaleString('en-US', { timeZone: 'Asia/Shanghai',
        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
      let raw = `Search results [${ts} Shanghai]:\n\n`;

      searches.forEach((r, i) => {
        raw += `--- ${LABELS[i]} ---\n`;
        if (!r) { raw += '(Search failed)\n\n'; return; }
        if (r.answer) raw += `Summary: ${r.answer}\n\n`;
        (r.results || []).slice(0, 4).forEach(item => {
          raw += `• ${item.title}\n  ${(item.content || '').slice(0, 300)}\n  ${item.url}\n\n`;
        });
      });

      const prompt = `${raw}
──────────────────────────────
Дээрх бодит цагийн мэдээллийг "JARVIS Intel Брифинг" болгон Монгол хэлээр нэгтгэ.

Формат:
🤖 **AI & ТЕХНОЛОГИ**
• [шинэ model/tool байвал онцол]

🐦 **ELON & TRUMP**
• [тэдний чухал мэдэгдэл]

🌍 **ДЭЛХИЙ & МОНГОЛ**
• [том үйл явдлууд]

⚡ **JARVIS ЗӨВЛӨГӨӨ**
[Билэгт нэг практик зөвлөгөө]

Товч, конкрет байлга. Хоосон мэдэгдэл бүү бич.`;

      const chatRes = await fetch(CHAT_URL, {
        method:  'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${env.GITHUB_TOKEN}`
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: 'Та JARVIS — Билэгийн хувийн AI туслах. Монголоор хариулна уу.' },
            { role: 'user',   content: prompt }
          ],
          max_tokens: 1200, temperature: 0.6
        })
      });

      const chatData = await chatRes.json();
      const message  = chatData.choices?.[0]?.message?.content?.trim() || '...';
      return json({ message }, 200, origin);
    }

    return json({ error: 'Unknown endpoint' }, 404, origin);
  }
};
