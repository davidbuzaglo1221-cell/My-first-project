import { useMemo, useState } from "react";
import { Card, ConfirmButton, Empty, Icon, Topbar, toast } from "../components/ui";
import { SALES_SCENARIOS, SALES_SCENARIO_BY_ID, DIFFICULTY_LABEL, type SalesScenario } from "../content/sales";
import { RELATION_SCENARIOS, RELATION_SCORE, type RelationScenario, type Quality } from "../content/relations";
import { DIMENSION_LABEL, buildReport, evaluateReply, objectionsFor, type Difficulty, type Dimension, type SalesReport, type TurnEvaluation } from "../lib/sales-engine";
import type { Objection } from "../content/sales";
import { setState, useAppState } from "../lib/store";
import { go } from "../lib/router";
import { buildOffer, type OfferInput } from "../lib/offer";
import { randomId } from "../lib/id";
import type { Offer, SimRecord } from "../lib/types";

// ------------------------------------------------------------------
// SALES
// ------------------------------------------------------------------

export function SalesHub() {
  const state = useAppState();
  const recent = state.sims.filter((s) => s.kind === "sales").slice(-3).reverse();
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  return (
    <main className="page">
      <Topbar title="סימולטור מכירות" eyebrow="תרגול עם לקוח" onBack={() => go("/train")} />
      <p className="text-2 small">בחר תרחיש ורמה. הלקוח מעלה התנגדויות, ואתה עונה במילים שלך. בסוף תקבל ציון לפי שבעה היבטים, והסבר לכל תגובה חלשה.</p>
      <div className="row" style={{ gap: 8 }} role="group" aria-label="רמת קושי">
        {(Object.keys(DIFFICULTY_LABEL) as Difficulty[]).map((d) => (
          <button key={d} className="chip" aria-pressed={difficulty === d} onClick={() => setDifficulty(d)}>{DIFFICULTY_LABEL[d]}</button>
        ))}
      </div>
      {SALES_SCENARIOS.map((s) => (
        <Card key={s.id}>
          <div className="stack" style={{ gap: 8 }}>
            <h2>{s.title}</h2>
            <p className="small text-2">{s.setting}</p>
            <p className="small muted">מוצר: {s.product} · מחיר: <span className="num">{s.price}</span></p>
            <p className="small muted">מיקוד: {s.focus}</p>
            <button className="btn primary small-btn" style={{ justifySelf: "start" }} onClick={() => go(`/train/sales/${s.id}?d=${difficulty}`)}>התחל ({DIFFICULTY_LABEL[difficulty]})</button>
          </div>
        </Card>
      ))}
      {recent.length > 0 ? (
        <section className="stack">
          <h2>סבבים אחרונים</h2>
          {recent.map((r) => <div key={r.id} className="list-item"><span className="small muted num">{r.createdAt.slice(0, 10)}</span><span className="small">{r.summary}</span><span className="pill accent num" style={{ marginInlineStart: "auto" }}>{r.score}/5</span></div>)}
        </section>
      ) : null}
    </main>
  );
}

interface ChatItem { role: "customer" | "user"; text: string }
interface StepRecord { objection?: Objection; reply: string; evaluation: TurnEvaluation; ideal: string; label: string }

const OPENING_IDEAL = "שאל שאלה אחת על המצב לפני שאתה מציג משהו. למשל: 'מה המצב היום, ומה כבר ניסית?'";
const CLOSING_IDEAL = "סיים בצעד מוסכם וקטן, עם תאריך: 'אם מתאים לך, נקבע שיחה של 15 דקות השבוע, ואשלח לך את התוכנית לפני כן.'";

export function SalesPlay({ scenarioId, difficulty }: { scenarioId: string; difficulty: string }) {
  const scenario = SALES_SCENARIO_BY_ID[scenarioId] as SalesScenario | undefined;
  const level = (["easy", "medium", "hard"].includes(difficulty) ? difficulty : "medium") as Difficulty;
  if (!scenario) return <Empty title="התרחיש לא נמצא" text="בחר תרחיש מהרשימה." action={<button className="btn small-btn" onClick={() => go("/train/sales")}>לתרחישים</button>} />;
  return <SalesRun key={`${scenario.id}-${level}`} scenario={scenario} level={level} />;
}

