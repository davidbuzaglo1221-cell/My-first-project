"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { CheckCircle2, AlertTriangle, Trophy } from "lucide-react";
import { cn } from "@/lib/cn";

type Tone = "success" | "danger" | "pr";
type Toast = { id: number; tone: Tone; message: string; action?: { label: string; onClick: () => void } };

const ToastContext = createContext<(t: Omit<Toast, "id">) => void>(() => {});

export function useToast() {
  return useContext(ToastContext);
}

const icons = { success: CheckCircle2, danger: AlertTriangle, pr: Trophy };
const tones = {
  success: "glass-raised text-text [&_svg]:text-success",
  danger: "bg-danger text-on-danger",
  pr: "glass-raised text-text [&_svg]:text-pr",
};

/** One toast at a time, above the tab bar, announced politely (assertive for errors). */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<Toast | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback((t: Omit<Toast, "id">) => {
    setToast({ ...t, id: Date.now() });
  }, []);

  useEffect(() => {
    if (!toast) return;
    if (timer.current) clearTimeout(timer.current);
    // Toasts with an action (undo) stay longer.
    timer.current = setTimeout(() => setToast(null), toast.action ? 6000 : 3500);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [toast]);

  const Icon = toast ? icons[toast.tone] : null;

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div
        aria-live={toast?.tone === "danger" ? "assertive" : "polite"}
        className="pointer-events-none fixed inset-x-0 z-50 flex justify-center px-4 bottom-[calc(var(--layout-tabbar-height)+6.5rem+env(safe-area-inset-bottom))]"
      >
        {toast && Icon && (
          <div
            key={toast.id}
            role="status"
            className={cn(
              "pointer-events-auto flex w-full max-w-(--layout-max-width) items-center gap-3 rounded-lg px-4 py-3.5",
              "animate-[toast-in_var(--motion-base)_var(--ease-out)]",
              tones[toast.tone],
            )}
          >
            <Icon aria-hidden className="size-5 shrink-0" />
            <span className="flex-1 text-sm font-medium">{toast.message}</span>
            {toast.action && (
              <button
                type="button"
                onClick={() => {
                  toast.action?.onClick();
                  setToast(null);
                }}
                className="text-sm font-semibold text-accent"
              >
                {toast.action.label}
              </button>
            )}
          </div>
        )}
      </div>
    </ToastContext.Provider>
  );
}
