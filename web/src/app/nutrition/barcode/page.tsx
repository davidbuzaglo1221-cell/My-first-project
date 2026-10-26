"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { ScanLine } from "lucide-react";
import { AppShell } from "@/components/app/app-shell";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/field";
import { Banner, Skeleton } from "@/components/ui/surface";
import { AmountSheet } from "@/components/nutrition/sheets";
import { createFood, getFoodByBarcode, logFood } from "@/data/nutrition-repo";
import type { Food, Meal } from "@/data/types";
import { lookupBarcode } from "@/lib/openfoodfacts";
import { localDateKey, mealForTime } from "@/lib/nutrition";

// BarcodeDetector is in Chrome on Android, not yet in Safari on iPhone: typing the number is the fallback.
type Detector = { detect: (source: CanvasImageSource) => Promise<{ rawValue: string }[]> };
declare global {
  interface Window {
    BarcodeDetector?: new (opts: { formats: string[] }) => Detector;
  }
}

type Status = "idle" | "looking" | "not_found" | "error";

function Scanner() {
  const router = useRouter();
  const params = useSearchParams();
  const date = params.get("date") ?? localDateKey();
  const [meal, setMeal] = useState<Meal>((params.get("meal") as Meal) || mealForTime());
  const videoRef = useRef<HTMLVideoElement>(null);
  const [camera, setCamera] = useState<"off" | "on" | "unsupported" | "denied">("off");
  const [code, setCode] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [food, setFood] = useState<Food | null>(null);
  const [newFood, setNewFood] = useState({ name: "", kcal: "", protein: "", carbs: "", fat: "" });

  const find = useCallback(async (barcode: string) => {
    const clean = barcode.replace(/\D/g, "");
    if (clean.length < 8) return;
    setCode(clean);
    setStatus("looking");
    try {
      const local = await getFoodByBarcode(clean);
      if (local) {
        setFood(local);
        setStatus("idle");
        return;
      }
      const p = await lookupBarcode(clean);
      if (!p) {
        setStatus("not_found");
        return;
      }
      setFood(await createFood({ ...p, barcode: clean, source: "openfoodfacts" }));
      setStatus("idle");
    } catch {
      setStatus("error");
    }
  }, []);

  // Camera scanning loop, only where BarcodeDetector exists.
  useEffect(() => {
    if (camera !== "on") return;
    let stream: MediaStream | null = null;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    const detector = new window.BarcodeDetector!({ formats: ["ean_13", "ean_8", "upc_a", "upc_e"] });
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        if (!videoRef.current || stopped) return;
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        const tick = async () => {
          if (stopped || !videoRef.current) return;
          const found = await detector.detect(videoRef.current).catch(() => []);
          if (found[0]?.rawValue) {
            navigator.vibrate?.(60);
            setCamera("off");
            void find(found[0].rawValue);
            return;
          }
          timer = setTimeout(tick, 250);
        };
        void tick();
      } catch {
        setCamera("denied");
      }
    })();
    return () => {
      stopped = true;
      clearTimeout(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [camera, find]);

  const num = (s: string) => Number(s.replace(",", ".")) || 0;

  return (
    <>
      {camera === "on" ? (
        <div className="relative overflow-hidden rounded-xl bg-overlay">
          <video ref={videoRef} muted playsInline className="aspect-[4/3] w-full object-cover" aria-label="מצלמה לסריקת ברקוד" />
          <div aria-hidden className="pointer-events-none absolute inset-x-10 top-1/2 h-0.5 -translate-y-1/2 rounded-pill bg-success shadow-[0_0_12px_var(--c-success)]" />
          <button type="button" onClick={() => setCamera("off")} className="glass-raised absolute end-3 bottom-3 h-10 rounded-pill px-4 text-sm font-semibold">
            סגירה
          </button>
        </div>
      ) : (
        <Button
          size="lg"
          fullWidth
          icon={<ScanLine aria-hidden className="size-5" />}
          onClick={() => setCamera(typeof window !== "undefined" && window.BarcodeDetector ? "on" : "unsupported")}
        >
          סריקה במצלמה
        </Button>
      )}
      {camera === "unsupported" && <Banner tone="info">הדפדפן הזה לא סורק ברקודים במצלמה. אפשר להקליד את המספר שמתחת לפסים.</Banner>}
      {camera === "denied" && <Banner tone="warning">אין גישה למצלמה. אפשר לאשר בהגדרות הדפדפן, או להקליד את המספר.</Banner>}

      <form
        className="flex items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void find(code);
        }}
      >
        <TextField className="flex-1" label="מספר הברקוד" inputMode="numeric" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} placeholder="7290000000000" maxLength={14} />
        <Button type="submit" size="lg" disabled={code.length < 8} loading={status === "looking"}>
          חיפוש
        </Button>
      </form>

      {status === "error" && <Banner tone="danger">החיפוש נכשל. צריך חיבור לרשת כדי לחפש מוצר חדש.</Banner>}
      {status === "not_found" && (
        <form
          className="glass flex flex-col gap-4 rounded-lg p-5"
          onSubmit={async (e) => {
            e.preventDefault();
            const f = await createFood({
              nameHe: newFood.name,
              barcode: code,
              per100: { kcal: num(newFood.kcal), protein: num(newFood.protein), carbs: num(newFood.carbs), fat: num(newFood.fat), fiber: null },
            });
            setStatus("idle");
            setFood(f);
          }}
        >
          <div>
            <h2 className="text-lg">המוצר עוד לא במאגר</h2>
            <p className="text-sm text-text-muted">אפשר להוסיף אותו מהתווית (ערכים ל-100 גרם). בפעם הבאה הוא יימצא מיד.</p>
          </div>
          <TextField label="שם המוצר" value={newFood.name} onChange={(e) => setNewFood({ ...newFood, name: e.target.value })} required maxLength={80} />
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                ["kcal", "קלוריות"],
                ["protein", "חלבון"],
                ["carbs", "פחמימות"],
                ["fat", "שומן"],
              ] as const
            ).map(([k, label]) => (
              <TextField key={k} label={label} inputMode="decimal" value={newFood[k]} onChange={(e) => setNewFood({ ...newFood, [k]: e.target.value.replace(/[^\d.,]/g, "") })} required={k === "kcal"} />
            ))}
          </div>
          <Button type="submit" fullWidth disabled={!newFood.name.trim() || !num(newFood.kcal)}>
            שמירת המוצר
          </Button>
        </form>
      )}

      <p className="text-xs text-text-subtle">מוצרים חדשים נמצאים ב-Open Food Facts, מאגר פתוח (רישיון ODbL). אחרי פעם אחת הם נשמרים בטלפון.</p>

      <AmountSheet
        food={food}
        meal={meal}
        onMealChange={setMeal}
        onClose={() => setFood(null)}
        onAdd={async (grams) => {
          if (!food) return;
          await logFood({ date, meal, food, grams, source: "barcode" });
          router.replace(`/nutrition?date=${date}`);
        }}
      />
    </>
  );
}

export default function BarcodePage() {
  return (
    <AppShell title="ברקוד" back={{ href: "/nutrition", label: "תזונה" }} bottomSpace={false}>
      <Suspense fallback={<Skeleton className="h-60 rounded-xl" />}>
        <Scanner />
      </Suspense>
    </AppShell>
  );
}
