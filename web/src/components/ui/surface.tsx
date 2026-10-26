import type { HTMLAttributes, ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Info, WifiOff } from "lucide-react";
import { cn } from "@/lib/cn";

export function Card({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-lg border border-border bg-bg p-4 shadow-card", className)} {...rest} />;
}

export function SectionHeader({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h2 className="text-lg">{title}</h2>
      {action}
    </div>
  );
}

export function Stat({ label, value, unit, hint }: { label: string; value: ReactNode; unit?: string; hint?: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-md bg-surface p-3">
      <span className="text-xs text-text-muted">{label}</span>
      <span className="num text-xl">
        {value}
        {unit && <span className="ms-1 text-sm font-medium text-text-muted">{unit}</span>}
      </span>
      {hint && <span className="text-xs text-text-muted">{hint}</span>}
    </div>
  );
}

type Tone = "info" | "success" | "warning" | "danger" | "offline";

const toneStyle: Record<Tone, string> = {
  info: "bg-surface-2 text-text",
  success: "bg-accent-soft text-accent-ink",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger",
  offline: "bg-surface-2 text-text",
};

const toneIcon: Record<Tone, typeof Info> = {
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  danger: AlertTriangle,
  offline: WifiOff,
};

export function Banner({ tone = "info", children, action }: { tone?: Tone; children: ReactNode; action?: ReactNode }) {
  const Icon = toneIcon[tone];
  return (
    <div
      role={tone === "danger" ? "alert" : "status"}
      className={cn("flex items-start gap-3 rounded-md px-3 py-2.5 text-sm", toneStyle[tone])}
    >
      <Icon aria-hidden className="mt-0.5 size-5 shrink-0" />
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
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border px-6 py-10 text-center">
      <div className="flex size-14 items-center justify-center rounded-pill bg-accent-soft text-accent-ink">{icon}</div>
      <h3 className="text-lg">{title}</h3>
      {body && <p className="max-w-xs text-sm text-text-muted">{body}</p>}
      {action}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("animate-pulse rounded-md bg-surface-2", className)} />;
}
