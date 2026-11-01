import { useMemo, useState } from "react";
import { BarStrip, LineChart, Legend } from "../components/charts";
import { Card, ConfirmButton, Empty, Topbar, toast } from "../components/ui";
import { lastNDays, shortLabel, todayKey } from "../lib/dates";
import { checkInAverages, habitRate } from "../lib/stats";
import { setState, useAppState } from "../lib/store";
import { go } from "../lib/router";
import { randomId } from "../lib/id";
import type { Area, Habit } from "../lib/types";
import { AREA_LABEL } from "../content/actions";

const HABIT_LIBRARY: { area: Area; name: string }[] = [
  { area: "body", name: "הליכה של 20 דקות" },
  { area: "body", name: "כיבוי מסכים 20 דקות לפני שינה" },
  { area: "mind", name: "10 דקות קריאה בעיון" },
  { area: "mind", name: "בלוק עבודה של 25 דקות בלי הודעות" },
  { area: "work", name: "שיחת לקוח או פגישה אחת" },
  { area: "work", name: "בדיקה של מספר עסקי אחד" },
];

export function Tracking() {
  const state = useAppState();
  const [range, setRange] = useState<7 | 30>(7);
  const [habitName, setHabitName] = useState("");
  const [habitArea, setHabitArea] = useState<Area>("body");
  const [habitError, setHabitError] = useState("");
  const labels = lastNDays(range === 7 ? 7 : 30);
  const series = useMemo(() => labels.map((d) => state.days[d]?.checkIn), [labels, state.days]);
  const avg = checkInAverages(state, range === 7 ? 7 : 30);
  const activeHabits = state.habits.filter((h) => !h.archived);
  const history = [...labels].reverse().filter((d) => state.days[d]?.checkIn).slice(0, 14);
  const hasAnyCheckIn = Object.values(state.days).some((d) => d.checkIn);
  const weights = labels.map((d) => state.days[d]?.weight ?? null);
  const hasWeight = weights.some((w) => w !== null);

  const addHabit = (name: string, area: Area) => {
    const clean = name.trim();
    if (clean.length < 2) return setHabitError("נא להזין שם של לפחות שני תווים.");
    if (activeHabits.some((h) => h.name === clean)) return setHabitError("כבר יש הרגל בשם הזה.");
    setHabitError("");
    const habit: Habit = { id: randomId(), name: clean.slice(0, 60), area, createdAt: new Date().toISOString(), archived: false };
    setState((s) => ({ ...s, habits: [...s.habits, habit] }));
    setHabitName("");
    toast("ההרגל נוסף");
  };

  const toggleToday = (h: Habit) => {
    const today = todayKey();
    setState((s) => {
      const day = s.days[today] ?? { actions: [], habits: [] };
      const has = day.habits.includes(h.id);
      return { ...s, days: { ...s.days, [today]: { ...day, habits: has ? day.habits.filter((x) => x !== h.id) : [...day.habits, h.id] } } };
    });
  };

  return (
    <main className="page">
      <Topbar title="מעקב והתקדמות" eyebrow="מחושב מהנתונים שלך בלבד" />

      <div className="row" role="group" aria-label="טווח זמן">
        {([7, 30] as const).map((r) => (
          <button key={r} className="chip" aria-pressed={range === r} onClick={() => setRange(r)}>{r === 7 ? "שבוע" : "חודש"}</button>
        ))}
      </div>

      {!hasAnyCheckIn ? (
        <Empty title="עוד אין נתונים לגרפים" text="מלא צ'ק-אין יומי כדי שהגרפים יתמלאו. הם מציגים רק ימים שנרשמו, בלי להשלים נקודות." action={<button className="btn primary small-btn" onClick={() => go("/checkin")}>צ'ק-אין</button>} />
      ) : (
        <>
          <Card>
            <div className="stack" style={{ gap: 10 }}>
              <div className="row between"><h2>שינה ואנרגיה</h2><span className="small muted num">{avg.count} ימים</span></div>
              <LineChart labels={labels} height={150} min={1} max={5} series={[
                { label: "אנרגיה", color: "#a78bfa", values: series.map((c) => c?.energy ?? null) },
                { label: "לחץ", color: "#f08a8a", values: series.map((c) => c?.stress ?? null) },
                { label: "מצב רוח", color: "#5fd3a6", values: series.map((c) => c?.mood ?? null) },
              ]} />
              <Legend series={[{ label: "אנרגיה", color: "#a78bfa", values: [] }, { label: "לחץ", color: "#f08a8a", values: [] }, { label: "מצב רוח", color: "#5fd3a6", values: [] }]} />
            </div>
          </Card>

          <Card>
            <div className="stack" style={{ gap: 10 }}>
              <h2>שעות שינה</h2>
              <LineChart labels={labels} height={130} min={0} max={Math.max(9, ...series.map((c) => c?.sleepHours ?? 0), state.profile?.sleepTarget ?? 0)} series={[
                { label: "שעות שינה", color: "#8b5cf6", values: series.map((c) => c?.sleepHours ?? null) },
              ]} />
              <p className="small text-2">ממוצע בתקופה: <span className="num">{avg.sleepHours ?? "—"}</span> שעות · יעד שהגדרת: <span className="num">{state.profile?.sleepTarget}</span> שעות</p>
            </div>
          </Card>

          <Card>
            <div className="stack" style={{ gap: 10 }}>
              <div className="row between"><h2>פעילות גופנית</h2><span className="small muted">{avg.exercisedDays} ימים</span></div>
              <BarStrip labels={labels} values={series.map((c) => c?.exercised)} />
              <p className="small text-2">דקות למידה בתקופה: <span className="num">{avg.learningMinutes}</span></p>
            </div>
          </Card>

          {hasWeight ? (
            <Card>
              <div className="stack" style={{ gap: 10 }}>
                <h2>משקל</h2>
                <LineChart labels={labels} height={130} min={Math.min(...weights.filter((w): w is number => w !== null)) - 1} max={Math.max(...weights.filter((w): w is number => w !== null)) + 1} series={[{ label: "משקל", color: "#e7b35c", values: weights }]} />
                <p className="hint small">המשקל מוצג כפי שנרשם. תנודות יומיות הן נורמליות ואינן מדד לבדו.</p>
              </div>
            </Card>
          ) : null}
        </>
      )}

      <section className="stack" aria-labelledby="habits">
        <div className="section-title"><h2 id="habits">הרגלים</h2><span className="small muted">{activeHabits.length} פעילים</span></div>
        {activeHabits.length === 0 ? (
          <Empty title="עוד אין הרגלים" text="הוסף הרגל אחד שחשוב לך, או בחר מהספרייה למטה. עדיף הרגל אחד שאתה באמת מתכוון לעשות." />
        ) : (
          activeHabits.map((h) => {
            const done = (state.days[todayKey()]?.habits ?? []).includes(h.id);
            return (
              <Card key={h.id} className="flat">
                <div className="row between">
                  <div className="stack" style={{ gap: 2, minWidth: 0 }}>
                    <span className="small muted">{AREA_LABEL[h.area]}</span>
                    <strong>{h.name}</strong>
                    <span className="small text-2">{habitRate(state, h, 7)}% ב-7 ימים · {habitRate(state, h, 30)}% ב-30 ימים</span>
                  </div>
                  <button className="chip" aria-pressed={done} onClick={() => toggleToday(h)}>{done ? "בוצע היום" : "סמן להיום"}</button>
                </div>
                <div className="row" style={{ marginTop: 10, justifyContent: "flex-end" }}>
                  <ConfirmButton label="הסרה" confirmLabel="לאשר הסרה" className="btn danger small-btn" onConfirm={() => setState((s) => ({ ...s, habits: s.habits.map((x) => (x.id === h.id ? { ...x, archived: true } : x)) }))} />
                </div>
              </Card>
            );
          })
        )}

        <Card className="flat">
          <div className="stack" style={{ gap: 10 }}>
            <label className="field">
              הרגל חדש
              <input className="input" maxLength={60} value={habitName} aria-invalid={!!habitError} onChange={(e) => setHabitName(e.target.value)} placeholder="למשל: לכתוב שלוש שורות על היום" />
              {habitError ? <span className="error">{habitError}</span> : null}
            </label>
            <label className="field">
              תחום
              <select className="select" value={habitArea} onChange={(e) => setHabitArea(e.target.value as Area)}>
                <option value="body">גוף ושינה</option>
                <option value="mind">מחשבה והתנהגות</option>
                <option value="work">עבודה ועסק</option>
              </select>
            </label>
            <button className="btn primary block" onClick={() => addHabit(habitName, habitArea)}>הוספת הרגל</button>
            <div className="stack" style={{ gap: 6 }}>
              <span className="small muted">או מהספרייה:</span>
              <div className="row" style={{ flexWrap: "wrap", gap: 8 }}>
                {HABIT_LIBRARY.map((h) => (
                  <button key={h.name} className="chip" onClick={() => addHabit(h.name, h.area)} disabled={activeHabits.some((x) => x.name === h.name)}>{h.name}</button>
                ))}
              </div>
            </div>
          </div>
        </Card>
      </section>

      <section className="stack" aria-labelledby="hist">
        <h2 id="hist">היסטוריית צ'ק-אין</h2>
        {history.length === 0 ? <p className="small muted">אין צ'ק-אינים לתצוגה בתקופה הזו.</p> : history.map((d) => {
          const c = state.days[d].checkIn!;
          return (
            <Card key={d} className="flat">
              <div className="row between">
                <div className="stack" style={{ gap: 2 }}>
                  <strong className="num">{shortLabel(d)}</strong>
                  <span className="small text-2 num">שינה {c.sleepHours}ש׳ · אנרגיה {c.energy} · לחץ {c.stress} · מצב רוח {c.mood}</span>
                </div>
                <div className="row" style={{ gap: 6 }}>
                  <button className="btn small-btn" onClick={() => go(`/checkin?date=${d}`)}>עריכה</button>
                  <ConfirmButton label="מחיקה" confirmLabel="לאשר" className="btn danger small-btn" onConfirm={() => {
                    setState((s) => ({ ...s, days: { ...s.days, [d]: { ...s.days[d], checkIn: undefined } } }));
                    toast("הצ'ק-אין נמחק");
                  }} />
                </div>
              </div>
            </Card>
          );
        })}
      </section>

      <section className="stack" aria-labelledby="weekly">
        <div className="section-title"><h2 id="weekly">סקירות שבועיות</h2><button className="btn ghost small-btn" onClick={() => go("/week")}>סקירה חדשה</button></div>
        {state.weeklyReviews.length === 0 ? <p className="small muted">עוד לא נשמרו סקירות.</p> : [...state.weeklyReviews].sort((a, b) => (a.weekStart < b.weekStart ? 1 : -1)).slice(0, 8).map((w) => (
          <Card key={w.weekStart} className="flat">
            <strong className="num">שבוע {w.weekStart}</strong>
            {w.wins ? <p className="small text-2" style={{ marginTop: 4 }}>מה עבד: {w.wins}</p> : null}
            {w.nextWeek ? <p className="small text-2">שינוי לשבוע הבא: {w.nextWeek}</p> : null}
          </Card>
        ))}
      </section>
      <p className="hint small">{Object.values(state.days).length} ימים מתועדים בסך הכול. הנתונים נשמרים במכשיר הזה, ואפשר לייצא אותם מהפרופיל.</p>
    </main>
  );
}

