"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { ChevronLeft, FileText, Handshake, MessageSquareText, Target, Trash2 } from "lucide-react";
import { AppShell } from "@/components/app/app-shell";
import { Button } from "@/components/ui/button";
import { Banner, Panel, Skeleton } from "@/components/ui/surface";
import { TextArea } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { DomainMark, Section } from "@/components/journey/parts";
import { deleteNote, listNotes, listSales, putCoachMission, saveNote } from "@/data/journey-repo";
import { useCoachContext, useToday } from "@/hooks/use-journey";
import { askCoach, COACH_ERROR_TEXT, personalMission, type CoachError } from "@/lib/journey/coach-ai";
import { XP } from "@/lib/journey/engine";
import { formatRelativeDay } from "@/lib/format";

const QUICK = [
  "על מה אני הכי מתחמק השבוע?",
  "האם אני מוכן לגור לבד לפי המספרים?",
  "איך להעלות מחיר בלי לאבד לקוחות?",
  "מה הכי חשוב לשינה ולאנרגיה שלי?",
];

/**
 * The coach: asks and answers with the person's profile and numbers in front of it, writes
 * today's mission for him when the library is not enough, and runs sales practice.
 */
export default function CoachPage() {
  const router = useRouter();
  const toast = useToast();
  const ctx = useCoachContext();
  const today = useToday();
  const notes = useLiveQuery(() => listNotes(), []);
  const sales = useLiveQuery(() => listSales(), []);
  const [q, setQ] = useState("");
  const [asking, setAsking] = useState(false);
  const [writing, setWriting] = useState(false);
  const [error, setError] = useState<CoachError | null>(null);

  const ask = async (question: string) => {
    if (!ctx || question.trim().length < 3) return;
    setAsking(true);
    setError(null);
    const r = await askCoach(ctx, question);
    setAsking(false);
    if (!r.ok) return setError(r.error);
    await saveNote({ id: crypto.randomUUID(), at: new Date().toISOString(), kind: "answer", weekStart: null, question: question.trim(), report: null, answer: r.data });
    setQ("");
  };

  const mission = async () => {
    if (!ctx) return;
    setWriting(true);
    setError(null);
    const r = await personalMission(ctx);
    setWriting(false);
    if (!r.ok) return setError(r.error);
    const d = r.data;
    try {
      const row = await putCoachMission({
        date: today,
        templateId: "coach",
        domain: d.domain,
        title: d.title,
        objective: d.objective,
        why: d.why,
        steps: d.steps,
        kind: d.kind,
        target: d.kind === "check" ? 1 : d.target,
        difficulty: d.difficulty,
        boss: false,
        prompt: d.prompt,
        xp: XP.main[d.difficulty],
      });
      router.push(`/mission?id=${encodeURIComponent(row.id)}`);
    } catch {
      toast({ tone: "danger", message: "כבר סגרת היום משימה מהמאמן." });
    }
  };

  const answers = notes?.filter((n) => n.kind === "answer") ?? [];
  const lastReport = notes?.find((n) => n.kind === "report");
  const reviewed = sales?.filter((s) => s.review) ?? [];
  const avg = reviewed.length ? Math.round(reviewed.slice(0, 5).reduce((s, x) => s + x.review!.score, 0) / Math.min(5, reviewed.length)) : null;

  return (
    <AppShell tab="coach" eyebrow="יועץ אסטרטגי" title="המאמן" subtitle="ישיר. מבוסס על המספרים שלך ועל מה שכתבת על עצמך.">
      {ctx === null && (
        <Banner tone="warning" action={<Button size="sm" onClick={() => router.push("/journey/start")}>להתחיל</Button>}>
          המאמן מכיר אותך דרך המסע. קודם תתחיל אותו.
        </Banner>
      )}
      {ctx && !ctx.journey.about.trim() && (
        <Banner tone="info" action={<Button size="sm" variant="soft" onClick={() => router.push("/journey/start?edit=1")}>לכתוב</Button>}>
          המאמן עוד לא יודע מי אתה. כתוב עליך כמה שורות.
        </Banner>
      )}
      {error && <Banner tone="danger">{COACH_ERROR_TEXT[error]}</Banner>}

      <div className="grid grid-cols-2 gap-2.5">
        <Link href="/review" className="card-hero rise flex flex-col gap-3 rounded-xl p-5">
          <FileText aria-hidden className="size-5 text-accent-ink" strokeWidth={1.6} />
          <span className="display text-xl leading-tight">הדוח השבועי</span>
          <span className="text-xs text-text-muted">{lastReport ? `אחרון: ${formatRelativeDay(lastReport.at)}` : "עוד לא נכתב"}</span>
        </Link>
        <Link href="/coach/sales" className="card-hero rise flex flex-col gap-3 rounded-xl p-5" style={{ ["--i" as string]: 1 }}>
          <Handshake aria-hidden className="size-5 text-accent-ink" strokeWidth={1.6} />
          <span className="display text-xl leading-tight">זירת מכירות</span>
          <span className="text-xs text-text-muted">{avg != null ? `ממוצע אחרון: ${avg}` : "סימולציה עם לקוח"}</span>
        </Link>
      </div>

      <Panel className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <Target aria-hidden className="size-5 text-accent-ink" strokeWidth={1.6} />
          <span className="flex-1 font-semibold">משימה שנכתבת בשבילך</span>
        </div>
        <p className="text-sm leading-relaxed text-text-muted">המאמן קורא את 14 הימים האחרונים ובונה משימה אחת להיום, בדיוק על הפער הגדול ביותר.</p>
        <Button variant="soft" loading={writing} disabled={!ctx} onClick={() => void mission()}>
          לכתוב לי משימה להיום
        </Button>
      </Panel>

      <Section title="לשאול">
        <Panel className="flex flex-col gap-3">
          <TextArea label="השאלה שלך" hideLabel rows={3} value={q} onChange={(e) => setQ(e.target.value)} placeholder="שאל כל דבר: אימון, כסף, לקוחות, זוגיות, פחדים" />
          <div className="flex flex-wrap gap-1.5">
            {QUICK.map((s) => (
              <button key={s} type="button" onClick={() => setQ(s)} className="well rounded-pill px-3 py-1.5 text-xs text-text-muted hover:text-text">
                {s}
              </button>
            ))}
          </div>
          <Button loading={asking} disabled={!ctx || q.trim().length < 3} icon={<MessageSquareText aria-hidden className="size-4" />} onClick={() => void ask(q)}>
            לשאול
          </Button>
        </Panel>
      </Section>

      {notes === undefined ? (
        <Skeleton className="h-40 rounded-xl" />
      ) : (
        answers.length > 0 && (
          <Section title="תשובות">
            <ul className="flex flex-col gap-2.5">
              {answers.slice(0, 10).map((n, i) => (
                <li key={n.id} className="glass rise flex flex-col gap-3 rounded-lg p-5" style={{ ["--i" as string]: i }}>
                  <div className="flex items-start gap-3">
                    <p className="flex-1 font-semibold">{n.question}</p>
                    <button type="button" aria-label="מחיקת התשובה" onClick={() => void deleteNote(n.id)} className="text-text-subtle hover:text-text">
                      <Trash2 aria-hidden className="size-4" />
                    </button>
                  </div>
                  <p className="whitespace-pre-line text-[0.95rem] leading-relaxed text-text-muted">{n.answer?.answer}</p>
                  {!!n.answer?.actions.length && (
                    <ul className="flex flex-col gap-1.5 border-t border-border pt-3">
                      {n.answer.actions.map((a, j) => (
                        <li key={j} className="flex gap-2 text-sm">
                          <ChevronLeft aria-hidden className="mt-0.5 size-4 shrink-0 text-accent-ink" />
                          {a}
                        </li>
                      ))}
                    </ul>
                  )}
                  <span className="text-xs text-text-subtle">{formatRelativeDay(n.at)}</span>
                </li>
              ))}
            </ul>
          </Section>
        )
      )}

      {ctx && ctx.missions.some((m) => m.source === "coach") && (
        <Section title="משימות שהמאמן כתב">
          <ul className="flex flex-col gap-2">
            {ctx.missions
              .filter((m) => m.source === "coach")
              .slice(-5)
              .reverse()
              .map((m) => (
                <li key={m.id}>
                  <Link href={`/mission?id=${encodeURIComponent(m.id)}`} className="glass flex items-center gap-3 rounded-md px-4 py-3">
                    <span className="flex flex-1 flex-col">
                      <DomainMark domain={m.domain} />
                      <span className="font-medium">{m.title}</span>
                    </span>
                    <span className="text-xs text-text-subtle">{m.status === "done" ? "בוצע" : m.status === "skipped" ? "דילגת" : formatRelativeDay(`${m.date}T12:00:00`)}</span>
                  </Link>
                </li>
              ))}
          </ul>
        </Section>
      )}
    </AppShell>
  );
}
