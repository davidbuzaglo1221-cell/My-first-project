# רכיבים: מפרט

מקור הערכים: `tokens.json` (בהיר) ו-`tokens.dark.json` (כהה). אותם שמות תפקידים, ערכים שונים. הקוד: `web/src/components/`. עמוד הבדיקה: `/design`.

**כללים לכל הרכיבים:**
- RTL: רק תכונות לוגיות (`ms-`/`me-`/`ps-`/`pe-`/`start`/`end`/`border-s`). מספרים, זמנים ו"100 × 5" בתוך `<bdi dir="ltr">`.
- יעד מגע: לפחות 44px (`--layout-touch-min`). במתעד 52px (`--layout-touch-logger`), כי משתמשים בזה עם ידיים מזיעות.
- פוקוס: טבעת 2px בצבע `focus`, מרווח 2px, דרך `:focus-visible`.
- תנועה: `fast` 120ms, `base` 200ms, `slow` 320ms. עם `prefers-reduced-motion` הכול כמעט מיידי.
- מצבים: כל רכיב מוגדר במצב רגיל, לחוץ, פוקוס, מושבת, טוען, שגיאה וריק, כשהם רלוונטיים.
- אייקונים: Lucide (רישיון ISC). אין אייקונים, איורים או צלילים של Caliber.
- גופן: Heebo Variable (OFL), מותקן מקומית דרך `@fontsource-variable/heebo`, כך שעובד גם בלי רשת.