function SalesRun({ scenario, level }: { scenario: SalesScenario; level: Difficulty }) {
  const objections = useMemo(() => objectionsFor(scenario, level), [scenario, level]);
  const total = objections.length + 2; // opening reply, one per objection, then closing reply
  const [chat, setChat] = useState<ChatItem[]>([{ role: "customer", text: scenario.customerOpening }]);
  const [steps, setSteps] = useState<StepRecord[]>([]);
  const [draft, setDraft] = useState("");
  const [finished, setFinished] = useState(false);
  const [report, setReport] = useState<SalesReport | null>(null);
  const state = useAppState();
  const stepIndex = steps.length;
  const lastFeedback = steps[steps.length - 1];

  const finish = (all: StepRecord[]) => {
    const r = buildReport(all.map((s) => ({ objection: s.objection, reply: s.reply, evaluation: s.evaluation })));
    setReport(r);
    setFinished(true);
    const record: SimRecord = {
      id: randomId(),
      kind: "sales",
      scenarioId: scenario.id,
      difficulty: level,
      score: r.overall,
      summary: `${scenario.title} (${DIFFICULTY_LABEL[level]}), ציון ${r.overall}`,
      createdAt: new Date().toISOString(),
    };
    setState((s) => ({ ...s, sims: [...s.sims, record].slice(-100) }));
  };

  const submit = () => {
    const text = draft.trim();
    if (text.length < 2) return toast("כתוב תשובה לפני שממשיכים");
    const isFinal = stepIndex === total - 1;
    const objection = stepIndex >= 1 && stepIndex <= objections.length ? objections[stepIndex - 1] : undefined;
    const previousReply = steps[steps.length - 1]?.reply;
    const evaluation = evaluateReply(text, objection, isFinal, previousReply);
    const ideal = stepIndex === 0 ? OPENING_IDEAL : isFinal ? CLOSING_IDEAL : objections[stepIndex - 1].ideal;
    const label = isFinal ? "סגירה וצעד הבא" : stepIndex === 0 ? "פתיחה" : `התנגדות ${stepIndex} מתוך ${objections.length}`;
    const nextSteps = [...steps, { objection, reply: text, evaluation, ideal, label }];
    setSteps(nextSteps);
    setDraft("");
    setChat((c) => {
      const add: ChatItem[] = [{ role: "user", text }];
      if (isFinal) return [...c, ...add];
      if (stepIndex < objections.length) add.push({ role: "customer", text: objections[stepIndex].text });
      else add.push({ role: "customer", text: "אז מה הצעד הבא?" });
      return [...c, ...add];
    });
    if (isFinal) finish(nextSteps);
  };

  if (finished && report) return <SalesReportView scenario={scenario} level={level} report={report} onRetry={() => go(`/train/sales/${scenario.id}?d=${level}`)} />;

  const doneCount = steps.length;
  return (
    <main className="page">
      <Topbar title={scenario.title} eyebrow={`${DIFFICULTY_LABEL[level]} · ${doneCount + 1}/${total}`} onBack={() => go("/train/sales")} />
      <Card className="flat">
        <p className="small text-2"><strong>המצב:</strong> {scenario.setting}</p>
        <p className="small muted" style={{ marginTop: 6 }}>מוצר: {scenario.product} · מחיר: <span className="num">{scenario.price}</span></p>
      </Card>

      <div className="stack" aria-live="polite" style={{ gap: 10 }}>
        {chat.map((m, i) => (
          <div key={i} style={{ justifySelf: m.role === "user" ? "end" : "start", maxWidth: "86%" }}>
            <div className="small muted" style={{ marginBottom: 3, textAlign: m.role === "user" ? "end" : "start" }}>{m.role === "customer" ? "הלקוח" : "אתה"}</div>
            <div style={{ padding: "11px 14px", borderRadius: 16, background: m.role === "user" ? "var(--accent-soft)" : "var(--surface-2)", border: "1px solid var(--border)", borderTopRightRadius: m.role === "user" ? 4 : 16, borderTopLeftRadius: m.role === "customer" ? 4 : 16 }}>
              {m.text}
            </div>
          </div>
        ))}
      </div>

      {lastFeedback && !finished ? <FeedbackCard step={lastFeedback} /> : null}

      <Card>
        <label className="field">
          התשובה שלך
          <textarea className="textarea" value={draft} maxLength={800} onChange={(e) => setDraft(e.target.value)} placeholder="כתוב כמו שהיית אומר בשיחה אמיתית" />
        </label>
        <div className="row" style={{ marginTop: 10, justifyContent: "space-between" }}>
          <button className="btn ghost small-btn" onClick={() => finish(steps.length ? steps : [])} disabled={steps.length === 0}>סיום מוקדם והערכה</button>
          <button className="btn primary" onClick={submit} disabled={!draft.trim()}>שליחה</button>
        </div>
      </Card>
      <p className="hint small">הסימולטור מבוסס על כללים קבועים, לא על מודל שפה. הוא בודק שאלות, הקשבה, התייחסות להתנגדות, לחץ ונוכחות צעד הבא. הוא לא מבין את הכוונה שמאחורי המילים כמו שאדם מבין.</p>
      {state.profile?.salesExperience === "none" ? <p className="hint small">טיפ: בתחילת הדרך, כדאי לשאול לפחות שתי שאלות לפני שמציגים הצעה.</p> : null}
    </main>
  );
}

