"use client";

import { useEffect, type ReactNode } from "react";
import { ToastProvider } from "@/components/ui/toast";
import { requestPersistentStorage } from "@/data/backup";
import { useProfile } from "@/hooks/use-data";

/** Applies the theme from settings and remembers it for the next page load. */
function ThemeSync() {
  const profile = useProfile();
  useEffect(() => {
    if (!profile) return;
    const root = document.documentElement;
    if (profile.theme === "system") root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", profile.theme);
    // Remembered for the boot script in layout.tsx (applied before the first paint).
    try {
      localStorage.setItem("theme", profile.theme);
    } catch {
      // Storage blocked: the theme still applies once the profile loads.
    }
  }, [profile]);
  return null;
}

/** Registers the offline service worker (production only; in dev it would cache stale code). */
function ServiceWorker() {
  useEffect(() => {
    // Not in the chat: the artifact frame has no service workers, and Claude serves the page.
    if (process.env.NODE_ENV !== "production" || process.env.NEXT_PUBLIC_TARGET === "artifact" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register(`/sw.js?v=${process.env.NEXT_PUBLIC_BUILD_ID}`).catch(() => {
      // Not supported here (private mode, old browser): the app still works online.
    });
    // The data lives only on this phone; ask the browser not to clear it.
    void requestPersistentStorage();
  }, []);
  return null;
}

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <ThemeSync />
      <ServiceWorker />
      {children}
    </ToastProvider>
  );
}
