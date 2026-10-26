"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { WorkoutAlreadyOpenError, startWorkout } from "@/data/repo";

/** Starts a workout (from a template or empty) and opens the logger. An open one is resumed instead. */
export function useStartWorkout() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const start = useCallback(
    async (templateId?: string) => {
      setPending(true);
      try {
        await startWorkout({ templateId });
      } catch (e) {
        if (!(e instanceof WorkoutAlreadyOpenError)) {
          setPending(false);
          throw e;
        }
      }
      router.push("/workout");
    },
    [router],
  );
  return { start, pending };
}