function FeedbackCard({ step }: { step: StepRecord }) {
  const ok = !step.evaluation.weak;
  return (
    <Card className="flat" tone={undefined}>
      <div className="row between" style={{ marginBottom: 8 }}>
        <strong>{step.label}</strong>
        <span className={`pill ${ok ? "good" : "warn"}`}>{ok ? "תגובה טובה" : "יש מה לשפר"}</span>
      </div>
      {step.evaluation.weaknesses.length > 0 ? (
        <ul className="small text-2" style={{ margin: "0 0 10px", paddingInlineStart: 18 }}>
          {step.evaluation.weaknesses.map((w) => <li key={w}>{w}</li>)}
        </ul>
      ) : <p className="small text-2" style={{ marginBottom: 10 }}>טוב: התשובה מתייחסת למה שנאמר, ומשאירה מקום לשיחה.</p>}
      {ok ? null : (
        <div className="quote-block small">
          <div className="muted" style={{ marginBottom: 4 }}>דוגמה לניסוח טוב יותר:</div>
          <div>{step.ideal}</div>
        </div>
      )}
    </Card>
  );
}

function SalesReportView({ scenario, level, report, onRetry }: { scenario: SalesScenario; level: Difficulty; report: SalesReport; onRetry: () => void }) {
  const dims = Object.keys(DIMENSION_LABEL) as Dimension[];
  return (
    <main className="page">
      <Topbar title="משוב על הסבב" eyebrow={`${scenario.title} · ${DIFFICULTY_LABEL[level]}`} onBack={() => go("/train/sales")} />
      <Card tone="accent">
        <div className="row between">
          <div><span className="small muted">ציון כללי</span><div className="num" style={{ fontSize: 34, fontWeight: 700 }}>{report.overall}<span className="small muted"> / 5</span></div></div>
          <div className="stack" style={{ gap: 4, textAlign: "end" }}>
            <span className="small">חזק ביותר: <strong>{DIMENSION_LABEL[report.strongest]}</strong></span>
            <span className="small">לשיפור: <strong>{DIMENSION_LABEL[report.weakest]}</strong></span>
          </div>
        </div>
      </Card>
      <Card>
        <div className="stack" style={{ gap: 12 }}>
          {dims.map((d) => (
            <div key={d} className="stack" style={{ gap: 4 }}>
              <div className="row between small"><span>{DIMENSION_LABEL[d]}</span><span className="num">{report.scores[d]}/5</span></div>
              <div className="progress" aria-hidden><span style={{ width: `${(report.scores[d] / 5) * 100}%` }} /></div>
            </div>
          ))}
        </div>
      </Card>
      {report.tips.length > 0 ? (
        <Card className="flat">
          <h2 style={{ marginBottom: 8 }}>מה לתרגל הבא</h2>
          <ul className="small text-2" style={{ margin: 0, paddingInlineStart: 18, display: "grid", gap: 6 }}>
            {report.tips.map((t) => <li key={t}>{t}</li>)}
          </ul>
        </Card>
      ) : <p className="small text-2">כל ההיבטים עברו את הרף. נסה רמה גבוהה יותר.</p>}
      <section className="stack">
        <h2>תגובות לפי שלב</h2>
        {report.turns.map((t, i) => (
          <Card key={i} className="flat">
            <div className="row between small" style={{ marginBottom: 6 }}>
              <strong>{i === 0 ? "פתיחה" : i === report.turns.length - 1 ? "סגירה" : `התנגדות ${i}`}</strong>
              <span className={`pill ${t.evaluation.weak ? "warn" : "good"}`}>{t.evaluation.weak ? "לשיפור" : "טוב"}</span>
            </div>
            <p className="small text-2" style={{ marginBottom: 6 }}>"{t.reply}"</p>
          </Card>
        ))}
      </section>
      <div className="grid-2">
        <button className="btn" onClick={() => go("/train/sales")}>לתרחישים</button>
        <button className="btn primary" onClick={onRetry}>לתרגל שוב</button>
      </div>
    </main>
  );
}

