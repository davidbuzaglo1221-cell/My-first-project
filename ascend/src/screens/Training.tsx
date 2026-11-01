import { useEffect, useMemo, useRef, useState } from "react";
import { Card, Empty, Icon, ProgressBar, Topbar, toast } from "../components/ui";
import { LESSONS, lessonById, type Lesson } from "../content/lessons";
import { TRACKS } from "../content/tracks";
import { setState, useAppState } from "../lib/store";
import { go } from "../lib/router";
import { LessonPlayer, hebrewVoiceAvailable, speechSupported } from "../lib/speech";
import { downloadText, lessonToMarkdown } from "../lib/export";
import { SalesHub, SalesPlay, RelationsHub, RelationsPlay, OfferBuilder } from "./Simulators";
import type { LessonProgress, TrackId } from "../lib/types";

const EMPTY_PROGRESS: LessonProgress = { completed: false, bookmarked: false, notes: "", quizAnswers: {}, reflection: "", assignmentDone: false };

export function Training({ rest, query }: { rest: string[]; query: URLSearchParams }) {
  const [head, arg] = rest;
  if (head === "track" && arg) return <TrackPage trackId={arg as TrackId} />;
  if (head === "lesson" && arg) return <LessonPage id={arg} />;
  if (head === "sales") {
    if (arg) return <SalesPlay scenarioId={arg} difficulty={query.get("d") ?? "medium"} />;
    return <SalesHub />;
  }
  if (head === "relations") return arg ? <RelationsPlay scenarioId={arg} /> : <RelationsHub />;
  if (head === "offer") return <OfferBuilder />;
  return <TrainingHub initialQuery={query.get("q") ?? ""} />;
}

function progressOf(lessonId: string, all: Record<string, LessonProgress>): LessonProgress {
  return all[lessonId] ?? EMPTY_PROGRESS;
}

function TrainingHub({ initialQuery }: { initialQuery: string }) {
  const state = useAppState();
  const [q, setQ] = useState(initialQuery);
  const normalized = q.trim();
  const results = useMemo(() => {
    if (!normalized) return null;
    const needle = normalized.toLowerCase();
    return LESSONS.filter((l) =>
      [l.title, l.principle, l.explanation.join(" "), l.example, l.exercise].join(" ").toLowerCase().includes(needle),
    );
  }, [normalized]);
  const bookmarks = LESSONS.filter((l) => progressOf(l.id, state.lessons).bookmarked);
  const last = state.lastLessonId ? lessonById(state.lastLessonId) : undefined;
  const completedTotal = LESSONS.filter((l) => progressOf(l.id, state.lessons).completed).length;

  return (
    <main className="page">
      <header className="stack" style={{ gap: 4 }}>
        <span className="eyebrow">אימון</span>
        <h1>ללמוד, לתרגל, לבדוק</h1>
        <p className="text-2 small">{completedTotal} מתוך {LESSONS.length} שיעורים הושלמו. כל שיעור נבנה כך: עיקרון, דוגמה, תרגיל, משימה בעולם האמיתי, ובדיקה קצרה.</p>
      </header>

      {last ? (
        <Card tone="accent">
          <div className="row between">
            <div className="stack" style={{ gap: 2, minWidth: 0 }}>
              <span className="small muted">המשך מאיפה שעצרת</span>
              <strong>{last.title}</strong>
            </div>
            <button className="btn primary small-btn" onClick={() => go(`/train/lesson/${last.id}`)}>המשך</button>
          </div>
        </Card>
      ) : null}

      <label className="field">
        חיפוש בספרייה
        <input className="input" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="למשל: שינה, מכירה, תזרים" />
      </label>

      {results ? (
        <section className="stack" aria-label="תוצאות חיפוש">
          <h2>{results.length ? `נמצאו ${results.length}` : "לא נמצא"}</h2>
          {results.length === 0 ? <p className="small muted">נסה מילה אחרת, או נקה את החיפוש כדי לראות את כל המסלולים.</p> : null}
          {results.map((l) => <LessonRow key={l.id} lesson={l} progress={progressOf(l.id, state.lessons)} />)}
        </section>
      ) : (
        <>
          <section className="stack" aria-labelledby="tracks">
            <h2 id="tracks">מסלולי הלמידה</h2>
            {TRACKS.map((t) => {
              const lessons = LESSONS.filter((l) => l.track === t.id);
              const done = lessons.filter((l) => progressOf(l.id, state.lessons).completed).length;
              return (
                <button key={t.id} className="list-item" style={{ alignItems: "flex-start", flexDirection: "column", gap: 8 }} onClick={() => go(`/train/track/${t.id}`)}>
                  <div className="row between" style={{ width: "100%" }}>
                    <span className="pill accent">מסלול {t.id}</span>
                    <span className="small muted num">{done}/{lessons.length}</span>
                  </div>
                  <strong>{t.title}</strong>
                  <span className="small text-2">{t.summary}</span>
                  <ProgressBar value={lessons.length ? (done / lessons.length) * 100 : 0} label={`התקדמות ${t.title}`} />
                </button>
              );
            })}
          </section>

          <section className="stack" aria-labelledby="sims">
            <h2 id="sims">תרגול</h2>
            <div className="grid-2">
              <button className="list-item" style={{ flexDirection: "column", alignItems: "flex-start", minHeight: 110 }} onClick={() => go("/train/sales")}>
                <strong>סימולטור מכירות</strong>
                <span className="small muted">לקוח עם התנגדויות, משוב על כל תשובה</span>
              </button>
              <button className="list-item" style={{ flexDirection: "column", alignItems: "flex-start", minHeight: 110 }} onClick={() => go("/train/relations")}>
                <strong>סימולטור זוגיות</strong>
                <span className="small muted">בחירת תגובה, והסבר מה ראינו ומה הנחנו</span>
              </button>
              <button className="list-item" style={{ flexDirection: "column", alignItems: "flex-start", minHeight: 110 }} onClick={() => go("/train/offer")}>
                <strong>בונה ההצעות</strong>
                <span className="small muted">טיוטה להצעה, מסרים, ניסוי ביקוש</span>
              </button>
            </div>
          </section>

          {bookmarks.length > 0 ? (
            <section className="stack" aria-labelledby="bm">
              <h2 id="bm">שמורים</h2>
              {bookmarks.map((l) => <LessonRow key={l.id} lesson={l} progress={progressOf(l.id, state.lessons)} />)}
            </section>
          ) : null}
        </>
      )}
    </main>
  );
}

