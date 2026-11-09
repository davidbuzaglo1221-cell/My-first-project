"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { AppShell } from "@/components/app/app-shell";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/surface";
import { TextArea, TextField } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { DOMAIN_ICON } from "@/components/journey/parts";
import type { Domain } from "@/data/life-types";
import { ensureDay, getJourney, saveJourney } from "@/data/journey-repo";
import { useProfile } from "@/hooks/use-data";
import { DOMAIN_LABEL, DOMAINS } from "@/lib/journey/library";
import { addDays, localDateKey } from "@/lib/nutrition";
import { cn } from "@/lib/cn";

const ABOUT_HINT = `מי אתה, איפה אתה עומד היום, ומה אתה רוצה להפוך להיות.
למשל: גיל, מצב (שחרור, עבודה, מגורים), המקצוע, המטרות לשנה, מה עוצר אותך, ומה אתה רוצה שהמאמן יגיד לך כשאתה מתחמק.`;

/**
 * Sets up the 90 days, or edits them (?edit=1): name, day one, three focus areas, and the person
 * in his own words, which is what the coach reads.
 */
function JourneyStartPageInner() {
  const router = useRouter();
  const params = useSearchParams();
  const edit = params.get("edit") === "1";
  const toast = useToast();
  const profile = useProfile();
  const [loaded, setLoaded] = useState(false);
  const [name, setName] = useState("");
  const [start, setStart] = useState(localDateKey());
  const [focus, setFocus] = useState<Domain[]>([]);
  const [about, setAbout] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void getJourney().then((j) => {
      if (j) {
        setName(j.name ?? "");
        setStart(j.startDate);
        setFocus(j.focus);
        setAbout(j.about);
      }
      setLoaded(true);
    });
  }, []);

  const toggle = (d: Domain) =>
    setFocus((f) => (f.includes(d) ? f.filter((x) => x !== d) : f.length >= 3 ? f : [...f, d]));

  const submit = async () => {
    setSaving(true);
    const existing = await getJourney();
    await saveJourney({ name: name.trim() || null, startDate: start, focus, about: about.trim() });
    if (!existing) await ensureDay(localDateKey());
    toast({ tone: "success", message: edit ? "נשמר" : "המסע התחיל. יום 1." });
    // A new person also sets up training (plan and food targets) once.
    router.replace(!existing && profile && !profile.onboardedAt ? "/welcome" : edit ? "/journey" : "/");
  };

  const today = localDateKey();

  return (
    <AppShell
      eyebrow={edit ? "הגדרות המסע" : "90 יום"}
      title={edit ? "המסע שלך" : "בונים את עצמך"}
      subtitle={edit ? undefined : "תשעים יום, שישה שלבים, משימה אמיתית בכל יום. לא מוטיבציה: ביצוע."}
      back={edit ? { href: "/journey", label: "המסע" } : undefined}
      bottomSpace={false}
    >
      {!loaded ? null : (
        <>
          <Panel className="flex flex-col gap-5">
            <TextField label="איך לקרוא לך" value={name} onChange={(e) => setName(e.target.value)} autoComplete="given-name" placeholder="השם שלך" />
            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium text-text-muted">יום 1</span>
              <div className="flex gap-2">
                {[
                  { v: today, l: "היום" },
                  { v: addDays(today, 1), l: "מחר" },
                ].map((o) => (
                  <button
                    key={o.v}
                    type="button"
                    aria-pressed={start === o.v}
                    onClick={() => setStart(o.v)}
                    className={cn("h-10 rounded-pill px-4 text-sm font-medium", start === o.v ? "bg-accent text-on-accent" : "glass text-text-muted")}
                  >
                    {o.l}
                  </button>
                ))}
                {edit && start !== today && start !== addDays(today, 1) && (
                  <span className="well inline-flex h-10 items-center rounded-pill px-4 text-sm">{start}</span>
                )}
              </div>
            </div>
          </Panel>

          <section className="flex flex-col gap-3" aria-label="תחומי מיקוד">
            <div className="flex items-baseline justify-between">
              <h2 className="eyebrow">שלושה תחומי מיקוד</h2>
              <span className="text-xs text-text-subtle">{focus.length}/3</span>
            </div>
            <p className="text-sm text-text-muted">בתחומים האלה תקבל יותר משימות. השאר לא נעלמים: המערכת דואגת גם לחלש שבהם.</p>
            <div className="grid grid-cols-3 gap-2">
              {DOMAINS.map((d) => {
                const Icon = DOMAIN_ICON[d];
                const on = focus.includes(d);
                return (
                  <button
                    key={d}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggle(d)}
                    disabled={!on && focus.length >= 3}
                    className={cn(
                      "flex flex-col items-center gap-2 rounded-lg border px-2 py-4 text-sm font-medium transition-[background-color,border-color,opacity] duration-(--motion-fast) disabled:opacity-40",
                      on ? "border-accent bg-accent-soft text-accent-ink" : "glass border-transparent text-text-muted",
                    )}
                  >
                    <Icon aria-hidden className="size-5" strokeWidth={1.6} />
                    {DOMAIN_LABEL[d]}
                  </button>
                );
              })}
            </div>
          </section>

          <Panel className="flex flex-col gap-3">
            <TextArea
              label="מי אתה, במילים שלך"
              rows={8}
              value={about}
              onChange={(e) => setAbout(e.target.value)}
              placeholder={ABOUT_HINT}
              hint="המאמן קורא את זה לפני כל תשובה. אפשר להדביק כאן את כל הפרופיל שכתבת, ולעדכן בכל זמן."
            />
          </Panel>

          <Button size="lg" fullWidth loading={saving} onClick={() => void submit()}>
            {edit ? "שמירה" : "להתחיל את יום 1"}
          </Button>
        </>
      )}
    </AppShell>
  );
}

export default function JourneyStartPage() {
  return (
    <Suspense fallback={null}>
      <JourneyStartPageInner />
    </Suspense>
  );
}
