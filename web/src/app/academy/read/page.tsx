"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Check, ChevronLeft, Target } from "lucide-react";
import { AppShell } from "@/components/app/app-shell";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/surface";
import { useToast } from "@/components/ui/toast";
import { DomainMark } from "@/components/journey/parts";
import { audioPath, LessonPlayer } from "@/components/journey/lesson-player";
import { markLessonRead, readLessonIds } from "@/data/coach-repo";
import { ACADEMY, ACADEMY_BY_ID, LEVEL_NAME, minutesOf } from "@/lib/journey/academy";
import { RECORDED } from "@/lib/journey/lesson-audio";
import { cn } from "@/lib/cn";

const key = (id: string) => `academy:${id}`;

/**
 * One lesson: the hook, three parts, what to keep, and today's task. The player reads it aloud
 * (a studio recording when there is one); the paragraph being read is lit.
 */
function Lesson() {
  const id = useSearchParams().get("id") ?? "";
  const toast = useToast();
  const lesson = ACADEMY_BY_ID.get(id);
  const [current, setCurrent] = useState(-1);
  const isRead = useLiveQuery(async () => (await readLessonIds()).has(key(id)), [id]);

  // The text in reading order; the player speaks the same paragraphs the page shows.
  const paragraphs = useMemo(() => {
    if (!lesson) return [];
    return [lesson.title, lesson.hook, ...lesson.parts.flatMap((p) => [p.h, p.p]), `שלושה דברים לזכור. ${lesson.keep.join(". ")}.`, `המשימה להיום. ${lesson.practice}`];
  }, [lesson]);

  const finish = useCallback(() => {
    if (!lesson) return;
    void markLessonRead(key(lesson.id));
  }, [lesson]);

  if (!lesson) return <p className="text-text-muted">השיעור לא נמצא.</p>;
  const i = ACADEMY.indexOf(lesson);
  const next = ACADEMY[i + 1];
  const lit = (n: number) => current === n && "rounded-md bg-accent-soft/60 shadow-[inset_-3px_0_0_var(--c-accent)] -mx-3 px-3 py-1 transition-colors";

  return (
    <article className="flex flex-col gap-7">
      <header className="rise flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <DomainMark domain={lesson.domain} />
          <span className="text-xs text-text-subtle">
            שיעור {lesson.n} · {LEVEL_NAME[lesson.n]} · {minutesOf(lesson)} דק׳
          </span>
        </div>
        <h1 className={cn("display text-[2.3rem] leading-[1.08]", lit(0))}>{lesson.title}</h1>
        <span aria-hidden className="titlebar" />
        <p className={cn("text-[1.15rem] leading-[1.7] text-text", lit(1))}>{lesson.hook}</p>
      </header>

      <LessonPlayer paragraphs={paragraphs} src={RECORDED.has(lesson.id) ? audioPath(lesson.id) : null} onParagraph={setCurrent} onEnd={finish} />

      {lesson.parts.map((p, n) => (
        <section key={p.h} className="flex flex-col gap-2.5">
          <h2 className={cn("flex items-baseline gap-3 text-xl font-semibold", lit(2 + n * 2))}>
            <span className="figure text-sm text-accent-ink">0{n + 1}</span>
            {p.h}
          </h2>
          <span aria-hidden className="underbar" />
          <p className={cn("text-[1.0625rem] leading-[1.8] text-text-muted", lit(3 + n * 2))}>{p.p}</p>
        </section>
      ))}

      <section className={cn("glass flex flex-col gap-3 rounded-xl p-5", current === paragraphs.length - 2 && "border-accent/60")} aria-label="שלושה דברים לזכור">
        <span className="eyebrow">שלושה דברים לזכור</span>
        <ul className="flex flex-col gap-2.5">
          {lesson.keep.map((k) => (
            <li key={k} className="flex items-start gap-3">
              <span className="mt-1 flex size-5 shrink-0 items-center justify-center rounded-pill bg-accent text-on-accent">
                <Check aria-hidden className="size-3.5" strokeWidth={3} />
              </span>
              <span className="leading-relaxed">{k}</span>
            </li>
          ))}
        </ul>
      </section>

      <aside className={cn("card-hero flex gap-4 rounded-xl p-5", current === paragraphs.length - 1 && "border-accent")}>
        <Target aria-hidden className="mt-0.5 size-6 shrink-0 text-accent-ink" />
        <div className="flex flex-col gap-1">
          <span className="eyebrow">המשימה להיום</span>
          <span className="text-[1.05rem] leading-relaxed font-semibold">{lesson.practice}</span>
        </div>
      </aside>

      {isRead ? (
        <p className="flex items-center justify-center gap-2 text-sm text-accent-ink">
          <Check aria-hidden className="size-4" /> השיעור הזה מאחוריך
        </p>
      ) : (
        <Button
          size="lg"
          fullWidth
          onClick={() => {
            finish();
            toast({ tone: "success", message: "השיעור נשמר כנלמד" });
          }}
        >
          סיימתי את השיעור
        </Button>
      )}

      {next && (
        <Link href={`/academy/read?id=${next.id}`} className="glass flex items-center gap-4 rounded-lg p-4">
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="text-xs text-text-subtle">השיעור הבא</span>
            <span className="font-semibold">{next.title}</span>
          </span>
          <ChevronLeft aria-hidden className="size-5 text-text-subtle" />
        </Link>
      )}
    </article>
  );
}

export default function AcademyLessonPage() {
  return (
    <AppShell tab="journey" back={{ href: "/academy", label: "האקדמיה" }} bottomSpace={false}>
      <Suspense fallback={<Skeleton className="h-96 rounded-xl" />}>
        <Lesson />
      </Suspense>
    </AppShell>
  );
}
