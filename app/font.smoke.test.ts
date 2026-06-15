/**
 * font.smoke.test.ts
 * ──────────────────────────────────────────────────────────────────────────────
 * SOURCE-level smoke tests for the site-wide font correction (design
 * "next/font for DM Mono").
 *
 * These do not render anything; they parse the actual source files and assert
 * the structural facts the design guarantees:
 *
 *   • `layout.tsx` loads ONLY DM Mono through `next/font/google`, exposing the
 *     `--font-mono` CSS variable, and references NO Cormorant Garamond and NO
 *     hand-written Google Fonts <link>/preconnect (Req 5.2, 5.3).
 *   • `globals.css` sets the document `body` font-family to the DM Mono stack
 *     via `var(--font-mono)` with the documented monospace fallback
 *     ("Courier New", monospace) and references no Cormorant (Req 5.1, 5.4, 5.5).
 *   • Island text classes resolve to the DM Mono stack via `var(--font-mono)`
 *     (Req 7.4) and Cormorant Garamond appears nowhere in app source (Req 5.3).
 *
 * Feature: photos-page-and-content-templates
 * _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 7.4_
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));

const layoutSrc = readFileSync(resolve(here, "layout.tsx"), "utf8");
const globalsCss = readFileSync(resolve(here, "globals.css"), "utf8");
const pageModuleCss = readFileSync(resolve(here, "page.module.css"), "utf8");
const galleryModuleCss = readFileSync(resolve(here, "Gallery.module.css"), "utf8");

/**
 * Extract the declaration body of a single (non-nested) CSS rule by exact
 * selector. The stylesheets here contain no nested braces inside a rule, so a
 * `selector { ... }` match is sufficient. Returns "" when the selector is absent.
 */
function ruleBody(css: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // Require the selector to start a rule (preceded by `}`/`;`/`{`/newline or
  // start of file) so `body` does not match inside the `html, body { … }` list.
  const re = new RegExp("(?:[}\\n;{]|^)\\s*" + escaped + "\\s*\\{([^}]*)\\}");
  const m = css.match(re);
  return m ? m[1] : "";
}

// ── Req 5.2 — DM Mono is loaded via next/font/google ──────────
describe("font correction — DM Mono is loaded (Req 5.2)", () => {
  it("layout.tsx imports DM_Mono from next/font/google", () => {
    expect(layoutSrc).toMatch(/import\s*\{\s*DM_Mono\s*\}\s*from\s*["']next\/font\/google["']/);
  });

  it("layout.tsx invokes DM_Mono and exposes the --font-mono CSS variable", () => {
    expect(layoutSrc).toMatch(/DM_Mono\s*\(/);
    expect(layoutSrc).toMatch(/variable\s*:\s*["']--font-mono["']/);
  });

  it("layout.tsx applies the font variable class to the document <html>", () => {
    // The DM_Mono(...) result is destructured/assigned and its `.variable`
    // class is applied to <html>, so the variable is available site-wide.
    expect(layoutSrc).toMatch(/className=\{[^}]*\.variable/);
  });
});

// ── Req 5.3 — Cormorant Garamond is gone & no Google Fonts link ─
describe("font correction — Cormorant Garamond fully removed (Req 5.3)", () => {
  it("layout.tsx references no Cormorant font", () => {
    expect(layoutSrc).not.toMatch(/Cormorant/i);
  });

  it("layout.tsx has no hand-written Google Fonts <link> or preconnect", () => {
    expect(layoutSrc).not.toMatch(/<link\b/i);
    expect(layoutSrc).not.toMatch(/fonts\.googleapis\.com/i);
    expect(layoutSrc).not.toMatch(/fonts\.gstatic\.com/i);
    expect(layoutSrc).not.toMatch(/preconnect/i);
  });

  it("no app stylesheet references Cormorant anywhere", () => {
    expect(globalsCss).not.toMatch(/Cormorant/i);
    expect(pageModuleCss).not.toMatch(/Cormorant/i);
    expect(galleryModuleCss).not.toMatch(/Cormorant/i);
  });
});

// ── Req 5.1, 5.4, 5.5 — body resolves to DM Mono w/ mono fallback ─
describe("font correction — body text resolves to the DM Mono stack (Req 5.1, 5.4, 5.5)", () => {
  const body = ruleBody(globalsCss, "body");

  it("globals.css defines a body rule with a font-family", () => {
    expect(body).not.toBe("");
    expect(body).toMatch(/font-family\s*:/);
  });

  it("body font-family uses var(--font-mono) as the primary family (Req 5.1, 5.4)", () => {
    expect(body).toMatch(/font-family\s*:[^;]*var\(--font-mono\)/);
  });

  it("body font-family includes the documented monospace fallback (Req 5.5)", () => {
    const fam = body.match(/font-family\s*:([^;]*);/);
    expect(fam).not.toBeNull();
    const stack = fam![1];
    expect(stack).toMatch(/"Courier New"/);
    expect(stack).toMatch(/monospace/);
  });
});

// ── Req 7.4 — island text resolves to the DM Mono stack ───────
describe("font correction — island text uses the DM Mono stack (Req 7.4)", () => {
  // Gallery caption-card text (Photos + Projects islands).
  it("Gallery caption title/caption use var(--font-mono)", () => {
    expect(ruleBody(galleryModuleCss, ".projTitle")).toMatch(/font-family\s*:\s*var\(--font-mono\)/);
    expect(ruleBody(galleryModuleCss, ".projCaption")).toMatch(/font-family\s*:\s*var\(--font-mono\)/);
  });

  // Central island + bio island text.
  it("central island name/pronouns/tabs use var(--font-mono)", () => {
    expect(ruleBody(pageModuleCss, ".name")).toMatch(/font-family\s*:\s*var\(--font-mono\)/);
    expect(ruleBody(pageModuleCss, ".pronouns")).toMatch(/font-family\s*:\s*var\(--font-mono\)/);
    expect(ruleBody(pageModuleCss, ".tab")).toMatch(/font-family\s*:\s*var\(--font-mono\)/);
  });

  it("bio island heading/text use var(--font-mono)", () => {
    expect(ruleBody(pageModuleCss, ".islandHeading")).toMatch(/font-family\s*:\s*var\(--font-mono\)/);
    expect(ruleBody(pageModuleCss, ".islandText")).toMatch(/font-family\s*:\s*var\(--font-mono\)/);
  });
});
