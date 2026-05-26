/**
 * Google Calendar OAuth2 Refresh Token авах setup script
 * China-д ажиллах хувилбар — browser-аар token exchange хийнэ
 *
 * Ажиллуулах: node setup/get-google-token.js
 */

const http = require('http');
const url  = require('url');

const CLIENT_ID     = process.env.GOOGLE_CLIENT_ID     || '';
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';
const REDIRECT_URI  = 'http://localhost:3333/callback';
// Calendar + Gmail хоёуланг нэг token-д багтаана
const SCOPE = [
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/gmail.readonly',
].join(' ');

const authUrl =
  `https://accounts.google.com/o/oauth2/v2/auth` +
  `?client_id=${CLIENT_ID}` +
  `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
  `&response_type=code` +
  `&scope=${encodeURIComponent(SCOPE)}` +
  `&access_type=offline` +
  `&prompt=consent`;

console.log('\n🔑 Google Calendar OAuth2 Setup (China-friendly)\n');
console.log('1. Браузерт нэвтэрнэ үү:\n');
console.log(authUrl + '\n');
console.log('⏳ Хүлээж байна...\n');

const server = http.createServer((req, res) => {
  const parsed = new URL(req.url, 'http://localhost:3333');
  if (!parsed.pathname.startsWith('/callback')) { res.end(); return; }

  const code = parsed.searchParams.get('code');
  if (!code) { res.end('Алдаа: code байхгүй'); return; }

  console.log('\n✅ Authorization code авлаа!\n');

  // Browser-аар token exchange хийх HTML хуудас
  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>JARVIS Token Setup</title>
  <style>
    body { font-family: monospace; padding: 30px; background: #111; color: #eee; }
    pre  { background: #222; padding: 15px; border-radius: 8px; overflow-x: auto; }
    .ok  { color: #4caf50; font-size: 1.2em; font-weight: bold; }
    .err { color: #f44336; }
    button { background: #4caf50; color: white; border: none; padding: 12px 24px;
             font-size: 1em; border-radius: 6px; cursor: pointer; margin-top: 16px; }
    button:hover { background: #388e3c; }
  </style>
</head>
<body>
  <h2>🔑 JARVIS Google Calendar Token Setup</h2>
  <p>Authorization code авлаа. Token exchange хийж байна...</p>
  <div id="status">⏳ Түр хүлээнэ үү...</div>
  <pre id="result"></pre>

  <script>
    const clientId     = ${JSON.stringify(CLIENT_ID)};
    const clientSecret = ${JSON.stringify(CLIENT_SECRET)};
    const code         = ${JSON.stringify(code)};
    const redirectUri  = 'http://localhost:3333/callback';

    async function exchange() {
      const statusEl = document.getElementById('status');
      const resultEl = document.getElementById('result');

      try {
        const r = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            code, client_id: clientId, client_secret: clientSecret,
            redirect_uri: redirectUri, grant_type: 'authorization_code',
          }).toString(),
        });

        const d = await r.json();

        if (d.refresh_token) {
          statusEl.innerHTML = '<span class="ok">✅ Амжилттай! Railway-д доорхийг нэмнэ үү:</span>';
          resultEl.textContent =
            'GOOGLE_REFRESH_TOKEN = ' + d.refresh_token + '\\n\\n' +
            '(access_token нь түр зуурынх, хэрэггүй)';
        } else {
          statusEl.innerHTML = '<span class="err">❌ Алдаа гарлаа:</span>';
          resultEl.textContent = JSON.stringify(d, null, 2);
        }
      } catch(e) {
        document.getElementById('status').innerHTML =
          '<span class="err">❌ Firewall хаасан байна. Доорх curl-г VPN-тэй terminal-д ажиллуулна уу:</span>';
        document.getElementById('result').textContent =
          'curl -X POST https://oauth2.googleapis.com/token \\\\\\n' +
          '  -d "code=' + code + '" \\\\\\n' +
          '  -d "client_id=' + clientId + '" \\\\\\n' +
          '  -d "client_secret=' + clientSecret + '" \\\\\\n' +
          '  -d "redirect_uri=http://localhost:3333/callback" \\\\\\n' +
          '  -d "grant_type=authorization_code"';
      }
    }

    exchange();
  </script>
</body>
</html>`;

  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(html);

  // Server-г 30 секундын дараа хаах
  setTimeout(() => { server.close(); process.exit(0); }, 30000);
});

server.listen(3333, () => {
  console.log('🌐 localhost:3333 дээр хүлээж байна...\n');
});
