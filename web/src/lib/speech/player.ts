// The listening player: moves through a script sentence by sentence, with play, pause, resume,
// previous / next / repeat sentence, speed and voice. Two engines behind one controller:
//   cloud    clips from /api/tts (Chirp 3 HD or Azure), played on one <audio> element, speed on
//            the device with pitch kept, the next two sentences fetched ahead, clips cached.
//   device   the browser's speechSynthesis with its Hebrew voice (offline, and inside Claude).
// iPhone: audio is unlocked inside the first tap, the same element is reused for every sentence
// (so playback continues between sentences and with the screen locked), and the lock screen gets
// title and controls through the Media Session API.
import { getAppToken } from "@/lib/local-settings";
import type { Lang, SpeechItem } from "./segment";

export type EngineKind = "cloud" | "device";
export type Status = "idle" | "loading" | "playing" | "paused" | "ended" | "error";

export type PlayerState = {
  status: Status;
  index: number;
  total: number;
  /** 0..1 inside the current sentence (cloud only; device speech reports sentence by sentence). */
  itemProgress: number;
  rate: number;
  voiceId: string;
  engine: EngineKind;
  /** Set when the cloud failed and the player moved to the device voice. */
  notice?: string;
  error?: string;
};

export type DeviceVoice = { id: string; label: string; lang: Lang; local: boolean };

type Options = {
  items: SpeechItem[];
  engine: EngineKind;
  voiceId: string;
  rate: number;
  startIndex?: number;
  title?: string;
  /** Called when the sentence changes and when listening ends (index = total). */
  onPosition?: (index: number) => void;
  /** Whether the device voice can take over if the cloud fails. */
  deviceFallback?: boolean;
};

// 0.1 s of silence: played inside the first tap so iOS lets this element play later.
const SILENCE =
  "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQQAAACAgICA";

let sharedAudio: HTMLAudioElement | null = null;
function audioElement(): HTMLAudioElement {
  if (!sharedAudio) {
    sharedAudio = new Audio();
    sharedAudio.preload = "auto";
    sharedAudio.setAttribute("playsinline", "");
    // Keep the voice's pitch at every speed (default in modern browsers, explicit for older Safari).
    (sharedAudio as HTMLAudioElement & { webkitPreservesPitch?: boolean }).webkitPreservesPitch = true;
    sharedAudio.preservesPitch = true;
  }
  return sharedAudio;
}

let unlocked = false;
/** Must run synchronously inside a tap handler, before any await. */
export function unlockSpeech(engine: EngineKind) {
  if (typeof window === "undefined") return;
  if (engine === "cloud" && !unlocked) {
    const a = audioElement();
    // Never replace a sentence that is loaded (paused mid-way): it is already unlocked.
    if (a.src && !a.src.startsWith("data:")) {
      unlocked = true;
      return;
    }
    a.src = SILENCE;
    // Stop only the silence: if a real sentence was loaded meanwhile, it must keep playing.
    void a
      .play()
      .then(() => {
        if (a.src === SILENCE) a.pause();
      })
      .catch(() => {});
    unlocked = true;
  }
  if (engine === "device" && "speechSynthesis" in window) {
    // iOS speaks only after a first utterance started by a gesture.
    const u = new SpeechSynthesisUtterance(" ");
    u.volume = 0;
    window.speechSynthesis.speak(u);
  }
}

// ---- cloud clips --------------------------------------------------------------------------

const CACHE_NAME = "tts-clips-v1";

