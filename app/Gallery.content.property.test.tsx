/**
 * Gallery.content.property.test.tsx
 * ──────────────────────────────────────────────────────────────────────────────
 * Property-based test for rendered content fidelity of the data-driven Gallery.
 *
 * Feature: photos-page-and-content-templates
 *
 * Property 3: Rendered content reflects the resolved template entry.
 *   For any GallerySet[] template, each rendered island's image `src` equals the
 *   resolved `image` of its entry, and its caption card contains the entry's
 *   `title` (and its `caption` text whenever the resolved caption is non-empty).
 */

import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import fc from "fast-check";
import Gallery from "./Gallery";
import {
  resolveSet,
  type GallerySet,
  type FlyDir,
  type SecAlign,
} from "./galleryData";

afterEach(() => cleanup());

const flyDirArb: fc.Arbitrary<FlyDir> = fc.constantFrom("left", "right");
const secAlignArb: fc.Arbitrary<SecAlign> = fc.constantFrom(
  "left",
  "center",
  "right",
);

/**
 * Smart arbitrary for a single GallerySet:
 *  - required fields are always present
 *  - `image` is either omitted (→ documented default, always non-empty) or a
 *    non-empty path-like string, so the rendered <img src> is always non-empty
 *    (mirrors real image sources and avoids React's empty-src warning)
 *  - `caption` is randomly omitted / empty / whitespace / non-empty so the
 *    "caption present iff resolved caption non-empty" branch is exercised
 */
const nonEmptyStringArb = fc
  .string({ minLength: 1 })
  .filter((s) => s.length > 0);

const gallerySetArb: fc.Arbitrary<GallerySet> = fc
  .record({
    x: fc.string(),
    y: fc.double({ noNaN: true }),
    dir: flyDirArb,
    secAlign: secAlignArb,
    title: fc.string(),
    caption: fc.option(
      fc.oneof(
        nonEmptyStringArb,
        fc.constant(""),
        fc.constantFrom(" ", "   ", "\t"),
      ),
      { nil: undefined },
    ),
    image: fc.option(fc.constantFrom("/a.webp", "/photos/b.webp", "/c.png"), {
      nil: undefined,
    }),
  })
  .map((rec) => {
    const set: GallerySet = {
      id: "placeholder", // unique id assigned per-array below
      x: rec.x,
      y: rec.y,
      dir: rec.dir,
      secAlign: rec.secAlign,
      title: rec.title,
    };
    if (rec.caption !== undefined) set.caption = rec.caption;
    if (rec.image !== undefined) set.image = rec.image;
    return set;
  });

/** Arrays of 0..6 sets with guaranteed-unique ids (avoids React key warnings). */
const galleryArrayArb: fc.Arbitrary<GallerySet[]> = fc
  .array(gallerySetArb, { maxLength: 6 })
  .map((arr) => arr.map((s, i) => ({ ...s, id: `set-${i}` })));

describe("Gallery — rendered content fidelity", () => {
  // Feature: photos-page-and-content-templates, Property 3: Rendered content
  // reflects the resolved template entry.
  // Validates: Requirements 2.4, 2.5
  it("renders each island's image src and caption-card title/caption from the resolved entry", () => {
    fc.assert(
      fc.property(galleryArrayArb, (sets) => {
        // scrollRoot.current === null short-circuits the useScrollReveal effect
        // before it touches IntersectionObserver (absent in jsdom), while the
        // islands themselves still render fully.
        const scrollRoot = { current: null };
        const { container, unmount } = render(
          <Gallery sets={sets} scrollRoot={scrollRoot} />,
        );

        try {
          const resolvedSets = sets.map(resolveSet);

          // One image card <img> and one .glass caption card per template entry,
          // in DOM order matching the template order.
          const imgs = container.querySelectorAll("img");
          const captionCards = container.querySelectorAll(".glass");
          expect(imgs.length).toBe(resolvedSets.length);
          expect(captionCards.length).toBe(resolvedSets.length);

          resolvedSets.forEach((resolved, i) => {
            // Req 2.4 — each island image src equals the resolved `image`.
            // getAttribute("src") returns the raw (unresolved) attribute value.
            expect(imgs[i].getAttribute("src")).toBe(resolved.image);

            // Req 2.5 — caption card contains the title, plus the caption text
            // iff the resolved caption is non-empty.
            const card = captionCards[i];
            const paragraphs = card.querySelectorAll("p");

            // First <p> is always the title.
            expect(paragraphs[0]?.textContent).toBe(resolved.title);

            if (resolved.caption.length > 0) {
              // Caption present: a second <p> carrying the caption text.
              expect(paragraphs.length).toBe(2);
              expect(paragraphs[1]?.textContent).toBe(resolved.caption);
              expect(card.textContent ?? "").toContain(resolved.caption);
            } else {
              // Empty caption: only the title <p> renders.
              expect(paragraphs.length).toBe(1);
            }
          });
        } finally {
          unmount();
        }
      }),
      { numRuns: 150 },
    );
  });
});
