import { GOAL_LABEL } from "../content/actions";
import type { Goal, Profile, TimeMode } from "../lib/types";
import { Icon } from "./ui";

export type ProfileDraft = Omit<Profile, "createdAt">;

export const GOAL_ORDER: Goal[] = ["confidence", "discipline", "stress", "sleep", "health", "relationships", "communication", "sales", "business", "finance"];

export function validateDraft(d: ProfileDraft): Record<string, string> {
  const errors: Record<string, string> = {};
  if (d.name.trim().length < 2) errors.name = "נא להזין שם בן שני תווים לפחות.";
  if (d.goals.length === 0) errors.goals = "בחר לפחות מטרה אחת.";
  if (d.goals.length > 3) errors.goals = "אפשר לבחור עד שלוש מטרות כדי לשמור על פוקוס.";
  if (!Number.isFinite(d.sleepTarget) || d.sleepTarget < 4 || d.sleepTarget > 12) errors.sleepTarget = "יעד שינה צריך להיות בין 4 ל-12 שעות.";
  return errors;
}

export function ProfileFields({ draft, onChange, errors = {}, showName = true }: { draft: ProfileDraft; onChange: (d: ProfileDraft) => void; errors?: Record<string, string>; showName?: boolean }) {
  const set = <K extends keyof ProfileDraft>(k: K, v: ProfileDraft[K]) => onChange({ ...draft, [k]: v });
  const toggleGoal = (g: Goal) => {
    const has = draft.goals.includes(g);
    set("goals", has ? draft.goals.filter((x) => x !== g) : [...draft.goals, g]);
  };
  return (
    <div className="stack" style={{ gap: 18 }}>
      {showName ? (
        <label className="field">
          שם
          <input className="input" value={draft.name} maxLength={40} aria-invalid={!!errors.name} onChange={(e) => set("name", e.target.value)} placeholder="איך לקרוא לך?" />
          {errors.name ? <span className="error">{errors.name}</span> : null}
        </label>
      ) : null}

      <div className="stack" style={{ gap: 8 }}>
        <div className="row between">
          <span style={{ fontWeight: 600, color: "var(--text-2)", fontSize: 14 }}>מטרות (עד שלוש)</span>
          <span className="hint small num">{draft.goals.length}/3</span>
        </div>
        <div className="row" style={{ flexWrap: "wrap", gap: 8 }}>
          {GOAL_ORDER.map((g) => (
            <button key={g} type="button" className="chip" aria-pressed={draft.goals.includes(g)} onClick={() => toggleGoal(g)}>
              {GOAL_LABEL[g]}
            </button>
          ))}
        </div>
        {errors.goals ? <span className="error">{errors.goals}</span> : null}
      </div>

      <div className="stack" style={{ gap: 8 }}>
        <span style={{ fontWeight: 600, color: "var(--text-2)", fontSize: 14 }}>כמה זמן יש לך ביום?</span>
        <div className="grid-3">
          {([10, 20, 30] as TimeMode[]).map((m) => (
            <button key={m} type="button" className="chip" style={{ justifyContent: "center", minHeight: 58, flexDirection: "column", display: "flex", gap: 2 }} aria-pressed={draft.timeMode === m} onClick={() => set("timeMode", m)}>
              <span className="num" style={{ fontSize: 18, color: "var(--text)" }}>{m} דק׳</span>
              <span className="small">{m === 10 ? "מינימום" : m === 20 ? "סטנדרטי" : "אינטנסיבי"}</span>
            </button>
          ))}
        </div>
      </div>

      <label className="field">
        יעד שינה (שעות)
        <input className="input num-input" type="number" inputMode="decimal" step="0.5" min={4} max={12} value={draft.sleepTarget} aria-invalid={!!errors.sleepTarget} onChange={(e) => set("sleepTarget", Number(e.target.value))} />
        {errors.sleepTarget ? <span className="error">{errors.sleepTarget}</span> : <span className="hint">ברירת מחדל מקובלת למבוגרים היא 7 עד 9 שעות. זו העדפה אישית, לא המלצה רפואית.</span>}
      </label>

      <label className="field">
        המצב המקצועי
        <select className="select" value={draft.workStatus} onChange={(e) => set("workStatus", e.target.value as ProfileDraft["workStatus"])}>
          <option value="employee">שכיר/ה</option>
          <option value="self-employed">עצמאי/ת</option>
          <option value="business-owner">בעל/ת עסק</option>
          <option value="student">סטודנט/ית</option>
          <option value="other">אחר</option>
        </select>
      </label>

      <label className="field">
        ניסיון במכירות
        <select className="select" value={draft.salesExperience} onChange={(e) => set("salesExperience", e.target.value as ProfileDraft["salesExperience"])}>
          <option value="none">אין ניסיון מסודר</option>
          <option value="some">יש קצת ניסיון</option>
          <option value="experienced">יש ניסיון רב</option>
        </select>
      </label>

      <label className="field">
        מה מפריע לך בדרך כרגע? (לא חובה)
        <textarea className="textarea" maxLength={400} value={draft.obstacles} onChange={(e) => set("obstacles", e.target.value)} placeholder="למשל: קשה לי להתחיל בבוקר, אני נמנע משיחות מכירה..." />
      </label>
      <span className="hint small" style={{ display: "flex", gap: 6, alignItems: "center" }}><Icon name="spark" size={16} /> הנתונים נשמרים במכשיר הזה בלבד.</span>
    </div>
  );
}
