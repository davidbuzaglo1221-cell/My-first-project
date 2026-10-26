"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";
import { Target } from "lucide-react";
import { AppShell } from "@/components/app/app-shell";
import { Skeleton } from "@/components/ui/surface";
import { markLessonRead } from "@/data/coach-repo";
import { LESSONS, TOPIC_LABEL } from "@/lib/lessons";

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
        <h1 className="text-[2rem] leading-[1.15] font-bold tracking-tight">{lesson.title}</h1>
      </header>
      {/* Lesson body: longer lines read better with a little more leading. */}
      <div className="flex flex-col gap-4 text-[1.0625rem] leading-[1.75]">
        {lesson.body.map((p) => (
          <p key={p}>{p}</p>
        ))}
      </div>
      <aside className="flex gap-3 rounded-xl bg-accent p-5 text-on-accent">
        <Target aria-hidden className="mt-0.5 size-5 shrink-0" />
        <div className="flex flex-col gap-1">
          <span className="text-sm text-on-accent/70">לנסות היום</span>
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
