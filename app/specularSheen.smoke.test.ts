/**
 * specularSheen.smoke.test.ts
 * ──────────────────────────────────────────────────────────────────────────────
 * SOURCE-level smoke test for the refined specular sheen (design "Specular Sheen
 * & Scroll-Progress Affordance", Req 9.4).
 *
 * jsdom does not apply or compute CSS, so this test parses the actual
 * `app/globals.css` source and asserts the structural facts the design
 * guarantees:
 *
 *   • A `.glass::after` rule exists that renders the diagonal light streak:
 *     `content`, a `linear-gradient` background, `pointer-events: none`,
 *     `z-index: 0`, and `border-radius: inherit` — bounded by the element's own
 *     corners with NO `overflow: hidden` / `clip-path`.
 *   • The `.glass` rule still RETAINS its inset bevel highlight (a `box-shadow`
 *     containing `inset`) — i.e. the sheen was ADDED, not a replacement.
 *   • Neither `.glass` nor `.glass::after` uses `overflow: hidden` or
 *     `clip-path` (those would clip the border/bevel and break backdrop
 *     sampling).
 *
 * Feature: photos-page-and-content-templates
 * _Requirements: 9.4_
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const rawCss = readFileSync(resolve(here, "globals.css"), "utf8");

// Strip CSS comments so prose mentions (e.g. "overflow:hidden" / "clip-path"
// described in explanatory comments) never trip the structural assertions.
const css = rawCss.replace(/\/\*[\s\S]*?\*\//g, "");

/**
 * Extract the declaration body of a CSS rule by exact selector. `.glass`'s body
 * contains nested parentheses (gradients, shadows) but no nested braces, so a
 * balanced-brace scan from the selector to its matching `}` is robust even when
 * values span multiple lines. Returns "" when the selector is absent.
 *
 * Matching is anchored so `.glass` does not also match `.glass::after` /
 * `.glass > *`: we require the selector to be followed by optional whitespace
 * and then the opening brace.
 */
function ruleBody(source: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // selector must be followed (after optional whitespace) directly by `{`,
  // so `.glass` won't swallow `.glass::after`.
  const re = new RegExp(escaped + "\\s*\\{");
  const m = re.exec(source);
  if (!m) return "";
  const start = m.index + m[0].length;
  let depth = 1;
  for (let i = start; i < source.length; i++) {
    const ch = source[i];
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return source.slice(start, i);
    }
  }
  return "";
}

const glassBody = ruleBody(css, ".glass");
const afterBody = ruleBody(css, ".glass::after");

// ── Req 9.4 — the specular sheen pseudo-element exists ────────
describe("specular sheen — .glass::after light streak (Req 9.4)", () => {
  it("defines a .glass::after rule", () => {
    expect(afterBody).not.toBe("");
  });

  it("renders a pseudo-element via `content`", () => {
    expect(afterBody).toMatch(/content\s*:/);
  });

  it("draws a diagonal light streak with a linear-gradient background", () => {
    expect(afterBody).toMatch(/background\s*:[^;]*linear-gradient\s*\(/);
  });

  it("is inert (pointer-events: none)", () => {
    expect(afterBody).toMatch(/pointer-events\s*:\s*none/);
  });

  it("sits under the content layer (z-index: 0)", () => {
    expect(afterBody).toMatch(/z-index\s*:\s*0\b/);
  });

  it("is bounded by the glass corners (border-radius: inherit) — not clipped by overflow/clip-path", () => {
    expect(afterBody).toMatch(/border-radius\s*:\s*inherit/);
    expect(afterBody).not.toMatch(/overflow\s*:\s*hidden/);
    expect(afterBody).not.toMatch(/clip-path\s*:/);
  });
});

// ── Req 9.4 — the inset bevel highlight is PRESERVED, not replaced ──
describe("specular sheen — inset bevel highlight retained (Req 9.4)", () => {
  it(".glass still declares a box-shadow with an `inset` highlight", () => {
    expect(glassBody).not.toBe("");
    expect(glassBody).toMatch(/box-shadow\s*:[\s\S]*\binset\b/);
  });

  it(".glass does not use overflow: hidden or clip-path (border + bevel preserved)", () => {
    expect(glassBody).not.toMatch(/overflow\s*:\s*hidden/);
    expect(glassBody).not.toMatch(/clip-path\s*:/);
  });
});
