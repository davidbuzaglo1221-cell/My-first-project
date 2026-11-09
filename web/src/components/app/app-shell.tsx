"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { TabBar, type TabId } from "@/components/ui/tab-bar";
import { cn } from "@/lib/cn";

/**
 * Page frame for every tab screen: title, optional back link and action, the content column,
 * and the floating tab bar. `bottomSpace` leaves room above the tab bar for a FAB.
 */
export function AppShell({
  tab,
  eyebrow,
  title,
  subtitle,
  back,
  action,
  children,
  hideTabs,
  bottomSpace = true,
}: {
  tab?: TabId;
  /** A short tracked label above the title (the section, the day). */
  eyebrow?: ReactNode;
  title?: string;
  subtitle?: ReactNode;
  back?: { href: string; label: string };
  action?: ReactNode;
  children: ReactNode;
  hideTabs?: boolean;
  bottomSpace?: boolean;
}) {
  return (
    <>
      <main
        className={cn(
          "mx-auto flex min-h-dvh w-full max-w-(--layout-max-width) flex-col gap-5 px-4 pt-[calc(1.25rem+env(safe-area-inset-top))]",
          bottomSpace ? "pb-[calc(var(--layout-tabbar-height)+7rem+env(safe-area-inset-bottom))]" : "pb-10",
        )}
      >
        {(title || back || action) && (
          <header className="flex flex-col gap-3">
            {back && (
              <Link href={back.href} className="-ms-1.5 inline-flex w-fit items-center gap-0.5 text-sm text-text-muted hover:text-text">
                {/* In RTL, "back" points right. */}
                <ChevronRight aria-hidden className="size-4" />
                {back.label}
              </Link>
            )}
            <div className="flex items-end justify-between gap-3">
              <div className="rise flex min-w-0 flex-col gap-1.5">
                {eyebrow && <span className="eyebrow">{eyebrow}</span>}
                {title && <h1 className="display text-[2.125rem]">{title}</h1>}
                {subtitle && <p className="text-sm text-text-muted">{subtitle}</p>}
              </div>
              {action}
            </div>
          </header>
        )}
        {children}
      </main>
      {!hideTabs && tab && <TabBar active={tab} />}
    </>
  );
}
