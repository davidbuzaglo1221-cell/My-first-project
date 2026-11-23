import React from 'react';
import {AbsoluteFill, Audio, Easing, Img, interpolate, random, Sequence, staticFile, useCurrentFrame} from 'remotion';

/* "הבא בתור" — 20 s cinematic barber reel. 30 fps, 120 BPM: beat = 15 frames.
   Drop f120 · breath (freeze on the "before") f300 · reveal f330 · final hit f570. */
const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;
const W = 1080, H = 1920;

type FX = {
  whip?: 'left' | 'right';
  punch?: boolean;
  shake?: number;                    // handheld amount
  focus?: boolean;                   // focus pull in on the first frames
  glint?: [number, number];
  leak?: boolean;                    // warm light leak sweep
  freeze?: boolean;
  circle?: [number, number, number]; // red marker circle (x%, y%, r)
  grade?: string;
};
type Shot = {from: number; dur: number; src: string; s: [number, number]; x: [number, number]; y: [number, number]; fx?: FX};

const WARM = 'sepia(0.2) saturate(0.88) contrast(1.08) brightness(1.0)';
const BEFORE = 'grayscale(1) contrast(1.15) brightness(0.92)';

// image names are filled in after the anatomy check (gen/<shot>_<seed>.png -> public/<shot>.jpg)
const SHOTS: Shot[] = [
  // HOOK
  {from: 0, dur: 30, src: 's01', s: [1.5, 1.65], x: [44, 44], y: [47, 47], fx: {focus: true, shake: 2}},
  // SETUP
  {from: 30, dur: 22, src: 's02', s: [1.5, 1.58], x: [53, 53], y: [35, 33], fx: {whip: 'left', shake: 2}},
  {from: 52, dur: 23, src: 's03', s: [1.05, 1.12], x: [50, 50], y: [35, 35], fx: {shake: 2}},
  {from: 75, dur: 15, src: 's02', s: [1.6, 1.7], x: [50, 50], y: [26, 26], fx: {punch: true, shake: 3}},
  {from: 90, dur: 15, src: 's07', s: [1.35, 1.42], x: [40, 40], y: [72, 72], fx: {shake: 3}},
  {from: 105, dur: 15, src: 's03', s: [1.7, 1.9], x: [55, 55], y: [28, 28], fx: {punch: true, shake: 3}},
  // DROP
  {from: 120, dur: 15, src: 's04', s: [1.1, 1.2], x: [50, 50], y: [50, 50], fx: {punch: true, shake: 9}},
  {from: 135, dur: 15, src: 's05b', s: [1.2, 1.3], x: [50, 50], y: [35, 35], fx: {whip: 'left', shake: 3}},
  {from: 150, dur: 15, src: 's05', s: [1.1, 1.2], x: [50, 50], y: [45, 45], fx: {glint: [50, 45], shake: 3}},
  {from: 165, dur: 15, src: 's04', s: [1.6, 1.7], x: [35, 38], y: [45, 45], fx: {whip: 'right', shake: 8}},
  {from: 180, dur: 15, src: 's07', s: [1.8, 1.9], x: [35, 35], y: [62, 62], fx: {punch: true, shake: 3}},
  {from: 195, dur: 15, src: 's05', s: [1.7, 1.85], x: [55, 55], y: [42, 42], fx: {shake: 4}},
  {from: 210, dur: 15, src: 's04', s: [2.2, 2.35], x: [45, 45], y: [30, 30], fx: {glint: [45, 30], shake: 4}},
  {from: 225, dur: 15, src: 's08', s: [1.05, 1.15], x: [50, 50], y: [45, 45], fx: {punch: true, shake: 6}},
  {from: 240, dur: 15, src: 's04', s: [2.0, 2.15], x: [60, 60], y: [55, 55], fx: {shake: 9}},
  {from: 255, dur: 15, src: 's03', s: [1.4, 1.5], x: [45, 45], y: [30, 30], fx: {whip: 'left', shake: 3}},
  {from: 270, dur: 15, src: 's05', s: [1.3, 1.4], x: [45, 45], y: [48, 48], fx: {glint: [45, 48], shake: 3}},
  {from: 285, dur: 15, src: 's05b', s: [1.6, 1.75], x: [55, 55], y: [30, 30], fx: {shake: 2}},
  // BREATH — freeze on the "before"
  {from: 300, dur: 30, src: 's02', s: [1.6, 1.6], x: [50, 50], y: [32, 32], fx: {freeze: true, circle: [53, 44, 215], grade: BEFORE}},
  // REVEAL
  {from: 330, dur: 30, src: 's09', s: [1.3, 1.15], x: [40, 40], y: [55, 55], fx: {whip: 'right', leak: true}},
  {from: 360, dur: 15, src: 's10', s: [1.2, 1.28], x: [40, 40], y: [40, 40], fx: {punch: true, shake: 6}},
  {from: 375, dur: 15, src: 's08', s: [1.5, 1.6], x: [50, 50], y: [50, 50], fx: {punch: true, shake: 5}},
  {from: 390, dur: 30, src: 's11', s: [1.05, 1.15], x: [50, 50], y: [40, 38], fx: {glint: [50, 35], leak: true, shake: 2}},
  {from: 420, dur: 15, src: 's10', s: [1.7, 1.8], x: [30, 30], y: [50, 50], fx: {whip: 'left', shake: 5}},
  {from: 435, dur: 15, src: 's09b', s: [1.25, 1.35], x: [50, 50], y: [40, 40], fx: {punch: true, shake: 3}},
  {from: 450, dur: 30, src: 's13', s: [1.3, 1.18], x: [50, 50], y: [70, 72], fx: {whip: 'right'}},
  {from: 480, dur: 15, src: 's11', s: [1.3, 1.38], x: [40, 40], y: [48, 48], fx: {punch: true, shake: 3}},
  {from: 495, dur: 15, src: 's10', s: [1.6, 1.7], x: [72, 72], y: [22, 22], fx: {shake: 5}},
  // OUTRO
  {from: 510, dur: 30, src: 's12', s: [1.45, 1.12], x: [50, 50], y: [60, 62], fx: {whip: 'left', leak: true, shake: 1.5}},
  {from: 540, dur: 30, src: 's12', s: [1.0, 1.14], x: [46, 50], y: [72, 70], fx: {shake: 1.5}},
  {from: 570, dur: 30, src: 's12', s: [1.2, 1.3], x: [50, 52], y: [68, 66], fx: {punch: true, shake: 1}},
];

