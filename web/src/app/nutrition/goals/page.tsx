"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { AppShell } from "@/components/app/app-shell";
import { Button } from "@/components/ui/button";
import { Segmented, TextField } from "@/components/ui/field";
import { Banner, Panel, Skeleton } from "@/components/ui/surface";
import { OptionCard } from "@/components/onboarding/option-card";
import { getLatestTarget, saveTargets } from "@/data/nutrition-repo";
import { updateProfile } from "@/data/repo";
import { logBodyweight } from "@/data/body-repo";
import type { ActivityLevel, Goal, Pace, TargetInputs } from "@/data/types";
import { computeTargets, localDateKey } from "@/lib/nutrition";
import { formatNumber } from "@/lib/format";

const ACTIVITY: { v: ActivityLevel; t: string; b: string }[] = [
  { v: "sedentary", t: "רוב היום בישיבה", b: "עבודה משרדית, מעט הליכה" },
  { v: "light", t: "קצת תנועה", b: "1–2 אימונים בשבוע או הליכות" },
  { v: "moderate", t: "פעיל", b: "3–4 אימונים בשבוע" },
  { v: "active", t: "פעיל מאוד", b: "5–6 אימונים בשבוע" },
  { v: "very_active", t: "עבודה פיזית ואימונים", b: "אימונים כמעט כל יום ועבודה פיזית" },
];

const GOALS: { v: Goal; t: string }[] = [
  { v: "lose_fat", t: "ירידה בשומן" },
  { v: "maintain", t: "שמירה על המשקל" },
  { v: "build_muscle", t: "עלייה במסת שריר" },
];

const PACE_LABEL: Record<Goal, Record<Pace, string>> = {
  lose_fat: { slow: "עדין", normal: "רגיל", fast: "מהיר" },
  build_muscle: { slow: "נקי", normal: "רגיל", fast: "מהיר" },
  maintain: { slow: "", normal: "", fast: "" },
  strength: { slow: "עדין", normal: "רגיל", fast: "מהיר" },
};

