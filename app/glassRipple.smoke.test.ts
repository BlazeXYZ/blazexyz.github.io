/**
 * glassRipple.smoke.test.ts
 * ──────────────────────────────────────────────────────────────────────────────
 * SOURCE-level smoke tests for the glass-ripple removal + static #glass-warp
 * refraction (design "Glass-Ripple Resolution & Glass Refraction").
 *
 * These do not render anything; they parse the actual source files and assert
 * the structural facts the design guarantees:
 *
 *   • `page.tsx` no longer contains the `useGlassRipple` hook (Req 4.4) and runs
 *     no `requestAnimationFrame` loop driving the SVG `feTurbulence` filter
 *     (Req 4.1, 4.2) — i.e. no per-frame work without a visible result.
 *   • The `<filter id="glass-warp">` definition is RETAINED but STATIC: its
 *     `feTurbulence` carries a fixed `baseFrequency` with no JS mutating it.
 *   • Any retained `#glass-warp` usage targets a rendered NON-glass element:
 *     `Gallery.module.css` applies `filter: url(#glass-warp)` to `.mainIsland`,
 *     which carries NO `backdrop-filter` (and is not the `.glass` element)
 *     (Req 4.3, 9.5, 9.6).
 *
 * Feature: photos-page-and-content-templates
 * _Requirements: 4.1, 4.2, 4.4, 9.5, 9.6_
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const pageSrc = readFileSync(resolve(here, "page.tsx"), "utf8");
const rawModuleCss = readFileSync(resolve(here, "Gallery.module.css"), "utf8");

// Strip CSS comments so prose mentions of "backdrop-filter" / "url()" inside
// explanatory comments never trip the structural assertions below.
const moduleCss = rawModuleCss.replace(/\/\*[\s\S]*?\*\//g, "");

/**
 * Extract the declaration body of a single (non-nested) CSS rule by exact
 * selector. The stylesheet here contains no nested braces inside a rule, so a
 * `selector { ... }` match is sufficient. Returns "" when the selector is absent.
 */
function ruleBody(css: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(escaped + "\\s*\\{([^}]*)\\}");
  const m = css.match(re);
  return m ? m[1] : "";
}

// ── Req 4.4 — the dead useGlassRipple hook is gone ────────────
describe("ripple removal — useGlassRipple no longer exists (Req 4.4)", () => {
  it("page.tsx contains no `useGlassRipple` identifier (definition or call)", () => {
    expect(pageSrc).not.toMatch(/useGlassRipple/);
  });
});

// ── Req 4.1, 4.2 — no per-frame rAF loop driving feTurbulence ─
describe("ripple removal — no requestAnimationFrame drives feTurbulence (Req 4.1, 4.2)", () => {
  it("page.tsx runs no requestAnimationFrame loop at all", () => {
    expect(pageSrc).not.toMatch(/requestAnimationFrame/);
    expect(pageSrc).not.toMatch(/cancelAnimationFrame/);
  });

  it("page.tsx never mutates feTurbulence baseFrequency from JS", () => {
    // The static <feTurbulence baseFrequency="…"> markup is fine; what must NOT
    // exist is any JS that drives it per frame. Assert there is no DOM lookup of
    // the filter primitive and no programmatic mutation of baseFrequency.
    expect(pageSrc).not.toMatch(/getElementById\(["']glass-warp["']\)/);
    expect(pageSrc).not.toMatch(/querySelector[^)]*feTurbulence/i);
    expect(pageSrc).not.toMatch(/\.setAttribute\(\s*["']baseFrequency["']/i);
    expect(pageSrc).not.toMatch(/\.baseFrequency\s*=/);
    // No SVG <animate> driving the turbulence either.
    expect(pageSrc).not.toMatch(/<animate\b/);
  });
});

// ── #glass-warp filter is RETAINED but STATIC ────────────────
describe("ripple removal — #glass-warp filter is retained and static", () => {
  it("page.tsx still defines <filter id=\"glass-warp\"> with a feTurbulence + feDisplacementMap", () => {
    expect(pageSrc).toMatch(/id=["']glass-warp["']/);
    // The JSX markup for the static filter is retained.
    expect(pageSrc).toMatch(/<feTurbulence\b/);
    expect(pageSrc).toMatch(/<feDisplacementMap\b/);
  });

  it("the retained feTurbulence has a fixed baseFrequency attribute (no animation)", () => {
    // The static filter literally declares a fixed baseFrequency in markup …
    expect(pageSrc).toMatch(/<feTurbulence\b[^>]*baseFrequency=["'][^"']+["']/);
    // … and there is no SVG <animate> element animating it either.
    expect(pageSrc).not.toMatch(/<animate\b/);
  });
});

// ── Image card has NO displacement filter (clean rectangular edges) ──
describe("retained #glass-warp is not applied to image cards (clean edges)", () => {
  it("Gallery.module.css does NOT apply filter: url(#glass-warp) to .mainIsland", () => {
    const main = ruleBody(moduleCss, ".mainIsland");
    expect(main).not.toBe("");
    // The displacement filter warped the rectangular photo edges, so it is no
    // longer applied to the image card — edges stay crisp.
    expect(main).not.toMatch(/filter\s*:\s*url\(#glass-warp\)/);
  });

  it(".mainIsland carries NO backdrop-filter (so it is not a glass element)", () => {
    const main = ruleBody(moduleCss, ".mainIsland");
    expect(main).not.toMatch(/backdrop-filter\s*:/);
    // The glass caption (.secIsland) must NOT carry the displacement filter,
    // so the SVG filter and backdrop-filter never collide on one element.
    const sec = ruleBody(moduleCss, ".secIsland");
    expect(sec).not.toMatch(/url\(#glass-warp\)/);
  });

  it("the displacement filter is not applied to any glass element in the CSS (Req 9.6)", () => {
    // If #glass-warp is used at all, it must never live in a rule that also
    // declares backdrop-filter.
    expect(moduleCss).not.toMatch(/backdrop-filter[^}]*url\(#glass-warp\)/s);
    expect(moduleCss).not.toMatch(/url\(#glass-warp\)[^}]*backdrop-filter/s);
  });
});
