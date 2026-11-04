# Architecture: Steps clone

Input: `replica-steps/recon.md`, `replica-steps/features.csv`
Schema: `replica-steps/schema.sql`
Date: 2026-11-04

## Step 1: the stack

The product is a phone app that reads step data the phone already has. So the
client is native-first, and the server is optional.

| layer | choice | why |
| --- | --- | --- |
| mobile app | Expo (React Native) with a small native module for HealthKit and Health Connect | one codebase for iOS and Android; the health APIs need native code either way |
| local data | SQLite (expo-sqlite) | v1 works with no account, offline, and the step history stays on the phone |
| step source | HealthKit (iOS), Health Connect (Android) | the platform's own step store; never a copied step algorithm |
| background work | the platform's background delivery plus local notifications | goal-reached and weekly-report notifications need no server |
| widgets | expo-widgets or native WidgetKit / Glance | the recon lists 8 widgets; these must be native, so this is a native task |
| backend | Supabase (Postgres, Auth, Storage) | one managed database; only needed for sign-in and sync |
| sync API | Supabase Edge Functions | small, few routes; no separate server |
| purchases | RevenueCat over StoreKit and Play Billing | Stripe is not allowed for in-app digital goods on iOS or Android |
| email | none in v1 | the app has no email flows in the recon |
| hosting | none beyond Supabase | no web app in scope |

Not used: a web app, Stripe Checkout, Resend, a job queue. The recon has no
server-side jobs. Reminders are scheduled on the device.

Risk to check now: the recon listed Apple Health and Health Connect as the data
source, so the clone needs both native modules and both permission flows. Expo
has no built-in HealthKit; budget time for it.

## Step 2: the schema

See `replica-steps/schema.sql`. Summary:

| table | rows per | owner | notes |
| --- | --- | --- | --- |
| users | account | self | only for sign-in and sync; local-only users have no row |
| daily_steps | user, local day, source | user | unique per (user, local_date, source); local date, not UTC |
| goals | goal change | user | history, so changing the goal does not rewrite past days |
| reminders | reminder | user | goal_reached (daily) and weekly_report (one weekday) |
| subscriptions | purchase customer | user | written only by the RevenueCat webhook |
| webhook_events | webhook delivery | none | idempotency for webhooks; clients have no access |

6 tables (4 user-owned, plus `subscriptions` and `webhook_events`).

Access rules: Supabase row level security on every table. Clients can read and
write only their own rows. Subscriptions are written only by the webhook, with
the service role.

Local schema (SQLite, on the phone) mirrors `daily_steps`, `goals`, and
`reminders`, without RLS and with a `synced` flag per row.

Hard constraints from the recon:
- Two rows for the same day and source cannot exist: unique constraint.
- Goal changes apply from a date, not retroactively: `goals.effective_from`.
- Step counts never go negative: check constraint.

## Step 3: the API

Only official APIs with the user's own keys. Nothing copied from the original.

Client-facing routes (Supabase Edge Functions, all require a signed-in user; the
local-only app calls none of them):

| method path | what it does | who | input | output | flow |
| --- | --- | --- | --- | --- | --- |
| POST /auth/sign-in | sign in with email or Apple/Google | anyone | provider token | session | sign-in (optional) |
| POST /sync/steps | upsert the device's daily steps | owner | array of {local_date, steps, distance_m, calories_kcal, source, device_id} | {accepted, rejected} | F01 (sync) |
| GET /sync/steps?since=date | pull days changed on other devices | owner | since date | rows | F03 (second device) |
| PUT /goal | set goal from a date | owner | steps_per_day, effective_from | goal row | F02 |
| GET /goal/current | current goal | owner | none | goal row | F01, F02 |
| PUT /reminders/:kind | set a reminder | owner | local_time, weekday, enabled | reminder row | F04 |
| GET /subscription | plan status | owner | none | plan, status, period end | F05 |

Webhook in:

| method path | what it does | who |
| --- | --- | --- |
| POST /webhooks/revenuecat | update subscriptions; dedupe by event id | RevenueCat, with its shared-secret header |

Background jobs: none on the server. Goal-reached and weekly-report
notifications are local, scheduled on the device.

## Step 4: the parts that bite

- **Time zones and daylight saving:** days are stored as local dates per user.
  Travel changes the timezone, so a day's total is fixed when the day ends, not
  recomputed later. Decide and test the midnight rollover.
- **Idempotency:** `/sync/steps` upserts on (user, local_date, source), so a
  retry is safe. The RevenueCat webhook dedupes with `webhook_events`.
- **Race conditions:** two devices syncing the same day: the server keeps the
  larger step count per source, never sums it. Write this rule down, then test
  it.
- **Permission denied:** HealthKit does not say whether read access was refused.
  The app must treat zero steps as "unknown" when no data has ever arrived.
- **Sensor gaps:** a phone with no motion data reports zero. Show "no data" in
  the UI, not "0 steps".
- **Background reads:** the platform decides when the app wakes. Do not promise
  real-time counts; sync when the app opens and in the background when allowed.
- **Notification delivery:** local notifications fire only if the OS allows them;
  test the denied-permission state.
- **Deletion (GDPR):** account deletion removes the user and cascades to all
  rows. Local data is deleted by the app, on the device.
- **Price and entitlement checks:** the paywall must be checked server-side from
  the webhook, not trusted from the client.

## Step 5: build order

1. **Vertical slice (local, no account):** install, grant HealthKit or Health
   Connect permission, see today's steps against the goal (F01). Proves the
   native step read on both platforms.
   Screens: S01 (partial), S02. Tables: local `daily_steps`, `goals`.
2. **Must-haves from `features.csv`:**
   - Goal settings (F02): S05. Table: `goals`.
   - Daily history and charts (F03): S03, S04. Table: `daily_steps`.
   - Goal-reached notification (F04): S06. Table: `reminders`.
   - Permission-denied handling: S01.
3. **Should-haves:** distance and calories, weekly report, streak, widgets (S07),
   tap-to-detail on charts, units (S09).
   Tables: `reminders` (weekly_report).
4. **Could-haves:** live workout steps, Apple Watch complication, Pro (S08).
   Tables: `subscriptions`, `webhook_events`. Routes: `/subscription`, `/webhooks/revenuecat`.
5. **Sign-in and sync (only if wanted):** `users`, `/auth/sign-in`,
   `/sync/steps`, RLS. This is not in the recon's must-haves, so it is optional.
6. **Fixes from replica-entrepreneur:** after it has run.

## Output

Stack in one line: Expo + native HealthKit / Health Connect, local SQLite,
optional Supabase for sync, RevenueCat for Pro.

Tables: 6 (plus local SQLite mirror). Routes: 7 client routes, 1 webhook.

Three riskiest parts:
1. Native step reads on both platforms (HealthKit and Health Connect permissions and background delivery).
2. Widgets and the Apple Watch complication, both native work.
3. Sync conflict rules between devices (if sync is built).

Next step: `/replica-design`.
