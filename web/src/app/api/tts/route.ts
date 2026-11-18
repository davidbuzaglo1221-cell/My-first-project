import { z } from "zod";
import { azureSsml, googleSsml } from "@/lib/speech/ssml";
import { findPersona, PERSONAS, type CloudProvider } from "@/lib/speech/voices";

// Cloud speech for the listening player. Server-only: keys never reach the browser.
//   TTS_PROVIDER          "google" | "azure" (optional; picks whichever has a key, Google first)
//   GOOGLE_TTS_API_KEY    Google Cloud Text-to-Speech API key (Chirp 3 HD voices)
//   AZURE_SPEECH_KEY      Azure Speech resource key
//   AZURE_SPEECH_REGION   Azure region of that resource, e.g. "westeurope"
//   APP_ACCESS_TOKEN      requests must send it in `x-app-token` (same as the photo route)
// With no key, GET answers { provider: null } and the app falls back to the device's own voices.

export const runtime = "nodejs";
export const maxDuration = 30;

function provider(): CloudProvider | null {
  const want = process.env.TTS_PROVIDER;
  const google = Boolean(process.env.GOOGLE_TTS_API_KEY);
  const azure = Boolean(process.env.AZURE_SPEECH_KEY && process.env.AZURE_SPEECH_REGION);
  if (want === "azure" && azure) return "azure";
  if (want === "google" && google) return "google";
  return google ? "google" : azure ? "azure" : null;
}

function authorized(request: Request): boolean {
  const required = process.env.APP_ACCESS_TOKEN;
  if (!required) return !process.env.VERCEL; // a deployed app without a token keeps the keys closed
  return request.headers.get("x-app-token") === required;
}

const Lang = z.enum(["he-IL", "en-US"]);
const Body = z.object({
  parts: z.array(z.object({ lang: Lang, text: z.string().min(1).max(600) })).min(1).max(12),
  role: z.enum(["title", "body", "callout"]).default("body"),
  voice: z.string().max(60).optional(),
});

// Small in-memory cache: the same sentence in the same voice is not paid for twice per instance.
const cache = new Map<string, ArrayBuffer>();
const CACHE_MAX = 300;

async function google(ssml: string, lang: string, name: string): Promise<ArrayBuffer> {
  const res = await fetch("https://texttospeech.googleapis.com/v1/text:synthesize", {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": process.env.GOOGLE_TTS_API_KEY! },
    body: JSON.stringify({
      input: { ssml },
      voice: { languageCode: lang, name },
      // Rate is applied on the device, so one clip serves every speed.
      audioConfig: { audioEncoding: "MP3", sampleRateHertz: 24000, speakingRate: 1 },
    }),
  });
  if (!res.ok) throw new Error(`google ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const { audioContent } = (await res.json()) as { audioContent: string };
  const bytes = Buffer.from(audioContent, "base64");
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

async function azure(ssml: string): Promise<ArrayBuffer> {
  const region = process.env.AZURE_SPEECH_REGION!;
  const res = await fetch(`https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`, {
    method: "POST",
    headers: {
      "Ocp-Apim-Subscription-Key": process.env.AZURE_SPEECH_KEY!,
      "Content-Type": "application/ssml+xml",
      "X-Microsoft-OutputFormat": "audio-24khz-96kbitrate-mono-mp3",
      "User-Agent": "fitness-app-tts",
    },
    body: ssml,
  });
  if (!res.ok) throw new Error(`azure ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return res.arrayBuffer();
}

/** Which engine is set up, and its voices. The player calls this once to choose cloud or device. */
export async function GET(request: Request) {
  const p = provider();
  if (!p || !authorized(request)) return Response.json({ provider: null, voices: [] });
  return Response.json({ provider: p, voices: PERSONAS[p].map(({ id, label, gender }) => ({ id, label, gender })) });
}

export async function POST(request: Request) {
  const p = provider();
  if (!p) return Response.json({ error: "not_configured" }, { status: 503 });
  if (!authorized(request)) return Response.json({ error: "unauthorized" }, { status: 401 });

  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await request.json());
  } catch {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }

  const persona = findPersona(p, body.voice);
  const base = body.parts.some((x) => x.lang === "he-IL") ? "he-IL" : "en-US";
  const ssml = p === "google" ? googleSsml(body.parts, body.role, persona.voices, base) : azureSsml(body.parts, body.role, persona.voices, base);
  const key = `${p}|${persona.id}|${ssml}`;

  try {
    let audio = cache.get(key);
    if (!audio) {
      audio = p === "google" ? await google(ssml, base, persona.voices[base]) : await azure(ssml);
      if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value!);
      cache.set(key, audio);
    }
    return new Response(audio, {
      headers: { "content-type": "audio/mpeg", "cache-control": "private, max-age=31536000, immutable", "x-tts-voice": persona.id },
    });
  } catch (e) {
    console.error("tts", e);
    return Response.json({ error: "engine_failed" }, { status: 502 });
  }
}
