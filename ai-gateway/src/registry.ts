// The one place that decides which AI model serves which kind of task, and what to fall back to.
// Edit the chains here; every app goes through the gateway, so a change applies everywhere.
//
// House rule: Claude stays first in every chain. Moving a free model in front of Claude needs
// David's explicit approval.

export type ProviderId =
  | "claude"
  | "freellmapi"
  | "gemini"
  | "groq"
  | "cerebras"
  | "mistral"
  | "openrouter"
  | "ovh"
  | "kilo";

export interface Provider {
  id: ProviderId;
  label: string;
  kind: "anthropic" | "openai";
  /** Base URL of an OpenAI-compatible API (ending in /v1 or equivalent). */
  baseUrl?: string;
  /** Env var that holds the base URL instead (self-hosted FreeLLMAPI). */
  baseUrlEnv?: string;
  /** Env var with the API key. Absent = works without a key. */
  keyEnv?: string;
  /** Keyless providers stay off unless ALLOW_KEYLESS=1. */
  keyless?: boolean;
  paid: boolean;
  /** The provider may keep prompts for training: never send personal data. */
  trainsOnData: boolean;
  signupUrl?: string;
  /** Published free-tier limit, for the dashboard. */
  freeTier: string;
  note?: string;
}

export interface ModelRef {
  provider: ProviderId;
  model: string;
  vision?: boolean;
  /** USD per million tokens, input / output. Free tiers are 0. */
  price?: { input: number; output: number };
}

export type TaskId = "hebrew" | "fast" | "vision" | "json" | "code";

export interface Task {
  id: TaskId;
  label: string;
  description: string;
  needsVision?: boolean;
  chain: ModelRef[];
}

export const PROVIDERS: Record<ProviderId, Provider> = {
  claude: {
    id: "claude",
    label: "Claude (Anthropic)",
    kind: "anthropic",
    keyEnv: "ANTHROPIC_API_KEY",
    paid: true,
    trainsOnData: false,
    signupUrl: "https://console.anthropic.com/settings/keys",
    freeTier: "בתשלום לפי שימוש",
    note: "המודל הראשי. לא מוחלף בלי אישור.",
  },
  freellmapi: {
    id: "freellmapi",
    label: "FreeLLMAPI",
    kind: "openai",
    baseUrlEnv: "FREELLMAPI_URL",
    keyEnv: "FREELLMAPI_KEY",
    paid: false,
    // It may route to any provider enabled in it, including ones that keep prompts.
    trainsOnData: true,
    freeTier: "מאחד את כל הספקים החינמיים שהוגדרו בו",
    note: "שרת ניתוב עצמאי: מחליף ספק אוטומטית כשאחד חסום. בקשות פרטיות לא נשלחות אליו, כי הוא עשוי לנתב לספק ששומר שיחות.",
  },
  gemini: {
    id: "gemini",
    label: "Google Gemini",
    kind: "openai",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    keyEnv: "GEMINI_API_KEY",
    paid: false,
    trainsOnData: true,
    signupUrl: "https://aistudio.google.com/app/apikey",
    freeTier: "כ-10 בקשות בדקה, 20 ביום למודלי Flash; Gemma עד 1,000 ביום",
    note: "במסלול החינמי Google משתמשת בשיחות לשיפור המודלים.",
  },
  groq: {
    id: "groq",
    label: "Groq",
    kind: "openai",
    baseUrl: "https://api.groq.com/openai/v1",
    keyEnv: "GROQ_API_KEY",
    paid: false,
    trainsOnData: false,
    signupUrl: "https://console.groq.com/keys",
    freeTier: "30 בקשות בדקה, 250–1,000 ביום",
  },
  cerebras: {
    id: "cerebras",
    label: "Cerebras",
    kind: "openai",
    baseUrl: "https://api.cerebras.ai/v1",
    keyEnv: "CEREBRAS_API_KEY",
    paid: false,
    trainsOnData: false,
    signupUrl: "https://cloud.cerebras.ai/",
    freeTier: "מכסה יומית חינמית, מהיר מאוד",
  },
  mistral: {
    id: "mistral",
    label: "Mistral",
    kind: "openai",
    baseUrl: "https://api.mistral.ai/v1",
    keyEnv: "MISTRAL_API_KEY",
    paid: false,
    trainsOnData: true,
    signupUrl: "https://console.mistral.ai/api-keys",
    freeTier: "2 בקשות בדקה (מסלול ניסוי)",
    note: "במסלול החינמי השיחות עשויות לשמש לאימון.",
  },
  openrouter: {
    id: "openrouter",
    label: "OpenRouter",
    kind: "openai",
    baseUrl: "https://openrouter.ai/api/v1",
    keyEnv: "OPENROUTER_API_KEY",
    paid: false,
    trainsOnData: true,
    signupUrl: "https://openrouter.ai/settings/keys",
    freeTier: "20 בקשות בדקה, 50 ביום למודלים :free",
    note: "חלק מהמודלים החינמיים שומרים שיחות אצל הספק.",
  },
  ovh: {
    id: "ovh",
    label: "OVHcloud (בלי מפתח)",
    kind: "openai",
    baseUrl: "https://oai.endpoints.kepler.ai.cloud.ovh.net/v1",
    keyless: true,
    paid: false,
    trainsOnData: false,
    freeTier: "2 בקשות בדקה לכל מודל",
    note: "אנונימי ואיטי. מיועד לגיבוי אחרון בלבד.",
  },
  kilo: {
    id: "kilo",
    label: "Kilo Gateway (בלי מפתח)",
    kind: "openai",
    baseUrl: "https://api.kilo.ai/api/gateway/v1",
    keyless: true,
    paid: false,
    trainsOnData: true,
    freeTier: "200 בקשות בשעה",
    note: "שומר שיחות לאימון. לא לשלוח מידע אישי.",
  },
};

