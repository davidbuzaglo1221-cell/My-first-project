"use client";

import { useCallback, useState } from "react";
import {
  Activity,
  Camera,
  Dumbbell,
  Flame,
  Plus,
  Scale,
  Timer,
  Trash2,
  Utensils,
} from "lucide-react";
import { Button, Fab, IconButton } from "@/components/ui/button";
import { FilterChip, SearchField, Segmented, TextField } from "@/components/ui/field";
import { Banner, EmptyState, Panel, SectionHeader, Skeleton, Stat } from "@/components/ui/surface";
import { BottomSheet, SheetAction } from "@/components/ui/bottom-sheet";
import { TabBar, type TabId } from "@/components/ui/tab-bar";
import { ToastProvider, useToast } from "@/components/ui/toast";
import { ExerciseCard } from "@/components/logger/exercise-card";
import { NumericKeypad } from "@/components/logger/numeric-keypad";
import { RestTimer } from "@/components/logger/rest-timer";
import { SET_KINDS, SetHeader, SetRow, type SetField, type SetKind, type SetValues } from "@/components/logger/set-row";
import { MacroBar, ProgressRing, ScoreBadge } from "@/components/progress/rings";
import { OptionCard, StepProgress } from "@/components/onboarding/option-card";
import { estimateOneRepMax, formatWeight, fromDisplayWeight, toDisplayWeight, type Units } from "@/lib/format";

const COLOR_ROLES = [
  "bg", "surface", "surface-2", "border", "border-input", "text", "text-muted", "text-subtle",
  "accent", "accent-hover", "on-accent", "accent-soft", "accent-ink", "danger", "danger-soft",
  "warning", "warning-soft", "pr", "pr-soft", "macro-protein", "macro-carbs", "macro-fat",
];

const TYPE_SCALE = ["xs", "sm", "base", "lg", "xl", "2xl", "display"] as const;
const typeClass: Record<(typeof TYPE_SCALE)[number], string> = {
  xs: "text-xs", sm: "text-sm", base: "text-base", lg: "text-lg", xl: "text-xl", "2xl": "text-2xl", display: "text-display",
};

type DemoSet = { id: number; kind: SetKind; values: SetValues; done: boolean; isPr?: boolean; previous: SetValues | null };

