import React from 'react';
import {
  AbsoluteFill,
  Img,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
  continueRender,
  delayRender,
  getInputProps,
} from 'remotion';
import '@fontsource/montserrat/800.css';
import '@fontsource/montserrat/900.css';
import '@fontsource/inter/400.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/400-italic.css';
import '@fontsource/noto-sans-sc/700.css';

export const C = {
  navy: '#0E2A78',
  deep: '#081A4D',
  gold: '#D4A640',
  lgold: '#F2D58A',
  ivory: '#FAF7F0',
  red: '#E8392A',
};

export const F = {
  head: 'Montserrat, sans-serif',
  body: 'Inter, sans-serif',
  zh: '"Noto Sans SC", sans-serif',
};

// Instagram safe zone on 1080x1920: keep text between y=230 and y=1440,
// and the right 230px clear. Content column = x 60..850.
export const SAFE = {top: 250, bottom: 1440, left: 60, width: 790};

// Fixed 3-zone grid, same in every reel:
// HEADER 250-330 series label | TITLE 400-740 headline | BODY 760 | VISUAL 820-1270 | FOOTER 1300-1420
export const Z = {header: 250, title: 400, body: 760, visual: 820, floor: 1270, footer: 1300};

// Wait for web fonts so frame 1 never renders in a fallback font.
const FontGate: React.FC = () => {
  const [handle] = React.useState(() => delayRender('fonts'));
  React.useEffect(() => {
    const load = Promise.all([
      document.fonts.load('900 80px Montserrat', 'ӨҮАБ'),
      document.fonts.load('800 80px Montserrat', 'ӨҮАБ'),
      document.fonts.load('400 40px Inter', 'ӨҮаб'),
      document.fonts.load('600 40px Inter', 'ӨҮаб'),
      document.fonts.load('italic 400 40px Inter', 'nǐ hǎo'),
      document.fonts.load('700 80px "Noto Sans SC"', '你好这个谢谢不要辣吗高德地图'),
    ]);
    load.then(() => document.fonts.ready).then(() => continueRender(handle));
  }, [handle]);
  return null;
};

export const pop = (frame: number, fps: number, start: number, damping = 14) =>
  spring({frame: frame - start + 6, fps, config: {damping, mass: 0.6}});

export const fadeIn = (frame: number, start: number, len = 8) =>
  interpolate(frame + 4, [start, start + len], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});

export const Frame: React.FC<{
  label: string;
  children: React.ReactNode;
  logoSrc?: string | null;
  hideFooter?: boolean;
  outroFrom?: number;
}> = ({label, children, logoSrc = 'logo-round.png', hideFooter = false, outroFrom}) => {
  const frame = useCurrentFrame();
  const outro = outroFrom !== undefined && frame >= outroFrom;
  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(180deg, ${C.navy} 0%, ${C.deep} 100%)`,
        fontFamily: F.body,
        color: C.ivory,
      }}
    >
      <FontGate />
      {/* subtle skyline texture */}
      <svg width={1080} height={1920} style={{position: 'absolute', opacity: 0.07}}>
        <path
          d="M0 1700 L120 1700 L120 1560 L170 1560 L170 1640 L260 1640 L260 1480 L290 1420 L320 1480 L320 1700 L430 1700 L430 1300 L445 1240 L460 1300 L460 1700 L560 1700 L560 1520 L640 1520 L640 1700 L720 1700 L720 1380 L790 1380 L790 1700 L1080 1700 L1080 1920 L0 1920 Z"
          fill={C.lgold}
        />
      </svg>
      <div
        style={{
          position: 'absolute',
          top: Z.header,
          left: SAFE.left,
          fontFamily: F.head,
          fontWeight: 800,
          fontSize: 30,
          letterSpacing: 3,
          color: C.lgold,
        }}
      >
        {label}
      </div>
      {children}
      {getInputProps().safe ? (
        <>
          <div style={{position: 'absolute', left: 0, top: 0, width: 1080, height: 230, background: 'rgba(255,0,0,0.35)'}} />
          <div style={{position: 'absolute', left: 0, top: 1440, width: 1080, height: 480, background: 'rgba(255,0,0,0.35)'}} />
          <div style={{position: 'absolute', left: 850, top: 230, width: 230, height: 1210, background: 'rgba(255,0,0,0.35)'}} />
        </>
      ) : null}
      {!hideFooter && (outro ? <OutroLogo logoSrc={logoSrc} start={outroFrom!} /> : <Footer logoSrc={logoSrc} />)}
    </AbsoluteFill>
  );
};

export const Footer: React.FC<{logoSrc?: string | null; centered?: boolean}> = ({logoSrc = null, centered}) => (
  <div
    style={{
      position: 'absolute',
      top: Z.footer,
      left: centered ? 0 : SAFE.left,
      width: centered ? 1080 : SAFE.width,
      display: 'flex',
      alignItems: 'center',
      justifyContent: centered ? 'center' : 'space-between',
      gap: 24,
    }}
  >
    <div style={{fontFamily: F.body, fontWeight: 600, fontSize: 30, color: C.ivory, opacity: 0.85}}>
      lfsshanghai.com
    </div>
    {logoSrc ? (
      <Img src={staticFile(logoSrc)} style={{width: 120, height: 120}} />
    ) : (
      <div
        style={{
          width: 96,
          height: 96,
          borderRadius: 48,
          border: `3px solid ${C.gold}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: F.head,
          fontWeight: 900,
          fontSize: 28,
          color: C.gold,
        }}
      >
        LFS
      </div>
    )}
  </div>
);

