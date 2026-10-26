"use client";

import { useEffect, useState } from "react";

/**
 * Current time, ticking every `ms`. Null until mounted, so prerendered HTML never
 * contains a time that disagrees with the browser's (no hydration mismatch).
 */
export function useNow(ms = 1000): number | null {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    // Defer the first tick so it is not a synchronous setState inside the effect.
    const first = setTimeout(() => setNow(Date.now()), 0);
    const id = setInterval(() => setNow(Date.now()), ms);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, [ms]);
  return now;
}
