import React from 'react';
import {AbsoluteFill, Audio, Easing, Img, interpolate, random, Sequence, staticFile, useCurrentFrame} from 'remotion';

/* Rookie → master. 30 s at 30 fps, 120 BPM (beat = 15 frames). Illustrated stills, moved like a camera. */
const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;

type Move = {s: [number, number]; x: [number, number]; y: [number, number]}; // scale, origin x%, y%
type Shot = {from: number; dur: number; src: string; move: Move; shake?: number; grade?: string; whip?: boolean};

const COLD = 'saturate(0.6) contrast(1.05) brightness(0.92) hue-rotate(-8deg)';
const WARM = 'saturate(0.95) contrast(1.06) brightness(1.02)';
const GOLD = 'saturate(1.05) contrast(1.08) brightness(1.06) sepia(0.12)';

const SHOTS: Shot[] = [
  // ACT 1 — the mistake
  {from: 0, dur: 66, src: 'p01.png', move: {s: [1.0, 1.22], x: [50, 55], y: [38, 32]}, grade: WARM},
  {from: 66, dur: 24, src: 'p01.png', move: {s: [1.9, 2.0], x: [56, 56], y: [44, 44]}, grade: COLD},
  {from: 90, dur: 60, src: 'p02.png', move: {s: [1.15, 1.35], x: [40, 42], y: [35, 30]}, shake: 7, grade: COLD},
  {from: 150, dur: 60, src: 'p03.png', move: {s: [1.08, 1.18], x: [50, 50], y: [45, 45]}, grade: COLD},
  {from: 210, dur: 90, src: 'p04.png', move: {s: [1.25, 1.05], x: [50, 50], y: [50, 55]}, grade: COLD},
  // ACT 2 — the master
  {from: 300, dur: 60, src: 'p05.png', move: {s: [1.05, 1.2], x: [50, 50], y: [35, 30]}, grade: WARM},
  {from: 360, dur: 60, src: 'p06.png', move: {s: [1.1, 1.3], x: [50, 48], y: [50, 46]}, grade: WARM},
  // ACT 3 — the work (cut on the beat)
  {from: 420, dur: 45, src: 'p07.png', move: {s: [1.05, 1.15], x: [50, 50], y: [45, 42]}, grade: WARM},
  {from: 465, dur: 30, src: 'p08.png', move: {s: [1.1, 1.25], x: [50, 50], y: [45, 45]}, grade: WARM},
  {from: 495, dur: 30, src: 'p07.png', move: {s: [1.8, 1.95], x: [40, 40], y: [55, 55]}, grade: WARM},
  {from: 525, dur: 30, src: 'p08.png', move: {s: [1.9, 2.1], x: [55, 55], y: [40, 40]}, grade: WARM},
  {from: 555, dur: 15, src: 'p06.png', move: {s: [1.6, 1.7], x: [50, 50], y: [50, 50]}, grade: WARM},
  {from: 570, dur: 15, src: 'p07.png', move: {s: [2.3, 2.4], x: [60, 60], y: [30, 30]}, grade: WARM},
  {from: 585, dur: 15, src: 'p08.png', move: {s: [2.4, 2.5], x: [45, 45], y: [55, 55]}, grade: WARM},
  {from: 600, dur: 30, src: 'p07.png', move: {s: [1.2, 1.6], x: [50, 50], y: [40, 40]}, grade: WARM},
  // ACT 4 — the payoff
  {from: 630, dur: 150, src: 'p09.png', move: {s: [1.35, 1.02], x: [55, 50], y: [40, 45]}, grade: GOLD, whip: true},
  {from: 780, dur: 120, src: 'p10.png', move: {s: [1.0, 1.12], x: [50, 50], y: [50, 46]}, grade: GOLD},
];

const ShotView: React.FC<{shot: Shot}> = ({shot}) => {
  const f = useCurrentFrame();
  const p = interpolate(f, [0, shot.dur], [0, 1], {...clamp, easing: Easing.inOut(Easing.sin)});
  const s = shot.move.s[0] + (shot.move.s[1] - shot.move.s[0]) * p;
  const x = shot.move.x[0] + (shot.move.x[1] - shot.move.x[0]) * p;
  const y = shot.move.y[0] + (shot.move.y[1] - shot.move.y[0]) * p;
  const k = Math.floor(f / 2);
  const sh = shot.shake ?? 0;
  const hx = Math.sin(f / 19) * 3 + (random(`x${k}${shot.from}`) - 0.5) * sh;
  const hy = Math.cos(f / 23) * 3 + (random(`y${k}${shot.from}`) - 0.5) * sh;
  const whip = shot.whip ? interpolate(f, [0, 7], [-900, 0], {...clamp, easing: Easing.out(Easing.exp)}) : 0;
  const blur = shot.whip ? interpolate(f, [0, 7], [22, 0], clamp) : 0;
  return (
    <AbsoluteFill style={{overflow: 'hidden'}}>
      <Img
        src={staticFile(shot.src)}
        style={{
          position: 'absolute',
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          transformOrigin: `${x}% ${y}%`,
          transform: `translate(${hx + whip}px, ${hy}px) scale(${s})`,
          filter: `${shot.grade ?? WARM} blur(${blur}px)`,
        }}
      />
    </AbsoluteFill>
  );
};

