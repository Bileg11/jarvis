// ── T.H.R.E.E. OS — Dynamic Theme System ──────────────────────────
'use strict';

const JARVIS_THEMES = {
  'stark-cyan': {
    label: 'CYAN EDGE',
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
    label: 'AMBER PROTOCOL',
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
    label: 'MATRIX GREEN',
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
    label: 'RED ALERT',
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
    label: 'VOID PURPLE',
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
    label: '🌸 MARLAA — BLOSSOM',
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
};

function applyTheme(themeId) {
  const theme = JARVIS_THEMES[themeId];
  if (!theme) return false;
  const root = document.documentElement;
  Object.entries(theme.vars).forEach(([k, v]) => root.style.setProperty(k, v));
  localStorage.setItem('jarvis_theme', themeId);
  // Update reactor color if it's running
  if (window._reactor && theme.reactor) {
    const { r, g, b } = theme.reactor;
    window._reactor.tr = r; window._reactor.tg = g; window._reactor.tb = b;
  }
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
