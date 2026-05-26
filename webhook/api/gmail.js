'use strict';
// ── GMAIL HELPER ──────────────────────────────────────────────────
// Өглөөний brief-д уншаагүй чухал имэйлүүдийг харуулна
// Calendar-тай ижил OAuth2 credentials ашигладаг

const fetch = require('node-fetch');

function isConfigured() {
  return !!(
    process.env.GOOGLE_CLIENT_ID &&
    process.env.GOOGLE_CLIENT_SECRET &&
    process.env.GOOGLE_REFRESH_TOKEN_GMAIL || process.env.GOOGLE_REFRESH_TOKEN
  );
}

// ── Access token авах ─────────────────────────────────────────────
async function getAccessToken() {
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id:     process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      // Gmail-д зориулсан тусдаа token эсвэл ерөнхий token
      refresh_token: process.env.GOOGLE_REFRESH_TOKEN_GMAIL || process.env.GOOGLE_REFRESH_TOKEN,
      grant_type:    'refresh_token',
    }).toString(),
  });
  const d = await r.json();
  if (!d.access_token) throw new Error('Gmail token авч чадсангүй');
  return d.access_token;
}

// ── Уншаагүй имэйлүүдийг авах ─────────────────────────────────────
// Хамгийн сүүлийн N ширхэг UNREAD имэйл
async function getUnreadEmails(maxResults = 5) {
  const token = await getAccessToken();

  // Уншаагүй имэйлийн ID-уудыг авна
  const listRes = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?` +
    `q=is:unread+in:inbox&maxResults=${maxResults}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const listData = await listRes.json();
  if (listData.error) throw new Error(listData.error.message);

  const messages = listData.messages || [];
  if (!messages.length) return [];

  // Имэйл бүрийн дэлгэрэнгүй авна (зэрэг)
  const details = await Promise.all(
    messages.map(async m => {
      const r = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      return r.json();
    })
  );

  return details
    .filter(d => !d.error)
    .map(d => {
      const headers = d.payload?.headers || [];
      const get = name => headers.find(h => h.name === name)?.value || '';
      const from    = get('From').replace(/<[^>]+>/, '').trim();
      const subject = get('Subject') || '(Гарчиггүй)';
      const snippet = (d.snippet || '').slice(0, 80);
      return { from, subject, snippet, id: d.id };
    });
}

// ── Уншаагүй тоо авах ─────────────────────────────────────────────
async function getUnreadCount() {
  try {
    const token = await getAccessToken();
    const r = await fetch(
      'https://gmail.googleapis.com/gmail/v1/users/me/labels/INBOX',
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const d = await r.json();
    return d.messagesUnread || 0;
  } catch { return 0; }
}

module.exports = { isConfigured, getUnreadEmails, getUnreadCount };
