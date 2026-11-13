"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";
import { Target } from "lucide-react";
import { AppShell } from "@/components/app/app-shell";
import { Skeleton } from "@/components/ui/surface";
import { markLessonRead } from "@/data/coach-repo";
import { LESSONS, TOPIC_LABEL } from "@/lib/lessons";
import { audioPath, LessonPlayer } from "@/components/journey/lesson-player";
import { RECORDED } from "@/lib/journey/lesson-audio";

function Lesson() {
  const id = useSearchParams().get("id") ?? "";
  const i = LESSONS.findIndex((l) => l.id === id);
  const lesson = LESSONS[i];
  useEffect(() => {
    if (lesson) void markLessonRead(lesson.id);
  }, [lesson]);

  if (!lesson) return <p className="text-text-muted">השיעור לא נמצא.</p>;
  const next = LESSONS[i + 1];
  return (
    <article className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <span className="text-sm text-text-muted">
          {TOPIC_LABEL[lesson.topic]}, דקה קריאה
        </span>
        <h1 className="display text-[2.1rem] leading-[1.1]">{lesson.title}</h1>
        <span aria-hidden className="titlebar" />
      </header>
      <LessonPlayer paragraphs={[lesson.title, ...lesson.body, `לנסות היום. ${lesson.tryToday}`]} src={RECORDED.has(`learn-${lesson.id}`) ? audioPath(`learn-${lesson.id}`) : null} />
      {/* Lesson body: longer lines read better with a little more leading. */}
      <div className="flex flex-col gap-4 text-[1.0625rem] leading-[1.75]">
        {lesson.body.map((p) => (
          <p key={p}>{p}</p>
        ))}
      </div>
      <aside className="card-hero flex gap-3 rounded-xl p-5">
        <Target aria-hidden className="mt-0.5 size-5 shrink-0 text-accent-ink" />
        <div className="flex flex-col gap-1">
          <span className="eyebrow">לנסות היום</span>
          <span className="font-semibold leading-relaxed">{lesson.tryToday}</span>
        </div>
      </aside>
      {next && (
        <Link href={`/learn/read?id=${next.id}`} className="glass flex flex-col gap-1 rounded-lg p-4">
          <span className="text-sm text-text-muted">השיעור הבא</span>
          <span className="font-semibold">{next.title}</span>
        </Link>
      )}
    </article>
  );
}

export default function LessonPage() {
  return (
    <AppShell tab="progress" back={{ href: "/learn", label: "כל השיעורים" }}>
      <Suspense fallback={<Skeleton className="h-96 rounded-xl" />}>
        <Lesson />
      </Suspense>
    </AppShell>
  );
}
