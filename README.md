# Portfolio Website — Build Specification & Developer Reference

A personal portfolio site built with **Next.js 14**, **React**, and **TypeScript**,
featuring a full-screen wallpaper system, animated "liquid glass" UI islands, and
three distinct pages: Bio, Photos, and Projects.

---

## Quick Start

```bash
npm install
npm run dev        # http://localhost:3000
npm run build
npm start
```

---

## File Structure

```
portfolio/
├── app/
│   ├── layout.tsx            # Root layout, Google Fonts import
│   ├── globals.css           # CSS reset, :root variables, global .glass utility class
│   ├── page.tsx              # Main page component — all core state and layout
│   ├── page.module.css       # Scoped styles for shell, wallpapers, central island,
│   │                         #   bio islands, code scroll container
│   ├── CodePage.tsx          # Projects page content component
│   └── CodePage.module.css   # Scoped styles for project sets and their animations
└── public/
    ├── bioWallpaper.png       # Full-screen background for Bio page
    ├── photosWallpaper.png    # Full-screen background for Photos page
    ├── codingWallpaper.png    # Full-screen background for Projects page
    └── horizontalPlaceholder.png  # 16:9 placeholder for project image cards
```

---

## Tech Stack

| Layer | Choice | Reason |
|-------|--------|--------|
| Framework | Next.js 14 (App Router) | File-based routing, SSR-ready, easy static export |
| Language | TypeScript | Type-safe state machines and component props |
| Styling | CSS Modules + one global stylesheet | Module scoping prevents class collisions; `.glass` is global because it is shared across components |
| Fonts | DM Mono (Google Fonts) | Used exclusively for all text site-wide |
| Animation | Pure CSS `@keyframes` + JS `setTimeout` state machine | No animation library dependency; precise control over animation/transition conflicts |
| Scroll reveal | `IntersectionObserver` API | Native, performant, no library needed |

---

## Global CSS Variables (`globals.css` `:root`)

| Variable | Value | Used For |
|----------|-------|----------|
| `--ease-out` | `cubic-bezier(0.22, 1, 0.36, 1)` | All glide and fly-in animations (expo-out: fast launch, long soft deceleration) |
| `--ease-spring` | `cubic-bezier(0.34, 1.4, 0.64, 1)` | Reserved; subtle overshoot easing |
| `--island-w` | `220px` | Fixed width of the central identity island |
| `--corner` | `26px` | Border-radius for all islands |
| `--font-mono` | `"DM Mono", "Courier New", monospace` | Applied to every text element site-wide |
| `--glass-blur` | `28px` | Reference value (actual blur set inline on `.glass`) |
| `--glass-saturate` | `2.0` | Reference value |

---

## The `.glass` Utility Class

Defined in `globals.css` (not a CSS Module) so it can be shared across `page.tsx`
and `CodePage.tsx` without import coupling.

### Why backdrop-filter must be on the animated element itself

After extensive iteration, the only reliable pattern for `backdrop-filter` to work
correctly throughout a CSS animation is:

> **`backdrop-filter` must be on the same element that has the CSS `transform`.**

When `backdrop-filter` is on a *child* of a transformed parent, the parent's active
`transform` creates a new compositing layer that isolates the child's backdrop
sampling region — so blur only appears once the animation ends and the parent's
transform resolves. This manifested as blur "popping in" after fly-in animations
finished.

The fix applied throughout the codebase:
- Bio islands: the `.bioIsland` element itself has both `.glass` and the animation class.
- Project caption cards: each child (`.mainIsland`, `.secIsland`) receives the
  animation class directly; the parent `.setWrap` has **no transform, no animation**.

### Why `overflow: hidden` and `clip-path` are not used for shaping

Two previous approaches that were tried and discarded:

**`clip-path: inset(0 round 26px)`** — Visually clips to a rounded rect without
`overflow: hidden`, which was intended to avoid stacking-context issues. However,
`clip-path` clips the *entire rendered output* of the element including its `border`
and `inset box-shadow`, destroying the bevel highlight.

**`overflow: hidden` + `backdrop-filter` on `::before`** — Keeps border/shadow
intact (border renders outside the overflow clip), but `overflow: hidden` combined
with a positioned child creates a new stacking context. `backdrop-filter` on a
pseudo-element inside that context samples from within the context's compositing
layer rather than the wallpaper behind the page, breaking blur during animations.

