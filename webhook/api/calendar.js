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

// ── Natural language → structured event ───────────────────────────
// Rule-based parser — Кирилл, Латин транслитерац, Англи бүгдийг дэмжинэ
function parseEvent(text) {
  const now      = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Shanghai' }));
  const todayStr = now.toLocaleDateString('sv');
  const tomorrow = new Date(now.getTime() + 86400000).toLocaleDateString('sv');

  const t = text.toLowerCase();

  // ── Огноо тодорхойлох ─────────────────────────────────────────
  let date = todayStr; // default: өнөөдөр

  if (/марга+ш|margaa?sh/i.test(t)) {
    date = tomorrow;
  } else if (/өнөөдөр|onoodor|unuudur|today/i.test(t)) {
    date = todayStr;
  }
  // "YYYY-MM-DD" хэлбэр шууд бичсэн бол
  const dateMatch = t.match(/(\d{4}-\d{2}-\d{2})/);
  if (dateMatch) date = dateMatch[1];

  // ── Цаг тодорхойлох ───────────────────────────────────────────
  let startHour = 9; // default 09:00
  let startMin  = 0;

  // "3 tsagt", "3 цагт", "3:00", "15:00", "3pm", "орой 7"
  const timePatterns = [
    // "15:30" or "3:30"
    { re: /(\d{1,2}):(\d{2})/, h: m => parseInt(m[1]), min: m => parseInt(m[2]) },
    // "орой X" or "oroin X" → evening, add 12 if < 7
    { re: /(?:орой|evening|oroin|pm)\s*(\d{1,2})/i, h: m => {
      const h = parseInt(m[1]); return h < 7 ? h + 12 : h; }, min: () => 0 },
    // "өглөө X" or "morning X" → morning
    { re: /(?:өглөө|morning|ugluu)\s*(\d{1,2})/i, h: m => parseInt(m[1]), min: () => 0 },
    // "X цагт" or "X tsagt" or "X cagt"
    { re: /(\d{1,2})\s*(?:цагт|tsagt|cagt|o'?clock)/i, h: m => {
      const h = parseInt(m[1]); return h < 7 ? h + 12 : h; }, min: () => 0 },
    // plain number followed by "am/pm"
    { re: /(\d{1,2})\s*pm/i, h: m => { const h = parseInt(m[1]); return h < 12 ? h + 12 : h; }, min: () => 0 },
    { re: /(\d{1,2})\s*am/i, h: m => parseInt(m[1]), min: () => 0 },
  ];

  for (const p of timePatterns) {
    const m = t.match(p.re);
    if (m) { startHour = p.h(m); startMin = p.min(m); break; }
  }

  const endHour = startHour + 1; // 1 цаг duration

  const pad  = n => String(n).padStart(2, '0');
  const startTime = `${pad(startHour)}:${pad(startMin)}`;
  const endTime   = `${pad(endHour % 24)}:${pad(startMin)}`;

  // ── Гарчиг: огноо, цаг, keyword-уудыг хасаад үлдсэн нь ─────
  let title = text
    .replace(/марга+ш|margaa?sh/gi, '')
    .replace(/өнөөдөр|onoodor|unuudur|today/gi, '')
    .replace(/\d{4}-\d{2}-\d{2}/g, '')
    .replace(/(?:орой|evening|oroin)\s*\d{1,2}/gi, '')
    .replace(/(?:өглөө|morning|ugluu)\s*\d{1,2}/gi, '')
    .replace(/\d{1,2}:\d{2}/g, '')
    .replace(/\d{1,2}\s*(?:цагт|tsagt|cagt|pm|am)/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!title) title = text.trim();

  return { title, date, startTime, endTime, description: '' };
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