```
Button                                   web/src/components/ui/button.tsx
  variants  primary, secondary, soft, ghost, danger
  sizes     sm 36px, md 44px, lg 52px
  states    default, hover, active (scale .98), focus-visible, disabled (50%), loading (spinner + label stays)
  tokens    primary: bg accent / text on-accent / hover accent-hover; secondary: border border-input;
            soft: accent-soft + accent-ink; danger: danger + on-danger; radius sm/md; font semibold
  a11y      real <button>, type="button" by default, aria-busy while loading
  used on   all

IconButton
  sizes     md 44px, lg 52px, round
  a11y      `label` is required → aria-label + title
  used on   S06 (exercise menu), S10, S13, S21

Fab (+)
  size      56px, accent, shadow pop
  position  fixed, end side (left in RTL), above the tab bar, safe-area aware
  used on   S04 → opens S05

TextField                                web/src/components/ui/field.tsx
  parts     label, input, suffix (unit), hint, error
  height    48px, radius md, border border-input (3:1+), error → border danger
  states    default, focus-within ring, invalid (aria-invalid + aria-describedby → error text), disabled
  used on   S02, S11, S14, S23, S25, S26

SearchField
  height    44px, pill, surface-2
  a11y      role="search", type="search", clear button "ניקוי החיפוש"
  used on   S08, S09, food search (S27)

FilterChip
  height    36px, pill
  states    off: border + bg; on: accent border + accent-soft + accent-ink
  a11y      aria-pressed
  used on   S08, S09, S15

Segmented
  options   2–4, e.g. ק"ג/ליב', ראשון/שני, מערכת/בהיר/כהה
  a11y      role="radiogroup" + role="radio" + aria-checked
  used on   S26, S30

Card, Stat, SectionHeader, Banner, EmptyState, Skeleton   web/src/components/ui/surface.tsx
  Card      radius lg, border, shadow card, p-4
  Stat      label xs muted, value xl tabular, unit sm muted, hint xs
  Banner    tones info, success, warning, danger, offline. role=status (alert for danger)
  EmptyState icon in accent-soft circle, title lg, body sm muted, one action. Copy written per screen
  Skeleton  pulse on surface-2, aria-hidden
  used on   all lists and dashboards

TabBar                                   web/src/components/ui/tab-bar.tsx
  tabs      בית, אימונים, התקדמות, תזונה, פרופיל (right to left)
  height    64px + safe area, blur bg
  states    current: accent text + accent-soft pill behind icon, thicker stroke
  a11y      <nav aria-label="ניווט ראשי">, aria-current="page"
  hidden    while the logger keypad is open

BottomSheet + SheetAction                web/src/components/ui/bottom-sheet.tsx
  base      Radix Dialog: focus trap, Escape, overlay click, focus returns to trigger (checked: focus lands inside)
  shape     radius xl top, max 88dvh, grab handle, title + close, optional footer
  motion    slide up 320ms
  used on   S05 (+ menu), S08 (add exercise), exercise menu in S06

Toast                                    web/src/components/ui/toast.tsx
  tones     success (inverted), danger, pr (pr-soft + trophy)
  timing    3.5s, 6s when it has an action (ביטול)
  a11y      aria-live polite, assertive for danger
  used on   S06 (new PR), S12, deletes with undo

SetRow + SetHeader                       web/src/components/logger/set-row.tsx
  columns   סט | קודם | משקל | חזרות | ✓ (grid 2.5rem / 1fr / 4.5rem / 4rem / 3.25rem)
  kinds     work (number), warmup ח, drop י, failure כ. Tap the badge to cycle the kind
  previous  "100 × 5" from previous_sets(); empty fields show it as a placeholder (text-subtle)
  one-tap   ✓ on an empty row copies the previous values, marks done and starts rest
  states    planned, editing (field outlined in focus), done (row accent-soft, ✓ filled), PR (trophy pops)
  a11y      ✓ is role=checkbox; each field says "משקל, סט 2: ריק, בפעם הקודמת 100".
            Warmups are announced as "סט חימום", not by number
  behaviour the row being edited scrolls to the centre, above the keypad
  used on   S06, S14 (targets), S21

NumericKeypad                            web/src/components/logger/numeric-keypad.tsx
  layout    3×4 digits in phone order (dir=ltr even in RTL) + column of −step / +step / delete; "." and 0, "הבא" spans 2
  steps     weight 2.5 kg / 5 lb; reps 1
  behaviour first key replaces the value; up to 4 digits + 2 decimals; "הבא": weight → reps → close
  why       the Hebrew system keyboard switches language to type numbers; this keypad saves that step
  used on   S06

RestTimer                                web/src/components/logger/rest-timer.tsx
  variants  bar (inside the logger), full (S07)
  timing    computed from an absolute end time, so it stays right after the phone sleeps
  controls  −15, +15, דילוג / סגירה
  done      border + bg accent-soft, "לסט הבא!", vibrate; one assertive announcement (not every second)
  a11y      role=timer with "נותרו 1:30"
  used on   S06, S07

ExerciseCard                             web/src/components/logger/exercise-card.tsx
  parts     name, meta (שריר · ציוד), done/total sets, note (warning-soft), rows, "הוספת סט"
  superset  4px accent rail on the start side + "סופרסט א" tag
  states    in progress, complete (accent border), empty
  used on   S06, S14, S21

ProgressRing, MacroBar, ScoreBadge       web/src/components/progress/rings.tsx
  ring      132px, 12px stroke, starts at the top; over target → second lap in warning (not danger)
  centre    "נותרו" or "מעל היעד"
  macros    protein / carbs / fat colours (all ≥4.5:1 on bg), number always shown, so colour is never the only cue
  bars      fill from the start side (right in RTL); >110% → warning colour
  score     number + level pill (מתחיל, בינוני, מתקדם, מומחה, עילית) + weekly delta in words
  a11y      ring role=img with a full sentence; bars role=progressbar with aria-valuetext
  used on   S04, S18, S19, S27

OptionCard, StepProgress                 web/src/components/onboarding/option-card.tsx
  option    full-width, 2px border, icon tile, title + body, radio dot or checkbox square
  states    off, selected (accent border + accent-soft), focus
  a11y      role=radio inside radiogroup, or role=checkbox inside group (multiple)
  progress  "שאלה 3 מתוך 9" + bar filling from the start side
  used on   S02, S26
```

## עוד לבנות (במסכים, לא כפרימיטיבים)

| רכיב | הערות | מסכים |
| --- | --- | --- |
| LineChart / BarChart | Recharts. ציר הזמן משמאל לימין (מוסכמה), תוויות ומקרא בעברית בימין. מצב ריק "צריך עוד 2 אימונים" | S10, S18, S19, S23 |
| MuscleMap | SVG משלנו (חזית/גב), צבע לפי עומס. לא המפה שלהם | S18 |
| PhotoCompare | זה-לצד-זה + מחוון גרירה. התמונות מ-URL חתום | S24 |
| ShareCard | תמונה שנוצרת בטלפון (canvas) עם מיתוג שלנו | S12 |
| ExerciseMedia | וידאו/תמונה מספרייה פתוחה + קרדיט רישיון גלוי | S10 |
| BarcodeScanner | `BarcodeDetector` כשיש, אחרת ספרייה | S27 |
