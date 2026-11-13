"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Headphones, Pause, Play, RotateCcw } from "lucide-react";
import { IS_ARTIFACT } from "@/lib/runtime";
import { cn } from "@/lib/cn";

// Listening to a lesson. A recorded narration (an MP3 made with a studio voice, see
// scripts/lesson-audio.mts) plays when the lesson has one; otherwise the device reads the text
// with its best Hebrew voice, one paragraph at a time, so the page can follow along.

const SPEEDS = [0.9, 1, 1.15, 1.3] as const;

/** Where a recorded lesson is served: next to the page in the chat build, from /audio on a server. */
export const audioPath = (id: string) => `${IS_ARTIFACT ? "" : "/"}audio/lessons/${id}.mp3`;

/** The device voices, best Hebrew first: the enhanced and natural ones before the default. */
function hebrewVoices(): SpeechSynthesisVoice[] {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return [];
  const all = window.speechSynthesis.getVoices().filter((v) => /^(he|iw)/i.test(v.lang));
  const score = (v: SpeechSynthesisVoice) =>
    (/(natural|neural|premium|enhanced|online)/i.test(v.name) ? 4 : 0) + (/google|microsoft/i.test(v.name) ? 2 : 0) + (v.localService ? 0 : 1);
  return all.sort((a, b) => score(b) - score(a));
}

type Props = {
  /** The text, paragraph by paragraph; used when there is no recording and to follow along. */
  paragraphs: string[];
  /** A recording to play instead, when the lesson has one. */
  src?: string | null;
  /** Which paragraph is being read (device voice only), or -1. */
  onParagraph?: (i: number) => void;
  /** Called once when the listener reaches the end. */
  onEnd?: () => void;
};

