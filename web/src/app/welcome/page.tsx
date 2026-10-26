"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Activity, Dumbbell, Flame, Home, Scale, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Segmented, TextField } from "@/components/ui/field";
import { Panel } from "@/components/ui/surface";
import { OptionCard, StepProgress } from "@/components/onboarding/option-card";
import { applyPlan, updateProfile } from "@/data/repo";
import { logBodyweight } from "@/data/body-repo";
import { saveTargets } from "@/data/nutrition-repo";
import type { ActivityLevel, Goal } from "@/data/types";
import { computeTargets, localDateKey } from "@/lib/nutrition";
import { generatePlan, type EquipmentAccess, type Experience } from "@/lib/plans";
import { formatNumber } from "@/lib/format";

const STEPS = 5;

/** S02/S03: five short questions, then a training plan and daily targets. Skippable at any point. */
export default function WelcomePage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [goal, setGoal] = useState<Goal>("build_muscle");
  const [experience, setExperience] = useState<Experience>("beginner");
  const [days, setDays] = useState(3);
  const [equipment, setEquipment] = useState<EquipmentAccess>("gym");
  const [sex, setSex] = useState<"male" | "female">("male");
  const [age, setAge] = useState("30");
  const [height, setHeight] = useState("175");
  const [weight, setWeight] = useState("75");
  const [activity, setActivity] = useState<ActivityLevel>("moderate");
  const [saving, setSaving] = useState(false);

  const n = (s: string) => Number(s.replace(",", ".")) || 0;
  const bodyValid = n(age) >= 14 && n(age) <= 100 && n(height) >= 120 && n(height) <= 230 && n(weight) >= 35 && n(weight) <= 300;
  const plan = generatePlan({ days, equipment, experience, goal });
  const targets = bodyValid ? computeTargets({ sex, age: n(age), heightCm: n(height), weightKg: n(weight), activity, goal, pace: "normal" }) : null;

  const skip = async () => {
    await updateProfile({ onboardedAt: new Date().toISOString() });
    router.replace("/");
  };

  const finish = async () => {
    if (!targets) return;
    setSaving(true);
    await applyPlan(plan.templates);
    await saveTargets({
      effectiveFrom: localDateKey(),
      calories: targets.calories,
      protein: targets.protein,
      carbs: targets.carbs,
      fat: targets.fat,
      fiber: targets.fiber,
      method: "wizard",
      inputs: { sex, age: n(age), heightCm: n(height), weightKg: n(weight), activity, goal, pace: "normal" },
    });
    await logBodyweight(n(weight));
    await updateProfile({ goal, sex, daysPerWeek: days, onboardedAt: new Date().toISOString() });
    router.replace("/");
  };

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-(--layout-max-width) flex-col gap-6 px-4 pt-[calc(1.5rem+env(safe-area-inset-top))] pb-10">
      <div className="flex items-center justify-between">
        <StepProgress step={Math.min(step, STEPS)} total={STEPS} />
        <button type="button" onClick={() => void skip()} className="text-sm text-text-muted hover:text-text">
          דילוג
        </button>
      </div>

      {step === 1 && (
        <section aria-labelledby="q1" className="flex flex-col gap-3">
          <h1 id="q1" className="text-[1.75rem] leading-tight font-bold tracking-tight">
            מה המטרה העיקרית?
          </h1>
          <div role="radiogroup" aria-labelledby="q1" className="flex flex-col gap-2">
            {(
              [
                ["build_muscle", "בניית שריר", "לעלות במסת שריר", Dumbbell],
                ["lose_fat", "ירידה בשומן", "לרדת במשקל ולשמור על השריר", Flame],
                ["strength", "כוח", "להרים יותר משקל", Activity],
                ["maintain", "כושר ובריאות", "לשמור על מה שיש ולהרגיש טוב", User],
              ] as const
            ).map(([v, t, b, Icon]) => (
              <OptionCard key={v} selected={goal === v} onSelect={() => setGoal(v)} title={t} body={b} icon={<Icon aria-hidden className="size-5" />} />
            ))}
          </div>
        </section>
      )}

      {step === 2 && (
        <section aria-labelledby="q2" className="flex flex-col gap-3">
          <h1 id="q2" className="text-[1.75rem] leading-tight font-bold tracking-tight">
            כמה ניסיון יש לך באימוני כוח?
          </h1>
          <div role="radiogroup" aria-labelledby="q2" className="flex flex-col gap-2">
            {(
              [
                ["beginner", "מתחיל", "פחות משנה, או חוזר אחרי הפסקה"],
                ["intermediate", "בינוני", "שנה עד שלוש של אימונים קבועים"],
                ["advanced", "מתקדם", "יותר משלוש שנים"],
              ] as const
            ).map(([v, t, b]) => (
              <OptionCard key={v} selected={experience === v} onSelect={() => setExperience(v)} title={t} body={b} />
            ))}
          </div>
        </section>
      )}

      {step === 3 && (
        <section aria-labelledby="q3" className="flex flex-col gap-4">
          <h1 id="q3" className="text-[1.75rem] leading-tight font-bold tracking-tight">
            כמה פעמים בשבוע?
          </h1>
          <Segmented label="אימונים בשבוע" value={String(days)} onChange={(v) => setDays(Number(v))} fullWidth options={["2", "3", "4", "5", "6"].map((v) => ({ value: v, label: v }))} />
          <p className="text-sm text-text-muted">עדיף מספר שאפשר לעמוד בו כל שבוע על פני מספר גבוה לשבועיים.</p>
        </section>
      )}

      {step === 4 && (
        <section aria-labelledby="q4" className="flex flex-col gap-3">
          <h1 id="q4" className="text-[1.75rem] leading-tight font-bold tracking-tight">
            איפה מתאמנים?
          </h1>
          <div role="radiogroup" aria-labelledby="q4" className="flex flex-col gap-2">
            {(
              [
                ["gym", "חדר כושר", "מוטות, מכונות וכבלים", Dumbbell],
                ["dumbbells", "בבית עם משקולות יד", "זוג משקולות וספסל אם יש", Home],
                ["bodyweight", "בלי ציוד", "משקל גוף בלבד", User],
              ] as const
            ).map(([v, t, b, Icon]) => (
              <OptionCard key={v} selected={equipment === v} onSelect={() => setEquipment(v)} title={t} body={b} icon={<Icon aria-hidden className="size-5" />} />
            ))}
          </div>
        </section>
      )}

      {step === 5 && (
        <section aria-labelledby="q5" className="flex flex-col gap-4">
          <h1 id="q5" className="text-[1.75rem] leading-tight font-bold tracking-tight">
            קצת עליך
          </h1>
          <p className="-mt-2 text-sm text-text-muted">לחישוב יעדי הקלוריות והחלבון, ולציון הכוח. נשמר בטלפון בלבד.</p>
          <Segmented label="מין" value={sex} onChange={setSex} fullWidth options={[{ value: "male", label: "גבר" }, { value: "female", label: "אישה" }]} />
          <div className="grid grid-cols-3 gap-2">
            <TextField label="גיל" inputMode="numeric" value={age} onChange={(e) => setAge(e.target.value.replace(/\D/g, ""))} />
            <TextField label="גובה" inputMode="numeric" suffix="ס״מ" value={height} onChange={(e) => setHeight(e.target.value.replace(/\D/g, ""))} />
            <TextField label="משקל" inputMode="decimal" suffix="ק״ג" value={weight} onChange={(e) => setWeight(e.target.value.replace(/[^\d.,]/g, ""))} />
          </div>
          <Segmented
            label="תנועה ביום רגיל"
            value={activity}
            onChange={setActivity}
            fullWidth
            options={[
              { value: "sedentary", label: "מעט" },
              { value: "light", label: "קצת" },
              { value: "moderate", label: "פעיל" },
              { value: "active", label: "הרבה" },
            ]}
          />
        </section>
      )}

      {step === 6 && targets && (
        <section aria-labelledby="plan" className="flex flex-col gap-4">
          <h1 id="plan" className="text-[1.75rem] leading-tight font-bold tracking-tight">
            התוכנית שלך
          </h1>
          <Panel className="flex flex-col gap-3">
            <div className="flex items-center gap-2 text-sm text-text-muted">
              <Dumbbell aria-hidden className="size-4" />
              {plan.summary}
            </div>
            <ul className="flex flex-col gap-3">
              {plan.templates.map((t) => (
                <li key={t.name}>
                  <span className="font-semibold">{t.name}</span>
                  <p className="text-sm text-text-muted">{t.items.length} תרגילים</p>
                </li>
              ))}
            </ul>
          </Panel>
          <Panel className="flex flex-col gap-2">
            <div className="flex items-center gap-2 text-sm text-text-muted">
              <Scale aria-hidden className="size-4" />
              יעד יומי
            </div>
            <span className="figure text-[2.25rem] leading-none">
              <bdi dir="ltr">{formatNumber(targets.calories, 0)}</bdi> <span className="text-sm font-normal text-text-muted">קלוריות</span>
            </span>
            <span className="text-sm text-text-muted">
              חלבון {targets.protein} ג׳, פחמימות {targets.carbs} ג׳, שומן {targets.fat} ג׳
            </span>
          </Panel>
          <p className="text-sm text-text-subtle">אפשר לשנות הכול אחר כך: את התבניות במסך האימונים, ואת היעדים בתזונה.</p>
        </section>
      )}

      <div className="mt-auto flex gap-2">
        {step > 1 && (
          <Button variant="secondary" size="lg" onClick={() => setStep((s) => s - 1)}>
            חזרה
          </Button>
        )}
        {step < 6 ? (
          <Button size="lg" className="flex-1" disabled={step === 5 && !bodyValid} onClick={() => setStep((s) => s + 1)}>
            {step === 5 ? "לתוכנית" : "המשך"}
          </Button>
        ) : (
          <Button size="lg" className="flex-1" loading={saving} onClick={() => void finish()}>
            מתחילים
          </Button>
        )}
      </div>
    </main>
  );
}
