import React from 'react';
import {AbsoluteFill, Audio, Easing, interpolate, random, Sequence, staticFile, useCurrentFrame} from 'remotion';

/* Reel 02 — "העדר". 150 BPM: one beat = 12 frames. Drop at frame 120. */

const PAPER = '#EDE8DE';
const INK = '#0A0A0A';
const RED = '#FF3B1F';
const outExpo = Easing.out(Easing.exp);
const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;
const SANS = 'Heebo, HeeboLatin, sans-serif';

/* ---------------- the herd ---------------- */
const COLS = 7;
const ROWS = 11;
const CW = 1080 / COLS;
const CH = 1920 / ROWS;
const LEADER = {c: 3, r: 5};

const Head: React.FC<{leader?: number; pop?: number; seed: number}> = ({leader = 0, pop = 1, seed}) => {
  // leader: 0 = one of the herd, 1 = the new cut
  const tilt = (random(`t${seed}`) - 0.5) * 3;
  const skin = leader > 0.5 ? PAPER : '#5b5b5b';
  const body = leader > 0.5 ? '#d9d3c7' : '#3b3b3b';
  return (
    <svg viewBox="0 0 100 120" width={CW} height={CH} style={{transform: `scale(${pop}) rotate(${tilt}deg)`}}>
      <path d="M8 120 Q10 88 50 86 Q90 88 92 120 Z" fill={body} />
      <rect x="42" y="70" width="16" height="20" fill={skin} />
      <ellipse cx="50" cy="52" rx="22" ry="27" fill={skin} />
      {leader > 0.5 ? (
        <g>
          {/* high skin fade + sharp textured top */}
          <defs>
            <linearGradient id={`f${seed}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor={INK} stopOpacity="0.95" />
              <stop offset="1" stopColor={INK} stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d="M27 47 L28 30 Q36 14 52 15 Q70 15 73 30 L73 47 Q72 40 70 37 L30 37 Q28 40 27 47 Z" fill={`url(#f${seed})`} />
          <path d="M29 37 L28 27 Q40 10 56 13 Q71 16 72 28 L71 37 Z" fill={INK} />
          <path d="M30 31 L70 26" stroke={PAPER} strokeWidth="1.2" opacity="0.7" />
          {/* sharp beard line */}
          <path d="M28 55 Q30 78 50 81 Q70 78 72 55 L68 60 Q64 72 50 73 Q36 72 32 60 Z" fill={INK} opacity="0.9" />
        </g>
      ) : (
        <path d="M27 50 Q26 22 50 21 Q74 22 73 50 Q70 36 50 35 Q30 36 27 50 Z" fill="#262626" />
      )}
    </svg>
  );
};

const Herd: React.FC<{rippleAt?: number; leaderOn?: boolean}> = ({rippleAt, leaderOn = true}) => {
  const f = useCurrentFrame();
  const cells = [];
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++) {
      const isLeader = c === LEADER.c && r === LEADER.r;
      const d = Math.hypot(c - LEADER.c, (r - LEADER.r) * 0.9);
      let leader = isLeader && leaderOn ? 1 : 0;
      let pop = 1;
      if (rippleAt !== undefined && !isLeader) {
        const t0 = rippleAt + d * 7 + random(`j${r}-${c}`) * 5;
        leader = f >= t0 ? 1 : 0;
        pop = interpolate(f, [t0, t0 + 3, t0 + 9], [1, 1.22, 1], clamp);
      }
      cells.push(
        <div key={`${r}-${c}`} style={{position: 'absolute', left: c * CW, top: r * CH, width: CW, height: CH}}>
          <Head leader={leader} pop={pop} seed={r * COLS + c} />
        </div>,
      );
    }
  return <AbsoluteFill>{cells}</AbsoluteFill>;
};

/* camera on the herd: zoom (s) centred on a cell */
const Cam: React.FC<{s: number; c: number; r: number; children: React.ReactNode}> = ({s, c, r, children}) => {
  const cx = (c + 0.5) * CW;
  const cy = (r + 0.5) * CH;
  return (
    <AbsoluteFill style={{transformOrigin: '0 0', transform: `translate(${540 - cx * s}px, ${960 - cy * s}px) scale(${s})`}}>
      {children}
    </AbsoluteFill>
  );
};

/* ---------------- type ---------------- */
// native-app caption: white box, black text (looks typed in the app, not designed)
const AppCaption: React.FC<{text: string; top: number; typeFrom?: number; typeTo?: number; right?: number}> = ({
  text,
  top,
  typeFrom,
  typeTo,
  right = 70,
}) => {
  const f = useCurrentFrame();
  const chars = Array.from(text);
  const n = typeFrom === undefined ? chars.length : Math.round(interpolate(f, [typeFrom, typeTo!], [0, chars.length], clamp));
  if (n === 0) return null;
  return (
    <div
      style={{
        position: 'absolute',
        top,
        right,
        maxWidth: 860,
        background: '#fff',
        color: '#000',
        fontFamily: SANS,
        fontWeight: 700,
        fontSize: 60,
        lineHeight: 1.25,
        padding: '14px 26px 18px',
        borderRadius: 16,
        direction: 'rtl',
        boxShadow: '0 6px 0 rgba(0,0,0,0.25)',
      }}
    >
      {chars.slice(0, n).join('')}
    </div>
  );
};

const Big: React.FC<{text: string; size?: number; color?: string; style?: React.CSSProperties}> = ({
  text,
  size = 230,
  color = PAPER,
  style,
}) => (
  <div
    style={{
      fontFamily: 'Frank, serif',
      fontWeight: 900,
      fontSize: size,
      lineHeight: 0.95,
      letterSpacing: -4,
      color,
      direction: 'rtl',
      whiteSpace: 'pre',
      ...style,
    }}
  >
    {text}
  </div>
);

/* hand-drawn marker stroke, animated like a pen */
const Pen: React.FC<{d: string; from: number; len: number; width?: number; total?: number; color?: string}> = ({
  d,
  from,
  len,
  width = 14,
  total = 3000,
  color = RED,
}) => {
  const f = useCurrentFrame();
  const p = interpolate(f, [from, from + len], [0, 1], {...clamp, easing: Easing.inOut(Easing.quad)});
  if (f < from) return null;
  return (
    <svg width="1080" height="1920" style={{position: 'absolute', inset: 0, overflow: 'visible'}}>
      <path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth={width}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={total}
        strokeDashoffset={total * (1 - p)}
        style={{filter: 'url(#rough)'}}
      />
    </svg>
  );
};

/* handwriting revealed in writing direction (right → left) */
const Hand: React.FC<{text: string; from: number; len: number; style: React.CSSProperties}> = ({text, from, len, style}) => {
  const f = useCurrentFrame();
  const p = interpolate(f, [from, from + len], [100, 0], clamp);
  if (f < from) return null;
  return (
    <div
      style={{
        position: 'absolute',
        fontFamily: 'Marker, sans-serif',
        fontWeight: 700,
        color: RED,
        direction: 'rtl',
        whiteSpace: 'pre',
        clipPath: `inset(-20% 0 -20% ${p}%)`,
        ...style,
      }}
    >
      {text}
    </div>
  );
};

/* ---------------- film layers (the "shot on something real" feel) ---------------- */
const Grain: React.FC<{amount?: number}> = ({amount = 0.38}) => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{pointerEvents: 'none', mixBlendMode: 'overlay', opacity: amount}}>
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

