-- Steps clone: cloud schema (Postgres / Supabase).
-- The phone is the source of truth for step counts (HealthKit / Health Connect).
-- The server stores a synced copy only for users who sign in (sync is optional in v1).
-- Access: Supabase row level security. Every table with user_id has a policy below.

create extension if not exists pgcrypto;

create table users (
  id uuid primary key default gen_random_uuid(),
  email text unique,
  display_name text,
  units text not null default 'metric' check (units in ('metric','imperial')),
  timezone text not null default 'UTC',          -- IANA name, e.g. Europe/Berlin
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One row per user per local calendar day per source. Local date, not UTC,
-- so a 9am walk in Tokyo lands on the Tokyo day.
create table daily_steps (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  local_date date not null,
  steps integer not null check (steps >= 0),
  distance_m integer not null default 0 check (distance_m >= 0),
  calories_kcal integer not null default 0 check (calories_kcal >= 0),
  source text not null check (source in ('healthkit','health_connect','device')),
  device_id text,
  synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint daily_steps_one_per_day_source unique (user_id, local_date, source)
);
-- The unique constraint already indexes (user_id, local_date, source).
-- Extra index for "last 365 days" range scans by user only:
create index daily_steps_user_date_idx on daily_steps (user_id, local_date desc);

-- Goal history, so changing the goal does not rewrite past days.
create table goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  steps_per_day integer not null check (steps_per_day between 500 and 100000),
  effective_from date not null,
  created_at timestamptz not null default now(),
  constraint goals_one_per_start unique (user_id, effective_from)
);
create index goals_user_effective_idx on goals (user_id, effective_from desc);

create table reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  kind text not null check (kind in ('goal_reached','weekly_report')),
  local_time time not null,
  weekday smallint check (weekday between 1 and 7),   -- required for weekly_report, null otherwise
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  constraint reminders_weekday_rule check (
    (kind = 'weekly_report' and weekday is not null) or
    (kind = 'goal_reached' and weekday is null)
  )
);
create index reminders_user_idx on reminders (user_id);

-- Filled by the purchase provider's webhook (RevenueCat). Stripe is not used for
-- in-app digital goods on iOS or Android, so this is not a Stripe table.
create table subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  provider text not null default 'revenuecat',
  provider_customer_id text not null,
  plan text not null check (plan in ('free','pro')),
  status text not null check (status in ('active','expired','in_grace','cancelled')),
  current_period_end timestamptz,
  updated_at timestamptz not null default now(),
  constraint subscriptions_one_per_customer unique (provider, provider_customer_id)
);
create index subscriptions_user_idx on subscriptions (user_id);

-- Idempotency for incoming purchase webhooks (they can arrive twice).
create table webhook_events (
  provider text not null,
  event_id text not null,
  received_at timestamptz not null default now(),
  primary key (provider, event_id)
);

-- Row level security.
alter table users enable row level security;
alter table daily_steps enable row level security;
alter table goals enable row level security;
alter table reminders enable row level security;
alter table subscriptions enable row level security;

create policy users_self on users
  for all using (id = auth.uid()) with check (id = auth.uid());
create policy daily_steps_owner on daily_steps
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy goals_owner on goals
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy reminders_owner on reminders
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy subscriptions_read_own on subscriptions
  for select using (user_id = auth.uid());
-- subscriptions: no insert/update policy for clients. Only the webhook (service role) writes.
-- webhook_events: no policies, so clients cannot read or write it at all.

-- updated_at maintenance
create or replace function touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger users_touch before update on users
  for each row execute function touch_updated_at();
create trigger daily_steps_touch before update on daily_steps
  for each row execute function touch_updated_at();
