"use client";

import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FilterChip, SearchField } from "@/components/ui/field";
import { Skeleton } from "@/components/ui/surface";
import { createCustomExercise, listExercises } from "@/data/repo";
import { EQUIPMENT_LABEL, MUSCLE_LABEL, type Equipment, type MuscleGroup } from "@/data/types";

const MUSCLES: MuscleGroup[] = ["chest", "back", "legs", "shoulders", "arms", "core"];
const EQUIPMENT: Equipment[] = ["barbell", "dumbbell", "machine", "cable", "bodyweight", "kettlebell", "band", "other"];

/** A new exercise when the library does not have it: a name, a muscle group and equipment. */
function CreateExercise({ name, onCreated }: { name: string; onCreated: (id: string) => void }) {
  const [muscle, setMuscle] = useState<MuscleGroup | null>(null);
  const [equipment, setEquipment] = useState<Equipment | null>(null);
  return (
    <div className="glass flex flex-col gap-4 rounded-lg p-4">
      <p className="font-semibold">תרגיל חדש: „{name.trim()}”</p>
      <div className="flex flex-col gap-2">
        <span id="new-ex-muscle" className="text-sm text-text-muted">שריר עיקרי</span>
        <div role="group" aria-labelledby="new-ex-muscle" className="flex flex-wrap gap-2">
          {[...MUSCLES, "full_body" as const].map((m) => (
            <FilterChip key={m} selected={muscle === m} onToggle={() => setMuscle(m)}>
              {MUSCLE_LABEL[m]}
            </FilterChip>
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <span id="new-ex-equipment" className="text-sm text-text-muted">ציוד</span>
        <div role="group" aria-labelledby="new-ex-equipment" className="flex flex-wrap gap-2">
          {EQUIPMENT.map((e) => (
            <FilterChip key={e} selected={equipment === e} onToggle={() => setEquipment(e)}>
              {EQUIPMENT_LABEL[e]}
            </FilterChip>
          ))}
        </div>
      </div>
      <Button
        disabled={!muscle || !equipment || name.trim().length < 2}
        onClick={async () => {
          const ex = await createCustomExercise({ nameHe: name, primaryMuscle: muscle!, equipment: equipment! });
          onCreated(ex.id);
        }}
      >
        יצירה והוספה
      </Button>
    </div>
  );
}

/** S08: search and pick an exercise. Lives inside a bottom sheet. */
export function ExercisePicker({ onPick, excludeIds = [] }: { onPick: (exerciseId: string) => void; excludeIds?: string[] }) {
  const [query, setQuery] = useState("");
  const [muscles, setMuscles] = useState<MuscleGroup[]>([]);
  const [creating, setCreating] = useState(false);
  const results = useLiveQuery(() => listExercises({ query, muscles }), [query, muscles.join(",")]);
  const showCreate = !!results && !!query.trim() && (results.length === 0 || creating);

  return (
    <div className="flex flex-col gap-3">
      <div className="sticky top-0 z-10 -mx-3 flex flex-col gap-3 bg-transparent px-3 pt-1 pb-2">
        <SearchField value={query} onChange={setQuery} placeholder="שם התרגיל, למשל סקוואט" label="חיפוש תרגיל" />
        {/* Hidden while creating a new exercise, so its muscle choices are the only ones on screen. */}
        <div className={`-mx-3 flex gap-2 overflow-x-auto px-3 pb-1 [scrollbar-width:none] ${showCreate ? "hidden" : ""}`}>
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
      ) : results.length === 0 && !query.trim() ? (
        <p className="px-2 py-8 text-center text-sm text-text-muted">אין תרגילים בסינון הזה. אפשר לנקות אותו.</p>
      ) : results.length === 0 || creating ? (
        <>
          {results.length === 0 && <p className="px-2 pt-2 text-center text-sm text-text-muted">„{query.trim()}” עוד לא בספרייה.</p>}
          <CreateExercise name={query} onCreated={onPick} />
        </>
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
          {query.trim().length >= 2 && (
            <li>
              <button type="button" onClick={() => setCreating(true)} className="flex w-full items-center gap-2 rounded-md px-2 py-3 text-start text-sm font-medium text-text-muted hover:text-text">
                <Plus aria-hidden className="size-4" />
                יצירת תרגיל „{query.trim()}”
              </button>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