**Current approach** — `backdrop-filter` directly on `.glass` with only
`border-radius`. Per the CSS spec, browsers clip `backdrop-filter` to the element's
`border-radius` automatically, so no `overflow: hidden` or `clip-path` is needed for
shape. The border and inset shadows render normally.

### Glass appearance

```css
.glass {
  border-radius: 26px;
  backdrop-filter: blur(20px) saturate(1.8) brightness(1.06);
  background: linear-gradient(top-specular-glint) + rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.22);
  box-shadow:
    0 2px 0 rgba(255,255,255,0.26) inset,   /* top bevel highlight */
    0 -1px 0 rgba(255,255,255,0.08) inset,  /* bottom rim */
    0 20px 60px rgba(0,0,0,0.38),           /* depth shadow */
    0 2px 12px rgba(0,0,0,0.20);            /* near shadow */
}
.glass > * { position: relative; z-index: 1; }
```

The `glass > *` rule elevates all direct children above the `background` gradient
layer so text and UI elements are always readable.

### The animated glass ripple (SVG filter)

An inline SVG `<filter id="glass-warp">` in `page.tsx` defines a
`feTurbulence` + `feDisplacementMap` pipeline. A `useGlassRipple` hook drives the
animation via `requestAnimationFrame`:

```
baseFrequency traces a circular path in (fx, fy) space:
  fx = 0.013 + 0.003 × sin(angle)
  fy = 0.019 + 0.003 × cos(angle + 1.1)   ← phase-offset prevents in-sync pulsing
  angle = (Date.now() % 30000 / 30000) × 2π + phaseOffset
```

- **30-second seamless loop**: since `sin` and `cos` are periodic, the values at
  `angle = 0` and `angle = 2π` are identical → perfect loop, no visual seam.
- **Session-unique starting phase**: `phaseOffset = (Date.now() % periodMs / periodMs) × 2π`
  drops each page load into a random point in the 30-second cycle, making the loop
  imperceptible across sessions.
- **Constant speed**: position is derived from absolute wall-clock time, not frame
  deltas, so the ripple speed is invariant to frame rate.

*Note: the SVG filter is defined and the hook runs, but the `filter: url(#glass-warp)`
application was removed from the current glass implementation during a glass rewrite.
The hook infrastructure remains in place for future re-attachment.*

---

## Page System

### Sections

```typescript
type Section = "bio" | "photos" | "code";
```

The internal key for Projects is `"code"` (legacy from before the rename). The
display label is "Projects". This is intentional — renaming the key would require
touching every conditional in the codebase; the label is just the button text.

### Wallpapers

All three wallpapers are preloaded via `new Image()` before the shell becomes visible:

```typescript
useEffect(() => {
  let loaded = 0;
  Object.values(WALLS).forEach(src => {
    const img = new Image();
    img.onload = img.onerror = () => { if (++loaded === srcs.length) setWallReady(true); };
    img.src = src;
  });
}, []);
```

The `.shell` starts at `opacity: 0` and transitions to `opacity: 1` only after
`wallReady` is set. This prevents the flash-of-black that occurred when the active
wallpaper's `opacity` CSS transition fired before the image had loaded.

Wallpaper crossfade: three `position: absolute; inset: 0` divs are layered in
`.wallpaperWrap`. The active page's div gets `opacity: 1`; all others are `opacity: 0`.
CSS `transition: opacity 0.9s ease` handles the crossfade automatically.

---

## The Central Island

### Specification

- Circular profile picture placeholder (swap `avatarInner` background for a real `<img>`)
- Name (`.name`) — editable in JSX
- Pronouns (`.pronouns`) — editable in JSX
- Page-selector tab bar with three buttons: **Photos | Bio | Projects** (left to right)
  - Tab order was explicitly specified as Photos first, then Bio (default), then Projects
  - Bio is the default/selected tab on page load

### Positioning

`position: fixed; z-index: 100` — viewport-anchored, always above all content islands
at every scroll position.

| Page | CSS Class | Position |
|------|-----------|----------|
| Bio | `.centralBio` | `top: 50%; left: 50%; transform: translate(-50%, -50%)` — screen center |
| Photos | `.centralPhotos` | `top: 40px; left: 40px` — top-left corner |
| Projects | `.centralCode` | `top: 40px; left: calc(100vw - 220px - 40px)` — top-right corner |

