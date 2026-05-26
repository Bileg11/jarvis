'use strict';
// ── GOOGLE CALENDAR HELPER ────────────────────────────────────────
// OAuth2 refresh token ашиглан Google Calendar API-тай ажиллана

const fetch = require('node-fetch');

// ── Access token авах (refresh token-оор) ─────────────────────────
async function getAccessToken() {
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id:     process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
      grant_type:    'refresh_token',
    }).toString(),
  });
  const d = await r.json();
  if (!d.access_token) throw new Error(`Token авч чадсангүй: ${JSON.stringify(d)}`);
  return d.access_token;
}

// ── Байгаа эсэхийг шалгах ─────────────────────────────────────────
function isConfigured() {
  return !!(
    process.env.GOOGLE_CLIENT_ID &&
    process.env.GOOGLE_CLIENT_SECRET &&
    process.env.GOOGLE_REFRESH_TOKEN
  );
}

// ── Natural language → structured event (Gemini) ──────────────────
async function parseEvent(text) {
  const GEMINI_KEY = process.env.GEMINI_API_KEY;
  if (!GEMINI_KEY) return null;

  const now     = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Shanghai' }));
  const todayStr = now.toLocaleDateString('sv');
  const tomorrow = new Date(now.getTime() + 86400000).toLocaleDateString('sv');

  const prompt =
    `Өнөөдөр ${todayStr}, одоо ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')} (Shanghai цаг).\n` +
    `Маргааш: ${tomorrow}.\n\n` +
    `"${text}" гэсэн мэдэгдлийг calendar event болгон задла.\n` +
    `Зөвхөн JSON хариулна уу (тайлбаргүй):\n` +
    `{"title":"event гарчиг","date":"YYYY-MM-DD","startTime":"HH:MM","endTime":"HH:MM","description":""}\n\n` +
    `Дүрэм:\n` +
    `- Цаг хэлэгдээгүй бол 09:00 дефолт\n` +
    `- Duration хэлэгдээгүй бол 1 цаг нэмэх\n` +
    `- "3 цагт" = 15:00\n` +
    `- "12 цагт" = 12:00\n` +
    `- "оройн 7" = 19:00`;

  try {
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: 150, temperature: 0.1 },
        }),
      }
    );
    const data = await r.json();
    const raw  = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const jsonMatch = raw.match(/\{[\s\S]*?\}/);
    if (jsonMatch) return JSON.parse(jsonMatch[0]);
  } catch (e) {
    console.error('[Calendar] parseEvent error:', e.message);
  }
  return null;
}

// ── Event үүсгэх ──────────────────────────────────────────────────
async function createEvent(title, startISO, endISO, description = '') {
  const token = await getAccessToken();

  const r = await fetch(
    'https://www.googleapis.com/calendar/v3/calendars/primary/events',
    {
      method: 'POST',
      headers: {
        Authorization:  `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        summary:     title,
        description,
        start: { dateTime: startISO, timeZone: 'Asia/Shanghai' },
        end:   { dateTime: endISO,   timeZone: 'Asia/Shanghai' },
      }),
    }
  );

  const d = await r.json();
  if (d.error) throw new Error(d.error.message || 'Calendar API алдаа');
  return d;
}

// ── Өнөөдрийн event-уудыг жагсаах ───────────────────────────────
async function listTodayEvents() {
  const token = await getAccessToken();

  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Shanghai' }));
  // Шанхайн өдрийн эхлэл/төгсгөл UTC-д хөрвүүлэх
  const startOfDay = new Date(Date.UTC(
    now.getFullYear(), now.getMonth(), now.getDate(),
    -8, 0, 0  // UTC+8 → UTC: -8 цаг
  ));
  const endOfDay = new Date(startOfDay.getTime() + 86400000);

  const params = new URLSearchParams({
    timeMin:      startOfDay.toISOString(),
    timeMax:      endOfDay.toISOString(),
    singleEvents: 'true',
    orderBy:      'startTime',
    maxResults:   '10',
  });

  const r = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  const d = await r.json();
  if (d.error) throw new Error(d.error.message);
  return d.items || [];
}

// ── Event цагийг Монгол хэлбэрт хөрвүүлэх ────────────────────────
function formatEventTime(event) {
  if (event.start.date) return 'Бүх өдөр';
  const dt = new Date(event.start.dateTime);
  return dt.toLocaleTimeString('mn-MN', {
    timeZone: 'Asia/Shanghai',
    hour: '2-digit', minute: '2-digit', hour12: false,
  });
}

module.exports = { isConfigured, parseEvent, createEvent, listTodayEvents, formatEventTime };
