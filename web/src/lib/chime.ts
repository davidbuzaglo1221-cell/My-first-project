// Rest-over chime, synthesised (no audio file to license or download): two soft sine notes.
let ctx: AudioContext | null = null;

/** Call from a user gesture (e.g. ticking a set) so iOS lets audio play later. */
export function unlockAudio() {
  if (typeof window === "undefined") return;
  ctx ??= new AudioContext();
  if (ctx.state === "suspended") void ctx.resume();
}

export function chime() {
  if (!ctx) return;
  const t = ctx.currentTime;
  [659.25, 880].forEach((freq, i) => {
    const osc = ctx!.createOscillator();
    const gain = ctx!.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    const start = t + i * 0.18;
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(0.22, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.6);
    osc.connect(gain).connect(ctx!.destination);
    osc.start(start);
    osc.stop(start + 0.65);
  });
  navigator.vibrate?.([180, 90, 180]);
}
