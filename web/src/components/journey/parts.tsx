"use client";

import { useId, type ReactNode } from "react";
import { useNow } from "@/hooks/use-now";
import Link from "next/link";
import { BookOpen, Brain, Briefcase, Check, ChevronLeft, Dumbbell, Flame, Handshake, Mic, Shield, Users } from "lucide-react";
import type { Domain, Mission } from "@/data/life-types";
import { DOMAIN_LABEL } from "@/lib/journey/library";
import { cn } from "@/lib/cn";

export const DOMAIN_ICON: Record<Domain, typeof Shield> = {
  discipline: Shield,
  fitness: Dumbbell,
  charisma: Mic,
  sales: Handshake,
  mind: Brain,
  courage: Flame,
  business: Briefcase,
  relationships: Users,
  learning: BookOpen,
};

/** The area of a mission: a thin gold icon and its name. */
export function DomainMark({ domain, className }: { domain: Domain; className?: string }) {
  const Icon = DOMAIN_ICON[domain];
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs font-semibold tracking-wide text-accent-ink", className)}>
      <Icon aria-hidden className="size-3.5" strokeWidth={1.8} />
      {DOMAIN_LABEL[domain]}
    </span>
  );
}

/** Difficulty as three short bars. */
export function DifficultyBars({ value, label = true }: { value: 1 | 2 | 3; label?: boolean }) {
  const words = ["", "בסיס", "מאתגר", "קשה"];
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-text-muted" aria-label={`רמת קושי: ${words[value]}`}>
      <span aria-hidden className="flex items-end gap-0.5">
        {[1, 2, 3].map((i) => (
          <span key={i} className={cn("w-1 rounded-pill", i <= value ? "bg-accent" : "bg-border")} style={{ height: 4 + i * 3 }} />
        ))}
      </span>
      {label && words[value]}
    </span>
  );
}

/**
 * A ring that fills with gold. The stroke draws itself in on first paint.
 * `children` sit in the middle.
 */
