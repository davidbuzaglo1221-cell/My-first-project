import type { AppState } from "./types";
import type { Lesson } from "../content/lessons";

export function downloadText(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function exportStateJson(state: AppState): string {
  return JSON.stringify({ app: "ASCEND", exportedAt: new Date().toISOString(), data: state }, null, 2);
}

/** Plain-text version of a lesson for pasting into a notebook or note app (e.g., NotebookLM as a source). */
export function lessonToMarkdown(lesson: Lesson, notes: string): string {
  const lines: string[] = [
    `# ${lesson.title}`,
    "",
    `**עיקרון:** ${lesson.principle}`,
    "",
    "## הסבר",
    ...lesson.explanation.map((p) => `- ${p}`),
    "",
    `## דוגמה\n${lesson.example}`,
    "",
    `## תרגיל\n${lesson.exercise}`,
    "",
    `## משימה בעולם האמיתי\n${lesson.assignment}`,
    "",
    `## שאלת הרפלקציה\n${lesson.reflection}`,
    "",
    `## הערכת ראיות\n${lesson.evidence.level}. ${lesson.evidence.note}`,
  ];
  if (lesson.medicalNote) lines.push("", `> ${lesson.medicalNote}`);
  if (notes.trim()) lines.push("", "## הערות אישיות", notes.trim());
  return lines.join("\n") + "\n";
}
