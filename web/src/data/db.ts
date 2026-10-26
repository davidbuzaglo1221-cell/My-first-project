import Dexie, { type EntityTable } from "dexie";
import { SEED_EXERCISES, SEED_TEMPLATES } from "./seed";
import { SEED_FOODS } from "./food-seed";
import type {
  BodyMetric,
  CardioSession,
  LessonRead,
  ProgressPhoto,
  Exercise,
  Food,
  FoodLog,
  MealPhoto,
  NutritionTarget,
  Profile,
  TemplateExercise,
  Workout,
  WorkoutExercise,
  WorkoutSet,
  WorkoutTemplate,
} from "./types";

function seedExercises(): Exercise[] {
  return SEED_EXERCISES.map((e) => ({
    id: crypto.randomUUID(),
    userId: null,
    slug: e.slug,
    nameHe: e.nameHe,
    aliasesHe: e.aliasesHe ?? [],
    primaryMuscle: e.muscle,
    equipment: e.equipment,
    tracking: e.equipment === "bodyweight" || e.equipment === "pullup_bar" ? "reps" : "weight_reps",
    isUnilateral: e.unilateral ?? false,
    instructionsHe: e.cue ?? null,
  }));
}

/** Library foods get stable ids, so re-seeding updates rows instead of duplicating them. */
function seedFoods(): Food[] {
  return SEED_FOODS.map((f) => ({
    id: `seed:${f.slug}`,
    userId: null,
    source: "seed",
    nameHe: f.nameHe,
    aliasesHe: f.aliasesHe,
    brand: null,
    barcode: null,
    per100: f.per100,
    servings: f.servings,
  }));
}

// Local-first store. Everything is written here first, so the app works with no signal in the gym.
// When the backend lands, a sync queue pushes these rows to Supabase (upsert on id).
export class LocalDb extends Dexie {
  profile!: EntityTable<Profile, "id">;
  exercises!: EntityTable<Exercise, "id">;
  templates!: EntityTable<WorkoutTemplate, "id">;
  templateExercises!: EntityTable<TemplateExercise, "id">;
  workouts!: EntityTable<Workout, "id">;
  workoutExercises!: EntityTable<WorkoutExercise, "id">;
  sets!: EntityTable<WorkoutSet, "id">;
  foods!: EntityTable<Food, "id">;
  foodLogs!: EntityTable<FoodLog, "id">;
  mealPhotos!: EntityTable<MealPhoto, "id">;
  targets!: EntityTable<NutritionTarget, "id">;
  bodyMetrics!: EntityTable<BodyMetric, "id">;
  cardio!: EntityTable<CardioSession, "id">;
  progressPhotos!: EntityTable<ProgressPhoto, "id">;
  lessonReads!: EntityTable<LessonRead, "id">;

  constructor() {
    super("training-app");
    this.version(1).stores({
      profile: "id",
      exercises: "id, &slug, userId, primaryMuscle, equipment",
      templates: "id, userId, position",
      templateExercises: "id, templateId, exerciseId",
      workouts: "id, startedAt, endedAt, templateId",
      workoutExercises: "id, workoutId, exerciseId",
      sets: "id, workoutId, workoutExerciseId",
    });
    // v2: nutrition. Existing installs get the food library on upgrade; new ones in populate.
    this.version(2)
      .stores({
        foods: "id, barcode, userId",
        foodLogs: "id, logDate, foodId, createdAt",
        mealPhotos: "id",
        targets: "id, effectiveFrom",
      })
      .upgrade((tx) => tx.table("foods").bulkPut(seedFoods()));
    // v3: bodyweight log.
    this.version(3).stores({ bodyMetrics: "id, &date" });
    // v5: cardio, progress photos, lessons read.
    this.version(5).stores({ cardio: "id, date, startedAt", progressPhotos: "id, date, pose", lessonReads: "id" });
    // v4: the exercise library grew; existing installs get the new ones by slug.
    this.version(4)
      .stores({})
      .upgrade(async (tx) => {
        const have = new Set((await tx.table("exercises").toArray()).map((e: Exercise) => e.slug));
        await tx.table("exercises").bulkAdd(seedExercises().filter((e) => !have.has(e.slug)));
      });
    this.on("populate", (tx) => {
      const exercises = seedExercises();
      tx.table("exercises").bulkAdd(exercises);
      tx.table("foods").bulkPut(seedFoods());
      const bySlug = new Map(exercises.map((e) => [e.slug, e.id]));
      SEED_TEMPLATES.forEach((t, ti) => {
        const templateId = crypto.randomUUID();
        tx.table("templates").add({
          id: templateId,
          userId: null,
          name: t.name,
          notes: t.notes ?? null,
          position: ti,
          createdAt: new Date().toISOString(),
        } satisfies WorkoutTemplate);
        tx.table("templateExercises").bulkAdd(
          t.exercises.map(
            (x, i): TemplateExercise => ({
              id: crypto.randomUUID(),
              templateId,
              exerciseId: bySlug.get(x.slug)!,
              position: i,
              supersetGroup: null,
              targetSets: x.sets,
              targetRepsMin: x.repsMin,
              targetRepsMax: x.repsMax,
              targetRestSec: x.restSec,
            }),
          ),
        );
      });
      tx.table("profile").add({
        id: "me",
        displayName: null,
        units: "kg",
        weekStartsOn: "sun",
        theme: "light",
        goal: null,
        bodyweightKg: null,
        defaultRestSec: 120,
        autoRestTimer: true,
      } satisfies Profile);
    });
  }
}

let instance: LocalDb | null = null;

/** One database per tab, created on first use in the browser. */
export function db(): LocalDb {
  if (!instance) instance = new LocalDb();
  return instance;
}
