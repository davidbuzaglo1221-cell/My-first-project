import { useRef, useState } from "react";
import { Card, Empty, Icon, Topbar, toast } from "../components/ui";
import { QUICK_STARTS, askAiCoach, basicCoachReply, detectTopic, type CoachTopic } from "../lib/coach";
import { setState, useAppState } from "../lib/store";
import { go } from "../lib/router";
import { randomId } from "../lib/id";
import type { CoachMessage } from "../lib/types";

export function Coach() {
  const state = useAppState();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [topic, setTopic] = useState<CoachTopic>("general");
  const endRef = useRef<HTMLDivElement>(null);
  const messages = state.coachMessages;

  const push = (msg: CoachMessage) => setState((s) => ({ ...s, coachMessages: [...s.coachMessages, msg].slice(-60) }));

  const send = async (raw: string, forcedTopic?: CoachTopic) => {
    const message = raw.trim();
    if (!message || busy) return;
    const effectiveTopic = forcedTopic ?? (topic === "general" ? detectTopic(message) : topic);
    if (forcedTopic) setTopic(forcedTopic);
    const userMsg: CoachMessage = { id: randomId(), role: "user", text: message, at: new Date().toISOString(), source: "basic" };
    const history = [...messages, userMsg];
    push(userMsg);
    setText("");
    setBusy(true);
    setNotice(null);

    const ai = await askAiCoach(message, messages, state.profile);
    let reply: string;
    let source: CoachMessage["source"];
    if (ai.ok) {
      reply = ai.reply;
      source = "ai";
    } else {
      reply = basicCoachReply(message, effectiveTopic, state.profile, history);
      source = "basic";
      if (ai.reason === "not-configured") setNotice("המאמן פועל במצב בסיסי. כדי לקבל תשובות מודל שפה, צריך להגדיר מפתח שרת. ראה הוראות בפרופיל.");
      else setNotice("לא הצלחתי להתחבר למאמן עכשיו. מוצגת תשובה מהמצב הבסיסי.");
    }
    push({ id: randomId(), role: "coach", text: reply, at: new Date().toISOString(), source });
    setBusy(false);
    setTimeout(() => endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }), 50);
  };

  return (
    <main className="page">
      <Topbar title="המאמן" eyebrow="שיחה אחת, צעד אחד" />
      <p className="small text-2">המאמן שואל לפני שמייעץ: מה קורה בפועל, מה הנחה, ומה הצעד הקטן הבא. הוא לא יכול להחליף רופא, פסיכולוג או יועץ מוסמך.</p>

      <div className="row" style={{ flexWrap: "wrap", gap: 8 }} aria-label="התחלה מהירה">
        {QUICK_STARTS.map((q) => (
          <button key={q.topic} className="chip" disabled={busy} onClick={() => send(q.prompt, q.topic)}>{q.label}</button>
        ))}
      </div>

      {notice ? <div className="notice">{notice}</div> : null}

      {messages.length === 0 ? (
        <Empty title="עדיין אין שיחה" text="בחר נושא מהרשימה, או כתוב במילים שלך מה מעסיק אותך. ככל שתפרט יותר, השאלות יהיו מדויקות יותר." />
      ) : (
        <div className="stack" style={{ gap: 10 }} aria-live="polite">
          {messages.map((m) => (
            <div key={m.id} style={{ justifySelf: m.role === "user" ? "end" : "start", maxWidth: "88%" }}>
              <div style={{ padding: "12px 14px", borderRadius: 18, whiteSpace: "pre-wrap", fontSize: 15, lineHeight: 1.65, background: m.role === "user" ? "var(--accent-soft)" : "var(--surface-2)", border: "1px solid var(--border)" }}>
                {m.text}
              </div>
              {m.role === "coach" ? <div className="small muted" style={{ marginTop: 3 }}>{m.source === "ai" ? "מודל שפה" : "מצב בסיסי"}</div> : null}
            </div>
          ))}
          {busy ? <div className="small muted">המאמן כותב...</div> : null}
          <div ref={endRef} />
        </div>
      )}

      <Card className="flat">
        <label className="field">
          מה מעסיק אותך?
          <textarea className="textarea" value={text} maxLength={1200} onChange={(e) => setText(e.target.value)} placeholder="למשל: אני נמנע משיחות מכירה, ואני מרגיש שזה פוגע בהכנסה" />
        </label>
        <div className="row" style={{ marginTop: 10, justifyContent: "space-between" }}>
          <button className="btn ghost small-btn" onClick={() => {
            if (messages.length === 0) return;
            setState((s) => ({ ...s, coachMessages: [] }));
            toast("השיחה נמחקה");
          }}>מחיקת השיחה</button>
          <button className="btn primary" disabled={busy || !text.trim()} onClick={() => send(text)}>
            <Icon name="spark" size={18} /> שליחה
          </button>
        </div>
      </Card>

      <Card className="flat">
        <h3 style={{ marginBottom: 6 }}>מאיפה מגיעות התשובות?</h3>
        <p className="small text-2">במצב בסיסי, התשובות נבנות מכללים קבועים ומתבניות שנכתבו מראש. זה שימושי לתרגול, אבל לא מחליף שיחה חכמה. אם הוגדר מפתח שרת, התשובות נשלחות למודל שפה דרך נקודת קצה בשרת, והמפתח לא מוצג בדפדפן.</p>
        <button className="btn ghost small-btn" style={{ marginTop: 6, paddingInline: 0 }} onClick={() => go("/profile")}>הוראות הגדרה</button>
      </Card>
    </main>
  );
}
