import { useRef, useState } from "react";
import { ProfileFields, validateDraft, type ProfileDraft } from "../components/ProfileFields";
import { Card, ConfirmButton, Topbar, toast } from "../components/ui";
import { exportStateJson, downloadText } from "../lib/export";
import { replaceState, resetState, sanitizeState, setState, useAppState } from "../lib/store";
import { todayKey } from "../lib/dates";
import { go } from "../lib/router";
import { GOAL_LABEL } from "../content/actions";
import { getCoachToken, setCoachToken } from "../lib/coach";

export function Profile() {
  const state = useAppState();
  const profile = state.profile!;
  const { createdAt, ...base } = profile;
  const [draft, setDraft] = useState<ProfileDraft>(base);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [importError, setImportError] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const dirty = JSON.stringify(draft) !== JSON.stringify(base);

  const save = () => {
    const e = validateDraft(draft);
    setErrors(e);
    if (Object.keys(e).length) return;
    setState((s) => ({ ...s, profile: { ...draft, name: draft.name.trim(), obstacles: draft.obstacles.trim(), createdAt } }));
    toast("הפרופיל עודכן");
  };

  const importFile = async (file: File) => {
    setImportError("");
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as { data?: unknown };
      const raw = parsed && typeof parsed === "object" && "data" in parsed ? parsed.data : parsed;
      const next = sanitizeState(raw);
      if (!next.profile) throw new Error("no-profile");
      replaceState(next);
      toast("הגיבוי שוחזר");
    } catch {
      setImportError("הקובץ לא נראה כמו גיבוי של ASCEND. לא בוצע שינוי בנתונים.");
    }
  };

  const [coachCode, setCoachCode] = useState(getCoachToken());
  const daysCount = Object.keys(state.days).length;

  return (
    <main className="page">
      <Topbar title="פרופיל והגדרות" eyebrow="התאמה אישית" />
      <Card>
        <div className="stack" style={{ gap: 18 }}>
          <ProfileFields draft={draft} onChange={setDraft} errors={errors} />
          <button className="btn primary block" disabled={!dirty} onClick={save}>{dirty ? "שמירת שינויים" : "אין שינויים לשמירה"}</button>
        </div>
      </Card>

      <Card className="flat">
        <h2 style={{ marginBottom: 6 }}>המטרות הפעילות</h2>
        <div className="row" style={{ flexWrap: "wrap", gap: 8 }}>
          {profile.goals.map((g) => <span key={g} className="pill accent">{GOAL_LABEL[g]}</span>)}
        </div>
      </Card>

      <Card>
        <h2 style={{ marginBottom: 8 }}>הנתונים שלך</h2>
        <p className="small text-2" style={{ marginBottom: 12 }}>
          כל המידע נשמר בדפדפן הזה בלבד ({daysCount} ימים מתועדים, {state.habits.length} הרגלים, {Object.keys(state.lessons).length} שיעורים עם התקדמות). אין חשבון ואין שליחה לשרת.
        </p>
        <div className="stack" style={{ gap: 10 }}>
          <button className="btn block" onClick={() => {
            downloadText(`ascend-${todayKey()}.json`, exportStateJson(state), "application/json");
            toast("הגיבוי הורד");
          }}>ייצוא גיבוי מלא (JSON)</button>
          <button className="btn block" onClick={() => fileInput.current?.click()}>שחזור מגיבוי</button>
          <input ref={fileInput} type="file" accept="application/json,.json" hidden onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) importFile(f);
            e.target.value = "";
          }} />
          {importError ? <p className="error small">{importError}</p> : null}
          <p className="hint small">שחזור מחליף את הנתונים הנוכחיים. כדי לא לאבד משהו, שמור קודם גיבוי.</p>
        </div>
      </Card>

      <Card className="flat">
        <div className="stack" style={{ gap: 10 }}>
          <h2>מאמן מבוסס מודל שפה (אופציונלי)</h2>
          <p className="small text-2">
            האפליקציה עובדת במלואה גם בלי זה. כדי להפעיל תשובות של מודל שפה, מפתח ה-API נשמר כמשתנה סביבה בשרת, לא בקוד הדפדפן:
          </p>
          <ol className="small text-2" style={{ margin: 0, paddingInlineStart: 18, display: "grid", gap: 4 }}>
            <li>ב-Vercel (או בשרת משלך) מגדירים את <code className="num">ANTHROPIC_API_KEY</code>.</li>
            <li>מגדירים <code className="num">ASCEND_ACCESS_TOKEN</code> (סיסמה ארוכה) כדי שזרים לא ישתמשו במפתח שלך.</li>
            <li>מזינים את אותה סיסמה כאן. היא נשמרת רק בדפדפן הזה, ולא נכללת בייצוא.</li>
          </ol>
          <label className="field">
            קוד גישה למאמן
            <input className="input" type="password" autoComplete="off" value={coachCode} onChange={(e) => setCoachCode(e.target.value)} placeholder="ריק אם לא הוגדר ASCEND_ACCESS_TOKEN" />
          </label>
          <button className="btn block" onClick={() => {
            setCoachToken(coachCode);
            toast(coachCode.trim() ? "קוד הגישה נשמר במכשיר" : "קוד הגישה הוסר");
          }}>שמירת קוד הגישה</button>
        </div>
      </Card>

      <Card className="flat">
        <div className="stack" style={{ gap: 10 }}>
          <h2>מחיקת נתונים</h2>
          <p className="small text-2">מחיקה מוחקת את כל הנתונים במכשיר הזה, כולל הפרופיל והרפלקציות. לא ניתן לבטל. כדאי לייצא גיבוי לפני כן.</p>
          <ConfirmButton label="מחיקת כל הנתונים" confirmLabel="לחץ שוב כדי למחוק הכול" onConfirm={() => {
            resetState();
            toast("הנתונים נמחקו");
            go("/");
          }} />
        </div>
      </Card>
      <p className="hint small" style={{ textAlign: "center" }}>ASCEND · גרסה 0.1</p>
    </main>
  );
}
