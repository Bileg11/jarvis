// ── T.H.R.E.E. OS — Dynamic Theme System ──────────────────────────
'use strict';

const JARVIS_THEMES = {
  'stark-cyan': {
    label: 'CYAN EDGE', glow: 1.15,
    reactor: { r:0, g:229, b:255 },
    vars: {
      '--accent':   '#00e5ff', '--accent2':  '#00b4cc',
      '--bg':       '#000308',
      '--glass':    'rgba(0,10,28,0.78)',  '--glass2':  'rgba(0,18,42,0.65)',
      '--border':   'rgba(0,255,255,0.15)','--border-h':'rgba(0,255,255,0.50)',
      '--dim':      '#0d2033',
      '--neon':     '0 0 8px rgba(0,229,255,.6),0 0 22px rgba(0,229,255,.2)',
      '--neon-a':   '0 0 8px rgba(255,140,0,.6)',
      '--neon-g':   '0 0 8px rgba(0,255,136,.6)',
    }
  },
  'amber': {
    label: 'AMBER PROTOCOL', glow: 1.15,
    reactor: { r:255, g:140, b:0 },
    vars: {
      '--accent':   '#ff8c00', '--accent2':  '#cc7000',
      '--bg':       '#080300',
      '--glass':    'rgba(28,10,0,0.82)', '--glass2':  'rgba(40,15,0,0.65)',
      '--border':   'rgba(255,140,0,0.18)','--border-h':'rgba(255,140,0,0.55)',
      '--dim':      '#331800',
      '--neon':     '0 0 8px rgba(255,140,0,.6),0 0 22px rgba(255,140,0,.2)',
      '--neon-a':   '0 0 8px rgba(255,45,85,.6)',
      '--neon-g':   '0 0 8px rgba(0,255,136,.6)',
    }
  },
  'matrix': {
    label: 'MATRIX GREEN', glow: 1.2,
    reactor: { r:0, g:255, b:136 },
    vars: {
      '--accent':   '#00ff88', '--accent2':  '#00cc66',
      '--bg':       '#000803',
      '--glass':    'rgba(0,20,8,0.82)',  '--glass2':  'rgba(0,28,10,0.65)',
      '--border':   'rgba(0,255,136,0.15)','--border-h':'rgba(0,255,136,0.50)',
      '--dim':      '#0a2015',
      '--neon':     '0 0 8px rgba(0,255,136,.6),0 0 22px rgba(0,255,136,.2)',
      '--neon-a':   '0 0 8px rgba(255,140,0,.6)',
      '--neon-g':   '0 0 8px rgba(0,229,255,.6)',
    }
  },
  'red-alert': {
    label: 'RED ALERT', glow: 1.25,
    reactor: { r:255, g:45, b:85 },
    vars: {
      '--accent':   '#ff2d55', '--accent2':  '#cc1133',
      '--bg':       '#080003',
      '--glass':    'rgba(28,0,8,0.82)',  '--glass2':  'rgba(40,0,12,0.65)',
      '--border':   'rgba(255,45,85,0.18)','--border-h':'rgba(255,45,85,0.55)',
      '--dim':      '#2a0010',
      '--neon':     '0 0 8px rgba(255,45,85,.6),0 0 22px rgba(255,45,85,.2)',
      '--neon-a':   '0 0 8px rgba(255,140,0,.6)',
      '--neon-g':   '0 0 8px rgba(0,255,136,.6)',
    }
  },
  'void': {
    label: 'VOID PURPLE', glow: 1.1,
    reactor: { r:168, g:85, b:247 },
    vars: {
      '--accent':   '#a855f7', '--accent2':  '#7c3aed',
      '--bg':       '#040308',
      '--glass':    'rgba(10,5,28,0.82)', '--glass2':  'rgba(15,8,38,0.65)',
      '--border':   'rgba(168,85,247,0.18)','--border-h':'rgba(168,85,247,0.55)',
      '--dim':      '#1a0a33',
      '--neon':     '0 0 8px rgba(168,85,247,.6),0 0 22px rgba(168,85,247,.2)',
      '--neon-a':   '0 0 8px rgba(255,140,0,.6)',
      '--neon-g':   '0 0 8px rgba(0,255,136,.6)',
    }
  },

  // ── MARLAA BLOSSOM — Зөөлөн, пастел, хувийн ────────────────────
  'marlaa': {
    label: '🌸 MARLAA — BLOSSOM', glow: 0.85,
    reactor: { r:249, g:168, b:197 },
    vars: {
      '--accent':   '#f9a8c5',   // cherry blossom pink
      '--accent2':  '#e879a8',   // deeper rose
      '--bg':       '#060810',   // deep midnight navy
      '--glass':    'rgba(14,8,28,0.88)',
      '--glass2':   'rgba(20,10,38,0.70)',
      '--border':   'rgba(249,168,197,0.16)',
      '--border-h': 'rgba(249,168,197,0.50)',
      '--text':     '#e8cfe0',   // warm blush text
      '--text-b':   '#fce4f0',   // near-white blush
      '--dim':      '#1e0a28',
      '--green':    '#86efac',   // soft sage
      '--amber':    '#fbbf24',   // warm gold
      '--red':      '#fca5a5',   // soft coral
      '--yellow':   '#fde68a',   // cream yellow
      '--neon':     '0 0 8px rgba(249,168,197,.5),0 0 20px rgba(249,168,197,.15)',
      '--neon-a':   '0 0 8px rgba(251,191,36,.5)',
      '--neon-g':   '0 0 8px rgba(134,239,172,.5)',
      '--neon-r':   '0 0 8px rgba(252,165,165,.5)',
    }
  },

  // ── 🫧 LIQUID GLASS PALETTES — Apple-style, зөөлөн, шилэн ──────────
  'glass-aurora': {
    label: '🫧 AURORA GLASS', glow: 0.9,
    reactor: { r:130, g:170, b:255 },
    vars: {
      '--accent':'#82aaff','--accent2':'#5c7cfa','--bg':'#0a0e1a',
      '--glass':'rgba(40,55,95,0.45)','--glass2':'rgba(55,70,120,0.35)',
      '--border':'rgba(140,170,255,0.22)','--border-h':'rgba(140,170,255,0.55)',
      '--text':'#c8d4f0','--text-b':'#eaf0ff','--dim':'#1a2440',
      '--neon':'0 0 16px rgba(130,170,255,.4)','--neon-a':'0 0 12px rgba(167,139,250,.4)',
      '--neon-g':'0 0 12px rgba(110,231,183,.4)',
    }
  },
  'glass-sunset': {
    label: '🌅 SUNSET GLASS', glow: 0.95,
    reactor: { r:255, g:150, b:120 },
    vars: {
      '--accent':'#ff9678','--accent2':'#f97362','--bg':'#1a0e0c',
      '--glass':'rgba(80,40,35,0.45)','--glass2':'rgba(100,50,45,0.35)',
      '--border':'rgba(255,150,120,0.22)','--border-h':'rgba(255,150,120,0.55)',
      '--text':'#f0d4c8','--text-b':'#ffeae2','--dim':'#3a1f1a',
      '--neon':'0 0 16px rgba(255,150,120,.4)','--neon-a':'0 0 12px rgba(251,191,36,.4)',
      '--neon-g':'0 0 12px rgba(134,239,172,.4)',
    }
  },
  'glass-ocean': {
    label: '🌊 OCEAN GLASS', glow: 0.9,
    reactor: { r:90, g:200, b:210 },
    vars: {
      '--accent':'#5ac8d2','--accent2':'#2ba8b8','--bg':'#06141a',
      '--glass':'rgba(20,60,72,0.45)','--glass2':'rgba(28,75,90,0.35)',
      '--border':'rgba(90,200,210,0.22)','--border-h':'rgba(90,200,210,0.55)',
      '--text':'#c0e0e4','--text-b':'#e2f6f8','--dim':'#0e2c34',
      '--neon':'0 0 16px rgba(90,200,210,.4)','--neon-a':'0 0 12px rgba(96,165,250,.4)',
      '--neon-g':'0 0 12px rgba(110,231,183,.4)',
    }
  },
  'glass-forest': {
    label: '🌿 FOREST GLASS', glow: 0.9,
    reactor: { r:130, g:200, b:140 },
    vars: {
      '--accent':'#82c88c','--accent2':'#5aa868','--bg':'#08140c',
      '--glass':'rgba(25,55,35,0.45)','--glass2':'rgba(32,70,45,0.35)',
      '--border':'rgba(130,200,140,0.22)','--border-h':'rgba(130,200,140,0.55)',
      '--text':'#c8e4cc','--text-b':'#e4f6e8','--dim':'#102c18',
      '--neon':'0 0 16px rgba(130,200,140,.4)','--neon-a':'0 0 12px rgba(251,191,36,.4)',
      '--neon-g':'0 0 12px rgba(134,239,172,.4)',
    }
  },
  'glass-rose': {
    label: '🌸 ROSE GLASS', glow: 0.95,
    reactor: { r:240, g:160, b:200 },
    vars: {
      '--accent':'#f0a0c8','--accent2':'#e879a8','--bg':'#160a12',
      '--glass':'rgba(70,35,55,0.45)','--glass2':'rgba(88,42,68,0.35)',
      '--border':'rgba(240,160,200,0.22)','--border-h':'rgba(240,160,200,0.55)',
      '--text':'#f0d0e0','--text-b':'#ffe6f2','--dim':'#32142a',
      '--neon':'0 0 16px rgba(240,160,200,.4)','--neon-a':'0 0 12px rgba(251,191,36,.4)',
      '--neon-g':'0 0 12px rgba(134,239,172,.4)',
    }
  },
  'glass-mono': {
    label: '⚪ MONO GLASS', glow: 0.7,
    reactor: { r:200, g:210, b:225 },
    vars: {
      '--accent':'#c8d2e1','--accent2':'#9aa6b8','--bg':'#0c0e12',
      '--glass':'rgba(50,56,68,0.45)','--glass2':'rgba(64,72,86,0.35)',
      '--border':'rgba(200,210,225,0.18)','--border-h':'rgba(200,210,225,0.45)',
      '--text':'#c0c8d4','--text-b':'#eef2f8','--dim':'#1e242e',
      '--neon':'0 0 14px rgba(200,210,225,.3)','--neon-a':'0 0 12px rgba(251,191,36,.4)',
      '--neon-g':'0 0 12px rgba(134,239,172,.4)',
    }
  },
};

