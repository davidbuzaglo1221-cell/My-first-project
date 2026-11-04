# Recon map: Steps (step-tracker app) (iOS, Android)

Scope: the core loop of a step-counter app: count steps, see today against a goal, browse history.
For: a clone for the user's own use or a niche product (not yet decided).
Date: 2026-11-04

Method note: this map is built from public App Store and Google Play listings and
editorial roundups only. No account was used, no screens were captured, and no app
internals were read. Screen states below are marked "from listing" (claimed by the
vendor) or "to verify" (needs the user's own click-through).

## Sources

| # | source | URL | notes |
| --- | --- | --- | --- |
| 1 | App Store, Steps - Simple Steps Tracker | https://apps.apple.com/us/app/steps-simple-steps-tracker/id6756535326 | history browser, weekly/monthly/yearly charts, goal ring, Apple Health read |
| 2 | App Store, Steps: Workout & Pedometer | https://apps.apple.com/us/app/surfshape/id6746096378 | custom goal, 8 home-screen widgets, watch complications, live steps in workouts |
| 3 | App Store, StepsApp Pedometer | https://apps.apple.com/ie/app/id1037595083?l=en-gb | goal notifications, weekly report, Pro: yearly trends, full history |
| 4 | App Store, 10k Steps - Daily step tracker | https://apps.apple.com/app/id777752947 | default 10k goal, 7/30/90/365-day trends, data stays on device |
| 5 | App Store, Step Tracker - Steps Insights | https://apps.apple.com/us/app/-/id6758876624 | Apple Health charts 7-day, 30-day, yearly; tap bar for detail |
| 6 | Editorial roundup | https://geekflare.com/best-pedometer-apps | core features: count, distance, calories, reports, goals |

## Core loop

Open the app, see today's step count against a goal, and the history of past days.

## Screens (from listings, to verify)

| ID | screen | route / how to reach | purpose | key components | states seen |
| --- | --- | --- | --- | --- | --- |
| S01 | Onboarding and permission | first launch | ask for motion or Health access, set a goal | permission prompt, goal stepper | to verify |
| S02 | Today (progress ring) | home tab | today's steps vs goal | progress ring, step count, distance, calories | empty (0 steps), filled, goal reached (from listing) |
| S03 | History / day detail | history tab, tap a bar | steps for one day | bar chart, day detail | empty, filled |
| S04 | Trends | history tab, range switch | 7-day, 30-day, weekly, monthly, yearly | segmented control, bar charts | filled, not enough data (to verify) |
| S05 | Goal settings | settings or Today | change the daily goal (default 10k) | number stepper, presets | default, custom |
| S06 | Reminders and notifications | settings | goal-reached and weekly-report notifications | toggles, time picker | off, on |
| S07 | Widgets | home screen, not in app | today's progress, streak, calendar | widget sizes | from listing (8 widgets claimed) |
| S08 | Paywall / Pro | upgrade prompt from history or trends | unlock full history, yearly trends | plan cards, restore button | from listing |
| S09 | Settings | gear icon | units, health sync, data | list rows, toggles | to verify |

## Flows

```
F01 Check today's progress
    S02 (open app, ring shows steps)
    happy path clicks: 0 (the app opens on Today)
    edge: no motion permission, phone sensor reports no steps, goal reached

F02 Change the daily goal
    S02 -> S05
    happy path clicks: 2
    edge: goal below current steps, invalid value

F03 Look at last week's history
    S02 -> S03 or S04 (history tab) -> pick a day or range
    happy path clicks: 2
    edge: no data for the range, data before install date

F04 Get a goal-reached notification
    S06 (enable) -> background -> notification
    happy path clicks: 3
    edge: permission denied, time zone change, midnight rollover

F05 Upgrade to Pro for full history
    S03 or S04 -> S08 -> purchase -> S04
    happy path clicks: 3
    edge: restore purchase, cancelled purchase, free tier limits
```

## Components

| component | variants | states | used on |
| --- | --- | --- | --- |
| Progress ring | small, large | empty, partial, goal reached | S02, widget |
| Bar chart | day, week, month, year | empty, filled, selected bar | S03, S04 |
| Segmented control | 2 to 5 options | default, selected | S04 |
| Stepper | integer | min, max, invalid | S05 |
| Toggle | on/off | default, disabled | S06, S09 |
| Paywall card | monthly, yearly, lifetime | default, selected, loading | S08 |
| Widget | small, medium, large | data, no data | S07 |

## Inferred data model

```
DailySteps   id, user_id (or device), date (local), steps, distance_m, calories, goal, source (device | health)
             evidence: S02, S03, S04 (charts per day); listings 1, 4, 5 (history on device or Health)
             confidence: high

Goal         id, user_id, steps_per_day, effective_from
             evidence: S05 stepper, listing 2 (custom daily goals)
             confidence: high

Reminder     id, user_id, type (goal_reached | weekly_report), time, enabled
             evidence: S06, listing 3
             confidence: medium

Subscription user_id, plan (free | pro), store_receipt, status
             evidence: S08, listing 3 (Pro tier)
             confidence: medium
```

Relationships: User 1-n DailySteps, User 1-1 Goal (current), User 1-n Reminder, User 0-1 Subscription.

Note: a phone-only clone can keep DailySteps on device, which is how listing 4 positions
its privacy. Pick a sync model in replica-architect.

## Feature matrix

See `features.csv`. 18 rows: must 7 to build, should 6, could 3, plus 2 skip rows (both must priority).

## Out of scope (cannot or should not be cloned)

- Phone motion sensor calibration and step-detection algorithm: the clone must use the platform's own step API (HealthKit / Health Connect / CoreMotion), not copied logic from any app.
- Apple Watch complications and widget designs: rebuild from platform docs, not from the original's assets.
- Original names, icons and screenshots: reference only, never shipped.
- Any app's paywall pricing copy and store description text: write your own.

## Size

Screens 9, flows 5, entities 4. Hard parts: reading steps from HealthKit or Health Connect with permission handling, background goal notifications, widgets, in-app purchase. Size: M (a few weeks for a solid v1).