/* ---------- overlays ---------- */
const Glint: React.FC<{x: number; y: number}> = ({x, y}) => {
  const f = useCurrentFrame();
  const p = interpolate(f, [2, 11], [-520, 520], {...clamp, easing: Easing.inOut(Easing.cubic)});
  return (
    <div style={{position: 'absolute', inset: 0, mixBlendMode: 'screen', overflow: 'hidden', opacity: 0.7}}>
      <div style={{position: 'absolute', left: (x / 100) * W + p - 50, top: (y / 100) * H - 700, width: 100, height: 1400,
        transform: 'rotate(28deg)', background: 'linear-gradient(90deg, transparent, rgba(255,240,215,0.8), transparent)', filter: 'blur(8px)'}} />
    </div>
  );
};

const Leak: React.FC<{dur: number}> = ({dur}) => {
  const f = useCurrentFrame();
  const x = interpolate(f, [0, dur], [-30, 110], clamp);
  const o = interpolate(f, [0, 4, dur - 6, dur], [0, 0.55, 0.4, 0], clamp);
  return <AbsoluteFill style={{mixBlendMode: 'screen', opacity: o,
    background: `radial-gradient(ellipse 60% 45% at ${x}% 20%, rgba(255,150,60,0.9), rgba(255,90,30,0.25) 45%, transparent 70%)`}} />;
};

const MarkerCircle: React.FC<{x: number; y: number; r: number}> = ({x, y, r}) => {
  const f = useCurrentFrame();
  const cx = (x / 100) * W, cy = (y / 100) * H;
  const pts = Array.from({length: 70}, (_, i) => {
    const t = (i / 69) * Math.PI * 2.2 - 0.6;
    const rr = r * (1 + 0.05 * Math.sin(t * 3 + 1));
    return [cx + Math.cos(t) * rr * 1.1, cy + Math.sin(t) * rr * 0.82];
  });
  let len = 0;
  for (let i = 1; i < pts.length; i++) len += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  const off = interpolate(f, [3, 11], [len, 0], {...clamp, easing: Easing.out(Easing.quad)});
  return (
    <svg width={W} height={H} style={{position: 'absolute', inset: 0}}>
      <polyline points={pts.map((p) => p.join(',')).join(' ')} fill="none" stroke="#d1261b" strokeWidth={12}
        strokeLinecap="round" strokeLinejoin="round" strokeDasharray={len} strokeDashoffset={off} opacity={0.95} />
    </svg>
  );
};

const Grain: React.FC = () => {
  const f = useCurrentFrame();
  return (
    <svg width={W} height={H} style={{position: 'absolute', inset: 0, mixBlendMode: 'overlay', opacity: 0.2, pointerEvents: 'none'}}>
      <filter id="g"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves={2} seed={f % 41} /></filter>
      <rect width={W} height={H} filter="url(#g)" />
    </svg>
  );
};

