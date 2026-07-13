// WORLD NEWS PROXY — Focus Chat дэлхийн мэдээ (Vercel serverless)
// Хятадаас BBC блоклогддог тул Vercel (US) дамжуулж татна.
// webhook/server.js (Railway)-ийн GET /world-ийн stateless хувилбар.
// index.html: fetch(`${proxy}/world`) → categorized headlines

const WORLD_FEEDS = {
  politics:      'https://feeds.bbci.co.uk/news/world/us_and_canada/rss.xml',
  world:         'https://feeds.bbci.co.uk/news/world/rss.xml',
  business:      'https://feeds.bbci.co.uk/news/business/rss.xml',
  ai:            'https://feeds.bbci.co.uk/news/technology/rss.xml',
  entertainment: 'https://feeds.bbci.co.uk/news/entertainment_and_arts/rss.xml',
};

function _parseRSS(xml, limit = 4) {
  const items = [];
  const rx = /<item[^>]*>([\s\S]*?)<\/item>/g;
  let m;
  while ((m = rx.exec(xml)) !== null && items.length < limit) {
    const tm = m[1].match(/<title[^>]*>([\s\S]*?)<\/title>/);
    let title = tm ? tm[1] : '';
    title = title.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/, '$1').replace(/<[^>]+>/g, '').trim();
    if (title) items.push({ title });
  }
  return items;
}

// Warm lambda дээр 15 минут cache үлдэнэ (cold start-д дахин татна — зүгээр)
let _worldCache = { ts: 0, data: null };

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', process.env.CORS_ORIGIN || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();

  if (_worldCache.data && Date.now() - _worldCache.ts < 15 * 60 * 1000) {
    return res.json(_worldCache.data);
  }
  try {
    const categories = {};
    await Promise.all(Object.entries(WORLD_FEEDS).map(async ([cat, url]) => {
      try {
        const r   = await fetch(url, { headers: { 'User-Agent': 'THREE-OS/35' } });
        const xml = await r.text();
        categories[cat] = _parseRSS(xml, 4);
      } catch { categories[cat] = []; }
    }));
    const total = Object.values(categories).reduce((n, a) => n + a.length, 0);
    const data = { ok: total > 0, categories, ts: Date.now() };
    _worldCache = { ts: Date.now(), data };
    res.json(data);
  } catch (e) {
    res.status(502).json({ ok: false, error: e.message });
  }
};
