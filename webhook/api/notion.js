'use strict';
// ── NOTION HELPER ─────────────────────────────────────────────────
// Notion database-д тэмдэглэл хадгалах

const fetch = require('node-fetch');

const NOTION_TOKEN = () => process.env.NOTION_TOKEN;
const NOTION_DB_ID = () => process.env.NOTION_DB_ID;

// ── Тэмдэглэл хадгалах ────────────────────────────────────────────
// title  — гарчиг (100 тэмдэгт хүртэл)
// body   — дэлгэрэнгүй текст (заавал биш)
// emoji  — icon emoji (default 📝)
async function notionSave(title, body = '', emoji = '📝') {
  const token = NOTION_TOKEN();
  const dbId  = NOTION_DB_ID();
  if (!token || !dbId) return null;

  const today = new Date().toLocaleDateString('sv', { timeZone: 'Asia/Shanghai' });

  try {
    const payload = {
      parent: { database_id: dbId },
      icon:   { type: 'emoji', emoji },
      properties: {
        // Notion database-ийн title property нь "Name" гэж нэрлэгддэг
        Name: {
          title: [{ text: { content: title.slice(0, 100) } }],
        },
      },
    };

    // Body байвал paragraph block нэмнэ
    if (body) {
      payload.children = [{
        object: 'block',
        type:   'paragraph',
        paragraph: {
          rich_text: [{ type: 'text', text: { content: body.slice(0, 2000) } }],
        },
      }];
    }

    const r = await fetch('https://api.notion.com/v1/pages', {
      method:  'POST',
      headers: {
        Authorization:   `Bearer ${token}`,
        'Content-Type':  'application/json',
        'Notion-Version': '2022-06-28',
      },
      body: JSON.stringify(payload),
    });

    const d = await r.json();
    if (d.object === 'error') {
      console.error('[Notion] API error:', d.message);
      return null;
    }
    return d.url || d.id;

  } catch (e) {
    console.error('[Notion] Error:', e.message);
    return null;
  }
}

module.exports = { notionSave };