async function clipKey(item: SpeechItem, voiceId: string): Promise<string> {
  const data = new TextEncoder().encode(JSON.stringify([voiceId, item.role, item.parts]));
  const hash = await crypto.subtle.digest("SHA-256", data);
  const hex = [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `/__tts/${hex}.mp3`;
}

async function fetchClip(item: SpeechItem, voiceId: string, signal: AbortSignal): Promise<Blob> {
  const key = await clipKey(item, voiceId);
  let cache: Cache | null = null;
  try {
    cache = await caches.open(CACHE_NAME);
    const hit = await cache.match(key);
    if (hit) return await hit.blob();
  } catch {
    cache = null; // Cache Storage blocked (private mode): fetch every time.
  }
  const res = await fetch("/api/tts", {
    method: "POST",
    headers: { "content-type": "application/json", "x-app-token": getAppToken() },
    body: JSON.stringify({ parts: item.parts, role: item.role, voice: voiceId }),
    signal,
  });
  if (!res.ok) throw new Error(`tts ${res.status}`);
  const blob = await res.blob();
  try {
    await cache?.put(key, new Response(blob, { headers: { "content-type": blob.type || "audio/mpeg" } }));
  } catch {
    // Storage full: the clip still plays.
  }
  return blob;
}

// ---- device voices ------------------------------------------------------------------------

export function deviceVoices(): DeviceVoice[] {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return [];
  return window.speechSynthesis
    .getVoices()
    .filter((v) => /^he|^iw|^en/i.test(v.lang))
    .map((v) => ({
      id: v.voiceURI,
      label: v.name,
      lang: (/^en/i.test(v.lang) ? "en-US" : "he-IL") as Lang,
      local: v.localService,
    }));
}

/** Device voices load late in some browsers; wait for them briefly. */
export function loadDeviceVoices(timeoutMs = 1500): Promise<DeviceVoice[]> {
  return new Promise((resolve) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return resolve([]);
    const now = deviceVoices();
    if (now.length) return resolve(now);
    const done = () => {
      window.speechSynthesis.removeEventListener("voiceschanged", done);
      clearTimeout(t);
      resolve(deviceVoices());
    };
    const t = setTimeout(done, timeoutMs);
    window.speechSynthesis.addEventListener("voiceschanged", done);
  });
}

function pickDeviceVoice(lang: Lang, preferredId: string): SpeechSynthesisVoice | undefined {
  const all = window.speechSynthesis.getVoices();
  const pref = all.find((v) => v.voiceURI === preferredId);
  const matches = (v: SpeechSynthesisVoice) => (lang === "he-IL" ? /^(he|iw)/i.test(v.lang) : /^en/i.test(v.lang));
  if (pref && matches(pref)) return pref;
  const candidates = all.filter(matches);
  // Prefer enhanced / natural voices where the platform names them so.
  return (
    candidates.find((v) => /enhanced|premium|natural|neural/i.test(v.name)) ??
    candidates.find((v) => lang === "en-US" && v.lang === "en-US") ??
    candidates[0]
  );
}

// ---- controller ---------------------------------------------------------------------------

export class SpeechController {
  private items: SpeechItem[];
  private state: PlayerState;
  private listeners = new Set<() => void>();
  private gen = 0;
  private gapTimer: ReturnType<typeof setTimeout> | null = null;
  private clips = new Map<number, Promise<string>>();
  private abort = new AbortController();
  private startedAt = 0;
  private opts: Options;
  private detach: (() => void) | null = null;

  constructor(opts: Options) {
    this.opts = opts;
    this.items = opts.items;
    const start = Math.min(Math.max(opts.startIndex ?? 0, 0), Math.max(opts.items.length - 1, 0));
    this.state = { status: "idle", index: start, total: opts.items.length, itemProgress: 0, rate: opts.rate, voiceId: opts.voiceId, engine: opts.engine };
    if (opts.engine === "cloud") this.attachAudio();
  }

