import React from 'react';
import {Composition} from 'remotion';
import {HowToNominate} from './HowToNominate';

export const RemotionRoot: React.FC = () => (
  <Composition
    id="HowToNominate"
    component={HowToNominate}
    durationInFrames={540}
    fps={30}
    width={1920}
    height={1080}
  />
);
