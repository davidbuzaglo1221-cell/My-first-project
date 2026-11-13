"use client";

import Link from "next/link";
import { Briefcase, Compass, Dumbbell, Sparkles, Sun } from "lucide-react";
import { cn } from "@/lib/cn";

/** The five rooms of the app. Older screens name their own section; they map onto these. */
export type TabId = "home" | "journey" | "body" | "business" | "coach" | "workouts" | "progress" | "nutrition" | "profile";
type MainTab = "home" | "journey" | "body" | "business" | "coach";

export const TABS: { id: MainTab; label: string; href: string; Icon: typeof Sun }[] = [
  { id: "home", label: "היום", href: "/", Icon: Sun },
  { id: "journey", label: "המסע", href: "/journey", Icon: Compass },
  { id: "body", label: "גוף", href: "/workouts", Icon: Dumbbell },
  { id: "business", label: "עסק", href: "/business", Icon: Briefcase },
  { id: "coach", label: "מאמן", href: "/coach", Icon: Sparkles },
];

const MAIN: Record<TabId, MainTab | null> = {
  home: "home",
  journey: "journey",
  body: "body",
  workouts: "body",
  progress: "body",
  nutrition: "body",
  business: "business",
  coach: "coach",
  profile: null,
};

/**
 * Floating navigation on graphite, inset from the edges. In RTL the first tab sits on the right,
 * where the thumb starts. The current room gets the gold mark; the rest stay quiet.
 */
export function TabBar({
  active,
  onSelect,
  hrefFor,
}: {
  active: TabId;
  onSelect?: (id: MainTab) => void;
  hrefFor?: (id: MainTab) => string;
}) {
  const current = MAIN[active];
  return (
    <nav
      aria-label="ניווט ראשי"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-20 px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))]"
    >
      <ul className="glass-raised pointer-events-auto mx-auto flex h-(--layout-tabbar-height) max-w-(--layout-max-width) items-stretch rounded-xl px-1.5">
        {TABS.map(({ id, label, href, Icon }) => {
          const on = id === current;
          return (
            <li key={id} className="flex-1">
              <Link
                href={hrefFor ? hrefFor(id) : href}
                aria-current={on ? "page" : undefined}
                onClick={(e) => {
                  if (onSelect) {
                    e.preventDefault();
                    onSelect(id);
                  }
                }}
                className={cn(
                  "relative flex h-full flex-col items-center justify-center gap-1 pb-1 text-[0.6875rem] font-medium tracking-wide transition-colors duration-(--motion-fast)",
                  on ? "text-text" : "text-text-subtle hover:text-text-muted",
                )}
              >
                <Icon aria-hidden className={cn("size-[1.3rem] transition-transform duration-(--motion-base)", on && "-translate-y-px text-accent")} strokeWidth={on ? 1.9 : 1.5} />
                {label}
                <span
                  aria-hidden
                  className={cn(
                    "absolute bottom-1.5 h-[2px] rounded-pill bg-accent shadow-[0_0_12px_var(--c-accent)] transition-[width,opacity] duration-(--motion-base)",
                    on ? "w-6 opacity-100" : "w-0 opacity-0",
                  )}
                />
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