export const OutroLogo: React.FC<{logoSrc?: string | null; start: number}> = ({logoSrc, start}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const p = pop(frame, fps, start, 12);
  return (
    <div style={{position: 'absolute', top: 1080, left: 0, width: 1080, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18}}>
      {logoSrc ? (
        <Img src={staticFile(logoSrc)} style={{width: 260, height: 260, transform: `scale(${0.8 + 0.2 * p})`, opacity: p}} />
      ) : null}
      <div style={{fontFamily: F.body, fontWeight: 600, fontSize: 34, color: C.ivory, opacity: 0.9}}>lfsshanghai.com</div>
    </div>
  );
};

export const Headline: React.FC<{
  lines: string[];
  start?: number;
  top?: number;
  size?: number;
  color?: string;
  center?: boolean;
}> = ({lines, start = 0, top = Z.title, size = 92, color = C.gold, center}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  return (
    <div style={{position: 'absolute', top, left: SAFE.left, width: center ? 960 : SAFE.width}}>
      {lines.map((l, i) => {
        const p = pop(frame, fps, start + i * 5);
        return (
          <div
            key={i}
            style={{
              fontFamily: F.head,
              fontWeight: 900,
              fontSize: size,
              lineHeight: 1.08,
              color: i === 0 ? color : C.ivory,
              transform: `translateY(${(1 - p) * 40}px)`,
              opacity: p,
              textAlign: center ? 'center' : 'left',
              marginBottom: 10,
            }}
          >
            {l}
          </div>
        );
      })}
    </div>
  );
};

export const Body: React.FC<{text: string; start: number; top: number; size?: number; color?: string}> = ({
  text,
  start,
  top,
  size = 50,
  color = C.ivory,
}) => {
  const frame = useCurrentFrame();
  return (
    <div
      style={{
        position: 'absolute',
        top,
        left: SAFE.left,
        width: SAFE.width,
        fontFamily: F.body,
        fontWeight: 600,
        fontSize: size,
        lineHeight: 1.25,
        color,
        opacity: fadeIn(frame, start),
        transform: `translateY(${(1 - fadeIn(frame, start)) * 20}px)`,
      }}
    >
      {text}
    </div>
  );
};

// 汉字 / pinyin / Mongolian meaning / situation
export const WordCard: React.FC<{
  zh: string;
  py: string;
  mn: string;
  when: string;
  start: number;
  top?: number;
  index?: string;
}> = ({zh, py, mn, when, start, top = Z.title, index}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const p = pop(frame, fps, start, 12);
  return (
    <div
      style={{
        position: 'absolute',
        top,
        left: SAFE.left,
        width: SAFE.width,
        padding: '40px 44px 34px',
        boxSizing: 'border-box',
        borderRadius: 36,
        background: 'rgba(250,247,240,0.06)',
        border: `2px solid ${C.gold}`,
        transform: `scale(${0.85 + p * 0.15})`,
        opacity: p,
      }}
    >
      {index && (
        <div style={{fontFamily: F.head, fontWeight: 800, fontSize: 30, color: C.gold, marginBottom: 12}}>{index}</div>
      )}
      <div style={{fontFamily: F.zh, fontWeight: 700, fontSize: 150, lineHeight: 1.05, color: C.ivory}}>{zh}</div>
      <div style={{fontFamily: F.body, fontStyle: 'italic', fontSize: 64, color: C.lgold, marginTop: 8}}>{py}</div>
      <div
        style={{
          fontFamily: F.head,
          fontWeight: 900,
          fontSize: 66,
          color: C.gold,
          marginTop: 22,
          opacity: fadeIn(frame, start + 12),
        }}
      >
        {mn}
      </div>
      <div style={{height: 2, background: C.lgold, opacity: 0.4, margin: '26px 0 20px'}} />
      <div style={{fontSize: 40, color: C.ivory, opacity: fadeIn(frame, start + 20) * 0.9}}>{when}</div>
    </div>
  );
};

