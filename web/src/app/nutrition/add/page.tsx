"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Camera, Plus } from "lucide-react";
import { AppShell } from "@/components/app/app-shell";
import { Button } from "@/components/ui/button";
import { SearchField, Segmented, TextField } from "@/components/ui/field";
import { Skeleton } from "@/components/ui/surface";
import { useToast } from "@/components/ui/toast";
import { MealPicker } from "@/components/nutrition/controls";
import { AmountSheet } from "@/components/nutrition/sheets";
import { logCustom, logFood, searchFoods } from "@/data/nutrition-repo";
import { MEAL_LABEL, type Food, type Meal } from "@/data/types";
import { localDateKey, mealForTime } from "@/lib/nutrition";
import { formatNumber } from "@/lib/format";

function SearchTab({ date, meal, setMeal }: { date: string; meal: Meal; setMeal: (m: Meal) => void }) {
  const toast = useToast();
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<Food | null>(null);
  const results = useLiveQuery(() => searchFoods(query), [query]);

  return (
    <>
      <SearchField value={query} onChange={setQuery} placeholder="מה אכלת? למשל קוטג׳, פיתה, שניצל" label="חיפוש מזון" />
      {!results ? (
        <Skeleton className="h-72 rounded-lg" />
      ) : results.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <p className="text-sm text-text-muted">„{query}” עוד לא במאגר.</p>
          <div className="flex gap-2">
            <Link href={`/nutrition/photo?date=${date}&meal=${meal}`} className="glass inline-flex h-10 items-center gap-1.5 rounded-pill px-4 text-sm font-medium">
              <Camera aria-hidden className="size-4" />
              צילום במקום
            </Link>
            <Link href={`/nutrition/add?date=${date}&meal=${meal}&tab=quick&name=${encodeURIComponent(query)}`} className="glass inline-flex h-10 items-center rounded-pill px-4 text-sm font-medium">
              הוספה מהירה
            </Link>
          </div>
        </div>
      ) : (
        <>
          {!query && <h2 className="px-1 text-sm text-text-muted">אחרונים ומומלצים</h2>}
          <ul className="glass flex flex-col rounded-lg" aria-label="תוצאות">
            {results.map((f, i) => {
              const serving = f.servings[0];
              const kcal = serving ? Math.round((f.per100.kcal * serving.grams) / 100) : Math.round(f.per100.kcal);
              return (
                <li key={f.id}>
                  {i > 0 && <span aria-hidden className="mx-4 block h-px bg-border" />}
                  <button type="button" onClick={() => setPicked(f)} className="flex w-full items-center gap-3 px-4 py-3 text-start">
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate font-medium">{f.nameHe}</span>
                      <span className="num text-sm text-text-subtle">
                        {formatNumber(kcal, 0)} קלוריות ב{serving ? `${serving.nameHe} (${serving.grams} ג׳)` : "-100 גרם"}
                        {f.brand ? `, ${f.brand}` : ""}
                      </span>
                    </span>
                    <span className="well flex size-9 shrink-0 items-center justify-center rounded-pill">
                      <Plus aria-hidden className="size-4" />
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}
      <AmountSheet
        food={picked}
        meal={meal}
        onMealChange={setMeal}
        onClose={() => setPicked(null)}
        onAdd={async (grams) => {
          if (!picked) return;
          await logFood({ date, meal, food: picked, grams });
          toast({ tone: "success", message: `${picked.nameHe} נוסף ל${MEAL_LABEL[meal]}` });
          setPicked(null);
        }}
      />
    </>
  );
}

function QuickTab({ date, meal, setMeal, initialName }: { date: string; meal: Meal; setMeal: (m: Meal) => void; initialName: string }) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [kcal, setKcal] = useState("");
  const [protein, setProtein] = useState("");
  const [carbs, setCarbs] = useState("");
  const [fat, setFat] = useState("");
  const num = (s: string) => Number(s.replace(",", ".")) || 0;
  const digits = (s: string) => s.replace(/[^\d.,]/g, "");

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!num(kcal)) return;
        await logCustom({ date, meal, nameHe: name || "הוספה מהירה", macros: { kcal: num(kcal), protein: num(protein), carbs: num(carbs), fat: num(fat), fiber: null }, source: "quick" });
        router.replace(`/nutrition?date=${date}`);
      }}
    >
      <p className="text-sm text-text-muted">כשיודעים את המספרים, למשל מהתווית או מהתפריט.</p>
      <TextField label="מה זה?" value={name} onChange={(e) => setName(e.target.value)} placeholder="למשל: סלט במסעדה" maxLength={80} />
      <TextField label="קלוריות" inputMode="decimal" value={kcal} onChange={(e) => setKcal(digits(e.target.value))} suffix="קק״ל" required />
      <div className="grid grid-cols-3 gap-2">
        <TextField label="חלבון" inputMode="decimal" value={protein} onChange={(e) => setProtein(digits(e.target.value))} suffix="ג׳" />
        <TextField label="פחמימות" inputMode="decimal" value={carbs} onChange={(e) => setCarbs(digits(e.target.value))} suffix="ג׳" />
        <TextField label="שומן" inputMode="decimal" value={fat} onChange={(e) => setFat(digits(e.target.value))} suffix="ג׳" />
      </div>
      <MealPicker value={meal} onChange={setMeal} />
      <Button type="submit" size="lg" fullWidth disabled={!num(kcal)}>
        הוספה ל{MEAL_LABEL[meal]}
      </Button>
    </form>
  );
}

function Add() {
  const params = useSearchParams();
  const date = params.get("date") ?? localDateKey();
  const [meal, setMeal] = useState<Meal>((params.get("meal") as Meal) || mealForTime());
  const [tab, setTab] = useState<"search" | "quick">(params.get("tab") === "quick" ? "quick" : "search");

  return (
    <>
      <Segmented
        label="אופן ההוספה"
        value={tab}
        onChange={setTab}
        fullWidth
        options={[
          { value: "search", label: "חיפוש במאגר" },
          { value: "quick", label: "הוספה מהירה" },
        ]}
      />
      {tab === "search" ? (
        <SearchTab date={date} meal={meal} setMeal={setMeal} />
      ) : (
        <QuickTab date={date} meal={meal} setMeal={setMeal} initialName={params.get("name") ?? ""} />
      )}
    </>
  );
}

export default function AddFoodPage() {
  return (
    <AppShell title="הוספת אוכל" back={{ href: "/nutrition", label: "תזונה" }} bottomSpace={false}>
      <Suspense fallback={<Skeleton className="h-96 rounded-lg" />}>
        <Add />
      </Suspense>
    </AppShell>
  );
}
