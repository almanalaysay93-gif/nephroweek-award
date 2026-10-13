import React from 'react';
import {
  AbsoluteFill,
  Img,
  Sequence,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';

const C = {
  ink: '#0c1f38',
  inkSoft: '#3a5270',
  brand600: '#1d64b4',
  brand700: '#174f91',
  brand200: '#c2dbf5',
  paper: '#fafcff',
  gold400: '#e3b54a',
};

const FONT = 'Fraunces, Georgia, serif';
const BODY = '"Instrument Sans", Arial, sans-serif';

// Fade and rise in, starting at a given frame inside the sequence.
const useEnter = (delay = 0) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const p = spring({frame: frame - delay, fps, config: {damping: 200}});
  return {opacity: p, transform: `translateY(${interpolate(p, [0, 1], [40, 0])}px)`};
};

const Background: React.FC = () => {
  const frame = useCurrentFrame();
  const shift = interpolate(frame, [0, 540], [45, 55]);
  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(ellipse at ${shift}% 40%, #ffffff 0%, ${C.paper} 45%, ${C.brand200} 100%)`,
      }}
    />
  );
};

const Intro: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const bannerIn = spring({frame, fps, config: {damping: 180}});
  const sub = useEnter(20);
  return (
    <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center'}}>
      <div
        style={{
          transform: `scale(${interpolate(bannerIn, [0, 1], [0.9, 1])})`,
          opacity: bannerIn,
          marginBottom: 40,
        }}
      >
        <Img
          src={staticFile('banner-1280.webp')}
          style={{width: 900, borderRadius: 28, boxShadow: '0 30px 60px -30px rgba(12,42,78,0.4)'}}
        />
      </div>
      <div style={{...sub, fontFamily: BODY, fontSize: 52, color: C.brand700, letterSpacing: 1}}>
        How to nominate a colleague
      </div>
    </AbsoluteFill>
  );
};

type StepProps = {num: number; title: string; body: string; children?: React.ReactNode};

const Step: React.FC<StepProps> = ({num, title, body, children}) => {
  const head = useEnter(0);
  const text = useEnter(8);
  const extra = useEnter(16);
  return (
    <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center'}}>
      <div style={{display: 'flex', gap: 80, alignItems: 'center', width: 1500}}>
        <div style={{flex: 1}}>
          <div
            style={{
              ...head,
              width: 96,
              height: 96,
              borderRadius: '50%',
              background: C.brand600,
              color: '#ffffff',
              fontFamily: FONT,
              fontSize: 56,
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: `0 16px 34px -12px ${C.brand700}`,
            }}
          >
            {num}
          </div>
          <div style={{...text, fontFamily: FONT, fontSize: 84, color: C.ink, marginTop: 28, lineHeight: 1.05}}>
            {title}
          </div>
          <div style={{...text, fontFamily: BODY, fontSize: 36, color: C.inkSoft, marginTop: 24, lineHeight: 1.4, maxWidth: 720}}>
            {body}
          </div>
        </div>
        <div style={{flex: 1, ...extra}}>{children}</div>
      </div>
    </AbsoluteFill>
  );
};

const Card: React.FC<{children: React.ReactNode}> = ({children}) => (
  <div
    style={{
      background: 'rgba(255,255,255,0.8)',
      border: '1.5px solid rgba(29,100,180,0.18)',
      borderRadius: 32,
      padding: 44,
      boxShadow: '0 30px 60px -30px rgba(12,42,78,0.35)',
      fontFamily: BODY,
      color: C.ink,
      fontSize: 34,
    }}
  >
    {children}
  </div>
);

const AwardsCard: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const names = ['Outstanding Hemodialysis Nurse', 'Best Team Leader', 'Rising Star', 'Extra Miler'];
  return (
    <Card>
      {names.map((name, i) => {
        const p = spring({frame: frame - 24 - i * 8, fps, config: {damping: 200}});
        const picked = i === 0;
        return (
          <div
            key={name}
            style={{
              opacity: p,
              transform: `translateX(${interpolate(p, [0, 1], [30, 0])}px)`,
              padding: '18px 22px',
              margin: '10px 0',
              borderRadius: 18,
              background: picked ? C.brand200 : 'transparent',
              border: picked ? `2px solid ${C.brand600}` : '2px solid transparent',
              fontWeight: picked ? 600 : 400,
            }}
          >
            {name}
          </div>
        );
      })}
    </Card>
  );
};

