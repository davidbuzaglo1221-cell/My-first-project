import { useEffect, useState, type ReactNode } from "react";
import { back } from "../lib/router";

export function Icon({ name, size = 22 }: { name: IconName; size?: number }) {
  const common = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
  switch (name) {
    case "home":
      return <svg {...common}><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V20h14V9.5" /></svg>;
    case "train":
      return <svg {...common}><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z" /><path d="M4 20.5V5.5" /></svg>;
    case "coach":
      return <svg {...common}><path d="M12 3v3M12 18v3M3 12h3M18 12h3" /><circle cx="12" cy="12" r="5" /></svg>;
    case "track":
      return <svg {...common}><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></svg>;
    case "profile":
      return <svg {...common}><circle cx="12" cy="8" r="4" /><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" /></svg>;
    case "back":
      return <svg {...common}><path d="M9 6l6 6-6 6" /></svg>;
    case "check":
      return <svg {...common} strokeWidth={2.4}><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>;
    case "play":
      return <svg {...common}><path d="M7 5v14l12-7z" fill="currentColor" /></svg>;
    case "pause":
      return <svg {...common}><path d="M8 5v14M16 5v14" /></svg>;
    case "next":
      return <svg {...common}><path d="M6 6l9 6-9 6zM18 6v12" /></svg>;
    case "prev":
      return <svg {...common}><path d="M18 6l-9 6 9 6zM6 6v12" /></svg>;
    case "bookmark":
      return <svg {...common}><path d="M6 3h12v18l-6-4-6 4z" /></svg>;
    case "chev":
      return <svg {...common}><path d="M9 6l6 6-6 6" /></svg>;
    case "plus":
      return <svg {...common}><path d="M12 5v14M5 12h14" /></svg>;
    case "spark":
      return <svg {...common}><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" /></svg>;
  }
}

export type IconName = "home" | "train" | "coach" | "track" | "profile" | "back" | "check" | "play" | "pause" | "next" | "prev" | "bookmark" | "chev" | "plus" | "spark";

export function Topbar({ title, eyebrow, onBack }: { title: string; eyebrow?: string; onBack?: boolean | (() => void) }) {
  return (
    <header className="topbar">
      {onBack ? (
        <button className="back" aria-label="חזרה" onClick={typeof onBack === "function" ? onBack : () => back("/")}>
          <Icon name="back" />
        </button>
      ) : null}
      <div className="title">
        {eyebrow ? <div className="eyebrow">{eyebrow}</div> : null}
        <h1>{title}</h1>
      </div>
    </header>
  );
}

export function Card({ children, className = "", tone }: { children: ReactNode; className?: string; tone?: "accent" | "flat" }) {
  return <section className={`card ${tone ?? ""} ${className}`.trim()}>{children}</section>;
}

export function Empty({ title, text, action }: { title: string; text: string; action?: ReactNode }) {
  return (
    <div className="empty">
      <strong style={{ color: "var(--text)" }}>{title}</strong>
      <span className="small">{text}</span>
      {action}
    </div>
  );
}

export function ScaleInput({ label, value, onChange, low, high }: { label: string; value: number; onChange: (v: 1 | 2 | 3 | 4 | 5) => void; low: string; high: string }) {
  return (
    <div className="stack" style={{ gap: 6 }} role="group" aria-label={label}>
      <div className="row between">
        <span style={{ fontWeight: 600 }}>{label}</span>
        <span className="hint num">{value}/5</span>
      </div>
      <div className="scale">
        {([1, 2, 3, 4, 5] as const).map((n) => (
          <button key={n} type="button" aria-pressed={value === n} aria-label={`${label} ${n} מתוך 5`} onClick={() => onChange(n)}>
            {n}
          </button>
        ))}
      </div>
      <div className="row between hint small"><span>{low}</span><span>{high}</span></div>
    </div>
  );
}

export function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" className="toggle" aria-pressed={checked} onClick={() => onChange(!checked)}>
      <span>{label}</span>
      <span className="box">{checked ? <Icon name="check" size={16} /> : null}</span>
    </button>
  );
}

// ---- Toasts: a tiny event bus so any screen can show a short confirmation ----
type ToastListener = (msg: string) => void;
const toastListeners = new Set<ToastListener>();
export function toast(message: string) {
  toastListeners.forEach((l) => l(message));
}

export function ToastHost() {
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    let timer: number | undefined;
    const listener: ToastListener = (m) => {
      setMsg(m);
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setMsg(null), 2200);
    };
    toastListeners.add(listener);
    return () => {
      toastListeners.delete(listener);
      window.clearTimeout(timer);
    };
  }, []);
  return msg ? <div className="toast" role="status" aria-live="polite">{msg}</div> : null;
}

export function ProgressBar({ value, label }: { value: number; label: string }) {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  return <div className="progress" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}><span style={{ width: `${pct}%` }} /></div>;
}

export function ConfirmButton({ label, confirmLabel, onConfirm, className = "btn danger block" }: { label: string; confirmLabel: string; onConfirm: () => void; className?: string }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = window.setTimeout(() => setArmed(false), 4000);
    return () => window.clearTimeout(t);
  }, [armed]);
  return (
    <button type="button" className={className} onClick={() => (armed ? onConfirm() : setArmed(true))}>
      {armed ? confirmLabel : label}
    </button>
  );
}
