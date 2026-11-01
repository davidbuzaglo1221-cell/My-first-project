import { XMLParser } from "fast-xml-parser";

// PubMed through the official NCBI E-utilities (https://www.ncbi.nlm.nih.gov/home/develop/api/).
// Server-only. Rate limits: 3 requests/second without an API key, 10/second with NCBI_API_KEY.

const BASE = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils";
const TOOL = "training-app-research";
const GAP_MS = process.env.NCBI_API_KEY ? 110 : 350;
const EFETCH_BATCH = 150;

export type Paper = {
  pmid: string;
  titleEn: string;
  /** Labelled sections joined with newlines; null when PubMed has no abstract for this record. */
  abstract: string | null;
  year: number | null;
  journal: string;
  authors: string;
  pubTypes: string[];
  doi: string | null;
  url: string;
};

export class PubmedError extends Error {
  constructor(public status: number) {
    super(`pubmed ${status}`);
  }
}

function params(extra: Record<string, string>): URLSearchParams {
  const p = new URLSearchParams({ db: "pubmed", tool: TOOL, ...extra });
  if (process.env.NCBI_API_KEY) p.set("api_key", process.env.NCBI_API_KEY);
  if (process.env.NCBI_EMAIL) p.set("email", process.env.NCBI_EMAIL);
  return p;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** PMIDs that match a PubMed query, most relevant first. */
export async function searchPmids(term: string, retmax: number): Promise<string[]> {
  const res = await fetch(`${BASE}/esearch.fcgi?${params({ term, retmax: String(retmax), retmode: "json", sort: "relevance" })}`);
  if (!res.ok) throw new PubmedError(res.status);
  const json = (await res.json()) as { esearchresult?: { idlist?: string[] } };
  return json.esearchresult?.idlist ?? [];
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  textNodeName: "#text",
  trimValues: true,
  isArray: (name) => ["PubmedArticle", "AbstractText", "Author", "PublicationType", "ArticleId"].includes(name),
});

/** All text inside a parsed XML node, including inline markup such as <sup>. */
export function textOf(node: unknown): string {
  if (node == null) return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  if (typeof node === "object") {
    const record = node as Record<string, unknown>;
    const own = textOf(record["#text"]);
    const inner = Object.entries(record)
      .filter(([key]) => key !== "#text" && !key.startsWith("@_"))
      .map(([, value]) => textOf(value))
      .join("");
    return `${own}${inner}`.replace(/\s+/g, " ").trim();
  }
  return "";
}

function authorName(author: Record<string, unknown>): string {
  const collective = textOf(author.CollectiveName);
  if (collective) return collective;
  const last = textOf(author.LastName);
  const initials = textOf(author.Initials);
  return [last, initials].filter(Boolean).join(" ");
}

/** Turns a PubMed efetch XML document into papers. Records without a PMID are skipped. */
export function parsePubmedXml(xml: string): Paper[] {
  const doc = parser.parse(xml) as { PubmedArticleSet?: { PubmedArticle?: Record<string, any>[] } };
  const articles = doc.PubmedArticleSet?.PubmedArticle ?? [];
  const papers: Paper[] = [];

  for (const record of articles) {
    const citation = record.MedlineCitation ?? {};
    const article = citation.Article ?? {};
    const pmid = textOf(citation.PMID);
    if (!pmid) continue;

    const sections: Record<string, unknown>[] = article.Abstract?.AbstractText ?? [];
    const abstract = sections.length
      ? sections
          .map((section) => {
            const label = typeof section["@_Label"] === "string" ? section["@_Label"] : "";
            const text = textOf(section);
            return label && text ? `${label}: ${text}` : text;
          })
          .filter(Boolean)
          .join("\n")
      : "";

    const authors: Record<string, unknown>[] = article.AuthorList?.Author ?? [];
    const names = authors.map(authorName).filter(Boolean);
    const authorText = names.length > 3 ? `${names.slice(0, 3).join(", ")} et al.` : names.join(", ");

    const yearText = textOf(article.Journal?.JournalIssue?.PubDate?.Year) || textOf(article.Journal?.JournalIssue?.PubDate?.MedlineDate);
    const year = /(\d{4})/.exec(yearText)?.[1];

    const ids: Record<string, unknown>[] = record.PubmedData?.ArticleIdList?.ArticleId ?? [];
    const doi = ids.find((id) => id["@_IdType"] === "doi");

    papers.push({
      pmid,
      titleEn: textOf(article.ArticleTitle),
      abstract: abstract || null,
      year: year ? Number(year) : null,
      journal: textOf(article.Journal?.Title),
      authors: authorText,
      pubTypes: (article.PublicationTypeList?.PublicationType ?? []).map(textOf).filter(Boolean),
      doi: doi ? textOf(doi) : null,
      url: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`,
    });
  }
  return papers;
}

/** Full records (title, abstract, journal, year) for PMIDs, in batches. */
export async function fetchPapers(pmids: string[]): Promise<Paper[]> {
  const papers: Paper[] = [];
  for (let i = 0; i < pmids.length; i += EFETCH_BATCH) {
    if (i > 0) await sleep(GAP_MS);
    const batch = pmids.slice(i, i + EFETCH_BATCH);
    const body = params({ id: batch.join(","), retmode: "xml" });
    const res = await fetch(`${BASE}/efetch.fcgi`, { method: "POST", body, headers: { "content-type": "application/x-www-form-urlencoded" } });
    if (!res.ok) throw new PubmedError(res.status);
    papers.push(...parsePubmedXml(await res.text()));
  }
  return papers;
}

/** Runs several searches one after another, respecting NCBI's request rate. */
export async function searchMany(queries: { term: string; retmax: number }[]): Promise<string[][]> {
  const results: string[][] = [];
  for (let i = 0; i < queries.length; i++) {
    if (i > 0) await sleep(GAP_MS);
    results.push(await searchPmids(queries[i].term, queries[i].retmax));
  }
  return results;
}
