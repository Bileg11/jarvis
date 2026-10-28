import React from 'react';
import {Sequence, useCurrentFrame, interpolate} from 'remotion';
import {Z, Frame, Headline, WordCard, Traveler, Bubble, Body, Ask, C, F, SAFE, fadeIn} from '../brand';

// 11/7 Бямба · 5 СЕКУНДЫН ХЯТАД ХЭЛ · 不要辣
export const R3_DURATION = 540;

const Meter: React.FC<{level: number}> = ({level}) => (
  <div style={{position: 'absolute', left: SAFE.left, top: 700, display: 'flex', gap: 18}}>
    {[0, 1, 2, 3, 4].map((i) => (
      <svg key={i} width={110} height={150} viewBox="0 0 110 150">
        <path
          d="M55 30 C95 40 100 100 60 140 C40 120 20 70 55 30 Z"
          fill={level > i ? C.red : 'none'}
          stroke={C.red}
          strokeWidth={5}
          opacity={level > i ? 1 : 0.35}
        />
        <path d="M55 30 Q60 10 75 6" stroke={C.lgold} strokeWidth={6} fill="none" strokeLinecap="round" />
      </svg>
    ))}
  </div>
);

const Burn: React.FC = () => {
  const frame = useCurrentFrame();
  const level = interpolate(frame, [10, 100], [0, 5], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const shake = level > 4 ? Math.sin(frame * 2) * 6 : 0;
  return (
    <>
      <Headline lines={['"Тийм" гэчихвэл', 'ингэнэ.']} size={88} />
      <Meter level={level} />
      <div style={{transform: `translateX(${shake}px)`}}>
        <Traveler x={520} y={940} scale={0.78} mood={level / 5} flush={level / 5} />
      </div>
    </>
  );
};

export const R3Spicy: React.FC<{logoSrc?: string | null}> = ({logoSrc = 'logo-round.png'}) => (
  <Frame label="5 СЕКУНДЫН ХЯТАД ХЭЛ" logoSrc={logoSrc} outroFrom={450}>
    <Sequence durationInFrames={75}>
      <Headline lines={['Хятадад энэ асуултад', '"тийм" гэж', 'битгий хэл.']} size={84} />
      <Traveler x={540} y={940} scale={0.78} />
    </Sequence>

    <Sequence from={75} durationInFrames={90}>
      <Bubble x={SAFE.left} y={400} start={0} w={600}>
        <div style={{fontFamily: F.zh, fontWeight: 700, fontSize: 110, lineHeight: 1.1}}>要辣吗？</div>
        <div style={{fontFamily: F.body, fontStyle: 'italic', fontSize: 50, color: C.navy}}>yào là ma?</div>
      </Bubble>
      <Body text="Халуун ногоотой юу?" start={25} top={700} size={60} color={C.gold} />
      <Traveler x={540} y={940} scale={0.78} />
    </Sequence>

    <Sequence from={165} durationInFrames={135}>
      <Burn />
    </Sequence>

    <Sequence from={300} durationInFrames={150}>
      <Body text="Оронд нь ингэж хэл:" start={0} top={Z.title} size={52} color={C.lgold} />
      <WordCard zh="不要辣" py="bú yào là" mn="Халуун ногоогүй" when="Хоол захиалахдаа" start={6} top={490} />
    </Sequence>

    <Sequence from={450} durationInFrames={90}>
      <Ask lines={['Халуун ногоо', 'иддэг үү?']} start={0} />
      <Body text={'Иддэг бол "ТИЙМ" гэж коммент бичээрэй'} start={14} top={760} size={52} color={C.lgold} />
    </Sequence>
  </Frame>
);
