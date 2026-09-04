// T.H.R.E.E. OS — Electron Main Process
// Sprint 24: Real Telemetry, Live FX, Live News

'use strict';

const { app, BrowserWindow, Menu, globalShortcut, shell, ipcMain, powerMonitor } = require('electron');
const path  = require('path');
const os    = require('os');
const fs    = require('fs');
const https = require('https');
const { exec } = require('child_process');

// ── PERSISTENT SETUP FLAG (survives reinstall) ────────────────────
// Stored in ~/Library/Preferences/ — NOT in app userData
const SETUP_FLAG_PATH = path.join(os.homedir(), 'Library', 'Preferences', 'three-os-setup.json');

// ── PAGE NAVIGATION (iframe alternative — asar-safe) ─────────────
ipcMain.handle('load-page', (_, page) => {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  const allowed = ['home.html','index.html','chat.html','profile.html','tracker.html',
                   'guide.html','hsk.html','learn.html','life.html','finance.html','dashboard.html'];
  if (!allowed.includes(page)) return;
  mainWindow.loadFile(page);
});

// Sprint 30: Open external URL in system browser (calendar export etc.)
ipcMain.handle('open-external', (_, url) => {
  if (!url || typeof url !== 'string') return;
  // Only allow http/https
  if (!/^https?:\/\//i.test(url)) return;
  shell.openExternal(url);
});

ipcMain.handle('get-setup-flag', () => {
  try {
    if (!fs.existsSync(SETUP_FLAG_PATH)) return null;
    return JSON.parse(fs.readFileSync(SETUP_FLAG_PATH, 'utf8'));
  } catch { return null; }
});

ipcMain.handle('set-setup-flag', (_, data) => {
  try {
    fs.writeFileSync(SETUP_FLAG_PATH, JSON.stringify(data), 'utf8');
    return true;
  } catch { return false; }
});

let mainWindow;
let _statsInterval = null;

// ── CPU TRACKING (os.cpus delta — no child_process needed) ──────────
let _prevCpuTimes = null;

function _getCpuPct() {
  const cpus = os.cpus();
  const cur = cpus.reduce((acc, cpu) => {
    Object.keys(cpu.times).forEach(k => { acc[k] = (acc[k] || 0) + cpu.times[k]; });
    return acc;
  }, {});

  if (!_prevCpuTimes) { _prevCpuTimes = cur; return 0; }

  let idle = cur.idle - _prevCpuTimes.idle;
  let total = 0;
  Object.keys(cur).forEach(k => { total += cur[k] - (_prevCpuTimes[k] || 0); });
  _prevCpuTimes = cur;
  if (total === 0) return 0;
  return Math.round((1 - idle / total) * 100);
}

// ── TOP PROCESSES (ps — macOS) ────────────────────────────────────
function _getTopProcesses() {
  return new Promise(resolve => {
    exec(
      "ps -Ao comm,%cpu --no-headers 2>/dev/null | sort -k2 -rn | head -4",
      { timeout: 3000 },
      (err, stdout) => {
        if (err || !stdout) {
          // macOS ps flag fallback
          exec("ps -Ao 'comm=%cpu' 2>/dev/null | sort -t'%' -k2 -rn | head -4",
            { timeout: 3000 },
            (e2, out2) => {
              if (e2 || !out2) { resolve([]); return; }
              resolve(_parseProcs(out2));
            });
          return;
        }
        resolve(_parseProcs(stdout));
      }
    );
  });
}

function _parseProcs(stdout) {
  return stdout.trim().split('\n').slice(0, 3).map(line => {
    const parts = line.trim().split(/\s+/);
    const cpu   = parseFloat(parts[parts.length - 1]) || 0;
    const raw   = parts.slice(0, -1).join(' ');
    // Shorten path to basename
    const name  = raw.split('/').pop().slice(0, 22);
    return { name, cpu };
  }).filter(p => p.cpu > 0.1);
}

// ── BATTERY (pmset — macOS only) ─────────────────────────────────
function _getBattery() {
  if (process.platform !== 'darwin') return Promise.resolve(null);
  return new Promise(resolve => {
    exec("pmset -g batt 2>/dev/null | grep -o '[0-9]*%;'", { timeout: 2000 }, (err, out) => {
      if (err || !out) { resolve(null); return; }
      const m = out.match(/(\d+)%/);
      resolve(m ? parseInt(m[1]) : null);
    });
  });
}

// ── SYSTEM STATS COLLECTOR ───────────────────────────────────────
async function collectAndPush() {
  if (!mainWindow || mainWindow.isDestroyed()) return;

  const cpu     = _getCpuPct();
  const total   = os.totalmem();
  const free    = os.freemem();
  const memPct  = Math.round((1 - free / total) * 100);
  const memUsed = +(  (total - free) / 1073741824 ).toFixed(1); // GB
  const memTotal= +( total / 1073741824 ).toFixed(1);
  const loadAvg = +( os.loadavg()[0] ).toFixed(1);
  const uptime  = Math.floor(os.uptime());

  const [battery, topProcs] = await Promise.all([_getBattery(), _getTopProcesses()]);

  mainWindow.webContents.send('system-stats', {
    cpu, memPct, memUsed, memTotal, battery, loadAvg, uptime, topProcs,
  });
}

// ── HTTP HELPER (Node native https, no npm) ──────────────────────
function _fetchUrl(url, timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { timeout: timeoutMs, headers: { 'User-Agent': 'THREE-OS/27' } }, res => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return _fetchUrl(res.headers.location, timeoutMs).then(resolve).catch(reject);
      }
      let body = '';
      res.on('data', d => { body += d; });
      res.on('end', () => resolve(body));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}