All three positions use `left` exclusively. Mixing `left` and `right` breaks CSS
transitions because they are independent properties that cannot interpolate between
each other — switching from `left: 50%` to `right: 40px` caused an instantaneous
jump rather than a smooth glide.

### Entry animation (first load only)

A `centralFirst` boolean state controls a one-shot `@keyframes centralFloatIn`
animation: the island drops in from `top: -20%` to `top: 50%` with opacity 0→1.
After 2.4 seconds (matching animation duration + delay), `centralFirst` is set
`false` and the CSS transition system takes over for all subsequent movements.

`centralFirst` is also cleared immediately inside `navigate()` before any page
transition fires, preventing the entry animation from conflicting with
transition-driven movement.

---

## Bio Page Content Islands

### Layout

Two islands flanking the central island, positioned by the **rule of thirds**:

```
Left island center  = 25vw  →  left = 25vw - clamp(110px, 11vw, 150px)
Right island center = 75vw  →  left = 75vw - clamp(110px, 11vw, 150px)
```

The `clamp(110px, 11vw, 150px)` expression is exactly half of
`clamp(220px, 22vw, 300px)` (the island width), ensuring perfect centering at every
viewport width including when `min-width: 220px` or `max-width: 300px` clamps apply.

Islands are vertically centered (`top: 50%`) and taller than the central island
via larger vertical padding (`28px 22px 36px` vs `28px 24px 22px`).

### Animation state machine

```typescript
type IslandState = "entering" | "visible" | "exiting" | "hidden";
```

Transitions are driven by **pure `@keyframes` animations**, not CSS `transition`.
This was a deliberate choice after discovering that CSS `animation: fill-mode: both`
always wins over CSS `transition` in the cascade — when both were active
simultaneously, the animation's held final keyframe silently blocked the transition
from firing, breaking exit animations.

| State | CSS | Effect |
|-------|-----|--------|
| `hidden` | `.bioIsland_hidden` | `opacity: 0; pointer-events: none`; not rendered in DOM |
| `entering` | `.bioIsland_entering` | `animation: flyInLeft/Right 2s` |
| `visible` | `.bioIsland_visible` | `transform: translateY(-50%); opacity: 1` |
| `exiting` | `.bioIsland_exiting` | `animation: flyOutLeft/Right 1.2s forwards` |

`showBio = bioState !== "hidden"` — islands are only in the DOM when visible or
animating. When `hidden`, they are fully unmounted.

### Fly-in/out direction

- Left island: flies in from the left (translateX -180px → 0), exits to the left
- Right island: flies in from the right (translateX +180px → 0), exits to the right
- Islands **always start and end within the viewport** — the 180px offset keeps them
  over the wallpaper at all times, which is why `backdrop-filter` blur is present
  from the first frame of the animation

### Timer safety: the `pendingTimers` pattern

The bio island state machine schedules `setTimeout` calls to advance state
(e.g. `"entering"` → `"visible"` after 2.2s). A critical bug occurred when the user
navigated rapidly: a stale timer from a previous navigation fired and corrupted the
new navigation's state (e.g. setting `bioState = "hidden"` while islands were
mid-entry on the bio page, or setting `bioState = "visible"` on the Photos page).

Fix: every `setTimeout` ID is stored in `pendingTimers` ref. `cancelAll()` clears
all pending timers and is called at the **top of every `navigate()` invocation**.

```typescript
function navigate(next: Section) {
  if (next === activeRef.current) return;  // guard against same-destination clicks
  cancelAll();                             // kill all stale timers
  ...
}
```

Additionally, `activeRef` and `bioStateRef` mirror their React state counterparts
as `useRef` values. React state updates are asynchronous and captured values in
closures go stale between renders; refs always return the current value.

### Page transition choreography

**Leaving Bio → other page:**
- `setBio("exiting")` and `setActive(next)` fire simultaneously
- Wallpaper crossfade, central island glide, and bio island fly-out all start at the
  same moment
- Bio island exit animation is 1.2s (shorter than the 2s page transition)
- After 1.2s: `setBio("hidden")` — islands removed from DOM

**Arriving at Bio from another page:**
- `setActive("bio")` fires immediately (wallpaper starts crossfading)
- `setBio("entering")` fires immediately
- After 2.2s: `setBio("visible")`

**Interruption handling (clicking during an animation):**
- If leaving bio mid-entry: `cancelAll()` kills the 2.2s "visible" timer; `setBio("exiting")` starts exit correctly
- If returning to bio mid-exit: `cancelAll()` kills the 1.2s "hidden" timer; `setBio("entering")` restarts entry from the current visual position (CSS animation restarts cleanly on class swap)

