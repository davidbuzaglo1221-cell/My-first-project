import { z } from "zod";

// Shared by the API routes (Claude's output schemas, request bodies) and the client pipeline.

export const LENGTH_MINUTES = [3, 5, 10] as const;
export type LengthMinutes = (typeof LENGTH_MINUTES)[number];

/** Hebrew narration pace used to size the script. The real length is measured after synthesis. */
export const WORDS_PER_MINUTE = 140;

export const PlanSchema = z.object({
  question_he: z.string(),
  english_question: z.string(),
  queries: z.array(
    z.object({
      purpose: z.enum(["general", "reviews", "trials", "contradictory"]),
      pubmed_query: z.string(),
    }),
  ),
});
export type Plan = z.infer<typeof PlanSchema>;

export const StudyAnalysisSchema = z.object({
  pmid: z.string(),
  relevant: z.boolean(),
  title_he: z.string(),
  study_type: z.enum([
    "systematic_review",
    "meta_analysis",
    "randomized_trial",
    "clinical_trial_other",
    "cohort",
    "case_control",
    "cross_sectional",
    "case_report",
    "narrative_review",
    "animal_study",
    "lab_study",
    "other",
  ]),
  species: z.enum(["human", "animal", "in_vitro", "mixed", "not_applicable"]),
  abstract_available: z.boolean(),
  participants_n: z.number().nullable(),
  participants_he: z.string(),
  what_was_tested_he: z.string(),
  main_results_he: z.string(),
  limitations_he: z.string(),
  stance: z.enum(["supports", "opposes", "partly_supports", "no_effect", "unclear"]),
});
export type StudyAnalysis = z.infer<typeof StudyAnalysisSchema>;

export const AnalysisBatchSchema = z.object({ studies: z.array(StudyAnalysisSchema) });

/** Claim with the PMIDs that support it. Claims without a valid PMID are dropped on the server. */
const CitedClaim = z.object({ text_he: z.string(), pmids: z.array(z.string()) });

export const ReportSchema = z.object({
  direct_answer_he: z.string(),
  confidence: z.enum(["high", "moderate", "low", "very_low", "insufficient"]),
  confidence_reason_he: z.string(),
  known: z.array(CitedClaim),
  unknown_he: z.array(z.string()),
  evidence_quality_he: z.string(),
  human_vs_non_human_he: z.string(),
  approaches: z.array(z.object({ approach_he: z.string(), evidence_he: z.string(), pmids: z.array(z.string()) })),
  contradictory: z.array(CitedClaim),
  practical: z.array(CitedClaim),
  glossary: z.array(z.object({ term_en: z.string(), explanation_he: z.string() })),
  method_note_he: z.string(),
});
export type Report = z.infer<typeof ReportSchema>;

export const ScriptSchema = z.object({
  title_he: z.string(),
  lines: z.array(
    z.object({
      speaker: z.enum(["host", "expert"]),
      section: z.enum(["intro", "explanation", "findings", "limits", "conclusions", "summary"]),
      text_he: z.string(),
    }),
  ),
});
export type ScriptLine = z.infer<typeof ScriptSchema>["lines"][number];
export type Script = z.infer<typeof ScriptSchema>;

/** A study as the client keeps it: the PubMed record plus Claude's reading of its abstract. */
export type StudyRecord = {
  pmid: string;
  titleEn: string;
  abstract: string | null;
  year: number | null;
  journal: string;
  authors: string;
  pubTypes: string[];
  doi: string | null;
  url: string;
  foundBy: ("general" | "reviews" | "trials" | "contradictory")[];
  analysis?: StudyAnalysis;
};

export type ApiError =
  | "not_configured"
  | "unauthorized"
  | "bad_key"
  | "bad_request"
  | "busy"
  | "refused"
  | "unreadable"
  | "upstream";
