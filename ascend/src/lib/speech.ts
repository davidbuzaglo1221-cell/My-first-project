// Read-aloud for lessons, using the browser's built-in speech. Works offline on iPhone Safari when a Hebrew voice is installed.

export function speechSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window && "SpeechSynthesisUtterance" in window;
}

export function hebrewVoiceAvailable(): boolean {
  if (!speechSupported()) return false;
  return window.speechSynthesis.getVoices().some((v) => v.lang.toLowerCase().startsWith("he"));
}

/** Splits a lesson into short pieces so playback can be paused, skipped, or resumed. */
export function splitForSpeech(parts: string[]): string[] {
  return parts
    .flatMap((p) => p.split(/(?<=[.!?])\s+/))
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .slice(0, 200);
}

export class LessonPlayer {
  private queue: string[] = [];
  private index = 0;
  private playing = false;
  private paused = false;
  onChange: (state: { index: number; total: number; playing: boolean; paused: boolean }) => void = () => {};

  load(parts: string[]) {
    this.stop();
    this.queue = splitForSpeech(parts);
    this.index = 0;
    this.emit();
  }

  get total() {
    return this.queue.length;
  }

  private emit() {
    this.onChange({ index: this.index, total: this.queue.length, playing: this.playing, paused: this.paused });
  }

  private speakCurrent() {
    if (!speechSupported()) return;
    if (this.index >= this.queue.length) {
      this.playing = false;
      this.emit();
      return;
    }
    const u = new SpeechSynthesisUtterance(this.queue[this.index]);
    u.lang = "he-IL";
    u.rate = 0.95;
    const voice = window.speechSynthesis.getVoices().find((v) => v.lang.toLowerCase().startsWith("he"));
    if (voice) u.voice = voice;
    u.onend = () => {
      if (!this.playing || this.paused) return;
      this.index++;
      this.speakCurrent();
      this.emit();
    };
    u.onerror = () => {
      this.playing = false;
      this.emit();
    };
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  }

  play() {
    if (!speechSupported() || this.queue.length === 0) return;
    this.playing = true;
    this.paused = false;
    this.speakCurrent();
    this.emit();
  }

  pause() {
    if (!speechSupported()) return;
    this.paused = true;
    window.speechSynthesis.cancel();
    this.emit();
  }

  resume() {
    if (!this.playing) return this.play();
    this.paused = false;
    this.speakCurrent();
    this.emit();
  }

  next() {
    this.index = Math.min(this.index + 1, this.queue.length);
    if (this.playing && !this.paused) this.speakCurrent();
    this.emit();
  }

  prev() {
    this.index = Math.max(this.index - 1, 0);
    if (this.playing && !this.paused) this.speakCurrent();
    this.emit();
  }

  stop() {
    this.playing = false;
    this.paused = false;
    if (speechSupported()) window.speechSynthesis.cancel();
    this.emit();
  }
}