// ------------------------------------------------------------------
// RELATIONSHIPS (choice-based, observable behaviour vs assumptions)
// ------------------------------------------------------------------

export function RelationsHub() {
  const state = useAppState();
  return (
    <main className="page">
      <Topbar title="סימולטור זוגיות" eyebrow="תקשורת, גבולות, הבנה" onBack={() => go("/train")} />
      <p className="text-2 small">בכל תרחיש בוחרים תגובה אחת. המשוב מפריד בין מה שנצפה לבין מה שמניחים. אף תשובה לא מבטיחה את התוצאה, כי את מחשבות האדם השני לא יודעים.</p>
      {RELATION_SCENARIOS.map((s) => {
        const last = [...state.sims].reverse().find((r) => r.kind === "relationship" && r.scenarioId === s.id);
        return (
          <Card key={s.id}>
            <div className="stack" style={{ gap: 8 }}>
              <div className="row between"><h2>{s.title}</h2>{last ? <span className="pill accent">{last.summary.split("·")[0].trim()}</span> : null}</div>
              <p className="small text-2">{s.situation}</p>
              <button className="btn primary small-btn" style={{ justifySelf: "start" }} onClick={() => go(`/train/relations/${s.id}`)}>התחל</button>
            </div>
          </Card>
        );
      })}
    </main>
  );
}

const QUALITY_LABEL: Record<Quality, string> = { strong: "תגובה חזקה", ok: "תגובה סבירה", weak: "תגובה חלשה" };

export function RelationsPlay({ scenarioId }: { scenarioId: string }) {
  const scenario = RELATION_SCENARIOS.find((s) => s.id === scenarioId);
  const [picked, setPicked] = useState<number | null>(null);
  if (!scenario) return <Empty title="התרחיש לא נמצא" text="בחר תרחיש מהרשימה." action={<button className="btn small-btn" onClick={() => go("/train/relations")}>לתרחישים</button>} />;
  return <RelationRun key={scenario.id} scenario={scenario} picked={picked} setPicked={setPicked} />;
}

