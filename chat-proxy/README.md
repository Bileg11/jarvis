# JARVIS Chat Proxy — Vercel

JARVIS chat-ийн AI relay. **Railway-аас тусгаарлан Vercel руу шилжүүлсэн** (free + найдвартай).
Зөвхөн `/chat` (+ `/ping`) — Telegram бот, cron энд **БАЙХГҮЙ** (тэр нь `webhook/server.js`-д үлдэнэ).

> ⚠️ Энэ бол **JARVIS**-ийн төсөл. LFS (`bileg11.github.io`)-тэй огт холихгүй — тусдаа Vercel project.

## Deploy (нэг удаа)

```bash
cd chat-proxy
npx vercel            # нэвтрэх → project нэр: jarvis-chat-proxy → deploy
```

Дараа нь **ENV** тавина (Vercel CLI эсвэл Dashboard → Settings → Environment Variables):

```bash
npx vercel env add SYSTEM_USE_TOKEN     # GitHub PAT (Railway дээрхтэйгээ ижил)
# сонголт:
npx vercel env add GEMINI_API_KEY       # GitHub хоосон бол fallback
npx vercel env add CHAT_SECRET          # x-jarvis-secret шалгалт хүсвэл
```

Эцэст нь production:

```bash
npx vercel --prod
```

URL: `https://jarvis-chat-proxy.vercel.app`
(Хэрэв project нэр өөр бол → gemini.js `PROXY_DEFAULT`-ыг засах, эсвэл app дотор Профайл → Proxy URL override.)

## Тест

```bash
curl https://jarvis-chat-proxy.vercel.app/ping
# → {"ok":true,"chat":true,...}   ← chat:true бол token зөв тавигдсан

curl -X POST https://jarvis-chat-proxy.vercel.app/chat \
  -H "Content-Type: application/json" \
  -d '{"model":"gpt-4o","messages":[{"role":"user","content":"сайн уу"}],"max_tokens":20}'
```

## ENV хүснэгт

| Нэр | Заавал | Тайлбар |
|---|---|---|
| `SYSTEM_USE_TOKEN` | ✅ | GitHub PAT — `models.inference.ai.azure.com` |
| `GEMINI_API_KEY` | — | GitHub хоосон үед Gemini fallback |
| `CHAT_SECRET` | — | `x-jarvis-secret` header шалгалт |
| `CORS_ORIGIN` | — | default `*` |
