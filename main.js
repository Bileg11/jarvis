// JARVIS OS — Electron Main Process
// Sprint 22: macOS Native Desktop App

const { app, BrowserWindow, Menu, globalShortcut, shell } = require('electron');
const path = require('path');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width:  1440,
    height: 900,
    minWidth:  1024,
    minHeight: 700,
    backgroundColor: '#000308',
    titleBarStyle: 'hiddenInset',      // macOS traffic lights — no title bar
    vibrancy: 'under-window',          // macOS background blur
    visualEffectState: 'active',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
    },
    icon: path.join(__dirname, 'assets', 'icon.png'),
    show: false,                       // show after ready-to-show
  });

  // Load local files — instant, no network dependency
  mainWindow.loadFile('index.html');

  // Show once DOM is painted — no white flash
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.focus();
  });

  // Open external links in browser, not Electron
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => { mainWindow = null; });
}

// ── APP LIFECYCLE ────────────────────────────────────────────────────

app.whenReady().then(() => {
  // Remove default menu bar
  Menu.setApplicationMenu(null);

  createWindow();

  // Global shortcut: Ctrl+Shift+J → focus/toggle window
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
  // Keep app alive in Dock on macOS
  if (process.platform !== 'darwin') app.quit();
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});
