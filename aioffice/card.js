// AI Оффис post card (1080x1350). p = {id, kicker, accent, title, sub, source, theme?}
// theme: ai (default) | gaming | space | money | security | gadget | car
// Every illustration is drawn here in code (no outside photos or artwork).
window.CARD_THEMES = {
  ai:       { bg: '#05070f', glow: [40, 110, 255], grid: 'rgba(80,140,255,0.07)', acc: ['#4f8dff', '#33d6ff'], pill: ['rgba(30,70,160,0.45)', 'rgba(100,160,255,0.6)', '#cfe0ff'], sub: '#9fb4d8', foot: '#6f84a8' },
  gaming:   { bg: '#0d0614', glow: [255, 60, 170], grid: 'rgba(255,80,200,0.06)', acc: ['#ff4fb8', '#ffb347'], pill: ['rgba(150,30,110,0.45)', 'rgba(255,120,200,0.6)', '#ffd6ef'], sub: '#d9a9c8', foot: '#a07890' },
  space:    { bg: '#03040b', glow: [120, 90, 255], grid: 'rgba(140,120,255,0.05)', acc: ['#9d7bff', '#4fd1ff'], pill: ['rgba(70,50,160,0.45)', 'rgba(160,140,255,0.6)', '#e0d8ff'], sub: '#a9a6d8', foot: '#7a78a8' },
  money:    { bg: '#03100b', glow: [30, 220, 130], grid: 'rgba(60,220,140,0.06)', acc: ['#2ee88f', '#c6f36b'], pill: ['rgba(20,120,70,0.45)', 'rgba(80,230,150,0.6)', '#d4ffe8'], sub: '#9cc9b1', foot: '#6f9a84' },
  security: { bg: '#120606', glow: [255, 70, 50], grid: 'rgba(255,90,70,0.06)', acc: ['#ff5a45', '#ffc14d'], pill: ['rgba(150,30,20,0.5)', 'rgba(255,120,100,0.6)', '#ffd9d2'], sub: '#d6a9a1', foot: '#a07a74' },
  gadget:   { bg: '#07080c', glow: [200, 210, 230], grid: 'rgba(200,210,240,0.05)', acc: ['#e8ecf5', '#8fb6ff'], pill: ['rgba(80,90,110,0.45)', 'rgba(200,210,235,0.6)', '#eef2fa'], sub: '#aab3c5', foot: '#7c8496' },
  car:      { bg: '#040b0e', glow: [0, 200, 220], grid: 'rgba(0,200,220,0.06)', acc: ['#19d3e6', '#ff4d5e'], pill: ['rgba(0,100,120,0.45)', 'rgba(60,220,235,0.6)', '#d2f9ff'], sub: '#97c3ca', foot: '#6e959b' },
};