export default function GoalsPage() {
  const router = useRouter();
  const latest = useLiveQuery(async () => (await getLatestTarget()) ?? null, []);
  const [inputs, setInputs] = useState<TargetInputs>({ sex: "male", age: 30, heightCm: 175, weightKg: 75, activity: "moderate", goal: "maintain", pace: "normal" });
  const [saving, setSaving] = useState(false);

  // Start from the last wizard answers, once they load.
  const [seeded, setSeeded] = useState(false);
  useEffect(() => {
    if (latest === undefined || seeded) return;
    // Deferred so it is not a synchronous setState inside the effect body.
    const t = setTimeout(() => {
      if (latest?.inputs) setInputs(latest.inputs);
      setSeeded(true);
    }, 0);
    return () => clearTimeout(t);
  }, [latest, seeded]);

  const valid = inputs.age >= 14 && inputs.age <= 100 && inputs.heightCm >= 120 && inputs.heightCm <= 230 && inputs.weightKg >= 35 && inputs.weightKg <= 300;
  const r = valid ? computeTargets(inputs) : null;
  const set = <K extends keyof TargetInputs>(k: K, v: TargetInputs[K]) => setInputs((x) => ({ ...x, [k]: v }));
  const numField = (k: "age" | "heightCm" | "weightKg", label: string, suffix: string) => (
    <TextField
      label={label}
      inputMode="decimal"
      suffix={suffix}
      value={Number.isFinite(inputs[k]) && inputs[k] > 0 ? String(inputs[k]) : ""}
      onChange={(e) => set(k, Number(e.target.value.replace(",", ".")) || 0)}
    />
  );

  return (
    <AppShell title="יעדים יומיים" subtitle="מחושבים לפי הגוף, הפעילות והמטרה שלך" back={{ href: "/nutrition", label: "תזונה" }} bottomSpace={false}>
      {latest === undefined ? (
        <Skeleton className="h-96 rounded-xl" />
      ) : (
        <>
          <Panel className="flex flex-col gap-4">
            <Segmented
              label="מין"
              value={inputs.sex}
              onChange={(v) => set("sex", v)}
              fullWidth
              options={[
                { value: "male", label: "גבר" },
                { value: "female", label: "אישה" },
              ]}
            />
            <div className="grid grid-cols-3 gap-2">
              {numField("age", "גיל", "שנים")}
              {numField("heightCm", "גובה", "ס״מ")}
              {numField("weightKg", "משקל", "ק״ג")}
            </div>
          </Panel>

          <section aria-labelledby="activity" className="flex flex-col gap-2">
            <h2 id="activity" className="px-1 text-lg">
              כמה תנועה ביום רגיל?
            </h2>
            <div role="radiogroup" aria-labelledby="activity" className="flex flex-col gap-2">
              {ACTIVITY.map((a) => (
                <OptionCard key={a.v} selected={inputs.activity === a.v} onSelect={() => set("activity", a.v)} title={a.t} body={a.b} />
              ))}
            </div>
          </section>

          <section aria-labelledby="goal" className="flex flex-col gap-2">
            <h2 id="goal" className="px-1 text-lg">
              מה המטרה?
            </h2>
            <div role="radiogroup" aria-labelledby="goal" className="flex flex-col gap-2">
              {GOALS.map((g) => (
                <OptionCard key={g.v} selected={inputs.goal === g.v} onSelect={() => set("goal", g.v)} title={g.t} />
              ))}
            </div>
            {inputs.goal !== "maintain" && (
              <Segmented
                label="קצב"
                value={inputs.pace}
                onChange={(v) => set("pace", v)}
                fullWidth
                options={(["slow", "normal", "fast"] as Pace[]).map((p) => ({ value: p, label: PACE_LABEL[inputs.goal][p] }))}
              />
            )}
          </section>

          {r ? (
            <Panel className="flex flex-col gap-4 rounded-xl">
              <div className="flex items-baseline justify-between">
                <span className="text-sm text-text-muted">יעד יומי</span>
                <span className="figure text-[2.5rem] leading-none">
                  <bdi dir="ltr">{formatNumber(r.calories, 0)}</bdi>
                  <span className="ms-1.5 text-sm font-normal text-text-muted">קלוריות</span>
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                {(
                  [
                    ["חלבון", r.protein, "text-macro-protein"],
                    ["פחמימות", r.carbs, "text-macro-carbs"],
                    ["שומן", r.fat, "text-macro-fat"],
                  ] as const
                ).map(([l, v, c]) => (
                  <div key={l} className="well rounded-md py-3">
                    <div className={`text-sm font-semibold ${c}`}>{l}</div>
                    <div className="figure text-xl">{v}ג׳</div>
                  </div>
                ))}
              </div>
              <p className="text-sm leading-relaxed text-text-muted">
                חילוף חומרים במנוחה כ-<bdi dir="ltr">{formatNumber(r.bmr, 0)}</bdi> קלוריות (נוסחת Mifflin-St Jeor). עם הפעילות שלך: כ-
                <bdi dir="ltr">{formatNumber(r.tdee, 0)}</bdi> ביום.
                {inputs.goal === "lose_fat" && " היעד מתחת לזה, כדי לרדת בשומן בהדרגה."}
                {inputs.goal === "build_muscle" && " היעד מעל זה, כדי לבנות שריר."}
                {" "}חלבון גבוה כדי לשמור ולבנות שריר; סיבים: כ-{r.fiber} גרם.
              </p>
              {r.floored && <Banner tone="warning">היעד הוגבל למינימום בטוח. קצב איטי יותר יהיה בריא יותר.</Banner>}
              <p className="text-xs text-text-subtle">זו הערכה כללית ולא ייעוץ רפואי. בהיריון, במחלה או בהפרעת אכילה, כדאי להתייעץ עם דיאטנית.</p>
            </Panel>
          ) : (
            <Banner tone="info">צריך להזין גיל, גובה ומשקל כדי לחשב.</Banner>
          )}

          <Button
            size="lg"
            fullWidth
            disabled={!r}
            loading={saving}
            onClick={async () => {
              if (!r) return;
              setSaving(true);
              await saveTargets({ effectiveFrom: localDateKey(), calories: r.calories, protein: r.protein, carbs: r.carbs, fat: r.fat, fiber: r.fiber, method: "wizard", inputs });
              await updateProfile({ goal: inputs.goal, sex: inputs.sex });
              await logBodyweight(inputs.weightKg);
              router.replace("/nutrition");
            }}
          >
            שמירת היעדים
          </Button>
        </>
      )}
    </AppShell>
  );
}
