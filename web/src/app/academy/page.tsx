"use client";

import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { Check, ChevronLeft, Headphones } from "lucide-react";
import { AppShell } from "@/components/app/app-shell";
import { Skeleton } from "@/components/ui/surface";
import { DOMAIN_ICON, Section } from "@/components/journey/parts";
import { readLessonIds } from "@/data/coach-repo";
import { ACADEMY, LEVEL_NAME, minutesOf, nextLesson } from "@/lib/journey/academy";
import { DOMAIN_LABEL, DOMAINS } from "@/lib/journey/library";
import { cn } from "@/lib/cn";

/**
 * The academy: three lessons for each area, foundations to mastery. Every lesson can be read or
 * heard. The card on top is the next one to take.
 */
export default function AcademyPage() {
  const read = useLiveQuery(async () => {
    const all = await readLessonIds();
    return new Set([...all].filter((id) => id.startsWith("academy:")).map((id) => id.slice(8)));
  }, []);
  const next = read ? nextLesson(read) : null;
  const done = read?.size ?? 0;

  return (
    <AppShell tab="journey" back={{ href: "/journey", label: "המסע" }} eyebrow={`${done} מתוך ${ACADEMY.length} שיעורים`} title="האקדמיה">
      {!read || !next ? (
        <Skeleton className="h-48 rounded-xl" />
      ) : (
        <Link href={`/academy/read?id=${next.id}`} className="card-hero rise flex flex-col gap-3 rounded-xl p-6">
          <span className="eyebrow">{done ? "השיעור הבא" : "מתחילים כאן"}</span>
          <span className="display text-[1.9rem] leading-tight">{next.title}</span>
          <span className="line-clamp-2 text-text-muted">{next.hook}</span>
          <span className="flex items-center gap-3 pt-1 text-sm text-text-muted">
            <Headphones aria-hidden className="size-4 text-accent-ink" />
            {DOMAIN_LABEL[next.domain]} · {LEVEL_NAME[next.n]} · {minutesOf(next)} דק׳
          </span>
          <span className="well mt-1 block h-1.5 overflow-hidden rounded-pill">
            <span className="block h-full rounded-pill bg-accent" style={{ width: `${(done / ACADEMY.length) * 100}%` }} />
          </span>
        </Link>
      )}

      {DOMAINS.map((d) => {
        const Icon = DOMAIN_ICON[d];
        const lessons = ACADEMY.filter((l) => l.domain === d);
        return (
          <Section key={d} title={DOMAIN_LABEL[d]}>
            <ol className="glass overflow-hidden rounded-xl">
              {lessons.map((l, i) => {
                const isRead = read?.has(l.id);
                return (
                  <li key={l.id} className={cn(i > 0 && "border-t border-border")}>
                    <Link href={`/academy/read?id=${l.id}`} className="group flex items-center gap-4 px-4 py-4">
                      <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-pill border", isRead ? "border-accent bg-accent text-on-accent" : "border-border text-accent-ink")}>
                        {isRead ? <Check aria-hidden className="size-5" strokeWidth={2.4} /> : <Icon aria-hidden className="size-[1.1rem]" strokeWidth={1.7} />}
                      </span>
                      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span className="text-xs text-text-subtle">
                          <span className="figure text-accent-ink">{l.n}</span> · {LEVEL_NAME[l.n]} · {minutesOf(l)} דק׳
                        </span>
                        <span className={cn("font-semibold", isRead && "text-text-muted")}>{l.title}</span>
                      </span>
                      <ChevronLeft aria-hidden className="size-5 shrink-0 text-text-subtle transition-transform group-hover:-translate-x-0.5" />
                    </Link>
                  </li>
                );
              })}
            </ol>
          </Section>
        );
      })}
    </AppShell>
  );
}
