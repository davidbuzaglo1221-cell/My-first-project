---
name: art-direction
description: Choose and defend a per-project art direction before any visual work for David — websites, apps, photography and ads, CGI and 3D, video, branding. Turns audience, emotion and medium into a concrete direction (light, palette, type, composition, materials, motion) and checks the result against a per-domain quality bar. Use after `director` and before designing, generating or rendering anything visual.
---

# Art direction

David has no single style. Every project gets its own direction, chosen for its audience and goal, and it has to be **premium, cinematic, mature and precise**. His taste board: `reference/david-taste-board.jpg` (editorial portrait with a serif wordmark, dark glass-material app screens, product shot in a single shaft of light, CGI bottle wrapped in a liquid-metal petal). Study the principles behind it, never the brands or images themselves.

## 1. Write the brief (5 lines, in your head or in the project notes)
1. **Who** sees it and where (phone feed, desktop, store, print).
2. **One feeling** it must leave (calm authority, desire, trust, energy, wonder).
3. **One idea** — the single thing the viewer remembers.
4. **Constraint** — brand rules (`david-brand` for his barber work), budget, available assets (real photos? none?).
5. **What it must not look like** — the obvious template version of this.

## 2. Pick a direction (or combine two, never more)
| Direction | Feels | Light & colour | Type | Use for |
|---|---|---|---|---|
| **Editorial noir** | intimate, confident | low key, warm shadows, muted sepia / B&W, film grain | large high-contrast serif wordmark, tiny grotesk captions | personal brands, portfolios, barber work, fashion |
| **Studio product** | desire, craft | one hard key light or light shaft, deep black, single warm accent, real textures (stone, leaves, metal) | restrained; product is the hero | ads, launch visuals, perfume/cosmetics, grooming products |
| **CGI sculptural** | wonder, luxury | soft gradient studio, specular highlights, satin/liquid/glass materials | almost none | hero visuals, campaigns, 3D scenes (Three.js) |
| **Glass interface** | modern, tactile | dark base, blurred colour field behind translucent layers, light depth | SF-like grotesk, strong size hierarchy | AI products, media apps, dashboards |
| **Apple clean** | clarity, trust | light or true-dark neutral, one accent, generous space | system grotesk, large titles | utility apps, learning, booking, forms |
| **Kinetic street** | energy, humour | high contrast, one loud colour, grain, marker | condensed bold, hand marks | Reels, TikTok, launches (`fast-video`) |

Decide and write one line: *"Direction: X, because Y. Not Z."* Then fix the tokens: 1 neutral scale, 1 accent, 2 typefaces max (Hebrew pairs: Frank Ruhl Libre / Heebo, David Libre / Assistant, Noto Serif Hebrew / Rubik), 1 radius, 1 motion curve.

Gold, black, gradients and glass are allowed **when the direction calls for them** — banned only as an unjustified default.

## 3. Quality bar per domain (check before showing David)
**Websites & design** — one dominant element per screen; real grid and alignment; type does the work (scale contrast ≥ 3×); whitespace on purpose; imagery is real photography or convincing renders, never stock clichés; RTL correct; works at 390px and 1440px.
**Apps** — feels native: large titles, grouped lists, hairlines, real states (empty, loading, error), 44px targets, springs that can be interrupted; `premium-app` for the full standard.
**Photography & ads** — one light story (where is the key, what does the shadow say); controlled palette (≤ 3 hues); a surface and a material that tell the price; negative space for copy; colour grade consistent across the set.
**CGI & 3D** — believable materials (roughness, fresnel, subsurface where needed), physically plausible light, contact shadows, depth of field used sparingly, no plastic look, no floating objects without reason.
**Video** — `fast-video` and `VIDEO_STYLE_GUIDE.md`; the frame grabs must pass the photography bar above.

## 4. Anti-generic check (any "yes" = redo)
- Could this be any brand's? Is there a purple-blue gradient, a card per row, centred everything, emoji icons, glow for no reason?
- Is there more than one idea fighting for attention? More than 2 typefaces? Effects that exist only to impress?
- Does it copy a known brand, character or artwork instead of learning its principle?

## 5. Record
If David corrects the direction, add a lesson to `TITAN-BUSINESS-OS/LESSONS.md` and the taste rule to `TITAN-BUSINESS-OS/MY_CREATIVE_DNA.md`.
