// Generates the ASCEND app icon (1024×1024 SVG): a golden open book radiating light on deep emerald.
import { writeFileSync } from 'node:fs'

let seed = 7
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
const f = (n) => n.toFixed(1)
const CX = 512, CY = 548 // where the light comes from: the spine, between the pages

// Light rays: thin wedges fanning upward from the spine.
const rays = []
for (let i = 0; i < 70; i++) {
  const a = (-166 + (i / 69) * 152 + (rnd() - 0.5) * 3) * (Math.PI / 180)
  const len = 260 + rnd() * 260 * (1 - Math.abs(Math.cos(a)) * 0.5)
  const w = (0.25 + rnd() * 1.1) * (Math.PI / 180)
  const p1 = [CX + Math.cos(a - w) * len, CY + Math.sin(a - w) * len]
  const p2 = [CX + Math.cos(a + w) * len, CY + Math.sin(a + w) * len]
  rays.push(`<path d="M${CX} ${CY} L${f(p1[0])} ${f(p1[1])} L${f(p2[0])} ${f(p2[1])} Z" opacity="${f(0.25 + rnd() * 0.6)}"/>`)
}
// Floating motes of light above the book.
const motes = []
for (let i = 0; i < 34; i++) {
  const a = (-158 + rnd() * 136) * (Math.PI / 180)
  const d = 90 + rnd() * 300
  const x = CX + Math.cos(a) * d, y = CY - 30 + Math.sin(a) * d
  motes.push(`<circle cx="${f(x)}" cy="${f(y)}" r="${f(1.4 + rnd() * 2.6)}" opacity="${f(0.35 + rnd() * 0.6)}"/>`)
}

// One half of the book (left); the right half is its mirror.
const half = `
  <!-- cover board, peeking out under the page block -->
  <path d="M512 668 C 446 628, 344 612, 196 620 L 192 640 C 342 632, 446 650, 512 694 Z" fill="url(#cover)"/>
  <path d="M512 668 C 446 628, 344 612, 196 620" fill="none" stroke="url(#rim)" stroke-width="3"/>
  <!-- page block: the stacked edges, gilded -->
  <path d="M512 640 C 452 600, 352 586, 214 594 L 208 622 C 348 614, 448 630, 512 670 Z" fill="url(#gilt)"/>
  <path d="M512 648 C 451 609, 351 595, 212 602 M512 656 C 450 617, 350 603, 211 610 M512 663 C 449 624, 349 610, 209 616" fill="none" stroke="#7a5418" stroke-opacity=".55" stroke-width="1.6"/>
  <!-- the open page, curling up into the spine -->
  <path d="M512 560 C 478 506, 384 478, 236 476 C 228 506, 220 552, 214 594 C 352 586, 452 600, 512 640 Z" fill="url(#page)"/>
  <path d="M512 560 C 478 506, 384 478, 236 476" fill="none" stroke="#fff6dc" stroke-width="5" opacity=".6"/>
  <!-- a soft fold shadow near the spine -->
  <path d="M512 560 C 492 532, 470 516, 440 506 L 448 604 C 474 612, 496 624, 512 640 Z" fill="url(#fold)" filter="url(#fine)"/>
  <!-- gilded edge on the page -->
  <path d="M512 560 C 478 506, 384 478, 236 476 C 228 506, 220 552, 214 594" fill="none" stroke="url(#rim)" stroke-width="3.4" stroke-linejoin="round"/>
`

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">
<defs>
  <radialGradient id="bg" cx="512" cy="470" r="720" gradientUnits="userSpaceOnUse">
    <stop offset="0" stop-color="#133a2a"/><stop offset=".5" stop-color="#0a261b"/><stop offset="1" stop-color="#030f0a"/>
  </radialGradient>
  <filter id="grain" x="0" y="0" width="100%" height="100%">
    <feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="3" seed="4"/>
    <feColorMatrix values="0 0 0 0 .55  0 0 0 0 .75  0 0 0 0 .62  0 0 0 .55 0"/>
  </filter>
  <radialGradient id="vig" cx="512" cy="500" r="700" gradientUnits="userSpaceOnUse">
    <stop offset=".55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".55"/>
  </radialGradient>
  <radialGradient id="rayfill" cx="${CX}" cy="${CY}" r="470" gradientUnits="userSpaceOnUse">
    <stop offset="0" stop-color="#fff6d2"/><stop offset=".18" stop-color="#ffdc86"/><stop offset=".55" stop-color="#f5b847" stop-opacity=".45"/><stop offset="1" stop-color="#e09a2c" stop-opacity="0"/>
  </radialGradient>
  <radialGradient id="core" cx="${CX}" cy="${CY - 16}" r="250" gradientUnits="userSpaceOnUse">
    <stop offset="0" stop-color="#fffbe9"/><stop offset=".12" stop-color="#ffe6a0" stop-opacity=".95"/>
    <stop offset=".38" stop-color="#f2b54a" stop-opacity=".38"/><stop offset="1" stop-color="#d4902a" stop-opacity="0"/>
  </radialGradient>
  <radialGradient id="core2" cx="${CX}" cy="${CY - 10}" r="150" gradientUnits="userSpaceOnUse">
    <stop offset="0" stop-color="#fffdf2"/><stop offset=".25" stop-color="#ffe9a8" stop-opacity=".85"/><stop offset=".6" stop-color="#f5bd52" stop-opacity=".25"/><stop offset="1" stop-color="#f5bd52" stop-opacity="0"/>
  </radialGradient>
  <linearGradient id="page" x1="512" y1="510" x2="214" y2="594" gradientUnits="userSpaceOnUse">
    <stop offset="0" stop-color="#fffbef"/><stop offset=".35" stop-color="#fbefcf"/><stop offset=".8" stop-color="#ecd49b"/><stop offset="1" stop-color="#d4b06a"/>
  </linearGradient>
  <linearGradient id="fold" x1="512" y1="0" x2="440" y2="0" gradientUnits="userSpaceOnUse">
    <stop offset="0" stop-color="#9a7128" stop-opacity=".28"/><stop offset="1" stop-color="#9a7128" stop-opacity="0"/>
  </linearGradient>
  <linearGradient id="gilt" x1="0" y1="590" x2="0" y2="672" gradientUnits="userSpaceOnUse">
    <stop offset="0" stop-color="#fbe2a2"/><stop offset=".5" stop-color="#d9a64a"/><stop offset="1" stop-color="#8f6420"/>
  </linearGradient>
  <linearGradient id="cover" x1="0" y1="618" x2="0" y2="696" gradientUnits="userSpaceOnUse">
    <stop offset="0" stop-color="#6a4914"/><stop offset="1" stop-color="#2e1e07"/>
  </linearGradient>
  <linearGradient id="rim" x1="196" y1="0" x2="512" y2="0" gradientUnits="userSpaceOnUse">
    <stop offset="0" stop-color="#b9822a"/><stop offset=".6" stop-color="#ffe199"/><stop offset="1" stop-color="#fff4cf"/>
  </linearGradient>
  <filter id="soft" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="6"/></filter>
  <filter id="fine" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2.2"/></filter>
  <filter id="bloom" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="18"/></filter>
  <filter id="shadow" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="16"/></filter>
  <radialGradient id="star" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#fffbe8"/><stop offset=".4" stop-color="#ffd27a" stop-opacity=".6"/><stop offset="1" stop-color="#ffd27a" stop-opacity="0"/></radialGradient>
