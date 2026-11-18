export const dayKey = (d: Date | number = new Date()) => {
  const x = new Date(d)
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`
}

export const addDays = (d: Date, n: number) => {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}

export const lastNDays = (n: number, end = new Date()) => Array.from({ length: n }, (_, i) => addDays(end, i - n + 1))

export const hebrewWeekday = (d: Date) => ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'][d.getDay()]

export const greeting = (d = new Date()) => {
  const h = d.getHours()
  if (h < 5) return 'לילה טוב'
  if (h < 12) return 'בוקר טוב'
  if (h < 17) return 'צהריים טובים'
  if (h < 21) return 'ערב טוב'
  return 'לילה טוב'
}

/** Consecutive days ending today (or yesterday, if today has no activity yet). */
export function streakFrom(active: (key: string) => boolean, today = new Date()) {
  let d = new Date(today)
  if (!active(dayKey(d))) d = addDays(d, -1)
  let n = 0
  while (active(dayKey(d))) {
    n++
    d = addDays(d, -1)
  }
  return n
}

export function bestStreak(keys: string[]) {
  const set = new Set(keys)
  let best = 0
  for (const k of set) {
    const [y, m, dd] = k.split('-').map(Number)
    const d = new Date(y, m - 1, dd)
    if (set.has(dayKey(addDays(d, -1)))) continue
    let n = 0
    let c = d
    while (set.has(dayKey(c))) {
      n++
      c = addDays(c, 1)
    }
    best = Math.max(best, n)
  }
  return best
}
