import { useState } from "react";
import { Card, ScaleInput, Toggle, Topbar, toast } from "../components/ui";
import { setState, useAppState, updateDay } from "../lib/store";
import { addDays, isDateKey, todayKey, weekStartKey } from "../lib/dates";
import { go } from "../lib/router";
import { checkInAverages } from "../lib/stats";
import type { CheckIn, Scale } from "../lib/types";
import { habitRate } from "../lib/stats";

function dayFromParam(param: string | null): string {
  const today = todayKey();
  if (!param || !isDateKey(param)) return today;
  // Editing is allowed for the last 30 days only, so the log stays a true record.
  if (param > today) return today;
  if (param < addDays(today, -30)) return addDays(today, -30);
  return param;
}

export function CheckIn({ dateParam }: { dateParam: string | null }) {
  const state = useAppState();
  const date = dayFromParam(dateParam);
  const existing = state.days[date]?.checkIn;
  const activeHabits = state.habits.filter((h) => !h.archived);
  const [sleepHours, setSleepHours] = useState(String(existing?.sleepHours ?? 7));
  const [sleepQuality, setSleepQuality] = useState<Scale>(existing?.sleepQuality ?? 3);
  const [energy, setEnergy] = useState<Scale>(existing?.energy ?? 3);
  const [stress, setStress] = useState<Scale>(existing?.stress ?? 3);
  const [mood, setMood] = useState<Scale>(existing?.mood ?? 3);
  const [exercised, setExercised] = useState(existing?.exercised ?? false);
  const [learning, setLearning] = useState(String(existing?.learningMinutes ?? 0));
  const [weight, setWeight] = useState(String(state.days[date]?.weight ?? ""));
  const [habits, setHabits] = useState<string[]>(state.days[date]?.habits ?? []);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const save = () => {
    const sh = Number(sleepHours.replace(",", "."));
    const lm = Number(learning);
    const w = weight.trim() === "" ? undefined : Number(weight.replace(",", "."));
    const e: Record<string, string> = {};
    if (!Number.isFinite(sh) || sh < 0 || sh > 24) e.sleepHours = "שעות שינה צריכות להיות בין 0 ל-24.";
    if (!Number.isFinite(lm) || lm < 0 || lm > 600) e.learning = "דקות למידה בין 0 ל-600.";
    if (w !== undefined && (!Number.isFinite(w) || w < 20 || w > 400)) e.weight = "משקל לא תקין. בדוק את המספר.";
    setErrors(e);
    if (Object.keys(e).length) return;
    const checkIn: CheckIn = { sleepHours: sh, sleepQuality, energy, stress, mood, exercised, learningMinutes: lm, savedAt: new Date().toISOString() };
    setState((s) => updateDay(s, date, (d) => ({ ...d, checkIn, habits, weight: w })));
    toast("הצ'ק-אין נשמר");
    go(dateParam ? "/track" : "/");
  };

  return (
    <main className="page">
      <Topbar title={date === todayKey() ? "צ'ק-אין יומי" : `צ'ק-אין ל-${date}`} eyebrow="כדקה ביום" onBack />
      <Card>
        <div className="stack" style={{ gap: 18 }}>
          <label className="field">
            כמה שעות ישנת? (השעה המדויקת לא חייבת להיות)
            <input className="input num-input" inputMode="decimal" value={sleepHours} aria-invalid={!!errors.sleepHours} onChange={(e) => setSleepHours(e.target.value)} />
            {errors.sleepHours ? <span className="error">{errors.sleepHours}</span> : null}
          </label>
          <ScaleInput label="איכות השינה" value={sleepQuality} onChange={setSleepQuality} low="לא טובה" high="מצוינת" />
          <ScaleInput label="אנרגיה" value={energy} onChange={setEnergy} low="נמוכה" high="גבוהה" />
          <ScaleInput label="לחץ" value={stress} onChange={setStress} low="נמוך" high="גבוה" />
          <ScaleInput label="מצב רוח" value={mood} onChange={setMood} low="קשה" high="טוב" />
          <Toggle label="התאמנתי או זזתי היום בכוונה" checked={exercised} onChange={setExercised} />
          <label className="field">
            דקות למידה היום
            <input className="input num-input" inputMode="numeric" value={learning} aria-invalid={!!errors.learning} onChange={(e) => setLearning(e.target.value)} />
            {errors.learning ? <span className="error">{errors.learning}</span> : null}
          </label>
          <label className="field">
            משקל (לא חובה, בק״ג)
            <input className="input num-input" inputMode="decimal" value={weight} aria-invalid={!!errors.weight} onChange={(e) => setWeight(e.target.value)} placeholder="למשל 78.4" />
            {errors.weight ? <span className="error">{errors.weight}</span> : null}
          </label>
        </div>
      </Card>

      {activeHabits.length > 0 ? (
        <Card className="flat">
          <div className="stack" style={{ gap: 10 }}>
            <h2>הרגלים</h2>
            {activeHabits.map((h) => (
              <Toggle key={h.id} label={h.name} checked={habits.includes(h.id)} onChange={(v) => setHabits((prev) => (v ? [...prev, h.id] : prev.filter((x) => x !== h.id)))} />
            ))}
          </div>
        </Card>
      ) : (
        <p className="hint small">אפשר להוסיף הרגלים במסך המעקב, והם יופיעו כאן.</p>
      )}

      <button className="btn primary block" onClick={save}>שמירה</button>
    </main>
  );
}

