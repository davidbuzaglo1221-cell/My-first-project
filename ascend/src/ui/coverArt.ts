import type { Motif } from '../content/types'

function hash(s: string) {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return h >>> 0
}

function rng(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const f = (n: number) => n.toFixed(1)

function motifPaths(m: Motif, r: () => number, cx: number, cy: number): string {
  const p: string[] = []
  switch (m) {
    case 'rings': {
      const n = 6 + Math.floor(r() * 3)
      for (let k = 0; k < n; k++) p.push(`<circle cx="${f(cx + (r() - 0.5) * 4)}" cy="${f(cy + 34 - k * 7)}" r="${f(12 + k * 13)}" opacity="${f(1 - k / (n + 2))}"/>`)
      break
    }
    case 'arc': {
      const d = 34 + r() * 18
      p.push(`<circle cx="${f(cx - d)}" cy="${cy}" r="70"/>`, `<circle cx="${f(cx + d)}" cy="${cy}" r="70"/>`)
      p.push(`<line x1="${f(cx)}" y1="${cy - 90}" x2="${f(cx)}" y2="${cy + 90}" opacity=".35"/>`)
      break
    }
    case 'prism': {
      // A lens: the act of looking closely at how minds work.
      const w = 82
      const h = 34 + r() * 10
      p.push(`<path d="M${cx - w} ${cy} Q${cx} ${f(cy - h * 2)} ${cx + w} ${cy} Q${cx} ${f(cy + h * 2)} ${cx - w} ${cy} Z"/>`)
      for (let k = 1; k <= 4; k++) p.push(`<circle cx="${cx}" cy="${cy}" r="${k * 8}" opacity="${f(1.1 - k * 0.2)}"/>`)
      for (let k = 0; k < 24; k++) {
        const a = (k / 24) * Math.PI * 2
        p.push(`<line x1="${f(cx + Math.cos(a) * 34)}" y1="${f(cy + Math.sin(a) * 34)}" x2="${f(cx + Math.cos(a) * (40 + r() * 8))}" y2="${f(cy + Math.sin(a) * (40 + r() * 8))}" opacity=".5"/>`)
      }
      p.push(`<circle cx="${cx}" cy="${cy}" r="5" class="fill"/>`)
      break
    }
    case 'wave': {
      for (let k = 0; k < 8; k++) {
        const y = cy - 56 + k * 16
        const a = 8 + r() * 10
        const ph = r() * 6
        let d = `M0 ${f(y)}`
        for (let x = 0; x <= 200; x += 10) d += ` L${x} ${f(y + Math.sin(x / 22 + ph + k * 0.5) * a)}`
        p.push(`<path d="${d}" opacity="${f(0.3 + (k % 3) * 0.25)}"/>`)
      }
      break
    }
    case 'sun': {
      const n = 44
      for (let k = 0; k < n; k++) {
        const a = (k / n) * Math.PI * 2
        const r1 = 20
        const r2 = 34 + r() * 56
        p.push(`<line x1="${f(cx + Math.cos(a) * r1)}" y1="${f(cy + Math.sin(a) * r1)}" x2="${f(cx + Math.cos(a) * r2)}" y2="${f(cy + Math.sin(a) * r2)}" opacity="${f(0.3 + r() * 0.7)}"/>`)
      }
      p.push(`<circle cx="${cx}" cy="${cy}" r="12" class="fill"/>`)
      break
    }
    case 'stairs': {
      const n = 6
      const w = 22
      const h = 18
      let x = cx - (n * w) / 2
      let y = cy + 56
      let d = `M${f(x - 20)} ${f(y)} L${f(x)} ${f(y)}`
      for (let k = 0; k < n; k++) {
        y -= h
        d += ` L${f(x)} ${f(y)}`
        x += w
        d += ` L${f(x)} ${f(y)}`
      }
      // Rises toward the left: in Hebrew, forward is leftward.
      p.push(`<g transform="translate(200 0) scale(-1 1)"><path d="${d}"/><circle cx="${f(x - w / 2)}" cy="${f(y - 14)}" r="3.5" class="fill"/><line x1="${f(cx - (n * w) / 2 - 20)}" y1="${f(cy + 66)}" x2="${f(x + 10)}" y2="${f(cy + 66)}" opacity=".3"/></g>`)
      break
    }
    case 'grid': {
      const vy = cy - 40
      for (let k = 0; k < 7; k++) {
        const y = vy + 18 + k * k * 3.2
        p.push(`<line x1="0" y1="${f(y)}" x2="200" y2="${f(y)}" opacity="${f(0.2 + k * 0.1)}"/>`)
      }
      for (let k = -6; k <= 6; k++) p.push(`<line x1="${cx}" y1="${vy}" x2="${f(cx + k * 34)}" y2="300" opacity=".45"/>`)
      p.push(`<rect x="${cx - 16}" y="${vy - 56}" width="32" height="32" transform="rotate(45 ${cx} ${vy - 40})"/>`)
      break
    }
    case 'pillar': {
      const n = 5
      for (let k = 0; k < n; k++) {
        const x = cx - 60 + k * 30
        const h = 60 + (k === 2 ? 70 : Math.abs(2 - k) === 1 ? 44 : 22) + r() * 6
        p.push(`<rect x="${f(x - 8)}" y="${f(cy + 60 - h)}" width="16" height="${f(h)}" rx="1" opacity="${f(k === 2 ? 1 : 0.55)}"/>`)
      }
      p.push(`<line x1="${cx - 84}" y1="${cy + 60}" x2="${cx + 84}" y2="${cy + 60}"/>`)
      break
    }
    case 'orbit': {
      for (let k = 0; k < 3; k++) {
        const rot = -30 + k * 40 + r() * 10
        p.push(`<ellipse cx="${cx}" cy="${cy}" rx="${80 - k * 6}" ry="${26 + k * 8}" transform="rotate(${f(rot)} ${cx} ${cy})" opacity="${f(0.5 + k * 0.2)}"/>`)
        const a = r() * Math.PI * 2
        const rx = 80 - k * 6
        const ry = 26 + k * 8
        const px = Math.cos(a) * rx
        const py = Math.sin(a) * ry
        const rr = (rot * Math.PI) / 180
        p.push(`<circle cx="${f(cx + px * Math.cos(rr) - py * Math.sin(rr))}" cy="${f(cy + px * Math.sin(rr) + py * Math.cos(rr))}" r="2.6" class="fill"/>`)
      }
      p.push(`<circle cx="${cx}" cy="${cy}" r="9" class="fill" opacity=".9"/>`)
      break
    }
  }
  return p.join('')
}

const cache = new Map<string, string>()

/** Original generative artwork for a book or path. Pure SVG, no external assets. */
export function coverSvg(seedId: string, motif: Motif, hue: number, opts: { square?: boolean } = {}) {
  const key = `${seedId}|${motif}|${hue}|${opts.square ? 1 : 0}`
  const hit = cache.get(key)
  if (hit) return hit
  const r = rng(hash(seedId))
  const H = opts.square ? 200 : 300
  const cy = opts.square ? 100 : 128 + r() * 16
  const cx = 100
  const lx = 60 + r() * 80
  const ly = opts.square ? 70 : 70 + r() * 60
  const id = 'c' + hash(key).toString(36)
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 ${H}" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
<defs>
<linearGradient id="${id}b" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="hsl(${hue} 34% 8%)"/><stop offset="1" stop-color="hsl(${hue} 40% 2.5%)"/></linearGradient>
<radialGradient id="${id}l" cx="${f(lx / 2)}%" cy="${f((ly / H) * 100)}%" r="62%"><stop offset="0" stop-color="hsl(${hue} 72% 46%)" stop-opacity=".62"/><stop offset=".45" stop-color="hsl(${hue} 70% 30%)" stop-opacity=".22"/><stop offset="1" stop-color="hsl(${hue} 70% 20%)" stop-opacity="0"/></radialGradient>
<radialGradient id="${id}v" cx="50%" cy="45%" r="75%"><stop offset=".55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".7"/></radialGradient>
<filter id="${id}g" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="2.4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
<filter id="${id}n"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 .5 0"/></filter>
</defs>
<rect width="200" height="${H}" fill="url(#${id}b)"/>
<rect width="200" height="${H}" fill="url(#${id}l)"/>
<g fill="none" stroke="hsl(${hue} 72% 74%)" stroke-width=".7" filter="url(#${id}g)" style="--fill:hsl(${hue} 80% 80%)">${motifPaths(motif, r, cx, cy).replace(/class="fill"/g, `fill="hsl(${hue} 85% 82%)" stroke="none"`)}</g>
<rect width="200" height="${H}" filter="url(#${id}n)" opacity=".07"/>
<rect width="200" height="${H}" fill="url(#${id}v)"/>
</svg>`
  cache.set(key, svg)
  return svg
}

const pngCache = new Map<string, Promise<string>>()

/** Square raster artwork for the lock screen / media session. */
export function coverPng(seedId: string, motif: Motif, hue: number): Promise<string> {
  const key = `${seedId}|${motif}|${hue}`
  if (!pngCache.has(key)) {
    pngCache.set(
      key,
      new Promise((resolve) => {
        const img = new Image()
        img.onload = () => {
          const c = document.createElement('canvas')
          c.width = c.height = 512
          c.getContext('2d')!.drawImage(img, 0, 0, 512, 512)
          try {
            resolve(c.toDataURL('image/png'))
          } catch {
            resolve('')
          }
        }
        img.onerror = () => resolve('')
        img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(coverSvg(seedId, motif, hue, { square: true }))
      }),
    )
  }
  return pngCache.get(key)!
}