export function GoldRing({ value, size = 128, stroke = 6, label, children }: { value: number; size?: number; stroke?: number; label: string; children?: ReactNode }) {
  const id = useId().replace(/:/g, "");
  const r = (size - stroke) / 2;
  const len = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value));
  return (
    <div className="relative inline-flex shrink-0 items-center justify-center" style={{ width: size, height: size }} role="img" aria-label={label}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden>
        <defs>
          <linearGradient id={`g${id}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--c-accent-hover)" />
            <stop offset="100%" stopColor="var(--c-accent)" />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--c-border)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={`url(#g${id})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={len}
          strokeDashoffset={len * (1 - v)}
          style={{ ["--len" as string]: `${len}`, animation: "ring-draw 1.1s var(--ease-out) both", transition: "stroke-dashoffset 700ms var(--ease-out)" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">{children}</div>
    </div>
  );
}

const two = (n: number) => String(n).padStart(2, "0");

/** Time left as HH:MM:SS, ticking once a second. */
export function Countdown({ until, className }: { until: number; className?: string }) {
  const now = useNow(1000);
  if (now == null) return <span className={className}>--:--:--</span>;
  const s = Math.max(0, Math.floor((until - now) / 1000));
  return (
    <span className={cn("figure", className)} aria-label={`נשארו ${Math.floor(s / 3600)} שעות ו-${Math.floor((s % 3600) / 60)} דקות`}>
      <bdi dir="ltr">
        {two(Math.floor(s / 3600))}:{two(Math.floor((s % 3600) / 60))}:{two(s % 60)}
      </bdi>
    </span>
  );
}

/** A mission in a list: area, title, what is left, and a link to it. */
export function MissionRow({ m, index = 0 }: { m: Mission; index?: number }) {
  const done = m.status === "done";
  const skipped = m.status === "skipped";
  return (
    <Link
      href={`/mission?id=${encodeURIComponent(m.id)}`}
      className={cn("glass rise group flex items-center gap-4 rounded-lg p-4 transition-[border-color,transform] duration-(--motion-base) active:scale-[0.99]", done && "opacity-80")}
      style={{ ["--i" as string]: index }}
    >
      <span
        className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-pill border",
          done ? "border-accent bg-accent text-on-accent" : "border-border text-accent-ink",
        )}
      >
        {done ? <Check aria-hidden className="size-5" strokeWidth={2.4} /> : (() => {
          const Icon = DOMAIN_ICON[m.domain];
          return <Icon aria-hidden className="size-[1.1rem]" strokeWidth={1.7} />;
        })()}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex items-center gap-2">
          <DomainMark domain={m.domain} />
          {m.source === "coach" && <span className="text-[0.625rem] font-semibold tracking-widest text-text-subtle">מהמאמן</span>}
        </span>
        <span className={cn("truncate font-semibold", (done || skipped) && "text-text-muted", skipped && "line-through decoration-text-subtle/60")}>{m.title}</span>
        <span className="text-xs text-text-subtle">
          {done ? `בוצע · ${m.xp} נק׳` : skipped ? "דילגת" : m.kind === "timer" ? `${m.target} דקות` : m.kind === "count" ? `${Math.min(m.progress, m.target).toLocaleString("he-IL")} / ${m.target.toLocaleString("he-IL")}` : `${m.xp} נקודות`}
        </span>
      </span>
      <ChevronLeft aria-hidden className="size-5 shrink-0 text-text-subtle transition-transform duration-(--motion-base) group-hover:-translate-x-0.5" />
    </Link>
  );
}

/** A labelled number for the dashboards. */
export function Metric({ label, value, hint, tone }: { label: string; value: ReactNode; hint?: ReactNode; tone?: "gold" | "blood" }) {
  return (
    <div className="glass flex flex-col gap-1 rounded-lg px-4 py-3.5">
      <span className="text-xs text-text-muted">{label}</span>
      <span className={cn("figure text-[1.6rem] leading-tight", tone === "gold" && "text-accent-ink", tone === "blood" && "text-blood-ink")}>{value}</span>
      {hint && <span className="text-xs text-text-subtle">{hint}</span>}
    </div>
  );
}

/** Section heading inside a page: tracked label and an optional link. */
export function Section({ title, href, linkLabel, children, className }: { title: string; href?: string; linkLabel?: string; children: ReactNode; className?: string }) {
  return (
    <section className={cn("flex flex-col gap-3", className)} aria-label={title}>
      <div className="flex items-center gap-3">
        <h2 className="eyebrow shrink-0">{title}</h2>
        <span aria-hidden className="rule" />
        {href && (
          <Link href={href} className="shrink-0 text-sm text-text-muted hover:text-text">
            {linkLabel ?? "הכול"}
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

/** The sub-navigation of the body room: training, nutrition, progress, knowledge. */
export function BodyNav({ active }: { active: "workouts" | "nutrition" | "progress" | "learn" }) {
  const items = [
    { id: "workouts", label: "אימונים", href: "/workouts" },
    { id: "nutrition", label: "תזונה", href: "/nutrition" },
    { id: "progress", label: "התקדמות", href: "/progress" },
    { id: "learn", label: "ידע", href: "/learn" },
  ] as const;
  return (
    <nav aria-label="גוף" className="-mt-1 flex border-b border-border">
      {items.map((i) => (
        <Link
          key={i.id}
          href={i.href}
          aria-current={i.id === active ? "page" : undefined}
          className={cn(
            "relative flex h-11 flex-1 items-center justify-center text-sm font-medium transition-colors duration-(--motion-fast)",
            i.id === active ? "text-text" : "text-text-muted hover:text-text",
          )}
        >
          {i.label}
          <span
            aria-hidden
            className={cn(
              "absolute -bottom-px h-[2px] rounded-pill bg-accent transition-[width,opacity] duration-(--motion-base)",
              i.id === active ? "w-10 opacity-100 shadow-[0_0_10px_var(--c-accent)]" : "w-0 opacity-0",
            )}
          />
        </Link>
      ))}
    </nav>
  );
}

/** Horizontal bars for a few labelled values (domains, parts of a score). */
export function HBars({ rows, max }: { rows: { label: string; value: number; hint?: string }[]; max?: number }) {
  const top = max ?? Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="flex flex-col gap-2.5">
      {rows.map((r) => (
        <li key={r.label} className="flex items-center gap-3 text-sm">
          <span className="w-24 shrink-0 text-text-muted">{r.label}</span>
          <span className="well h-2 flex-1 overflow-hidden rounded-pill">
            <span className="block h-full rounded-pill bg-linear-to-l from-accent-hover to-accent transition-[width] duration-700" style={{ width: `${(r.value / top) * 100}%` }} />
          </span>
          <span className="figure w-12 shrink-0 text-end text-xs text-text">{r.hint ?? r.value}</span>
        </li>
      ))}
    </ul>
  );
}