export function DailyReview({ dateParam }: { dateParam: string | null }) {
  const state = useAppState();
  const date = dayFromParam(dateParam);
  const saved = state.days[date]?.review;
  const [wentWell, setWentWell] = useState(saved?.wentWell ?? "");
  const [challenged, setChallenged] = useState(saved?.challenged ?? "");
  const [learned, setLearned] = useState(saved?.learned ?? "");
  const [tomorrow, setTomorrow] = useState(saved?.tomorrow ?? "");
  const [error, setError] = useState("");

  const save = () => {
    const values = [wentWell, challenged, learned, tomorrow].map((v) => v.trim());
    if (values.every((v) => !v)) return setError("כתוב לפחות תשובה אחת כדי לשמור.");
    setError("");
    setState((s) => updateDay(s, date, (d) => ({
      ...d,
      review: { wentWell: values[0], challenged: values[1], learned: values[2], tomorrow: values[3], savedAt: new Date().toISOString() },
    })));
    toast("הרפלקציה נשמרה");
    go(dateParam ? "/track" : "/");
  };

  const fields: [string, string, (v: string) => void, string][] = [
    ["מה עבד היום?", wentWell, setWentWell, "לא חייב להיות גדול. מה עשית טוב?"],
    ["מה אתגר אותי?", challenged, setChallenged, "מצב, מחשבה או משימה שדרשו ממני."],
    ["מה למדתי?", learned, setLearned, "משהו שאני יכול לבדוק או ליישם."],
    ["מה הדבר החשוב ביותר למחר?", tomorrow, setTomorrow, "משימה אחת, עם צעד ראשון."],
  ];

  return (
    <main className="page">
      <Topbar title="רפלקציה יומית" eyebrow={date === todayKey() ? "היום" : date} onBack />
      {fields.map(([label, value, set, ph]) => (
        <Card key={label}>
          <label className="field">
            {label}
            <textarea className="textarea" maxLength={600} value={value} placeholder={ph} onChange={(e) => set(e.target.value)} />
          </label>
        </Card>
      ))}
      {error ? <p className="error">{error}</p> : null}
      <button className="btn primary block" onClick={save}>שמירה</button>
      {saved ? <p className="hint small" style={{ textAlign: "center" }}>נשמר לאחרונה: {new Date(saved.savedAt).toLocaleString("he-IL")}</p> : null}
    </main>
  );
}

export function WeeklyReview() {
  const state = useAppState();
  const weekStart = weekStartKey();
  const existing = state.weeklyReviews.find((w) => w.weekStart === weekStart);
  const [wins, setWins] = useState(existing?.wins ?? "");
  const [blockers, setBlockers] = useState(existing?.blockers ?? "");
  const [nextWeek, setNextWeek] = useState(existing?.nextWeek ?? "");
  const [error, setError] = useState("");
  const stats = checkInAverages(state, 7);
  const habitsLine = state.habits.filter((h) => !h.archived).map((h) => `${h.name}: ${habitRate(state, h, 7)}%`);

  const save = () => {
    if (![wins, blockers, nextWeek].some((v) => v.trim())) return setError("כתוב לפחות תשובה אחת כדי לשמור.");
    setError("");
    setState((s) => ({
      ...s,
      weeklyReviews: [
        ...s.weeklyReviews.filter((w) => w.weekStart !== weekStart),
        { weekStart, wins: wins.trim(), blockers: blockers.trim(), nextWeek: nextWeek.trim(), savedAt: new Date().toISOString() },
      ],
    }));
    toast("הסקירה השבועית נשמרה");
    go("/track");
  };

  return (
    <main className="page">
      <Topbar title="סקירה שבועית" eyebrow={`השבוע שמתחיל ב-${weekStart}`} onBack />
      <Card className="flat">
        <h2 style={{ marginBottom: 8 }}>הנתונים של 7 הימים האחרונים</h2>
        {stats.count === 0 ? (
          <p className="small muted">אין עדיין צ'ק-אינים בשבוע האחרון. הנתונים יופיעו כאן אחרי שתמלא.</p>
        ) : (
          <ul className="small text-2" style={{ margin: 0, paddingInlineStart: 18 }}>
            <li>צ'ק-אינים: <span className="num">{stats.count}</span> מתוך 7 ימים</li>
            <li>שינה ממוצעת: <span className="num">{stats.sleepHours}</span> שעות</li>
            <li>אנרגיה ממוצעת: <span className="num">{stats.energy}</span>/5 · לחץ ממוצע: <span className="num">{stats.stress}</span>/5</li>
            <li>ימים עם אימון: <span className="num">{stats.exercisedDays}</span> · דקות למידה: <span className="num">{stats.learningMinutes}</span></li>
            {habitsLine.map((h) => <li key={h}>{h}</li>)}
          </ul>
        )}
      </Card>
      <Card>
        <div className="stack" style={{ gap: 14 }}>
          <label className="field">מה עבד השבוע?<textarea className="textarea" maxLength={800} value={wins} onChange={(e) => setWins(e.target.value)} /></label>
          <label className="field">מה עצר אותי?<textarea className="textarea" maxLength={800} value={blockers} onChange={(e) => setBlockers(e.target.value)} /></label>
          <label className="field">שינוי אחד לשבוע הבא<textarea className="textarea" maxLength={400} value={nextWeek} onChange={(e) => setNextWeek(e.target.value)} placeholder="דבר אחד, לא חמישה" /></label>
        </div>
      </Card>
      {error ? <p className="error">{error}</p> : null}
      <button className="btn primary block" onClick={save}>שמירת הסקירה</button>
    </main>
  );
}
