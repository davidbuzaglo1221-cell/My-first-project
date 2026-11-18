import { describe, expect, it } from "vitest";
import { dateToHebrew, decimalToHebrew, numberToHebrew, timeToHebrew } from "./hebrew-numbers";
import { normalizeForSpeech as n } from "./normalize";
import { buildScript, languageRuns, splitSentences } from "./segment";
import { azureSsml, googleSsml } from "./ssml";

describe("hebrew numbers", () => {
  it("agrees with gender and uses the construct for 2", () => {
    expect(numberToHebrew(3, "f")).toBe("שלוש");
    expect(numberToHebrew(3, "m")).toBe("שלושה");
    expect(numberToHebrew(2, "f", true)).toBe("שתי");
    expect(numberToHebrew(2, "m", true)).toBe("שני");
    expect(numberToHebrew(12, "f")).toBe("שתים עשרה");
    expect(numberToHebrew(12, "m")).toBe("שנים עשר");
    expect(numberToHebrew(21, "m")).toBe("עשרים ואחד");
  });
  it("hundreds and thousands join the last part with ו", () => {
    expect(numberToHebrew(100)).toBe("מאה");
    expect(numberToHebrew(105)).toBe("מאה וחמש");
    expect(numberToHebrew(125)).toBe("מאה עשרים וחמש");
    expect(numberToHebrew(1000)).toBe("אלף");
    expect(numberToHebrew(2026)).toBe("אלפיים עשרים ושש");
    expect(numberToHebrew(3500)).toBe("שלושת אלפים וחמש מאות");
    expect(numberToHebrew(12000)).toBe("שנים עשר אלף");
    expect(numberToHebrew(2_000_000)).toBe("שניים מיליון");
  });
  it("decimals", () => {
    expect(decimalToHebrew("2.5", "m")).toBe("שניים וחצי");
    expect(decimalToHebrew("1.6")).toBe("אחת נקודה שש");
    expect(decimalToHebrew("0.5")).toBe("חצי");
    expect(decimalToHebrew("1.05")).toBe("אחת נקודה אפס חמש");
  });
  it("dates and times", () => {
    expect(dateToHebrew(15, 11, 2026)).toBe("חמישה עשר בנובמבר אלפיים עשרים ושש");
    expect(dateToHebrew(1, 3)).toBe("הראשון במרץ");
    expect(timeToHebrew(7, 30)).toBe("שבע וחצי");
    expect(timeToHebrew(18, 5)).toBe("שמונה עשרה וחמש דקות");
    expect(timeToHebrew(9, 0)).toBe("תשע");
  });
});

describe("normalizeForSpeech", () => {
  it("counts nouns with the right gender", () => {
    expect(n("3 סטים של 8 חזרות")).toBe("שלושה סטים של שמונה חזרות");
    expect(n("2 דקות")).toBe("שתי דקות");
    expect(n("2 סטים")).toBe("שני סטים");
    expect(n("7 ימים")).toBe("שבעה ימים");
    expect(n("1 סט")).toBe("סט אחד");
    expect(n("1 חזרה")).toBe("חזרה אחת");
  });
  it("ranges read both ends, the second agreeing with the noun", () => {
    expect(n("8 עד 12 חזרות")).toBe("שמונה עד שתים עשרה חזרות");
    expect(n("2 עד 3 דקות")).toBe("שתיים עד שלוש דקות");
    expect(n("1-3 חזרות")).toBe("אחת עד שלוש חזרות");
    expect(n("15 עד 25 אחוז")).toBe("חמישה עשר עד עשרים וחמישה אחוז");
  });
  it("units, decimals and prefixes", () => {
    expect(n("חזרה אחת, או 2.5 ק״ג.")).toBe("חזרה אחת, או שניים וחצי קילו.");
    expect(n("לפני 100 ק״ג")).toBe("לפני מאה קילו");
    expect(n("כ-1.6 עד 2.2 גרם")).toBe("כאחד נקודה שש עד שניים נקודה שתיים גרם");
    expect(n("כשכל הסטים מגיעים ל-12")).toBe("כשכל הסטים מגיעים לשתים עשרה");
    expect(n("5 עם 60, ו-3 עם 80")).toBe("חמש עם שישים, ושלוש עם שמונים");
    expect(n("14 גרם סיבים לכל 1,000 קלוריות")).toBe("ארבעה עשר גרם סיבים לכל אלף קלוריות");
    expect(n("500 kcal")).toBe("חמש מאות קלוריות");
    expect(n("20%")).toBe("עשרים אחוז");
    expect(n("100×5")).toBe("מאה כפול חמש");
  });
  it("dates, times and abbreviations", () => {
    expect(n("האימון ב-15/11/2026 בשעה 18:30")).toBe("האימון בחמישה עשר בנובמבר אלפיים עשרים ושש בשעה שמונה עשרה וחצי");
    expect(n("ביצים, טונה וכו׳")).toBe("ביצים, טונה וכולי");
    expect(n("בד״כ מספיק")).toBe("בדרך כלל מספיק");
  });
  it("drops quotation marks but keeps in-word gershayim", () => {
    expect(n("נשארו 1 עד 3 חזרות ״בטנק״.")).toBe("נשארו אחת עד שלוש חזרות בטנק.");
    expect(n("נגעו ב„למה?” כדי לראות")).toBe("נגעו בלמה כדי לראות");
    expect(n("לכל ק״ג משקל גוף")).toBe("לכל קילו משקל גוף");
    expect(n("קוטג׳ ויוגורט")).toBe("קוטג׳ ויוגורט");
  });
  it("says English terms the Israeli way inside Hebrew, leaves English sentences alone", () => {
    expect(n("כמה RIR נשארו?")).toBe("כמה אר איי אר נשארו?");
    expect(n("שבירת PR היום")).toBe("שבירת פי אר היום");
    expect(n("Your PR today")).toBe("Your PR today");
  });
});

