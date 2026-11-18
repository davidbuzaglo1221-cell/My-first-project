"use client";

import { Check, Headphones, Loader2, Pause, Play, Repeat1, SkipBack, SkipForward, SlidersHorizontal, X } from "lucide-react";
import { useState, type ReactNode } from "react";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Button, IconButton } from "@/components/ui/button";
import type { SpeechSupport } from "@/hooks/use-speech";
import { cn } from "@/lib/cn";
import { estimateSeconds, type PlayerState, type SpeechController } from "@/lib/speech/player";
import type { SpeechItem } from "@/lib/speech/segment";
import { SPEEDS, speedLabel } from "@/lib/speech/voices";

function minutesLabel(seconds: number): string {
  const m = Math.max(1, Math.round(seconds / 60));
  return m === 1 ? "כדקה האזנה" : `כ-${m} דקות האזנה`;
}

/** The start card at the top of a lesson: listen, or continue from where you stopped. */
export function ListenStart({
  items,
  support,
  saved,
  active,
  onStart,
}: {
  items: SpeechItem[];
  support: SpeechSupport;
  saved: number;
  active: boolean;
  onStart: (fromIndex: number) => void;
}) {
  if (active) return null;
  if (!support.ready) return <div aria-hidden className="h-11 w-44 animate-pulse rounded-md bg-accent-soft/60" />;
  if (support.engine === "none") {
    return <p className="text-sm text-text-muted">ההקראה לא זמינה בדפדפן הזה: אין בו קול בעברית.</p>;
  }
  const resume = saved > 0 && saved < items.length;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        variant="soft"
        icon={<Headphones aria-hidden className="size-[1.1em]" />}
        onClick={() => onStart(resume ? saved : 0)}
        aria-describedby="listen-length"
      >
        {resume ? "המשך האזנה" : "האזנה לשיעור"}
      </Button>
      {resume && (
        <Button variant="ghost" size="sm" onClick={() => onStart(0)}>
          מההתחלה
        </Button>
      )}
      <span id="listen-length" className="text-sm text-text-muted">
        {resume ? `ממשפט ${saved + 1} מתוך ${items.length}` : minutesLabel(estimateSeconds(items))}
      </span>
    </div>
  );
}

/**
 * The floating player above the tab bar. Media controls keep their left-to-right order in RTL
 * (they describe the direction of time, not of reading), so the control row is dir="ltr".
 */
