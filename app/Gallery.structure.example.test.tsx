/**
 * Gallery.structure.example.test.tsx
 * ──────────────────────────────────────────────────────────────────────────────
 * Example (non-property) STRUCTURAL tests for `GallerySetView` (tested through the
 * default `Gallery` export, since `GallerySetView` is internal).
 *
 * jsdom does NOT apply real CSS from CSS Modules / globals, so these tests verify
 * correctness in two complementary ways:
 *   1. STRUCTURE — render `Gallery` and assert the class assignment / DOM shape
 *      (e.g. the glass caption card and the image card are distinct elements, the
 *      glass element never receives the overflow:hidden image-card class, an empty
 *      template renders zero islands).
 *   2. STYLE RULES — parse the actual CSS source (`Gallery.module.css`,
 *      `globals.css`) and assert the documented rules hold (border-radius shaping
 *      without overflow:hidden / clip-path on the glass element; border + inset
 *      bevel on both the image card and the caption card).
 *
 * Feature: photos-page-and-content-templates
 * _Requirements: 7.1, 7.2, 7.3_
 */

import { describe, it, expect } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import Gallery from "./Gallery";
import { PHOTO_SETS, type GallerySet } from "./galleryData";

afterEach(cleanup);

// ── CSS source helpers ────────────────────────────────────────
const here = dirname(fileURLToPath(import.meta.url));
const moduleCss = readFileSync(resolve(here, "Gallery.module.css"), "utf8");
const globalsCss = readFileSync(resolve(here, "globals.css"), "utf8");

/**
 * Extract the declaration body of a single (non-nested) CSS rule by exact
 * selector. The stylesheets here contain no nested braces inside a rule, so a
 * `selector { ... }` match is sufficient. Returns "" when the selector is absent.
 */
function ruleBody(css: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(escaped + "\\s*\\{([^}]*)\\}");
  const m = css.match(re);
  return m ? m[1] : "";
}

// A scrollRoot whose `.current` is null — useScrollReveal's effect early-returns
// (no IntersectionObserver wiring needed for static structural assertions).
const nullScrollRoot = { current: null };

// ── Req 7.2 — border-radius shaping, no overflow:hidden / clip-path on glass ──
describe("GallerySetView — glass shaping uses border-radius only (Req 7.2)", () => {
  it("the shared .glass rule shapes with border-radius and never clips the backdrop", () => {
    const glass = ruleBody(globalsCss, ".glass");
    expect(glass).not.toBe("");

    // Shaped via border-radius …
    expect(glass).toMatch(/border-radius\s*:/);
    // … and NOT via overflow:hidden or clip-path (either would restrict the
    // backdrop-filter sampling region / clip the border + inset bevel).
    expect(glass).not.toMatch(/overflow\s*:\s*hidden/);
    expect(glass).not.toMatch(/clip-path\s*:/);
  });

  it("the .secIsland caption rule (which also carries .glass) never clips either", () => {
    const sec = ruleBody(moduleCss, ".secIsland");
    expect(sec).not.toBe("");
    expect(sec).not.toMatch(/overflow\s*:\s*hidden/);
    expect(sec).not.toMatch(/clip-path\s*:/);
  });

  it("renders the glass caption as an element distinct from the overflow:hidden image card", () => {
    const { container } = render(
      <Gallery sets={PHOTO_SETS} scrollRoot={nullScrollRoot} />
    );

    const glassCards = container.querySelectorAll(".glass");
    expect(glassCards.length).toBe(PHOTO_SETS.length);

    // The image (rendered inside the overflow:hidden .mainIsland card) must NOT
    // live inside a .glass element — i.e. the glass caption is a separate
    // element that never receives the overflow:hidden image-card styling.
    expect(container.querySelector(".glass img")).toBeNull();
    for (const img of Array.from(container.querySelectorAll("img"))) {
      expect(img.closest(".glass")).toBeNull();
    }
  });
});

// ── Req 7.3 — border + inset bevel on BOTH the image card and the caption card ──
describe("GallerySetView — border + bevel on both cards (Req 7.3)", () => {
  it("the image card (.mainIsland) renders a border, an inset bevel highlight, and border-radius", () => {
    const main = ruleBody(moduleCss, ".mainIsland");
    expect(main).not.toBe("");

    expect(main).toMatch(/border\s*:\s*1px/); // glass border
    expect(main).toMatch(/border-radius\s*:/); // rounded shaping
    // inset bevel highlight (box-shadow with an `inset` keyword)
    expect(main).toMatch(/box-shadow\s*:[^;]*inset/);
  });

  it("the caption card (.glass) renders a border and an inset bevel highlight", () => {
    const glass = ruleBody(globalsCss, ".glass");
    expect(glass).not.toBe("");

    expect(glass).toMatch(/border\s*:\s*1px/);
    expect(glass).toMatch(/box-shadow\s*:[^;]*inset/);
  });

  it("renders both an image card and a glass caption card for every set", () => {
    const { container } = render(
      <Gallery sets={PHOTO_SETS} scrollRoot={nullScrollRoot} />
    );

    // One image card (carrying an <img>) per set …
    expect(container.querySelectorAll("img").length).toBe(PHOTO_SETS.length);
    // … and one glass caption card per set.
    expect(container.querySelectorAll(".glass").length).toBe(PHOTO_SETS.length);
  });
});

// ── Empty-template case — empty gallery, no islands ───────────
describe("Gallery — empty template renders an empty gallery with no islands", () => {
  it("renders zero islands (no image cards, no glass caption cards) for sets=[]", () => {
    const empty: GallerySet[] = [];
    const { container } = render(
      <Gallery sets={empty} scrollRoot={nullScrollRoot} />
    );

    // The gallery container itself still renders (a scrollable, empty canvas) …
    expect(container.firstChild).not.toBeNull();
    // … but contains no islands.
    expect(container.querySelectorAll("img").length).toBe(0);
    expect(container.querySelectorAll(".glass").length).toBe(0);
  });
});
