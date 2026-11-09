"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Minus, Pause, Play, Plus, RotateCcw, Swords } from "lucide-react";
import { AppShell } from "@/components/app/app-shell";
import { Button } from "@/components/ui/button";
import { Panel, Skeleton } from "@/components/ui/surface";
import { TextArea } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { CompletionSeal } from "@/components/journey/completion";
import { DifficultyBars, DomainMark, GoldRing } from "@/components/journey/parts";
import { completeMission, getMission, reopenMission, setProgress, skipMission } from "@/data/journey-repo";
import { useWakeLock } from "@/hooks/use-wake-lock";
import { useNow } from "@/hooks/use-now";
import { chime, unlockAudio } from "@/lib/chime";
import { formatDuration } from "@/lib/format";
import { localDateKey } from "@/lib/nutrition";

/**
 * One mission: what, why, how, and the work itself. A timer counts down the minutes, a counter
 * takes taps, and finishing asks the mission's question: done means saying what happened.
 */
function MissionPageInner() {
  const router = useRouter();
  const id = useSearchParams().get("id") ?? "";
  const toast = useToast();
  const m = useLiveQuery(async () => (id ? await getMission(id) : null), [id]);
  // null until typed: the saved reflection shows for a closed mission.
  const [typed, setReflection] = useState<string | null>(null);
  const reflection = typed ?? (m && m.status !== "open" ? (m.reflection ?? "") : "");
  const [sealed, setSealed] = useState(false);
  const [skipping, setSkipping] = useState(false);
  const [saving, setSaving] = useState(false);

  // Timer: while running it counts to `endAt`; paused, it holds the seconds that were left.
  // The minutes done are saved as they pass, so leaving the screen keeps them.
  const [endAt, setEndAt] = useState<number | null>(null);
  const [paused, setPaused] = useState<number | null>(null);
  const now = useNow(250);
  const full = m?.kind === "timer" ? m.target * 60 : 0;
  const fromSaved = m?.kind === "timer" ? Math.max(0, full - m.progress * 60) : null;
  const left = m?.kind !== "timer" ? null : endAt != null && now != null ? Math.max(0, Math.ceil((endAt - now) / 1000)) : (paused ?? fromSaved);
  const running = endAt != null && (left ?? 0) > 0;
  const rang = useRef(false);
  useWakeLock(running);

  useEffect(() => {
    if (!m || m.kind !== "timer" || left == null) return;
    const doneMin = Math.floor((full - left) / 60);
    if (doneMin > m.progress) void setProgress(m.id, doneMin);
    if (left === 0 && endAt != null && !rang.current) {
      rang.current = true;
      if (m.progress < m.target) void setProgress(m.id, m.target);
      chime();
      toast({ tone: "success", message: "הזמן נגמר. עכשיו תכתוב מה עשית." });
    }
  }, [left, m, endAt, full, toast]);

  const finish = useCallback(() => {
    setSealed(false);
    router.push("/");
  }, [router]);

  if (m === undefined) {
    return (
      <AppShell back={{ href: "/", label: "היום" }} bottomSpace={false}>
        <Skeleton className="h-96 rounded-xl" />
      </AppShell>
    );
  }
  if (!m) {
    return (
      <AppShell back={{ href: "/", label: "היום" }} title="המשימה לא נמצאה" bottomSpace={false}>
        <Button onClick={() => router.push("/")}>חזרה להיום</Button>
      </AppShell>
    );
  }

  const isToday = m.date === localDateKey();
  const ready = m.kind === "check" || m.progress >= m.target || (m.kind === "timer" && left === 0);
  const canFinish = reflection.trim().length >= 3;

  const complete = async () => {
    unlockAudio();
    setSaving(true);
    await completeMission(m.id, reflection);
    setSaving(false);
    setSealed(true);
  };

  return (
    <AppShell back={{ href: "/", label: "היום" }} bottomSpace={false}>
      {sealed && <CompletionSeal xp={m.xp} title={m.title} boss={m.boss} onDone={finish} />}

      <header className="rise flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <DomainMark domain={m.domain} />
          <DifficultyBars value={m.difficulty} />
          {m.boss && (
            <span className="inline-flex items-center gap-1 rounded-pill bg-blood px-2 py-0.5 text-[0.6875rem] font-semibold text-on-blood">
              <Swords aria-hidden className="size-3" />
              מבחן דרגה
            </span>
          )}
          <span className="figure ms-auto text-sm text-accent-ink"><bdi dir="ltr">+{m.xp}</bdi></span>
        </div>
        <h1 className="display text-[2.4rem] leading-[1.05]">{m.title}</h1>
        <p className="text-lg leading-relaxed text-text">{m.objective}</p>
      </header>

      <Panel className="flex flex-col gap-2">
        <span className="eyebrow">למה</span>
        <p className="text-[0.95rem] leading-relaxed text-text-muted">{m.why}</p>
      </Panel>

      <section aria-label="איך" className="flex flex-col gap-3">
        <h2 className="eyebrow">איך</h2>
        <ol className="flex flex-col gap-2">
          {m.steps.map((s, i) => (
            <li key={i} className="glass rise flex items-start gap-3 rounded-md px-4 py-3" style={{ ["--i" as string]: i }}>
              <span className="figure mt-0.5 w-5 shrink-0 text-sm text-accent-ink">{i + 1}</span>
              <span className="text-[0.95rem] leading-relaxed">{s}</span>
            </li>
          ))}
        </ol>
      </section>

      {m.status === "open" && m.kind === "timer" && left != null && (
        <section aria-label="טיימר" className="card-hero flex flex-col items-center gap-5 rounded-xl p-6">
          <GoldRing value={1 - left / (m.target * 60)} size={200} stroke={7} label={`נשארו ${Math.ceil(left / 60)} דקות`}>
            <span className="figure text-[3rem] leading-none">
              <bdi dir="ltr">{formatDuration(left)}</bdi>
            </span>
            <span className="mt-2 text-xs text-text-subtle">מתוך {m.target} דקות</span>
          </GoldRing>
          <div className="flex w-full gap-3">
            <Button
              size="lg"
              fullWidth
              disabled={!isToday || left === 0}
              icon={running ? <Pause aria-hidden className="size-5" /> : <Play aria-hidden className="size-5" />}
              onClick={() => {
                unlockAudio();
                if (running) {
                  setPaused(left);
                  setEndAt(null);
                } else {
                  rang.current = false;
                  setEndAt(Date.now() + (left ?? full) * 1000);
                }
              }}
            >
              {running ? "עצירה" : left === 0 ? "הזמן נגמר" : left < full ? "המשך" : "התחלה"}
            </Button>
            <Button
              size="lg"
              variant="secondary"
              aria-label="איפוס הטיימר"
              icon={<RotateCcw aria-hidden className="size-5" />}
              onClick={() => {
                setEndAt(null);
                setPaused(full);
                rang.current = false;
                void setProgress(m.id, 0);
              }}
            >
              איפוס
            </Button>
          </div>
        </section>
      )}

      {m.status === "open" && m.kind === "count" && (
        <section aria-label="ספירה" className="card-hero flex flex-col items-center gap-5 rounded-xl p-6">
          <GoldRing value={m.progress / m.target} size={180} stroke={7} label={`${m.progress} מתוך ${m.target}`}>
            <span className="figure text-[3rem] leading-none">{m.progress.toLocaleString("he-IL")}</span>
            <span className="mt-2 text-xs text-text-subtle">מתוך {m.target.toLocaleString("he-IL")}</span>
          </GoldRing>
          <div className="flex w-full items-center gap-3">
            <Button size="lg" variant="secondary" aria-label="אחד פחות" disabled={m.progress <= 0} onClick={() => void setProgress(m.id, m.progress - (m.target >= 1000 ? 1000 : 1))}>
              <Minus aria-hidden className="size-5" />
            </Button>
            <Button
              size="lg"
              fullWidth
              disabled={!isToday}
              icon={<Plus aria-hidden className="size-5" />}
              onClick={() => {
                navigator.vibrate?.(10);
                void setProgress(m.id, m.progress + (m.target >= 1000 ? 1000 : 1));
              }}
            >
              {m.target >= 1000 ? "+1,000" : "עוד אחד"}
            </Button>
          </div>
        </section>
      )}

      {m.status === "open" ? (
        <section aria-label="סיום" className="flex flex-col gap-4">
          <TextArea label={m.prompt} rows={3} value={reflection} onChange={(e) => setReflection(e.target.value)} placeholder="בכנות. גם 'לא הצלחתי, כי...' זו תשובה." />
          {!isToday && <p className="text-sm text-text-subtle">המשימה הזאת הייתה של יום אחר. אפשר עדיין לסגור אותה.</p>}
          <Button size="lg" fullWidth loading={saving} disabled={!canFinish || !ready} onClick={() => void complete()}>
            {!ready ? (m.kind === "timer" ? "קודם הטיימר" : `עוד ${(m.target - m.progress).toLocaleString("he-IL")}`) : !canFinish ? "כתוב מה קרה כדי לסיים" : "ביצעתי"}
          </Button>
          {skipping ? (
            <Panel className="flex flex-col gap-3">
              <TextArea label="למה אתה מדלג? (המאמן יראה את זה)" rows={2} value={reflection} onChange={(e) => setReflection(e.target.value)} />
              <div className="flex gap-2">
                <Button
                  variant="danger"
                  disabled={reflection.trim().length < 3}
                  onClick={() => {
                    void skipMission(m.id, reflection).then(() => router.push("/"));
                  }}
                >
                  דילוג
                </Button>
                <Button variant="ghost" onClick={() => setSkipping(false)}>
                  ביטול
                </Button>
              </div>
            </Panel>
          ) : (
            <button type="button" onClick={() => setSkipping(true)} className="self-center text-sm text-text-subtle underline-offset-4 hover:text-text-muted hover:underline">
              לא היום
            </button>
          )}
        </section>
      ) : (
        <Panel className="flex flex-col gap-3">
          <span className="eyebrow">{m.status === "done" ? "בוצע" : "דילגת"}</span>
          {m.reflection && <p className="leading-relaxed">{m.reflection}</p>}
          <Button variant="secondary" onClick={() => void reopenMission(m.id)}>
            לפתוח מחדש
          </Button>
        </Panel>
      )}
    </AppShell>
  );
}

export default function MissionPage() {
  return (
    <Suspense fallback={null}>
      <MissionPageInner />
    </Suspense>
  );
}