export function ListenBar({
  state,
  controller,
  support,
  onClose,
  onRate,
  onVoice,
  endAction,
}: {
  endAction?: ReactNode;
  state: PlayerState;
  controller: SpeechController;
  support: SpeechSupport;
  onClose: () => void;
  onRate: (r: number) => void;
  onVoice: (id: string) => void;
}) {
  const [sheet, setSheet] = useState(false);
  const playing = state.status === "playing";
  const loading = state.status === "loading";
  const ended = state.status === "ended";
  const progress = state.total ? Math.min((state.index + (ended ? 1 : state.itemProgress)) / state.total, 1) : 0;
  const nextSpeed = SPEEDS[(SPEEDS.indexOf(state.rate as (typeof SPEEDS)[number]) + 1) % SPEEDS.length] ?? 1;
  const voices = support.ready ? support.voices : [];

  return (
    <>
      <section
        aria-label="נגן ההאזנה"
        className={cn(
          "glass-raised fixed inset-x-3 z-30 mx-auto flex max-w-[calc(var(--layout-max-width)-1.5rem)] flex-col gap-2 rounded-xl px-3 pt-3 pb-2",
          "bottom-[calc(var(--layout-tabbar-height)+1.25rem+env(safe-area-inset-bottom))]",
          "animate-[sheet-in_var(--motion-slow)_var(--ease-out)]",
        )}
      >
        <div className="flex items-center gap-3 px-1">
          <div
            role="progressbar"
            aria-label="התקדמות ההאזנה"
            aria-valuemin={0}
            aria-valuemax={state.total}
            aria-valuenow={Math.min(state.index + 1, state.total)}
            aria-valuetext={ended ? "ההאזנה הסתיימה" : `משפט ${state.index + 1} מתוך ${state.total}`}
            className="well h-1.5 flex-1 overflow-hidden rounded-pill"
          >
            {/* A block in RTL starts on the right: it fills the way the text is read. */}
            <div className="h-full rounded-pill bg-accent transition-[width] duration-300 ease-linear" style={{ width: `${progress * 100}%` }} />
          </div>
          <span className="figure min-w-16 text-end text-xs text-text-muted tabular-nums" aria-hidden>
            {ended ? "הסתיים" : `${state.index + 1} מתוך ${state.total}`}
          </span>
        </div>

        {ended && endAction}
        {state.notice && <p className="px-1 text-xs text-text-muted" role="status">{state.notice}</p>}
        {state.error && <p className="px-1 text-xs text-danger" role="alert">{state.error}</p>}

        <div dir="ltr" className="flex items-center justify-between gap-1">
          <button
            type="button"
            onClick={() => onRate(nextSpeed)}
            aria-label={`מהירות ${speedLabel(state.rate)}. לחיצה מחליפה ל-${speedLabel(nextSpeed)}`}
            className="well figure h-9 min-w-13 rounded-pill px-2 text-sm font-semibold tabular-nums"
          >
            {speedLabel(state.rate)}
          </button>
          <IconButton label="המשפט הקודם" onClick={() => controller.prev()} disabled={state.index === 0 && !playing}>
            <SkipBack aria-hidden className="size-5" />
          </IconButton>
          <IconButton label="חזרה על המשפט" onClick={() => controller.repeat()} disabled={ended}>
            <Repeat1 aria-hidden className="size-5" />
          </IconButton>
          <IconButton
            label={playing || loading ? "השהיה" : ended ? "השמעה מההתחלה" : "השמעה"}
            variant="primary"
            size="lg"
            onClick={() => controller.toggle()}
            aria-pressed={playing}
          >
            {loading ? (
              <Loader2 aria-hidden className="size-6 animate-spin" />
            ) : playing ? (
              <Pause aria-hidden className="size-6" fill="currentColor" />
            ) : (
              <Play aria-hidden className="size-6 translate-x-px" fill="currentColor" />
            )}
          </IconButton>
          <IconButton label="המשפט הבא" onClick={() => controller.next()} disabled={state.index + 1 >= state.total}>
            <SkipForward aria-hidden className="size-5" />
          </IconButton>
          <IconButton label="קול ומהירות" onClick={() => setSheet(true)}>
            <SlidersHorizontal aria-hidden className="size-5" />
          </IconButton>
          <IconButton label="סגירת הנגן" onClick={onClose}>
            <X aria-hidden className="size-5" />
          </IconButton>
        </div>
      </section>

      <BottomSheet open={sheet} onOpenChange={setSheet} title="קול ומהירות" description={state.engine === "cloud" ? "קולות HD מקוונים" : "הקולות שמותקנים במכשיר"}>
        <div className="flex flex-col gap-5 px-2 pb-2">
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-sm text-text-muted">מהירות</legend>
            <div role="radiogroup" aria-label="מהירות" className="flex flex-wrap gap-2">
              {SPEEDS.map((r) => (
                <button
                  key={r}
                  type="button"
                  role="radio"
                  dir="ltr"
                  aria-checked={state.rate === r}
                  onClick={() => onRate(r)}
                  className={cn(
                    "figure h-10 min-w-16 rounded-pill px-3 text-sm font-semibold tabular-nums transition-colors",
                    state.rate === r ? "bg-accent text-on-accent" : "well text-text",
                  )}
                >
                  {speedLabel(r)}
                </button>
              ))}
            </div>
          </fieldset>
          {voices.length > 0 && (
            <fieldset className="flex flex-col">
              <legend className="mb-2 text-sm text-text-muted">קול</legend>
              <ul role="radiogroup" aria-label="קול" className="flex flex-col">
                {voices.map((v) => {
                  const on = v.id === state.voiceId || (!state.voiceId && v === voices[0]);
                  return (
                    <li key={v.id}>
                      <button
                        type="button"
                        role="radio"
                        aria-checked={on}
                        onClick={() => onVoice(v.id)}
                        className="flex w-full items-center gap-3 rounded-md px-3 py-3 text-start enabled:hover:bg-accent-soft/40"
                      >
                        <span className={cn("flex size-6 shrink-0 items-center justify-center rounded-pill", on ? "bg-accent text-on-accent" : "well")}>
                          {on && <Check aria-hidden className="size-3.5" strokeWidth={3} />}
                        </span>
                        <span className="flex flex-col">
                          <span className="font-medium">{v.label}</span>
                          {v.hint && <span className="text-sm text-text-subtle">{v.hint}</span>}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </fieldset>
          )}
          <p className="px-1 text-xs text-text-subtle">הקול החדש מתחיל מהמשפט הנוכחי. המהירות משתנה מיד.</p>
        </div>
      </BottomSheet>
    </>
  );
}
