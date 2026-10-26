-- Schema for the Hebrew strength + nutrition app (a rebuild of Caliber's core features).
-- Target: Postgres on Supabase. Access rules: row level security on every table.
-- Conventions:
--   * every table: id uuid pk, created_at, updated_at (trigger)
--   * everything a user owns has user_id -> auth.users, on delete cascade (deleting the account deletes the data)
--   * times are timestamptz (UTC). Calendar days (food log, habits) are `date` in the user's time zone (profiles.timezone)
--   * weights are stored in kg, numeric(6,2). The UI converts to lb when profiles.units = 'lb'
--   * ids for workout data are generated on the client, so offline writes can be retried safely (upsert on id)

create extension if not exists pgcrypto;
create extension if not exists pg_trgm;   -- fuzzy Hebrew search on foods and exercises

-- updated_at trigger ---------------------------------------------------------
create or replace function set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- enums ----------------------------------------------------------------------
create type unit_system   as enum ('kg', 'lb');
create type week_start    as enum ('sun', 'mon');
create type sex           as enum ('male', 'female');
create type goal          as enum ('lose_fat', 'maintain', 'build_muscle', 'strength');
create type experience    as enum ('beginner', 'intermediate', 'advanced');
create type muscle_group  as enum ('legs', 'chest', 'back', 'shoulders', 'arms', 'core', 'full_body', 'cardio');
create type equipment     as enum ('barbell', 'dumbbell', 'kettlebell', 'machine', 'cable', 'bodyweight',
                                   'band', 'smith', 'ez_bar', 'trap_bar', 'bench', 'pullup_bar', 'other');
create type tracking_type as enum ('weight_reps', 'reps', 'time', 'distance_time', 'bodyweight_plus', 'assisted');
create type set_kind      as enum ('warmup', 'work', 'drop', 'failure');
create type pr_type       as enum ('weight', 'reps', 'e1rm', 'volume');
create type photo_pose    as enum ('front', 'side', 'back', 'other');
create type meal          as enum ('breakfast', 'lunch', 'dinner', 'snack');
create type food_source   as enum ('seed', 'usda', 'openfoodfacts', 'user');
create type habit_kind    as enum ('protein', 'steps', 'sleep', 'water', 'workout', 'custom');
create type strength_level as enum ('beginner', 'intermediate', 'advanced', 'expert', 'elite');

-- profiles: one row per auth user ----------------------------------------------
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  birth_year smallint check (birth_year between 1920 and 2020),
  sex sex,
  height_cm numeric(5,1) check (height_cm between 100 and 250),
  units unit_system not null default 'kg',
  week_starts_on week_start not null default 'sun',
  timezone text not null default 'Asia/Jerusalem',
  goal goal,
  experience experience,
  days_per_week smallint check (days_per_week between 1 and 7),
  available_equipment equipment[] not null default '{}',
  default_rest_sec integer not null default 120 check (default_rest_sec between 0 and 1800),
  auto_rest_timer boolean not null default true,
  theme text not null default 'system' check (theme in ('system', 'light', 'dark')),
  onboarded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- exercises: shared library (user_id null) + custom exercises (user_id set) -------
create table exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,  -- null = library
  slug text unique,                                          -- library only, stable key for seeding
  name_he text not null,
  name_en text,
  aliases_he text[] not null default '{}',                   -- "לחיצת חזה", "בנץ'" ...
  primary_muscle muscle_group not null,
  secondary_muscles muscle_group[] not null default '{}',
  equipment equipment not null,
  tracking tracking_type not null default 'weight_reps',
  is_unilateral boolean not null default false,              -- weight is per hand / per leg
  instructions_he text,
  media_path text,                                           -- open-licence media only
  media_credit text,                                         -- licence + author, shown in the app
  -- which strength sub-score this lift counts toward, and how strongly (0 = not a scoring lift)
  score_group muscle_group,
  score_weight numeric(3,2) not null default 0 check (score_weight between 0 and 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint custom_has_no_slug check (user_id is null or slug is null)
);
create index exercises_user_idx on exercises (user_id);
create index exercises_muscle_idx on exercises (primary_muscle, equipment);
create index exercises_name_trgm on exercises using gin (name_he gin_trgm_ops);

create table favorite_exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  exercise_id uuid not null references exercises(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, exercise_id)
);
create index favorite_exercises_exercise_idx on favorite_exercises (exercise_id);

