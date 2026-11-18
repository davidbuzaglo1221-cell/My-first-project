/** Split a narration script into speakable segments (short enough for every speech engine). */
export function toSegments(script: string, max = 190): string[] {
  const parts = script
    .replace(/\r/g, '')
    .split(/\n+/)
    .flatMap((p) => p.split(/(?<=[.!?:])\s+/))
    .map((s) => s.trim())
    .filter(Boolean)

  const out: string[] = []
  for (const p of parts) {
    if (p.length <= max) {
      out.push(p)
      continue
    }
    let rest = p
    while (rest.length > max) {
      const cut = Math.max(rest.lastIndexOf(', ', max), rest.lastIndexOf(' ', max))
      const at = cut > 40 ? cut + 1 : max
      out.push(rest.slice(0, at).trim())
      rest = rest.slice(at).trim()
    }
    if (rest) out.push(rest)
  }
  return out
}

/** Cumulative start offsets in characters, plus total. */
export function offsets(segments: string[]) {
  const starts: number[] = []
  let acc = 0
  for (const s of segments) {
    starts.push(acc)
    acc += s.length + 1
  }
  return { starts, total: acc }
}
