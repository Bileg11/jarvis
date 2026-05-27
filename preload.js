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

  // ── Platform info ───────────────────────────────────────────────
  platform: process.platform,
});