-- templates ----------------------------------------------------------------------
create table workout_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,  -- null = belongs to a library program
  name text not null check (length(name) between 1 and 80),
  notes text,
  position integer not null default 0,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index workout_templates_user_idx on workout_templates (user_id, position);

create table template_exercises (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references workout_templates(id) on delete cascade,
  exercise_id uuid not null references exercises(id) on delete restrict,
  position integer not null,
  superset_group smallint,                                   -- same number = same superset
  target_sets smallint not null default 3 check (target_sets between 1 and 20),
  target_reps_min smallint check (target_reps_min between 1 and 100),
  target_reps_max smallint check (target_reps_max between 1 and 100),
  target_rest_sec integer check (target_rest_sec between 0 and 1800),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint reps_range check (target_reps_max is null or target_reps_min is null or target_reps_max >= target_reps_min),
  unique (template_id, position) deferrable initially deferred  -- reorder in one transaction
);
create index template_exercises_exercise_idx on template_exercises (exercise_id);

-- programs (library, written by us) -------------------------------------------------
create table programs (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name_he text not null,
  description_he text,
  goal goal not null,
  level experience not null,
  weeks smallint not null check (weeks between 1 and 52),
  days_per_week smallint not null check (days_per_week between 1 and 7),
  required_equipment equipment[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index programs_filter_idx on programs (goal, level, days_per_week);

create table program_days (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references programs(id) on delete cascade,
  week smallint not null check (week >= 1),
  day smallint not null check (day between 1 and 7),          -- training day number within the week
  template_id uuid not null references workout_templates(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (program_id, week, day)
);
create index program_days_template_idx on program_days (template_id);

create table user_programs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  program_id uuid not null references programs(id) on delete restrict,
  started_on date not null,
  status text not null default 'active' check (status in ('active', 'paused', 'finished', 'abandoned')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index user_programs_program_idx on user_programs (program_id);
-- one active program at a time
create unique index user_programs_one_active on user_programs (user_id) where status = 'active';

-- workouts ------------------------------------------------------------------------
create table workouts (
  id uuid primary key,                                       -- generated on the client
  user_id uuid not null references auth.users(id) on delete cascade,
  template_id uuid references workout_templates(id) on delete set null,
  program_day_id uuid references program_days(id) on delete set null,
  name text,
  started_at timestamptz not null,
  ended_at timestamptz,
  notes text,
  rating smallint check (rating between 1 and 5),            -- how did it feel
  bodyweight_kg numeric(5,2),                                -- snapshot, for relative strength
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ends_after_start check (ended_at is null or ended_at >= started_at)
);
create index workouts_user_started_idx on workouts (user_id, started_at desc);
create index workouts_template_idx on workouts (template_id);
create index workouts_program_day_idx on workouts (program_day_id);
-- one workout in progress at a time (the resume-after-closing-the-browser case)
create unique index workouts_one_open on workouts (user_id) where ended_at is null;

create table workout_exercises (
  id uuid primary key,                                       -- client generated
  workout_id uuid not null references workouts(id) on delete cascade,
  exercise_id uuid not null references exercises(id) on delete restrict,
  position integer not null,
  superset_group smallint,
  replaced_exercise_id uuid references exercises(id) on delete set null,  -- swapped mid-workout
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index workout_exercises_workout_idx on workout_exercises (workout_id, position);
create index workout_exercises_exercise_idx on workout_exercises (exercise_id);
create index workout_exercises_replaced_idx on workout_exercises (replaced_exercise_id);

create table sets (
  id uuid primary key,                                       -- client generated
  workout_exercise_id uuid not null references workout_exercises(id) on delete cascade,
  position integer not null,
  kind set_kind not null default 'work',
  weight_kg numeric(6,2) check (weight_kg >= 0 and weight_kg < 1000),
  reps smallint check (reps between 0 and 1000),
  duration_sec integer check (duration_sec >= 0),
  distance_m integer check (distance_m >= 0),
  rir smallint check (rir between 0 and 10),                 -- reps in reserve
  completed_at timestamptz,                                  -- null = planned, not done yet
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index sets_workout_exercise_idx on sets (workout_exercise_id, position);

-- personal records (written when a workout finishes, and recomputed when an old one is edited)
create table personal_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  exercise_id uuid not null references exercises(id) on delete cascade,
  type pr_type not null,
  reps smallint,                                             -- for type weight: best weight at this rep count
  value numeric(8,2) not null,
  set_id uuid references sets(id) on delete cascade,
  achieved_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index personal_records_set_idx on personal_records (set_id);
create index personal_records_exercise_idx on personal_records (exercise_id);
-- the current record per exercise/type/rep count; history is kept in older rows
create index personal_records_lookup on personal_records (user_id, exercise_id, type, reps, achieved_at desc);

-- strength score, one snapshot per user per week ------------------------------------
create table strength_scores (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  week_start date not null,
  total smallint not null check (total between 0 and 1000),
  legs smallint, chest smallint, back smallint, shoulders smallint, arms smallint,
  level strength_level not null,
  -- why it changed: [{"group":"legs","delta":+12,"reason_he":"שיא חדש בסקוואט: 100 ק\"ג × 5"}]
  explanation jsonb not null default '[]',
  formula_version smallint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, week_start)
);

-- body ---------------------------------------------------------------------------
create table body_metrics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  measured_at timestamptz not null,
  weight_kg numeric(5,2) check (weight_kg between 20 and 400),
  body_fat_pct numeric(4,1) check (body_fat_pct between 2 and 70),
  waist_cm numeric(5,1), chest_cm numeric(5,1), hips_cm numeric(5,1),
  arm_cm numeric(5,1), thigh_cm numeric(5,1), neck_cm numeric(5,1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index body_metrics_user_idx on body_metrics (user_id, measured_at desc);

create table progress_photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  taken_at timestamptz not null,
  pose photo_pose not null default 'front',
  storage_path text not null unique,                         -- private bucket, path starts with user_id/
  width integer, height integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index progress_photos_user_idx on progress_photos (user_id, taken_at desc);

create table cardio_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('run', 'walk', 'bike', 'row', 'elliptical', 'stairs', 'swim', 'hiit', 'other')),
  started_at timestamptz not null,
  duration_sec integer not null check (duration_sec > 0),
  distance_m integer check (distance_m >= 0),
  avg_hr smallint check (avg_hr between 30 and 250),
  calories integer check (calories >= 0),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index cardio_sessions_user_idx on cardio_sessions (user_id, started_at desc);

-- nutrition ----------------------------------------------------------------------
create table nutrition_targets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  effective_from date not null,
  calories integer not null check (calories between 800 and 8000),
  protein_g integer not null check (protein_g between 0 and 600),
  carbs_g integer not null check (carbs_g between 0 and 1200),
  fat_g integer not null check (fat_g between 0 and 400),
  fiber_g integer check (fiber_g between 0 and 150),
  method text not null default 'wizard' check (method in ('wizard', 'manual')),
  inputs jsonb not null default '{}',                        -- what the wizard used, so it can explain itself
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, effective_from)
);

create table foods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,  -- null = shared
  source food_source not null,
  source_ref text,                                           -- USDA fdc id / OFF barcode
  name_he text not null,
  name_en text,
  brand text,
  barcode text,
  kcal_100g numeric(6,1) not null check (kcal_100g >= 0),
  protein_100g numeric(5,1) not null default 0 check (protein_100g >= 0),
  carbs_100g numeric(5,1) not null default 0 check (carbs_100g >= 0),
  fat_100g numeric(5,1) not null default 0 check (fat_100g >= 0),
  fiber_100g numeric(5,1) check (fiber_100g >= 0),
  -- [{"name_he":"פרוסה","grams":30},{"name_he":"כוס","grams":240}]
  servings jsonb not null default '[]',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_food_source check ((user_id is null) = (source <> 'user'))
);
create index foods_user_idx on foods (user_id);
create index foods_name_trgm on foods using gin (name_he gin_trgm_ops);
create unique index foods_barcode_shared on foods (barcode) where barcode is not null and user_id is null;
create unique index foods_source_ref on foods (source, source_ref) where source_ref is not null;

-- saved meals and home recipes: a named list of foods, logged in one tap
create table saved_meals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  kind text not null default 'meal' check (kind in ('meal', 'recipe')),
  servings_count numeric(4,1) not null default 1 check (servings_count > 0),  -- recipe yield
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index saved_meals_user_idx on saved_meals (user_id);

create table saved_meal_items (
  id uuid primary key default gen_random_uuid(),
  saved_meal_id uuid not null references saved_meals(id) on delete cascade,
  food_id uuid not null references foods(id) on delete restrict,
  grams numeric(7,1) not null check (grams > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index saved_meal_items_meal_idx on saved_meal_items (saved_meal_id);
create index saved_meal_items_food_idx on saved_meal_items (food_id);

create table food_logs (
  id uuid primary key,                                       -- client generated (offline)
  user_id uuid not null references auth.users(id) on delete cascade,
  log_date date not null,                                    -- the user's local day
  meal meal not null,
  food_id uuid not null references foods(id) on delete restrict,
  grams numeric(7,1) not null check (grams > 0),
  -- nutrient snapshot, so editing a food later does not rewrite history
  kcal numeric(7,1) not null, protein_g numeric(6,1) not null,
  carbs_g numeric(6,1) not null, fat_g numeric(6,1) not null, fiber_g numeric(6,1),
  saved_meal_id uuid references saved_meals(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index food_logs_user_day_idx on food_logs (user_id, log_date);
create index food_logs_food_idx on food_logs (food_id);
create index food_logs_saved_meal_idx on food_logs (saved_meal_id);

-- habits -------------------------------------------------------------------------
create table habits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind habit_kind not null,
  name_he text not null,
  target numeric(8,1) not null check (target > 0),
  unit text not null,                                        -- "גרם", "צעדים", "שעות", "כוסות"
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index habits_user_idx on habits (user_id);

create table habit_logs (
  id uuid primary key default gen_random_uuid(),
  habit_id uuid not null references habits(id) on delete cascade,
  log_date date not null,
  value numeric(8,1) not null check (value >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (habit_id, log_date)
);

-- lessons (written by us, in Hebrew) ---------------------------------------------
create table lessons (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  topic text not null check (topic in ('training', 'nutrition', 'recovery', 'mindset')),
  title_he text not null,
  body_he text not null,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table lesson_reads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  lesson_id uuid not null references lessons(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, lesson_id)
);
create index lesson_reads_lesson_idx on lesson_reads (lesson_id);

-- web push (rest timer when the screen is locked) ------------------------------------
create table push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  last_ok_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index push_subscriptions_user_idx on push_subscriptions (user_id);

-- updated_at triggers on every table -----------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'profiles','exercises','favorite_exercises','workout_templates','template_exercises','programs',
    'program_days','user_programs','workouts','workout_exercises','sets','personal_records',
    'strength_scores','body_metrics','progress_photos','cardio_sessions','nutrition_targets','foods',
    'saved_meals','saved_meal_items','food_logs','habits','habit_logs','lessons','lesson_reads',
    'push_subscriptions'
  ] loop
    execute format('create trigger %I before update on %I for each row execute function set_updated_at()',
                   t || '_updated_at', t);
  end loop;
end $$;

-- row level security ------------------------------------------------------------
-- Rule: a user sees and changes only their own rows. Library rows (user_id null) are read-only
-- for every signed-in user and written only by the service role (seed scripts).

alter table profiles enable row level security;
create policy own on profiles for all to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- tables with a direct user_id
do $$
declare t text;
begin
  foreach t in array array[
    'favorite_exercises','user_programs','workouts','personal_records','strength_scores','body_metrics',
    'progress_photos','cardio_sessions','nutrition_targets','saved_meals','food_logs','habits',
    'lesson_reads','push_subscriptions'
  ] loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy own on %I for all to authenticated
                    using (user_id = auth.uid()) with check (user_id = auth.uid())', t);
  end loop;
end $$;

-- library + own rows: read both, write only own
do $$
declare t text;
begin
  foreach t in array array['exercises','foods','workout_templates'] loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy read_library_or_own on %I for select to authenticated
                    using (user_id is null or user_id = auth.uid())', t);
    execute format('create policy write_own on %I for insert to authenticated with check (user_id = auth.uid())', t);
    execute format('create policy update_own on %I for update to authenticated
                    using (user_id = auth.uid()) with check (user_id = auth.uid())', t);
    execute format('create policy delete_own on %I for delete to authenticated using (user_id = auth.uid())', t);
  end loop;
end $$;

-- library only: read for everyone signed in
do $$
declare t text;
begin
  foreach t in array array['programs','program_days','lessons'] loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy read_all on %I for select to authenticated using (true)', t);
  end loop;
end $$;

-- child tables: access follows the parent row
alter table template_exercises enable row level security;
create policy read_via_template on template_exercises for select to authenticated using (
  exists (select 1 from workout_templates t where t.id = template_id and (t.user_id is null or t.user_id = auth.uid())));
create policy write_via_template on template_exercises for all to authenticated
  using (exists (select 1 from workout_templates t where t.id = template_id and t.user_id = auth.uid()))
  with check (exists (select 1 from workout_templates t where t.id = template_id and t.user_id = auth.uid()));

alter table workout_exercises enable row level security;
create policy own_via_workout on workout_exercises for all to authenticated
  using (exists (select 1 from workouts w where w.id = workout_id and w.user_id = auth.uid()))
  with check (exists (select 1 from workouts w where w.id = workout_id and w.user_id = auth.uid()));

alter table sets enable row level security;
create policy own_via_workout on sets for all to authenticated
  using (exists (select 1 from workout_exercises we join workouts w on w.id = we.workout_id
                 where we.id = workout_exercise_id and w.user_id = auth.uid()))
  with check (exists (select 1 from workout_exercises we join workouts w on w.id = we.workout_id
                      where we.id = workout_exercise_id and w.user_id = auth.uid()));

alter table saved_meal_items enable row level security;
create policy own_via_meal on saved_meal_items for all to authenticated
  using (exists (select 1 from saved_meals m where m.id = saved_meal_id and m.user_id = auth.uid()))
  with check (exists (select 1 from saved_meals m where m.id = saved_meal_id and m.user_id = auth.uid()));

alter table habit_logs enable row level security;
create policy own_via_habit on habit_logs for all to authenticated
  using (exists (select 1 from habits h where h.id = habit_id and h.user_id = auth.uid()))
  with check (exists (select 1 from habits h where h.id = habit_id and h.user_id = auth.uid()));

-- create the profile row when someone signs up
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function handle_new_user();

-- previous performance for the logger: the last finished workout's sets for one exercise
create or replace function previous_sets(p_exercise_id uuid)
returns table (workout_id uuid, started_at timestamptz, set_position integer, kind set_kind,
               weight_kg numeric, reps smallint, duration_sec integer, distance_m integer, rir smallint)
language sql stable security invoker as $$
  with last as (
    select w.id, w.started_at
    from workouts w join workout_exercises we on we.workout_id = w.id
    where w.user_id = auth.uid() and w.ended_at is not null and we.exercise_id = p_exercise_id
    order by w.started_at desc limit 1
  )
  select last.id, last.started_at, s.position, s.kind, s.weight_kg, s.reps, s.duration_sec, s.distance_m, s.rir
  from last
  join workout_exercises we on we.workout_id = last.id and we.exercise_id = p_exercise_id
  join sets s on s.workout_exercise_id = we.id and s.completed_at is not null
  order by we.position, s.position;
$$;
