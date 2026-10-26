"use client";

import Link from "next/link";
import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { ChevronLeft } from "lucide-react";
import { AppShell } from "@/components/app/app-shell";
import { FilterChip, SearchField } from "@/components/ui/field";
import { Skeleton } from "@/components/ui/surface";
import { listExercises } from "@/data/repo";
import { EQUIPMENT_LABEL, MUSCLE_LABEL, type Equipment, type MuscleGroup } from "@/data/types";

const MUSCLES: MuscleGroup[] = ["chest", "back", "legs", "shoulders", "arms", "core"];
const EQUIPMENT: Equipment[] = ["barbell", "dumbbell", "machine", "cable", "bodyweight", "kettlebell"];

/** S09: the exercise library. */
export default function ExercisesPage() {
  const [query, setQuery] = useState("");
  const [muscles, setMuscles] = useState<MuscleGroup[]>([]);
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const results = useLiveQuery(() => listExercises({ query, muscles, equipment }), [query, muscles.join(","), equipment.join(",")]);

  return (
    <AppShell tab="workouts" title="ספריית תרגילים" back={{ href: "/workouts", label: "אימונים" }}>
      <SearchField value={query} onChange={setQuery} placeholder="שם התרגיל" label="חיפוש תרגיל" />
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none]">
        {MUSCLES.map((m) => (
          <FilterChip key={m} selected={muscles.includes(m)} onToggle={() => setMuscles((x) => (x.includes(m) ? x.filter((y) => y !== m) : [...x, m]))}>
            {MUSCLE_LABEL[m]}
          </FilterChip>
        ))}
      </div>
      <div className="-mx-4 -mt-2 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none]" role="group" aria-label="סינון לפי ציוד">
        {EQUIPMENT.map((e) => (
          <FilterChip key={e} selected={equipment.includes(e)} onToggle={() => setEquipment((x) => (x.includes(e) ? x.filter((y) => y !== e) : [...x, e]))}>
            {EQUIPMENT_LABEL[e]}
          </FilterChip>
        ))}
      </div>
      {!results ? (
        <Skeleton className="h-80 rounded-lg" />
      ) : results.length === 0 ? (
        <p className="py-8 text-center text-sm text-text-muted">לא נמצא תרגיל. אפשר לנסות שם אחר או לנקות את הסינון.</p>
      ) : (
        <ul className="glass flex flex-col rounded-lg" aria-label={`${results.length} תרגילים`}>
          {results.map((e, i) => (
            <li key={e.id}>
              {i > 0 && <span aria-hidden className="mx-4 block h-px bg-border" />}
              <Link href={`/exercises/view?id=${e.id}`} className="flex items-center gap-3 px-4 py-3.5">
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate font-medium">{e.nameHe}</span>
                  <span className="text-sm text-text-subtle">
                    {MUSCLE_LABEL[e.primaryMuscle]}, {EQUIPMENT_LABEL[e.equipment]}
                  </span>
                </span>
                <ChevronLeft aria-hidden className="size-4 shrink-0 text-text-subtle" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </AppShell>
  );
}
