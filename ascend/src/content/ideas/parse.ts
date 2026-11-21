/**
 * Key-idea files use a light format:
 *   @ lesson-id        starts a chapter
 *   ## heading         starts an idea
 *   text lines         the idea's explanation (joined into one paragraph)
 */
export function parseIdeas(sources: string[]): Record<string, { h: string; t: string }[]> {
  const out: Record<string, { h: string; t: string }[]> = {}
  for (const src of sources) {
    let cur: { h: string; t: string }[] | undefined
    for (const raw of src.split('\n')) {
      const line = raw.trim()
      if (!line) continue
      if (line.startsWith('@')) out[line.slice(1).trim()] = cur = []
      else if (line.startsWith('##')) cur?.push({ h: line.slice(2).trim(), t: '' })
      else if (cur?.length) {
        const last = cur[cur.length - 1]
        last.t = last.t ? `${last.t} ${line}` : line
      }
    }
  }
  return out
}
