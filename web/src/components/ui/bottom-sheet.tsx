"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Bottom sheet on Radix Dialog: focus is trapped, Escape and the overlay close it,
 * focus returns to the trigger. Title is required so screen readers announce it.
 */
export function BottomSheet({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-overlay/50 animate-[fade-in_var(--motion-base)_ease-out]" />
        <Dialog.Content
          dir="rtl"
          className={cn(
            "fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[88dvh] max-w-(--layout-max-width) flex-col",
            "rounded-t-xl bg-bg shadow-sheet outline-none",
            "pb-[env(safe-area-inset-bottom)] animate-[sheet-in_var(--motion-slow)_var(--ease-out)]",
          )}
        >
          <div aria-hidden className="mx-auto mt-2 h-1.5 w-10 rounded-pill bg-border" />
          <div className="flex items-center justify-between gap-3 px-4 pt-2 pb-3">
            <div>
              <Dialog.Title className="text-lg">{title}</Dialog.Title>
              {description ? (
                <Dialog.Description className="text-sm text-text-muted">{description}</Dialog.Description>
              ) : (
                <Dialog.Description className="sr-only">{title}</Dialog.Description>
              )}
            </div>
            <Dialog.Close
              aria-label="סגירה"
              className="inline-flex size-10 items-center justify-center rounded-pill text-text-muted hover:bg-surface"
            >
              <X aria-hidden className="size-5" />
            </Dialog.Close>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">{children}</div>
          {footer && <div className="border-t border-border px-4 py-3">{footer}</div>}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/** A row inside an action sheet (the + menu). */
export function SheetAction({
  icon,
  label,
  hint,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  hint?: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-md px-2 py-3 text-start hover:bg-surface active:bg-surface-2"
    >
      <span className="flex size-11 shrink-0 items-center justify-center rounded-md bg-accent-soft text-accent-ink">
        {icon}
      </span>
      <span className="flex flex-col">
        <span className="font-semibold">{label}</span>
        {hint && <span className="text-sm text-text-muted">{hint}</span>}
      </span>
    </button>
  );
}
