# Astrea — UI motion & React Bits components

Decision log for where [React Bits](https://reactbits.dev) components get used in the product, and why. Verified against the live component docs (props + dependencies), not assumed from the component name — two of the originally proposed placements turned out to need correction (Dock, Tilted Card — see below).

## Principles

1. **Motion earns its place.** Every component below is tied to a specific screen from [product-flows.md](product-flows.md) or [build-plan.md](build-plan.md), not sprinkled decoratively.
2. **One hero background, nowhere else.** WebGL backgrounds (Prism, Light Pillar, Dark Veil, Light Rays) are expensive relative to plain CSS — confined to the marketing homepage hero only, never the app's functional screens (dashboard, judge panel, event pages), which prioritize fast load and low battery/GPU draw.
3. **Respect touch.** Astrea is a PWA — most participant and judge traffic is mobile. Any component whose interaction model is mouse-proximity-based (hover, cursor distance) is flagged explicitly below; it either gets a touch-friendly fallback or is scoped to desktop-only surfaces.
4. **Heaviest dependency, smallest footprint.** `three.js` (Model Viewer) is lazy-loaded on the one page that uses it, never in the shared bundle.

## Hero background — decision

| Option | Engine | Built-in perf safety | Verdict |
| --- | --- | --- | --- |
| **Prism** | `ogl` | `suspendWhenOffscreen` — pauses rendering once scrolled out of view | **Chosen (re-revised, 2026-07-26).** Back after a detour through Light Pillar — see revision history below. |
| Light Pillar | `three` | `quality` prop auto-downgrades low/medium/high on mobile | Tried in between (2026-07-26). Reverted the same day — see below. |
| Dark Veil | `ogl` | `resolutionScale` (manual, not automatic) | Visual tone ("flame of ambition") reads more aggressive/fintech-hype than fits Astrea's trust/justice narrative. |
| Light Rays | `ogl` | none exposed | Lightest visual, but no offscreen-pause or mobile auto-downgrade found in its props — would need to wire `IntersectionObserver` manually to get the same safety Prism gives for free. |

**Original decision: Prism.** Implemented in L00 (`src/components/prism-background.tsx`, ported from reactbits.dev/backgrounds/prism, JS → typed TSX, no logic changes), rendered only inside the homepage hero.

**Revision 1 (L00, 2026-07-26): swapped to Light Pillar.** Two things drove the change, both only visible once Prism was actually running against real content, not just read about in a props table:

1. Prism is additive-glow-on-transparent — it's designed to sit against a dark backdrop, and initially it was placed on Astrea's default white page background, which turned the effect into a washed-out, grainy haze rather than a visible glow. Fixing that required giving the hero its own dark background in the first place (`bg-black`) — at which point Light Pillar's aesthetic (a column of light emerging from black) fit even better than Prism's rotating facet did, or so it seemed at the time.
2. Doing this surfaced a real CSS bug worth remembering: a negative-`z-index` child of a `position: relative` ancestor with no `z-index` of its own (i.e., not a real stacking context) escapes *behind that ancestor's own background* — so `bg-black` on the hero was painting over the whole WebGL canvas. Fixed with `isolate` on the hero plus explicit `z-0`/`z-10` layering instead of a negative z-index. This applies to any future WebGL/canvas layering in the app, not just this component.

**Revision 2 (L00, 2026-07-26): reverted to Prism, laid out per an approved visual reference.** The hero was redesigned around a supplied mockup (dark full-bleed hero, "Built on Stellar" eyebrow, serif "Astrea" wordmark, left-aligned copy) which puts Prism back on the right side of the hero instead of full-bleed. Two fixes were needed to make it match the live reactbits.dev demo instead of looking "blurry"/washed out again:

1. **Confine, don't scale down (superseded — see below).** Prism first rendered inside a container sized to the right ~60% of the hero (`w-full md:w-3/5`) rather than spanning full-bleed, so it read exactly like the reactbits.dev demo, just cropped to a smaller lane instead of re-tuned.
2. **Don't dim the lane it's in.** The first attempt kept a full-width dark gradient overlay (for text contrast) on top of the whole hero, including the Prism lane — that overlay was the actual cause of the "washed out" look, confirmed by comparing a screenshot of our render against the live reactbits.dev/backgrounds/prism demo (same muted colors, minus the overlay). Fixed by switching the overlay to a diagonal gradient (`115deg`, matching the supplied mockup's own formula) that resolves to fully transparent by ~60% width — it never touches the Prism lane, only the text column.
3. **Full-bleed canvas, shape pushed right via `offset` (2026-07-27).** The confined-container approach left a flat, canvas-less black slab on the left ~40% of the hero — no shader, no grain, just `bg-black` showing through. Per feedback, the canvas now spans the whole hero (`inset-0`) so the Prism background (grain, ambient glow) is present everywhere, and the visible shape is pushed toward the right side using Prism's own `offset={{ x: 260 }}` prop (pixel offset in screen space, `x` → right) instead of clipping the canvas. The text-contrast gradient from fix 2 is unchanged and still does its job over the now-continuous canvas.

**Implemented:** `src/components/prism-background.tsx`, restored from the verified live source at reactbits.dev/backgrounds/prism (JS → typed TSX, no logic changes) — React Bits ships as copy-paste source, not an installed package, so only its `ogl` dependency is a real npm install. `light-pillar-background.tsx` and the `three`/`@types/three` dependencies were removed since nothing else used them (the "one hero background, nowhere else" principle means only one is active at a time).

**Also revised the header to float over the hero:** `SiteHeader` is `position: absolute` with a transparent background so it sits on top of the dark hero instead of its own solid bar — the header's logo uses a CSS `invert` filter on the black logo lockup (no separate white asset needed) and its GitHub icon/wallet button switch to light-on-dark colors. **This only works because the homepage hero is the only page today.** Once Phase 3 (U02+) adds pages without a hero (dashboard, event pages), `SiteHeader` needs a non-transparent variant for those — a floating transparent header over a plain light page would be unreadable.

**Header logo size, root-caused (2026-07-26).** Three rounds of bumping the logo's container height (`h-8` → `h-12` → `h-16`) barely changed how big it looked. Measured the source PNG's actual visible-pixel bounding box (`sharp`, alpha-channel scan) instead of guessing again: `astrea-sided-logo-light.png` is a 1536×1024 canvas but the mark only occupies 1005×334 px inside it — **32.6% vertical fill**. A `h-*` utility sizes the whole transparent canvas, so the visible glyph was always rendering at roughly a third of the height it looked like it should. Fixed by cropping to the bounding box plus a small margin (`sharp().trim().extend()`) into a new asset, `public/astrea-sided-logo-light-trimmed.png` (1053×381, ~88% vertical fill) — `SiteHeader` now points at that file with `h-14 md:h-20`, which finally scales the visible mark, not mostly padding. Lesson for any future logo-sizing complaint: measure the asset's real content bounds before touching CSS.

## Component placement

| Component | Dependency | Where it goes | Why |
| --- | --- | --- | --- |
| **Stepper** | `motion` | **U01 — Event creation wizard** (details → prizes → judges → review & sign) | Direct match — the wizard was already spec'd as exactly this shape in the build plan. Free upgrade, no redesign needed. |
| **Border Glow** | none (CSS/JS pointer tracking) | **U03 — Public event page**, wrapping each prize/milestone card | Lightweight (no WebGL lib). The proximity glow doubles as a subtle "this is verified" affordance next to the on-chain badge. Degrades gracefully on touch (just shows static border, no glow chase). |
| **Card Swap** | `gsap` | **New: marketing homepage**, "see it in action" section cycling through live/past events | Autoplays on a timer — doesn't need a cursor to be interesting, so it's touch-safe by default. |
| **Scroll Stack** | `lenis` | **New: marketing homepage**, "how it works" section (create → fund → judge → release) | Scroll-driven storytelling fits a landing page, not a functional app screen. `lenis` (smooth-scroll) is a homepage-only dependency — don't let it leak into the app bundle. |
| **Specular Button** | `ogl` | **New: marketing homepage**, primary CTA only ("Create an event" / hero button) | Reserve for 1–2 buttons max — it's a WebGL canvas per instance. Using it on every button in the app would mean dozens of live GL contexts on one page. |
| **Staggered Menu** | `gsap` | **Mobile navigation** (replaces a plain hamburger in the PWA shell) | Correct call as originally proposed — full-screen animated nav overlay is exactly a mobile pattern, ships with a socials section we can point at the GrantFox/Astrea GitHub. |
| **Dock** | `motion` | **Mobile bottom tab bar shape** — but see caveat below | See correction. |
| **Tilted Card** | `motion` | **Desktop-only**, one decorative spot on the homepage (e.g. a single hero visual), not in any core flow | See correction. |
| **Model Viewer** | `three` + `@react-three/fiber` + `@react-three/drei` | **Deferred / optional** — not scheduled in any current build-plan task | See caveat below. |

## Corrections to the original placement assumptions

**Dock is not a mobile-native interaction.** Its whole gimmick — icons magnifying as the cursor approaches (`distance`/`magnification` props) — is calculated from *mouse* proximity. There is no cursor on a touchscreen, so that effect simply never fires for PWA users on their phone; it would only animate for the rare desktop-browser visitor. What we *can* honestly reuse is the **static visual shape** — a floating rounded dock bar — as the bottom tab bar of the mobile PWA shell, with the magnification prop left at its resting state. That's a legitimate, good-looking mobile bottom nav; just don't expect the headline hover effect to be part of the mobile experience, because it structurally can't be.

**Tilted Card ships its own admission that it's a desktop pattern** — it has a `showMobileWarning` prop (on by default) that displays an alert about mobile usage, because the 3D tilt is driven by mouse position. Using it anywhere in the actual judge/participant flows (mobile-heavy) would mean most users see a warning label instead of the effect. Scoped to a single decorative use on the desktop marketing homepage only.

**Model Viewer is the heaviest item on this list by a wide margin** — three full Three.js-ecosystem packages, easily the largest JS payload of anything discussed here. There's no current product need for a literal 3D asset (no trophy model, no 3D collectible planned). Not scheduled in the build plan. If a future "trophy reveal" moment on the winner announcement is wanted, it should be its own explicitly-scoped task, dynamically imported (`next/dynamic`, `ssr: false`) so its dependency chain only loads on that one page — never bundled with the rest of the app.

## Build-plan cross-references

- `L00` (minimal shell) — ✅ Prism hero, confined to the right lane per the approved mockup (revised back from a Light Pillar detour), done
- `U01` (event wizard) — Stepper
- `U03` (public event page) — Border Glow
- New `U08` (marketing homepage) — Card Swap, Scroll Stack, Specular Button (hero background already exists from L00 — U08 adds sections around it, doesn't redo it; also where `SiteHeader`'s non-hero-page variant needs to be designed)
- Mobile PWA shell (part of `S05`/`U03` navigation work) — Staggered Menu, Dock (shape only)
