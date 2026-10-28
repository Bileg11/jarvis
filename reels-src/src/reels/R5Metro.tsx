import React from 'react';
import {Sequence, useCurrentFrame, interpolate} from 'remotion';
import {Frame, Headline, Phone, QR, Traveler, Body, Ask, C, F, SAFE} from '../brand';

// 11/11 Лхагва · ХЯТАДАД ҮҮНИЙГ Ч ХИЙДЭГ · метро QR
export const R5_DURATION = 510;

const Gate: React.FC<{open: number}> = ({open}) => (
  <svg width={520} height={360} viewBox="0 0 520 360" style={{position: 'absolute', left: 280, top: 910}}>
    <rect x={0} y={60} width={110} height={300} rx={14} fill={C.ivory} opacity={0.9} />
    <rect x={410} y={60} width={110} height={300} rx={14} fill={C.ivory} opacity={0.9} />
    <rect x={20} y={90} width={70} height={50} rx={8} fill={open > 0.5 ? C.gold : C.deep} />
    {/* flaps */}
    <rect x={110} y={170} width={150 * (1 - open)} height={70} rx={10} fill={C.red} opacity={0.9} />
    <rect x={410 - 150 * (1 - open)} y={170} width={150 * (1 - open)} height={70} rx={10} fill={C.red} opacity={0.9} />
  </svg>
);

const GateScene: React.FC = () => {
  const frame = useCurrentFrame();
  const open = interpolate(frame, [30, 42], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const x = interpolate(frame, [0, 28, 45, 110], [-260, 60, 60, 420], {extrapolateRight: 'clamp'});
  return (
    <>
      <Headline lines={['Уншуулаад л', 'орно.']} size={100} />
      <Gate open={open} />
      <Traveler x={x} y={940} scale={0.78} walking={frame < 28 || frame > 45} />
    </>
  );
};

export const R5Metro: React.FC<{logoSrc?: string | null}> = ({logoSrc = 'logo-round.png'}) => (
  <Frame label="ХЯТАДАД ҮҮНИЙГ Ч ХИЙДЭГ" logoSrc={logoSrc} outroFrom={420}>
    <Sequence durationInFrames={75}>
      <Headline lines={['Шанхайн метронд', 'билет авах', 'хэрэггүй.']} size={92} />
      <Gate open={0} />
    </Sequence>
    <Sequence from={75} durationInFrames={120}>
      <Phone x={SAFE.left} y={400}>
        <div style={{position: 'absolute', left: 40, top: 60, fontFamily: F.zh, fontSize: 32, color: C.lgold}}>乘车码</div>
        <div style={{position: 'absolute', left: 40, top: 130}}>
          <QR size={200} />
        </div>
      </Phone>
      <div style={{position: 'absolute', left: 420, top: 420, width: 430}}>
        <div style={{fontFamily: F.head, fontWeight: 900, fontSize: 56, lineHeight: 1.15, color: C.gold}}>
          Утсандаа QR гаргана.
        </div>
        <div style={{fontSize: 40, lineHeight: 1.3, marginTop: 30}}>Alipay эсвэл Metro аппаас.</div>
      </div>
    </Sequence>
    <Sequence from={195} durationInFrames={120}>
      <GateScene />
    </Sequence>
    <Sequence from={315} durationInFrames={105}>
      <Headline lines={['Гарахдаа дахиад', 'уншуулна.']} size={88} />
      <Body text="Мөнгө нь өөрөө хасагдана." start={18} top={780} size={56} color={C.lgold} />
    </Sequence>
    <Sequence from={420} durationInFrames={90}>
      <Ask lines={['УБ-д ийм', 'хэрэгтэй юу?']} start={0} />
      <Body text={'"ХЭРЭГТЭЙ" гэж коммент бичээрэй'} start={14} top={760} size={52} color={C.lgold} />
    </Sequence>
  </Frame>
);
