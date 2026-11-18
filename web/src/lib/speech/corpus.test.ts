// Checks that everything the app speaks is fully prepared (no digits or symbols left for a voice
// to guess), and doubles as the bridge to the audio tests:
//   SPEECH_CORPUS_OUT=file.json   write every test sentence (raw and normalized) for synthesis
//   SPEECH_SCORE_IN=asr.json SPEECH_SCORE_OUT=report.json
//                                 score transcripts of the synthesized audio against the text
// See .claude/skills/speech-quality-testing/SKILL.md.
import { readFileSync, writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { LESSONS } from "@/lib/lessons";
import { CORPUS } from "./corpus";
import { normalizeForSpeech } from "./normalize";
import { buildScript } from "./segment";
import { lessonScript } from "./script";

type Row = { id: string; focus: string; raw: string; spoken: string; parts: { lang: string; text: string }[] };

function rows(): Row[] {
  const out: Row[] = [];
  for (const c of CORPUS) {
    // A case may be two sentences; it is tested as one recording.
    const parts = buildScript([{ text: c.text, role: "body" }]).flatMap((it) => it.parts);
    out.push({ id: c.id, focus: c.focus, raw: c.text, spoken: parts.map((p) => p.text).join(" "), parts });
  }
  for (const l of LESSONS) {
    for (const it of lessonScript(l)) {
      out.push({ id: `${l.id}#${it.id}`, focus: `lesson:${it.role}`, raw: it.display, spoken: it.parts.map((p) => p.text).join(" "), parts: it.parts });
    }
  }
  return out;
}

describe("speech corpus", () => {
  it("leaves no digits, %, ×, or Hebrew quote marks in anything spoken in Hebrew", () => {
    for (const r of rows()) {
      for (const p of r.parts) {
        if (p.lang !== "he-IL") continue;
        expect(p.text, r.id).not.toMatch(/\d|%|×|„|”|“/);
        expect(p.text, r.id).not.toMatch(/(^|\s)[״"]|[״"](\s|$|[.,!?])/);
      }
    }
  });

  it.runIf(process.env.SPEECH_CORPUS_OUT)("writes the corpus for the audio tests", () => {
    writeFileSync(process.env.SPEECH_CORPUS_OUT!, JSON.stringify(rows(), null, 1));
  });

  it.runIf(process.env.SPEECH_SCORE_IN)("scores transcripts against the spoken text", () => {
    type Asr = { id: string; variant: string; engine: string; text: string };
    const asr = JSON.parse(readFileSync(process.env.SPEECH_SCORE_IN!, "utf8")) as Asr[];
    const byId = new Map(rows().map((r) => [r.id, r]));
    // Compare words, not spelling: drop nikud and punctuation, and read any digits the
    // recognizer wrote the same way the app does, so "3 סטים" and "שלושה סטים" match.
    const canon = (s: string) =>
      normalizeForSpeech(s)
        .normalize("NFD")
        .replace(/[֑-ׇ]/g, "")
        .replace(/[^\p{L}\p{N}\s]/gu, " ")
        .toLowerCase()
        .split(/\s+/)
        .filter(Boolean);
    const wer = (ref: string[], hyp: string[]) => {
      const d = Array.from({ length: ref.length + 1 }, (_, i) => [i, ...Array(hyp.length).fill(0)]);
      for (let j = 1; j <= hyp.length; j++) d[0][j] = j;
      for (let i = 1; i <= ref.length; i++)
        for (let j = 1; j <= hyp.length; j++)
          d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (ref[i - 1] === hyp[j - 1] ? 0 : 1));
      return ref.length ? d[ref.length][hyp.length] / ref.length : 0;
    };
    const scored = asr.map((a) => {
      const r = byId.get(a.id)!;
      const ref = canon(r.spoken);
      return { ...a, focus: r.focus, reference: r.spoken, wer: Number(wer(ref, canon(a.text)).toFixed(3)) };
    });
    const groups = new Map<string, number[]>();
    for (const s of scored) {
      const k = `${s.engine}|${s.variant}`;
      groups.set(k, [...(groups.get(k) ?? []), s.wer]);
    }
    const summary = [...groups].map(([k, w]) => ({
      group: k,
      sentences: w.length,
      meanWer: Number((w.reduce((x, y) => x + y, 0) / w.length).toFixed(3)),
      perfect: w.filter((x) => x === 0).length,
    }));
    writeFileSync(process.env.SPEECH_SCORE_OUT!, JSON.stringify({ summary, scored }, null, 1));
    expect(scored.length).toBeGreaterThan(0);
  });
});
