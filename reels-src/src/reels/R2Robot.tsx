import React from 'react';
import {Sequence, useCurrentFrame, interpolate, useVideoConfig} from 'remotion';
import {Frame, Headline, Phone, Body, Ask, C, F, SAFE, pop, fadeIn} from '../brand';

// 11/4 Лхагва · ХЯТАДАД ҮҮНИЙГ Ч ХИЙДЭГ · зочид буудлын хүргэлтийн робот
export const R2_DURATION = 510;

const Robot: React.FC<{x: number; y: number; lid?: number}> = ({x, y, lid = 0}) => {
  const frame = useCurrentFrame();
  const blink = frame % 60 < 4;
  return (
    <svg width={260} height={420} viewBox="0 0 260 420" style={{position: 'absolute', left: x, top: y}}>
      {/* lid */}
      <g transform={`rotate(${-lid * 70} 30 120)`}>
        <rect x={30} y={100} width={200} height={26} rx={10} fill={C.lgold} />
      </g>
      {/* body */}
      <rect x={30} y={120} width={200} height={240} rx={40} fill={C.ivory} />
      {/* screen face */}
      <rect x={60} y={30} width={140} height={80} rx={24} fill={C.deep} stroke={C.ivory} strokeWidth={6} />
      <rect x={92} y={blink ? 68 : 56} width={18} height={blink ? 4 : 20} rx={6} fill={C.gold} />
      <rect x={150} y={blink ? 68 : 56} width={18} height={blink ? 4 : 20} rx={6} fill={C.gold} />
      {/* food box visible when lid open */}
      {lid > 0.5 && <rect x={80} y={130} width={100} height={60} rx={8} fill={C.gold} />}
      <rect x={30} y={250} width={200} height={10} fill={C.gold} />
      {/* wheels */}
      <circle cx={70} cy={372} r={22} fill={C.deep} stroke={C.ivory} strokeWidth={5} />
      <circle cx={190} cy={372} r={22} fill={C.deep} stroke={C.ivory} strokeWidth={5} />
    </svg>
  );
};

const Corridor: React.FC = () => {
  const frame = useCurrentFrame();
  const x = interpolate(frame, [0, 110], [-300, 330], {extrapolateRight: 'clamp'});
  return (
    <>
      <Headline lines={['Үлдсэнийг нь', 'робот хийнэ.']} size={88} />
      {/* floor + doors */}
      <div style={{position: 'absolute', left: 0, top: 1270, width: 850, height: 6, background: C.lgold, opacity: 0.5}} />
      {[0, 1].map((i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: 80 + i * 470,
            top: 850,
            width: 220,
            height: 420,
            border: `5px solid ${C.lgold}`,
            borderBottom: 'none',
            borderRadius: '16px 16px 0 0',
            opacity: 0.6,
          }}
        >
          <div style={{fontFamily: F.head, fontWeight: 800, fontSize: 36, color: C.lgold, textAlign: 'center', marginTop: 30}}>
            {i === 0 ? '1207' : '1208'}
          </div>
        </div>
      ))}
      <Robot x={x} y={850} />
    </>
  );
};

const Arrive: React.FC = () => {
  const frame = useCurrentFrame();
  const lid = interpolate(frame, [15, 35], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  return (
    <>
      <Headline lines={['Тагийг нь онгойлгоод', 'л ав.']} size={80} />
      <Robot x={330} y={850} lid={lid} />
    </>
  );
};

const OrderScene: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const delivered = frame > 55;
  return (
    <>
      <Phone x={SAFE.left} y={400}>
        <div style={{padding: '60px 26px', fontFamily: F.zh, color: C.ivory}}>
          <div style={{fontSize: 34, opacity: 0.7}}>外卖</div>
          <div
            style={{
              marginTop: 40,
              padding: 22,
              borderRadius: 20,
              background: delivered ? C.gold : 'rgba(250,247,240,0.1)',
              color: delivered ? C.deep : C.ivory,
              fontSize: 40,
              transform: `scale(${delivered ? 0.9 + pop(frame, fps, 55) * 0.1 : 1})`,
            }}
          >
            {delivered ? '您的外卖到了' : '配送中…'}
          </div>
        </div>
      </Phone>
      <div style={{position: 'absolute', left: 420, top: 420, width: 430}}>
        <div style={{fontFamily: F.head, fontWeight: 900, fontSize: 56, lineHeight: 1.15, color: C.gold, opacity: fadeIn(frame, 0)}}>
          Хоолоо утсаараа захиална.
        </div>
        <div style={{fontSize: 40, lineHeight: 1.3, marginTop: 30, opacity: fadeIn(frame, 10)}}>
          Хүргэгч буудлын үүдэнд л хүрээд буцна.
        </div>
      </div>
    </>
  );
};

export const R2Robot: React.FC<{logoSrc?: string | null}> = ({logoSrc = 'logo-round.png'}) => (
  <Frame label="ХЯТАДАД ҮҮНИЙГ Ч ХИЙДЭГ" logoSrc={logoSrc} outroFrom={420}>
    <Sequence durationInFrames={75}>
      <Headline lines={['Шанхайн олон буудалд', 'хоолыг чинь', 'робот авчирдаг.']} size={84} />
      <Robot x={480} y={850} />
    </Sequence>
    <Sequence from={75} durationInFrames={105}>
      <OrderScene />
    </Sequence>
    <Sequence from={180} durationInFrames={150}>
      <Corridor />
    </Sequence>
    <Sequence from={330} durationInFrames={90}>
      <Arrive />
    </Sequence>
    <Sequence from={420} durationInFrames={90}>
      <Ask lines={['Монголд хэзээ', 'ийм болох бол?']} start={0} />
      <Body text="Коммент бичээрэй" start={14} top={760} size={56} color={C.lgold} />
    </Sequence>
  </Frame>
);