const Dust: React.FC = () => {
  const f = useCurrentFrame();
  const specks = Array.from({length: 7}).map((_, i) => {
    const on = random(`on${f}-${i}`) > 0.72;
    if (!on) return null;
    const x = random(`x${f}-${i}`) * 1080;
    const y = random(`y${f}-${i}`) * 1920;
    const hair = random(`h${f}-${i}`) > 0.85;
    return hair ? (
      <path key={i} d={`M${x} ${y} q 30 ${20 + random(`q${f}${i}`) * 40} ${60} ${10}`} stroke="#fff" strokeWidth="2" fill="none" opacity="0.5" />
    ) : (
      <circle key={i} cx={x} cy={y} r={1.5 + random(`r${f}-${i}`) * 3} fill="#fff" opacity="0.55" />
    );
  });
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      <svg width="1080" height="1920">{specks}</svg>
    </AbsoluteFill>
  );
};

const Camcorder: React.FC = () => {
  const f = useCurrentFrame();
  const sec = Math.floor(f / 30);
  const fr = f % 30;
  const tc = `00:00:${String(sec).padStart(2, '0')}:${String(fr).padStart(2, '0')}`;
  const blink = Math.floor(f / 15) % 2 === 0;
  return (
    <AbsoluteFill style={{pointerEvents: 'none', fontFamily: 'HeeboLatin, sans-serif', fontWeight: 500, color: PAPER, opacity: 0.72}}>
      <div style={{position: 'absolute', top: 120, left: 64, fontSize: 34, letterSpacing: 2, display: 'flex', alignItems: 'center', gap: 12}}>
        <span style={{width: 18, height: 18, borderRadius: 9, background: RED, opacity: blink ? 1 : 0.15}} />
        REC
      </div>
      <div style={{position: 'absolute', bottom: 120, left: 64, fontSize: 32, letterSpacing: 3}}>{tc}</div>
    </AbsoluteFill>
  );
};

