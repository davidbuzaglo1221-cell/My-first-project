import { estimateOneRepMax } from "./format";

// Strength Score, our own and fully transparent (replica/architecture.md, "נוסחאות").
//
// 1. For each key lift, take the best estimated 1RM (Epley, 1–12 reps, no warmups) in the
//    last 6 weeks, divided by bodyweight. Dumbbell lifts count the weight in one hand.
// 2. Compare that ratio with the lift's "intermediate" standard: standard = 300 points.
//    Women's standards are 65% of men's for upper body, 75% for lower body.
// 3. A muscle group scores its best lift; the total is a weighted average of the groups
//    that have data (legs and back count most), so a missing group never drags it down.
// 4. The weekly change is explained: which lift moved the score, or a bodyweight change.
//
// The 6-week window means one weak session cannot lower the score.

export type ScoreGroup = "legs" | "chest" | "back" | "shoulders" | "arms";

export const GROUP_LABEL: Record<ScoreGroup, string> = {
  legs: "רגליים",
  chest: "חזה",
  back: "גב",
  shoulders: "כתפיים",
  arms: "ידיים",
};

const GROUP_WEIGHT: Record<ScoreGroup, number> = { legs: 0.3, back: 0.25, chest: 0.2, shoulders: 0.15, arms: 0.1 };

/** Intermediate e1RM ÷ bodyweight, for men. Our own round numbers from common strength norms. */
export const STANDARDS: Record<string, { group: ScoreGroup; ratio: number; lower?: boolean }> = {
  "back-squat": { group: "legs", ratio: 1.5, lower: true },
  "front-squat": { group: "legs", ratio: 1.2, lower: true },
  "leg-press": { group: "legs", ratio: 2.5, lower: true },
  "romanian-deadlift": { group: "legs", ratio: 1.3, lower: true },
  "hip-thrust": { group: "legs", ratio: 1.8, lower: true },
  "bulgarian-split-squat": { group: "legs", ratio: 0.3, lower: true },
  "goblet-squat": { group: "legs", ratio: 0.45, lower: true },
  deadlift: { group: "back", ratio: 1.75, lower: true },
  "barbell-row": { group: "back", ratio: 1.0 },
  "lat-pulldown": { group: "back", ratio: 0.9 },
  "seated-cable-row": { group: "back", ratio: 0.9 },
  "db-row": { group: "back", ratio: 0.45 },
  "bench-press": { group: "chest", ratio: 1.15 },
  "db-bench-press": { group: "chest", ratio: 0.4 },
  "incline-db-press": { group: "chest", ratio: 0.35 },
  "overhead-press": { group: "shoulders", ratio: 0.7 },
  "db-shoulder-press": { group: "shoulders", ratio: 0.3 },
  "barbell-curl": { group: "arms", ratio: 0.5 },
  "db-curl": { group: "arms", ratio: 0.2 },
  "hammer-curl": { group: "arms", ratio: 0.22 },
  "triceps-pushdown": { group: "arms", ratio: 0.5 },
  "skull-crusher": { group: "arms", ratio: 0.45 },
};

export type ScoredSet = {
  slug: string | null;
  exerciseName: string;
  weightKg: number | null;
  reps: number | null;
  kind: string;
  completedAt: string | null;
};

export type StrengthLevel = "beginner" | "intermediate" | "advanced" | "expert" | "elite";

export function levelFor(score: number): StrengthLevel {
  if (score >= 550) return "elite";
  if (score >= 450) return "expert";
  if (score >= 350) return "advanced";
  if (score >= 200) return "intermediate";
  return "beginner";
}

export type GroupScore = { group: ScoreGroup; score: number; lift: string; weightKg: number; reps: number; e1rm: number };

export type StrengthResult = {
  total: number;
  level: StrengthLevel;
  groups: Partial<Record<ScoreGroup, GroupScore>>;
};

const WINDOW_DAYS = 42;

export function computeStrength(
  sets: ScoredSet[],
  opts: { bodyweightKg: number; sex: "male" | "female"; asOf: Date },
): StrengthResult | null {
  if (!(opts.bodyweightKg > 0)) return null;
  const from = opts.asOf.getTime() - WINDOW_DAYS * 86_400_000;
  const groups: Partial<Record<ScoreGroup, GroupScore>> = {};

  for (const s of sets) {
    if (!s.slug || !s.completedAt || s.kind === "warmup" || !s.weightKg || !s.reps) continue;
    const t = new Date(s.completedAt).getTime();
    if (t < from || t > opts.asOf.getTime()) continue;
    const std = STANDARDS[s.slug];
    if (!std) continue;
    const e1rm = estimateOneRepMax(s.weightKg, s.reps);
    if (e1rm == null) continue;
    const factor = opts.sex === "female" ? (std.lower ? 0.75 : 0.65) : 1;
    const score = Math.min(600, Math.round(((e1rm / opts.bodyweightKg) / (std.ratio * factor)) * 300));
    const cur = groups[std.group];
    if (!cur || score > cur.score) groups[std.group] = { group: std.group, score, lift: s.exerciseName, weightKg: s.weightKg, reps: s.reps, e1rm };
  }

  const present = (Object.keys(groups) as ScoreGroup[]).filter((g) => groups[g]);
  if (!present.length) return null;
  const wsum = present.reduce((n, g) => n + GROUP_WEIGHT[g], 0);
  const total = Math.round(present.reduce((n, g) => n + groups[g]!.score * GROUP_WEIGHT[g], 0) / wsum);
  return { total, level: levelFor(total), groups };
}

export type StrengthChange = { delta: number; reasons: string[] };

/** What changed between last week's score and this one, in words. */
export function explainChange(
  now: StrengthResult,
  before: StrengthResult | null,
  bodyweight: { now: number; before: number | null },
  formatWeight: (kg: number) => string,
): StrengthChange {
  if (!before) return { delta: 0, reasons: ["זה הציון הראשון. בשבוע הבא יופיע כאן מה השתנה."] };
  const reasons: string[] = [];
  for (const g of Object.keys(GROUP_LABEL) as ScoreGroup[]) {
    const a = before.groups[g];
    const b = now.groups[g];
    if (b && !a) reasons.push(`${GROUP_LABEL[g]}: נוסף לציון, ${b.lift} ${formatWeight(b.weightKg)} × ${b.reps}.`);
    else if (b && a && b.score > a.score && (b.lift !== a.lift || b.e1rm > a.e1rm + 0.01))
      reasons.push(`${GROUP_LABEL[g]}: שיא חדש ב${b.lift}, ${formatWeight(b.weightKg)} × ${b.reps} (+${b.score - a.score}).`);
    else if (a && !b) reasons.push(`${GROUP_LABEL[g]}: אין אימון ב-6 השבועות האחרונים, ולכן לא נספר.`);
    else if (a && b && b.score < a.score && b.e1rm < a.e1rm - 0.01)
      reasons.push(`${GROUP_LABEL[g]}: הסט הטוב מלפני 6 שבועות יצא מהחלון (${b.score - a.score}).`);
  }
  if (bodyweight.before && Math.abs(bodyweight.now - bodyweight.before) >= 0.5) {
    const lighter = bodyweight.now < bodyweight.before;
    reasons.push(
      `משקל הגוף ${lighter ? "ירד" : "עלה"} ל-${formatWeight(bodyweight.now)}, ולכן אותו משקל על המוט שווה ${lighter ? "יותר" : "פחות"} נקודות.`,
    );
  }
  if (!reasons.length) reasons.push("אין שינוי השבוע. שיא חדש בתרגיל מרכזי יעלה את הציון.");
  return { delta: now.total - before.total, reasons };
}