describe("segmentation", () => {
  it("splits sentences without breaking decimals or times", () => {
    expect(splitSentences("או 2.5 ק״ג. בשעה 7:30 מתחילים! מוכנים?")).toEqual(["או 2.5 ק״ג.", "בשעה 7:30 מתחילים!", "מוכנים?"]);
  });
  it("hands an English phrase to the English voice", () => {
    expect(languageRuns("המשפט הבא הוא keep your core tight בכל חזרה")).toEqual([
      { lang: "he-IL", text: "המשפט הבא הוא" },
      { lang: "en-US", text: "keep your core tight" },
      { lang: "he-IL", text: "בכל חזרה" },
    ]);
    expect(languageRuns("זה deadlift רגיל")).toEqual([{ lang: "he-IL", text: "זה deadlift רגיל" }]);
    expect(languageRuns("Rest two minutes.")).toEqual([{ lang: "en-US", text: "Rest two minutes." }]);
  });
  it("keeps English sentences for the English voice, numbers and all", () => {
    const [it] = buildScript([{ text: "On November 15, 2026 you lifted 12,450 kilograms.", role: "body" }]);
    expect(it.parts).toEqual([{ lang: "en-US", text: "On November 15, 2026 you lifted 12,450 kilograms." }]);
  });
  it("builds a script with paragraph-aware pauses and a spoken callout lead", () => {
    const s = buildScript([
      { text: "כמה לנוח", role: "title" },
      { text: "משפט ראשון. משפט שני.", role: "body" },
      { text: "תנו לטיימר לרוץ.", role: "callout", lead: "לנסות היום" },
    ]);
    expect(s.map((i) => i.id)).toEqual(["0.0", "1.0", "1.1", "2.0"]);
    expect(s[0].pauseAfterMs).toBeGreaterThan(s[1].pauseAfterMs);
    expect(s[2].pauseAfterMs).toBeGreaterThan(s[1].pauseAfterMs);
    expect(s[3].parts[0].text).toBe("לנסות היום. תנו לטיימר לרוץ.");
    expect(s[3].display).toBe("תנו לטיימר לרוץ.");
  });
});

describe("ssml", () => {
  const voices = { "he-IL": "he-IL-Chirp3-HD-Kore", "en-US": "en-US-Chirp3-HD-Kore" };
  const parts = languageRuns("המשפט הבא הוא keep your core tight, בכל חזרה & סט");
  it("google switches voice for the English run and escapes XML", () => {
    const x = googleSsml(parts, "body", voices, "he-IL");
    expect(x).toContain('<voice name="en-US-Chirp3-HD-Kore">keep your core tight,</voice>');
    expect(x).toContain("&amp;");
    expect(x.startsWith("<speak>")).toBe(true);
  });
  it("azure wraps every run in its own voice", () => {
    const x = azureSsml(parts, "title", { "he-IL": "he-IL-HilaNeural", "en-US": "en-US-AvaMultilingualNeural" }, "he-IL");
    expect(x.match(/<voice /g)?.length).toBe(3);
    expect(x).toContain('xml:lang="he-IL"');
    expect(x).toContain('<prosody rate="94%">');
  });
});
