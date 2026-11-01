"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";
import { BookMarked, ExternalLink, FlaskConical, Target } from "lucide-react";
import { AppShell } from "@/components/app/app-shell";
import { Panel, Skeleton } from "@/components/ui/surface";
import { markLessonRead } from "@/data/coach-repo";
import { EVIDENCE_LABEL, LESSONS, TOPIC_LABEL, pubmedSearchUrl } from "@/lib/lessons";

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
    <article className="flex flex-col gap-7">
      <header className="flex flex-col gap-2">
        <span className="text-sm text-text-muted">
          {TOPIC_LABEL[lesson.topic]}, כ-{lesson.minutes} דקות
        </span>
        <h1 className="text-[2rem] leading-[1.15] font-bold tracking-tight">{lesson.title}</h1>
        {lesson.evidence && (
          <span className="flex items-center gap-1.5 text-sm text-text-muted">
            <FlaskConical aria-hidden className="size-4" />
            {EVIDENCE_LABEL[lesson.evidence]}
          </span>
        )}
      </header>

      {/* Longer lines read better with a little more leading. */}
      <div className="flex flex-col gap-4 text-[1.0625rem] leading-[1.75]">
        {lesson.body.map((p) => (
          <p key={p}>{p}</p>
        ))}
      </div>

      {lesson.sections?.map((s) => (
        <section key={s.heading} aria-labelledby={`s-${s.heading}`} className="flex flex-col gap-3">
          <h2 id={`s-${s.heading}`} className="text-xl font-semibold">
            {s.heading}
          </h2>
          {s.paragraphs.map((p) => (
            <p key={p} className="leading-[1.75] text-text">
              {p}
            </p>
          ))}
        </section>
      ))}

      <aside className="flex gap-3 rounded-xl bg-accent p-5 text-on-accent">
        <Target aria-hidden className="mt-0.5 size-5 shrink-0" />
        <div className="flex flex-col gap-1">
          <span className="text-sm text-on-accent/70">לנסות היום</span>
          <span className="font-semibold leading-relaxed">{lesson.tryToday}</span>
        </div>
      </aside>

      {(lesson.sources?.length || lesson.verify) && (
        <Panel className="flex flex-col gap-4 p-5">
          <h2 className="flex items-center gap-2 text-base font-semibold">
            <BookMarked aria-hidden className="size-4" />
            מקורות ובדיקה עצמאית
          </h2>
          {lesson.sources?.length ? (
            <ul className="flex flex-col gap-3 text-sm leading-relaxed">
              {lesson.sources.map((s) => (
                <li key={s.text}>
                  {s.url ? (
                    <a href={s.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-start gap-1.5 text-accent underline-offset-4 hover:underline">
                      <span>{s.text}</span>
                      <ExternalLink aria-hidden className="mt-1 size-3.5 shrink-0" />
                    </a>
                  ) : (
                    <span>{s.text}</span>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-text-muted">לא צוטטו מאמרים ספציפיים בשיעור הזה. אפשר לבדוק את הטענה בחיפוש למטה.</p>
          )}
          {lesson.verify && (
            <a
              href={pubmedSearchUrl(lesson.verify)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex w-fit items-center gap-1.5 rounded-md bg-accent-soft px-3.5 py-2 text-sm font-medium text-accent-ink"
            >
              חיפוש ב-PubMed
              <ExternalLink aria-hidden className="size-3.5" />
            </a>
          )}
        </Panel>
      )}

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
