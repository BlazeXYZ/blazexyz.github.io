/**
 * reducedMotion.smoke.test.ts
 * ──────────────────────────────────────────────────────────────────────────────
 * SOURCE / filesystem-level smoke tests for the reduced-motion CSS layer
 * (design "Reduced-Motion Accessibility Mode").
 *
 * jsdom does not apply CSS or evaluate media queries, so these tests parse the
 * real `Gallery.module.css` and `page.module.css` source files, extract the
 * `@media (prefers-reduced-motion: reduce)` block(s) with a balanced-brace
 * scanner, and assert the structural facts the design guarantees:
 *
 *   • Reduced motion disables the fly-in/out, idle-float, parallax resting
 *     transform, and the static glass-refraction filter, while every island
 *     stays visible/readable (opacity:1) (Req 10.1, 10.2).
 *   • The scroll-progress affordance renders without motion (Req 10.3).
 *   • The wallpaper crossfade is reduced to a minimal/instant change while the
 *     `.shell` flash-of-black opacity gate (opacity:0 base + `.shellReady`
 *     opacity:1 on `wallReady`) is preserved — the reduced-motion block must
 *     NOT set `.shell` opacity:1 unconditionally (Req 10.4).
 *
 * Feature: photos-page-and-content-templates
 * _Requirements: 10.1, 10.2, 10.3, 10.4_
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));

const galleryCss = readFileSync(resolve(here, "Gallery.module.css"), "utf8");
const pageCss = readFileSync(resolve(here, "page.module.css"), "utf8");

/**
 * Extract the body of every `@media (prefers-reduced-motion: reduce)` block in
 * `css`, scanning with a balanced-brace counter so nested rule blocks inside
 * the media block are captured in full. Returns the concatenated bodies.
 */
function reducedMotionBlocks(css: string): string {
  const re = /@media\s*\(\s*prefers-reduced-motion\s*:\s*reduce\s*\)\s*\{/g;
  const bodies: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(css)) !== null) {
    let depth = 1;
    let i = m.index + m[0].length;
    const start = i;
    while (i < css.length && depth > 0) {
      const ch = css[i];
      if (ch === "{") depth++;
      else if (ch === "}") depth--;
      i++;
    }
    // i is one past the closing brace; exclude that brace from the body.
    bodies.push(css.slice(start, i - 1));
  }
  return bodies.join("\n");
}

/**
 * Extract the declaration body of a single (non-nested) CSS rule by exact
 * selector within `css`. Returns "" when the selector is absent.
 */
function ruleBody(css: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(escaped + "\\s*\\{([^}]*)\\}");
  const m = css.match(re);
  return m ? m[1] : "";
}

/**
 * Pull the declaration body of a nested rule (matching `selectorContains`) from
 * an already-extracted block of CSS that may itself contain rule blocks. Used
 * to inspect individual selectors inside the reduced-motion media block.
 */
function nestedRuleBody(block: string, selectorContains: string): string {
  const escaped = selectorContains.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // Match a selector list containing `selectorContains` up to its `{ ... }`.
  const re = new RegExp("([^{}]*" + escaped + "[^{}]*)\\{([^{}]*)\\}");
  const m = block.match(re);
  return m ? m[2] : "";
}

const galleryRM = reducedMotionBlocks(galleryCss);
const pageRM = reducedMotionBlocks(pageCss);

// ── Sanity: both files declare a reduced-motion block ──
describe("reduced-motion — blocks are present (Req 10.1)", () => {
  it("Gallery.module.css has a prefers-reduced-motion: reduce block", () => {
    expect(galleryRM.trim().length).toBeGreaterThan(0);
  });

  it("page.module.css has a prefers-reduced-motion: reduce block", () => {
    expect(pageRM.trim().length).toBeGreaterThan(0);
  });
});

