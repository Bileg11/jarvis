import React from 'react';
import {Sequence, useCurrentFrame, useVideoConfig, interpolate} from 'remotion';
import {Frame, Headline, Traveler, Body, Footer, C, F, SAFE, pop, fadeIn} from '../brand';

// 11/14 Бямба · ХЭРВЭЭ · ЗАРАХ ПОСТ (6-аас 1)
export const R6_DURATION = 660;

const STEPS = [
  {hud: 'ЦАГ 1', text: 'Таксинд хаягаа хэлж чадахгүй.'},
  {hud: 'ӨДӨР 1', text: 'Цэснээс хоолоо зургаар нь сонгоно.'},
  {hud: 'ӨДӨР 2', text: '要辣吗? гэхэд "тийм" гэчихнэ.'},
  {hud: 'ӨДӨР 3', text: 'Утасны орчуулагч чинь цорын ганц найз болно.'},
];

const Hud: React.FC<{label: string}> = ({label}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const p = pop(frame, fps, 0, 10);
  return (
    <div
      style={{
        position: 'absolute',
        top: 400,
        left: SAFE.left,
        padding: '14px 30px',
        border: `4px solid ${C.gold}`,
        borderRadius: 16,
        fontFamily: F.head,
        fontWeight: 900,
        fontSize: 64,
        letterSpacing: 4,
        color: C.gold,
        transform: `scale(${0.7 + 0.3 * p})`,
        transformOrigin: 'left center',
      }}
    >
      {label}
    </div>
  );
};

const Step: React.FC<{i: number}> = ({i}) => {
  const frame = useCurrentFrame();
  const s = STEPS[i];
  const mood = (i + 1) / STEPS.length;
  return (
    <>
      <Hud label={s.hud} />
      <div
        style={{
          position: 'absolute',
          top: 540,
          left: SAFE.left,
          width: SAFE.width,
          fontFamily: s.text.includes('要') ? `${F.head}, ${F.zh}` : F.head,
          fontWeight: 900,
          fontSize: 76,
          lineHeight: 1.12,
          opacity: fadeIn(frame, 6),
        }}
      >
        {s.text}
      </div>
      <Traveler x={520} y={940} scale={0.78} mood={mood} flush={i === 2 ? 0.8 : 0} />
    </>
  );
};

const Offer: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const rows = [
    ['Хувийн хөтөч', '¥500 / өдөр'],
    ['Онгоцны буудлаас тосох', '¥200'],
  ];
  return (
    <>
      <Headline lines={['Монгол хэлээр', 'хөтөлнө.']} size={92} />
      <div style={{position: 'absolute', top: 670, left: SAFE.left, width: SAFE.width}}>
        {rows.map(([a, b], i) => {
          const p = pop(frame, fps, 10 + i * 8);
          return (
            <div
              key={a}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'baseline',
                padding: '18px 0',
                borderBottom: `2px solid rgba(242,213,138,0.4)`,
                opacity: p,
                transform: `translateX(${(1 - p) * 40}px)`,
              }}
            >
              <div style={{fontSize: 46, fontWeight: 600}}>{a}</div>
              <div style={{fontFamily: F.head, fontWeight: 900, fontSize: 58, color: C.gold}}>{b}</div>
            </div>
          );
        })}
      </div>
      <Body text={'Дэлгэрэнгүй авах бол "1" гэж коммент бичээрэй'} start={30} top={910} size={46} color={C.lgold} />
    </>
  );
};

export const R6Hervee: React.FC<{logoSrc?: string | null}> = ({logoSrc = 'logo-round.png'}) => (
  <Frame label="ХЭРВЭЭ..." logoSrc={logoSrc} outroFrom={525}>
    <Sequence durationInFrames={75}>
      <Headline lines={['Хэрвээ хятад хэлгүй,', 'ганцаараа Шанхайд', 'ирвэл?']} size={84} />
      <Traveler x={540} y={940} scale={0.78} />
    </Sequence>
    {STEPS.map((_, i) => (
      <Sequence key={i} from={75 + i * 90} durationInFrames={90}>
        <Step i={i} />
      </Sequence>
    ))}
    <Sequence from={435} durationInFrames={90}>
      <SnapBack />
    </Sequence>
    <Sequence from={525} durationInFrames={135}>
      <Offer />
    </Sequence>
  </Frame>
);

const SnapBack: React.FC = () => {
  const frame = useCurrentFrame();
  const x = interpolate(frame, [0, 20], [520, 520], {extrapolateRight: 'clamp'});
  return (
    <>
      <Headline lines={['Эсвэл', 'монгол хөтөчтэй', 'ир.']} size={96} />
      <Traveler x={x} y={940} scale={0.78} wave />
    </>
  );
};