const NameCard: React.FC = () => {
  const frame = useCurrentFrame();
  const full = 'ABEAR, Catherine V.';
  const typed = Math.floor(
    interpolate(frame, [20, 60], [0, full.length], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}),
  );
  const showList = frame > 64;
  return (
    <Card>
      <div style={{fontSize: 26, color: C.inkSoft, marginBottom: 10}}>Nominee (dialysis technician)</div>
      <div
        style={{
          borderRadius: 16,
          border: `2px solid ${C.brand600}`,
          padding: '20px 24px',
          minHeight: 36,
          background: '#ffffff',
        }}
      >
        {full.slice(0, typed)}
        <span style={{opacity: frame % 30 < 15 ? 1 : 0, color: C.brand600}}>|</span>
      </div>
      {showList && (
        <div
          style={{
            marginTop: 14,
            borderRadius: 16,
            border: `1px solid ${C.brand200}`,
            padding: 14,
            background: '#ffffff',
            fontSize: 30,
          }}
        >
          <div style={{padding: '12px 14px', borderRadius: 10, background: C.brand200, fontWeight: 600}}>
            ABEAR, Catherine V.
          </div>
        </div>
      )}
    </Card>
  );
};

const SendCard: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const press = spring({frame: frame - 10, fps, config: {damping: 14, stiffness: 180}});
  const done = spring({frame: frame - 30, fps, config: {damping: 200}});
  return (
    <Card>
      <div
        style={{
          transform: `scale(${interpolate(press, [0, 1], [1, 0.96])})`,
          background: C.brand600,
          color: '#ffffff',
          borderRadius: 999,
          textAlign: 'center',
          padding: '20px 0',
          fontWeight: 600,
          fontSize: 36,
        }}
      >
        Send nomination
      </div>
      <div style={{opacity: done, marginTop: 26, display: 'flex', alignItems: 'center', gap: 18, fontSize: 32}}>
        <div
          style={{
            width: 60,
            height: 60,
            borderRadius: '50%',
            background: C.gold400,
            color: C.ink,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 34,
            fontWeight: 700,
            transform: `scale(${interpolate(done, [0, 1], [0.6, 1])})`,
          }}
        >
          OK
        </div>
        Nomination received
      </div>
    </Card>
  );
};

const Outro: React.FC = () => {
  const logos = useEnter(0);
  const title = useEnter(12);
  return (
    <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center'}}>
      <div style={{display: 'flex', gap: 56, alignItems: 'center', marginBottom: 36, ...logos}}>
        <Img src={staticFile('spmc-seal-400.webp')} style={{height: 170}} />
        <Img src={staticFile('skti-logo-512.webp')} style={{height: 170}} />
      </div>
      <div style={{...title, textAlign: 'center', fontFamily: FONT, fontSize: 60, color: C.ink}}>
        Nephrology Nurses Week 2026
      </div>
      <div style={{...title, fontFamily: BODY, fontSize: 36, color: C.brand700, marginTop: 20}}>
        almanalaysay93-gif.github.io/nephroweek-award
      </div>
    </AbsoluteFill>
  );
};

export const HowToNominate: React.FC = () => {
  return (
    <AbsoluteFill style={{fontFamily: BODY}}>
      <Background />
      <Sequence from={0} durationInFrames={90}>
        <Intro />
      </Sequence>
      <Sequence from={90} durationInFrames={120}>
        <Step num={1} title="Choose an award" body="Open the award that fits the work you saw.">
          <AwardsCard />
        </Step>
      </Sequence>
      <Sequence from={210} durationInFrames={120}>
        <Step num={2} title="Name your colleague" body="Pick the nominee from the staff list.">
          <NameCard />
        </Step>
      </Sequence>
      <Sequence from={330} durationInFrames={120}>
        <Step num={3} title="Send it" body="Write one or two examples and press send.">
          <SendCard />
        </Step>
      </Sequence>
      <Sequence from={450} durationInFrames={90}>
        <Outro />
      </Sequence>
    </AbsoluteFill>
  );
};
