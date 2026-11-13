import { useSyncExternalStore } from "react";

// A small in-memory router for the single-page build (the artifact), standing in for Next's.
// Every screen keeps its Next-style href ("/history/view?id=…"); the browser history gets one entry
// per screen so the phone's back gesture works, and the address only ever shows a plain #name
// (the artifact viewer passes nothing else through).

export type Location = { pathname: string; search: string };

const parse = (href: string): Location => {
  const u = new URL(href, "https://app.local/");
  return { pathname: u.pathname.replace(/\/+$/, "") || "/", search: u.search };
};

/** "/nutrition/photo" → "nutrition-photo"; "/" → "home". */
export const hashName = (pathname: string) => (pathname === "/" ? "home" : pathname.slice(1).replace(/\//g, "-"));

let current: Location = { pathname: "/", search: "" };
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function write(loc: Location, mode: "push" | "replace") {
  try {
    const state = { href: loc.pathname + loc.search };
    const url = `#${hashName(loc.pathname)}`;
    if (mode === "push") history.pushState(state, "", url);
    else history.replaceState(state, "", url);
  } catch {
    // History blocked in this frame: navigation still works, without the back gesture.
  }
}

export function navigate(href: string, mode: "push" | "replace" = "push") {
  const next = parse(href);
  if (next.pathname === current.pathname && next.search === current.search) return;
  current = next;
  write(next, mode);
  emit();
  window.scrollTo(0, 0);
}

/** Screens a reload can reopen by name; the rest need a query (?id=…) and fall back to home. */
const REOPENABLE = new Set([
  "/", "/workouts", "/workout", "/history", "/exercises", "/nutrition", "/nutrition/add", "/nutrition/photo",
  "/nutrition/barcode", "/nutrition/goals", "/progress", "/body", "/profile", "/cardio", "/photos", "/learn", "/achievements",
  "/journey", "/checkin", "/business", "/business/log", "/business/money", "/coach", "/coach/sales", "/review", "/academy",
]);

export function startRouter(paths: string[]) {
  const byName = new Map(paths.map((p) => [hashName(p), p]));
  const fromHash = () => {
    const p = byName.get(decodeURIComponent(location.hash.slice(1)));
    return p && REOPENABLE.has(p) ? p : "/";
  };
  current = { pathname: fromHash(), search: "" };
  write(current, "replace");
  window.addEventListener("popstate", (e) => {
    const href = (e.state as { href?: string } | null)?.href;
    current = href ? parse(href) : { pathname: fromHash(), search: "" };
    emit();
  });
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export function useLocation(): Location {
  return useSyncExternalStore(subscribe, () => current, () => current);
}
