"use client";

import { Apple, Dumbbell, Home, LineChart, User } from "lucide-react";
import { cn } from "@/lib/cn";

export type TabId = "home" | "workouts" | "progress" | "nutrition" | "profile";

export const TABS: { id: TabId; label: string; href: string; Icon: typeof Home }[] = [
  { id: "home", label: "בית", href: "/", Icon: Home },
  { id: "workouts", label: "אימונים", href: "/workouts", Icon: Dumbbell },
  { id: "progress", label: "התקדמות", href: "/progress", Icon: LineChart },
  { id: "nutrition", label: "תזונה", href: "/nutrition", Icon: Apple },
  { id: "profile", label: "פרופיל", href: "/profile", Icon: User },
];

/**
 * Bottom navigation. In RTL the first tab (בית) sits on the right, where the thumb starts.
 * `onSelect` lets the design page demo it without routing; real screens pass hrefs through.
 */
export function TabBar({ active, onSelect }: { active: TabId; onSelect?: (id: TabId) => void }) {
  return (
    <nav
      aria-label="ניווט ראשי"
      className={cn(
        "fixed inset-x-0 bottom-0 z-20 border-t border-border bg-bg/95 backdrop-blur",
        "pb-[env(safe-area-inset-bottom)]",
      )}
    >
      <ul className="mx-auto flex h-(--layout-tabbar-height) max-w-(--layout-max-width)">
        {TABS.map(({ id, label, href, Icon }) => {
          const current = id === active;
          return (
            <li key={id} className="flex-1">
              <a
                href={href}
                aria-current={current ? "page" : undefined}
                onClick={(e) => {
                  if (onSelect) {
                    e.preventDefault();
                    onSelect(id);
                  }
                }}
                className={cn(
                  "flex h-full flex-col items-center justify-center gap-1 text-xs font-medium",
                  current ? "text-accent" : "text-text-muted",
                )}
              >
                <span
                  className={cn(
                    "flex h-7 w-14 items-center justify-center rounded-pill transition-colors duration-(--motion-fast)",
                    current && "bg-accent-soft",
                  )}
                >
                  <Icon aria-hidden className="size-5" strokeWidth={current ? 2.4 : 2} />
                </span>
                {label}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