  // -- store ------------------------------------------------------------------------------
  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };
  getState = () => this.state;
  private set(patch: Partial<PlayerState>) {
    const prevIndex = this.state.index;
    this.state = { ...this.state, ...patch };
    if (patch.index !== undefined && patch.index !== prevIndex) this.opts.onPosition?.(patch.index);
    this.listeners.forEach((l) => l());
    this.syncMediaSession();
  }

  // -- public controls --------------------------------------------------------------------
  /** Start or resume. Call from a tap: it unlocks audio first. */
  play() {
    unlockSpeech(this.state.engine);
    const { status, index, total } = this.state;
    if (status === "playing" || status === "loading") return;
    if (status === "ended") return this.playIndex(0);
    if (status === "paused" && this.state.engine === "cloud" && this.canResumeClip()) {
      void audioElement()
        .play()
        .then(() => this.set({ status: "playing" }))
        .catch(() => this.playIndex(index));
      return;
    }
    this.playIndex(Math.min(index, total - 1));
  }

  pause() {
    if (this.state.status !== "playing" && this.state.status !== "loading") return;
    this.clearGap();
    if (this.state.engine === "cloud") audioElement().pause();
    else {
      // speechSynthesis.pause() is unreliable on iOS; stop and resume from this sentence.
      this.gen++;
      window.speechSynthesis.cancel();
    }
    this.set({ status: "paused" });
  }

  toggle() {
    if (this.state.status === "playing" || this.state.status === "loading") this.pause();
    else this.play();
  }

  /** Previous sentence; in the first 2 seconds of a sentence, restart it instead of going back. */
  prev() {
    unlockSpeech(this.state.engine);
    const elapsed = (performance.now() - this.startedAt) / 1000;
    const target = this.state.status === "playing" && elapsed > 2 ? this.state.index : this.state.index - 1;
    this.seek(Math.max(target, 0));
  }

  next() {
    unlockSpeech(this.state.engine);
    if (this.state.index + 1 >= this.state.total) return;
    this.seek(this.state.index + 1);
  }

  /** Say the current sentence again. */
  repeat() {
    unlockSpeech(this.state.engine);
    this.seek(this.state.index);
  }

  /** Jump to a sentence and play it. From a tap (start, tap on a sentence) this also unlocks audio. */
  seek(index: number) {
    if (index < 0 || index >= this.state.total) return;
    unlockSpeech(this.state.engine);
    this.playIndex(index);
  }

  setRate(rate: number) {
    this.set({ rate });
    if (this.state.engine === "cloud") audioElement().playbackRate = rate;
    // Device speech takes the rate per utterance: restart the sentence so it applies now.
    else if (this.state.status === "playing") this.playIndex(this.state.index);
  }

  setVoice(voiceId: string) {
    if (voiceId === this.state.voiceId) return;
    this.resetClips();
    this.set({ voiceId });
    if (this.state.status === "playing" || this.state.status === "loading") this.playIndex(this.state.index);
  }

  destroy() {
    this.gen++;
    this.clearGap();
    this.abort.abort();
    this.resetClips();
    this.detach?.();
    if (this.state.engine === "cloud") {
      const a = audioElement();
      a.pause();
      a.removeAttribute("src");
    } else if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
    if (typeof navigator !== "undefined" && "mediaSession" in navigator) {
      navigator.mediaSession.metadata = null;
      navigator.mediaSession.playbackState = "none";
    }
    this.listeners.clear();
  }

  // -- engine work ------------------------------------------------------------------------
  private playIndex(index: number) {
    const gen = ++this.gen;
    this.clearGap();
    this.set({ index, status: "loading", itemProgress: 0, error: undefined });
    if (this.state.engine === "cloud") void this.playCloud(index, gen);
    else this.playDevice(index, gen);
  }

  private afterItem(index: number, gen: number) {
    if (gen !== this.gen) return;
    if (index + 1 >= this.state.total) {
      this.set({ status: "ended", itemProgress: 1 });
      this.opts.onPosition?.(this.state.total);
      return;
    }
    const pause = this.items[index].pauseAfterMs / this.state.rate;
    this.gapTimer = setTimeout(() => {
      this.gapTimer = null;
      if (gen === this.gen) this.playIndex(index + 1);
    }, pause);
  }

  private clearGap() {
    if (this.gapTimer) clearTimeout(this.gapTimer);
    this.gapTimer = null;
  }

  // cloud
  private attachAudio() {
    if (typeof window === "undefined") return;
    const a = audioElement();
    const onEnded = () => {
      if (this.state.status === "playing") this.afterItem(this.state.index, this.gen);
    };
    const onTime = () => {
      if (a.duration > 0 && this.state.status === "playing") this.set({ itemProgress: Math.min(a.currentTime / a.duration, 1) });
    };
    // A pause from the lock screen or a phone call keeps the controls in step.
    const onPause = () => {
      if (this.state.status === "playing" && !a.ended && a.currentTime < a.duration - 0.05) this.set({ status: "paused" });
    };
    a.addEventListener("ended", onEnded);
    a.addEventListener("timeupdate", onTime);
    a.addEventListener("pause", onPause);
    this.detach = () => {
      a.removeEventListener("ended", onEnded);
      a.removeEventListener("timeupdate", onTime);
      a.removeEventListener("pause", onPause);
    };
  }

  private clip(index: number): Promise<string> {
    let p = this.clips.get(index);
    if (!p) {
      const voiceId = this.state.voiceId;
      p = fetchClip(this.items[index], voiceId, this.abort.signal).then((b) => URL.createObjectURL(b));
      p.catch(() => this.clips.delete(index));
      this.clips.set(index, p);
    }
    return p;
  }

  private resetClips() {
    for (const p of this.clips.values()) void p.then((u) => URL.revokeObjectURL(u)).catch(() => {});
    this.clips.clear();
  }

  private canResumeClip() {
    const a = audioElement();
    return Boolean(a.src) && !a.src.startsWith("data:") && !a.ended && a.currentTime > 0;
  }

  private async playCloud(index: number, gen: number) {
    try {
      const url = await this.clip(index);
      if (gen !== this.gen) return;
      const a = audioElement();
      a.src = url;
      a.playbackRate = this.state.rate;
      await a.play();
      if (gen !== this.gen) return;
      this.startedAt = performance.now();
      this.set({ status: "playing" });
      // Fetch ahead so the next sentence starts without a gap.
      for (const k of [index + 1, index + 2]) if (k < this.state.total) void this.clip(k).catch(() => {});
    } catch (e) {
      if (gen !== this.gen) return;
      if ((e as Error).name === "NotAllowedError") return this.set({ status: "paused" });
      if (this.opts.deviceFallback) {
        // The cloud is down or offline: carry on with the device voice from this sentence.
        this.detach?.();
        audioElement().pause();
        this.state = { ...this.state, engine: "device", voiceId: "" };
        this.set({ notice: "הקול המקוון לא זמין כרגע, ממשיכים בקול של המכשיר" });
        this.playDevice(index, gen);
      } else {
        this.set({ status: "error", error: "לא הצלחנו להשמיע את המשפט. בדקו את החיבור ונסו שוב." });
      }
    }
  }

  // device
  private playDevice(index: number, gen: number) {
    if (!("speechSynthesis" in window)) return this.set({ status: "error", error: "אין במכשיר הזה מנוע דיבור." });
    const synth = window.speechSynthesis;
    synth.cancel();
    const parts = this.items[index].parts;
    let k = 0;
    const speakNext = () => {
      if (gen !== this.gen) return;
      if (k >= parts.length) return this.afterItem(index, gen);
      const part = parts[k++];
      const u = new SpeechSynthesisUtterance(part.text);
      u.lang = part.lang;
      const v = pickDeviceVoice(part.lang, this.state.voiceId);
      if (v) u.voice = v;
      u.rate = this.state.rate;
      u.onstart = () => {
        if (gen !== this.gen) return;
        if (k === 1) this.startedAt = performance.now();
        if (this.state.status !== "playing") this.set({ status: "playing" });
      };
      u.onend = speakNext;
      u.onerror = (ev) => {
        if (gen !== this.gen || ev.error === "interrupted" || ev.error === "canceled") return;
        if (ev.error === "not-allowed") return this.set({ status: "paused" });
        this.set({ status: "error", error: "המכשיר לא הצליח להקריא את המשפט." });
      };
      synth.speak(u);
    };
    speakNext();
  }

  // lock screen
  private syncMediaSession() {
    if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return;
    const ms = navigator.mediaSession;
    if (!ms.metadata && this.opts.title && typeof MediaMetadata !== "undefined") {
      ms.metadata = new MediaMetadata({ title: this.opts.title, artist: "אימונים ותזונה", album: "שיעורים" });
      const set = (a: MediaSessionAction, h: MediaSessionActionHandler | null) => {
        try {
          ms.setActionHandler(a, h);
        } catch {
          // Action not supported on this platform.
        }
      };
      set("play", () => this.play());
      set("pause", () => this.pause());
      set("previoustrack", () => this.prev());
      set("nexttrack", () => this.next());
      set("seekbackward", () => this.repeat());
    }
    ms.playbackState = this.state.status === "playing" ? "playing" : this.state.status === "paused" ? "paused" : "none";
  }
}

/** Rough listening time at 1×: Hebrew narration runs about 14 characters a second. */
export function estimateSeconds(items: SpeechItem[], fromIndex = 0): number {
  let chars = 0;
  let pauses = 0;
  for (const it of items.slice(fromIndex)) {
    chars += it.parts.reduce((n, p) => n + p.text.length, 0);
    pauses += it.pauseAfterMs;
  }
  return chars / 14 + pauses / 1000;
}
