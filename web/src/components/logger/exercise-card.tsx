import type { ReactNode } from "react";
import { MoreVertical, Plus, StickyNote } from "lucide-react";
import { IconButton } from "@/components/ui/button";
import { cn } from "@/lib/cn";

/**
 * One exercise inside the logger: name, meta, notes, the set rows, add set.
 * A superset gets a coloured rail on the start side and its letter (א, ב...).
 */
export function ExerciseCard({
  name,
  meta,
  supersetLabel,
  note,
  children,
  onAddSet,
  onMenu,
  doneCount,
  totalCount,
}: {
  name: string;
  meta?: string;
  supersetLabel?: string;
  note?: string;
  children: ReactNode;
  onAddSet: () => void;
  onMenu?: () => void;
  doneCount: number;
  totalCount: number;
}) {
  const complete = totalCount > 0 && doneCount === totalCount;
  return (
    <section
      aria-label={name}
      className={cn(
        "relative rounded-lg border bg-bg p-3 shadow-card",
        complete ? "border-accent/40" : "border-border",
        supersetLabel && "border-s-4 border-s-accent",
      )}
    >
      <header className="mb-2 flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {supersetLabel && (
              <span className="rounded-sm bg-accent-soft px-1.5 py-0.5 text-xs font-bold text-accent-ink">
                סופרסט {supersetLabel}
              </span>
            )}
            <h3 className="truncate text-lg">{name}</h3>
          </div>
          <p className="text-sm text-text-muted">
            {meta && <span>{meta} · </span>}
            <span className="num">
              {doneCount}/{totalCount} סטים
            </span>
          </p>
        </div>
        {onMenu && (
          <IconButton label={`אפשרויות ל${name}`} onClick={onMenu}>
            <MoreVertical aria-hidden className="size-5" />
          </IconButton>
        )}
      </header>

      {note && (
        <p className="mb-2 flex items-start gap-2 rounded-sm bg-warning-soft px-2.5 py-2 text-sm text-warning">
          <StickyNote aria-hidden className="mt-0.5 size-4 shrink-0" />
          {note}
        </p>
      )}

      <div className="flex flex-col gap-1">{children}</div>

      <button
        type="button"
        onClick={onAddSet}
        className="mt-2 flex h-11 w-full items-center justify-center gap-1.5 rounded-md bg-surface text-sm font-semibold text-accent hover:bg-surface-2"
      >
        <Plus aria-hidden className="size-4" />
        הוספת סט
      </button>
    </section>
  );
}
