/**
 * galleryData.property.test.ts
 * ──────────────────────────────────────────────────────────────────────────────
 * Property-based tests for the pure data layer in `galleryData.ts`.
 *
 * Feature: photos-page-and-content-templates
 */

import { describe, it, expect } from "vitest";
import fc from "fast-check";
import {
  resolveSet,
  GALLERY_DEFAULTS,
  type GallerySet,
  type FlyDir,
  type SecAlign,
} from "./galleryData";

/**
 * A smart arbitrary that produces valid `GallerySet` values:
 *  - required fields (`id`, `x`, `y`, `dir`, `secAlign`, `title`) are always present
 *  - each optional field (`caption`, `image`, `href`) is randomly present or absent,
 *    and when present may be empty-string or whitespace (to exercise the
 *    "provided value passes through unchanged" branch even for falsy-but-defined values)
 */
const flyDirArb: fc.Arbitrary<FlyDir> = fc.constantFrom("left", "right");
const secAlignArb: fc.Arbitrary<SecAlign> = fc.constantFrom("left", "center", "right");

/** Optional-field value: present (incl. empty/whitespace strings) or absent (undefined). */
const optionalStringArb = (): fc.Arbitrary<string | undefined> =>
  fc.option(
    fc.oneof(
      fc.string(),
      fc.constant(""),
      fc.constantFrom(" ", "   ", "\t", "\n", "  \t "),
    ),
    { nil: undefined },
  );

const gallerySetArb: fc.Arbitrary<GallerySet> = fc
  .record({
    id: fc.string(),
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
    // Drop undefined optional keys entirely so we exercise true omission
    // (key absent) as well as explicitly-provided values.
    const set: GallerySet = {
      id: rec.id,
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

describe("galleryData — resolveSet", () => {
  // Feature: photos-page-and-content-templates, Property 6: Default resolution
  // fills omitted optionals and preserves provided values.
  // Validates: Requirements 2.6
  it("fills omitted optionals with documented defaults and preserves all provided/required values", () => {
    fc.assert(
      fc.property(gallerySetArb, (set) => {
        const resolved = resolveSet(set);

        // Required fields are preserved exactly.
        expect(resolved.id).toBe(set.id);
        expect(resolved.x).toBe(set.x);
        expect(resolved.y).toBe(set.y);
        expect(resolved.dir).toBe(set.dir);
        expect(resolved.secAlign).toBe(set.secAlign);
        expect(resolved.title).toBe(set.title);

        // Each optional: omitted → documented default; provided → unchanged.
        for (const key of ["caption", "image", "href"] as const) {
          if (set[key] === undefined) {
            expect(resolved[key]).toBe(GALLERY_DEFAULTS[key]);
          } else {
            expect(resolved[key]).toBe(set[key]);
          }
        }

        // The resolved set is fully concrete (no undefined optionals).
        expect(resolved.caption).not.toBeUndefined();
        expect(resolved.image).not.toBeUndefined();
        expect(resolved.href).not.toBeUndefined();
      }),
      { numRuns: 200 },
    );
  });
});
