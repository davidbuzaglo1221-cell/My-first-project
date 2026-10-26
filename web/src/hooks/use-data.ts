"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { getOpenWorkout, getProfile } from "@/data/repo";
import type { Profile } from "@/data/types";

/** Live profile; undefined while IndexedDB opens. */
export function useProfile(): Profile | undefined {
  return useLiveQuery(() => getProfile(), []);
}

/** The workout in progress, null when there is none, undefined while loading. */
export function useOpenWorkout() {
  return useLiveQuery(async () => (await getOpenWorkout()) ?? null, []);
}
