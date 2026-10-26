import type { Equipment, MuscleGroup } from "./types";

// Our own starter library: names, aliases and cues written for this app, in Hebrew.
// Slugs are stable keys, so the real library import can update these rows instead of duplicating them.
type SeedExercise = {
  slug: string;
  nameHe: string;
  aliasesHe?: string[];
  muscle: MuscleGroup;
  equipment: Equipment;
  unilateral?: boolean;
  cue?: string;
};

export const SEED_EXERCISES: SeedExercise[] = [
  { slug: "back-squat", nameHe: "סקוואט עם מוט", aliasesHe: ["סקוואט", "כפיפות ברכיים"], muscle: "legs", equipment: "barbell", cue: "חזה פתוח, ירידה עד שהירך מקבילה לרצפה או מתחת" },
  { slug: "front-squat", nameHe: "סקוואט קדמי", muscle: "legs", equipment: "barbell", cue: "מרפקים גבוהים, גב זקוף" },
  { slug: "goblet-squat", nameHe: "סקוואט גביע", aliasesHe: ["גובלט"], muscle: "legs", equipment: "dumbbell" },
  { slug: "leg-press", nameHe: "לחיצת רגליים", aliasesHe: ["לג פרס"], muscle: "legs", equipment: "machine" },
  { slug: "romanian-deadlift", nameHe: "דדליפט רומני", aliasesHe: ["RDL"], muscle: "legs", equipment: "barbell", cue: "ירכיים אחורה, מוט צמוד לרגליים" },
  { slug: "deadlift", nameHe: "דדליפט", aliasesHe: ["הרמת מתים"], muscle: "back", equipment: "barbell", cue: "מתיחת המוט לפני ההרמה, גב ניטרלי" },
  { slug: "bulgarian-split-squat", nameHe: "סקוואט בולגרי", muscle: "legs", equipment: "dumbbell", unilateral: true },
  { slug: "walking-lunge", nameHe: "מכרעים בהליכה", aliasesHe: ["לאנג'ים"], muscle: "legs", equipment: "dumbbell", unilateral: true },
  { slug: "leg-extension", nameHe: "פשיטת ברכיים", muscle: "legs", equipment: "machine" },
  { slug: "leg-curl", nameHe: "כפיפת ברכיים במכונה", muscle: "legs", equipment: "machine" },
  { slug: "hip-thrust", nameHe: "גשר ירכיים עם מוט", aliasesHe: ["היפ תראסט"], muscle: "legs", equipment: "barbell" },
  { slug: "calf-raise", nameHe: "הרמות עקבים", muscle: "legs", equipment: "machine" },
  { slug: "bench-press", nameHe: "לחיצת חזה במוט", aliasesHe: ["בנץ'", "לחיצת חזה"], muscle: "chest", equipment: "barbell", cue: "שכמות צמודות, כפות רגליים יציבות" },
  { slug: "incline-db-press", nameHe: "לחיצת חזה בשיפוע עם משקולות", aliasesHe: ["שיפוע עליון"], muscle: "chest", equipment: "dumbbell" },
  { slug: "db-bench-press", nameHe: "לחיצת חזה עם משקולות", muscle: "chest", equipment: "dumbbell" },
  { slug: "chest-fly-cable", nameHe: "פרפר בכבלים", aliasesHe: ["קרוס אובר"], muscle: "chest", equipment: "cable" },
  { slug: "push-up", nameHe: "שכיבות סמיכה", muscle: "chest", equipment: "bodyweight" },
  { slug: "dip", nameHe: "מקבילים", aliasesHe: ["דיפס"], muscle: "chest", equipment: "bodyweight" },
  { slug: "pull-up", nameHe: "מתח", aliasesHe: ["עליות מתח"], muscle: "back", equipment: "pullup_bar" },
  { slug: "lat-pulldown", nameHe: "פולי עליון", aliasesHe: ["משיכה לחזה"], muscle: "back", equipment: "cable" },
  { slug: "barbell-row", nameHe: "חתירה במוט", muscle: "back", equipment: "barbell" },
  { slug: "db-row", nameHe: "חתירה ביד אחת", muscle: "back", equipment: "dumbbell", unilateral: true },
  { slug: "seated-cable-row", nameHe: "חתירה בישיבה בכבל", aliasesHe: ["פולי תחתון"], muscle: "back", equipment: "cable" },
  { slug: "face-pull", nameHe: "משיכה לפנים", aliasesHe: ["פייס פול"], muscle: "shoulders", equipment: "cable" },
  { slug: "overhead-press", nameHe: "לחיצת כתפיים במוט", aliasesHe: ["לחיצה מעל הראש"], muscle: "shoulders", equipment: "barbell" },
  { slug: "db-shoulder-press", nameHe: "לחיצת כתפיים עם משקולות", muscle: "shoulders", equipment: "dumbbell" },
  { slug: "lateral-raise", nameHe: "הרחקה לצדדים", aliasesHe: ["צד"], muscle: "shoulders", equipment: "dumbbell" },
  { slug: "rear-delt-fly", nameHe: "פרפר הפוך", muscle: "shoulders", equipment: "dumbbell" },
  { slug: "barbell-curl", nameHe: "כפיפת מרפקים במוט", aliasesHe: ["יד קדמית"], muscle: "arms", equipment: "barbell" },
  { slug: "db-curl", nameHe: "כפיפת מרפקים עם משקולות", muscle: "arms", equipment: "dumbbell" },
  { slug: "hammer-curl", nameHe: "כפיפת פטיש", muscle: "arms", equipment: "dumbbell" },
  { slug: "triceps-pushdown", nameHe: "פשיטת מרפקים בכבל", aliasesHe: ["יד אחורית"], muscle: "arms", equipment: "cable" },
  { slug: "skull-crusher", nameHe: "פשיטת מרפקים בשכיבה", muscle: "arms", equipment: "ez_bar" },
  { slug: "overhead-triceps", nameHe: "פשיטת מרפקים מעל הראש", muscle: "arms", equipment: "dumbbell" },
  { slug: "plank", nameHe: "פלאנק", aliasesHe: ["גשר"], muscle: "core", equipment: "bodyweight" },
  { slug: "hanging-leg-raise", nameHe: "הרמות רגליים בתלייה", muscle: "core", equipment: "pullup_bar" },
  { slug: "cable-crunch", nameHe: "כפיפות בטן בכבל", muscle: "core", equipment: "cable" },
  { slug: "kb-swing", nameHe: "סווינג בקטלבל", muscle: "full_body", equipment: "kettlebell" },
];

// Two starting templates, so the first visit has something to start from.
export const SEED_TEMPLATES: { name: string; notes?: string; exercises: { slug: string; sets: number; repsMin: number; repsMax: number; restSec: number }[] }[] = [
  {
    name: "גוף מלא A",
    exercises: [
      { slug: "back-squat", sets: 3, repsMin: 5, repsMax: 8, restSec: 150 },
      { slug: "bench-press", sets: 3, repsMin: 6, repsMax: 10, restSec: 120 },
      { slug: "barbell-row", sets: 3, repsMin: 8, repsMax: 12, restSec: 90 },
      { slug: "lateral-raise", sets: 2, repsMin: 12, repsMax: 15, restSec: 60 },
    ],
  },
  {
    name: "גוף מלא B",
    exercises: [
      { slug: "romanian-deadlift", sets: 3, repsMin: 6, repsMax: 10, restSec: 150 },
      { slug: "overhead-press", sets: 3, repsMin: 6, repsMax: 10, restSec: 120 },
      { slug: "lat-pulldown", sets: 3, repsMin: 8, repsMax: 12, restSec: 90 },
      { slug: "db-curl", sets: 2, repsMin: 10, repsMax: 15, restSec: 60 },
    ],
  },
];