/* ---------------- scenes ---------------- */
// 0–48: the herd, a line being typed
const SceneHerd: React.FC = () => {
  const f = useCurrentFrame();
  const s = interpolate(f, [0, 48], [1.0, 1.12]);
  return (
    <AbsoluteFill>
      <Cam s={s} c={3} r={5}>
        <Herd leaderOn={false} />
      </Cam>
      <AppCaption text="כולם נראים אותו דבר." top={300} typeFrom={6} typeTo={36} />
    </AbsoluteFill>
  );
};

// 48–84: three hard cuts
const SameCard: React.FC<{text: string; c: number; r: number; side: 'r' | 'l'}> = ({text, c, r, side}) => {
  const f = useCurrentFrame();
  const s = interpolate(f, [0, 12], [2.9, 3.1]);
  return (
    <AbsoluteFill>
      <Cam s={s} c={c} r={r}>
        <Herd leaderOn={false} />
      </Cam>
      <AbsoluteFill style={{background: 'linear-gradient(0deg, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0) 45%)'}} />
      <Big text={text} size={170} style={{position: 'absolute', bottom: 330, [side === 'r' ? 'right' : 'left']: 70}} />
    </AbsoluteFill>
  );
};

// 84–120: tape stop → frozen → circle the one → push in
const SceneOne: React.FC = () => {
  const f = useCurrentFrame(); // local 0..36
  const sat = interpolate(f, [0, 12], [1, 0], clamp);
  const bright = interpolate(f, [0, 12, 13], [1, 0.55, 0.8], clamp);
  const sink = interpolate(f, [0, 12], [1, 0.97], clamp);
  const zoom = 1.9 * interpolate(f, [26, 36], [1, 2.6], {...clamp, easing: Easing.in(Easing.exp)});
  const cx = (LEADER.c + 0.5) * CW;
  const cy = (LEADER.r + 0.5) * CH;
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{transformOrigin: `${cx}px ${cy}px`, transform: `scale(${sink * zoom})`}}>
        <AbsoluteFill style={{filter: `saturate(${sat}) brightness(${bright})`}}>
          <Herd leaderOn={f >= 12} />
        </AbsoluteFill>
        <Pen
          from={14}
          len={10}
          width={9}
          total={900}
          d={`M ${cx + 70} ${cy - 40} C ${cx + 95} ${cy - 120}, ${cx - 100} ${cy - 125}, ${cx - 92} ${cy - 10} C ${cx - 85} ${cy + 95}, ${cx + 90} ${cy + 100}, ${cx + 88} ${cy - 15} C ${cx + 86} ${cy - 70}, ${cx + 40} ${cy - 100}, ${cx + 5} ${cy - 98}`}
        />
        <Pen from={20} len={5} width={7} total={500} d={`M ${cx - 175} ${cy - 215} Q ${cx - 150} ${cy - 150} ${cx - 98} ${cy - 108} M ${cx - 98} ${cy - 108} l -34 -4 M ${cx - 98} ${cy - 108} l -6 -32`} />
        <Hand text="אני" from={21} len={5} style={{left: cx - 280, top: cy - 330, fontSize: 110, transform: 'rotate(-8deg)'}} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// 120–216: the statement, word on every beat, then crossed out and rewritten
