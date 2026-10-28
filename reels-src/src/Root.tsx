import React from 'react';
import {Composition} from 'remotion';
import {R1ThreeWords, R1_DURATION} from './reels/R1ThreeWords';
import {R2Robot, R2_DURATION} from './reels/R2Robot';
import {R3Spicy, R3_DURATION} from './reels/R3Spicy';
import {R4Apps, R4_DURATION} from './reels/R4Apps';
import {R5Metro, R5_DURATION} from './reels/R5Metro';
import {R6Hervee, R6_DURATION} from './reels/R6Hervee';

// Logo: public/logo-round.png (from lfsshanghai.com repo)
const base = {fps: 30, width: 1080, height: 1920, defaultProps: {logoSrc: 'logo-round.png' as string | null}};

export const Root: React.FC = () => (
  <>
    <Composition id="R1-1102-3ug-alipay" component={R1ThreeWords} durationInFrames={R1_DURATION} {...base} />
    <Composition id="R2-1104-robot" component={R2Robot} durationInFrames={R2_DURATION} {...base} />
    <Composition id="R3-1107-buyaola" component={R3Spicy} durationInFrames={R3_DURATION} {...base} />
    <Composition id="R4-1109-3-app" component={R4Apps} durationInFrames={R4_DURATION} {...base} />
    <Composition id="R5-1111-metro" component={R5Metro} durationInFrames={R5_DURATION} {...base} />
    <Composition id="R6-1114-hervee" component={R6Hervee} durationInFrames={R6_DURATION} {...base} />
  </>
);
