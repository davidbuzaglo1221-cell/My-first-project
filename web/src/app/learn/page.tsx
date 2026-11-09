"use client";

import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { Check, ChevronLeft } from "lucide-react";
import { AppShell } from "@/components/app/app-shell";
import { BodyNav } from "@/components/journey/parts";
import { Skeleton } from "@/components/ui/surface";
import { readLessonIds } from "@/data/coach-repo";
import { LESSONS, TOPIC_LABEL, type Lesson } from "@/lib/lessons";

const TOPICS: Lesson["topic"][] = ["training", "nutrition", "recovery"];

/** S29: the lessons, by topic. Each takes about a minute. */
export default function LearnPage() {
  const read = useLiveQuery(() => readLessonIds(), []);
  return (
    <AppShell tab="progress" eyebrow="גוף" title="ללמוד" subtitle={read ? `${read.size} מתוך ${LESSONS.length} שיעורים נקראו` : " "}>
      <BodyNav active="learn" />
      {!read ? (
        <Skeleton className="h-96 rounded-xl" />
      ) : (
        TOPICS.map((t) => (
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
        ))
      )}
    </AppShell>
  );
}
