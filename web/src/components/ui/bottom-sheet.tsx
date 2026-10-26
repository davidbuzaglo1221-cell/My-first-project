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
        <Dialog.Overlay className="fixed inset-0 z-40 bg-overlay/45 backdrop-blur-[2px] animate-[fade-in_var(--motion-base)_ease-out]" />
        <Dialog.Content
          dir="rtl"
          className={cn(
            "glass-raised fixed inset-x-2 bottom-2 z-50 mx-auto flex max-h-[86dvh] max-w-(--layout-max-width) flex-col",
            "rounded-xl outline-none",
            "mb-[env(safe-area-inset-bottom)] animate-[sheet-in_var(--motion-slow)_var(--ease-out)]",
          )}
        >
          <div aria-hidden className="mx-auto mt-2.5 h-1 w-9 rounded-pill bg-text-subtle/40" />
          <div className="flex items-start justify-between gap-3 px-5 pt-3 pb-2">
            <div className="flex flex-col gap-0.5">
              <Dialog.Title className="font-display text-xl">{title}</Dialog.Title>
              {description ? (
                <Dialog.Description className="text-sm text-text-muted">{description}</Dialog.Description>
              ) : (
                <Dialog.Description className="sr-only">{title}</Dialog.Description>
              )}
            </div>
            <Dialog.Close
              aria-label="סגירה"
              className="well -me-1 inline-flex size-9 items-center justify-center rounded-pill text-text-muted hover:text-text"
            >
              <X aria-hidden className="size-4" />
            </Dialog.Close>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">{children}</div>
          {footer && <div className="border-t border-border/60 px-5 py-4">{footer}</div>}
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
      className="flex w-full items-center gap-4 rounded-md px-3 py-3 text-start transition-colors duration-(--motion-fast) hover:bg-accent-soft/40 active:bg-accent-soft/60"
    >
      <span className="well flex size-11 shrink-0 items-center justify-center rounded-md text-accent">{icon}</span>
      <span className="flex flex-col">
        <span className="font-medium">{label}</span>
        {hint && <span className="text-sm text-text-subtle">{hint}</span>}
      </span>
    </button>
  );
}