export function LessonPlayer({ paragraphs, src, onParagraph, onEnd }: Props) {
  const [mode, setMode] = useState<"audio" | "voice" | "none" | null>(null);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>(1);
  const [progress, setProgress] = useState(0);
  const [time, setTime] = useState<{ cur: number; dur: number } | null>(null);
  const [voiceName, setVoiceName] = useState<string | null>(null);
  const audio = useRef<HTMLAudioElement | null>(null);
  const index = useRef(0);
  const live = useRef(false);
  const [at, setAt] = useState(0);
  const speakRef = useRef<(i: number) => void>(() => {});

  // Decide once: a recording if it loads, otherwise the device voice, otherwise nothing.
  useEffect(() => {
    let cancelled = false;
    const voice = () => {
      const v = hebrewVoices()[0];
      if (cancelled) return;
      setVoiceName(v?.name ?? null);
      setMode(v ? "voice" : "none");
    };
    if (src) {
      const a = new Audio();
      a.preload = "metadata";
      a.src = src;
      a.onloadedmetadata = () => {
        if (cancelled) return;
        audio.current = a;
        setTime({ cur: 0, dur: a.duration });
        setMode("audio");
      };
      a.onerror = () => voice();
    } else if (typeof window !== "undefined" && "speechSynthesis" in window) {
      // Voices load asynchronously on some browsers.
      if (window.speechSynthesis.getVoices().length) setTimeout(voice, 0);
      else {
        window.speechSynthesis.onvoiceschanged = voice;
        setTimeout(voice, 1500);
      }
    } else setTimeout(() => !cancelled && setMode("none"), 0);
    return () => {
      cancelled = true;
      live.current = false;
      audio.current?.pause();
      if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
    };
  }, [src]);

  // Recording: keep the clock and the end in step.
  useEffect(() => {
    const a = audio.current;
    if (mode !== "audio" || !a) return;
    a.playbackRate = speed;
    const tick = () => {
      setTime({ cur: a.currentTime, dur: a.duration });
      setProgress(a.duration ? a.currentTime / a.duration : 0);
    };
    const end = () => {
      setPlaying(false);
      onEnd?.();
    };
    a.addEventListener("timeupdate", tick);
    a.addEventListener("ended", end);
    return () => {
      a.removeEventListener("timeupdate", tick);
      a.removeEventListener("ended", end);
    };
  }, [mode, speed, onEnd]);

  const speakFrom = useCallback(
    (i: number) => {
      const synth = window.speechSynthesis;
      synth.cancel();
      if (i >= paragraphs.length) {
        live.current = false;
        setPlaying(false);
        setProgress(1);
        onParagraph?.(-1);
        index.current = 0;
        setAt(0);
        onEnd?.();
        return;
      }
      index.current = i;
      setAt(i);
      onParagraph?.(i);
      setProgress(i / paragraphs.length);
      const u = new SpeechSynthesisUtterance(paragraphs[i]);
      const v = hebrewVoices()[0];
      if (v) u.voice = v;
      u.lang = v?.lang ?? "he-IL";
      u.rate = speed;
      u.onend = () => {
        if (live.current) speakRef.current(i + 1);
      };
      synth.speak(u);
    },
    [paragraphs, speed, onParagraph, onEnd],
  );
  useEffect(() => {
    speakRef.current = speakFrom;
  }, [speakFrom]);

  const toggle = () => {
    if (mode === "audio" && audio.current) {
      if (playing) audio.current.pause();
      else void audio.current.play();
      setPlaying(!playing);
      return;
    }
    if (mode !== "voice") return;
    if (playing) {
      live.current = false;
      window.speechSynthesis.cancel();
      setPlaying(false);
    } else {
      live.current = true;
      setPlaying(true);
      speakFrom(index.current);
    }
  };

  const restart = () => {
    if (mode === "audio" && audio.current) {
      audio.current.currentTime = 0;
      return;
    }
    index.current = 0;
    setAt(0);
    setProgress(0);
    if (playing) speakFrom(0);
  };

  const changeSpeed = () => {
    const next = SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length];
    setSpeed(next);
    if (mode === "voice" && playing) {
      // The device voice takes the new rate from the next paragraph; restart the current one with it.
      setTimeout(() => speakFrom(index.current), 0);
    }
  };

  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    // RTL: the start of the track is on the right.
    const f = Math.min(1, Math.max(0, (r.right - e.clientX) / r.width));
    if (mode === "audio" && audio.current?.duration) audio.current.currentTime = f * audio.current.duration;
    else if (mode === "voice") {
      const i = Math.min(paragraphs.length - 1, Math.floor(f * paragraphs.length));
      index.current = i;
      setAt(i);
      setProgress(i / paragraphs.length);
      if (playing) speakFrom(i);
    }
  };

  const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

  if (mode === "none") {
    return (
      <div className="well flex items-center gap-3 rounded-lg px-4 py-3 text-sm text-text-muted">
        <Headphones aria-hidden className="size-4 shrink-0" />
        במכשיר הזה אין קול עברי להקראה. אפשר להוסיף קול עברי בהגדרות הנגישות של הטלפון.
      </div>
    );
  }

  return (
    <section aria-label="האזנה לשיעור" className="card-hero flex flex-col gap-4 rounded-xl p-5">
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={toggle}
          disabled={mode == null}
          aria-label={playing ? "עצירה" : "האזנה לשיעור"}
          className="flex size-16 shrink-0 items-center justify-center rounded-pill bg-accent text-on-accent shadow-[0_10px_30px_-12px_var(--c-accent)] transition-transform duration-(--motion-fast) active:scale-95 disabled:opacity-50"
        >
          {playing ? <Pause aria-hidden className="size-7" /> : <Play aria-hidden className="size-7 -scale-x-100" />}
        </button>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="eyebrow">{mode === "audio" ? "קריינות" : "האזנה"}</span>
          <span className="truncate text-sm text-text-muted">
            {mode == null ? "טוען…" : mode === "audio" ? "הקלטה באולפן" : `קול המכשיר${voiceName ? ` · ${voiceName}` : ""}`}
          </span>
        </div>
        <button type="button" onClick={changeSpeed} aria-label={`מהירות ${speed}`} className="well figure h-9 rounded-pill px-3 text-sm">
          <bdi dir="ltr">{speed}×</bdi>
        </button>
        <button type="button" onClick={restart} aria-label="מההתחלה" className="flex size-9 items-center justify-center rounded-pill text-text-muted hover:text-text">
          <RotateCcw aria-hidden className="size-4" />
        </button>
      </div>
      <div className="flex items-center gap-3">
        <div
          role="slider"
          tabIndex={0}
          aria-label="התקדמות"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress * 100)}
          onClick={seek}
          className="well relative h-2 flex-1 cursor-pointer overflow-hidden rounded-pill"
        >
          <span className={cn("absolute inset-y-0 start-0 rounded-pill bg-linear-to-l from-accent to-accent-hover transition-[width] duration-300")} style={{ width: `${progress * 100}%` }} />
        </div>
        <span className="figure w-20 shrink-0 text-end text-xs text-text-subtle">
          <bdi dir="ltr">{mode === "audio" && time ? `${mmss(time.cur)} / ${mmss(time.dur)}` : `${Math.min(paragraphs.length, at + (playing ? 1 : 0))}/${paragraphs.length}`}</bdi>
        </span>
      </div>
    </section>
  );
}
