import React from 'react';
import {Sequence, useCurrentFrame, useVideoConfig} from 'remotion';
import {Frame, Headline, Body, C, F, SAFE, pop, fadeIn} from '../brand';

// 11/9 Даваа · TEACH · ирэхээс өмнө суулгах 3 апп
export const R4_DURATION = 540;

const Icon: React.FC<{kind: 'map' | 'pay' | 'chat'}> = ({kind}) => (
  <svg width={200} height={200} viewBox="0 0 200 200">
    <rect width={200} height={200} rx={48} fill={C.ivory} />
    {kind === 'map' && (
      <>
        <path d="M100 40 C140 40 160 70 150 100 C140 130 100 165 100 165 C100 165 60 130 50 100 C40 70 60 40 100 40 Z" fill={C.navy} />
        <circle cx={100} cy={88} r={20} fill={C.gold} />
      </>
    )}
    {kind === 'pay' && (
      <>
        <rect x={35} y={60} width={130} height={90} rx={16} fill={C.navy} />
        <rect x={35} y={80} width={130} height={18} fill={C.gold} />
        <rect x={120} y={115} width={30} height={18} rx={4} fill={C.lgold} />
      </>
    )}
    {kind === 'chat' && (
      <>
        <path d="M40 60 h120 a20 20 0 0 1 20 20 v50 a20 20 0 0 1 -20 20 h-70 l-30 25 v-25 h-20 a20 20 0 0 1 -20 -20 v-50 a20 20 0 0 1 20 -20z" fill={C.navy} />
        <circle cx={75} cy={105} r={9} fill={C.gold} />
        <circle cx={105} cy={105} r={9} fill={C.gold} />
        <circle cx={135} cy={105} r={9} fill={C.gold} />
      </>
    )}
  </svg>
);

const AppCard: React.FC<{n: string; name: string; zh?: string; why: string; kind: 'map' | 'pay' | 'chat'}> = ({
  n,
  name,
  zh,
  why,
  kind,
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const p = pop(frame, fps, 0, 12);
  return (
    <>
      <div style={{position: 'absolute', top: 400, left: SAFE.left, fontFamily: F.head, fontWeight: 900, fontSize: 200, color: C.gold, opacity: 0.25}}>
        {n}
      </div>
      <div style={{position: 'absolute', top: 420, left: SAFE.left + 200, transform: `scale(${p})`, transformOrigin: 'left center'}}>
        <Icon kind={kind} />
      </div>
      <div style={{position: 'absolute', top: 700, left: SAFE.left, width: SAFE.width}}>
        <div style={{fontFamily: F.head, fontWeight: 900, fontSize: 100, color: C.ivory, opacity: p}}>{name}</div>
        {zh && <div style={{fontFamily: F.zh, fontWeight: 700, fontSize: 64, color: C.lgold, marginTop: 6, opacity: fadeIn(frame, 8)}}>{zh}</div>}
        <div style={{fontSize: 50, fontWeight: 600, lineHeight: 1.3, marginTop: 28, color: C.gold, opacity: fadeIn(frame, 16)}}>{why}</div>
      </div>
    </>
  );
};

export const R4Apps: React.FC<{logoSrc?: string | null}> = ({logoSrc = 'logo-round.png'}) => (
  <Frame label="ИРЭХЭЭСЭЭ ӨМНӨ" logoSrc={logoSrc} outroFrom={440}>
    <Sequence durationInFrames={80}>
      <StrikeHook />
    </Sequence>
    <Sequence from={80} durationInFrames={120}>
      <AppCard n="1" name="Amap" zh="高德地图" why="Газрын зураг. Метро, автобус, алхах зам." kind="map" />
    </Sequence>
    <Sequence from={200} durationInFrames={120}>
      <AppCard n="2" name="Alipay" why="Төлбөр. Visa, Mastercard картаа холбоно." kind="pay" />
    </Sequence>
    <Sequence from={320} durationInFrames={120}>
      <AppCard n="3" name="WeChat" why="Чат, төлбөр, ширээ захиалга." kind="chat" />
    </Sequence>
    <Sequence from={440} durationInFrames={100}>
      <Headline lines={['Монголоосоо', 'суулгаад ир.']} size={96} />
      <Body text="Хадгалаад ав. Ирэхэд хэрэг болно." start={14} top={760} size={52} color={C.lgold} />
    </Sequence>
  </Frame>
);

const StrikeHook: React.FC = () => {
  const frame = useCurrentFrame();
  const strike = Math.min(1, Math.max(0, (frame - 18) / 10));
  return (
    <>
      <div style={{position: 'absolute', top: 400, left: SAFE.left, width: SAFE.width}}>
        <div style={{position: 'relative', display: 'inline-block', fontFamily: F.head, fontWeight: 900, fontSize: 100, color: C.ivory}}>
          Google Maps
          <div style={{position: 'absolute', left: 0, top: '52%', height: 12, width: `${strike * 100}%`, background: C.red}} />
        </div>
      </div>
      <Headline lines={['Хятадад ажиллахгүй.', 'Оронд нь:']} start={20} top={560} size={84} />
    </>
  );
};
