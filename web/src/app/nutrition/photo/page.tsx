"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useRef, useState } from "react";
import { Camera, ImagePlus, RotateCcw, Sparkles, Trash2 } from "lucide-react";
import { AppShell } from "@/components/app/app-shell";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/field";
import { Banner, Panel, Skeleton } from "@/components/ui/surface";
import { GramsStepper, MacroLine, MealPicker } from "@/components/nutrition/controls";
import { logPhotoMeal } from "@/data/nutrition-repo";
import { MEAL_LABEL, type Meal } from "@/data/types";
import { analyzeMealPhoto } from "@/lib/food-ai";
import { resizeImage } from "@/lib/image";
import { localDateKey, mealForTime } from "@/lib/nutrition";
import type { FoodPhotoError, FoodPhotoItem } from "@/lib/food-photo-schema";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/cn";

type Item = FoodPhotoItem & { key: string; baseGrams: number; base: Pick<FoodPhotoItem, "kcal" | "protein_g" | "carbs_g" | "fat_g"> };

const ERROR_TEXT: Record<FoodPhotoError | "network" | "not_food", string> = {
  not_configured: "זיהוי מתמונה עוד לא הופעל: צריך להגדיר מפתח API בשרת. בינתיים אפשר להוסיף מהחיפוש.",
  bad_key: "מפתח ה-API בשרת לא תקין. צריך לבדוק אותו בהגדרות של השרת.",
  unauthorized: "קוד הגישה של האפליקציה חסר או שגוי. אפשר להזין אותו בפרופיל.",
  bad_request: "התמונה לא נשלחה כמו שצריך. אפשר לנסות תמונה אחרת.",
  refused: "לא ניתן לנתח את התמונה הזו. אפשר לנסות תמונה אחרת או להוסיף מהחיפוש.",
  unreadable: "לא הצלחנו לקרוא את התוצאה. אפשר לנסות שוב.",
  busy: "יותר מדי בקשות כרגע. אפשר לנסות שוב בעוד דקה.",
  upstream: "שירות הזיהוי לא זמין כרגע. אפשר לנסות שוב או להוסיף מהחיפוש.",
  not_allowed: "כדי לזהות אוכל מתמונה צריך לאשר לאפליקציה להשתמש ב-Claude. אפשר לנסות שוב ולאשר בחלון שנפתח.",
  network: "אין חיבור לרשת. זיהוי מתמונה צריך אינטרנט; אפשר להוסיף מהחיפוש גם בלי חיבור.",
  not_food: "לא זוהה אוכל בתמונה. אפשר לצלם שוב, קרוב יותר לצלחת.",
};

const CONFIDENCE: Record<FoodPhotoItem["confidence"], { label: string; className: string }> = {
  high: { label: "בטוח", className: "text-success" },
  medium: { label: "הערכה", className: "text-text-muted" },
  low: { label: "כדאי לבדוק", className: "text-warning" },
};