/* ---------- a shot ---------- */
const ShotView: React.FC<{shot: Shot}> = ({shot}) => {
  const f0 = useCurrentFrame();
  const fx = shot.fx ?? {};
  const f = fx.freeze ? 0 : f0;
  const p = interpolate(f, [0, shot.dur], [0, 1], {...clamp, easing: Easing.out(Easing.cubic)});
  let s = shot.s[0] + (shot.s[1] - shot.s[0]) * p;
  if (fx.punch) s *= interpolate(f0, [0, 4], [1.14, 1], {...clamp, easing: Easing.out(Easing.exp)});
  const x = shot.x[0] + (shot.x[1] - shot.x[0]) * p;
  const y = shot.y[0] + (shot.y[1] - shot.y[0]) * p;
  // handheld: smooth drift + small random jitter that settles after the cut
  const sh = fx.shake ?? 0;
  const k = Math.floor(f0 / 2);
  const settle = interpolate(f0, [0, 6], [1, 0.4], clamp);
  const hx = Math.sin((f0 + shot.from) / 11) * sh * 1.6 + (random(`x${k}${shot.from}`) - 0.5) * sh * 2 * settle;
  const hy = Math.cos((f0 + shot.from) / 13) * sh * 1.6 + (random(`y${k}${shot.from}`) - 0.5) * sh * 2 * settle;
  const rot = Math.sin((f0 + shot.from) / 17) * sh * 0.06;
  const dir = fx.whip === 'left' ? -1 : 1;
  const whip = fx.whip ? interpolate(f0, [0, 5], [dir * 480, 0], {...clamp, easing: Easing.out(Easing.exp)}) : 0;
  let blur = fx.whip ? interpolate(f0, [0, 5], [24, 0], clamp) : 0;
  if (fx.focus) blur = Math.max(blur, interpolate(f0, [0, 9], [9, 0], {...clamp, easing: Easing.out(Easing.cubic)}));
  const filter = `${fx.grade ?? WARM} blur(${blur}px)`;
  return (
    <AbsoluteFill style={{overflow: 'hidden', background: '#0b0806'}}>
      <Img src={staticFile(`${shot.src}.jpg`)} style={{position: 'absolute', width: '100%', height: '100%', objectFit: 'cover',
        transformOrigin: `${x}% ${y}%`, transform: `translate(${hx + whip}px, ${hy}px) rotate(${rot}deg) scale(${s})`, filter}} />
      {fx.glint ? <Glint x={fx.glint[0]} y={fx.glint[1]} /> : null}
      {fx.leak ? <Leak dur={shot.dur} /> : null}
      {fx.circle ? <MarkerCircle x={fx.circle[0]} y={fx.circle[1]} r={fx.circle[2]} /> : null}
    </AbsoluteFill>
  );
};

const Flash: React.FC = () => {
  const f = useCurrentFrame();
  return <AbsoluteFill style={{background: '#fff4e4', opacity: interpolate(f, [0, 4], [0.85, 0], clamp)}} />;
};

const EndTitle: React.FC = () => {
  const f = useCurrentFrame();
  const word = (txt: string, at: number) => {
    const t = f - at;
    return (
      <span style={{display: 'inline-block', opacity: interpolate(t, [0, 4], [0, 1], clamp),
        transform: `translateY(${interpolate(t, [0, 8], [24, 0], {...clamp, easing: Easing.out(Easing.cubic)})}px)`}}>{txt}</span>
    );
  };
  return (
    <AbsoluteFill style={{direction: 'rtl', justifyContent: 'flex-start', alignItems: 'flex-start', padding: '330px 92px 0 92px'}}>
      <div style={{fontFamily: 'Frank', fontWeight: 900, fontSize: 172, lineHeight: 1, color: '#fbf3e6', display: 'flex', gap: 34,
        textShadow: '0 6px 44px rgba(0,0,0,0.55)'}}>
        {word('הבא', 0)}{word('בתור.', 15)}
      </div>
      <div style={{marginTop: 28, fontFamily: 'Heebo', fontWeight: 400, fontSize: 36, letterSpacing: 10, color: '#f0dfc6',
        opacity: interpolate(f, [30, 38], [0, 1], clamp)}}>
        דוד בוזגלו · ספר
      </div>
    </AbsoluteFill>
  );
};

export const Reel: React.FC = () => (
  <AbsoluteFill style={{background: '#0b0806'}}>
    {SHOTS.map((s, i) => (
      <Sequence key={i} from={s.from} durationInFrames={s.dur}><ShotView shot={s} /></Sequence>
    ))}
    {[120, 330, 570].map((t) => <Sequence key={t} from={t} durationInFrames={5}><Flash /></Sequence>)}
    <Sequence from={540}><EndTitle /></Sequence>
    <AbsoluteFill style={{background: 'radial-gradient(ellipse at 50% 45%, transparent 55%, rgba(8,5,3,0.5) 100%)'}} />
    <Grain />
    <Audio src={staticFile('music.wav')} />
  </AbsoluteFill>
);
