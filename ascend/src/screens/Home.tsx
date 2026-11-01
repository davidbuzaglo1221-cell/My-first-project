import { useMemo } from "react";
import { Card, Icon, Empty, Ring, toast } from "../components/ui";
import { AREA_LABEL } from "../content/actions";
import { lessonById } from "../content/lessons";
import { buildDailyPlan } from "../lib/plan";
import { currentStreak, longestStreak, isActiveDay, checkInAverages } from "../lib/stats";
import { setState, useAppState, updateDay } from "../lib/store";
import { todayKey, lastNDays, shortLabel } from "../lib/dates";
import { go } from "../lib/router";

function greetingFor(hour: number): string {
  if (hour < 5) return "לילה טוב";
  if (hour < 12) return "בוקר טוב";
  if (hour < 17) return "צהריים טובים";
  return "ערב טוב";
}

function progressMessage(done: number, total: number, hasCheckIn: boolean): string {
  if (total === 0) return "היום אין משימות בתוכנית. שווה לבדוק את הזמן שבחרת בפרופיל.";
  if (done === total) return "סיימת את כל המשימות של היום. זה מספיק טוב.";
  if (done === 0 && !hasCheckIn) return "היום מספיק צעד אחד. התחל מהקטן מבין השלושה.";
  if (done === 0) return "הצ'ק-אין נשמר. עכשיו בחר משימה אחת.";
  return `סיימת ${done} מתוך ${total}. עוד אחת, ואז צ'ק-אין קצר.`;
}