const SceneStatement: React.FC = () => {
  const f = useCurrentFrame(); // local, beat = 12
  const lines = [
    {t: 'אני', at: 0, y: 430},
    {t: 'לא הולך', at: 12, y: 660},
    {t: 'אחרי', at: 24, y: 890},
    {t: 'העדר.', at: 36, y: 1120},
  ];
    return (
    <AbsoluteFill style={{background: INK}}>
      {lines.map((l, i) => {
        if (f < l.at) return null;
        const p = interpolate(f, [l.at, l.at + 4], [0, 1], {...clamp, easing: outExpo});
        const k = interpolate(f, [66, 72], [0, 1], {...clamp, easing: outExpo});
        const isStruck = i === 1 || i === 2;
        const dim = isStruck ? 1 - 0.7 * k : 1;
        const shrink = isStruck ? 1 - 0.5 * k : 1;
        return (
          <Big
            key={i}
            text={l.t}
            size={250}
            style={{position: 'absolute', right: 80, top: l.y, opacity: dim, transform: `translateY(${(1 - p) * 60}px) scale(${(1 + (1 - p) * 0.12) * shrink})`, transformOrigin: 'right center'}}
          />
        );
      })}
      {/* strike through "לא הולך" and "אחרי" — quick, imperfect, like a real marker */}
      <AbsoluteFill style={{transformOrigin: '1000px 900px', transform: `scale(${1 - 0.5 * interpolate(f, [66, 72], [0, 1], {...clamp, easing: outExpo})})`, opacity: 1 - 0.5 * interpolate(f, [66, 72], [0, 1], clamp)}}>
        <Pen from={60} len={4} width={20} total={1200} d="M 1010 790 C 820 770, 560 800, 300 785" />
        <Pen from={63} len={4} width={20} total={1200} d="M 1010 1015 C 860 1000, 700 1030, 560 1010" />
      </AbsoluteFill>
      <Hand text={'יוצר את'} from={72} len={9} style={{left: 45, top: 720, fontSize: 290, transform: 'rotate(-6deg)', lineHeight: 1, WebkitTextStroke: `4px ${RED}`}} />
    </AbsoluteFill>
  );
};

// 216–312: the cut spreads through the herd
const SceneRipple: React.FC = () => {
  const f = useCurrentFrame();
  const s = interpolate(f, [0, 96], [1.55, 1.0], {...clamp, easing: Easing.out(Easing.quad)});
  return (
    <AbsoluteFill>
      <Cam s={s} c={3} r={5}>
        <Herd rippleAt={8} />
      </Cam>
      <AppCaption text="עוד שבוע כולם יבקשו את זה." top={300} typeFrom={30} typeTo={60} />
    </AbsoluteFill>
  );
};

// 312–360: four flat statements, inverted cuts
const Flat: React.FC<{text: string; invert: boolean; y: number}> = ({text, invert, y}) => (
  <AbsoluteFill style={{background: invert ? PAPER : INK}}>
    <div
      style={{
        position: 'absolute',
        top: y,
        right: 80,
        fontFamily: SANS,
        fontWeight: 800,
        fontSize: 150,
        letterSpacing: -3,
        color: invert ? INK : PAPER,
        direction: 'rtl',
      }}
    >
      {text}
    </div>
  </AbsoluteFill>
);

