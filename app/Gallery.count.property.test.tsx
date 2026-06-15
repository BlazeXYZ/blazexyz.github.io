/**
 * Gallery.count.property.test.tsx
 * ──────────────────────────────────────────────────────────────────────────────
 * Property-based test for the template→island count invariant.
 *
 * Feature: photos-page-and-content-templates
 * Property 1: Template→island count invariant
 * Validates: Requirements 2.3, 1.2
 */

import { describe, it, expect, afterEach } from "vitest";
import { cleanup, render } from "@testing-library/react";
import fc from "fast-check";
import { createRef } from "react";
import Gallery from "./Gallery";
import { type GallerySet, type FlyDir, type SecAlign } from "./galleryData";

afterEach(() => cleanup());

const flyDirArb: fc.Arbitrary<FlyDir> = fc.constantFrom("left", "right");
const secAlignArb: fc.Arbitrary<SecAlign> = fc.constantFrom(
  "left",
  "center",
  "right",
);

/** Optional-field value: present (incl. empty string) or absent (undefined). */
const optionalStringArb = (): fc.Arbitrary<string | undefined> =>
  fc.option(fc.string(), { nil: undefined });

/**
 * Smart arbitrary for a single `GallerySet`: required fields always present,
 * each optional field randomly present or omitted entirely.
 */
const gallerySetArb: fc.Arbitrary<GallerySet> = fc
  .record({
    x: fc.string(),
    y: fc.double({ noNaN: true }),
    dir: flyDirArb,
    secAlign: secAlignArb,
    title: fc.string(),
    caption: optionalStringArb(),
    image: optionalStringArb(),
    href: optionalStringArb(),
  })
  .map((rec) => {
    const set: GallerySet = {
      // `id` filled in by the array arbitrary below to guarantee uniqueness.
      id: "",
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
  });

/**
 * Arbitrary `GallerySet[]` of length 0..12. Ids are overwritten with the entry
 * index so React keys are unique (uniqueness is not what this property tests).
 */
const gallerySetsArb: fc.Arbitrary<GallerySet[]> = fc
  .array(gallerySetArb, { minLength: 0, maxLength: 12 })
  .map((sets) => sets.map((s, i) => ({ ...s, id: `set-${i}` })));

describe("Gallery — template→island count invariant", () => {
  // Feature: photos-page-and-content-templates, Property 1: Template→island
  // count invariant.
  // Validates: Requirements 2.3, 1.2
  it("renders exactly one island per template entry (island count === template length)", () => {
    fc.assert(
      fc.property(gallerySetsArb, (sets) => {
        // scrollRoot.current is null → useScrollReveal returns before touching
        // IntersectionObserver (unavailable in jsdom); islands still render.
        const scrollRoot = createRef<HTMLDivElement>();
        const { container } = render(
          <Gallery sets={sets} scrollRoot={scrollRoot} />,
        );

        // One image card (<img>) is rendered per island, so the count of
        // rendered images must equal the number of template entries.
        const islandCount = container.querySelectorAll("img").length;
        expect(islandCount).toBe(sets.length);

        cleanup();
      }),
      { numRuns: 150 },
    );
  });
});
