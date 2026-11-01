import { useState } from "react";
import { ProfileFields, validateDraft, type ProfileDraft } from "../components/ProfileFields";
import { setState } from "../lib/store";
import { go } from "../lib/router";
import { Card } from "../components/ui";

const EMPTY: ProfileDraft = {
  name: "",
  goals: [],
  timeMode: 20,
  sleepTarget: 7.5,
  workStatus: "employee",
  salesExperience: "none",
  obstacles: "",
};

export function Onboarding() {
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<ProfileDraft>(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const next = () => {
    if (step === 0) {
      const e = validateDraft({ ...draft, goals: draft.goals.length ? draft.goals : ["health"] });
      if (e.name) return setErrors({ name: e.name });
      setErrors({});
      return setStep(1);
    }
    if (step === 1) {
      const e = validateDraft(draft);
      if (e.goals) return setErrors({ goals: e.goals });
      setErrors({});
      return setStep(2);
    }
    const e = validateDraft(draft);
    if (Object.keys(e).length) return setErrors(e);
    setState((s) => ({ ...s, profile: { ...draft, name: draft.name.trim(), obstacles: draft.obstacles.trim(), createdAt: new Date().toISOString() } }));
    go("/");
  };

  return (
    <div className="onb">
      <div className="brand">ASCEND</div>
      <div className="progress-steps" aria-hidden>
        {[0, 1, 2].map((i) => <span key={i} className={i <= step ? "on" : ""} />)}
      </div>

      {step === 0 && (
        <>
          <div className="stack" style={{ gap: 8 }}>
            <h1>מערכת אישית לשיפור עצמי</h1>
            <p className="text-2">
              פחות צריכה, יותר תרגול, התקדמות שניתן למדוד. נתחיל בשלוש שאלות קצרות, ואחר כך תקבל תוכנית יומית שמתאימה לזמן שיש לך.
            </p>
          </div>
          <Card>
            <ProfileFields draft={draft} onChange={setDraft} errors={errors} />
          </Card>
        </>
      )}

      {step === 1 && (
        <>
          <div className="stack" style={{ gap: 8 }}>
            <h1>מה חשוב לך לשפר?</h1>
            <p className="text-2">בחר עד שלוש מטרות. אפשר לשנות אותן בכל רגע מהפרופיל.</p>
          </div>
          <Card>
            <ProfileFields draft={draft} onChange={setDraft} errors={errors} showName={false} />
          </Card>
        </>
      )}

      {step === 2 && (
        <>
          <div className="stack" style={{ gap: 8 }}>
            <h1>כמה זמן ביום, ומה עוצר אותך?</h1>
            <p className="text-2">התוכנית תישאר בתוך הזמן שבחרת. עדיף עשר דקות בכל יום מאשר שעה פעם בשבוע.</p>
          </div>
          <Card>
            <ProfileFields draft={draft} onChange={setDraft} errors={errors} showName={false} />
          </Card>
        </>
      )}

      <div className="row" style={{ gap: 10 }}>
        {step > 0 ? <button className="btn" onClick={() => { setErrors({}); setStep(step - 1); }}>חזרה</button> : null}
        <button className="btn primary block" onClick={next}>
          {step < 2 ? "המשך" : "בואו נתחיל"}
        </button>
      </div>
      <p className="hint small" style={{ textAlign: "center" }}>המידע נשמר במכשיר שלך. אין חשבון ואין שליחה לשרת.</p>
    </div>
  );
}