---

## Photos Page

Currently contains no content islands — only the wallpaper and the central island
gliding to the top-left corner.

---

## Projects Page

### Architecture

```
.shell (position: fixed, overflow: hidden)
  └── .codeScroll (position: absolute, inset: 0, overflow-y: auto, z-index: 15)
        └── .codeContent (position: relative, min-height: 2200px)
              └── .setWrap × 8 (position: absolute, flex column)
                    ├── .mainIsland (image card)
                    └── .secIsland.glass (caption card)
```

`.codeScroll` is `position: absolute; inset: 0` inside the `position: fixed` `.shell`.
This makes it a fixed-size overlay that scrolls independently over the static wallpaper.
The central island (`position: fixed; z-index: 100`) floats above it at all times.

### Project sets

Each "set" consists of:
1. **Main island** (`.mainIsland`) — image card with a 16:9 placeholder image.
   Uses `overflow: hidden` to clip the image to `border-radius: 20px`. Does NOT use
   `backdrop-filter` because the image covers the entire background — frosting would
   be invisible.

2. **Caption card** (`.secIsland.glass`) — overlaps the bottom of the image card via
   `margin-top: -28px; z-index: 1`. Width is 72% of the set wrapper so the image
   peeks out to the side. Horizontal anchor (left / center / right) varies per set
   via `.secLeft`, `.secCenter`, `.secRight` (`align-self` + small margin).

   Contains:
   - Project title (uppercase mono, 0.72rem)
   - Caption / link placeholder text (smaller, low-opacity mono)

### Layout: balance and spread

All 8 sets use identical width: `clamp(240px, 26vw, 320px)`.

```
Island half-width ≈ 11vw

Left column  x ≈ 7–10vw   →  island center ≈ 18–21vw  (avg ~20vw)
Right column x ≈ 63–66vw  →  island center ≈ 74–77vw  (avg ~75.5vw)
Combined center of mass ≈ (20 + 75.5) / 2 = 47.75vw ≈ center  ✓
```

Section 1 right column (y < 300px) is kept at ≤63vw to avoid the fixed central
island's footprint at the top-right of the viewport.

Sets are staggered 150–250px vertically within each section (pairs are never at the
same y value), breaking any grid-row appearance.

### Scroll-triggered animations

Each `CodeSet` uses a `useScrollReveal` hook with `IntersectionObserver`:

```typescript
const io = new IntersectionObserver(callback, {
  root: scrollRoot.current,   // the .codeScroll div, not the viewport
  threshold: 0.10,            // fires when 10% of the set is visible
  rootMargin: "0px 0px -40px 0px"  // slight negative bottom margin
});
```

State machine: `hidden → entering → visible` on scroll-into-view;
`visible → exiting → hidden` on scroll-out-of-view.

Same `cancelTimers()` pattern as bio islands prevents stale callbacks from
corrupting state during rapid scrolling.

**Critical: why animation is on each child, not the wrapper**

When `translateX` is applied to `.setWrap` (the parent), its active CSS `transform`
creates a new compositing layer. The `.secIsland.glass` child's `backdrop-filter`
then samples from within that isolated layer (which is transparent) rather than from
the wallpaper behind the page — so blur only appeared once the animation ended.

Fix: `.setWrap` has **no animation, no transform**. The `flyIn/Out` animation class
is applied directly to `.mainIsland` and `.secIsland`, so `backdrop-filter` and
`transform` are on the same element — the pattern that works correctly.

---

## Customisation Guide

### Swap wallpapers

Replace `/public/bioWallpaper.png`, `/public/photosWallpaper.png`,
`/public/codingWallpaper.png` with your own images. Any format Next.js serves
statically works; PNG and JPEG are fine.

### Replace the profile picture

In `page.tsx`, swap the `<div className={styles.avatarInner} />` placeholder with:

```tsx
<img src="/your-photo.jpg" alt="Profile" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
```

### Edit name and pronouns

In `page.tsx`:
```tsx
<p className={styles.name}>Your Name</p>
<p className={styles.pronouns}>they / them</p>
```

### Edit bio content

Placeholder lorem ipsum is in `page.tsx` inside the left (About Me) and right
(Experience) bio island divs. Replace `<p className={styles.islandText}>` blocks
with real content. Add more `<p>` tags freely — islands grow vertically with content.

