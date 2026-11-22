import React from 'react';
import {AbsoluteFill, Audio, Easing, Img, interpolate, random, Sequence, staticFile, useCurrentFrame} from 'remotion';

/* Reel 03 — editorial. Real-looking photography, house grade, camera moves; almost no text. */
const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;
const GRADE = 'sepia(0.32) saturate(0.55) contrast(1.06) brightness(0.97)';

type Move = {from: [number, number, number]; to: [number, number, number]}; // scale, x%, y% (origin)

const Shot: React.FC<{src: string; dur: number; move: Move; focusPull?: boolean; shake?: number; bw?: boolean}> = ({
  src,
  dur,
  move,
  focusPull,
  shake = 0,
  bw,
}) => {
  const f = useCurrentFrame();
  const p = interpolate(f, [0, dur], [0, 1], {...clamp, easing: Easing.inOut(Easing.sin)});
  const s = move.from[0] + (move.to[0] - move.from[0]) * p;
  const ox = move.from[1] + (move.to[1] - move.from[1]) * p;
  const oy = move.from[2] + (move.to[2] - move.from[2]) * p;
  const blur = focusPull ? interpolate(f, [0, 9], [9, 0], {...clamp, easing: Easing.out(Easing.cubic)}) : 0;
  // handheld: slow organic drift + optional small shake
  const hx = Math.sin(f / 17) * 4 + (random(`x${f}`) - 0.5) * shake;
  const hy = Math.cos(f / 21) * 4 + (random(`y${f}`) - 0.5) * shake;
  return (
    <AbsoluteFill style={{overflow: 'hidden'}}>
      <Img
        src={staticFile(src)}
        style={{
          position: 'absolute',
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          transformOrigin: `${ox}% ${oy}%`,
          transform: `translate(${hx}px, ${hy}px) scale(${s})`,
          filter: `${bw ? 'grayscale(1) contrast(1.12)' : GRADE} blur(${blur}px)`,
        }}
      />
    </AbsoluteFill>
  );
};

const Grain: React.FC = () => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{mixBlendMode: 'overlay', opacity: 0.42, pointerEvents: 'none'}}>
      <svg width="1080" height="1920">
        <filter id="g">
          <feTurbulence type="fractalNoise" baseFrequency="0.95" numOctaves="2" seed={f % 24} />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter="url(#g)" />
      </svg>
    </AbsoluteFill>
  );
};

export const Reel: React.FC = () => {
  const f = useCurrentFrame();
  // one-frame exposure blip on each cut, like a real camera roll
  const blip = [60, 105, 150].some((c) => f === c) ? 0.22 : 0;
  const end = interpolate(f, [192, 209], [0, 1], clamp);
  const name = interpolate(f, [166, 178], [0, 1], clamp);
  return (
    <AbsoluteFill style={{background: '#0b0a09'}}>
      <Sequence from={0} durationInFrames={60} layout="none">
        <Shot src="p1.png" dur={60} focusPull move={{from: [1.04, 50, 35], to: [1.14, 50, 32]}} />
      </Sequence>
      <Sequence from={60} durationInFrames={45} layout="none">
        <Shot src="p2.png" dur={45} bw shake={3} move={{from: [1.12, 45, 40], to: [1.24, 42, 38]}} />
      </Sequence>
      <Sequence from={105} durationInFrames={45} layout="none">
        <Shot src="p3.png" dur={45} move={{from: [1.18, 62, 40], to: [1.18, 38, 40]}} />
      </Sequence>
      <Sequence from={150} durationInFrames={60} layout="none">
        <Shot src="p1.png" dur={60} move={{from: [1.75, 50, 30], to: [1.9, 50, 30]}} />
      </Sequence>
      {/* warm film tone + soft vignette */}
      <AbsoluteFill style={{background: 'rgba(120,85,40,0.10)', mixBlendMode: 'soft-light'}} />
      <AbsoluteFill style={{background: 'radial-gradient(ellipse at center, rgba(0,0,0,0) 58%, rgba(0,0,0,0.5) 100%)'}} />
      <Grain />
      <AbsoluteFill style={{background: '#fff', opacity: blip}} />
      <div
        style={{
          position: 'absolute',
          top: 310,
          width: '100%',
          textAlign: 'center',
          fontFamily: 'Heebo, sans-serif',
          fontWeight: 400,
          fontSize: 42,
          letterSpacing: 12,
          color: '#efe7da',
          opacity: name * 0.9,
          direction: 'rtl',
          textShadow: '0 2px 18px rgba(0,0,0,0.6)',
        }}
      >
        דוד בוזגלו
      </div>
      <AbsoluteFill style={{background: '#000', opacity: end}} />
      <Audio src={staticFile('music.wav')} />
    </AbsoluteFill>
  );
};
