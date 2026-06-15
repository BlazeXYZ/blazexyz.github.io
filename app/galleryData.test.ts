/**
 * galleryData.test.ts
 * ──────────────────────────────────────────────────────────────────────────────
 * Example (non-property) tests for the pure data layer in `galleryData.ts`.
 *
 * These verify the concrete `PROJECT_SETS` / `PHOTO_SETS` templates and the
 * documented default-resolution behaviour for entries that omit optionals.
 *
 * Feature: photos-page-and-content-templates
 */

import { describe, it, expect } from "vitest";
import {
  PROJECT_SETS,
  PHOTO_SETS,
  GALLERY_DEFAULTS,
  resolveSet,
  type GallerySet,
} from "./galleryData";

/**
 * Compile-time assertion that a value is assignable to `GallerySet[]`.
 * If either template ever drifts from the declared type this helper stops
 * type-checking, which fails the test build (Req 8.4 / 2.1 / 2.2).
 */
const expectGallerySetArray = (sets: GallerySet[]): GallerySet[] => sets;

describe("galleryData — template type-checking (Req 2.1, 2.2)", () => {
  it("PROJECT_SETS type-checks as GallerySet[] and is non-empty", () => {
    const sets = expectGallerySetArray(PROJECT_SETS);
    expect(Array.isArray(sets)).toBe(true);
    expect(sets.length).toBeGreaterThan(0);
  });

  it("PHOTO_SETS type-checks as GallerySet[] and is non-empty", () => {
    const sets = expectGallerySetArray(PHOTO_SETS);
    expect(Array.isArray(sets)).toBe(true);
    expect(sets.length).toBeGreaterThan(0);
  });
});

describe("galleryData — unique ids", () => {
  it("PROJECT_SETS has unique ids", () => {
    const ids = PROJECT_SETS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("PHOTO_SETS has unique ids", () => {
    const ids = PHOTO_SETS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("ids are unique across both templates combined", () => {
    const ids = [...PROJECT_SETS, ...PHOTO_SETS].map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("galleryData — every entry carries required fields (Req 2.4, 2.5)", () => {
  it("every PROJECT_SETS / PHOTO_SETS entry has a non-empty title", () => {
    for (const set of [...PROJECT_SETS, ...PHOTO_SETS]) {
      expect(typeof set.title).toBe("string");
      expect(set.title.length).toBeGreaterThan(0);
    }
  });
});

describe("galleryData — documented defaults applied via resolveSet (Req 2.4, 2.5)", () => {
  it("applies all documented defaults for an entry that omits every optional", () => {
    const minimal: GallerySet = {
      id: "min",
      x: "10vw",
      y: 100,
      dir: "left",
      secAlign: "center",
      title: "Minimal",
    };

    const resolved = resolveSet(minimal);

    // Omitted optionals fall back to the documented defaults.
    expect(resolved.orientation).toBe(GALLERY_DEFAULTS.orientation);
    expect(resolved.caption).toBe(GALLERY_DEFAULTS.caption);
    expect(resolved.image).toBe(GALLERY_DEFAULTS.image);
    expect(resolved.href).toBe(GALLERY_DEFAULTS.href);

    // The documented orientation default is horizontal, image default is the
    // shared horizontal placeholder.
    expect(resolved.orientation).toBe("horizontal");
    expect(resolved.image).toBe("/horizontalPlaceholder.png");

    // Required fields pass through unchanged.
    expect(resolved.id).toBe("min");
    expect(resolved.x).toBe("10vw");
    expect(resolved.y).toBe(100);
    expect(resolved.dir).toBe("left");
    expect(resolved.secAlign).toBe("center");
    expect(resolved.title).toBe("Minimal");
  });

  it("preserves provided optionals and only fills the omitted ones", () => {
    // Provides `image` but omits `caption` and `href`.
    const partial: GallerySet = {
      id: "partial",
      x: "63vw",
      y: 200,
      dir: "right",
      secAlign: "left",
      title: "Partial",
      image: "/photos/custom.webp",
    };

    const resolved = resolveSet(partial);

    expect(resolved.image).toBe("/photos/custom.webp"); // provided → unchanged
    expect(resolved.caption).toBe(GALLERY_DEFAULTS.caption); // omitted → default
    expect(resolved.href).toBe(GALLERY_DEFAULTS.href); // omitted → default
  });

  it("PHOTO_SETS entries (which supply image but omit href) resolve a non-empty image and default href", () => {
    for (const set of PHOTO_SETS) {
      const resolved = resolveSet(set);
      expect(resolved.image.length).toBeGreaterThan(0);
      if (set.href === undefined) {
        expect(resolved.href).toBe(GALLERY_DEFAULTS.href);
      }
    }
  });

  it("PROJECT_SETS entries (which omit image) resolve to the documented placeholder image", () => {
    for (const set of PROJECT_SETS) {
      const resolved = resolveSet(set);
      if (set.image === undefined) {
        expect(resolved.image).toBe(GALLERY_DEFAULTS.image);
      }
    }
  });
});
