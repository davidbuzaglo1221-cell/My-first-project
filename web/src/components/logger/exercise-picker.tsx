"use client";

import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Plus } from "lucide-react";
import { FilterChip, SearchField } from "@/components/ui/field";
import { Skeleton } from "@/components/ui/surface";
import { listExercises } from "@/data/repo";
import { EQUIPMENT_LABEL, MUSCLE_LABEL, type MuscleGroup } from "@/data/types";

const MUSCLES: MuscleGroup[] = ["chest", "back", "legs", "shoulders", "arms", "core"];

/** S08: search and pick an exercise. Lives inside a bottom sheet. */
export function ExercisePicker({ onPick, excludeIds = [] }: { onPick: (exerciseId: string) => void; excludeIds?: string[] }) {
  const [query, setQuery] = useState("");
  const [muscles, setMuscles] = useState<MuscleGroup[]>([]);
  const results = useLiveQuery(() => listExercises({ query, muscles }), [query, muscles.join(",")]);

  return (
    <div className="flex flex-col gap-3">
      <div className="sticky top-0 z-10 -mx-3 flex flex-col gap-3 bg-transparent px-3 pt-1 pb-2">
        <SearchField value={query} onChange={setQuery} placeholder="שם התרגיל, למשל סקוואט" label="חיפוש תרגיל" />
        <div className="-mx-3 flex gap-2 overflow-x-auto px-3 pb-1 [scrollbar-width:none]">
          {MUSCLES.map((m) => (
            <FilterChip
              key={m}
              selected={muscles.includes(m)}
              onToggle={() => setMuscles((x) => (x.includes(m) ? x.filter((y) => y !== m) : [...x, m]))}
            >
              {MUSCLE_LABEL[m]}
            </FilterChip>
          ))}
        </div>
      </div>

      {!results ? (
        <div className="flex flex-col gap-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-14" />
          ))}
        </div>
      ) : results.length === 0 ? (
        <p className="px-2 py-8 text-center text-sm text-text-muted">
          לא נמצא תרגיל בשם הזה. אפשר לנסות שם אחר או לנקות את הסינון.
        </p>
      ) : (
        <ul className="flex flex-col" aria-label="תרגילים">
          {results.map((e) => {
            const added = excludeIds.includes(e.id);
            return (
              <li key={e.id}>
                <button
                  type="button"
                  onClick={() => onPick(e.id)}
                  className="flex w-full items-center gap-3 rounded-md px-2 py-3 text-start transition-colors duration-(--motion-fast) hover:bg-accent-soft/40"
                >
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate font-medium">{e.nameHe}</span>
                    <span className="text-sm text-text-subtle">
                      {MUSCLE_LABEL[e.primaryMuscle]}, {EQUIPMENT_LABEL[e.equipment]}
                      {added && <span className="text-accent">. כבר באימון</span>}
                    </span>
                  </span>
                  <Plus aria-hidden className="size-5 shrink-0 text-accent" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
