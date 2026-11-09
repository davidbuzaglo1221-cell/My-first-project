"use client";

import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { ensureDay, getJourney, listCheckIns, listCuts, listMissions, missionsOn } from "@/data/journey-repo";
import { db } from "@/data/db";
import type { CoachContext } from "@/lib/journey/coach-ai";
import { addDays, localDateKey } from "@/lib/nutrition";

/** The journey row: undefined while loading, null before it starts. */
export function useJourney() {
  return useLiveQuery(async () => (await getJourney()) ?? null, []);
}

/** Today's date key, refreshed when the day turns while the app is open. */
export function useToday() {
  const [today, setToday] = useState(() => localDateKey());
  useEffect(() => {
    const t = setInterval(() => {
      const k = localDateKey();
      setToday((p) => (p === k ? p : k));
    }, 30_000);
    return () => clearInterval(t);
  }, []);
  return today;
}

/** The missions of a day, created on first open. */
export function useDayMissions(date: string, ready: boolean) {
  useEffect(() => {
    if (ready) void ensureDay(date);
  }, [date, ready]);
  return useLiveQuery(() => missionsOn(date), [date]);
}

export const useAllMissions = () => useLiveQuery(() => listMissions(), []);
export const useCheckIns = () => useLiveQuery(() => listCheckIns(), []);
export const useCuts = () => useLiveQuery(() => listCuts(), []);

/** Everything the coach reads, or null until it has loaded (and while there is no journey). */
export function useCoachContext(): CoachContext | null | undefined {
  const today = useToday();
  return useLiveQuery(async () => {
    const journey = await getJourney();
    if (!journey) return null;
    const [missions, checkins, cuts, workouts] = await Promise.all([listMissions(), listCheckIns(), listCuts(), db().workouts.toArray()]);
    const from = addDays(today, -13);
    const workoutsLast14 = workouts.filter((w) => w.endedAt && w.startedAt.slice(0, 10) >= from).length;
    return { journey, missions, checkins, cuts, workoutsLast14, today };
  }, [today]);
}
