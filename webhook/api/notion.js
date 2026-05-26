'use strict';
// ── NOTION HELPER ─────────────────────────────────────────────────
// Notion page-д блок нэмэх (database биш, page-д append хийнэ)

const fetch = require('node-fetch');

const NOTION_TOKEN   = () => process.env.NOTION_TOKEN;
const NOTION_PAGE_ID = () => process.env.NOTION_DB_ID; // env нэр хэвээр үлдэнэ

// ── Тэмдэглэл хадгалах ────────────────────────────────────────────
// title  — гарчиг (heading_3 болж харагдана)
// body   — дэлгэрэнгүй текст (заавал биш)
// emoji  — heading-ийн өмнө (default 📝)
async function notionSave(title, body = '', emoji = '📝') {
  const token  = NOTION_TOKEN();
  const pageId = NOTION_PAGE_ID();
  if (!token || !pageId) return null;

  // Аль өдөр гэдгийг тэмдэглэнэ
  const today = new Date().toLocaleDateString('sv', { timeZone: 'Asia/Shanghai' });

  // Нэмэх блокуудыг бэлдэнэ
  const blocks = [
    {
      object: 'block',
      type: 'heading_3',
      heading_3: {
        rich_text: [{ type: 'text', text: { content: `${emoji} ${title}` } }],
      },
    },
  ];

  // Body байвал paragraph болгоно
  if (body) {
    blocks.push({
      object: 'block',
      type: 'paragraph',
      paragraph: {
        rich_text: [{ type: 'text', text: { content: body.slice(0, 2000) } }],
      },
    });
  }

  // Огноог жижиг callout болгоно
  blocks.push({
    object: 'block',
    type: 'paragraph',
    paragraph: {
      rich_text: [
        {
          type: 'text',
          text: { content: `📅 ${today}` },
          annotations: { color: 'gray' },
        },
      ],
    },
  });

  try {
    const r = await fetch(`https://api.notion.com/v1/blocks/${pageId}/children`, {
      method: 'PATCH',
      headers: {
        Authorization:    `Bearer ${token}`,
        'Content-Type':   'application/json',
        'Notion-Version': '2022-06-28',
      },
      body: JSON.stringify({ children: blocks }),
    });

    const d = await r.json();
    if (d.object === 'error') {
      console.error('[Notion] API error:', d.message);
      return null;
    }

    // Page URL буцаана
    return `https://www.notion.so/${pageId.replace(/-/g, '')}`;

  } catch (e) {
    console.error('[Notion] Error:', e.message);
    return null;
  }
}

module.exports = { notionSave };
