"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/app/app-shell";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/surface";
import { TextField } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { getJourney, saveJourney } from "@/data/journey-repo";
import { shekel } from "@/lib/journey/business";

const n = (s: string) => {
  const v = Number(s.replace(/[,\s₪]/g, ""));
  return Number.isFinite(v) && v >= 0 ? v : 0;
};

/** The money picture: savings, what a month costs, and the goals for income and price. */
export default function MoneyPage() {
  const router = useRouter();
  const toast = useToast();
  const [f, setF] = useState({ savings: "", rent: "", bills: "", food: "", other: "", incomeGoal: "", priceTarget: "" });
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    void getJourney().then((j) => {
      if (j) {
        const s = (v: number | null) => (v ? String(v) : "");
        setF({ savings: s(j.savings), rent: s(j.monthly.rent), bills: s(j.monthly.bills), food: s(j.monthly.food), other: s(j.monthly.other), incomeGoal: s(j.incomeGoal), priceTarget: s(j.priceTarget) });
      }
      setLoaded(true);
    });
  }, []);

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF((p) => ({ ...p, [k]: e.target.value }));
  const total = n(f.rent) + n(f.bills) + n(f.food) + n(f.other);

  const save = async () => {
    await saveJourney({
      savings: f.savings ? n(f.savings) : null,
      monthly: { rent: n(f.rent), bills: n(f.bills), food: n(f.food), other: n(f.other) },
      incomeGoal: f.incomeGoal ? n(f.incomeGoal) : null,
      priceTarget: f.priceTarget ? n(f.priceTarget) : null,
    });
    toast({ tone: "success", message: "נשמר" });
    router.push("/business");
  };

  return (
    <AppShell back={{ href: "/business", label: "העסק" }} eyebrow="כסף" title="המספרים של החיים" subtitle="מספרים אמיתיים. ההחלטה על דירה, מחיר ושעות עבודה מתחילה כאן." bottomSpace={false}>
      {loaded && (
        <>
          <Panel className="flex flex-col gap-5">
            <TextField label="חסכונות" hint="כולל מענקים ופיקדון שחרור" inputMode="numeric" value={f.savings} onChange={set("savings")} suffix="₪" />
          </Panel>
          <Panel className="flex flex-col gap-5">
            <span className="eyebrow">הוצאות בחודש</span>
            <TextField label="שכירות" inputMode="numeric" value={f.rent} onChange={set("rent")} suffix="₪" />
            <TextField label="חשבונות (ארנונה, חשמל, מים, אינטרנט, טלפון)" inputMode="numeric" value={f.bills} onChange={set("bills")} suffix="₪" />
            <TextField label="אוכל" inputMode="numeric" value={f.food} onChange={set("food")} suffix="₪" />
            <TextField label="אחר (נסיעות, חדר כושר, ציוד)" inputMode="numeric" value={f.other} onChange={set("other")} suffix="₪" />
            <div className="hairline" />
            <div className="flex items-baseline justify-between">
              <span className="text-sm text-text-muted">סה״כ בחודש</span>
              <span className="figure text-2xl">{shekel(total)}</span>
            </div>
          </Panel>
          <Panel className="flex flex-col gap-5">
            <span className="eyebrow">יעדים</span>
            <TextField label="יעד הכנסה חודשי" inputMode="numeric" value={f.incomeGoal} onChange={set("incomeGoal")} suffix="₪" />
            <TextField label="המחיר שאתה הולך אליו לתספורת" inputMode="numeric" value={f.priceTarget} onChange={set("priceTarget")} suffix="₪" />
          </Panel>
          <Button size="lg" fullWidth onClick={() => void save()}>
            שמירה
          </Button>
        </>
      )}
    </AppShell>
  );
}