### Add / edit project sets

In `CodePage.tsx`, edit the `SETS` array:

```typescript
{ id: "s1", x: "8vw", y: 70, dir: "left", secAlign: "right", title: "My Project" }
```

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique React key |
| `x` | string | CSS `left` value (vw or px) |
| `y` | number | Pixels from top of scroll canvas |
| `dir` | `"left"` \| `"right"` | Which side the island flies in/out from |
| `secAlign` | `"left"` \| `"center"` \| `"right"` | Horizontal anchor of caption card under image |
| `title` | string | Project name shown in caption card |

Replace `/public/horizontalPlaceholder.png` with real project screenshots.
Each set uses the same image — per-project images require adding an `img` field to
`SETS` and passing it to the `<img>` tag in `CodePage.tsx`.

### Add a link to caption cards

In `CodePage.tsx`, replace the `projCaption` paragraph:

```tsx
<a href="https://github.com/you/project" className={styles.projCaption} target="_blank" rel="noopener">
  View on GitHub ↗
</a>
```

### Adjust transition speeds

All animation durations reference these constants:

| Location | Duration | What it controls |
|----------|----------|-----------------|
| `page.module.css` `.central` transition | `2s` | Central island glide between pages |
| `page.module.css` `@keyframes centralFloatIn` | `2s` | Central island drop-in on first load |
| `page.module.css` `.bioIsland_entering` animation | `2s` | Bio islands fly in |
| `page.module.css` `.bioIsland_exiting` animation | `1.2s` | Bio islands fly out |
| `page.tsx` `after(2200, ...)` | `2200ms` | Delay before bio state → "visible" |
| `page.tsx` `after(1200, ...)` | `1200ms` | Delay before bio state → "hidden" after exit |
| `CodePage.module.css` `.flyInLeft/Right` | `2s` | Project islands scroll-in |
| `CodePage.module.css` `.flyOutLeft/Right` | `1.2s` | Project islands scroll-out |

### Adjust island positions

**Bio islands** — edit `.bioLeft` and `.bioRight` in `page.module.css`.
The `25vw`/`75vw` values are the horizontal center targets; adjust them as needed.

**Project islands** — edit the `x` and `y` values in the `SETS` array in
`CodePage.tsx`. The `codeContent` div has `min-height: 2200px`; increase this if
you add more sets below y ≈ 1900px.

### Adjust the glass effect

In `globals.css`, the `.glass` rule controls all islands:

```css
backdrop-filter: blur(20px) saturate(1.8) brightness(1.06);
```

- Increase `blur()` for a more frosted look; decrease for more transparency
- Increase `saturate()` to make the wallpaper colours more vivid through the glass
- Adjust `rgba(255,255,255,0.06)` base tint for lighter/darker glass

The inset `box-shadow` `0 2px 0 rgba(255,255,255,0.26)` is the top bevel highlight;
adjust its opacity to make the rim more or less prominent.

---

## Known Design Decisions & Tradeoffs

**`:root` must not be in CSS Modules.** Next.js CSS Modules enforce "pure" selectors
(only locally-scoped class/id). `:root`, `html`, `body`, etc. belong in `globals.css`.
Attempting to use `:root` in a `.module.css` file throws a build error.

**`Section` key is `"code"`, display label is `"Projects"`.** The internal type
and all conditional branches use `"code"`; only the button label text reads
`"Projects"`. Renaming the key would require touching every switch/conditional.

**Bio islands are only in the DOM when visible or animating.** `showBio = bioState !== "hidden"`.
The `conditional && <JSX>` pattern means React mounts/unmounts them on each bio entry/exit.
This is intentional: it keeps the DOM clean and avoids invisible elements capturing pointer events.

**Project islands exist in the DOM only when on the Projects page.** The entire
`<CodePage />` component is conditionally rendered: `{active === "code" && <CodePage />}`.
`IntersectionObserver` instances are set up fresh on each mount.

**`html, body { overflow: hidden }`** is set in `globals.css` to prevent the document
from scrolling. All scrolling on the Projects page happens inside the `.codeScroll`
div (an independent `overflow-y: auto` container), not the document scroll.

**Wallpaper images are large.** The bio and photos wallpapers are 42MB and 36MB PNG
files respectively. For production, compress these to WebP or JPEG and add
`next/image` optimization. The current implementation uses plain `<img>`-equivalent
CSS `background-image` for simplicity.