function RelationRun({ scenario, picked, setPicked }: { scenario: RelationScenario; picked: number | null; setPicked: (n: number | null) => void }) {
  const choose = (i: number) => {
    setPicked(i);
    const opt = scenario.options[i];
    setState((s) => ({
      ...s,
      sims: [...s.sims, {
        id: randomId(),
        kind: "relationship" as const,
        scenarioId: scenario.id,
        score: RELATION_SCORE[opt.quality],
        summary: `${scenario.title} · ${QUALITY_LABEL[opt.quality]}`,
        createdAt: new Date().toISOString(),
      }].slice(-100),
    }));
  };
  const chosen = picked !== null ? scenario.options[picked] : null;
  return (
    <main className="page">
      <Topbar title={scenario.title} eyebrow="בחר תגובה אחת" onBack={() => go("/train/relations")} />
      <Card>
        <p>{scenario.situation}</p>
      </Card>
      <div className="grid-2">
        <Card className="flat"><h3 style={{ marginBottom: 6 }}>מה נצפה</h3><p className="small text-2">{scenario.observable}</p></Card>
        <Card className="flat"><h3 style={{ marginBottom: 6 }}>מה מניחים</h3><p className="small text-2">{scenario.assumption}</p></Card>
      </div>
      <section className="stack" aria-label="אפשרויות תגובה">
        {scenario.options.map((o, i) => (
          <button key={i} className="toggle" aria-pressed={picked === i} onClick={() => choose(i)} style={{ alignItems: "flex-start", padding: 14 }}>
            <span style={{ lineHeight: 1.6 }}>"{o.text}"</span>
          </button>
        ))}
      </section>
      {chosen ? (
        <Card className="flat">
          <div className="row between" style={{ marginBottom: 6 }}>
            <strong>{QUALITY_LABEL[chosen.quality]}</strong>
            <span className={`pill ${chosen.quality === "strong" ? "good" : chosen.quality === "ok" ? "accent" : "warn"}`}>{chosen.quality === "strong" ? "מומלץ" : chosen.quality === "ok" ? "סביר" : "לשיפור"}</span>
          </div>
          <p className="small text-2">{chosen.feedback}</p>
        </Card>
      ) : null}
      {chosen ? <button className="btn block" onClick={() => setPicked(null)}>לנסות תגובה אחרת</button> : null}
      <p className="hint small">זה תרגול ולא ייעוץ זוגי. אם יש קושי מתמשך בזוגיות, פנייה לאיש מקצוע יכולה לעזור.</p>
    </main>
  );
}

// ------------------------------------------------------------------
// OFFER BUILDER
// ------------------------------------------------------------------

const EMPTY_OFFER: OfferInput = { product: "", customer: "", problem: "", price: "", desiredResult: "" };

