import { describe, expect, it } from "vitest";
import { EVIDENCE_LABEL, LESSONS, TOPIC_LABEL, lessonOfTheDay, pubmedSearchUrl, type Evidence } from "./lessons";

// Links that were checked against a source. A new link must be added here on purpose.
const CHECKED_URLS = new Set([
  "https://pubmed.ncbi.nlm.nih.gov/16719566/",
  "https://doi.org/10.1016/S0065-2601(06)38002-1",
  "https://pubmed.ncbi.nlm.nih.gov/15450165/",
]);

describe("lesson catalog", () => {
  it("has unique ids", () => {
    const ids = LESSONS.map((l) => l.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("gives every lesson a known topic, a title, an intro, and something to try", () => {
    for (const l of LESSONS) {
      expect(TOPIC_LABEL[l.topic], l.id).toBeDefined();
      expect(l.title.trim(), l.id).not.toBe("");
      expect(l.body.length, l.id).toBeGreaterThan(0);
      expect(l.tryToday.trim(), l.id).not.toBe("");
      expect(l.minutes, l.id).toBeGreaterThan(0);
    }
  });

  it("uses only known evidence levels", () => {
    const levels = Object.keys(EVIDENCE_LABEL) as Evidence[];
    for (const l of LESSONS.filter((x) => x.evidence)) {
      expect(levels, l.id).toContain(l.evidence);
    }
  });

  it("cites only links that were checked, and only over https", () => {
    for (const l of LESSONS) {
      for (const s of l.sources ?? []) {
        if (!s.url) continue;
        expect(s.url.startsWith("https://"), l.id).toBe(true);
        expect(CHECKED_URLS.has(s.url), `${l.id}: unchecked link ${s.url}`).toBe(true);
      }
    }
  });

  it("gives each deep lesson a PubMed check, and sections have text", () => {
    for (const l of LESSONS.filter((x) => x.evidence)) {
      expect(l.verify?.trim(), l.id).toBeTruthy();
    }
    for (const l of LESSONS) {
      for (const s of l.sections ?? []) {
        expect(s.paragraphs.length, `${l.id}: ${s.heading}`).toBeGreaterThan(0);
      }
    }
  });
});

describe("lesson of the day", () => {
  it("returns the first lesson not read yet, in catalog order", () => {
    const read = new Set([LESSONS[0].id, LESSONS[1].id]);
    expect(lessonOfTheDay(read, 0).id).toBe(LESSONS[2].id);
  });

  it("rotates by day once everything is read", () => {
    const all = new Set(LESSONS.map((l) => l.id));
    expect(lessonOfTheDay(all, 1).id).toBe(LESSONS[1 % LESSONS.length].id);
  });
});

describe("pubmedSearchUrl", () => {
  it("encodes the query into a PubMed search link", () => {
    expect(pubmedSearchUrl("habit[tiab] AND cue")).toBe("https://pubmed.ncbi.nlm.nih.gov/?term=habit%5Btiab%5D%20AND%20cue");
  });
});
