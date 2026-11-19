/* The viewer's Claude, when the page runs inside a Claude viewer. Everything here degrades to null. */
type SampleFn = ((input: string | { role: 'user' | 'assistant'; content: string }[], opts?: Record<string, unknown>) => Promise<{ text: string; truncated: boolean }>) & {
  json?: unknown
}
type Dictation = {
  start(): Promise<void>
  stop(): Promise<void>
  onPartial(f: (e: { text: string }) => void): void
  onFinal(f: (e: { text: string }) => void): void
  onState(f: (e: { state: string; reason?: string }) => void): void
}
type Downloads = { save(f: { filename: string; data: Blob | string }): Promise<unknown> }

const api = () => (globalThis as unknown as { claude?: { use(name: string): Promise<unknown> } }).claude
const cache: Record<string, Promise<unknown>> = {}
function use<T>(name: string): Promise<T | null> {
  const c = api()
  if (!c?.use) return Promise.resolve(null)
  return (cache[name] ??= c.use(name).catch(() => null)) as Promise<T | null>
}
export const getSample = () => use<SampleFn>('sample')
export const getDictation = () => use<Dictation>('dictation')
export const getDownloads = () => use<Downloads>('downloads')

export function errorText(code?: string) {
  switch (code) {
    case 'not_granted':
    case 'sampling_disabled':
      return 'השאלות לספר לא אושרו בחשבון הזה.'
    case 'rate_limited':
      return 'יותר מדי שאלות ברגע זה. נסה שוב בעוד דקה.'
    case 'session_expired':
      return 'צריך להתחבר שוב לחשבון Claude.'
    case 'cancelled':
      return ''
    default:
      return 'משהו השתבש בדרך. נסה לשאול שוב.'
  }
}