// Faceless traveler character. mood 0 = calm, 1 = panic.
export const Traveler: React.FC<{
  x: number;
  y: number;
  scale?: number;
  mood?: number;
  wave?: boolean;
  point?: boolean;
  walking?: boolean;
  flush?: number;
}> = ({x, y, scale = 1, mood = 0, wave, point, walking, flush = 0}) => {
  const frame = useCurrentFrame();
  const bob = walking ? Math.sin(frame / 3) * 8 : Math.sin(frame / 12) * 4;
  const armAngle = wave ? Math.sin(frame / 3) * 30 - 40 : point ? -70 : 10;
  const face = `rgb(${250 - flush * 10},${247 - flush * 140},${240 - flush * 150})`;
  return (
    <svg
      width={300}
      height={420}
      viewBox="0 0 300 420"
      style={{position: 'absolute', left: x, top: y + bob, transform: `scale(${scale})`, transformOrigin: 'top left'}}
    >
      {/* backpack */}
      <rect x={70} y={170} width={60} height={110} rx={18} fill={C.gold} />
      {/* body */}
      <rect x={95} y={160} width={120} height={150} rx={50} fill={C.lgold} />
      {/* arm */}
      <g transform={`rotate(${armAngle} 200 190)`}>
        <rect x={190} y={180} width={90} height={30} rx={15} fill={C.lgold} />
        {point && <rect x={268} y={186} width={34} height={14} rx={7} fill={face} />}
      </g>
      {/* legs */}
      <rect x={115} y={295} width={32} height={90} rx={16} fill={C.ivory}
        transform={walking ? `rotate(${Math.sin(frame / 3) * 18} 131 300)` : ''} />
      <rect x={165} y={295} width={32} height={90} rx={16} fill={C.ivory}
        transform={walking ? `rotate(${-Math.sin(frame / 3) * 18} 181 300)` : ''} />
      {/* head */}
      <circle cx={155} cy={95} r={78} fill={face} />
      {/* eyes */}
      <circle cx={128} cy={92} r={mood > 0.5 ? 12 : 9} fill={C.deep} />
      <circle cx={182} cy={92} r={mood > 0.5 ? 12 : 9} fill={C.deep} />
      {/* mouth */}
      {mood > 0.5 ? (
        <ellipse cx={155} cy={130} rx={18} ry={14} fill={C.deep} />
      ) : (
        <path d="M128 124 Q155 146 182 124" stroke={C.deep} strokeWidth={7} fill="none" strokeLinecap="round" />
      )}
      {/* sweat */}
      {mood > 0.3 && <path d="M232 60 q10 18 0 26 q-10 -8 0 -26" fill="#8EC5FF" opacity={mood} />}
    </svg>
  );
};

export const Bubble: React.FC<{x: number; y: number; start: number; children: React.ReactNode; w?: number}> = ({
  x,
  y,
  start,
  children,
  w = 520,
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const p = pop(frame, fps, start);
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: w,
        padding: '28px 36px',
        boxSizing: 'border-box',
        background: C.ivory,
        color: C.deep,
        borderRadius: 32,
        transform: `scale(${p})`,
        transformOrigin: 'bottom left',
      }}
    >
      {children}
    </div>
  );
};

export const Phone: React.FC<{x: number; y: number; children?: React.ReactNode; scale?: number}> = ({
  x,
  y,
  children,
  scale = 1,
}) => (
  <div
    style={{
      position: 'absolute',
      left: x,
      top: y,
      width: 300,
      height: 560,
      borderRadius: 44,
      border: `10px solid ${C.ivory}`,
      background: C.deep,
      overflow: 'hidden',
      transform: `scale(${scale})`,
      transformOrigin: 'top left',
      boxSizing: 'border-box',
    }}
  >
    {children}
  </div>
);

// Deterministic QR-looking grid (not a real code)
export const QR: React.FC<{size?: number; color?: string}> = ({size = 200, color = C.deep}) => {
  const n = 13;
  const cells: React.ReactNode[] = [];
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++) {
      const corner = (i < 4 && j < 4) || (i < 4 && j > n - 5) || (i > n - 5 && j < 4);
      const on = corner
        ? (i % 4 === 0 || j % 4 === 0 || i % 4 === 3 || j % 4 === 3 || (i % 4 === 1 && j % 4 === 1) || (i % 4 === 2 && j % 4 === 2) || (i%4===1&&j%4===2) || (i%4===2&&j%4===1)) && !(i === 3 && j > 3 && j < n - 4)
        : (i * 7 + j * 13 + i * j) % 3 === 0;
      if (on) cells.push(<rect key={`${i}-${j}`} x={j} y={i} width={1} height={1} fill={color} />);
    }
  return (
    <svg width={size} height={size} viewBox={`-1 -1 ${n + 2} ${n + 2}`} style={{background: C.ivory, borderRadius: 12}}>
      {cells}
    </svg>
  );
};

export const Ask: React.FC<{lines: string[]; start: number}> = ({lines, start}) => (
  <Headline lines={lines} start={start} top={Z.title} size={84} />
);
