"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Target } from "lucide-react";
import { AppShell } from "@/components/app/app-shell";
import { ListenBar, ListenStart } from "@/components/listen/listen-player";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/surface";
import { markLessonRead } from "@/data/coach-repo";
import { useSpeechPlayer, useSpeechSupport } from "@/hooks/use-speech";
import { cn } from "@/lib/cn";
import { LESSONS, TOPIC_LABEL } from "@/lib/lessons";
import { lessonScript } from "@/lib/speech/script";
import type { SpeechItem } from "@/lib/speech/segment";

/** Sentences of one block, each tappable (to jump there) and highlighted while it is read. */
function Spoken({
  items,
  paragraph,
  current,
  listening,
  onPick,
  onDark,
}: {
  items: SpeechItem[];
  paragraph: number;
  current: number;
  listening: boolean;
  onPick: (index: number) => void;
  onDark?: boolean;
}) {
  return items.map((it, i) =>
    it.paragraph !== paragraph ? null : (
      <span key={it.id}>
        <span
          data-sentence={i}
          aria-current={listening && i === current ? "true" : undefined}
          onClick={listening ? () => onPick(i) : undefined}
          className={cn(
            "rounded-[0.3em] box-decoration-clone transition-colors duration-(--motion-base)",
            listening && "cursor-pointer",
            listening && i === current && (onDark ? "bg-on-accent/15" : "bg-accent-soft"),
          )}
        >
          {it.display}
        </span>{" "}
      </span>
    ),
  );
}

function Lesson() {
  const params = useSearchParams();
  const router = useRouter();
  const id = params.get("id") ?? "";
  const autoListen = params.get("listen") === "1";
  const i = LESSONS.findIndex((l) => l.id === id);
  const lesson = LESSONS[i];
  useEffect(() => {
    if (lesson) void markLessonRead(lesson.id);
  }, [lesson]);

  const items = useMemo(() => (lesson ? lessonScript(lesson) : []), [lesson]);
  const support = useSpeechSupport();
  const { controller, state, saved, setRate, setVoice } = useSpeechPlayer(items, lesson?.id ?? "", lesson?.title ?? "", support);
  const [open, setOpen] = useState(false);

  // Arriving from "listen to the next lesson": start without another tap when the browser allows.
  const autoStarted = useRef(false);
  useEffect(() => {
    if (!autoListen || autoStarted.current || !controller) return;
    autoStarted.current = true;
    setOpen(true);
    controller.seek(0);
  }, [autoListen, controller]);

  // Keep the sentence being read in view, without fighting the reader's own scrolling too hard.
  useEffect(() => {
    if (!open || state.status !== "playing") return;
    const el = document.querySelector(`[data-sentence="${state.index}"]`);
    if (!el) return;
    const r = el.getBoundingClientRect();
    if (r.top < 80 || r.bottom > window.innerHeight - 220) el.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [open, state.index, state.status]);

  if (!lesson) return <p className="text-text-muted">השיעור לא נמצא.</p>;
  const next = LESSONS[i + 1];

  const start = (from: number) => {
    if (!controller) return;
    setOpen(true);
    controller.seek(from);
  };
  const close = () => {
    controller?.pause();
    setOpen(false);
  };
  const spoken = (paragraph: number, onDark = false) => (
    <Spoken items={items} paragraph={paragraph} current={state.index} listening={open} onPick={(k) => controller?.seek(k)} onDark={onDark} />
  );

  return (
    <article className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <span className="text-sm text-text-muted">
          {TOPIC_LABEL[lesson.topic]}, דקה קריאה
        </span>
        <h1 className="text-[2rem] leading-[1.15] font-bold tracking-tight">{spoken(0)}</h1>
        {/* Until the player exists a tap would be lost, so the button waits for it. */}
        <ListenStart
          items={items}
          support={support.ready && support.engine !== "none" && !controller ? { ready: false } : support}
          saved={saved}
          active={open}
          onStart={start}
        />
      </header>
      {/* Lesson body: longer lines read better with a little more leading. */}
      <div className="flex flex-col gap-4 text-[1.0625rem] leading-[1.75]">
        {lesson.body.map((p, k) => (
          <p key={p}>{spoken(k + 1)}</p>
        ))}
      </div>
      <aside className={cn("flex gap-3 rounded-xl bg-accent p-5 text-on-accent", open && items[state.index]?.role === "callout" && "ring-2 ring-focus ring-offset-2 ring-offset-bg")}>
        <Target aria-hidden className="mt-0.5 size-5 shrink-0" />
        <div className="flex flex-col gap-1">
          <span className="text-sm text-on-accent/70">לנסות היום</span>
          <span className="font-semibold leading-relaxed">{spoken(lesson.body.length + 1, true)}</span>
        </div>
      </aside>
      {next && (
        <Link href={`/learn/read?id=${next.id}`} className="glass flex flex-col gap-1 rounded-lg p-4">
          <span className="text-sm text-text-muted">השיעור הבא</span>
          <span className="font-semibold">{next.title}</span>
        </Link>
      )}
      {open && controller && (
        <ListenBar
          state={state}
          controller={controller}
          support={support}
          onClose={close}
          onRate={setRate}
          onVoice={setVoice}
          endAction={
            next ? (
              <Button size="sm" variant="soft" fullWidth onClick={() => router.push(`/learn/read?id=${next.id}&listen=1`)}>
                להאזין לשיעור הבא: {next.title}
              </Button>
            ) : undefined
          }
        />
      )}
    </article>
  );
}

/** A new lesson is a new player: keyed by id so state never carries over from the last one. */
function LessonRoute() {
  const id = useSearchParams().get("id") ?? "";
  return <Lesson key={id} />;
}

export default function LessonPage() {
  return (
    <AppShell tab="progress" back={{ href: "/learn", label: "כל השיעורים" }}>
      <Suspense fallback={<Skeleton className="h-96 rounded-xl" />}>
        <LessonRoute />
      </Suspense>
    </AppShell>
  );
}
