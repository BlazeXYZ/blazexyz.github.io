/**
 * Gallery.structure.property.test.tsx
 * ──────────────────────────────────────────────────────────────────────────────
 * Property-based test for the rendered structure of the shared `Gallery`
 * component (app/Gallery.tsx).
 *
 * Feature: photos-page-and-content-templates
 * Property 2: Every rendered island is well-structured glass.
 * Validates: Requirements 1.2, 1.7, 7.1, 9.3
 *
 * For an arbitrary `GallerySet[]` template, every rendered island must consist
 * of an image card (`.mainIsland`) plus a caption card carrying the shared
 * global `.glass` class, and the scroll-reveal animation class must sit on the
 * glass-carrying caption element (and on the image card) — never on the
 * transform-free `.setWrap` wrapper (Req 1.7 / 9.3: backdrop-filter and the
 * animation transform live on the same element).
 */

import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { cleanup, render } from "@testing-library/react";
import fc from "fast-check";
import { createRef, type RefObject } from "react";
import Gallery from "./Gallery";
import styles from "./Gallery.module.css";
import type { GallerySet, FlyDir, SecAlign } from "./galleryData";

// jsdom has no IntersectionObserver; stub a no-op so the scroll-reveal effect
// mounts without throwing. The callback is never invoked, so every island stays
// in its initial "hidden" state (animClass === styles.gone), which is exactly
// the structural shape we assert on.
beforeAll(() => {
  class IOStub implements IntersectionObserver {
    readonly root = null;
    readonly rootMargin = "";
    readonly thresholds: ReadonlyArray<number> = [];
    constructor(_cb: IntersectionObserverCallback) {}
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
    takeRecords(): IntersectionObserverEntry[] {
      return [];
    }
  }
  // @ts-expect-error assigning stub onto the global for the jsdom environment
  globalThis.IntersectionObserver = IOStub;
});

afterEach(() => cleanup());

// The full set of scroll-reveal animation-class tokens that `GallerySetView`
// may place on an island child. Importing the same CSS module the component
// imports gives us the exact scoped tokens, so this test never hard-codes the
// hashed names.
const ANIM_TOKENS: string[] = [
  styles.gone,
  styles.resting,
  styles.flyInLeft,
  styles.flyInRight,
  styles.flyOutLeft,
  styles.flyOutRight,
].filter(Boolean);

const flyDirArb: fc.Arbitrary<FlyDir> = fc.constantFrom("left", "right");
const secAlignArb: fc.Arbitrary<SecAlign> = fc.constantFrom("left", "center", "right");

/** Arbitrary template of length 0..8 with unique ids (unique React keys). */
const templateArb: fc.Arbitrary<GallerySet[]> = fc
  .array(
    fc.record({
      // CSS `left` value (e.g. "8vw", "63vw", "120px") — kept realistic so the
      // generated `style={{ left: x }}` is valid and doesn't emit React noise.
      x: fc
        .tuple(fc.integer({ min: 0, max: 100 }), fc.constantFrom("vw", "px", "%", "em"))
        .map(([n, unit]) => `${n}${unit}`),
      y: fc.double({ noNaN: true }),
      dir: flyDirArb,
      secAlign: secAlignArb,
      title: fc.string(),
      caption: fc.option(fc.string(), { nil: undefined }),
      image: fc.option(fc.string(), { nil: undefined }),
      href: fc.option(fc.string(), { nil: undefined }),
    }),
    { minLength: 0, maxLength: 8 },
  )
  .map((records) =>
    records.map((rec, i) => {
      const set: GallerySet = {
        id: `set-${i}`,
        x: rec.x,
        y: rec.y,
        dir: rec.dir,
        secAlign: rec.secAlign,
        title: rec.title,
      };
      if (rec.caption !== undefined) set.caption = rec.caption;
      if (rec.image !== undefined) set.image = rec.image;
      if (rec.href !== undefined) set.href = rec.href;
      return set;
    }),
  );

const hasAnyToken = (el: Element): boolean =>
  ANIM_TOKENS.some((t) => el.classList.contains(t));

describe("Property 2: Every rendered island is well-structured glass", () => {
  it("each island = one image card + one glass caption card, with the animation class on the glass element (and image card), never on the transform-free wrapper", () => {
    const scrollRoot: RefObject<HTMLDivElement> = createRef<HTMLDivElement>();
    scrollRoot.current = document.createElement("div");

    fc.assert(
      fc.property(templateArb, (sets) => {
        const { container, unmount } = render(
          <Gallery sets={sets} scrollRoot={scrollRoot} />,
        );

        try {
          const wraps = Array.from(
            container.getElementsByClassName(styles.setWrap),
          );

          // One island wrapper per template entry.
          expect(wraps.length).toBe(sets.length);

          for (const wrap of wraps) {
            const imageCards = Array.from(
              wrap.getElementsByClassName(styles.mainIsland),
            );
            const captionCards = Array.from(
              wrap.getElementsByClassName(styles.secIsland),
            );

            // Exactly one image card + one caption card per island (Req 1.2 / 7.1).
            expect(imageCards.length).toBe(1);
            expect(captionCards.length).toBe(1);

            const imageCard = imageCards[0];
            const captionCard = captionCards[0];

            // The caption card carries the shared global `.glass` class (Req 7.1).
            expect(captionCard.classList.contains("glass")).toBe(true);

            // The animation class sits on the glass-carrying caption element
            // (Req 1.7 / 9.3) — and on the image card — not on the wrapper.
            expect(hasAnyToken(captionCard)).toBe(true);
            expect(hasAnyToken(imageCard)).toBe(true);

            // The transform-free wrapper carries NO animation class and is not
            // itself a glass element.
            expect(hasAnyToken(wrap)).toBe(false);
            expect(wrap.classList.contains("glass")).toBe(false);
          }
        } finally {
          unmount();
        }
      }),
      { numRuns: 120 },
    );
  });
});
