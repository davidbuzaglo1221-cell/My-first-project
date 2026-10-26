"use client";

import { Apple, Dumbbell, Home, LineChart, User } from "lucide-react";
import { cn } from "@/lib/cn";

export type TabId = "home" | "workouts" | "progress" | "nutrition" | "profile";

export const TABS: { id: TabId; label: string; href: string; Icon: typeof Home }[] = [
  { id: "home", label: "היום", href: "/", Icon: Home },
  { id: "workouts", label: "אימונים", href: "/workouts", Icon: Dumbbell },
  { id: "progress", label: "התקדמות", href: "/progress", Icon: LineChart },
  { id: "nutrition", label: "תזונה", href: "/nutrition", Icon: Apple },
  { id: "profile", label: "פרופיל", href: "/profile", Icon: User },
];

/**
 * Floating glass navigation, inset from the screen edges. In RTL the first tab sits on the right,
 * where the thumb starts. `onSelect` lets the design page demo it without routing.
 */
export function TabBar({
  active,
  onSelect,
  hrefFor,
}: {
  active: TabId;
  onSelect?: (id: TabId) => void;
  hrefFor?: (id: TabId) => string;
}) {
  return (
    <nav
      aria-label="ניווט ראשי"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-20 px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))]"
    >
      <ul className="glass-raised pointer-events-auto mx-auto flex h-(--layout-tabbar-height) max-w-(--layout-max-width) items-stretch rounded-xl px-1.5">
        {TABS.map(({ id, label, href, Icon }) => {
          const current = id === active;
          return (
            <li key={id} className="flex-1">
              <a
                href={hrefFor ? hrefFor(id) : href}
                aria-current={current ? "page" : undefined}
                onClick={(e) => {
                  if (onSelect) {
                    e.preventDefault();
                    onSelect(id);
                  }
                }}
                className={cn(
                  "relative flex h-full flex-col items-center justify-center gap-1 text-[0.6875rem] font-medium transition-colors duration-(--motion-fast)",
                  current ? "text-text" : "text-text-subtle hover:text-text-muted",
                )}
              >
                <Icon aria-hidden className={cn("size-[1.35rem]", current && "text-accent")} strokeWidth={current ? 2.1 : 1.7} />
                {label}
                {/* A short lit line under the current tab, instead of a filled pill. */}
                <span
                  aria-hidden
                  className={cn(
                    "absolute bottom-1.5 h-0.5 rounded-pill bg-accent transition-[width,opacity] duration-(--motion-base)",
                    current ? "w-5 opacity-100" : "w-0 opacity-0",
                  )}
                />
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
