import React from 'react';
import {AbsoluteFill, Audio, Easing, interpolate, random, Sequence, staticFile, useCurrentFrame} from 'remotion';

const GOLD = '#E9C46A';
const GOLD2 = '#F7DFA0';
const INK = '#0B0B0C';
const BEAT = 15;
const FONT = 'Heebo, HeeboLatin, sans-serif';
const outExpo = Easing.out(Easing.exp);
const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;

// Hits (frames) that shake the camera and flash the chroma split
const HITS = [0, 20, 45, 90, 105, 120, 150, 165, 180, 195, 210, 240, 270, 285, 300, 330, 360, 390, 420];

const hitAmount = (f: number) => {
  let a = 0;
  for (const h of HITS) if (f >= h && f < h + 8) a = Math.max(a, 1 - (f - h) / 8);
  return a;
};

/* ---------- global layers ---------- */
const Background: React.FC<{tint?: number}> = ({tint = 1}) => {
  const f = useCurrentFrame();
  const x = 50 + Math.sin(f / 23) * 18;
  const y = 45 + Math.cos(f / 31) * 14;
  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(ellipse 70% 45% at ${x}% ${y}%, rgba(233,196,106,${0.16 * tint}) 0%, rgba(233,196,106,0) 60%), radial-gradient(circle at 50% 50%, #17150f 0%, ${INK} 70%)`,
      }}
    />
  );
};

const Grain: React.FC = () => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{pointerEvents: 'none', mixBlendMode: 'overlay', opacity: 0.32}}>
      <svg width="1080" height="1920">
        <filter id="n">
          <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed={f % 12} />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter="url(#n)" />
      </svg>
    </AbsoluteFill>
  );
};

const Vignette: React.FC = () => (
  <AbsoluteFill style={{background: 'radial-gradient(ellipse at center, rgba(0,0,0,0) 55%, rgba(0,0,0,0.75) 100%)'}} />
);

const Flash: React.FC<{at: number; len?: number}> = ({at, len = 5}) => {
  const f = useCurrentFrame();
  const o = interpolate(f, [at, at + len], [0.95, 0], clamp);
  return f >= at && f < at + len ? <AbsoluteFill style={{background: '#fff', opacity: o}} /> : null;
};

/* ---------- building blocks ---------- */
type Enter = 'zoomIn' | 'zoomOut' | 'whipL' | 'whipR' | 'whipUp' | 'drop';

const Punch: React.FC<{children: React.ReactNode; enter?: Enter; dur: number; drift?: number}> = ({
  children,
  enter = 'zoomIn',
  dur,
  drift = 0.06,
}) => {
  const f = useCurrentFrame(); // local to Sequence
  const p = interpolate(f, [0, 6], [0, 1], {...clamp, easing: outExpo});
  const blur = interpolate(f, [0, 5], [16, 0], clamp);
  const push = interpolate(f, [0, dur], [1, 1 + drift], clamp); // continuous slow push: never static
  let tf = '';
  switch (enter) {
    case 'zoomIn': tf = `scale(${interpolate(p, [0, 1], [2.4, 1])})`; break;
    case 'zoomOut': tf = `scale(${interpolate(p, [0, 1], [0.35, 1])})`; break;
    case 'whipL': tf = `translateX(${interpolate(p, [0, 1], [-1100, 0])}px) skewX(${interpolate(p, [0, 1], [18, 0])}deg)`; break;
    case 'whipR': tf = `translateX(${interpolate(p, [0, 1], [1100, 0])}px) skewX(${interpolate(p, [0, 1], [-18, 0])}deg)`; break;
    case 'whipUp': tf = `translateY(${interpolate(p, [0, 1], [900, 0])}px)`; break;
    case 'drop': tf = `translateY(${interpolate(p, [0, 1], [-700, 0])}px) scale(${interpolate(p, [0, 1], [1.5, 1])})`; break;
  }
  const blurDir = enter.startsWith('whip') ? `blur(${blur * 0.6}px)` : `blur(${blur * 0.5}px)`;
  return (
    <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center', transform: `${tf} scale(${push})`, filter: blurDir}}>
      {children}
    </AbsoluteFill>
  );
};

