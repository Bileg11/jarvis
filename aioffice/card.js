window.makeCard = async function (p) {
  const W = 1080, H = 1350;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d');
  const F = '-apple-system, "SF Pro Display", "Helvetica Neue", Inter, Arial, sans-serif';
  const LS = v => { if ('letterSpacing' in x) x.letterSpacing = v; };
  x.fillStyle = '#05070f'; x.fillRect(0, 0, W, H);
  // grid
  x.strokeStyle = 'rgba(80,140,255,0.07)'; x.lineWidth = 1;
  for (let i = 0; i < W; i += 54) { x.beginPath(); x.moveTo(i + .5, 0); x.lineTo(i + .5, H); x.stroke(); }
  for (let j = 0; j < H; j += 54) { x.beginPath(); x.moveTo(0, j + .5); x.lineTo(W, j + .5); x.stroke(); }
  const fade = x.createRadialGradient(W * .7, H * .3, 150, W * .7, H * .3, 1000);
  fade.addColorStop(0, 'rgba(5,7,15,0)'); fade.addColorStop(1, 'rgba(5,7,15,1)');
  x.fillStyle = fade; x.fillRect(0, 0, W, H);
  const g = x.createRadialGradient(W * .72, H * .3, 0, W * .72, H * .3, 620);
  g.addColorStop(0, 'rgba(40,110,255,0.38)'); g.addColorStop(.5, 'rgba(0,200,255,0.07)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = g; x.fillRect(0, 0, W, H);
  const M = 84;
  // kicker pill
  x.font = `700 28px ${F}`; LS('4px');
  const kw = x.measureText(p.kicker).width + 52;
  x.beginPath(); x.roundRect(M, 96, kw, 60, 30);
  x.fillStyle = 'rgba(30,70,160,0.45)'; x.fill();
  x.lineWidth = 2; x.strokeStyle = 'rgba(100,160,255,0.6)'; x.stroke();
  x.fillStyle = '#cfe0ff'; x.textBaseline = 'middle'; x.textAlign = 'left';
  x.fillText(p.kicker, M + 26, 127);
  // brand top right
  LS('0px'); x.font = `700 30px ${F}`; x.textAlign = 'right'; x.fillStyle = '#ffffff';
  x.fillText('AI Оффис', W - M, 127);
  // accent
  x.textBaseline = 'alphabetic'; x.textAlign = 'left';
  let as = 190; LS('-4px');
  do { x.font = `800 ${as}px ${F}`; as -= 6; } while (x.measureText(p.accent).width > W - 2 * M && as > 60);
  const ag = x.createLinearGradient(M, 0, M + x.measureText(p.accent).width, 0);
  ag.addColorStop(0, '#4f8dff'); ag.addColorStop(1, '#33d6ff');
  x.fillStyle = ag; const ay = 520; x.fillText(p.accent, M, ay);
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
  LS('0px'); x.font = `500 42px ${F}`; x.fillStyle = '#9fb4d8';
  x.fillText(p.sub, M, ty + 30);
  // footer
  const fy = H - 120;
  const lg = x.createLinearGradient(M, 0, W - M, 0);
  lg.addColorStop(0, 'rgba(59,130,246,.7)'); lg.addColorStop(1, 'rgba(59,130,246,0)');
  x.fillStyle = lg; x.fillRect(M, fy - 50, W - 2 * M, 2);
  // mini logo
  x.beginPath(); x.arc(M + 30, fy + 8, 30, 0, Math.PI * 2); x.fillStyle = '#05070f'; x.fill();
  const rg = x.createLinearGradient(M, fy - 22, M + 60, fy + 38); rg.addColorStop(0, '#4f8dff'); rg.addColorStop(1, '#33d6ff');
  x.lineWidth = 3; x.strokeStyle = rg; x.stroke();
  x.font = `900 24px ${F}`; x.textAlign = 'center'; x.fillStyle = '#fff'; x.fillText('AI', M + 30, fy + 17);
  x.textAlign = 'left'; x.font = `600 28px ${F}`; x.fillStyle = '#dbe7ff'; x.fillText('Дэлхийн AI мэдээ, өдөр бүр', M + 80, fy + 18);
  x.textAlign = 'right'; x.font = `500 24px ${F}`; x.fillStyle = '#6f84a8'; x.fillText(p.source, W - M, fy + 18);
  const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.93));
  return { file: new File([blob], `aioffice-${p.id}.jpg`, { type: 'image/jpeg' }), url: c.toDataURL('image/jpeg', 0.9) };
};