const initialSets: DemoSet[] = [
  { id: 1, kind: "warmup", values: { weightKg: 60, reps: 8 }, done: true, previous: { weightKg: 60, reps: 8 } },
  { id: 2, kind: "work", values: { weightKg: 100, reps: 5 }, done: true, previous: { weightKg: 100, reps: 5 } },
  { id: 3, kind: "work", values: { weightKg: null, reps: null }, done: false, previous: { weightKg: 100, reps: 5 } },
  { id: 4, kind: "work", values: { weightKg: null, reps: null }, done: false, previous: { weightKg: 100, reps: 4 } },
];

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-4">
      <h2 id={id} className="font-display text-2xl">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Demo() {
  const toast = useToast();
  const [theme, setTheme] = useState<"system" | "light" | "dark">("system");
  const [units, setUnits] = useState<Units>("kg");
  const [query, setQuery] = useState("");
  const [chips, setChips] = useState<Record<string, boolean>>({ חזה: true, רגליים: false, גב: false, "משקולות יד": false });
  const [sets, setSets] = useState(initialSets);
  const [editing, setEditing] = useState<{ id: number; field: SetField } | null>(null);
  const [draft, setDraft] = useState("");
  const [restEnd, setRestEnd] = useState<number | null>(null);
  const [restTotal, setRestTotal] = useState(120);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [tab, setTab] = useState<TabId>("workouts");
  const [goal, setGoal] = useState("build_muscle");
  const [equipment, setEquipment] = useState<string[]>(["dumbbell"]);
  const [loading, setLoading] = useState(false);

  const applyTheme = (t: typeof theme) => {
    setTheme(t);
    const root = document.documentElement;
    if (t === "system") root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", t);
  };

  const bestE1rm = Math.max(
    ...initialSets.filter((s) => s.previous?.weightKg && s.previous?.reps).map((s) => estimateOneRepMax(s.previous!.weightKg!, s.previous!.reps!) ?? 0),
  );

  const openField = (id: number, field: SetField) => {
    const s = sets.find((x) => x.id === id)!;
    const v = field === "weight" ? s.values.weightKg : s.values.reps;
    const shown = v == null ? "" : field === "weight" ? String(Number(toDisplayWeight(v, units).toFixed(2))) : String(v);
    setDraft(shown);
    setEditing({ id, field });
  };

  const commitDraft = (raw: string) => {
    setDraft(raw);
    if (!editing) return;
    const n = raw === "" ? null : Number(raw);
    setSets((all) =>
      all.map((s) =>
        s.id !== editing.id
          ? s
          : {
              ...s,
              values:
                editing.field === "weight"
                  ? { ...s.values, weightKg: n == null ? null : fromDisplayWeight(n, units) }
                  : { ...s.values, reps: n == null ? null : Math.round(n) },
            },
      ),
    );
  };

  const nextField = () => {
    if (!editing) return;
    if (editing.field === "weight") return openField(editing.id, "reps");
    setEditing(null);
  };

  const startRest = useCallback((sec: number) => {
    setRestTotal(sec);
    setRestEnd(Date.now() + sec * 1000);
  }, []);

  const toggleDone = (id: number) => {
    setEditing(null);
    setSets((all) =>
      all.map((s) => {
        if (s.id !== id) return s;
        if (s.done) return { ...s, done: false, isPr: false };
        // One-tap set: empty fields take last time's numbers.
        const values = {
          weightKg: s.values.weightKg ?? s.previous?.weightKg ?? null,
          reps: s.values.reps ?? s.previous?.reps ?? null,
        };
        const e1rm = values.weightKg && values.reps ? estimateOneRepMax(values.weightKg, values.reps) ?? 0 : 0;
        const isPr = s.kind !== "warmup" && e1rm > bestE1rm + 0.01;
        if (isPr) {
          toast({ tone: "pr", message: `שיא אישי חדש! ${formatWeight(values.weightKg!, units)} × ${values.reps}` });
        }
        startRest(s.kind === "warmup" ? 60 : 120);
        return { ...s, values, done: true, isPr };
      }),
    );
  };

  const cycleKind = (id: number) =>
    setSets((all) =>
      all.map((s) => (s.id === id ? { ...s, kind: SET_KINDS[(SET_KINDS.indexOf(s.kind) + 1) % SET_KINDS.length] } : s)),
    );

  const addSet = () =>
    setSets((all) => {
      const last = all[all.length - 1];
      return [...all, { id: Date.now(), kind: "work", values: { weightKg: null, reps: null }, done: false, previous: last?.previous ?? null }];
    });

  const editingSet = editing ? sets.find((s) => s.id === editing.id) : null;
  const doneCount = sets.filter((s) => s.done).length;

  return (
    <div className="mx-auto flex max-w-(--layout-max-width) flex-col gap-8 px-4 pt-6 pb-[calc(var(--layout-tabbar-height)+18rem)]">
      <header className="flex flex-col gap-3">
        <h1 className="font-display text-[2.5rem] leading-tight">מערכת העיצוב</h1>
        <p className="text-text-muted">
          עמוד בדיקה: כל רכיב בכל המצבים, בעברית ומימין לשמאל. הערכים מגיעים מ-<bdi dir="ltr">tokens.json</bdi>.
        </p>
        <Segmented
          label="ערכת צבעים"
          value={theme}
          onChange={applyTheme}
          options={[
            { value: "system", label: "מערכת" },
            { value: "light", label: "בהיר" },
            { value: "dark", label: "כהה" },
          ]}
        />
      </header>

      <Section id="colors" title="צבעים">
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {COLOR_ROLES.map((role) => (
            <li key={role} className="glass flex items-center gap-2 rounded-md p-2">
              <span className="size-8 shrink-0 rounded-sm shadow-[inset_0_0_0_1px_var(--g-border)]" style={{ background: `var(--c-${role})` }} />
              <bdi dir="ltr" className="truncate text-xs text-text-muted">
                {role}
              </bdi>
            </li>
          ))}
        </ul>
      </Section>

      <Section id="type" title="טיפוגרפיה">
        <div className="flex flex-col gap-2">
          {TYPE_SCALE.map((t) => (
            <p key={t} className={typeClass[t]}>
              אימון כוח 100 ק״ג <span className="text-xs text-text-subtle">({t})</span>
            </p>
          ))}
          <p className="figure text-display">
            <bdi dir="ltr">142.5</bdi>
          </p>
          <p className="figure text-timer">
            <bdi dir="ltr">1:45</bdi>
          </p>
        </div>
      </Section>

      <Section id="buttons" title="כפתורים">
        <div className="flex flex-wrap gap-2">
          <Button>התחלת אימון</Button>
          <Button variant="secondary">ביטול</Button>
          <Button variant="soft" icon={<Plus aria-hidden className="size-4" />}>
            הוספת תרגיל
          </Button>
          <Button variant="ghost">דילוג</Button>
          <Button variant="danger" icon={<Trash2 aria-hidden className="size-4" />}>
            מחיקה
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm">קטן</Button>
          <Button size="md">בינוני</Button>
          <Button size="lg">גדול</Button>
          <Button disabled>מושבת</Button>
          <Button
            loading={loading}
            onClick={() => {
              setLoading(true);
              setTimeout(() => setLoading(false), 1500);
            }}
          >
            שמירה
          </Button>
        </div>
        <Button size="lg" fullWidth>
          סיום אימון
        </Button>
        <div className="flex gap-2">
          <IconButton label="טיימר">
            <Timer aria-hidden className="size-5" />
          </IconButton>
          <IconButton label="הוספה" variant="soft">
            <Plus aria-hidden className="size-5" />
          </IconButton>
          <IconButton label="מחיקה" variant="glass">
            <Trash2 aria-hidden className="size-5" />
          </IconButton>
        </div>
      </Section>

      <Section id="fields" title="שדות וסינון">
        <TextField label="משקל גוף" inputMode="decimal" defaultValue="78.5" suffix='ק"ג' hint="הבוקר, לפני ארוחת בוקר" />
        <TextField label="שם התבנית" defaultValue="" placeholder="למשל: רגליים A" error="צריך לתת שם לתבנית" />
        <SearchField value={query} onChange={setQuery} placeholder="חיפוש תרגיל: סקוואט, לחיצת חזה..." />
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
          {Object.keys(chips).map((c) => (
            <FilterChip key={c} selected={chips[c]} onToggle={() => setChips((x) => ({ ...x, [c]: !x[c] }))}>
              {c}
            </FilterChip>
          ))}
        </div>
        <Segmented
          label="יחידות משקל"
          value={units}
          onChange={setUnits}
          options={[
            { value: "kg", label: 'ק"ג' },
            { value: "lb", label: "ליב'" },
          ]}
        />
      </Section>

      <Section id="logger" title="מתעד אימון">
        <Banner tone="info">אין חיבור. הכול נשמר בטלפון ויסתנכרן כשהרשת תחזור.</Banner>
        <RestTimer
          endsAt={restEnd}
          totalSec={restTotal}
          onAdjust={(d) => {
            setRestEnd((e) => (e == null ? e : Math.max(Date.now(), e + d * 1000)));
            setRestTotal((t) => Math.max(0, t + d));
          }}
          onSkip={() => setRestEnd(null)}
          onDone={() => navigator.vibrate?.([200, 100, 200])}
        />
        {restEnd == null && (
          <Button variant="soft" onClick={() => startRest(90)} icon={<Timer aria-hidden className="size-4" />}>
            הדגמת טיימר מנוחה (1:30)
          </Button>
        )}
        <ExerciseCard
          name="סקוואט עם מוט"
          tags={["רגליים", "מוט"]}
          note="ירידה עד מתחת למקביל, ברכיים בכיוון האצבעות"
          doneCount={doneCount}
          totalCount={sets.length}
          onAddSet={addSet}
          onMenu={() => setSheetOpen(true)}
        >
          <SetHeader units={units} />
          {sets.map((s, i) => (
            <SetRow
              key={s.id}
              number={sets.slice(0, i + 1).filter((x) => x.kind !== "warmup").length}
              kind={s.kind}
              previous={s.previous}
              values={s.values}
              done={s.done}
              isPr={s.isPr}
              units={units}
              activeField={editing?.id === s.id ? editing.field : null}
              onFieldFocus={(f) => openField(s.id, f)}
              onToggleDone={() => toggleDone(s.id)}
              onCycleKind={() => cycleKind(s.id)}
            />
          ))}
        </ExerciseCard>
        <ExerciseCard name="לחיצת חזה" tags={["חזה", "מוט"]} supersetLabel="א" doneCount={0} totalCount={0} onAddSet={() => {}}>
          <p className="py-2 text-center text-sm text-text-subtle">עוד אין סטים. בפעם הקודמת: 3 סטים של 80 ק״ג × 8</p>
        </ExerciseCard>
        <p className="text-sm text-text-muted">
          לנסות: ✓ בשורה ריקה ממלא את מה שעשית בפעם הקודמת ומפעיל מנוחה. לגעת במשקל פותח מקלדת. הסט האחרון (100 × 5) ייתן
          שיא חדש אם תעלה משקל.
        </p>
      </Section>

      <Section id="progress" title="התקדמות ותזונה">
        <Panel className="flex flex-col gap-4">
          <SectionHeader title="ציון כוח" action={<Button variant="ghost" size="sm">למה?</Button>} />
          <ScoreBadge score={342} level="intermediate" delta={12} size="lg" />
          <p className="text-sm text-text-muted">
            עלה ב-12: שיא חדש בסקוואט (<bdi dir="ltr">100 × 5</bdi>). החזה לא השתנה.
          </p>
        </Panel>
        <Panel className="flex flex-col items-center gap-5">
          <ProgressRing value={1650} target={2400} label="קלוריות" unit="קלוריות" />
          <div className="flex w-full flex-col gap-3">
            <MacroBar macro="protein" value={128} target={165} />
            <MacroBar macro="carbs" value={180} target={260} />
            <MacroBar macro="fat" value={84} target={70} />
          </div>
        </Panel>
        <div className="grid grid-cols-3 gap-2">
          <Stat label="אימונים השבוע" value="3" hint="מתוך 4" />
          <Stat label="נפח" value="12,400" unit='ק"ג' />
          <Stat label="משקל" value="78.5" unit='ק"ג' hint={<bdi dir="ltr">−0.4</bdi>} />
        </div>
        <div className="flex flex-col gap-2">
          <Skeleton className="h-6 w-1/2" />
          <Skeleton className="h-24" />
        </div>
      </Section>

      <Section id="states" title="מצבים ריקים והודעות">
        <EmptyState
          icon={<Dumbbell aria-hidden className="size-7" />}
          title="עוד אין אימונים"
          body="האימון הראשון שלך יופיע כאן, עם כל הסטים והשיאים."
          action={<Button>התחלת אימון ראשון</Button>}
        />
        <Banner tone="success">האימון נשמר. 5 סטים, 2 שיאים חדשים.</Banner>
        <Banner tone="warning">יש אימון פתוח מאתמול. להמשיך אותו או לסגור?</Banner>
        <Banner tone="danger">השמירה נכשלה. ננסה שוב אוטומטית.</Banner>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => toast({ tone: "success", message: "האימון נשמר" })}>
            הודעת הצלחה
          </Button>
          <Button
            variant="secondary"
            onClick={() => toast({ tone: "success", message: "הסט נמחק", action: { label: "ביטול", onClick: () => {} } })}
          >
            עם ביטול
          </Button>
          <Button variant="secondary" onClick={() => toast({ tone: "danger", message: "אין חיבור לשרת" })}>
            שגיאה
          </Button>
        </div>
      </Section>

      <Section id="onboarding" title="אונבורדינג">
        <StepProgress step={3} total={9} />
        <h3 className="text-xl">מה המטרה העיקרית שלך?</h3>
        <div role="radiogroup" aria-label="מטרה" className="flex flex-col gap-2">
          {[
            { v: "lose_fat", t: "ירידה בשומן", b: "לרדת במשקל ולשמור על השריר", i: <Flame aria-hidden className="size-5" /> },
            { v: "build_muscle", t: "בניית שריר", b: "לעלות במסת שריר", i: <Dumbbell aria-hidden className="size-5" /> },
            { v: "strength", t: "כוח", b: "להרים יותר", i: <Activity aria-hidden className="size-5" /> },
          ].map((o) => (
            <OptionCard key={o.v} selected={goal === o.v} onSelect={() => setGoal(o.v)} title={o.t} body={o.b} icon={o.i} />
          ))}
        </div>
        <h3 className="text-xl">איזה ציוד יש לך?</h3>
        <div role="group" aria-label="ציוד" className="flex flex-col gap-2">
          {[
            { v: "gym", t: "חדר כושר מלא" },
            { v: "dumbbell", t: "משקולות יד" },
            { v: "bodyweight", t: "משקל גוף בלבד" },
          ].map((o) => (
            <OptionCard
              key={o.v}
              multiple
              selected={equipment.includes(o.v)}
              onSelect={() => setEquipment((e) => (e.includes(o.v) ? e.filter((x) => x !== o.v) : [...e, o.v]))}
              title={o.t}
            />
          ))}
        </div>
      </Section>

      <BottomSheet open={sheetOpen} onOpenChange={setSheetOpen} title="מה להוסיף?">
        <SheetAction icon={<Dumbbell aria-hidden className="size-5" />} label="אימון כוח" hint="מתבנית או ריק" onClick={() => setSheetOpen(false)} />
        <SheetAction icon={<Activity aria-hidden className="size-5" />} label="קרדיו" onClick={() => setSheetOpen(false)} />
        <SheetAction icon={<Scale aria-hidden className="size-5" />} label="שקילה" onClick={() => setSheetOpen(false)} />
        <SheetAction icon={<Camera aria-hidden className="size-5" />} label="תמונת התקדמות" hint="פרטית, רק לך" onClick={() => setSheetOpen(false)} />
        <SheetAction icon={<Utensils aria-hidden className="size-5" />} label="ארוחה" onClick={() => setSheetOpen(false)} />
      </BottomSheet>

      {editing && editingSet ? (
        <div className="fixed inset-x-0 bottom-0 z-40 mx-auto max-w-(--layout-max-width)">
          <NumericKeypad
            key={`${editing.id}-${editing.field}`}
            label={editing.field === "weight" ? `משקל (${units === "kg" ? 'ק"ג' : "ליב'"})` : "חזרות"}
            value={draft}
            onChange={commitDraft}
            step={editing.field === "weight" ? (units === "kg" ? 2.5 : 5) : 1}
            allowDecimal={editing.field === "weight"}
            onNext={nextField}
            onDone={() => setEditing(null)}
          />
        </div>
      ) : (
        <>
          <Fab label="הוספה" onClick={() => setSheetOpen(true)}>
            <Plus aria-hidden className="size-7" />
          </Fab>
          <TabBar active={tab} onSelect={setTab} />
        </>
      )}
    </div>
  );
}

export default function DesignPage() {
  return (
    <ToastProvider>
      <Demo />
    </ToastProvider>
  );
}

