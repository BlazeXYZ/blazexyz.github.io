/**
 * galleryData.ts — editable in-file content template (pure data + pure function)
 * ──────────────────────────────────────────────────────────────────────────────
 * This module owns the typed `GallerySet` template, the two page data arrays
 * (`PROJECT_SETS`, `PHOTO_SETS`), the documented field defaults, and the pure
 * `resolveSet` resolver. It deliberately imports NOTHING from React or any
 * rendering code so the site owner can edit content (add / remove / re-order
 * islands, swap images, change copy) without touching component internals, and
 * so the data layer can be type-checked and property-tested in isolation.
 *
 * To add an island: append an entry to the relevant array below. Exactly one
 * content island is rendered per entry. Required fields (`id`, `x`, `y`, `dir`,
 * `secAlign`, `title`) must be supplied; optional fields fall back to
 * `GALLERY_DEFAULTS`.
 */

/** Side an island flies in from / out to during scroll reveal. */
export type FlyDir = "left" | "right";

/** Horizontal anchor of the caption card beneath the image card. */
export type SecAlign = "left" | "center" | "right";

/**
 * Aspect orientation of an island's image card:
 *   - `"horizontal"` → 16:9 landscape frame (the default)
 *   - `"vertical"`   → 4:5 portrait frame
 * Mixing orientations across a page gives the gallery a varied, magazine-like
 * rhythm. Omitted → `"horizontal"` (see `GALLERY_DEFAULTS`).
 */
export type Orientation = "horizontal" | "vertical";

/**
 * One content island's data. Layout fields (`x`, `y`, `dir`, `secAlign`) are
 * required because there is no safe universal default for where an island
 * lives; `title` is required because a titleless island is meaningless.
 * Everything with a sensible fallback is optional (see `GALLERY_DEFAULTS`).
 */
export interface GallerySet {
  /** Unique React key for the set. */
  id: string;
  /** CSS `left` value for the island (e.g. `"8vw"`, `"63vw"`). */
  x: string;
  /** Pixels from the top of the scroll canvas. */
  y: number;
  /** Side the island flies in from / out to. */
  dir: FlyDir;
  /** Horizontal anchor of the caption card under the image. */
  secAlign: SecAlign;
  /** Title shown in the caption card (uppercase mono). */
  title: string;
  /**
   * Aspect orientation of the image card. Omit (or set `"horizontal"`) for a
   * 16:9 landscape frame; set `"vertical"` for a 4:5 portrait frame. This is the
   * single switch that turns an island vertical vs horizontal.
   */
  orientation?: Orientation;
  /** Optional sub-text / link label under the title. Empty → caption omitted. */
  caption?: string;
  /** Optional pre-optimized image source (public path). */
  image?: string;
  /** Optional link; when non-empty the image card is wrapped in `<a href>`. */
  href?: string;
}

/** Documented defaults applied to omitted optional fields (Req 2.6). */
export const GALLERY_DEFAULTS = {
  orientation: "horizontal",
  caption: "",
  image: "/horizontalPlaceholder.png",
  href: "",
} as const;

/** A `GallerySet` with every optional field made concrete. */
export type ResolvedGallerySet = Required<GallerySet>;

/**
 * Pure: apply `GALLERY_DEFAULTS` to a single entry's omitted optional fields
 * while passing every required field (and every provided optional value)
 * through unchanged.
 */
export function resolveSet(set: GallerySet): ResolvedGallerySet {
  return {
    ...set,
    orientation: set.orientation ?? GALLERY_DEFAULTS.orientation,
    caption: set.caption ?? GALLERY_DEFAULTS.caption,
    image: set.image ?? GALLERY_DEFAULTS.image,
    href: set.href ?? GALLERY_DEFAULTS.href,
  };
}

/*
/*
 * PROJECT_SETS — Projects page gallery.
 * ─────────────────────────────────────────────────────────────────────────────
 * A horizontal MIRROR of PHOTO_SETS. On the Projects page the central island
 * sits at the top-RIGHT corner (page.module.css .centralCode), the mirror image
 * of the Photos page's top-LEFT central island. So this layout is PHOTO_SETS
 * flipped across 50vw: left/right columns swap, `dir` swaps left↔right, and
 * `secAlign` swaps left↔right (center stays). The result is that the FIRST
 * island lives in the LEFT column to clear the top-right central island, exactly
 * mirroring how the Photos page's first island sits in the right column.
 *
 * Column anchors (left ≈ 20–21vw, right ≈ 60–61vw). Because islands are anchored
 * by their LEFT edge and are up to ~320px wide, these anchors place the visual
 * centre of mass on ~50vw rather than biasing it left. y values are identical to
 * PHOTO_SETS so the two pages read as mirror images of one another.
 */