function PhotoLog() {
  const router = useRouter();
  const params = useSearchParams();
  const date = params.get("date") ?? localDateKey();
  const inputRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  const [meal, setMeal] = useState<Meal>((params.get("meal") as Meal) || mealForTime());
  const [photo, setPhoto] = useState<{ upload: string; thumb: string } | null>(null);
  const [hint, setHint] = useState("");
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [error, setError] = useState<keyof typeof ERROR_TEXT | null>(null);
  const [dish, setDish] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<Item[]>([]);
  const [saving, setSaving] = useState(false);

  const analyse = async (p: { upload: string }, note: string) => {
    setState("loading");
    setError(null);
    const data = await analyzeMealPhoto(p.upload, note);
    if (!data.ok) {
      setError(data.error);
      setState("error");
      return;
    }
    if (!data.result.is_food || data.result.items.length === 0) {
      setError("not_food");
      setState("error");
      return;
    }
    setDish(data.result.dish_name_he);
    setNotes(data.result.notes_he);
    setItems(
      data.result.items.map((i, n) => ({
        ...i,
        key: `${n}-${i.name_he}`,
        baseGrams: i.grams || 100,
        base: { kcal: i.kcal, protein_g: i.protein_g, carbs_g: i.carbs_g, fat_g: i.fat_g },
      })),
    );
    setState("done");
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    const [upload, thumb] = await Promise.all([resizeImage(file, 1280, 0.82), resizeImage(file, 360, 0.75)]);
    const p = { upload, thumb };
    setPhoto(p);
    setItems([]);
    await analyse(p, hint);
  };

  // Changing grams scales that item's numbers from the estimate the model gave.
  const setGrams = (key: string, grams: number) =>
    setItems((all) =>
      all.map((i) => {
        if (i.key !== key) return i;
        const f = i.baseGrams > 0 ? grams / i.baseGrams : 1;
        return {
          ...i,
          grams,
          kcal: Math.round(i.base.kcal * f),
          protein_g: Math.round(i.base.protein_g * f * 10) / 10,
          carbs_g: Math.round(i.base.carbs_g * f * 10) / 10,
          fat_g: Math.round(i.base.fat_g * f * 10) / 10,
        };
      }),
    );

  const total = items.reduce(
    (t, i) => ({ kcal: t.kcal + i.kcal, protein: t.protein + i.protein_g, carbs: t.carbs + i.carbs_g, fat: t.fat + i.fat_g }),
    { kcal: 0, protein: 0, carbs: 0, fat: 0 },
  );

  const save = async () => {
    if (!photo || items.length === 0) return;
    setSaving(true);
    await logPhotoMeal({
      date,
      meal,
      photoDataUrl: photo.thumb,
      items: items.map((i) => ({
        nameHe: i.name_he,
        grams: i.grams,
        macros: { kcal: i.kcal, protein: i.protein_g, carbs: i.carbs_g, fat: i.fat_g, fiber: null },
        confidence: i.confidence,
      })),
    });
    router.replace(`/nutrition?date=${date}`);
  };

  return (
    <>
      <input ref={inputRef} type="file" accept="image/*" capture="environment" className="sr-only" tabIndex={-1} aria-hidden onChange={(e) => void onFile(e.target.files?.[0])} />
      <input ref={galleryRef} type="file" accept="image/*" className="sr-only" tabIndex={-1} aria-hidden onChange={(e) => void onFile(e.target.files?.[0])} />

      {!photo ? (
        <>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="glass flex aspect-[4/3] w-full flex-col items-center justify-center gap-4 rounded-xl text-center"
          >
            <span className="flex size-20 items-center justify-center rounded-pill bg-accent text-on-accent shadow-pop">
              <Camera aria-hidden className="size-9" />
            </span>
            <span className="flex flex-col gap-1">
              <span className="text-lg font-semibold">צילום הארוחה</span>
              <span className="px-8 text-sm text-text-muted">מלמעלה, כל הצלחת בתמונה. נזהה כל מרכיב ונעריך כמות וקלוריות.</span>
            </span>
          </button>
          <Button variant="secondary" fullWidth icon={<ImagePlus aria-hidden className="size-5" />} onClick={() => galleryRef.current?.click()}>
            בחירה מהגלריה
          </Button>
          <TextField label="הערה (לא חובה)" placeholder="למשל: בלי שמן, 2 ביצים" value={hint} onChange={(e) => setHint(e.target.value)} maxLength={300} />
        </>
      ) : (
        <div className="relative overflow-hidden rounded-xl shadow-pop">
          {/* eslint-disable-next-line @next/next/no-img-element -- a local data URL, nothing to optimise */}
          <img src={photo.upload} alt="תמונת הארוחה" className={cn("aspect-[4/3] w-full object-cover", state === "loading" && "scale-[1.02] blur-[1px]")} />
          {state === "loading" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-overlay/25 text-white" role="status">
              <Sparkles aria-hidden className="size-7 animate-pulse" />
              <span className="font-semibold">מזהים את המנה</span>
              <span className="text-sm opacity-85">זה לוקח עד חצי דקה</span>
            </div>
          )}
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="glass-raised absolute end-3 bottom-3 inline-flex h-10 items-center gap-1.5 rounded-pill px-4 text-sm font-semibold"
          >
            <RotateCcw aria-hidden className="size-4" />
            צילום מחדש
          </button>
        </div>
      )}

      {state === "loading" && (
        <div className="flex flex-col gap-2" aria-hidden>
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
        </div>
      )}

      {state === "error" && error && (
        <div className="flex flex-col gap-3">
          <Banner tone={error === "not_food" ? "warning" : "danger"}>{ERROR_TEXT[error]}</Banner>
          <div className="flex gap-2">
            {photo && error !== "not_configured" && (
              <Button variant="secondary" className="flex-1" onClick={() => void analyse(photo, hint)}>
                ניסיון נוסף
              </Button>
            )}
            <Link href={`/nutrition/add?date=${date}&meal=${meal}`} className="flex h-11 flex-1 items-center justify-center rounded-md font-semibold text-accent">
              הוספה מהחיפוש
            </Link>
          </div>
        </div>
      )}

      {state === "done" && (
        <>
          <section aria-labelledby="dish" className="flex flex-col gap-2">
            <h2 id="dish" className="text-2xl font-bold tracking-tight">
              {dish}
            </h2>
            <MacroLine kcal={total.kcal} protein={total.protein} carbs={total.carbs} fat={total.fat} />
            {notes && <p className="text-sm text-text-muted">{notes}</p>}
          </section>

          <ul className="flex flex-col gap-2.5" aria-label="מה זוהה">
            {items.map((i) => (
              <li key={i.key}>
                <Panel className="flex flex-col gap-3 p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      <input
                        aria-label="שם המרכיב"
                        value={i.name_he}
                        onChange={(e) => setItems((all) => all.map((x) => (x.key === i.key ? { ...x, name_he: e.target.value } : x)))}
                        className="w-full bg-transparent font-semibold outline-none"
                      />
                      <MacroLine kcal={i.kcal} protein={i.protein_g} carbs={i.carbs_g} fat={i.fat_g} />
                    </div>
                    <span className={cn("shrink-0 text-xs font-medium", CONFIDENCE[i.confidence].className)}>{CONFIDENCE[i.confidence].label}</span>
                    <button
                      type="button"
                      aria-label={`הסרת ${i.name_he}`}
                      onClick={() => setItems((all) => all.filter((x) => x.key !== i.key))}
                      className="-me-2 -mt-1 flex size-9 items-center justify-center rounded-pill text-text-subtle hover:text-danger"
                    >
                      <Trash2 aria-hidden className="size-4" />
                    </button>
                  </div>
                  <GramsStepper value={i.grams} onChange={(g) => setGrams(i.key, g)} label={`כמות ${i.name_he} בגרם`} />
                </Panel>
              </li>
            ))}
          </ul>

          {items.length === 0 ? (
            <Banner tone="info">הסרת את כל המרכיבים. אפשר לצלם שוב או להוסיף מהחיפוש.</Banner>
          ) : (
            <div className="flex flex-col gap-3">
              <MealPicker value={meal} onChange={setMeal} />
              <Button size="lg" fullWidth loading={saving} onClick={() => void save()}>
                הוספה ל{MEAL_LABEL[meal]}, <bdi dir="ltr">{formatNumber(total.kcal, 0)}</bdi> קלוריות
              </Button>
              <p className="text-center text-xs text-text-subtle">הכמויות והערכים הם הערכה. כדאי לתקן לפני השמירה.</p>
            </div>
          )}
        </>
      )}
    </>
  );
}

export default function PhotoPage() {
  return (
    <AppShell title="צילום ארוחה" back={{ href: "/nutrition", label: "תזונה" }} bottomSpace={false}>
      <Suspense fallback={<Skeleton className="aspect-[4/3] rounded-xl" />}>
        <PhotoLog />
      </Suspense>
    </AppShell>
  );
}
