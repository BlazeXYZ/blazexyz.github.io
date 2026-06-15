/**
 * Gallery.transform.test.tsx
 * ──────────────────────────────────────────────────────────────────────────────
 * Example (non-property) tests for the TRANSFORM-COMPOSITION strategy
 * (design "Transform Composition Strategy").
 *
 * Two transform-related sources must coexist on the single `.secIsland.glass`
 * caption element (which also carries `backdrop-filter`), without any of them
 * landing on a transformed ancestor (which would re-isolate the backdrop):
 *   - fly-in/out  → `@keyframes` on `transform` (only while entering/exiting)
 *   - idle float  → `@keyframes` on the INDEPENDENT `translate` property
 *
 * jsdom does NOT apply CSS-module styles, so the CSS-level guarantees are verified
 * by PARSING the CSS source (`Gallery.module.css`); the composition invariant
 * (wrapper stays transform-free) is additionally confirmed structurally by
 * rendering `Gallery` and asserting no animation token lands on the `.setWrap`
 * wrapper.
 *
 * Feature: photos-page-and-content-templates
 * _Requirements: 9.2, 9.3_
 */

import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import Gallery from "./Gallery";
import { PHOTO_SETS } from "./galleryData";

afterEach(cleanup);

// ── CSS source helpers ────────────────────────────────────────
const here = dirname(fileURLToPath(import.meta.url));
const moduleCss = readFileSync(resolve(here, "Gallery.module.css"), "utf8");

/**
 * Extract the declaration body of a single (non-nested) CSS rule by exact
 * selector. Adequate for flat rules like `.resting { ... }` / `.setWrap { ... }`
 * (no nested braces). Returns "" when the selector is absent.
 */
function ruleBody(css: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(escaped + "\\s*\\{([^}]*)\\}");
  const m = css.match(re);
  return m ? m[1] : "";
}

/**
 * Extract the full body of an `@keyframes <name>` block, including the nested
 * keyframe selector braces (`0%, 100% { ... } 50% { ... }`). Walks braces from
 * the `@keyframes` declaration to its matching close. Returns "" when absent.
 */
function keyframesBody(css: string, name: string): string {
  const head = css.indexOf("@keyframes " + name);
  if (head === -1) return "";
  const open = css.indexOf("{", head);
  if (open === -1) return "";
  let depth = 0;
  for (let i = open; i < css.length; i++) {
    if (css[i] === "{") depth++;
    else if (css[i] === "}") {
      depth--;
      if (depth === 0) return css.slice(open + 1, i);
    }
  }
  return "";
}

// A scrollRoot whose `.current` is null — useScrollReveal early-returns, so the
// islands stay in their initial "hidden" state (no IntersectionObserver needed).
const nullScrollRoot = { current: null };

// ── Req 9.2 — idle float animates `translate`, NOT `transform` ─────────────────
describe("idle float animates `translate` (not `transform`) on resting islands (Req 9.2)", () => {
  it("the idleFloat keyframes change `translate` and never set `transform`", () => {
    const kf = keyframesBody(moduleCss, "idleFloat");
    expect(kf).not.toBe("");

    // Drives the INDEPENDENT `translate` property …
    expect(kf).toMatch(/translate\s*:/);
    // … and the offset actually changes (0 0 → 0 -7px), i.e. it is a real float.
    expect(kf).toMatch(/translate\s*:\s*0\s+-?\d/);
    // … and NEVER writes `transform` (kept on the independent `translate` axis).
    expect(kf).not.toMatch(/transform\s*:/);
  });

  it("the resting glass caption runs the idleFloat animation", () => {
    const resting = ruleBody(moduleCss, ".resting");
    expect(resting).not.toBe("");
    expect(resting).toMatch(/animation\s*:[^;]*idleFloat/);
  });
});

// ── Req 9.3 — composition invariant: transform sources on the glass element ────
describe("transform sources live on the glass caption element, wrapper stays transform-free (Req 9.3)", () => {
  it("the resting glass caption owns the idle-float `translate` and no `transform`", () => {
    const resting = ruleBody(moduleCss, ".resting");
    expect(resting).not.toBe("");

    // Idle float lives on the independent `translate` property; with parallax
    // removed, the resting state declares no `transform` of its own.
    expect(resting).toMatch(/translate\s*:/);
    expect(resting).not.toMatch(/transform\s*:/);
  });

  it("the `.setWrap` wrapper carries NO transform and NO animation", () => {
    const setWrap = ruleBody(moduleCss, ".setWrap");
    expect(setWrap).not.toBe("");

    // Keeping the wrapper transform-free is what lets the children's
    // backdrop-filter keep sampling the wallpaper throughout the animation.
    expect(setWrap).not.toMatch(/transform\s*:/);
    expect(setWrap).not.toMatch(/translate\s*:/);
    expect(setWrap).not.toMatch(/animation\s*:/);
  });

  it("the fly-in/out keyframes own `transform` (the resting state leaves it unset)", () => {
    // Fly owns `transform` only while entering/exiting; at rest nothing sets it.
    for (const name of ["flyInLeft", "flyInRight", "flyOutLeft", "flyOutRight"]) {
      const kf = keyframesBody(moduleCss, name);
      expect(kf, `@keyframes ${name}`).not.toBe("");
      expect(kf, `@keyframes ${name}`).toMatch(/transform\s*:/);
    }
  });

  it("structurally, no animation token lands on the `.setWrap` wrapper element", () => {
    const { container } = render(
      <Gallery sets={PHOTO_SETS} scrollRoot={nullScrollRoot} />
    );

    const wrappers = container.querySelectorAll(`.${"setWrap"}`);
    // The CSS-module class is hashed in real builds, but the structural intent is
    // the same: the wrapper must never receive any animation/transform class. We
    // assert via the rendered class list of the positioning wrappers (the direct
    // children of the gallery canvas).
    const canvas = container.firstElementChild!;
    // Only the island positioning wrappers are relevant here. The canvas may
    // also contain non-wrapper elements (e.g. the scroll-progress bar), which
    // have no `.glass` descendant and must be excluded.
    const positioningWrappers = Array.from(canvas.children).filter(
      (child) => child.querySelector(".glass") !== null
    );
    expect(positioningWrappers.length).toBe(PHOTO_SETS.length);

    const animTokens = [
      "resting",
      "idleFloat",
      "flyInLeft",
      "flyInRight",
      "flyOutLeft",
      "flyOutRight",
    ];
    for (const wrap of positioningWrappers) {
      const cls = wrap.className;
      for (const token of animTokens) {
        expect(cls.includes(token), `wrapper className "${cls}"`).toBe(false);
      }
      // The animation token instead lives on the inner glass caption child.
      const glass = wrap.querySelector(".glass");
      expect(glass).not.toBeNull();
    }
    // Silence unused-variable lint if the hashed-class query returns nothing.
    void wrappers;
  });
});
