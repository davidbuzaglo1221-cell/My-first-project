"use client";

import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { TextField } from "@/components/ui/field";
import { GramsStepper, MacroLine, MealPicker } from "@/components/nutrition/controls";
import { deleteFoodLog, getPhoto, updateFoodLog } from "@/data/nutrition-repo";
import { MEAL_LABEL, type Food, type FoodLog, type Meal } from "@/data/types";
import { scale } from "@/lib/nutrition";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/cn";

/** Choose how much of a food: a serving chip or grams, with the numbers updating live. */
export function AmountSheet({
  food,
  meal,
  onMealChange,
  onClose,
  onAdd,
}: {
  food: Food | null;
  meal: Meal;
  onMealChange: (m: Meal) => void;
  onClose: () => void;
  onAdd: (grams: number) => Promise<void>;
}) {
  return (
    <BottomSheet open={!!food} onOpenChange={(o) => !o && onClose()} title={food?.nameHe ?? ""} description={food?.brand ?? undefined}>
      {/* Keyed so each food starts from its own first serving. */}
      {food && <AmountBody key={food.id} food={food} meal={meal} onMealChange={onMealChange} onAdd={onAdd} />}
    </BottomSheet>
  );
}

function AmountBody({ food, meal, onMealChange, onAdd }: { food: Food; meal: Meal; onMealChange: (m: Meal) => void; onAdd: (grams: number) => Promise<void> }) {
  const [grams, setGrams] = useState(food.servings[0]?.grams ?? 100);
  const [busy, setBusy] = useState(false);
  const m = scale(food.per100, grams || 0);
  const chips = [...food.servings, { nameHe: "100 גרם", grams: 100 }];

  return (
    <div className="flex flex-col gap-5 px-2 pb-2">
      <div className="flex flex-col items-center gap-1 pt-1">
        <span className="figure text-[2.75rem] leading-none">
          <bdi dir="ltr">{formatNumber(m.kcal, 0)}</bdi>
        </span>
        <span className="text-sm text-text-muted">קלוריות</span>
        <MacroLine className="mt-2 justify-center [&>span:first-child]:hidden" kcal={m.kcal} protein={m.protein} carbs={m.carbs} fat={m.fat} />
      </div>
      <div className="flex flex-wrap gap-2" role="group" aria-label="מנות">
        {chips.map((s) => (
          <button
            key={`${s.nameHe}-${s.grams}`}
            type="button"
            aria-pressed={grams === s.grams}
            onClick={() => setGrams(s.grams)}
            className={cn(
              "h-9 rounded-pill px-4 text-sm font-medium transition-colors duration-(--motion-fast)",
              grams === s.grams ? "bg-accent text-on-accent" : "well text-text",
            )}
          >
            {s.nameHe}
            <span className={cn("num ms-1.5", grams === s.grams ? "text-on-accent/70" : "text-text-subtle")}>{s.grams}ג׳</span>
          </button>
        ))}
      </div>
      <GramsStepper value={grams} onChange={setGrams} />
      <MealPicker value={meal} onChange={onMealChange} />
      <Button
        size="lg"
        fullWidth
        loading={busy}
        disabled={!grams}
        onClick={async () => {
          setBusy(true);
          await onAdd(grams);
          setBusy(false);
        }}
      >
        הוספה ל{MEAL_LABEL[meal]}
      </Button>
      <p className="text-center text-xs text-text-subtle">
        {food.source === "openfoodfacts" ? "ערכים מתוך Open Food Facts (ODbL)" : "ערכים משוערים ל-100 גרם"}
      </p>
    </div>
  );
}

/** Edit or delete a diary entry. Amount changes rescale the numbers when the entry knows its per-100 g values. */
export function EntrySheet({ entry, onClose }: { entry: FoodLog | null; onClose: () => void }) {
  return (
    <BottomSheet open={!!entry} onOpenChange={(o) => !o && onClose()} title={entry?.nameHe ?? ""} description={entry ? sourceText(entry) : undefined}>
      {entry && <EntryBody key={entry.id} entry={entry} onClose={onClose} />}
    </BottomSheet>
  );
}

function sourceText(e: FoodLog) {
  if (e.source === "photo") return e.confidence === "low" ? "מזוהה מתמונה, כדאי לבדוק" : "מזוהה מתמונה";
  if (e.source === "barcode") return "מברקוד";
  if (e.source === "quick") return "הוספה מהירה";
  return undefined;
}

function EntryBody({ entry, onClose }: { entry: FoodLog; onClose: () => void }) {
  const [grams, setGrams] = useState(entry.grams ?? 0);
  const [meal, setMeal] = useState(entry.meal);
  const [name, setName] = useState(entry.nameHe);
  const [kcal, setKcal] = useState(String(entry.kcal));
  const photo = useLiveQuery(async () => (entry.photoId ? ((await getPhoto(entry.photoId)) ?? null) : null), [entry.photoId]);
  const preview = entry.per100 && grams ? scale(entry.per100, grams) : entry;

  return (
    <div className="flex flex-col gap-5 px-2 pb-2">
      {photo && (
        // eslint-disable-next-line @next/next/no-img-element -- a local data URL
        <img src={photo} alt="" className="aspect-[16/9] w-full rounded-lg object-cover" />
      )}
      <TextField label="שם" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
      {entry.per100 ? (
        <>
          <GramsStepper value={grams} onChange={setGrams} />
          <MacroLine kcal={preview.kcal} protein={preview.protein} carbs={preview.carbs} fat={preview.fat} />
        </>
      ) : (
        <TextField label="קלוריות" inputMode="numeric" value={kcal} onChange={(e) => setKcal(e.target.value.replace(/\D/g, ""))} suffix="קק״ל" />
      )}
      <MealPicker value={meal} onChange={setMeal} />
      <div className="flex flex-col gap-2">
        <Button
          size="lg"
          fullWidth
          onClick={async () => {
            await updateFoodLog(entry.id, {
              meal,
              nameHe: name,
              grams: entry.per100 ? grams : undefined,
              macros: entry.per100 ? undefined : { kcal: Number(kcal) || 0, protein: entry.protein, carbs: entry.carbs, fat: entry.fat, fiber: entry.fiber },
            });
            onClose();
          }}
        >
          שמירה
        </Button>
        <Button
          variant="ghost"
          fullWidth
          className="text-danger"
          icon={<Trash2 aria-hidden className="size-4" />}
          onClick={async () => {
            await deleteFoodLog(entry.id);
            onClose();
          }}
        >
          מחיקה מהיומן
        </Button>
      </div>
    </div>
  );
}