window.makeCard = async function (p) {
  const W = 1080, H = 1350;
  const T = window.CARD_THEMES[p.theme] || window.CARD_THEMES.ai;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d');
  const F = '-apple-system, "SF Pro Display", "Helvetica Neue", Inter, Arial, sans-serif';
  const LS = v => { if ('letterSpacing' in x) x.letterSpacing = v; };
  const rgba = (rgb, a) => `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${a})`;
  let seed = 7; const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };

  x.fillStyle = T.bg; x.fillRect(0, 0, W, H);
  // grid
  x.strokeStyle = T.grid; x.lineWidth = 1;
  for (let i = 0; i < W; i += 54) { x.beginPath(); x.moveTo(i + .5, 0); x.lineTo(i + .5, H); x.stroke(); }
  for (let j = 0; j < H; j += 54) { x.beginPath(); x.moveTo(0, j + .5); x.lineTo(W, j + .5); x.stroke(); }
  const fade = x.createRadialGradient(W * .7, H * .3, 150, W * .7, H * .3, 1000);
  fade.addColorStop(0, 'rgba(0,0,0,0)'); fade.addColorStop(1, T.bg);
  x.fillStyle = fade; x.fillRect(0, 0, W, H);
  const g = x.createRadialGradient(W * .72, H * .3, 0, W * .72, H * .3, 620);
  g.addColorStop(0, rgba(T.glow, 0.38)); g.addColorStop(.5, rgba(T.glow, 0.07)); g.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = g; x.fillRect(0, 0, W, H);

  // ---------- theme illustrations (upper area) ----------
  const ART = {
    ai() {
      const nodes = [];
      for (let i = 0; i < 26; i++) nodes.push([560 + rnd() * 470, 180 + rnd() * 300]);
      x.lineWidth = 1.5;
      for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) {
        const d = Math.hypot(nodes[i][0] - nodes[j][0], nodes[i][1] - nodes[j][1]);
        if (d < 150) { x.strokeStyle = `rgba(90,160,255,${0.35 * (1 - d / 150)})`; x.beginPath(); x.moveTo(...nodes[i]); x.lineTo(...nodes[j]); x.stroke(); }
      }
      for (const n of nodes) { x.beginPath(); x.arc(n[0], n[1], 3 + rnd() * 4, 0, 7); x.fillStyle = 'rgba(120,190,255,0.8)'; x.fill(); }
    },
    gaming() {
      // synthwave sunset over a city with palms (generic, original)
      const hz = 470;
      const sky = x.createLinearGradient(0, 160, 0, hz);
      sky.addColorStop(0, 'rgba(60,10,90,0)'); sky.addColorStop(.6, 'rgba(180,30,120,0.35)'); sky.addColorStop(1, 'rgba(255,120,60,0.45)');
      x.fillStyle = sky; x.fillRect(0, 160, W, hz - 160);
      const sx = 760, sy = 360, sr = 150;
      x.save(); x.beginPath(); x.rect(0, 0, W, hz); x.clip();
      const sun = x.createLinearGradient(0, sy - sr, 0, sy + sr);
      sun.addColorStop(0, '#ffd34d'); sun.addColorStop(.55, '#ff6a5c'); sun.addColorStop(1, '#ff2d95');
      x.beginPath(); x.arc(sx, sy, sr, 0, 7); x.fillStyle = sun; x.fill();
      x.fillStyle = T.bg;
      for (let k = 0; k < 6; k++) { const yy = sy + 10 + k * 22; x.fillRect(sx - sr, yy, sr * 2, 4 + k * 2); }
      x.restore();
      // skyline
      x.fillStyle = '#1a0820';
      let bx = 470;
      while (bx < W) { const bw = 26 + rnd() * 50, bh = 30 + rnd() * 120; x.fillRect(bx, hz - bh, bw, bh); bx += bw + 4; }
      // palms
      const palm = (px, ph, lean) => {
        x.strokeStyle = '#12051a'; x.lineWidth = 9; x.lineCap = 'round';
        x.beginPath(); x.moveTo(px, hz); x.quadraticCurveTo(px + lean * .4, hz - ph * .6, px + lean, hz - ph); x.stroke();
        const tx = px + lean, ty = hz - ph; x.fillStyle = '#12051a';
        for (let a = 0; a < 7; a++) {
          const ang = -Math.PI + a * Math.PI / 6 + (rnd() - .5) * .2, L = 70 + rnd() * 25;
          x.beginPath(); x.moveTo(tx, ty);
          x.quadraticCurveTo(tx + Math.cos(ang) * L * .6, ty + Math.sin(ang) * L * .6 - 22, tx + Math.cos(ang) * L, ty + Math.sin(ang) * L + 18);
          x.quadraticCurveTo(tx + Math.cos(ang) * L * .5, ty + Math.sin(ang) * L * .5, tx, ty + 6); x.fill();
        }
      };
      palm(600, 230, -30); palm(980, 270, 25);
      // floor grid
      x.strokeStyle = 'rgba(255,80,200,0.35)'; x.lineWidth = 2;
      for (let k = -10; k <= 10; k++) { x.beginPath(); x.moveTo(760 + k * 30, hz); x.lineTo(760 + k * 160, hz + 170); x.stroke(); }
      for (let k = 1; k < 7; k++) { const yy = hz + k * k * 4.5; x.beginPath(); x.moveTo(0, yy); x.lineTo(W, yy); x.stroke(); }
    },
    space() {
      for (let i = 0; i < 220; i++) { x.fillStyle = `rgba(255,255,255,${0.2 + rnd() * 0.7})`; x.fillRect(rnd() * W, rnd() * 700, rnd() < .1 ? 3 : 1.6, rnd() < .1 ? 3 : 1.6); }
      // planet + ring
      const px = 860, py = 290, pr = 130;
      const pg = x.createRadialGradient(px - 50, py - 50, 10, px, py, pr);
      pg.addColorStop(0, '#8a7dff'); pg.addColorStop(.7, '#3b2a8f'); pg.addColorStop(1, '#120a33');
      x.beginPath(); x.arc(px, py, pr, 0, 7); x.fillStyle = pg; x.fill();
      x.save(); x.translate(px, py); x.rotate(-0.35);
      x.strokeStyle = 'rgba(180,170,255,0.55)'; x.lineWidth = 8;
      x.beginPath(); x.ellipse(0, 0, 230, 52, 0, 0.05 * Math.PI, 0.95 * Math.PI); x.stroke();
      x.restore();
      // rocket rising (simple original shape)
      x.save(); x.translate(560, 330); x.rotate(0.45);
      const fl = x.createLinearGradient(0, 60, 0, 210);
      fl.addColorStop(0, 'rgba(255,220,120,0.95)'); fl.addColorStop(.5, 'rgba(255,120,60,0.6)'); fl.addColorStop(1, 'rgba(255,60,60,0)');
      x.fillStyle = fl; x.beginPath(); x.moveTo(-16, 70); x.quadraticCurveTo(0, 230, 16, 70); x.fill();
      x.fillStyle = '#dfe3ee';
      x.beginPath(); x.moveTo(0, -90); x.quadraticCurveTo(24, -50, 22, 70); x.lineTo(-22, 70); x.quadraticCurveTo(-24, -50, 0, -90); x.fill();
      x.fillStyle = '#9aa3b8'; x.beginPath(); x.moveTo(-22, 40); x.lineTo(-40, 80); x.lineTo(-22, 70); x.fill();
      x.beginPath(); x.moveTo(22, 40); x.lineTo(40, 80); x.lineTo(22, 70); x.fill();
      x.restore();
      // orbit
      x.setLineDash([6, 10]); x.strokeStyle = 'rgba(150,140,255,0.35)'; x.lineWidth = 2;
      x.beginPath(); x.ellipse(800, 300, 330, 120, -0.2, 0, 7); x.stroke(); x.setLineDash([]);
    },
    money() {
      let v = 470; const pts = [];
      for (let i = 0; i < 22; i++) {
        const o = v, cl = Math.max(240, v - 6 - (rnd() - .35) * 45); const hi = Math.min(o, cl) - rnd() * 25, lo = Math.max(o, cl) + rnd() * 25;
        const cx = 470 + i * 26; const up = cl < o;
        x.strokeStyle = x.fillStyle = up ? 'rgba(46,232,143,0.85)' : 'rgba(255,90,90,0.75)';
        x.lineWidth = 2; x.beginPath(); x.moveTo(cx, hi); x.lineTo(cx, lo); x.stroke();
        x.fillRect(cx - 8, Math.min(o, cl), 16, Math.max(4, Math.abs(cl - o)));
        pts.push([cx, cl]); v = cl;
      }
      x.strokeStyle = 'rgba(198,243,107,0.9)'; x.lineWidth = 4; x.beginPath();
      pts.forEach((q, i) => i ? x.lineTo(...q) : x.moveTo(...q)); x.stroke();
      x.font = `800 260px ${F}`; x.fillStyle = 'rgba(46,232,143,0.08)'; x.textAlign = 'right'; x.textBaseline = 'alphabetic';
      x.fillText('$', W - 60, 420);
    },
    security() {
      x.font = `600 22px ui-monospace, Menlo, monospace`; x.textAlign = 'left';
      for (let col = 0; col < 22; col++) for (let r = 0; r < 18; r++) {
        if (rnd() < .45) continue;
        x.fillStyle = `rgba(255,90,70,${0.05 + rnd() * 0.25})`;
        x.fillText(rnd() < .5 ? '0' : '1', 460 + col * 28, 190 + r * 26);
      }
      // padlock
      const lx = 830, ly = 300;
      x.strokeStyle = 'rgba(255,193,77,0.9)'; x.lineWidth = 22; x.lineCap = 'round';
      x.beginPath(); x.arc(lx, ly - 20, 70, Math.PI, 0); x.lineTo(lx + 70, ly + 10); x.moveTo(lx - 70, ly - 20); x.lineTo(lx - 70, ly - 50); x.stroke();
      const bg = x.createLinearGradient(lx - 110, ly, lx + 110, ly + 170);
      bg.addColorStop(0, '#ff6a4d'); bg.addColorStop(1, '#b3201a');
      x.beginPath(); x.roundRect(lx - 110, ly + 10, 220, 170, 26); x.fillStyle = bg; x.fill();
      x.fillStyle = T.bg; x.beginPath(); x.arc(lx, ly + 80, 20, 0, 7); x.fill(); x.fillRect(lx - 8, ly + 90, 16, 50);
    },
    gadget() {
      x.save(); x.translate(830, 400); x.rotate(0.18); x.scale(0.85, 0.85);
      x.shadowColor = 'rgba(143,182,255,0.5)'; x.shadowBlur = 60;
      x.beginPath(); x.roundRect(-110, -220, 220, 440, 40); x.fillStyle = '#1a1d26'; x.fill();
      x.shadowBlur = 0; x.lineWidth = 4; x.strokeStyle = 'rgba(220,228,245,0.7)'; x.stroke();
      const sc = x.createLinearGradient(-95, -200, 95, 200);
      sc.addColorStop(0, '#3a5bd9'); sc.addColorStop(.5, '#8f5bd9'); sc.addColorStop(1, '#20c4d9');
      x.beginPath(); x.roundRect(-96, -206, 192, 412, 30); x.fillStyle = sc; x.fill();
      x.beginPath(); x.roundRect(-34, -194, 68, 18, 9); x.fillStyle = '#0b0c10'; x.fill();
      x.restore();
      x.strokeStyle = 'rgba(200,210,240,0.25)'; x.lineWidth = 2;
      for (let k = 1; k <= 3; k++) { x.beginPath(); x.arc(830, 400, 180 + k * 60, -0.9, 0.5); x.stroke(); }
    },
    car() {
      const vx = 780, vy = 300;
      x.strokeStyle = 'rgba(0,200,220,0.35)'; x.lineWidth = 2;
      for (let k = -6; k <= 6; k++) { x.beginPath(); x.moveTo(vx, vy); x.lineTo(vx + k * 120, 620); x.stroke(); }
      for (let i = 0; i < 26; i++) {
        const t = 0.15 + rnd() * 0.85, side = rnd() < .5 ? -1 : 1, spread = 60 + rnd() * 500;
        const ex = vx + side * spread * t, ey = vy + (620 - vy) * t, len = 30 + 120 * t;
        x.strokeStyle = side < 0 ? `rgba(25,211,230,${0.3 + t * 0.5})` : `rgba(255,77,94,${0.3 + t * 0.5})`;
        x.lineWidth = 2 + t * 5; x.lineCap = 'round';
        const dx = (ex - vx), dy = (ey - vy), n = Math.hypot(dx, dy);
        x.beginPath(); x.moveTo(ex, ey); x.lineTo(ex + dx / n * len, ey + dy / n * len); x.stroke();
      }
      const hz = x.createRadialGradient(vx, vy, 0, vx, vy, 160);
      hz.addColorStop(0, 'rgba(210,249,255,0.6)'); hz.addColorStop(1, 'rgba(0,0,0,0)');
      x.fillStyle = hz; x.fillRect(vx - 160, vy - 160, 320, 320);
    },
  };
  x.save(); x.beginPath(); x.rect(0, 180, W, 460); x.clip();
  (ART[p.theme] || ART.ai)();
  x.restore();
  // keep the text zone readable
  const ov = x.createLinearGradient(0, 330, 0, 640);
  ov.addColorStop(0, 'rgba(0,0,0,0)'); ov.addColorStop(1, T.bg);
  x.fillStyle = ov; x.fillRect(0, 330, W, 310);
  x.fillStyle = T.bg; x.fillRect(0, 640, W, H - 640);
  const side = x.createLinearGradient(0, 0, 620, 0);
  side.addColorStop(0, T.bg); side.addColorStop(1, 'rgba(0,0,0,0)');
  x.globalAlpha = 0.55; x.fillStyle = side; x.fillRect(0, 160, 620, 480); x.globalAlpha = 1;

  const M = 84;
  // kicker pill
  x.font = `700 28px ${F}`; LS('4px');
  const kw = x.measureText(p.kicker).width + 52;
  x.beginPath(); x.roundRect(M, 96, kw, 60, 30);
  x.fillStyle = T.pill[0]; x.fill();
  x.lineWidth = 2; x.strokeStyle = T.pill[1]; x.stroke();
  x.fillStyle = T.pill[2]; x.textBaseline = 'middle'; x.textAlign = 'left';
  x.fillText(p.kicker, M + 26, 127);
  // brand top right
  LS('0px'); x.font = `700 30px ${F}`; x.textAlign = 'right'; x.fillStyle = '#ffffff';
  x.fillText('AI Оффис', W - M, 127);
  // accent
  x.textBaseline = 'alphabetic'; x.textAlign = 'left';
  let as = 190; LS('-4px');
  do { x.font = `800 ${as}px ${F}`; as -= 6; } while (x.measureText(p.accent).width > W - 2 * M && as > 60);
  const ag = x.createLinearGradient(M, 0, M + x.measureText(p.accent).width, 0);
  ag.addColorStop(0, T.acc[0]); ag.addColorStop(1, T.acc[1]);
  x.shadowColor = 'rgba(0,0,0,0.6)'; x.shadowBlur = 30;
  x.fillStyle = ag; const ay = 520; x.fillText(p.accent, M, ay);
  x.shadowBlur = 0;
  // title wrap
  LS('-1.5px');
  const wrap = (txt, size, maxW) => {
    x.font = `800 ${size}px ${F}`;
    const words = txt.split(' '); const lines = []; let cur = '';
    for (const w of words) { const t = cur ? cur + ' ' + w : w; if (x.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t; }
    if (cur) lines.push(cur); return lines;
  };
  let ts = 84, lines = wrap(p.title, ts, W - 2 * M);
  while (lines.length > 4 && ts > 56) { ts -= 4; lines = wrap(p.title, ts, W - 2 * M); }
  x.fillStyle = '#ffffff'; let ty = ay + 70 + ts;
  for (const l of lines) { x.fillText(l, M, ty); ty += ts * 1.14; }
  // sub
  LS('0px'); x.font = `500 42px ${F}`; x.fillStyle = T.sub;
  x.fillText(p.sub, M, ty + 30);
  // footer
  const fy = H - 120;
  const lg = x.createLinearGradient(M, 0, W - M, 0);
  lg.addColorStop(0, rgba(T.glow, 0.7)); lg.addColorStop(1, rgba(T.glow, 0));
  x.fillStyle = lg; x.fillRect(M, fy - 50, W - 2 * M, 2);
  // mini logo
  x.beginPath(); x.arc(M + 30, fy + 8, 30, 0, Math.PI * 2); x.fillStyle = T.bg; x.fill();
  const rg = x.createLinearGradient(M, fy - 22, M + 60, fy + 38); rg.addColorStop(0, T.acc[0]); rg.addColorStop(1, T.acc[1]);
  x.lineWidth = 3; x.strokeStyle = rg; x.stroke();
  x.font = `900 24px ${F}`; x.textAlign = 'center'; x.fillStyle = '#fff'; x.fillText('AI', M + 30, fy + 17);
  x.textAlign = 'left'; x.font = `600 28px ${F}`; x.fillStyle = '#e6ebf5'; x.fillText('Дэлхийн AI мэдээ, өдөр бүр', M + 80, fy + 18);
  x.textAlign = 'right'; x.font = `500 24px ${F}`; x.fillStyle = T.foot; x.fillText(p.source, W - M, fy + 18);
  const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.93));
  return { file: new File([blob], `aioffice-${p.id}.jpg`, { type: 'image/jpeg' }), url: c.toDataURL('image/jpeg', 0.9) };
};