function applyTheme(themeId) {
  const theme = JARVIS_THEMES[themeId];
  if (!theme) return false;
  const root = document.documentElement;
  Object.entries(theme.vars).forEach(([k, v]) => root.style.setProperty(k, v));
  localStorage.setItem('jarvis_theme', themeId);
  // ── Theme-aware ambient glow (background гүн өгнө) ──────────────
  if (theme.reactor) {
    const { r, g, b } = theme.reactor;
    const gf = theme.glow != null ? theme.glow : 1;   // theme бүрийн glow эрчим
    root.style.setProperty('--glow-1',  `rgba(${r},${g},${b},${(0.30*gf).toFixed(3)})`);
    root.style.setProperty('--glow-2',  `rgba(${r},${g},${b},${(0.20*gf).toFixed(3)})`);
    root.style.setProperty('--glow-rgb', `${r},${g},${b}`);
    // Update reactor color if it's running
    if (window._reactor) { window._reactor.tr = r; window._reactor.tg = g; window._reactor.tb = b; }
  }
  // ── FROSTED GLASS toggle ───────────────────────────────────────
  // Touch device (утас/таблет — lag байхгүй) ЭСВЭЛ glass theme сонгосон
  // үед frosted blur асаана. Intel Mac desktop + cyber theme → унтраалттай.
  const isTouch = window.matchMedia('(pointer: coarse)').matches;
  const isGlass = themeId.startsWith('glass-');
  document.body.classList.toggle('frosted', isTouch || isGlass);
  // Persist to Firestore
  if (window._db && window._auth?.currentUser) {
    window._db.doc('users/' + window._auth.currentUser.uid + '/settings/layout')
      .set({ theme: themeId }, { merge: true }).catch(() => {});
  }
  return true;
}

function loadSavedTheme() {
  const saved = localStorage.getItem('jarvis_theme') || 'stark-cyan';
  applyTheme(saved);
  // Async override from Firestore
  if (window._db && window._auth?.currentUser) {
    window._db.doc('users/' + window._auth.currentUser.uid + '/settings/layout')
      .get()
      .then(snap => { if (snap.exists && snap.data().theme) applyTheme(snap.data().theme); })
      .catch(() => {});
  }
}
