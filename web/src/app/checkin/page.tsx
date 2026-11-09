"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/app/app-shell";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/surface";
import { TextArea } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { getCheckIn, saveCheckIn } from "@/data/journey-repo";
import { useToday } from "@/hooks/use-journey";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/cn";

/** A stepper for hours: big number, half-hour steps. */
function Hours({ label, value, onChange, step = 0.5, max = 16 }: { label: string; value: number | null; onChange: (v: number) => void; step?: number; max?: number }) {
  const v = value ?? 0;
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-sm font-medium text-text-muted">{label}</span>
      <div className="flex items-center gap-2">
        <button type="button" aria-label={`${label}: פחות`} onClick={() => onChange(Math.max(0, v - step))} className="glass inline-flex size-11 items-center justify-center rounded-pill text-xl">
          −
        </button>
        <span className={cn("figure w-16 text-center text-2xl", value == null && "text-text-subtle")} aria-live="polite">
          {value == null ? "—" : formatNumber(v, 1)}
        </span>
        <button type="button" aria-label={`${label}: יותר`} onClick={() => onChange(Math.min(max, (value == null ? (label.includes("שינה") ? 7 : 2) - step : v) + step))} className="glass inline-flex size-11 items-center justify-center rounded-pill text-xl">
          +
        </button>
      </div>
    </div>
  );
}

/** Five dots, 1..5. */
function Scale5({ label, value, onChange, low, high }: { label: string; value: number | null; onChange: (v: number) => void; low: string; high: string }) {
  return (
    <div className="flex flex-col gap-2.5" role="radiogroup" aria-label={label}>
      <span className="text-sm font-medium text-text-muted">{label}</span>
      <div className="flex gap-2">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={`${n} מתוך 5`}
            onClick={() => onChange(n)}
            className={cn(
              "figure flex h-12 flex-1 items-center justify-center rounded-md text-lg transition-[background-color,color] duration-(--motion-fast)",
              value != null && n <= value ? "bg-accent text-on-accent" : "well text-text-muted",
            )}
          >
            {n}
          </button>
        ))}
      </div>
      <div className="flex justify-between text-xs text-text-subtle">
        <span>{low}</span>
        <span>{high}</span>
      </div>
    </div>
  );
}

/** Sixty seconds a day: the numbers that decide how the next day goes, and one honest sentence each. */
export default function CheckInPage() {
  const router = useRouter();
  const toast = useToast();
  const today = useToday();
  const [sleep, setSleep] = useState<number | null>(null);
  const [energy, setEnergy] = useState<number | null>(null);
  const [mood, setMood] = useState<number | null>(null);
  const [screen, setScreen] = useState<number | null>(null);
  const [trained, setTrained] = useState(false);
  const [win, setWin] = useState("");
  const [lesson, setLesson] = useState("");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    void getCheckIn(today).then((c) => {
      if (c) {
        setSleep(c.sleepHours);
        setEnergy(c.energy);
        setMood(c.mood);
        setScreen(c.screenHours);
        setTrained(c.trained);
        setWin(c.win);
        setLesson(c.lesson);
      }
      setLoaded(true);
    });
  }, [today]);

  const save = async () => {
    await saveCheckIn({ date: today, sleepHours: sleep, energy, mood, screenHours: screen, trained, win: win.trim(), lesson: lesson.trim() });
    toast({ tone: "success", message: "נרשם" });
    router.push("/");
  };

  return (
    <AppShell back={{ href: "/", label: "היום" }} eyebrow="יומן" title="צ'ק-אין" subtitle="60 שניות. מספרים אמיתיים, לא מה שהיית רוצה שיהיה." bottomSpace={false}>
      {loaded && (
        <>
          <Panel className="flex flex-col gap-5">
            <Hours label="שעות שינה בלילה" value={sleep} onChange={setSleep} />
            <div className="hairline" />
            <Hours label="שעות מסך היום" value={screen} onChange={setScreen} max={20} />
            <div className="hairline" />
            <div className="flex items-center justify-between gap-4">
              <span className="text-sm font-medium text-text-muted">התאמנתי היום</span>
              <button
                type="button"
                role="switch"
                aria-checked={trained}
                aria-label="התאמנתי היום"
                onClick={() => setTrained((t) => !t)}
                className={cn("relative h-8 w-14 rounded-pill transition-colors duration-(--motion-base)", trained ? "bg-accent" : "well")}
              >
                <span className={cn("absolute top-1 size-6 rounded-pill bg-text shadow transition-[inset-inline-start] duration-(--motion-base)", trained ? "start-7 bg-on-accent" : "start-1")} />
              </button>
            </div>
          </Panel>
          <Panel className="flex flex-col gap-6">
            <Scale5 label="אנרגיה" value={energy} onChange={setEnergy} low="ריק" high="מלא" />
            <Scale5 label="מצב רוח" value={mood} onChange={setMood} low="קשה" high="מצוין" />
          </Panel>
          <Panel className="flex flex-col gap-5">
            <TextArea label="הניצחון של היום" rows={2} value={win} onChange={(e) => setWin(e.target.value)} placeholder="דבר אחד שעשית למרות שלא בא לך" />
            <TextArea label="הלקח של היום" rows={2} value={lesson} onChange={(e) => setLesson(e.target.value)} placeholder="מה היית עושה אחרת" />
          </Panel>
          <Button size="lg" fullWidth onClick={() => void save()}>
            שמירה
          </Button>
        </>
      )}
    </AppShell>
  );
}