export function OfferBuilder() {
  const state = useAppState();
  const [input, setInput] = useState<OfferInput>(EMPTY_OFFER);
  const [errors, setErrors] = useState<Partial<Record<keyof OfferInput, string>>>({});
  const [result, setResult] = useState<ReturnType<typeof buildOffer> | null>(null);

  const fields: [keyof OfferInput, string, string][] = [
    ["product", "השירות או המוצר שלך", "למשל: ליווי אישי להקמת שגרת מכירות"],
    ["customer", "הלקוח שאתה רוצה לעזור לו", "למשל: עצמאים שמוכרים שירות בפגישות אישיות"],
    ["problem", "הבעיה שהוא פותר", "מה הכאב, במילים של הלקוח"],
    ["price", "המחיר הנוכחי", "למשל: 1,500 ₪ לחודש"],
    ["desiredResult", "התוצאה הרצויה", "מה ישתנה אצל הלקוח, בצורה שניתן לבדוק"],
  ];

  const generate = () => {
    const e: Partial<Record<keyof OfferInput, string>> = {};
    for (const [k, , ] of fields) if (input[k].trim().length < 3) e[k] = "נא למלא לפחות שלוש מילים או תווים.";
    setErrors(e);
    if (Object.keys(e).length) return;
    setResult(buildOffer(input));
  };

  const save = () => {
    if (!result) return;
    const offer: Offer = { id: randomId(), name: input.product.trim().slice(0, 60), ...input, createdAt: new Date().toISOString(), plan: result.acquisitionPlan };
    setState((s) => ({ ...s, offers: [offer, ...s.offers].slice(0, 30) }));
    toast("ההצעה נשמרה");
  };

  return (
    <main className="page">
      <Topbar title="בונה ההצעות" eyebrow="טיוטה לבדיקה" onBack={() => go("/train")} />
      <p className="small text-2">מלא חמישה פרטים, וקבל טיוטה: הצעה, ערך, פרופיל לקוח, מסרים, רעיונות תוכן, תוכנית רכישה וניסוי קטן לבדיקת ביקוש. זו טיוטה ולא תחזית. ההבטחה היחידה כאן היא לבדיקה.</p>
      <Card>
        <div className="stack" style={{ gap: 14 }}>
          {fields.map(([k, label, ph]) => (
            <label key={k} className="field">
              {label}
              <textarea className="textarea" style={{ minHeight: 60 }} maxLength={300} value={input[k]} placeholder={ph} aria-invalid={!!errors[k]} onChange={(e) => setInput({ ...input, [k]: e.target.value })} />
              {errors[k] ? <span className="error">{errors[k]}</span> : null}
            </label>
          ))}
        </div>
        <button className="btn primary block" style={{ marginTop: 14 }} onClick={generate}>בניית טיוטה</button>
      </Card>

      {result ? (
        <section className="stack" aria-label="טיוטת הצעה">
          <Card tone="accent"><h2 style={{ marginBottom: 6 }}>הצעה</h2><p className="text-2">{result.statement}</p></Card>
          <Card><h3 style={{ marginBottom: 6 }}>ערך</h3><p className="small text-2">{result.valueProposition}</p></Card>
          <Card><h3 style={{ marginBottom: 6 }}>פרופיל הלקוח</h3><ul className="small text-2" style={{ margin: 0, paddingInlineStart: 18 }}>{result.customerProfile.map((x) => <li key={x}>{x}</li>)}</ul></Card>
          <Card><h3 style={{ marginBottom: 6 }}>מסרים לדוגמה</h3><ul className="small text-2" style={{ margin: 0, paddingInlineStart: 18, display: "grid", gap: 6 }}>{result.messages.map((x) => <li key={x}>{x}</li>)}</ul></Card>
          <Card><h3 style={{ marginBottom: 6 }}>רעיונות לתוכן</h3><ul className="small text-2" style={{ margin: 0, paddingInlineStart: 18, display: "grid", gap: 6 }}>{result.contentIdeas.map((x) => <li key={x}>{x}</li>)}</ul></Card>
          <Card><h3 style={{ marginBottom: 6 }}>תוכנית רכישת לקוחות (4 שבועות)</h3><ol className="small text-2" style={{ margin: 0, paddingInlineStart: 18, display: "grid", gap: 6 }}>{result.acquisitionPlan.map((x) => <li key={x}>{x}</li>)}</ol></Card>
          <Card className="flat"><h3 style={{ marginBottom: 6 }}>ניסוי לבדיקת ביקוש</h3><p className="small text-2">{result.experiment}</p></Card>
          <div className="notice">{result.caveat}</div>
          <button className="btn" onClick={save}>שמירת הטיוטה</button>
        </section>
      ) : null}

      {state.offers.length > 0 ? (
        <section className="stack" aria-label="הצעות שמורות">
          <h2>הטיוטות שלי</h2>
          {state.offers.map((o) => (
            <Card key={o.id} className="flat">
              <div className="row between">
                <div className="stack" style={{ gap: 2, minWidth: 0 }}>
                  <strong>{o.name || "הצעה ללא שם"}</strong>
                  <span className="small muted num">{o.createdAt.slice(0, 10)}</span>
                </div>
                <ConfirmButton label="מחיקה" confirmLabel="לאשר מחיקה" className="btn danger small-btn" onConfirm={() => setState((s) => ({ ...s, offers: s.offers.filter((x) => x.id !== o.id) }))} />
              </div>
              <p className="small text-2" style={{ marginTop: 6 }}>{o.problem}</p>
            </Card>
          ))}
        </section>
      ) : null}
      <span className="hint small"><Icon name="spark" size={14} /> ניתן לייצא את הטיוטות דרך מסך הפרופיל.</span>
    </main>
  );
}