const CLAUDE: ModelRef = { provider: "claude", model: "claude-opus-5-5", vision: true, price: { input: 4, output: 20 } };

export const TASKS: Record<TaskId, Task> = {
  hebrew: {
    id: "hebrew",
    label: "טקסט בעברית",
    description: "כתיבה, הסבר, שאלות ותשובות בעברית",
    chain: [
      CLAUDE,
      { provider: "freellmapi", model: "auto" },
      { provider: "gemini", model: "gemini-3.8-flash", vision: true },
      { provider: "groq", model: "qwen/qwen3.8-27b" },
      { provider: "openrouter", model: "google/gemma-4-31b-it:free" },
      { provider: "ovh", model: "Qwen3.8-27B" },
      { provider: "kilo", model: "openrouter/free" },
    ],
  },
  fast: {
    id: "fast",
    label: "תשובה מהירה",
    description: "תשובות קצרות שצריכות להגיע מיד",
    chain: [
      CLAUDE,
      { provider: "freellmapi", model: "auto:fast" },
      { provider: "groq", model: "openai/gpt-oss-120b" },
      { provider: "cerebras", model: "gpt-oss-120b" },
      { provider: "gemini", model: "gemini-3.5-flash-lite" },
      { provider: "kilo", model: "nvidia/nemotron-3.5-lightning:free" },
      { provider: "ovh", model: "gpt-oss-20b" },
    ],
  },
  vision: {
    id: "vision",
    label: "זיהוי תמונה",
    description: "תמונה ושאלה עליה, למשל מה יש בצלחת",
    needsVision: true,
    chain: [
      CLAUDE,
      { provider: "gemini", model: "gemini-3.8-flash", vision: true },
      { provider: "freellmapi", model: "auto", vision: true },
      { provider: "groq", model: "qwen/qwen3.8-27b", vision: true },
      { provider: "mistral", model: "ministral-14b-2512", vision: true },
      { provider: "ovh", model: "Qwen2.5-VL-72B-Instruct", vision: true },
    ],
  },
  json: {
    id: "json",
    label: "נתונים במבנה קבוע",
    description: "תשובה כ-JSON לקוד שקורא אותה",
    chain: [
      CLAUDE,
      { provider: "gemini", model: "gemini-3.8-flash" },
      { provider: "groq", model: "openai/gpt-oss-120b" },
      { provider: "freellmapi", model: "auto" },
      { provider: "ovh", model: "Qwen3.8-27B" },
    ],
  },
  code: {
    id: "code",
    label: "קוד",
    description: "כתיבה ותיקון של קוד",
    chain: [
      CLAUDE,
      { provider: "freellmapi", model: "auto:smart" },
      { provider: "cerebras", model: "gpt-oss-120b" },
      { provider: "groq", model: "openai/gpt-oss-120b" },
      { provider: "mistral", model: "codestral-latest" },
      { provider: "kilo", model: "cohere/north-mini-code:free" },
    ],
  },
};

export type Env = Record<string, string | undefined>;

export function baseUrlOf(p: Provider, env: Env): string | undefined {
  const raw = p.baseUrl ?? (p.baseUrlEnv ? env[p.baseUrlEnv] : undefined);
  if (!raw) return undefined;
  const url = raw.replace(/\/+$/, "");
  // FreeLLMAPI is given as its origin; its OpenAI surface lives under /v1.
  return p.id === "freellmapi" && !url.endsWith("/v1") ? `${url}/v1` : url;
}

/** Why a provider cannot be used right now, or null when it can. */
export function unavailableReason(p: Provider, env: Env): "no_key" | "keyless_off" | "no_url" | null {
  if (p.keyless) return env.ALLOW_KEYLESS === "1" ? null : "keyless_off";
  if (p.kind === "openai" && !baseUrlOf(p, env)) return "no_url";
  if (p.keyEnv && !env[p.keyEnv]) return "no_key";
  return null;
}

export function costOf(ref: ModelRef, inputTokens: number, outputTokens: number): number {
  if (!ref.price) return 0;
  return (inputTokens * ref.price.input + outputTokens * ref.price.output) / 1_000_000;
}