// ── Req 10.1, 10.2 — Gallery: fly / idle / parallax / refraction off, content visible ──
describe("reduced-motion — Gallery islands lose motion but stay visible (Req 10.1, 10.2)", () => {
  it("fly-in/out classes have animation:none with content visible (opacity:1)", () => {
    const fly = nestedRuleBody(galleryRM, ".flyInLeft");
    // The fly selector list groups flyInLeft/Right + flyOutLeft/Right together.
    expect(galleryRM).toMatch(/\.flyInLeft/);
    expect(galleryRM).toMatch(/\.flyInRight/);
    expect(galleryRM).toMatch(/\.flyOutLeft/);
    expect(galleryRM).toMatch(/\.flyOutRight/);
    expect(fly).toMatch(/animation\s*:\s*none/);
    expect(fly).toMatch(/opacity\s*:\s*1\b/);
  });

  it(".resting disables idle float + parallax (animation/transform/translate none) and stays visible", () => {
    const resting = nestedRuleBody(galleryRM, ".resting");
    expect(resting).toMatch(/animation\s*:\s*none/);
    expect(resting).toMatch(/transform\s*:\s*none/);
    expect(resting).toMatch(/translate\s*:\s*none/);
    expect(resting).toMatch(/opacity\s*:\s*1\b/);
  });

  it(".mainIsland drops the static glass-refraction filter (filter:none)", () => {
    const main = nestedRuleBody(galleryRM, ".mainIsland");
    expect(main).toMatch(/filter\s*:\s*none/);
  });
});

// ── Req 10.3 — scroll-progress affordance renders without motion ──
describe("reduced-motion — scroll-progress affordance has no motion (Req 10.3)", () => {
  it(".scrollProgress transition is disabled (transition:none)", () => {
    const sp = nestedRuleBody(galleryRM, ".scrollProgress");
    expect(sp).toMatch(/transition\s*:\s*none/);
  });
});

// ── Req 10.1 — page.tsx bio islands + central island lose sweeping motion, stay visible ──
describe("reduced-motion — page bio + central island motion neutralized (Req 10.1, 10.2)", () => {
  it("bio fly entering/exiting have animation:none and remain visible (opacity:1)", () => {
    expect(pageRM).toMatch(/bioIsland_entering/);
    expect(pageRM).toMatch(/bioIsland_exiting/);
    const bio = nestedRuleBody(pageRM, "bioIsland_entering");
    expect(bio).toMatch(/animation\s*:\s*none/);
    expect(bio).toMatch(/opacity\s*:\s*1\b/);
  });

  it(".centralFirst entry animation is removed (animation:none)", () => {
    const cf = nestedRuleBody(pageRM, ".centralFirst");
    expect(cf).toMatch(/animation\s*:\s*none/);
  });

  it(".central repositioning transition is made instant/none (transition:none)", () => {
    const c = nestedRuleBody(pageRM, ".central");
    expect(c).toMatch(/transition\s*:\s*none/);
  });
});

// ── Req 10.4 — wallpaper transition reduced, flash-of-black gate preserved ──
describe("reduced-motion — wallpaper transition reduced, shell gate preserved (Req 10.4)", () => {
  it(".wallpaper crossfade is reduced to a minimal/instant transition", () => {
    const wp = nestedRuleBody(pageRM, ".wallpaper");
    // A short duration like 0.01s indicates the crossfade is effectively instant.
    expect(wp).toMatch(/transition\s*:\s*opacity\s+0\.0\d+s/);
  });

  it("the reduced-motion block does NOT unconditionally force .shell opacity:1 (gate intact)", () => {
    const shellInRM = nestedRuleBody(pageRM, ".shell");
    // The block may shorten the shell fade, but must never set opacity:1, which
    // would defeat the wallReady flash-of-black gate.
    expect(shellInRM).not.toMatch(/opacity\s*:\s*1\b/);
  });

  it("the base .shell rule still establishes the opacity:0 gate outside the media block", () => {
    const shellBase = ruleBody(pageCss, ".shell");
    expect(shellBase).toMatch(/opacity\s*:\s*0\b/);
  });

  it(".shellReady still exists with opacity:1, completing the wallReady gate", () => {
    const ready = ruleBody(pageCss, ".shellReady");
    expect(ready).toMatch(/opacity\s*:\s*1\b/);
  });
});
