// ── JARVIS OS — Preload (Secure IPC Bridge) ───────────────────────
// Sprint 24: Real Telemetry + Live Data
// contextIsolation:true → renderer-д зөвхөн энэ exposed API харагдана
'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('jarvisAPI', {
  // ── System Stats push (3s interval) ─────────────────────────────
  onSystemStats: (cb) => {
    ipcRenderer.on('system-stats', (_e, data) => cb(data));
  },
  removeSystemStats: () => {
    ipcRenderer.removeAllListeners('system-stats');
  },

  // ── Live FX rates (Frankfurter, cached) ─────────────────────────
  fetchFX: () => ipcRenderer.invoke('fetch-fx'),

  // ── Live RSS news feed (BBC Tech, cached) ───────────────────────
  fetchNews: () => ipcRenderer.invoke('fetch-news'),

  // ── Sprint 35: World feed (categorized — Focus Chat summary) ────
  fetchWorld: () => ipcRenderer.invoke('fetch-world'),

  // ── Sprint 36: World via Railway proxy (Node — CORS-гүй, найдвартай)
  fetchWorldProxy: (proxyUrl) => ipcRenderer.invoke('fetch-world-proxy', proxyUrl),

  // ── Platform info ───────────────────────────────────────────────
  platform: process.platform,

  // ── Persistent setup flag (survives reinstall) ──────────────────
  getSetupFlag: () => ipcRenderer.invoke('get-setup-flag'),
  setSetupFlag: (data) => ipcRenderer.invoke('set-setup-flag', data),

  // ── Page navigation (asar-safe, replaces iframe) ─────────────────
  loadPage: (page) => ipcRenderer.invoke('load-page', page),

  // ── Open external URL in system browser (sprint 30: calendar export)
  openExternal: (url) => ipcRenderer.invoke('open-external', url),

  // ── Sprint 34: Direct Telegram (no Cloud Functions needed) ──────
  telegramSend:       (msg, chatId) => ipcRenderer.invoke('telegram-send', { msg, chatId }),
  telegramGetUpdates: (offset)      => ipcRenderer.invoke('telegram-get-updates', { offset }),
  telegramSetToken:   (token)       => ipcRenderer.invoke('telegram-set-token', token),
});
