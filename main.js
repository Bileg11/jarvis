// JARVIS OS — Electron Main Process
// Sprint 24: Real Telemetry, Live FX, Live News

'use strict';

const { app, BrowserWindow, Menu, globalShortcut, shell, ipcMain, powerMonitor } = require('electron');
const path  = require('path');
const os    = require('os');
const https = require('https');
const { exec } = require('child_process');

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
    const req = https.get(url, { timeout: timeoutMs, headers: { 'User-Agent': 'JARVIS-OS/24' } }, res => {
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

// ── FX RATES (Frankfurter — free, no API key) ────────────────────
// https://api.frankfurter.app/latest?from=USD&to=CNY,MNT
ipcMain.handle('fetch-fx', async () => {
  try {
    const body = await _fetchUrl('https://api.frankfurter.app/latest?from=USD&to=CNY,MNT');
    const json = JSON.parse(body);
    // json.rates = { CNY: 7.25, MNT: 3445.0 }
    const usdCny = json.rates?.CNY   || 0;
    const usdMnt = json.rates?.MNT   || 0;
    const cnyMnt = usdMnt / usdCny;
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

  mainWindow.loadFile('index.html');

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
