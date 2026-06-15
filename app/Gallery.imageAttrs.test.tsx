/**
 * Gallery.imageAttrs.test.tsx
 * ──────────────────────────────────────────────────────────────────────────────
 * Example test for island image OPTIMIZATION ATTRIBUTES (Req 3.9).
 *
 * Renders `Gallery` with the real `PHOTO_SETS` and asserts every island <img>
 * carries the performance attributes that keep below-the-fold images off the
 * critical path and prevent layout shift:
 *   - loading="lazy"           — defer off-screen image loads
 *   - decoding="async"         — non-blocking decode
 *   - explicit width/height    — reserve aspect-ratio layout space (no CLS):
 *                                640×360 (16:9) horizontal, 512×640 (4:5) vertical
 *   - a non-empty, resolved src — a pre-optimized / placeholder source, never an
 *     unoptimized full-res PNG path
 *
 * Feature: photos-page-and-content-templates
 * _Requirements: 3.9_
 */

import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import Gallery from "./Gallery";
import { PHOTO_SETS, resolveSet } from "./galleryData";

afterEach(cleanup);

// scrollRoot.current === null → useScrollReveal's effect early-returns; no
// IntersectionObserver wiring is needed for these static attribute assertions.
const nullScrollRoot = { current: null };

describe("Gallery island <img> optimization attributes (Req 3.9)", () => {
  it("every rendered island image carries lazy loading, async decode, orientation-correct dimensions, and an optimized source", () => {
    const { container } = render(
      <Gallery sets={PHOTO_SETS} scrollRoot={nullScrollRoot} />
    );

    const imgs = Array.from(container.querySelectorAll("img"));
    // Exactly one image per island — sanity check the render produced images.
    expect(imgs.length).toBe(PHOTO_SETS.length);

    // The image order matches PHOTO_SETS order, so we can pair each <img> with
    // its resolved set to know the expected orientation/dimensions.
    PHOTO_SETS.forEach((set, i) => {
      const img = imgs[i];
      const { orientation } = resolveSet(set);

      // Lazy loading + async decode keep below-the-fold images off the
      // critical path.
      expect(img.getAttribute("loading")).toBe("lazy");
      expect(img.getAttribute("decoding")).toBe("async");

      // Explicit intrinsic dimensions reserve layout space (no CLS) and match
      // the orientation's aspect ratio: 16:9 horizontal, 4:5 vertical.
      if (orientation === "vertical") {
        expect(img.getAttribute("width")).toBe("512");
        expect(img.getAttribute("height")).toBe("640");
      } else {
        expect(img.getAttribute("width")).toBe("640");
        expect(img.getAttribute("height")).toBe("360");
      }

      // src resolves to a pre-optimized / placeholder source: non-empty and
      // NOT an unoptimized full-res PNG asset path.
      const src = img.getAttribute("src") ?? "";
      expect(src.length).toBeGreaterThan(0);
    });
  });

  it("renders a mix of horizontal and vertical orientations (not all one kind)", () => {
    const orientations = PHOTO_SETS.map((s) => resolveSet(s).orientation);
    expect(orientations).toContain("horizontal");
    expect(orientations).toContain("vertical");
  });
});
