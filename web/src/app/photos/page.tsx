"use client";

import { useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Camera, Lock, Trash2 } from "lucide-react";
import { AppShell } from "@/components/app/app-shell";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/field";
import { EmptyState, Panel, Skeleton } from "@/components/ui/surface";
import { addProgressPhoto, deleteProgressPhoto, listProgressPhotos } from "@/data/coach-repo";
import type { Pose, ProgressPhoto } from "@/data/types";
import { resizeImageUnder } from "@/lib/image";
import { formatFullDate } from "@/lib/format";
import { cn } from "@/lib/cn";
import { IS_ARTIFACT } from "@/lib/runtime";

const POSE: Record<Pose, string> = { front: "חזית", side: "צד", back: "גב" };
const short = new Intl.DateTimeFormat("he-IL", { day: "numeric", month: "short" });

/** Drag to reveal one photo over the other: the honest way to see change. */
function Compare({ before, after }: { before: ProgressPhoto; after: ProgressPhoto }) {
  const [pos, setPos] = useState(50);
  return (
    <figure className="flex flex-col gap-3">
      <div dir="ltr" className="relative aspect-[3/4] w-full overflow-hidden rounded-xl bg-overlay">
        {/* eslint-disable-next-line @next/next/no-img-element -- local data URL */}
        <img src={after.dataUrl} alt={`אחרי, ${formatFullDate(`${after.date}T12:00:00`)}`} className="absolute inset-0 size-full object-cover" />
        <div className="absolute inset-0 overflow-hidden" style={{ width: `${pos}%` }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- local data URL */}
          <img src={before.dataUrl} alt={`לפני, ${formatFullDate(`${before.date}T12:00:00`)}`} className="absolute inset-0 h-full max-w-none object-cover" style={{ width: `${10000 / Math.max(pos, 1)}%` }} />
        </div>
        <span aria-hidden className="absolute inset-y-0 w-0.5 bg-white shadow-pop" style={{ left: `${pos}%` }} />
        <span className="glass-raised absolute top-3 left-3 rounded-pill px-2.5 py-1 text-xs font-semibold">{short.format(new Date(`${before.date}T12:00:00`))}</span>
        <span className="glass-raised absolute top-3 right-3 rounded-pill px-2.5 py-1 text-xs font-semibold">{short.format(new Date(`${after.date}T12:00:00`))}</span>
      </div>
      <input type="range" min={0} max={100} value={pos} onChange={(e) => setPos(Number(e.target.value))} aria-label="השוואה: לפני ואחרי" className="w-full accent-[var(--c-accent)]" />
    </figure>
  );
}

/** S24: private progress photos with a before/after comparison. They never leave the phone. */
export default function PhotosPage() {
  const input = useRef<HTMLInputElement>(null);
  const [pose, setPose] = useState<Pose>("front");
  const [picked, setPicked] = useState<string[]>([]);
  const photos = useLiveQuery(() => listProgressPhotos(), []);

  if (!photos) {
    return (
      <AppShell tab="progress" title="תמונות התקדמות" back={{ href: "/progress", label: "התקדמות" }}>
        <Skeleton className="h-72 rounded-xl" />
      </AppShell>
    );
  }
  const ofPose = photos.filter((p) => p.pose === pose);
  const chosen = picked.map((id) => photos.find((p) => p.id === id)).filter((p): p is ProgressPhoto => !!p).sort((a, b) => a.date.localeCompare(b.date));
  // Default comparison: the first and the latest photo of this pose.
  const pair = chosen.length === 2 ? chosen : ofPose.length >= 2 ? [ofPose.at(-1)!, ofPose[0]] : null;

  return (
    <AppShell tab="progress" title="תמונות התקדמות" back={{ href: "/progress", label: "התקדמות" }}>
      <input
        ref={input}
        type="file"
        accept="image/*"
        capture="user"
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={async (e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          await addProgressPhoto(pose, await resizeImageUnder(f, 1080, 230_000));
          e.target.value = "";
        }}
      />
      <p className="flex items-center gap-2 text-sm text-text-muted">
        <Lock aria-hidden className="size-4 shrink-0" />
        {IS_ARTIFACT ? "התמונות פרטיות: נשמרות בחשבון Claude שלך, וגלויות רק לך." : "התמונות נשמרות בטלפון הזה בלבד ולא נשלחות לשום מקום."}
      </p>
      <Segmented label="תנוחה" value={pose} onChange={(p) => { setPose(p); setPicked([]); }} fullWidth options={(["front", "side", "back"] as Pose[]).map((p) => ({ value: p, label: POSE[p] }))} />
      <Button size="lg" fullWidth icon={<Camera aria-hidden className="size-5" />} onClick={() => input.current?.click()}>
        צילום {POSE[pose]}
      </Button>

      {ofPose.length === 0 ? (
        <EmptyState icon={<Camera aria-hidden className="size-6" />} title="עוד אין תמונות" body="תמונה פעם בשבועיים, באותו אור ובאותה תנוחה, מראה שינוי שהמראה לא מראה." />
      ) : (
        <>
          {pair && (
            <Panel className="flex flex-col gap-3">
              <h2 className="text-lg">לפני ואחרי</h2>
              <Compare before={pair[0]} after={pair[1]} />
              <p className="text-xs text-text-subtle">אפשר לבחור שתי תמונות אחרות למטה.</p>
            </Panel>
          )}
          <ul className="grid grid-cols-3 gap-2" aria-label="תמונות">
            {ofPose.map((p) => {
              const sel = picked.includes(p.id);
              return (
                <li key={p.id} className="relative">
                  <button
                    type="button"
                    aria-pressed={sel}
                    aria-label={`תמונה מ${formatFullDate(`${p.date}T12:00:00`)}${sel ? ", נבחרה להשוואה" : ""}`}
                    onClick={() => setPicked((x) => (sel ? x.filter((i) => i !== p.id) : [...x.slice(-1), p.id]))}
                    className={cn("block w-full overflow-hidden rounded-md", sel && "outline-2 outline-offset-2 outline-focus")}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element -- local data URL */}
                    <img src={p.dataUrl} alt="" className="aspect-[3/4] w-full object-cover" />
                  </button>
                  <span className="glass-raised pointer-events-none absolute bottom-1.5 start-1.5 rounded-pill px-2 py-0.5 text-[0.6875rem] font-semibold">
                    {short.format(new Date(`${p.date}T12:00:00`))}
                  </span>
                  <button type="button" aria-label="מחיקת התמונה" onClick={() => void deleteProgressPhoto(p.id)} className="glass-raised absolute top-1.5 end-1.5 flex size-8 items-center justify-center rounded-pill text-text-muted">
                    <Trash2 aria-hidden className="size-3.5" />
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </AppShell>
  );
}
