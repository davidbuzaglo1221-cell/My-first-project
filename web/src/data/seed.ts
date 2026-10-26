import type { Equipment, MuscleGroup } from "./types";

// Our own starter library (83 exercises): names, aliases and cues written for this app, in Hebrew.
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

  // v2 additions
  { slug: "hack-squat", nameHe: "האק סקוואט", muscle: "legs", equipment: "machine" },
  { slug: "smith-squat", nameHe: "סקוואט בסמית'", muscle: "legs", equipment: "smith" },
  { slug: "db-rdl", nameHe: "דדליפט רומני עם משקולות", muscle: "legs", equipment: "dumbbell" },
  { slug: "step-up", nameHe: "עלייה על ספסל", muscle: "legs", equipment: "dumbbell", unilateral: true },
  { slug: "reverse-lunge", nameHe: "מכרע אחורי", muscle: "legs", equipment: "dumbbell", unilateral: true },
  { slug: "seated-leg-curl", nameHe: "כפיפת ברכיים בישיבה", muscle: "legs", equipment: "machine" },
  { slug: "hip-abduction", nameHe: "הרחקת ירכיים במכונה", muscle: "legs", equipment: "machine" },
  { slug: "glute-bridge", nameHe: "גשר עכוז", muscle: "legs", equipment: "bodyweight" },
  { slug: "bodyweight-squat", nameHe: "סקוואט במשקל גוף", muscle: "legs", equipment: "bodyweight" },
  { slug: "seated-calf-raise", nameHe: "הרמות עקבים בישיבה", muscle: "legs", equipment: "machine" },
  { slug: "trap-bar-deadlift", nameHe: "דדליפט במוט משושה", muscle: "back", equipment: "trap_bar" },
  { slug: "sumo-deadlift", nameHe: "דדליפט סומו", muscle: "back", equipment: "barbell" },
  { slug: "chin-up", nameHe: "מתח באחיזה הפוכה", muscle: "back", equipment: "pullup_bar" },
  { slug: "assisted-pull-up", nameHe: "מתח בעזרה", muscle: "back", equipment: "machine" },
  { slug: "t-bar-row", nameHe: "חתירת T", muscle: "back", equipment: "barbell" },
  { slug: "chest-supported-row", nameHe: "חתירה בשכיבה על ספסל משופע", muscle: "back", equipment: "dumbbell" },
  { slug: "straight-arm-pulldown", nameHe: "פולאובר בכבל", muscle: "back", equipment: "cable" },
  { slug: "back-extension", nameHe: "פשיטת גב", aliasesHe: ["היפר אקסטנשן"], muscle: "back", equipment: "bench" },
  { slug: "shrug", nameHe: "הרמת כתפיים", aliasesHe: ["שראגס"], muscle: "back", equipment: "dumbbell" },
  { slug: "incline-bench-press", nameHe: "לחיצת חזה בשיפוע במוט", muscle: "chest", equipment: "barbell" },
  { slug: "machine-chest-press", nameHe: "לחיצת חזה במכונה", muscle: "chest", equipment: "machine" },
  { slug: "pec-deck", nameHe: "פרפר במכונה", aliasesHe: ["פק דק"], muscle: "chest", equipment: "machine" },
  { slug: "db-fly", nameHe: "פרפר עם משקולות", muscle: "chest", equipment: "dumbbell" },
  { slug: "decline-push-up", nameHe: "שכיבות סמיכה רגליים למעלה", muscle: "chest", equipment: "bodyweight" },
  { slug: "arnold-press", nameHe: "לחיצת ארנולד", muscle: "shoulders", equipment: "dumbbell" },
  { slug: "machine-shoulder-press", nameHe: "לחיצת כתפיים במכונה", muscle: "shoulders", equipment: "machine" },
  { slug: "cable-lateral-raise", nameHe: "הרחקה לצד בכבל", muscle: "shoulders", equipment: "cable", unilateral: true },
  { slug: "front-raise", nameHe: "הרמה קדמית", muscle: "shoulders", equipment: "dumbbell" },
  { slug: "upright-row", nameHe: "חתירה אנכית", muscle: "shoulders", equipment: "ez_bar" },
  { slug: "pike-push-up", nameHe: "שכיבות סמיכה פייק", muscle: "shoulders", equipment: "bodyweight" },
  { slug: "preacher-curl", nameHe: "כפיפת מרפקים בכיסא כומר", muscle: "arms", equipment: "ez_bar" },
  { slug: "cable-curl", nameHe: "כפיפת מרפקים בכבל", muscle: "arms", equipment: "cable" },
  { slug: "incline-db-curl", nameHe: "כפיפת מרפקים בשיפוע", muscle: "arms", equipment: "dumbbell" },
  { slug: "close-grip-bench", nameHe: "לחיצת חזה באחיזה צרה", muscle: "arms", equipment: "barbell" },
  { slug: "rope-pushdown", nameHe: "פשיטת מרפקים בחבל", muscle: "arms", equipment: "cable" },
  { slug: "bench-dip", nameHe: "מקבילים על ספסל", muscle: "arms", equipment: "bench" },
  { slug: "side-plank", nameHe: "פלאנק צד", muscle: "core", equipment: "bodyweight" },
  { slug: "ab-wheel", nameHe: "גלגלת בטן", muscle: "core", equipment: "other" },
  { slug: "crunch", nameHe: "כפיפות בטן", muscle: "core", equipment: "bodyweight" },
  { slug: "russian-twist", nameHe: "טוויסט רוסי", muscle: "core", equipment: "bodyweight" },
  { slug: "dead-bug", nameHe: "דד באג", muscle: "core", equipment: "bodyweight" },
  { slug: "farmers-walk", nameHe: "הליכת חקלאי", muscle: "full_body", equipment: "dumbbell" },
  { slug: "kb-goblet-squat", nameHe: "סקוואט גביע בקטלבל", muscle: "legs", equipment: "kettlebell" },
  { slug: "burpee", nameHe: "ברפי", muscle: "full_body", equipment: "bodyweight" },
  { slug: "band-pull-apart", nameHe: "פתיחת גומייה", muscle: "shoulders", equipment: "band" },
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
