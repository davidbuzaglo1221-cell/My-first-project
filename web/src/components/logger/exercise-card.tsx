import type { ReactNode } from "react";
import { MoreHorizontal, Plus } from "lucide-react";
import { IconButton } from "@/components/ui/button";
import { Tag } from "@/components/ui/surface";
import { cn } from "@/lib/cn";

/**
 * One exercise inside the logger: name, tags, the coach note, the set rows, add set.
 * A superset gets a lit rail on the start side and its letter (א, ב...).
 */
export function ExerciseCard({
  name,
  tags = [],
  supersetLabel,
  note,
  children,
  onAddSet,
  onMenu,
  doneCount,
  totalCount,
}: {
  name: string;
  tags?: string[];
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
    <section aria-label={name} className="glass relative overflow-hidden rounded-lg p-4">
      {supersetLabel && <span aria-hidden className="absolute inset-y-4 start-0 w-0.5 rounded-pill bg-accent" />}
      <header className="mb-3 flex items-start gap-3">
        <div className="min-w-0 flex-1">
          {supersetLabel && <p className="mb-1 text-xs font-medium text-accent">סופרסט {supersetLabel}</p>}
          <h3 className="truncate text-lg">{name}</h3>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {tags.map((t) => (
              <Tag key={t}>{t}</Tag>
            ))}
            <span className={cn("num ms-auto text-xs", complete ? "text-success" : "text-text-subtle")}>
              {doneCount} מתוך {totalCount} סטים
            </span>
          </div>
        </div>
        {onMenu && (
          <IconButton label={`אפשרויות ל${name}`} onClick={onMenu} className="-me-2 -mt-1.5">
            <MoreHorizontal aria-hidden className="size-5" />
          </IconButton>
        )}
      </header>

      {note && <p className="mb-3 border-s-2 border-warning/70 ps-3 text-sm text-text-muted">{note}</p>}

      <div className="flex flex-col gap-1">{children}</div>

      <button
        type="button"
        onClick={onAddSet}
        className="mt-3 flex h-11 w-full items-center justify-center gap-1.5 rounded-md text-sm font-medium text-accent transition-colors duration-(--motion-fast) hover:bg-accent-soft/40"
      >
        <Plus aria-hidden className="size-4" />
        הוספת סט
      </button>
    </section>
  );
}
