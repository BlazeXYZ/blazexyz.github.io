/**
 * page.mounting.test.tsx
 * ──────────────────────────────────────────────────────────────────────────────
 * Example (non-property) tests for the page-level MOUNTING and STACKING behavior
 * wired in `page.tsx` (task 5).
 *
 * What is verified, and how:
 *   1. CONDITIONAL MOUNTING (Req 1.1, 1.8) — the Photos gallery container is
 *      rendered only while `active === "photos"` and is removed from the DOM when
 *      the active section changes away. Because jsdom does not apply CSS, mounting
 *      is observed through the rendered output: each gallery renders one <img> per
 *      template entry, and the Photos and Projects images are distinguishable by
 *      their `alt` text (PHOTO_SETS vs PROJECT_SETS titles).
 *   2. STACKING (Req 1.3) — jsdom cannot compute z-index from CSS Modules, so the
 *      documented stacking is asserted by parsing `page.module.css`: the fixed
 *      `.central` island declares a higher `z-index` (100) than the
 *      `.galleryScroll` container (15), and `.central` is `position: fixed`.
 *   3. NAVIGATE NO-OP (Req 6.2) — navigating to the already-active section makes
 *      no state change. This is observed via the bio entry animation: while on
 *      "bio" the bio islands are hidden (wallReady never resolves in jsdom, so the
 *      first-load entry never runs); if the same-destination guard were absent,
 *      clicking the active "Bio" tab would (re)start the entry animation and the
 *      bio island headings would appear. The guard keeps them absent.
 *
 * jsdom shims:
 *   - IntersectionObserver is absent in jsdom; the mounted Gallery's
 *     `useScrollReveal` constructs one, so a minimal stub is installed.
 *   - `Image` is stubbed so the wallpaper preload's onload/onerror never fire,
 *     keeping `wallReady` false (and the bio islands hidden) deterministically.
 *
 * Feature: photos-page-and-content-templates
 * _Requirements: 1.1, 1.3, 1.8, 6.2_
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import Home from "./page";
import { PHOTO_SETS, PROJECT_SETS } from "./galleryData";

// ── jsdom shims ───────────────────────────────────────────────
const realIO = (globalThis as any).IntersectionObserver;
const realImage = (globalThis as any).Image;

beforeEach(() => {
  // Minimal IntersectionObserver stub (absent in jsdom). It records nothing and
  // never reports intersections, so islands stay in their initial "hidden"
  // reveal state — sufficient for mount/unmount assertions.
  class IOStub {
    constructor(_cb: IntersectionObserverCallback, _opts?: IntersectionObserverInit) {}
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() { return []; }
    root = null;
    rootMargin = "";
    thresholds = [];
  }
  (globalThis as any).IntersectionObserver = IOStub as unknown as typeof IntersectionObserver;

  // Image stub whose onload/onerror never fire → wallReady stays false.
  class ImageStub {
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    private _src = "";
    set src(v: string) { this._src = v; /* intentionally never fires onload */ }
    get src() { return this._src; }
  }
  (globalThis as any).Image = ImageStub as unknown as typeof Image;
});

afterEach(() => {
  cleanup();
  (globalThis as any).IntersectionObserver = realIO;
  (globalThis as any).Image = realImage;
});

// ── CSS source helper ─────────────────────────────────────────
const here = dirname(fileURLToPath(import.meta.url));
const pageCss = readFileSync(resolve(here, "page.module.css"), "utf8");

/** Extract the declaration body of a single (non-nested) CSS rule by selector. */
function ruleBody(css: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(escaped + "\\s*\\{([^}]*)\\}");
  const m = css.match(re);
  return m ? m[1] : "";
}

/** Pull the numeric z-index declared in a CSS rule body, or NaN if absent. */
function zIndexOf(body: string): number {
  const m = body.match(/z-index\s*:\s*(\d+)/);
  return m ? Number(m[1]) : NaN;
}

// Distinguishing alt text: GallerySetView renders alt={`${title} preview`}.
const photoAlt = `${PHOTO_SETS[0].title} preview`;   // "Golden Hour preview"
const projectAlt = `${PROJECT_SETS[0].title} preview`; // "Project One preview"

function photoImgCount() {
  return screen.queryAllByAltText(/preview$/).filter((el) =>
    PHOTO_SETS.some((s) => el.getAttribute("alt") === `${s.title} preview`)
  ).length;
}
function projectImgCount() {
  return screen.queryAllByAltText(/preview$/).filter((el) =>
    PROJECT_SETS.some((s) => el.getAttribute("alt") === `${s.title} preview`)
  ).length;
}

