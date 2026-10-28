import React from 'react';
import {Sequence, useCurrentFrame, interpolate} from 'remotion';
import {Frame, Headline, WordCard, Traveler, Phone, QR, Body, Ask, C, F, SAFE, fadeIn} from '../brand';

// 11/2 Даваа · TEACH · "3 үг + Alipay"
export const R1_DURATION = 660;

const Walker: React.FC<{from: number; to: number; wave?: boolean; point?: boolean}> = ({from, to, wave, point}) => {
  const frame = useCurrentFrame();
  const x = interpolate(frame, [0, 30], [from, to], {extrapolateRight: 'clamp'});
  return <Traveler x={x} y={940} scale={0.78} walking={frame < 30} wave={wave} point={point} />;
};

export const R1ThreeWords: React.FC<{logoSrc?: string | null}> = ({logoSrc = 'logo-round.png'}) => (
  <Frame label="ШАНХАЙД АМЬД ҮЛДЭХ" logoSrc={logoSrc} outroFrom={555}>
    <Sequence durationInFrames={75}>
      <Headline lines={['Шанхайд 3 үг', '+ Alipay.', 'Өөр юу ч хэрэггүй.']} top={400} size={96} />
      <Walker from={-250} to={560} />
    </Sequence>

    <Sequence from={75} durationInFrames={120}>
      <WordCard index="1 / 3" zh="你好" py="nǐ hǎo" mn="Сайн байна уу" when="Дэлгүүр, кафе орохдоо" start={0} />
      <Walker from={560} to={560} wave />
    </Sequence>

    <Sequence from={195} durationInFrames={120}>
      <WordCard index="2 / 3" zh="这个" py="zhè ge" mn="Энийг" when="Цэс дээр хуруугаараа заагаад" start={0} />
      <Walker from={560} to={560} point />
    </Sequence>

    <Sequence from={315} durationInFrames={120}>
      <WordCard index="3 / 3" zh="谢谢" py="xiè xie" mn="Баярлалаа" when="Гарахдаа" start={0} />
      <Walker from={560} to={560} wave />
    </Sequence>

    <Sequence from={435} durationInFrames={120}>
      <PayScene />
    </Sequence>

    <Sequence from={555} durationInFrames={105}>
      <Ask lines={['4 дэх үг', 'юу байх ёстой вэ?']} start={0} />
      <Body text="Коммент бичээрэй" start={14} top={760} size={56} color={C.lgold} />
    </Sequence>
  </Frame>
);

const PayScene: React.FC = () => {
  const frame = useCurrentFrame();
  const scan = interpolate(frame, [20, 60], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const ok = frame > 62;
  return (
    <>
      <Headline lines={['+ Alipay']} size={110} />
      <Phone x={SAFE.left} y={580}>
        <div style={{position: 'absolute', left: 40, top: 70}}>
          <QR size={200} />
        </div>
        {!ok && <div style={{position: 'absolute', left: 30, top: 70 + scan * 200, width: 220, height: 6, background: C.gold}} />}
        {ok && (
          <div style={{position: 'absolute', top: 330, width: '100%', textAlign: 'center', fontFamily: F.head, fontWeight: 900, fontSize: 46, color: C.gold}}>
            Төлсөн
          </div>
        )}
      </Phone>
      <div style={{position: 'absolute', left: 420, top: 620, width: 430, opacity: fadeIn(frame, 0)}}>
        <div style={{fontFamily: F.head, fontWeight: 900, fontSize: 56, color: C.ivory, lineHeight: 1.15}}>
          Уншуулаад л төлнө.
        </div>
        <div style={{fontSize: 40, color: C.lgold, marginTop: 24, lineHeight: 1.3}}>Бэлэн мөнгө бараг хэрэггүй.</div>
      </div>
    </>
  );
};