function LessonRow({ lesson, progress }: { lesson: Lesson; progress: LessonProgress }) {
  return (
    <button className="list-item" onClick={() => go(`/train/lesson/${lesson.id}`)}>
      <div className="stack" style={{ gap: 2, minWidth: 0, flex: 1 }}>
        <span className="small muted">{lesson.minutes} דק׳ · מסלול {lesson.track}</span>
        <strong>{lesson.title}</strong>
      </div>
      {progress.completed ? <span className="pill good">הושלם</span> : progress.bookmarked ? <Icon name="bookmark" size={18} /> : <Icon name="chev" />}
    </button>
  );
}

function TrackPage({ trackId }: { trackId: TrackId }) {
  const state = useAppState();
  const track = TRACKS.find((t) => t.id === trackId);
  if (!track) return <Empty title="המסלול לא נמצא" text="חזור לספרייה ובחר מסלול מהרשימה." action={<button className="btn small-btn" onClick={() => go("/train")}>לאימון</button>} />;
  const lessons = LESSONS.filter((l) => l.track === trackId);
  return (
    <main className="page">
      <Topbar title={track.title} eyebrow={`מסלול ${track.id}`} onBack={() => go("/train")} />
      <p className="text-2">{track.summary}</p>
      {lessons.length === 0 ? (
        <Empty title="השיעורים במסלול הזה ייכתבו בהמשך" text="המסלול מוגדר ומחכה לתוכן. ניתן להוסיף שיעורים נוספים בקובץ התוכן בלי לשנות את המערכת." />
      ) : (
        <div className="stack">{lessons.map((l) => <LessonRow key={l.id} lesson={l} progress={progressOf(l.id, state.lessons)} />)}</div>
      )}
    </main>
  );
}

