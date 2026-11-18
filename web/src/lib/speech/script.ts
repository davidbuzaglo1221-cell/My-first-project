// The listening script for each kind of content in the app.
import type { Lesson } from "@/lib/lessons";
import { buildScript, type SpeechItem } from "./segment";

/** A lesson as it is heard: the title, each paragraph, then the "try today" callout with its lead. */
export function lessonScript(lesson: Lesson): SpeechItem[] {
  return buildScript([
    { text: lesson.title, role: "title" },
    ...lesson.body.map((text) => ({ text, role: "body" as const })),
    { text: lesson.tryToday, role: "callout", lead: "לנסות היום" },
  ]);
}