</defs>

<rect width="1024" height="1024" fill="url(#bg)"/>
<rect width="1024" height="1024" filter="url(#grain)" opacity=".18"/>
<rect width="1024" height="1024" fill="url(#vig)"/>

<g transform="translate(512 540) scale(1.08) translate(-512 -540)">
<!-- shadow of the book on the surface -->
<ellipse cx="512" cy="700" rx="320" ry="34" fill="#000" opacity=".55" filter="url(#shadow)"/>

<!-- light -->
<g fill="url(#rayfill)" filter="url(#bloom)" opacity=".9">${rays.join('')}</g>
<g fill="url(#rayfill)" filter="url(#fine)" opacity=".75">${rays.filter((_, i) => i % 2 === 0).join('')}</g>
<circle cx="${CX}" cy="${CY - 16}" r="250" fill="url(#core)"/>
<circle cx="${CX}" cy="${CY - 10}" r="150" fill="url(#core2)"/>

<!-- book -->
<g>${half}</g>
<g transform="translate(1024 0) scale(-1 1)">${half}</g>
<!-- spine line and the bright seam of light between the pages -->
<path d="M512 556 L 512 694" stroke="#6b4a14" stroke-width="2.4" opacity=".7"/>
<ellipse cx="512" cy="560" rx="70" ry="26" fill="#fff6d6" filter="url(#bloom)" opacity=".95" style="mix-blend-mode:screen"/>
<ellipse cx="512" cy="556" rx="22" ry="10" fill="#ffffff" filter="url(#soft)" style="mix-blend-mode:screen"/>

<!-- motes and the guiding star -->
<g fill="#ffe7a8" filter="url(#soft)" style="mix-blend-mode:screen">${motes.join('')}</g>
<g fill="#fff3cf">${motes.filter((_, i) => i % 2 === 0).join('')}</g>
<g transform="translate(512 238)" style="mix-blend-mode:screen">
  <circle r="26" fill="url(#star)" opacity=".45" filter="url(#soft)"/>
  <path d="M0 -34 C 2 -6, 6 -2, 34 0 C 6 2, 2 6, 0 34 C -2 6, -6 2, -34 0 C -6 -2, -2 -6, 0 -34 Z" fill="#fff8e1"/>
  <path d="M0 -14 C 1 -3, 3 -1, 14 0 C 3 1, 1 3, 0 14 C -1 3, -3 1, -14 0 C -3 -1, -1 -3, 0 -14 Z" fill="#fff" transform="rotate(45)" opacity=".7"/>
</g>
</g>
</svg>`
writeFileSync(new URL('./icon-master.svg', import.meta.url), svg)
console.log('icon-master.svg written')