export const PROJECT_SETS: GallerySet[] = [
  // Top-left first so it clears the top-right central island footprint.
  { id: "s1", x: "21vw", y: 70,   dir: "left",  secAlign: "right",  title: "Project One",   caption: "caption · link placeholder" },
  { id: "s2", x: "60vw", y: 300,  dir: "right", secAlign: "left",   title: "Project Two",   caption: "caption · link placeholder" },

  { id: "s3", x: "20vw", y: 520,  dir: "left",  secAlign: "left",   title: "Project Three", caption: "caption · link placeholder" },
  { id: "s4", x: "61vw", y: 740,  dir: "right", secAlign: "center", title: "Project Four",  caption: "caption · link placeholder" },

  { id: "s5", x: "20vw", y: 980,  dir: "left",  secAlign: "right",  title: "Project Five",  caption: "caption · link placeholder" },
  { id: "s6", x: "60vw", y: 1200, dir: "right", secAlign: "left",   title: "Project Six",   caption: "caption · link placeholder" },

  { id: "s7", x: "21vw", y: 1440, dir: "left",  secAlign: "center", title: "Project Seven", caption: "caption · link placeholder" },
  { id: "s8", x: "60vw", y: 1630, dir: "right", secAlign: "left",   title: "Project Eight", caption: "caption · link placeholder" },
];

/*
 * PHOTO_SETS — new gallery for the Photos page.
 * ─────────────────────────────────────────────────────────────────────────────
 * On the Photos page the central island sits at the top-LEFT corner
 * (page.module.css .centralPhotos { top: 40px; left: 40px } — a ~220px-wide,
 * ~180px-tall footprint). To clear it, the FIRST island lives in the right
 * column, and the left-column islands all start below y ≈ 290px so none overlap
 * the central island's screen-space footprint at the top-left.
 *
 * Column anchors (left ≈ 20–21vw, right ≈ 60–61vw). Because islands are anchored
 * by their LEFT edge and are up to ~320px wide, these anchors place the visual
 * centre of mass on ~50vw rather than biasing it left. Orientations are mixed
 * (`orientation: "vertical"` for portrait 4:5 frames, omitted/`"horizontal"` for
 * landscape 16:9) to give the page a varied rhythm.
 *
 * `y` is hand-tuned PER COLUMN so same-column islands never overlap, accounting
 * for the two island heights at the max ~320px card width:
 *   - horizontal (16:9): ≈ 215px tall (image + overlapping caption)
 *   - vertical   (4:5):  ≈ 440px tall
 * The two columns interleave vertically for rhythm; a ~85px gap separates the
 * bottom of one card from the top of the next within a column.
 *
 * Right column (top→bottom): p1 vert(70) · p3 horiz(600) · p5 vert(900) · p7 horiz(1430)
 * Left  column (top→bottom): p2 horiz(320) · p4 vert(620) · p6 horiz(1150) · p8 vert(1450)
 *
 * `image` currently points at the shared horizontal placeholder because no real
 * photos exist yet — replace each `image` with a distinct optimized photo (e.g.
 * "/photos/sunrise.webp") as assets are added; the per-entry `image` field makes
 * distinct images per island trivial.
 */
export const PHOTO_SETS: GallerySet[] = [
  // Top-right first so it clears the top-left central island footprint.
  { id: "p1", x: "60vw", y: 70,   dir: "right", secAlign: "left",   orientation: "vertical",   title: "Golden Hour",   caption: "evening light · 35mm",      image: "/horizontalPlaceholder.png" },
  { id: "p2", x: "21vw", y: 320,  dir: "left",  secAlign: "right",  orientation: "horizontal", title: "City Lines",    caption: "urban geometry",            image: "/horizontalPlaceholder.png" },

  { id: "p3", x: "61vw", y: 600,  dir: "right", secAlign: "right",  orientation: "horizontal", title: "Still Water",   caption: "reflections · long expo",   image: "/horizontalPlaceholder.png" },
  { id: "p4", x: "20vw", y: 620,  dir: "left",  secAlign: "center", orientation: "vertical",   title: "Field Notes",   caption: "open country",              image: "/horizontalPlaceholder.png" },

  { id: "p5", x: "61vw", y: 900,  dir: "right", secAlign: "left",   orientation: "vertical",   title: "Night Market",  caption: "neon · handheld",           image: "/horizontalPlaceholder.png" },
  { id: "p6", x: "20vw", y: 1150, dir: "left",  secAlign: "right",  orientation: "horizontal", title: "Quiet Trail",   caption: "forest path",               image: "/horizontalPlaceholder.png" },

  { id: "p7", x: "60vw", y: 1430, dir: "right", secAlign: "center", orientation: "horizontal", title: "Coastline",     caption: "tide · horizon",            image: "/horizontalPlaceholder.png" },
  { id: "p8", x: "21vw", y: 1450, dir: "left",  secAlign: "right",  orientation: "vertical",   title: "Last Light",    caption: "dusk · silhouettes",        image: "/horizontalPlaceholder.png" },
];
