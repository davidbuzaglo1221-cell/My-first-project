/**
 * <SfxTrack /> — plays a cue sheet from the sound library inside any Remotion composition.
 *
 * 1. Plan or write cues:   ./sound-library/sfx auto clip.mp4 out.mp4 --preset viral   (writes out.cues.json)
 *    or hand-write a cue sheet (see sound-library/README.md).
 * 2. Copy them in:         ./sound-library/sfx remotion out.cues.json reels/my-reel
 *    -> reels/my-reel/public/sfx/*.  and  reels/my-reel/src/sfx-cues.json
 * 3. Use it:
 *      import cues from './sfx-cues.json';
 *      import {SfxTrack} from '../../../sound-library/remotion/SfxTrack';   // or copy this file next to it
 *      <SfxTrack cues={cues} />                // all layers
 *      <SfxTrack cues={cues} master={-2} duck={{from: 30, to: 90, db: -6}} />
 *
 * Remotion can't EQ or compress; for a finished mix with EQ, ducking and loudness use `sfx mix` and play the one
 * mixed file with <Audio src={staticFile('mix.wav')} />. SfxTrack is for building and timing in the Studio.
 */
import React from 'react';
import {Audio, interpolate, Sequence, staticFile} from 'remotion';

export type SfxCue = {
  src: string;               // path under public/, e.g. "sfx/sk-whoosh-fast-hard.wav"
  from: number;              // start frame (already moved so the sound's sync point lands on the moment)
  durationInFrames: number;
  volumeDb?: number;
  fadeIn?: number;           // seconds
  fadeOut?: number;          // seconds
  playbackRate?: number;
  layer?: string;
  id?: string;
  license?: string;
  credit?: string | null;
};

export type SfxCueSheet = {fps: number; cues: SfxCue[]};

const dbToGain = (db: number) => Math.pow(10, db / 20);

export const SfxTrack: React.FC<{
  cues: SfxCueSheet;
  master?: number;                                   // dB on everything
  layers?: string[];                                 // only these layers
  layerGain?: Record<string, number>;                // dB per layer
  duck?: {from: number; to: number; db: number};     // dip all SFX in a frame range (e.g. under a line of voice)
}> = ({cues, master = 0, layers, layerGain = {}, duck}) => {
  const fps = cues.fps;
  return (
    <>
      {cues.cues
        .filter((c) => !layers || layers.includes(c.layer ?? 'fx'))
        .map((c, i) => {
          const base = (c.volumeDb ?? 0) + master + (layerGain[c.layer ?? 'fx'] ?? 0);
          const fi = Math.max(0, (c.fadeIn ?? 0) * fps);
          const fo = Math.max(0, (c.fadeOut ?? 0) * fps);
          const len = c.durationInFrames;
          return (
            <Sequence key={`${c.id ?? c.src}-${i}`} from={c.from} durationInFrames={len} layout="none">
              <Audio
                src={staticFile(c.src)}
                playbackRate={c.playbackRate ?? 1}
                volume={(f) => {
                  let g = dbToGain(base);
                  if (fi > 0) g *= interpolate(f, [0, fi], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
                  if (fo > 0) g *= interpolate(f, [len - fo, len], [1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
                  if (duck) {
                    const abs = c.from + f;
                    if (abs >= duck.from && abs <= duck.to) g *= dbToGain(duck.db);
                  }
                  return Math.min(1, g);
                }}
              />
            </Sequence>
          );
        })}
    </>
  );
};

/** Snap a frame to the nearest beat of a track at `bpm` (offset = first beat in seconds). */
export const snapToBeat = (frame: number, fps: number, bpm: number, offset = 0, division: 1 | 2 | 4 = 1) => {
  const step = (60 / bpm / division) * fps;
  const o = offset * fps;
  return Math.round((frame - o) / step) * step + o;
};
