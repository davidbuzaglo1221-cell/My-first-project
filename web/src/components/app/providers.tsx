"use client";

import { useEffect, type ReactNode } from "react";
import { ToastProvider } from "@/components/ui/toast";
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

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <ThemeSync />
      {children}
    </ToastProvider>
  );
}