function LessonPage({ id }: { id: string }) {
  const lesson = lessonById(id);
  const state = useAppState();
  const progress = progressOf(id, state.lessons);
  const [notes, setNotes] = useState(progress.notes);
  const [reflection, setReflection] = useState(progress.reflection);
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [playerState, setPlayerState] = useState({ index: 0, total: 0, playing: false, paused: false });
  const player = useRef<LessonPlayer | null>(null);

  const update = (patch: Partial<LessonProgress>) =>
    setState((s) => ({
      ...s,
      lastLessonId: id,
      lessons: { ...s.lessons, [id]: { ...progressOf(id, s.lessons), ...patch, lastOpenedAt: new Date().toISOString() } },
    }));

  useEffect(() => {
    // Remember the last lesson opened, so the home screen and the hub can offer to continue.
    if (lesson) update({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (!lesson) return;
    const p = new LessonPlayer();
    p.onChange = setPlayerState;
    p.load([lesson.title, lesson.principle, ...lesson.explanation, `דוגמה. ${lesson.example}`, `תרגיל. ${lesson.exercise}`, `משימה. ${lesson.assignment}`, `שאלה לחשיבה. ${lesson.reflection}`]);
    player.current = p;
    return () => p.stop();
  }, [lesson]);

  if (!lesson) return <Empty title="השיעור לא נמצא" text="ייתכן שהקישור ישן. חזור לאימון ובחר שיעור מהרשימה." action={<button className="btn small-btn" onClick={() => go("/train")}>לאימון</button>} />;

  const answered = lesson.quiz.filter((q) => progress.quizAnswers[q.id] !== undefined).length;
  const correct = lesson.quiz.filter((q) => progress.quizAnswers[q.id] === q.answer).length;
  const canFinish = answered === lesson.quiz.length;

  const answer = (qid: string, idx: number) => {
    const existing = progress.quizAnswers[qid];
    update({ quizAnswers: { ...progress.quizAnswers, [qid]: idx } });
    setRevealed((r) => ({ ...r, [qid]: true }));
    if (existing === undefined) toast("נשמר");
  };

  return (
    <main className="page">
      <Topbar title={lesson.title} eyebrow={`מסלול ${lesson.track} · ${lesson.minutes} דק׳`} onBack={() => go(`/train/track/${lesson.track}`)} />

      <div className="row" style={{ flexWrap: "wrap", gap: 8 }}>
        <button className="chip" aria-pressed={progress.bookmarked} onClick={() => update({ bookmarked: !progress.bookmarked })}>
          <Icon name="bookmark" size={16} /> {progress.bookmarked ? "שמור" : "שמירה"}
        </button>
        <button className="chip" onClick={() => {
          downloadText(`${lesson.id}.md`, lessonToMarkdown(lesson, progress.notes), "text/markdown;charset=utf-8");
          toast("הקובץ הורד. אפשר לייבא אותו לכל מערכת הערות או לכלי מחקר.");
        }}>ייצוא לקובץ</button>
        {progress.completed ? <span className="pill good">הושלם</span> : null}
      </div>

      <Card className="flat">
        <div className="stack" style={{ gap: 10 }}>
          <div className="row between">
            <strong>האזנה</strong>
            <span className="small muted num">{playerState.total ? `${playerState.index + 1}/${playerState.total}` : ""}</span>
          </div>
          {speechSupported() ? (
            <>
              <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                <button className="btn primary small-btn" onClick={() => (playerState.paused ? player.current?.resume() : player.current?.play())}>
                  <Icon name="play" size={16} /> {playerState.playing && !playerState.paused ? "מנגן" : "השמע"}
                </button>
                <button className="btn small-btn" aria-label="קטע קודם" onClick={() => player.current?.prev()}><Icon name="prev" size={16} /></button>
                <button className="btn small-btn" aria-label="השהה" onClick={() => player.current?.pause()}><Icon name="pause" size={16} /></button>
                <button className="btn small-btn" aria-label="קטע הבא" onClick={() => player.current?.next()}><Icon name="next" size={16} /></button>
                <button className="btn ghost small-btn" onClick={() => player.current?.stop()}>עצירה</button>
              </div>
              {!hebrewVoiceAvailable() ? <p className="hint small">לא נמצא קול בעברית בדפדפן הזה. ב-iPhone אפשר להוסיף קול בעברית בהגדרות נגישות › תוכן מדובר.</p> : null}
            </>
          ) : (
            <p className="hint small">ההשמעה אינה נתמכת בדפדפן הזה. השיעור מוצג בטקסט מלא למטה.</p>
          )}
        </div>
      </Card>

      <Card>
        <h2 style={{ marginBottom: 6 }}>העיקרון</h2>
        <p className="quote-block">{lesson.principle}</p>
        <div className="stack" style={{ gap: 10, marginTop: 14 }}>
          {lesson.explanation.map((p, i) => <p key={i} className="text-2">{p}</p>)}
        </div>
      </Card>

      <Card>
        <h3 style={{ marginBottom: 8, color: "var(--accent-2)" }}>דוגמה</h3>
        <p className="text-2">{lesson.example}</p>
      </Card>

      <div className="grid-2">
        <Card><h3 style={{ marginBottom: 6 }}>תרגיל</h3><p className="small text-2">{lesson.exercise}</p></Card>
        <Card><h3 style={{ marginBottom: 6 }}>משימה בעולם האמיתי</h3><p className="small text-2">{lesson.assignment}</p>
          <button className="chip" style={{ marginTop: 10 }} aria-pressed={progress.assignmentDone} onClick={() => update({ assignmentDone: !progress.assignmentDone })}>
            {progress.assignmentDone ? "ביצעתי" : "סימון כבוצע"}
          </button>
        </Card>
      </div>

      <Card className="flat">
        <div className="stack" style={{ gap: 16 }}>
          <h2>בדיקה קצרה</h2>
          {lesson.quiz.map((q, qi) => {
            const chosen = progress.quizAnswers[q.id];
            return (
              <fieldset key={q.id} style={{ border: 0, padding: 0, margin: 0, display: "grid", gap: 8 }}>
                <legend style={{ fontWeight: 600, marginBottom: 8 }}>{qi + 1}. {q.question}</legend>
                {q.options.map((opt, oi) => {
                  const isChosen = chosen === oi;
                  const show = revealed[q.id] || chosen !== undefined;
                  const isRight = oi === q.answer;
                  return (
                    <button
                      key={oi}
                      type="button"
                      className="toggle"
                      aria-pressed={isChosen}
                      style={show && isRight ? { borderColor: "#141312" } : show && isChosen ? { borderColor: "#9a3f32" } : undefined}
                      onClick={() => answer(q.id, oi)}
                    >
                      <span>{opt}</span>
                    </button>
                  );
                })}
                {chosen !== undefined ? (
                  <p className="small" style={{ color: chosen === q.answer ? "var(--good)" : "var(--warn)" }}>
                    {chosen === q.answer ? "נכון. " : "לא בדיוק. "}
                    <span className="text-2">{q.why}</span>
                  </p>
                ) : null}
              </fieldset>
            );
          })}
          <p className="small muted">{answered}/{lesson.quiz.length} נענו{answered === lesson.quiz.length ? ` · ${correct} נכונות` : ""}</p>
        </div>
      </Card>

      <Card>
        <label className="field">
          שאלת רפלקציה: {lesson.reflection}
          <textarea className="textarea" value={reflection} maxLength={1200} onChange={(e) => setReflection(e.target.value)} onBlur={() => update({ reflection })} />
        </label>
      </Card>

      <Card>
        <label className="field">
          הערות אישיות
          <textarea className="textarea" value={notes} maxLength={2000} onChange={(e) => setNotes(e.target.value)} onBlur={() => update({ notes })} placeholder="מה למדתי, ומה אנסה השבוע" />
        </label>
      </Card>

      <p className="hint small">{lesson.evidence.level}. {lesson.evidence.note}</p>
      {lesson.medicalNote ? <div className="notice">{lesson.medicalNote}</div> : null}

      <button
        className={`btn block ${progress.completed ? "" : "primary"}`}
        disabled={!canFinish && !progress.completed}
        onClick={() => {
          update({ completed: !progress.completed, reflection, notes });
          toast(progress.completed ? "הסימון הוסר" : "השיעור נשמר כהושלם");
        }}
      >
        {progress.completed ? "ביטול סימון כהושלם" : canFinish ? "סיימתי את השיעור" : "ענה על כל השאלות כדי לסיים"}
      </button>
    </main>
  );
}
