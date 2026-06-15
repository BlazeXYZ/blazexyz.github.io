/**
 * wallpaper.smoke.test.ts
 * ──────────────────────────────────────────────────────────────────────────────
 * SOURCE / filesystem-level smoke tests for the wallpaper assets.
 *
 * The site serves the OPTIMIZED, web-friendly wallpaper WebPs produced by
 * `scripts/optimize-wallpapers.mjs`. These tests do not render anything; they
 * inspect the real asset files on disk and parse the actual source files to
 * assert the structural facts that must hold:
 *
 *   • The optimized wallpaper WebPs are served from `public/` (Req 3.3, 3.4).
 *   • `WALLS` in `page.tsx` and the `.wallBio/.wallPhotos/.wallCode`
 *     `background-image` rules reference those `.webp` assets (Req 3.3, 3.4).
 *   • The `wallReady` shell-opacity gate (flash-of-black prevention) and the
 *     0.9 s wallpaper crossfade still operate on `WALLS` (Req 3.5, 3.7).
 *
 * Feature: photos-page-and-content-templates
 * _Requirements: 3.3, 3.4, 3.5, 3.7_
 */

import { describe, it, expect } from "vitest";
import { readFileSync, statSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const publicDir = resolve(here, "..", "public");

// The three wallpapers, served optimized from public/.
const WALLPAPERS = [
  "bioWallpaper.webp",
  "photosWallpaper.webp",
  "codingWallpaper.webp",
] as const;

const pageSrc = readFileSync(resolve(here, "page.tsx"), "utf8");
const rawPageCss = readFileSync(resolve(here, "page.module.css"), "utf8");
// Strip CSS comments so prose mentions inside explanatory comments never trip
// the structural assertions below.
const pageCss = rawPageCss.replace(/\/\*[\s\S]*?\*\//g, "");

/**
 * Extract the declaration body of a single (non-nested) CSS rule by exact
 * selector. Returns "" when the selector is absent.
 */
function ruleBody(css: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(escaped + "\\s*\\{([^}]*)\\}");
  const m = css.match(re);
  return m ? m[1] : "";
}

// ── Req 3.3, 3.4 — optimized wallpaper WebPs are served from public/ ──
describe("wallpapers — optimized WebPs served from public/ (Req 3.3, 3.4)", () => {
  for (const webp of WALLPAPERS) {
    it(`public/${webp} exists and is non-empty`, () => {
      const p = resolve(publicDir, webp);
      expect(existsSync(p)).toBe(true);
      expect(statSync(p).isFile()).toBe(true);
      expect(statSync(p).size).toBeGreaterThan(0);
    });
  }
});

// ── Req 3.3, 3.4 — WALLS + background-image reference the .webp assets ──
describe("wallpapers — WALLS and CSS reference the optimized .webp assets (Req 3.3, 3.4)", () => {
  it("every WALLS value in page.tsx ends in .webp", () => {
    // Grab the WALLS object literal body.
    const m = pageSrc.match(/WALLS[^=]*=\s*\{([\s\S]*?)\}/);
    expect(m).not.toBeNull();
    const body = m![1];
    // Collect every string literal value in the map.
    const values = [...body.matchAll(/["']([^"']+)["']/g)].map((x) => x[1]);
    // There should be exactly one per section.
    expect(values.length).toBe(WALLPAPERS.length);
    for (const v of values) {
      expect(v).toMatch(/Wallpaper\.webp$/);
    }
  });

  it("the .webp paths in WALLS match the three wallpaper assets", () => {
    for (const webp of WALLPAPERS) {
      expect(pageSrc).toMatch(new RegExp(`/${webp.replace(".", "\\.")}`));
    }
  });

  it(".wallBio / .wallPhotos / .wallCode background-image rules use the .webp assets", () => {
    for (const sel of [".wallBio", ".wallPhotos", ".wallCode"]) {
      const body = ruleBody(pageCss, sel);
      expect(body).not.toBe("");
      expect(body).toMatch(/background-image\s*:\s*url\(['"]?\/[^)]*Wallpaper\.webp['"]?\)/);
    }
  });
});

// ── Req 3.5 — wallReady shell-opacity gate (flash-of-black) ──
describe("flash-of-black prevention — wallReady shell gate preserved (Req 3.5)", () => {
  it("page.tsx preloads wallpapers with new Image() driven by WALLS", () => {
    expect(pageSrc).toMatch(/new Image\(\)/);
    // The preload iterates over the WALLS values.
    expect(pageSrc).toMatch(/Object\.values\(WALLS\)/);
  });

  it("preload onload/onerror both resolve the ready gate via setWallReady(true)", () => {
    // onload and onerror are wired to the same handler.
    expect(pageSrc).toMatch(/onload\s*=\s*img\.onerror/);
    // The handler increments a counter and flips the ready flag when complete.
    expect(pageSrc).toMatch(/\+\+loaded/);
    expect(pageSrc).toMatch(/setWallReady\(true\)/);
  });

  it("the shell applies the shellReady class gated on wallReady", () => {
    expect(pageSrc).toMatch(/wallReady\s*\?\s*styles\.shellReady/);
  });

  it(".shell starts at opacity:0 with a 0.9s opacity transition and .shellReady sets opacity:1", () => {
    const shell = ruleBody(pageCss, ".shell");
    expect(shell).toMatch(/opacity\s*:\s*0\b/);
    expect(shell).toMatch(/transition\s*:\s*opacity\s+0\.9s/);
    const ready = ruleBody(pageCss, ".shellReady");
    expect(ready).toMatch(/opacity\s*:\s*1\b/);
  });
});

// ── Req 3.7 — 0.9s wallpaper crossfade preserved ────────────
describe("wallpaper crossfade — 0.9s opacity transition preserved (Req 3.7)", () => {
  it(".wallpaper crossfades with a 0.9s opacity transition", () => {
    const wp = ruleBody(pageCss, ".wallpaper");
    expect(wp).toMatch(/opacity\s*:\s*0\b/);
    expect(wp).toMatch(/transition\s*:\s*opacity\s+0\.9s/);
  });

  it(".wallActive raises opacity to 1 to drive the crossfade", () => {
    const active = ruleBody(pageCss, ".wallActive");
    expect(active).toMatch(/opacity\s*:\s*1\b/);
  });
});
