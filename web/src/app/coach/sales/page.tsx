"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { ChevronLeft, Flag, SendHorizontal } from "lucide-react";
import { AppShell } from "@/components/app/app-shell";
import { Button } from "@/components/ui/button";
import { Banner, Panel, Skeleton } from "@/components/ui/surface";
import { DifficultyBars, GoldRing, Section } from "@/components/journey/parts";
import type { SalesSession } from "@/data/life-types";
import { getSales, listSales, saveSales } from "@/data/journey-repo";
import { COACH_ERROR_TEXT, salesReview, salesTurn, type CoachError } from "@/lib/journey/coach-ai";
import { SCENARIO_BY_ID, SCENARIOS } from "@/lib/journey/sales";
import { formatRelativeDay } from "@/lib/format";
import { cn } from "@/lib/cn";

/** The list of scenarios and past sessions. */
function Arena() {
  const sales = useLiveQuery(() => listSales(), []);
  const best = new Map<string, number>();
  for (const s of sales ?? []) if (s.review) best.set(s.scenarioId, Math.max(best.get(s.scenarioId) ?? 0, s.review.score));
  return (
    <>
      <Section title="תרחישים">
        <ul className="flex flex-col gap-2.5">
          {SCENARIOS.map((s, i) => (
            <li key={s.id}>
              <Link href={`/coach/sales?scenario=${s.id}`} className="glass rise flex items-center gap-4 rounded-lg p-4" style={{ ["--i" as string]: i }}>
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="font-semibold">{s.title}</span>
                  <span className="line-clamp-2 text-sm text-text-muted">{s.setup}</span>
                  <span className="flex items-center gap-3">
                    <DifficultyBars value={s.level} />
                    {best.has(s.id) && <span className="figure text-xs text-accent-ink">שיא {best.get(s.id)}</span>}
                  </span>
                </span>
                <ChevronLeft aria-hidden className="size-5 shrink-0 text-text-subtle" />
              </Link>
            </li>
          ))}
        </ul>
      </Section>
      {!!sales?.length && (
        <Section title="שיחות קודמות">
          <ul className="glass divide-y divide-border overflow-hidden rounded-xl">
            {sales.slice(0, 12).map((s) => (
              <li key={s.id}>
                <Link href={`/coach/sales?id=${s.id}`} className="flex items-center gap-3 px-4 py-3">
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate font-medium">{SCENARIO_BY_ID.get(s.scenarioId)?.title ?? "תרחיש"}</span>
                    <span className="text-xs text-text-subtle">{formatRelativeDay(s.at)}</span>
                  </span>
                  <span className={cn("figure", s.review ? (s.review.score >= 85 ? "text-accent-ink" : "") : "text-text-subtle")}>{s.review ? s.review.score : "לא הסתיים"}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Section>
      )}
    </>
  );
}

/** One conversation: Claude plays the client, the user answers, and the coach scores it at the end. */
function Session({ scenarioId, sessionId }: { scenarioId: string | null; sessionId: string | null }) {
  const router = useRouter();
  const [s, setS] = useState<SalesSession | null>(() => {
    const sc = scenarioId ? SCENARIO_BY_ID.get(scenarioId) : undefined;
    return !sessionId && sc ? { id: crypto.randomUUID(), at: new Date().toISOString(), scenarioId: sc.id, turns: [{ role: "client", text: sc.opening }], review: null } : null;
  });
  const [text, setText] = useState("");
  const [busy, setBusy] = useState<"reply" | "review" | null>(null);
  const [error, setError] = useState<CoachError | null>(null);
  const [ended, setEnded] = useState(false);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!sessionId) return;
    void getSales(sessionId).then((x) => {
      setS(x);
      if (x?.review) setEnded(true);
    });
  }, [sessionId]);

  useEffect(() => {
    end.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [s?.turns.length, busy]);

  if (!s) return <Skeleton className="h-96 rounded-xl" />;
  const sc = SCENARIO_BY_ID.get(s.scenarioId);
  if (!sc) return <Banner tone="danger">התרחיש לא נמצא.</Banner>;
  const mine = s.turns.filter((t) => t.role === "me").length;

  const send = async () => {
    const line = text.trim();
    if (!line) return;
    const next: SalesSession = { ...s, turns: [...s.turns, { role: "me", text: line }] };
    setS(next);
    setText("");
    setBusy("reply");
    setError(null);
    await saveSales(next);
    const r = await salesTurn(sc, next.turns);
    setBusy(null);
    if (!r.ok) return setError(r.error);
    const withReply = { ...next, turns: [...next.turns, { role: "client" as const, text: r.data.reply }] };
    setS(withReply);
    await saveSales(withReply);
    if (r.data.done || mine + 1 >= 10) setEnded(true);
  };

  const review = async () => {
    setBusy("review");
    setError(null);
    const r = await salesReview(sc, s.turns);
    setBusy(null);
    if (!r.ok) return setError(r.error);
    const done = { ...s, review: r.data };
    setS(done);
    setEnded(true);
    await saveSales(done);
  };

  return (
    <>
      <Panel className="flex flex-col gap-2">
        <span className="eyebrow">התרחיש</span>
        <p className="leading-relaxed">{sc.setup}</p>
        <p className="text-sm text-text-muted">
          <span className="font-semibold text-accent-ink">המטרה: </span>
          {sc.goal}
        </p>
      </Panel>

      <ol className="flex flex-col gap-3" aria-label="השיחה" aria-live="polite">
        {s.turns.map((t, i) => (
          <li key={i} className={cn("rise flex", t.role === "me" ? "justify-start" : "justify-end")}>
            <div className={cn("max-w-[85%] rounded-lg px-4 py-3 leading-relaxed", t.role === "me" ? "bg-accent text-on-accent rounded-ss-sm" : "glass rounded-se-sm")}>
              <span className={cn("mb-1 block text-[0.6875rem] font-semibold tracking-wide", t.role === "me" ? "text-on-accent/70" : "text-text-subtle")}>{t.role === "me" ? "אתה" : "הלקוח"}</span>
              {t.text}
            </div>
          </li>
        ))}
        {busy === "reply" && (
          <li className="flex justify-end">
            <span className="glass inline-flex gap-1 rounded-lg px-4 py-4" aria-label="הלקוח כותב">
              {[0, 1, 2].map((i) => (
                <span key={i} className="size-1.5 animate-pulse rounded-pill bg-text-subtle" style={{ animationDelay: `${i * 160}ms` }} />
              ))}
            </span>
          </li>
        )}
      </ol>
      <div ref={end} />

      {error && <Banner tone="danger">{COACH_ERROR_TEXT[error]}</Banner>}

      {s.review ? (
        <section className="card-hero flex flex-col gap-5 rounded-xl p-6" aria-label="המשוב">
          <div className="flex items-center gap-5">
            <GoldRing value={s.review.score / 100} size={104} label={`ציון ${s.review.score}`}>
              <span className="figure text-3xl">{s.review.score}</span>
            </GoldRing>
            <p className="flex-1 leading-relaxed">{s.review.summary}</p>
          </div>
          {[
            { t: "מה עבד", l: s.review.strengths },
            { t: "מה לתקן", l: s.review.fixes },
          ].map((g) => (
            <div key={g.t} className="flex flex-col gap-2">
              <span className="eyebrow">{g.t}</span>
              <ul className="flex flex-col gap-1.5">
                {g.l.map((x, i) => (
                  <li key={i} className="flex gap-2 text-sm leading-relaxed">
                    <ChevronLeft aria-hidden className="mt-0.5 size-4 shrink-0 text-accent-ink" />
                    {x}
                  </li>
                ))}
              </ul>
            </div>
          ))}
          <div className="well flex flex-col gap-1 rounded-md p-4">
            <span className="text-xs font-semibold text-accent-ink">המשפט שהיה עדיף</span>
            <p className="leading-relaxed">״{s.review.betterLine}״</p>
          </div>
          <Button variant="secondary" onClick={() => router.push(`/coach/sales?scenario=${sc.id}`)}>
            לנסות שוב
          </Button>
        </section>
      ) : (
        <div className="glass-raised sticky bottom-[calc(1rem+env(safe-area-inset-bottom))] flex flex-col gap-3 rounded-xl p-3">
          {!ended && (
            <div className="flex items-end gap-2">
              <textarea
                aria-label="התשובה שלך"
                rows={2}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void send();
                  }
                }}
                placeholder="מה אתה עונה?"
                className="well min-h-12 flex-1 resize-none rounded-md px-3.5 py-3 text-base outline-none placeholder:text-text-subtle focus:outline-2 focus:outline-focus"
              />
              <Button size="lg" aria-label="שליחה" disabled={!text.trim() || busy != null} onClick={() => void send()} className="px-4">
                <SendHorizontal aria-hidden className="size-5 -scale-x-100" />
              </Button>
            </div>
          )}
          <Button variant={ended ? "primary" : "ghost"} loading={busy === "review"} disabled={mine < 2 || busy === "reply"} icon={<Flag aria-hidden className="size-4" />} onClick={() => void review()}>
            {mine < 2 ? "לפחות שתי תשובות לפני משוב" : "לסיים ולקבל ציון"}
          </Button>
        </div>
      )}
    </>
  );
}

function SalesInner() {
  const p = useSearchParams();
  const scenario = p.get("scenario");
  const id = p.get("id");
  return scenario || id ? <Session key={scenario ?? id!} scenarioId={scenario} sessionId={id} /> : <Arena />;
}

function Header() {
  const p = useSearchParams();
  const inSession = !!(p.get("scenario") || p.get("id"));
  const title = inSession ? (SCENARIO_BY_ID.get(p.get("scenario") ?? "")?.title ?? "שיחה") : "זירת מכירות";
  return (
    <AppShell
      tab="coach"
      back={inSession ? { href: "/coach/sales", label: "זירת מכירות" } : { href: "/coach", label: "המאמן" }}
      eyebrow="תרגול"
      title={title}
      subtitle={inSession ? undefined : "Claude משחק את הלקוח. אתה מוכר. בסוף מקבל ציון, מה עבד, ומה לתקן."}
      hideTabs={inSession}
      bottomSpace={!inSession}
    >
      <SalesInner />
    </AppShell>
  );
}

export default function SalesPage() {
  return (
    <Suspense fallback={null}>
      <Header />
    </Suspense>
  );
}
