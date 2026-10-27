// Where the app is running. The same screens build two ways:
//   "web"       Next.js on a server (the photo route holds the API key)
//   "artifact"  one page inside Claude: data in the Claude account, Claude answers photos itself
export const IS_ARTIFACT = process.env.NEXT_PUBLIC_TARGET === "artifact";

// The artifact runtime's capabilities, reduced to what this app calls.

export type DbError = { code: string; message: string };
export type DocSnap = { id: string; exists: boolean; data(): Record<string, unknown> | undefined };
export type QuerySnap = { docs: DocSnap[]; docChanges(): { type: "added" | "modified" | "removed"; doc: DocSnap }[] };
export type DocRef = {
  get(): Promise<DocSnap>;
  set(data: Record<string, unknown>): Promise<void>;
  delete(): Promise<void>;
};
export type Query = {
  where(field: string, op: string, value: unknown): Query;
  orderBy(field: string, dir?: "asc" | "desc"): Query;
  limit(n: number): Query;
  get(): Promise<QuerySnap>;
  onSnapshot(next: (s: QuerySnap) => void, error?: (e: DbError) => void): () => void;
};
export type Collection = Query & { doc(id: string): DocRef };
export type Db = { collection(path: string): Collection };

export type SampleError = { code: string; message: string; text?: string };
export type Sample = {
  json<T = unknown>(input: string, options?: { images?: Blob[]; modelTier?: "quick" | "default" | "complex"; effort?: "low" | "medium" | "high"; signal?: AbortSignal; cache?: boolean }): Promise<T>;
  limits(): Promise<{ images?: { maxCount: number } }>;
};
export type User = { id(): Promise<string | null> };
export type Downloads = { save(file: { filename: string; data: Blob | string }): Promise<unknown> };

type Caps = { db: Db; sample: Sample; user: User; downloads: Downloads };

declare global {
  interface Window {
    claude?: { use(name: string): Promise<unknown> };
  }
}

/** A capability, or null where this view cannot run it (outside Claude, signed out, not granted). */
export async function cap<K extends keyof Caps>(name: K): Promise<Caps[K] | null> {
  if (!IS_ARTIFACT || typeof window === "undefined" || !window.claude?.use) return null;
  try {
    return ((await window.claude.use(name)) as Caps[K] | null) ?? null;
  } catch {
    return null;
  }
}
