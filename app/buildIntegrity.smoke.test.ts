/**
 * buildIntegrity.smoke.test.ts
 * ──────────────────────────────────────────────────────────────────────────────
 * Build-integrity / edge-case smoke tests (design "Testing Strategy", Task 15.2).
 *
 * Two structural concerns are covered without rendering anything:
 *
 *   • Type & purity of the content templates (Req 2.1, 2.2, 2.7, 8.4):
 *       - `PROJECT_SETS` / `PHOTO_SETS` type-check as `GallerySet[]` (enforced at
 *         compile time by assigning them to a `const x: GallerySet[] =`).
 *       - `galleryData.ts` imports NO React / rendering code (parsed from source):
 *         no `import ... from "react"`, no `.tsx` imports, no JSX — it is pure
 *         data + a pure function, editable independently of rendering.
 *
 *   • Wallpaper onerror / stall path resolves the ready gate (Req 3.6):
 *       - The preload wires `img.onload = img.onerror = () => { ... }` so a
 *         failed/stalled image still increments the loaded counter and resolves
 *         the ready gate via `setWallReady(true)` — preventing a flash-of-black
 *         and never stranding the shell at opacity:0.
 *
 * Feature: photos-page-and-content-templates
 * _Requirements: 2.1, 2.2, 2.7, 3.6, 8.4_
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { PROJECT_SETS, PHOTO_SETS, type GallerySet } from "./galleryData";

const here = dirname(fileURLToPath(import.meta.url));
const galleryDataSrc = readFileSync(resolve(here, "galleryData.ts"), "utf8");
const pageSrc = readFileSync(resolve(here, "page.tsx"), "utf8");

// Strip block + line comments so prose inside doc comments never trips the
// import/JSX purity assertions below.
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}
const galleryDataCode = stripComments(galleryDataSrc);

// ── Req 2.1, 2.2, 8.4 — templates type-check as GallerySet[] ──
describe("build integrity — templates type-check as GallerySet[] (Req 2.1, 2.2, 8.4)", () => {
  it("PROJECT_SETS is assignable to GallerySet[]", () => {
    // Compile-time enforcement: if PROJECT_SETS drifts from GallerySet[] this
    // assignment stops type-checking and the test build fails.
    const x: GallerySet[] = PROJECT_SETS;
    expect(Array.isArray(x)).toBe(true);
    expect(x.length).toBeGreaterThan(0);
  });

  it("PHOTO_SETS is assignable to GallerySet[]", () => {
    const x: GallerySet[] = PHOTO_SETS;
    expect(Array.isArray(x)).toBe(true);
    expect(x.length).toBeGreaterThan(0);
  });

  it("every entry exposes the required typed fields", () => {
    for (const set of [...PROJECT_SETS, ...PHOTO_SETS]) {
      expect(typeof set.id).toBe("string");
      expect(typeof set.x).toBe("string");
      expect(typeof set.y).toBe("number");
      expect(["left", "right"]).toContain(set.dir);
      expect(["left", "center", "right"]).toContain(set.secAlign);
      expect(typeof set.title).toBe("string");
    }
  });
});

// ── Req 2.7, 8.4 — galleryData.ts imports no React / rendering code ──
describe("build integrity — galleryData.ts is pure data (no React / rendering imports) (Req 2.7, 8.4)", () => {
  it("does not import from 'react' or 'react-dom'", () => {
    expect(galleryDataCode).not.toMatch(/from\s+["']react["']/);
    expect(galleryDataCode).not.toMatch(/from\s+["']react-dom["']/);
    expect(galleryDataCode).not.toMatch(/from\s+["']react\//);
  });

  it("does not import any .tsx / rendering module", () => {
    expect(galleryDataCode).not.toMatch(/from\s+["'][^"']*\.tsx["']/);
    // No imports of the rendering components.
    expect(galleryDataCode).not.toMatch(/from\s+["']\.\/(Gallery|CodePage|page)["']/);
    // No CSS module imports.
    expect(galleryDataCode).not.toMatch(/import\s+[^;]*\.css["']/);
  });

  it("contains no JSX (no rendering output)", () => {
    // A pure data module never returns markup. Guard against JSX-specific
    // syntax — closing tags (`</div>`) and fragments (`<>`) — which TypeScript
    // generics like `Required<GallerySet>` never produce.
    expect(galleryDataCode).not.toMatch(/<\/[A-Za-z][^>]*>/);
    expect(galleryDataCode).not.toMatch(/<>/);
    expect(galleryDataCode).not.toMatch(/React\./);
  });
});

// ── Req 3.6 — wallpaper onerror / stall path resolves the ready gate ──
describe("flash-of-black prevention — onerror/stall still resolves the ready gate (Req 3.6)", () => {
  const code = stripComments(pageSrc);

  it("wires img.onload and img.onerror to the same handler", () => {
    // A single handler shared by onload and onerror means a failed/stalled image
    // follows the exact same resolution path as a successful one.
    expect(code).toMatch(/img\.onload\s*=\s*img\.onerror\s*=\s*\(\s*\)\s*=>/);
  });

  it("the shared handler increments the loaded counter and resolves the gate when all are accounted for", () => {
    // Extract the handler body wired to onload = onerror = () => { ... }.
    const m = code.match(/img\.onload\s*=\s*img\.onerror\s*=\s*\(\s*\)\s*=>\s*\{([\s\S]*?)\};/);
    expect(m).not.toBeNull();
    const body = m![1];
    // The counter advances regardless of success vs. error (no branch on event).
    expect(body).toMatch(/\+\+loaded/);
    // When every source is accounted for, the ready gate flips true.
    expect(body).toMatch(/===\s*srcs\.length/);
    expect(body).toMatch(/setWallReady\(true\)/);
  });

  it("the shell stays hidden until wallReady (gate not stranded by a failed asset)", () => {
    // The shell opacity is gated solely on wallReady, which the shared handler
    // resolves even on error — so a stalled/404 asset cannot strand opacity:0.
    expect(code).toMatch(/wallReady\s*\?\s*styles\.shellReady/);
  });
});