const Word: React.FC<{
  text: string;
  size?: number;
  color?: string;
  outline?: boolean;
  weight?: number;
  y?: number;
  spacing?: number;
}> = ({text, size = 300, color = '#F5F1E8', outline = false, weight = 900, y = 0, spacing = -6}) => {
  const f = useCurrentFrame();
  const c = Math.max(0, 1 - f / 7) * 14; // chroma split on entry
  return (
    <div
      style={{
        fontFamily: FONT,
        fontWeight: weight,
        fontSize: size,
        lineHeight: 1,
        letterSpacing: spacing,
        direction: 'rtl',
        textAlign: 'center',
        color: outline ? 'transparent' : color,
        WebkitTextStroke: outline ? `6px ${color}` : undefined,
        transform: `translateY(${y}px)`,
        textShadow: outline
          ? undefined
          : `${c}px 0 rgba(255,40,80,0.75), ${-c}px 0 rgba(40,220,255,0.75), 0 18px 60px rgba(0,0,0,0.6)`,
        whiteSpace: 'pre',
      }}
    >
      {text}
    </div>
  );
};

const Caption: React.FC<{text: string; y: number; color?: string}> = ({text, y, color = GOLD}) => {
  const f = useCurrentFrame();
  const o = interpolate(f, [2, 6], [0, 1], clamp);
  const ty = interpolate(f, [2, 8], [30, 0], {...clamp, easing: outExpo});
  return (
    <div
      style={{
        position: 'absolute',
        top: 960 + y,
        width: '100%',
        textAlign: 'center',
        fontFamily: FONT,
        fontWeight: 800,
        fontSize: 64,
        letterSpacing: 6,
        color,
        opacity: o,
        transform: `translateY(${ty}px)`,
        direction: 'rtl',
      }}
    >
      {text}
    </div>
  );
};