export function Home() {
  const state = useAppState();
  const profile = state.profile!;
  const today = todayKey();
  const plan = useMemo(() => buildDailyPlan(profile, today), [profile, today]);
  const day = state.days[today];
  const doneIds = day?.actions ?? [];
  const doneCount = plan.actions.filter((a) => doneIds.includes(a.id)).length;
  const streak = currentStreak(state);
  const best = longestStreak(state);
  const week = lastNDays(7).map((d) => ({ d, active: isActiveDay(state, d) }));
  const lastLesson = state.lastLessonId ? lessonById(state.lastLessonId) : undefined;
  const avg7 = checkInAverages(state, 7);
  const hour = new Date().getHours();

  const toggleAction = (id: string) => {
    const wasDone = doneIds.includes(id);
    setState((s) => updateDay(s, today, (d) => ({
      ...d,
      actions: wasDone ? d.actions.filter((x) => x !== id) : [...d.actions, id],
    })));
    if (!wasDone) toast("נרשם. עוד צעד לרצף.");
  };

  return (
    <main className="page" aria-label="מסך הבית">
      <header className="stack" style={{ gap: 4, paddingTop: 6 }}>
        <span className="eyebrow">{new Date().toLocaleDateString("he-IL", { weekday: "long", day: "numeric", month: "long" })}</span>
        <h1>{greetingFor(hour)}, {profile.name}.</h1>
        <p className="text-2">{progressMessage(doneCount, plan.actions.length, !!day?.checkIn)}</p>
      </header>

      <Card className="ink">
        <div className="row" style={{ gap: 18, alignItems: "center" }}>
          <Ring value={plan.actions.length ? (doneCount / plan.actions.length) * 100 : 0} label="התקדמות בתוכנית היום" />
          <div className="stack" style={{ gap: 4, minWidth: 0 }}>
            <span className="eyebrow">תוכנית היום</span>
            <h2 style={{ color: "var(--cream)" }}>{doneCount === plan.actions.length && plan.actions.length > 0 ? "הכול בוצע" : "הצעד הבא"}</h2>
            <span className="small" style={{ opacity: 0.75 }}>{plan.totalMinutes} מתוך {plan.budget} דקות · {doneCount}/{plan.actions.length} הושלמו</span>
          </div>
        </div>
      </Card>
      <div className="stack" style={{ marginTop: -6 }}>
          {plan.actions.map((a) => {
            const done = doneIds.includes(a.id);
            return (
              <button key={a.id} className="task" aria-pressed={done} onClick={() => toggleAction(a.id)}>
                <span className="check">{done ? <Icon name="check" size={16} /> : null}</span>
                <span className="stack" style={{ gap: 2, minWidth: 0 }}>
                  <span className="small muted">{AREA_LABEL[a.area]} · {a.minutes} דק׳</span>
                  <span className="task-title" style={{ fontWeight: 600 }}>{a.title}</span>
                  <span className="small text-2">{a.detail}</span>
                </span>
              </button>
            );
          })}
          {plan.skippedAreas.length > 0 ? (
            <p className="hint small">
              לא נכללו היום: {plan.skippedAreas.map((x) => AREA_LABEL[x]).join(", ")}. הזמן שבחרת לא מספיק עבורם. אפשר להגדיל את הזמן בפרופיל.
            </p>
          ) : null}
      </div>

      <section className="stack" aria-labelledby="score">
        <div className="section-title">
          <h2 id="score">היום שלך במספרים</h2>
          <button className="btn ghost small-btn" onClick={() => go("/checkin")}>{day?.checkIn ? "עריכה" : "צ'ק-אין"}</button>
        </div>
        {day?.checkIn ? (
          <div className="grid-2">
            <div className="stat"><div className="label">שינה</div><div className="value num">{day.checkIn.sleepHours}<span className="small muted"> ש׳</span></div></div>
            <div className="stat"><div className="label">אנרגיה</div><div className="value num">{day.checkIn.energy}<span className="small muted">/5</span></div></div>
            <div className="stat"><div className="label">לחץ</div><div className="value num">{day.checkIn.stress}<span className="small muted">/5</span></div></div>
            <div className="stat"><div className="label">מצב רוח</div><div className="value num">{day.checkIn.mood}<span className="small muted">/5</span></div></div>
          </div>
        ) : (
          <Card className="flat">
            <div className="row between">
          <div className="stack" style={{ gap: 2 }}>
                <strong>עוד לא מילאת צ'ק-אין היום</strong>
                <span className="small muted">כדקה: שינה, אנרגיה, לחץ, מצב רוח, אימון ולמידה.</span>
              </div>
              <button className="btn primary small-btn" onClick={() => go("/checkin")}>מלא</button>
            </div>
          </Card>
        )}
        {avg7.count > 0 ? <p className="hint small">ממוצע 7 ימים ({avg7.count} צ׳ק-אינים): שינה {avg7.sleepHours} שעות, אנרגיה {avg7.energy}/5, לחץ {avg7.stress}/5.</p> : null}
      </section>

      <section className="grid-2" aria-label="רצף">
        <div className="stat"><div className="label">רצף נוכחי</div><div className="value num">{streak} <span className="small muted">{streak === 1 ? "יום" : "ימים"}</span></div></div>
        <div className="stat"><div className="label">הרצף הארוך ביותר</div><div className="value num">{best} <span className="small muted">{best === 1 ? "יום" : "ימים"}</span></div></div>
      </section>
      <Card className="flat">
        <div className="row between" style={{ gap: 4 }}>
          {week.map((w) => (
            <div key={w.d} className="stack" style={{ gap: 6, justifyItems: "center", flex: 1 }}>
              <span className="small muted num">{shortLabel(w.d)}</span>
              <span style={{ width: 14, height: 14, borderRadius: 999, background: w.active ? "var(--ink)" : "var(--cream-2)", boxShadow: w.d === today && w.active ? "0 0 0 3px var(--soft)" : "none" }} aria-label={w.active ? "יום פעיל" : "אין רישום"} />
            </div>
          ))}
        </div>
        <p className="hint small" style={{ marginTop: 10 }}>יום נחשב פעיל אם נרשמה בו משימה, צ'ק-אין, הרגל או רפלקציה. הרצף מחושב מהנתונים שנשמרו בלבד.</p>
      </Card>

      <section className="stack" aria-labelledby="quick">
        <h2 id="quick">קיצורים</h2>
        <div className="grid-2">
          <QuickTile label="ללמוד שיעור" sub="כ-8 דקות" onClick={() => go(lastLesson ? `/train/lesson/${lastLesson.id}` : "/train")} />
          <QuickTile label="סימולטור מכירות" sub="סבב מלא עם משוב" onClick={() => go("/train/sales")} />
          <QuickTile label="לדבר עם המאמן" sub="שאלה אחת, צעד אחד" onClick={() => go("/coach")} />
          <QuickTile label="סקירה שבועית" sub="מה עבד, מה לא" onClick={() => go("/week")} />
        </div>
      </section>

      <section className="stack" aria-labelledby="review">
        <div className="section-title">
          <h2 id="review">רפלקציה יומית</h2>
          <button className="btn ghost small-btn" onClick={() => go("/review")}>{day?.review ? "עריכה" : "כתיבה"}</button>
        </div>
        {day?.review ? (
          <Card className="flat">
            <p className="text-2 small">המשימה החשובה למחר: {day.review.tomorrow || "לא נכתב"}</p>
          </Card>
        ) : (
          <Empty title="עוד לא כתבת רפלקציה היום" text="ארבע שאלות קצרות: מה עבד, מה אתגר אותי, מה למדתי, ומה הדבר החשוב למחר." action={<button className="btn primary small-btn" onClick={() => go("/review")}>לכתוב רפלקציה</button>} />
        )}
      </section>

    </main>
  );
}

function QuickTile({ label, sub, onClick }: { label: string; sub: string; onClick: () => void }) {
  return (
    <button className="list-item" style={{ flexDirection: "column", alignItems: "flex-start", gap: 4, minHeight: 92 }} onClick={onClick}>
      <strong>{label}</strong>
      <span className="small muted">{sub}</span>
    </button>
  );
}