// 360–450: the name
const SceneName: React.FC = () => {
  const f = useCurrentFrame();
  const o = interpolate(f, [0, 10], [0, 1], clamp);
  const ls = interpolate(f, [0, 30], [24, 2], {...clamp, easing: outExpo});
  return (
    <AbsoluteFill style={{background: INK, alignItems: 'center', justifyContent: 'center'}}>
      <div style={{fontFamily: 'DavidLibre, serif', fontWeight: 700, fontSize: 150, color: PAPER, letterSpacing: ls, opacity: o, direction: 'rtl'}}>
        דוד בוזגלו
      </div>
      <div style={{fontFamily: SANS, fontWeight: 400, fontSize: 46, letterSpacing: 18, color: '#a9a397', marginTop: 26, opacity: interpolate(f, [12, 22], [0, 1], clamp)}}>
        ספר
      </div>
      <Pen from={48} len={8} width={10} total={1400} d="M 830 1075 C 650 1100, 420 1060, 250 1090" />
      <div
        style={{
          position: 'absolute',
          bottom: 300,
          fontFamily: SANS,
          fontWeight: 400,
          fontSize: 40,
          color: '#8d887d',
          opacity: interpolate(f, [62, 72], [0, 1], clamp),
          direction: 'rtl',
        }}
      >
        בקרוב.
      </div>
    </AbsoluteFill>
  );
};

/* ---------------- the edit ---------------- */
export const Reel: React.FC = () => {
  const f = useCurrentFrame();
  // gate weave: a projector's tiny jitter, updated every 2 frames
  const k = Math.floor(f / 2);
  const wx = (random(`wx${k}`) - 0.5) * 3;
  const wy = (random(`wy${k}`) - 0.5) * 3;
  // hits: drop (120), strike (180), the last beat (408)
  const hit = Math.max(...[120, 180, 408].map((h) => (f >= h && f < h + 7 ? 1 - (f - h) / 7 : 0)));
  const sx = (random(`sx${f}`) - 0.5) * 26 * hit;
  const sy = (random(`sy${f}`) - 0.5) * 26 * hit;
  const flicker = 1 + (random(`fl${k}`) - 0.5) * 0.06;
  return (
    <AbsoluteFill style={{background: INK, overflow: 'hidden'}}>
      <svg width="0" height="0" style={{position: 'absolute'}}>
        <filter id="rough">
          <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="2" seed="4" />
          <feDisplacementMap in="SourceGraphic" scale="6" />
        </filter>
      </svg>
      <AbsoluteFill style={{transform: `translate(${wx + sx}px, ${wy + sy}px)`, filter: `brightness(${flicker}) contrast(1.08)`}}>
        <Sequence from={0} durationInFrames={48} layout="none"><SceneHerd /></Sequence>
        <Sequence from={48} durationInFrames={12} layout="none"><SameCard text="אותו פייד." c={1} r={2} side="r" /></Sequence>
        <Sequence from={60} durationInFrames={12} layout="none"><SameCard text="אותו קו." c={5} r={7} side="l" /></Sequence>
        <Sequence from={72} durationInFrames={12} layout="none"><SameCard text="אותו ספר." c={2} r={8} side="r" /></Sequence>
        <Sequence from={84} durationInFrames={36} layout="none"><SceneOne /></Sequence>
        <Sequence from={120} durationInFrames={96} layout="none"><SceneStatement /></Sequence>
        <Sequence from={216} durationInFrames={96} layout="none"><SceneRipple /></Sequence>
        <Sequence from={312} durationInFrames={12} layout="none"><Flat text="לא מסביר." invert={false} y={800} /></Sequence>
        <Sequence from={324} durationInFrames={12} layout="none"><Flat text="לא מתנצל." invert y={880} /></Sequence>
        <Sequence from={336} durationInFrames={12} layout="none"><Flat text="לא מחכה." invert={false} y={960} /></Sequence>
        <Sequence from={348} durationInFrames={12} layout="none"><Flat text="עושה." invert y={1040} /></Sequence>
        <Sequence from={360} durationInFrames={90} layout="none"><SceneName /></Sequence>
      </AbsoluteFill>
      {!((f >= 324 && f < 336) || (f >= 348 && f < 360)) && (
        <AbsoluteFill style={{background: 'radial-gradient(ellipse at center, rgba(0,0,0,0) 62%, rgba(0,0,0,0.45) 100%)', pointerEvents: 'none'}} />
      )}
      <Dust />
      <Grain />
      <Camcorder />
      <Audio src={staticFile('music.wav')} />
    </AbsoluteFill>
  );
};