/* time card: a quiet day counter, the story's clock */
const DayCard: React.FC<{text: string}> = ({text}) => {
  const f = useCurrentFrame();
  const o = interpolate(f, [0, 6, 44, 54], [0, 1, 1, 0], clamp);
  const ls = interpolate(f, [0, 20], [18, 8], {...clamp, easing: Easing.out(Easing.cubic)});
  return (
    <div
      style={{
        position: 'absolute',
        top: 300,
        width: '100%',
        textAlign: 'center',
        fontFamily: 'Heebo, sans-serif',
        fontWeight: 800,
        fontSize: 54,
        letterSpacing: ls,
        color: '#f3ece0',
        opacity: o,
        direction: 'rtl',
        textShadow: '0 3px 24px rgba(0,0,0,0.75)',
      }}
    >
      {text}
    </div>
  );
};


/* the story's words: one short line per beat, word by word, like a narrator who doesn't need to shout */
type Line = {from: number; dur: number; text: string; big?: boolean; quote?: boolean};
const LINES: Line[] = [
  {from: 6, dur: 46, text: 'יום ראשון בכיסא.'},
  {from: 92, dur: 54, text: 'יד רועדת.'},
  {from: 152, dur: 56, text: 'לקוח שלא חוזר.'},
  {from: 214, dur: 84, text: 'ולילה ארוך של שאלות.'},
  {from: 304, dur: 54, text: 'ואז הוא נכנס.'},
  {from: 364, dur: 54, text: 'אל תלחץ. תקשיב למכונה.', quote: true},
  {from: 424, dur: 70, text: 'כל לילה. עוד ראש. עוד קו.'},
  {from: 498, dur: 128, text: 'עד שהיד הפסיקה לרעוד.'},
  {from: 638, dur: 62, text: 'שנה אחרי.', big: true},
  {from: 704, dur: 74, text: 'אותה מראה. חיוך אחר.'},
  {from: 786, dur: 44, text: 'הכיסא מלא.'},
];

const Caption: React.FC<{text: string; big?: boolean; quote?: boolean}> = ({text, big, quote}) => {
  const f = useCurrentFrame();
  const words = text.split(' ');
  const per = 4; // frames between words
  return (
    <div
      style={{
        position: 'absolute',
        top: big ? 820 : 1330,
        left: 90,
        right: 90,
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'center',
        gap: big ? '0 28px' : '0 18px',
        direction: 'rtl',
      }}
    >
      {words.map((w, i) => {
        const t = f - i * per;
        const o = interpolate(t, [0, 5], [0, 1], clamp);
        const y = interpolate(t, [0, 7], [22, 0], {...clamp, easing: Easing.out(Easing.cubic)});
        return (
          <span
            key={i}
            style={{
              fontFamily: big ? 'Frank, serif' : 'Heebo, sans-serif',
              fontWeight: big ? 900 : 800,
              fontSize: big ? 150 : 68,
              lineHeight: 1.25,
              color: quote ? '#f6d9a8' : '#f6f1e7',
              opacity: o,
              transform: `translateY(${y}px)`,
              textShadow: '0 4px 28px rgba(0,0,0,0.85), 0 1px 3px rgba(0,0,0,0.9)',
              display: 'inline-block',
            }}
          >
            {i === 0 && quote ? '״' : ''}
            {w}
            {i === words.length - 1 && quote ? '״' : ''}
          </span>
        );
      })}
    </div>
  );
};

const Grain: React.FC = () => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{mixBlendMode: 'overlay', opacity: 0.3, pointerEvents: 'none'}}>
      <svg width="1080" height="1920">
        <filter id="g">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed={f % 24} />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter="url(#g)" />
      </svg>
    </AbsoluteFill>
  );
};

export const Story: React.FC = () => {
  const f = useCurrentFrame();
  // the bad reveal freezes: tape stop at 1.75 s → a dark beat (matches the score)
  const dip = interpolate(f, [52, 66, 88, 90], [0, 0.0, 0.0, 0], clamp);
  const flash = (at: number, len = 6, a = 0.85) => (f >= at && f < at + len ? interpolate(f, [at, at + len], [a, 0]) : 0);
  const fadeIn = interpolate(f, [0, 8], [1, 0], clamp);
  const fadeOut = interpolate(f, [870, 899], [0, 1], clamp);
  return (
    <AbsoluteFill style={{background: '#0b0a09'}}>
      {SHOTS.map((s, i) => (
        <Sequence key={i} from={s.from} durationInFrames={s.dur} layout="none">
          <ShotView shot={s} />
        </Sequence>
      ))}
      {LINES.map((l, i) => (
        <Sequence key={`l${i}`} from={l.from} durationInFrames={l.dur} layout="none">
          <Caption text={l.text} big={l.big} quote={l.quote} />
        </Sequence>
      ))}
      <AbsoluteFill style={{background: 'radial-gradient(ellipse at center, rgba(0,0,0,0) 55%, rgba(0,0,0,0.55) 100%)'}} />
      <AbsoluteFill style={{background: 'linear-gradient(0deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0) 38%)'}} />
      <Grain />
      <AbsoluteFill style={{background: '#000', opacity: Math.max(fadeIn, fadeOut, dip)}} />
      <AbsoluteFill style={{background: '#fff', opacity: flash(630, 6) + flash(780, 4, 0.4)}} />
      <div
        style={{
          position: 'absolute',
          bottom: 380,
          width: '100%',
          textAlign: 'center',
          fontFamily: 'Heebo, sans-serif',
          fontWeight: 400,
          fontSize: 40,
          letterSpacing: 12,
          color: '#f3ece0',
          opacity: interpolate(f, [830, 850, 880, 899], [0, 0.9, 0.9, 0], clamp),
          direction: 'rtl',
          textShadow: '0 2px 18px rgba(0,0,0,0.7)',
        }}
      >
        דוד בוזגלו
      </div>
      <Audio src={staticFile('music.wav')} />
    </AbsoluteFill>
  );
};
