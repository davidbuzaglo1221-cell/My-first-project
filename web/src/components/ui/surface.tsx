import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

/** A raised glass pane. The default container for one block of content. */
export function Panel({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("glass rounded-lg p-5", className)} {...rest} />;
}

export function SectionHeader({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <h2 className="text-lg">{title}</h2>
      {action}
    </div>
  );
}

/** A value held in a well: label above, serif figure, quiet hint. */
export function Stat({ label, value, unit, hint }: { label: string; value: ReactNode; unit?: string; hint?: ReactNode }) {
  return (
    <div className="well flex flex-col gap-1 rounded-md px-3.5 py-3">
      <span className="text-xs text-text-muted">{label}</span>
      <span className="figure text-2xl leading-none text-text">
        {value}
        {unit && <span className="ms-1 font-sans text-xs font-medium text-text-muted">{unit}</span>}
      </span>
      {hint && <span className="text-xs text-text-subtle">{hint}</span>}
    </div>
  );
}

type Tone = "info" | "success" | "warning" | "danger";

const toneDot: Record<Tone, string> = {
  info: "bg-text-muted",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
};

/** A quiet status line on glass. The coloured dot carries the tone; the words carry the meaning. */
export function Banner({ tone = "info", children, action }: { tone?: Tone; children: ReactNode; action?: ReactNode }) {
  return (
    <div
      role={tone === "danger" ? "alert" : "status"}
      className="glass flex items-center gap-3 rounded-md px-4 py-3 text-sm text-text"
    >
      <span aria-hidden className={cn("size-2 shrink-0 rounded-pill", toneDot[tone])} />
      <div className="flex-1">{children}</div>
      {action}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon: ReactNode;
  title: string;
  body?: string;
  action?: ReactNode;
}) {
  return (
    <div className="glass flex flex-col items-center gap-3 rounded-lg px-6 py-10 text-center">
      <div className="well flex size-14 items-center justify-center rounded-pill text-accent">{icon}</div>
      <h3 className="text-lg">{title}</h3>
      {body && <p className="max-w-xs text-sm text-text-muted">{body}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("well animate-pulse rounded-md", className)} />;
}

/** Small descriptor, e.g. the muscle and equipment of an exercise. Replaces "A · B" strings. */
export function Tag({ children }: { children: ReactNode }) {
  return <span className="well inline-flex h-6 items-center rounded-pill px-2.5 text-xs text-text-muted">{children}</span>;
}