// ── Req 1.1 / 1.8 — conditional mounting of the Photos gallery ──
describe("Photos gallery mounting (Req 1.1, 1.8)", () => {
  it("does not render the Photos gallery on first paint (active === 'bio')", () => {
    render(<Home />);
    expect(screen.queryByAltText(photoAlt)).toBeNull();
    expect(photoImgCount()).toBe(0);
  });

  it("mounts the Photos gallery when the Photos tab is activated (Req 1.1)", () => {
    render(<Home />);

    fireEvent.click(screen.getByRole("button", { name: "Photos" }));

    // The photos container mounts: one image per PHOTO_SETS entry appears.
    expect(screen.getByAltText(photoAlt)).toBeInTheDocument();
    expect(photoImgCount()).toBe(PHOTO_SETS.length);
    // The Projects gallery is not mounted at the same time.
    expect(projectImgCount()).toBe(0);
  });

  it("unmounts the Photos gallery when switching to another section (Req 1.8)", () => {
    render(<Home />);

    // Mount photos …
    fireEvent.click(screen.getByRole("button", { name: "Photos" }));
    expect(photoImgCount()).toBe(PHOTO_SETS.length);

    // … then switch to Projects: the photos container is removed from the DOM.
    fireEvent.click(screen.getByRole("button", { name: "Projects" }));
    expect(screen.queryByAltText(photoAlt)).toBeNull();
    expect(photoImgCount()).toBe(0);
    // And the Projects gallery is now mounted instead.
    expect(screen.getByAltText(projectAlt)).toBeInTheDocument();
    expect(projectImgCount()).toBe(PROJECT_SETS.length);

    // Switching back to Bio unmounts the Projects gallery too.
    fireEvent.click(screen.getByRole("button", { name: "Bio" }));
    expect(photoImgCount()).toBe(0);
    expect(projectImgCount()).toBe(0);
  });
});

// ── Req 1.3 — central island stacks above the gallery scroll container ──
describe("Central island stacking (Req 1.3)", () => {
  it("declares .central as position:fixed with a higher z-index than .galleryScroll", () => {
    const central = ruleBody(pageCss, ".central");
    const gallery = ruleBody(pageCss, ".galleryScroll");

    expect(central).not.toBe("");
    expect(gallery).not.toBe("");

    // Central island is viewport-anchored (unaffected by gallery scroll).
    expect(central).toMatch(/position\s*:\s*fixed/);

    const centralZ = zIndexOf(central);
    const galleryZ = zIndexOf(gallery);
    expect(Number.isNaN(centralZ)).toBe(false);
    expect(Number.isNaN(galleryZ)).toBe(false);
    // Central island floats above the gallery at every scroll position.
    expect(centralZ).toBeGreaterThan(galleryZ);
  });

  it("renders the fixed central island regardless of the active section", () => {
    render(<Home />);
    // The central island (containing the identity name + tab bar) is always present.
    expect(screen.getByText("Your Name")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Photos" }));
    expect(screen.getByText("Your Name")).toBeInTheDocument();
  });
});

// ── Req 6.2 — navigating to the already-active section is a no-op ──
describe("navigate() to the already-active section is a no-op (Req 6.2)", () => {
  it("clicking the active 'Bio' tab does not start the bio entry animation", () => {
    render(<Home />);

    // Precondition: on bio, the bio islands are hidden (wallReady never resolves
    // in jsdom, so the first-load entry animation never runs).
    expect(screen.queryByText("About Me")).toBeNull();
    expect(screen.queryByText("Experience")).toBeNull();

    // Click the already-active Bio tab. The same-destination guard returns early,
    // so no state change occurs and the bio islands stay hidden. Without the
    // guard, this would (re)trigger setBio("entering") and reveal the islands.
    fireEvent.click(screen.getByRole("button", { name: "Bio" }));

    expect(screen.queryByText("About Me")).toBeNull();
    expect(screen.queryByText("Experience")).toBeNull();
  });

  it("re-clicking the active 'Photos' tab keeps the Photos gallery mounted unchanged", () => {
    render(<Home />);

    fireEvent.click(screen.getByRole("button", { name: "Photos" }));
    expect(photoImgCount()).toBe(PHOTO_SETS.length);

    // Re-click Photos while it is already active: no-op, gallery stays mounted.
    fireEvent.click(screen.getByRole("button", { name: "Photos" }));
    expect(photoImgCount()).toBe(PHOTO_SETS.length);
    expect(projectImgCount()).toBe(0);
  });
});
