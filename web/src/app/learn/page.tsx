"use client";

import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { useState } from "react";
import { Check, ChevronLeft, Sparkles } from "lucide-react";
import { AppShell } from "@/components/app/app-shell";
import { Skeleton } from "@/components/ui/surface";
import { readLessonIds } from "@/data/coach-repo";
import { LESSONS, TOPIC_LABEL, lessonOfTheDay, type Topic } from "@/lib/lessons";

const TOPICS = Object.keys(TOPIC_LABEL) as Topic[];

/** S29: the lessons, by topic. Most take a few minutes; the card at the top is the next one unread. */
export default function LearnPage() {
  const read = useLiveQuery(() => readLessonIds(), []);
  // Read the clock once, when the page opens: the rotation only matters once every lesson is read.
  const [day] = useState(() => Math.floor(Date.now() / 86_400_000));
  const next = read ? lessonOfTheDay(read, day) : null;
  return (
    <AppShell tab="progress" title="ללמוד" subtitle={read ? `${read.size} מתוך ${LESSONS.length} שיעורים נקראו` : " "} back={{ href: "/progress", label: "התקדמות" }}>
      {!read || !next ? (
        <Skeleton className="h-96 rounded-xl" />
      ) : (
        <>
          <Link href={`/learn/read?id=${next.id}`} className="flex flex-col gap-3 rounded-xl bg-accent p-5 text-on-accent shadow-pop">
            <span className="flex items-center gap-1.5 text-sm text-on-accent/70">
              <Sparkles aria-hidden className="size-4" />
              השיעור הבא שלך
            </span>
            <span className="text-xl font-semibold leading-snug">{next.title}</span>
            <span className="text-sm text-on-accent/70">
              {TOPIC_LABEL[next.topic]}, כ-{next.minutes} דקות
            </span>
          </Link>

          {TOPICS.filter((t) => LESSONS.some((l) => l.topic === t)).map((t) => (
            <section key={t} aria-labelledby={`t-${t}`} className="flex flex-col gap-2">
              <h2 id={`t-${t}`} className="px-1 text-sm text-text-muted">
                {TOPIC_LABEL[t]}
              </h2>
              <ul className="glass flex flex-col rounded-lg">
                {LESSONS.filter((l) => l.topic === t).map((l, i) => (
                  <li key={l.id} className={i ? "border-t border-border" : ""}>
                    <Link href={`/learn/read?id=${l.id}`} className="flex items-center gap-3 px-4 py-3.5">
                      <span className={`flex size-7 shrink-0 items-center justify-center rounded-pill ${read.has(l.id) ? "bg-success text-on-accent" : "well"}`}>
                        {read.has(l.id) && <Check aria-label="נקרא" className="size-4" strokeWidth={3} />}
                      </span>
                      <span className="flex-1 font-medium">{l.title}</span>
                      <ChevronLeft aria-hidden className="size-4 text-text-subtle" />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </>
      )}
    </AppShell>
  );
}