// ── FX RATES (open.er-api.com — free, MNT-г дэмждэг) ──────────────
// Primary:  https://open.er-api.com/v6/latest/USD  (MNT дэмждэг)
// Fallback: https://api.frankfurter.app/latest?from=USD&to=CNY
//           + hardcoded 1 USD ≈ 3450 MNT (cache-аас)
ipcMain.handle('fetch-fx', async () => {
  try {
    // Try primary source first (supports MNT)
    let usdCny = 0, usdMnt = 0;

    try {
      const body = await _fetchUrl('https://open.er-api.com/v6/latest/USD');
      const json = JSON.parse(body);
      // json.rates = { CNY: 7.25, MNT: 3450, ... }
      usdCny = json.rates?.CNY || 0;
      usdMnt = json.rates?.MNT || 0;
    } catch {
      // Fallback: Frankfurter for CNY, approximate MNT
      try {
        const body = await _fetchUrl('https://api.frankfurter.app/latest?from=USD&to=CNY');
        const json = JSON.parse(body);
        usdCny = json.rates?.CNY || 7.25;
        usdMnt = 3450; // approximate fallback — MongoDB Central Bank rate ~2026
      } catch {
        usdCny = 7.25; usdMnt = 3450; // double fallback
      }
    }

    const cnyMnt = usdCny > 0 ? usdMnt / usdCny : 0;
    return {
      ok:     true,
      usdCny: usdCny.toFixed(4),
      usdMnt: Math.round(usdMnt).toLocaleString(),
      cnyMnt: cnyMnt.toFixed(1),
      ts:     Date.now(),
    };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
});

// ── NEWS FEED (BBC Tech RSS — free, no key) ──────────────────────
// Falls back to Reuters Tech if BBC fails
const RSS_URLS = [
  'https://feeds.bbci.co.uk/news/technology/rss.xml',
  'https://rss.nytimes.com/services/xml/rss/nyt/Technology.xml',
];

function _parseRSSItems(xml, limit = 6) {
  const items = [];
  const rx = /<item[^>]*>([\s\S]*?)<\/item>/g;
  let m;
  while ((m = rx.exec(xml)) !== null && items.length < limit) {
    const block = m[1];
    const title = (_tag(block, 'title') || '').replace(/<!\[CDATA\[(.*?)\]\]>/s, '$1').trim();
    const desc  = (_tag(block, 'description') || '').replace(/<!\[CDATA\[(.*?)\]\]>/s, '$1')
                    .replace(/<[^>]+>/g, '').trim().slice(0, 120);
    const link  = (_tag(block, 'link') || '').trim();
    if (title) items.push({ title, desc, link });
  }
  return items;
}

function _tag(xml, tag) {
  const m = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`));
  return m ? m[1] : null;
}

ipcMain.handle('fetch-news', async () => {
  for (const url of RSS_URLS) {
    try {
      const xml   = await _fetchUrl(url, 10000);
      const items = _parseRSSItems(xml);
      if (items.length > 0) return { ok: true, items, source: url, ts: Date.now() };
    } catch {}
  }
  return { ok: false, items: [] };
});

// ── SPRINT 35: WORLD FEED — олон ангиллын мэдээ (Focus Chat) ─────
// Trump/Politics, World/War, Business/Markets, AI/Tech, Entertainment
const WORLD_FEEDS = {
  politics:      ['https://feeds.bbci.co.uk/news/world/us_and_canada/rss.xml'],
  world:         ['https://feeds.bbci.co.uk/news/world/rss.xml'],
  business:      ['https://feeds.bbci.co.uk/news/business/rss.xml'],
  ai:            ['https://feeds.bbci.co.uk/news/technology/rss.xml',
                  'https://rss.nytimes.com/services/xml/rss/nyt/Technology.xml'],
  entertainment: ['https://feeds.bbci.co.uk/news/entertainment_and_arts/rss.xml'],
};

ipcMain.handle('fetch-world', async () => {
  const out = {};
  await Promise.all(Object.entries(WORLD_FEEDS).map(async ([cat, urls]) => {
    for (const url of urls) {
      try {
        const xml   = await _fetchUrl(url, 9000);
        const items = _parseRSSItems(xml, 4);
        if (items.length) { out[cat] = items; return; }
      } catch {}
    }
    out[cat] = [];
  }));
  const total = Object.values(out).reduce((n, arr) => n + (arr?.length || 0), 0);
  return { ok: total > 0, categories: out, ts: Date.now() };
});

// ── Sprint 38: AI chat via Node (VPN/CORS тойрно) ────────────────
// Renderer browser fetch VPN-д гацвал энэ IPC ашиглана. Node https POST.
ipcMain.handle('chat-completion', async (_, { url, headers, body }) => {
  return new Promise((resolve) => {
    try {
      const u = new URL(url);
      const data = typeof body === 'string' ? body : JSON.stringify(body);
      const opts = {
        hostname: u.hostname, path: u.pathname + u.search, method: 'POST',
        headers: { ...(headers||{}), 'Content-Length': Buffer.byteLength(data) },
        timeout: 25000,
      };
      const req = https.request(opts, (res) => {
        let buf = '';
        res.on('data', d => buf += d);
        res.on('end', () => {
          try { resolve({ ok: res.statusCode < 400, status: res.statusCode, data: JSON.parse(buf) }); }
          catch { resolve({ ok: false, status: res.statusCode, error: 'parse', raw: buf.slice(0,200) }); }
        });
      });
      req.on('error', e => resolve({ ok: false, error: e.message }));
      req.on('timeout', () => { req.destroy(); resolve({ ok: false, error: 'timeout' }); });
      req.write(data); req.end();
    } catch (e) { resolve({ ok: false, error: e.message }); }
  });
});

// ── Sprint 36: World via Railway proxy (Node fetch — CORS-гүй, найдвартай)
// Renderer browser fetch CORS-д баригдвал энэ IPC ашиглана.
// Vercel US-д тул Хятадаас хүрдэг (BBC шиг block биш).
const WORLD_PROXY_DEFAULT = 'https://jarvis-chat-proxy.vercel.app';
ipcMain.handle('fetch-world-proxy', async (_, proxyUrl) => {
  const base = (proxyUrl || WORLD_PROXY_DEFAULT).replace(/\/$/, '');
  try {
    const body = await _fetchUrl(`${base}/world`, 15000);
    return JSON.parse(body);
  } catch (e) {
    return { ok: false, error: String(e) };
  }
});

// ── WINDOW ───────────────────────────────────────────────────────
function createWindow() {
  mainWindow = new BrowserWindow({
    width:  1440,
    height: 900,
    minWidth:  1024,
    minHeight: 700,
    backgroundColor: '#000308',
    titleBarStyle: 'hiddenInset',
    vibrancy: 'under-window',
    visualEffectState: 'active',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
      preload: path.join(__dirname, 'preload.js'), // ← Sprint 24: IPC bridge
    },
    icon: path.join(__dirname, 'assets', 'icon.png'),
    show: false,
  });

  // Sprint 38 DEBUG: renderer console + crash/hang-г terminal log руу дамжуулах
  mainWindow.webContents.on('console-message', (_e, level, message) => {
    if (level >= 2) console.log(`[renderer:ERR] ${String(message).slice(0,200)}`);
  });
  mainWindow.webContents.on('render-process-gone', (_e, d) => console.log('[renderer GONE]', d.reason));
  mainWindow.webContents.on('unresponsive', () => console.log('[renderer UNRESPONSIVE — freeze!]'));
  mainWindow.webContents.on('responsive', () => console.log('[renderer responsive again]'));

  // Sprint 36 FIX: clearCache-ийг loadFile-тэй ЗЭРЭГ ажиллуулахад уралдаан
  // үүсч index.css хааяа ачаалагдалгүй апп "нүцгэн" гардаг байсан.
  // Одоо cache цэвэрлэж ДУУССАНЫ дараа л хуудсаа ачаална.
  mainWindow.webContents.session.clearCache()
    .catch(() => {})
    .then(() => mainWindow.loadFile('home.html'));

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.focus();

    // ── START SYSTEM STATS PUSH ──────────────────────────────────
    // Warm up CPU sample (first call returns 0 — set baseline)
    _getCpuPct();
    // Push every 3 seconds — respects blur/focus
    _statsInterval = setInterval(() => {
      if (mainWindow && !mainWindow.isDestroyed()) collectAndPush();
    }, 3000);
  });

  // Pause stats when window is hidden (saves CPU — same principle as renderer)
  mainWindow.on('hide', () => {
    if (_statsInterval) { clearInterval(_statsInterval); _statsInterval = null; }
  });
  mainWindow.on('show', () => {
    if (!_statsInterval) {
      _getCpuPct(); // reset baseline
      _statsInterval = setInterval(() => collectAndPush(), 3000);
    }
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    if (_statsInterval) { clearInterval(_statsInterval); _statsInterval = null; }
    mainWindow = null;
  });
}

// ── APP LIFECYCLE ────────────────────────────────────────────────
// ДАВХАР НЭЭЛТ ХОРИГЛОНО: хоёр instance нэг userData хуваалцахад
// cache lock зөрчилдөж хоёр дахь цонх CSS-гүй эвдэрхий гардаг байсан.
// Хоёр дахь удаа нээхэд байгаа цонхоо гаргаж ирнэ.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show(); mainWindow.focus();
    }
  });
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  createWindow();

  globalShortcut.register('CommandOrControl+Shift+J', () => {
    if (!mainWindow) return createWindow();
    if (mainWindow.isVisible()) mainWindow.hide();
    else { mainWindow.show(); mainWindow.focus(); }
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

// ══════════════════════════════════════════════════════════════════
// SPRINT 34 — DIRECT TELEGRAM IPC (Cloud Functions шаардахгүй!)
// Бүх Telegram урсгал Electron main process-аар шууд явна.
// send: main.js → Telegram Bot API
// receive: main.js polling getUpdates (30s) → renderer
// ══════════════════════════════════════════════════════════════════

let _tgBotToken = null; // In-memory cache (also stored in electron-store via setup flag)

// Bot token тохируулах
ipcMain.handle('telegram-set-token', (_, token) => {
  if (token && typeof token === 'string' && token.includes(':')) {
    _tgBotToken = token.trim();
    return { ok: true };
  }
  return { ok: false, error: 'Invalid token format' };
});

// Telegram руу мессеж илгээх
ipcMain.handle('telegram-send', async (_, { msg, chatId }) => {
  if (!_tgBotToken) {
    // Try loading from setup flag
    try {
      const flag = JSON.parse(fs.readFileSync(path.join(app.getPath('userData'), 'setup-flag.json'), 'utf8'));
      if (flag?.telegram_bot_token) _tgBotToken = flag.telegram_bot_token;
    } catch {}
  }
  if (!_tgBotToken || !chatId) return { ok: false, error: 'No bot token or chat_id' };

  return new Promise((resolve) => {
    const body = JSON.stringify({ chat_id: chatId, text: msg, parse_mode: 'HTML' });
    const options = {
      hostname: 'api.telegram.org',
      path:     `/bot${_tgBotToken}/sendMessage`,
      method:   'POST',
      headers:  { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
      timeout:  8000,
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', d => { data += d; });
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch { resolve({ ok: false, error: 'parse error' }); }
      });
    });
    req.on('error', (e) => resolve({ ok: false, error: e.message }));
    req.on('timeout', () => { req.destroy(); resolve({ ok: false, error: 'timeout' }); });
    req.write(body);
    req.end();
  });
});

// getUpdates polling — renderer хүсэх бүрт (30s interval)
ipcMain.handle('telegram-get-updates', async (_, { offset }) => {
  if (!_tgBotToken) return { ok: false, result: [] };
  try {
    const url = `https://api.telegram.org/bot${_tgBotToken}/getUpdates?offset=${offset || 0}&limit=10&timeout=0`;
    const body = await _fetchUrl(url, 10000);
    return JSON.parse(body);
  } catch (e) {
    return { ok: false, result: [], error: e.message };
  }
});
