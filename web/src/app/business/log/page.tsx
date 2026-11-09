"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { AppShell } from "@/components/app/app-shell";
import { Button } from "@/components/ui/button";
import { Panel, Skeleton } from "@/components/ui/surface";
import { Segmented, TextField } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import type { ClientSource, CutService } from "@/data/life-types";
import { deleteCut, getCut, knownClient, saveCut } from "@/data/journey-repo";
import { localDateKey } from "@/lib/nutrition";
import { cn } from "@/lib/cn";

const SOURCES: { value: ClientSource; label: string }[] = [
  { value: "returning", label: "חוזר" },
  { value: "referral", label: "המלצה" },
  { value: "instagram", label: "אינסטגרם" },
  { value: "tiktok", label: "טיקטוק" },
  { value: "walkin", label: "מזדמן" },
  { value: "other", label: "אחר" },
];

const PRICES = [50, 60, 70, 80, 90, 100, 120];

function LogCut() {
  const router = useRouter();
  const toast = useToast();
  const id = useSearchParams().get("id");
  const [loaded, setLoaded] = useState(!id);
  const [client, setClient] = useState("");
  const [price, setPrice] = useState("70");
  const [tip, setTip] = useState("");
  const [service, setService] = useState<CutService>("haircut");
  const [source, setSource] = useState<ClientSource>("returning");
  const [isNew, setIsNew] = useState(false);
  const [rebooked, setRebooked] = useState(false);
  const [notes, setNotes] = useState("");
  const [date, setDate] = useState(localDateKey());
  const [at, setAt] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!id) return;
    void getCut(id).then((c) => {
      if (c) {
        setClient(c.client);
        setPrice(String(c.price));
        setTip(c.tip ? String(c.tip) : "");
        setService(c.service);
        setSource(c.source);
        setIsNew(c.isNew);
        setRebooked(c.rebooked);
        setNotes(c.notes);
        setDate(c.date);
        setAt(c.at);
      }
      setLoaded(true);
    });
  }, [id]);

  // A name not seen before is a new client, unless chosen otherwise.
  useEffect(() => {
    if (id || !client.trim()) return;
    const t = setTimeout(() => {
      void knownClient(client).then((known) => {
        setIsNew(!known);
        setSource((s) => (known ? "returning" : s === "returning" ? "referral" : s));
      });
    }, 350);
    return () => clearTimeout(t);
  }, [client, id]);

  const amount = Number(price.replace(",", "."));
  const valid = amount > 0;

  const save = async () => {
    await saveCut({ id: id ?? undefined, at, date, client, price: Math.round(amount), tip: Math.round(Number(tip.replace(",", ".")) || 0), service, source, isNew, rebooked, notes });
    toast({ tone: "success", message: id ? "עודכן" : `נרשם: ${Math.round(amount)} ₪` });
    router.push("/business");
  };

  if (!loaded) return <Skeleton className="h-96 rounded-xl" />;

  return (
    <>
      <Panel className="flex flex-col gap-5">
        <TextField label="לקוח" value={client} onChange={(e) => setClient(e.target.value)} placeholder="שם" autoComplete="off" />
        <div className="flex flex-col gap-2">
          <TextField label="מחיר" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} suffix="₪" />
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="מחירים מהירים">
            {PRICES.map((p) => (
              <button key={p} type="button" onClick={() => setPrice(String(p))} className={cn("figure h-9 rounded-pill px-3.5 text-sm", Number(price) === p ? "bg-accent text-on-accent" : "well text-text-muted")}>
                {p}
              </button>
            ))}
          </div>
        </div>
        <TextField label="טיפ" inputMode="decimal" value={tip} onChange={(e) => setTip(e.target.value)} suffix="₪" placeholder="0" />
        <Segmented
          label="שירות"
          value={service}
          onChange={setService}
          fullWidth
          options={[
            { value: "haircut", label: "תספורת" },
            { value: "combo", label: "+ זקן" },
            { value: "beard", label: "זקן" },
            { value: "other", label: "אחר" },
          ]}
        />
      </Panel>
      <Panel className="flex flex-col gap-4">
        <span className="text-sm font-medium text-text-muted">מאיפה הגיע</span>
        <div className="flex flex-wrap gap-2">
          {SOURCES.map((s) => (
            <button key={s.value} type="button" aria-pressed={source === s.value} onClick={() => setSource(s.value)} className={cn("h-9 rounded-pill px-4 text-sm font-medium", source === s.value ? "bg-accent text-on-accent" : "well text-text-muted")}>
              {s.label}
            </button>
          ))}
        </div>
        <div className="hairline" />
        {[
          { label: "לקוח חדש", on: isNew, set: setIsNew },
          { label: "קבע את התור הבא לפני שיצא", on: rebooked, set: setRebooked },
        ].map((t) => (
          <div key={t.label} className="flex items-center justify-between gap-4">
            <span className="text-sm font-medium">{t.label}</span>
            <button type="button" role="switch" aria-checked={t.on} aria-label={t.label} onClick={() => t.set(!t.on)} className={cn("relative h-8 w-14 shrink-0 rounded-pill transition-colors duration-(--motion-base)", t.on ? "bg-accent" : "well")}>
              <span className={cn("absolute top-1 size-6 rounded-pill shadow transition-[inset-inline-start] duration-(--motion-base)", t.on ? "start-7 bg-on-accent" : "start-1 bg-text")} />
            </button>
          </div>
        ))}
        <TextField label="הערה" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="מה הוא אוהב, מה לזכור לפעם הבאה" />
      </Panel>
      <Button size="lg" fullWidth disabled={!valid} onClick={() => void save()}>
        {id ? "שמירה" : "רישום"}
      </Button>
      {id && (
        <Button
          variant="ghost"
          icon={<Trash2 aria-hidden className="size-4" />}
          onClick={() => {
            void deleteCut(id).then(() => {
              toast({ tone: "success", message: "נמחק" });
              router.push("/business");
            });
          }}
        >
          מחיקה
        </Button>
      )}
    </>
  );
}

/** One client out of the chair: who, how much, where from, and whether he booked the next one. */
export default function LogCutPage() {
  return (
    <AppShell back={{ href: "/business", label: "העסק" }} eyebrow="הכיסא" title="רישום תספורת" bottomSpace={false}>
      <Suspense fallback={<Skeleton className="h-96 rounded-xl" />}>
        <LogCut />
      </Suspense>
    </AppShell>
  );
}