/* ---------- motif visuals ---------- */
const FadeBars: React.FC = () => {
  // skin-fade gradient: dense dark at bottom thinning to light — sliding lines
  const f = useCurrentFrame();
  const lines = Array.from({length: 46});
  return (
    <AbsoluteFill style={{opacity: 0.55}}>
      {lines.map((_, i) => {
        const t = i / lines.length;
        const h = 2 + (1 - t) * 26;
        const x = interpolate(f, [0, 15], [i % 2 ? -400 : 400, 0], {...clamp, easing: outExpo});
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: 1920 - (t * 1920 + 10),
              height: h,
              transform: `translateX(${x * (1 - t)}px)`,
              background: `linear-gradient(90deg, rgba(233,196,106,0), rgba(233,196,106,${0.15 + (1 - t) * 0.6}), rgba(233,196,106,0))`,
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

const RazorLine: React.FC<{vertical?: boolean}> = ({vertical}) => {
  const f = useCurrentFrame();
  const p = interpolate(f, [0, 9], [0, 1], {...clamp, easing: outExpo});
  return (
    <AbsoluteFill>
      <div
        style={{
          position: 'absolute',
          left: vertical ? 540 - 3 : 0,
          top: vertical ? 0 : 1180,
          width: vertical ? 6 : `${p * 100}%`,
          height: vertical ? `${p * 100}%` : 6,
          background: GOLD2,
          boxShadow: `0 0 30px ${GOLD}, 0 0 80px ${GOLD}`,
        }}
      />
    </AbsoluteFill>
  );
};

const GuardNumbers: React.FC = () => {
  const f = useCurrentFrame();
  const list = ['0.5', '1', '1.5', '2', '3'];
  const idx = Math.min(list.length - 1, Math.floor(f / 6));
  const local = f - idx * 6;
  const s = interpolate(local, [0, 4], [1.6, 1], {...clamp, easing: outExpo});
  return (
    <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center'}}>
      <div style={{transform: `scale(${s})`}}>
        <Word text={`#${list[idx]}`} size={420} outline={idx % 2 === 1} color={idx % 2 ? GOLD : '#F5F1E8'} spacing={-12} />
      </div>
      <Caption text="מספר מכונה" y={330} />
    </AbsoluteFill>
  );
};

const BeforeAfter: React.FC = () => {
  const f = useCurrentFrame();
  const split = interpolate(f, [0, 8], [1080, 540], {...clamp, easing: outExpo});
  const messy = Array.from({length: 22}).map((_, i) => {
    let d = `M 0 ${300 + i * 60}`;
    for (let x = 0; x <= 540; x += 30) d += ` L ${x} ${300 + i * 60 + (random(`m${i}-${x}-${Math.floor(f / 2)}`) - 0.5) * 70}`;
    return d;
  });
  return (
    <AbsoluteFill>
      <svg width="1080" height="1920" style={{position: 'absolute'}}>
        <clipPath id="L"><rect x="0" y="0" width={split} height="1920" /></clipPath>
        <g clipPath="url(#L)" stroke="#6d6a63" strokeWidth="5" fill="none" opacity="0.8">
          {messy.map((d, i) => <path key={i} d={d} />)}
        </g>
        <g stroke={GOLD} strokeWidth="6" opacity="0.95">
          {Array.from({length: 22}).map((_, i) => (
            <line key={i} x1={split} x2={1080} y1={300 + i * 60} y2={300 + i * 60} />
          ))}
        </g>
        <line x1={split} x2={split} y1={0} y2={1920} stroke="#fff" strokeWidth="6" />
      </svg>
      <div style={{position: 'absolute', top: 1660, left: 0, width: 540, textAlign: 'center', fontFamily: FONT, fontWeight: 900, fontSize: 96, color: '#9b978e'}}>לפני</div>
      <div style={{position: 'absolute', top: 1660, left: 540, width: 540, textAlign: 'center', fontFamily: FONT, fontWeight: 900, fontSize: 96, color: GOLD}}>אחרי</div>
    </AbsoluteFill>
  );
};

const Scissors: React.FC = () => {
  const f = useCurrentFrame();
  const a = Math.sin(f * 1.1) * 14;
  return (
    <svg width="360" height="360" viewBox="-180 -180 360 360" style={{position: 'absolute', top: 260, left: 360, opacity: 0.9}}>
      <g stroke={GOLD} strokeWidth="14" fill="none" strokeLinecap="round">
        <g transform={`rotate(${a})`}><line x1="0" y1="0" x2="0" y2="-160" /><circle cx="-38" cy="70" r="40" /><line x1="0" y1="0" x2="-20" y2="34" /></g>
        <g transform={`rotate(${-a})`}><line x1="0" y1="0" x2="0" y2="-160" /><circle cx="38" cy="70" r="40" /><line x1="0" y1="0" x2="20" y2="34" /></g>
      </g>
      <circle r="10" fill={GOLD2} />
    </svg>
  );
};

/* ---------- outro ---------- */
const Outro: React.FC = () => {
  const f = useCurrentFrame();
  const s = interpolate(f, [0, 8], [3, 1], {...clamp, easing: outExpo});
  const shine = interpolate(f, [8, 30], [-60, 160], clamp);
  const pill = interpolate(f, [18, 26], [0, 1], {...clamp, easing: outExpo});
  const tap = f >= 40 && f < 46 ? 0.92 : 1;
  const followed = f >= 43;
  return (
    <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center'}}>
      <div style={{transform: `scale(${s})`, position: 'relative'}}>
        <div
          style={{
            fontFamily: FONT,
            fontWeight: 900,
            fontSize: 380,
            lineHeight: 1,
            letterSpacing: -10,
            backgroundImage: `linear-gradient(100deg, ${GOLD} ${shine - 30}%, #fff8e1 ${shine}%, ${GOLD} ${shine + 30}%)`,
            WebkitBackgroundClip: 'text',
            color: 'transparent',
            filter: `drop-shadow(0 0 40px rgba(233,196,106,0.45))`,
          }}
        >
          דוד
        </div>
      </div>
      <div style={{fontFamily: FONT, fontWeight: 800, fontSize: 60, letterSpacing: 14, color: '#F5F1E8', marginTop: 10, opacity: interpolate(f, [6, 12], [0, 1], clamp), direction: 'rtl'}}>
        ספר · סטייל · ביטחון
      </div>
      <div
        style={{
          marginTop: 90,
          transform: `scale(${pill * tap})`,
          background: followed ? 'transparent' : GOLD,
          border: `5px solid ${GOLD}`,
          color: followed ? GOLD : INK,
          fontFamily: FONT,
          fontWeight: 900,
          fontSize: 66,
          padding: '26px 80px',
          borderRadius: 999,
          direction: 'rtl',
        }}
      >
        {followed ? 'במעקב ✓' : 'עקבו'}
      </div>
      <div style={{fontFamily: FONT, fontWeight: 500, fontSize: 48, color: '#cfc9bb', marginTop: 40, opacity: interpolate(f, [26, 32], [0, 1], clamp), direction: 'rtl'}}>
        מתחילים בקרוב
      </div>
    </AbsoluteFill>
  );
};

/* ---------- the edit ---------- */
type Shot = {from: number; dur: number; enter: Enter; node: React.ReactNode; fx?: React.ReactNode; bgTint?: number};

const shots: Shot[] = [
  // HOOK
  {from: 0, dur: 20, enter: 'zoomIn', node: <Word text="רגע." size={420} />},
  {from: 20, dur: 25, enter: 'whipR', node: <Word text={'לפני\nשאתה'} size={250} />},
  {from: 45, dur: 45, enter: 'zoomOut', drift: 0.35, node: <><Word text={'מסתפר\nשוב...'} size={230} color={GOLD2} /></>} as Shot,
  // DROP
  {from: 90, dur: 15, enter: 'zoomIn', node: <Word text="פייד" size={380} />, fx: <FadeBars />},
  {from: 105, dur: 15, enter: 'drop', node: <Word text="חד." size={420} color={GOLD} />, fx: <FadeBars />},
  {from: 120, dur: 30, enter: 'zoomOut', node: <GuardNumbers />},
  {from: 150, dur: 15, enter: 'whipL', node: <Word text="קו" size={420} />, fx: <RazorLine vertical />},
  {from: 165, dur: 15, enter: 'zoomIn', node: <Word text="נקי." size={400} color={GOLD} />, fx: <RazorLine />},
  {from: 180, dur: 15, enter: 'whipUp', node: <Word text="זקן" size={420} />},
  {from: 195, dur: 15, enter: 'zoomIn', node: <Word text="מדויק." size={300} color={GOLD} outline />},
  {from: 210, dur: 30, enter: 'whipR', node: <BeforeAfter />},
  {from: 240, dur: 30, enter: 'zoomOut', node: <><Scissors /><Word text={'בלי\nפשרות.'} size={250} y={140} /></>},
  {from: 270, dur: 15, enter: 'whipL', node: <Word text="כל פרט." size={230} />},
  {from: 285, dur: 15, enter: 'whipR', node: <Word text="כל קו." size={250} color={GOLD} />},
  {from: 300, dur: 30, enter: 'zoomIn', node: <Word text="כל פעם." size={240} />},
  {from: 330, dur: 30, enter: 'zoomOut', bgTint: 0.2, node: <Word text={'זה לא עוד\nתספורת.'} size={150} weight={800} spacing={0} />},
  {from: 360, dur: 30, enter: 'drop', bgTint: 1.8, node: <Word text={'זה\nסטייל.'} size={330} color={GOLD} />},
  // OUTRO
  {from: 390, dur: 60, enter: 'zoomIn', bgTint: 1.4, node: <Outro />},
];

export const Reel: React.FC = () => {
  const f = useCurrentFrame();
  const h = hitAmount(f);
  const sx = (random(`sx${f}`) - 0.5) * 34 * h;
  const sy = (random(`sy${f}`) - 0.5) * 34 * h;
  const rot = (random(`r${f}`) - 0.5) * 2.2 * h;
  const beatPulse = f >= 90 && f < 390 ? 1 + 0.025 * Math.max(0, 1 - (f % BEAT) / 5) : 1;
  const current = shots.find((s) => f >= s.from && f < s.from + s.dur);
  return (
    <AbsoluteFill style={{background: INK, overflow: 'hidden'}}>
      <Background tint={current?.bgTint ?? 1} />
      <AbsoluteFill style={{transform: `translate(${sx}px, ${sy}px) rotate(${rot}deg) scale(${beatPulse})`}}>
        {shots.map((s, i) => (
          <Sequence key={i} from={s.from} durationInFrames={s.dur} layout="none">
            <AbsoluteFill>
              {s.fx}
              <Punch enter={s.enter} dur={s.dur} drift={(s as Shot & {drift?: number}).drift}>
                {s.node}
              </Punch>
            </AbsoluteFill>
          </Sequence>
        ))}
      </AbsoluteFill>
      <Vignette />
      <Grain />
      <Flash at={90} len={6} />
      <Flash at={360} len={4} />
      <Flash at={390} len={6} />
      <Audio src={staticFile('music.wav')} />
    </AbsoluteFill>
  );
};
