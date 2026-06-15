// Optimize oversized wallpaper PNGs into web-friendly WebP assets.
//
// Reads each source PNG from `assets-src/wallpapers/`, downscales it to a max
// width of 2560px (retina-adequate for a full-screen `background-size: cover`),
// and encodes WebP at quality ~80. Outputs are written to `public/` where they
// are served by the app. The original PNGs live outside `public/` so they are
// never bundled or served.
//
// Run with: npm run optimize:wallpapers

import sharp from "sharp";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { stat } from "node:fs/promises";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const SRC_DIR = join(ROOT, "assets-src", "wallpapers");
const OUT_DIR = join(ROOT, "public");

const MAX_WIDTH = 2560;
const QUALITY = 80;

const WALLPAPERS = [
  { src: "bioWallpaper.png", out: "bioWallpaper.webp" },
  { src: "photosWallpaper.png", out: "photosWallpaper.webp" },
  { src: "codingWallpaper.png", out: "codingWallpaper.webp" },
];

function mb(bytes) {
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

async function optimize({ src, out }) {
  const srcPath = join(SRC_DIR, src);
  const outPath = join(OUT_DIR, out);

  const srcSize = (await stat(srcPath)).size;

  const info = await sharp(srcPath)
    // Only shrink; never enlarge a smaller source.
    .resize({ width: MAX_WIDTH, withoutEnlargement: true })
    .webp({ quality: QUALITY })
    .toFile(outPath);

  const outSize = (await stat(outPath)).size;

  console.log(
    `${src} (${mb(srcSize)}) -> ${out} (${mb(outSize)}, ${info.width}x${info.height})`
  );
}

async function main() {
  console.log(`Optimizing wallpapers (max width ${MAX_WIDTH}px, quality ${QUALITY})...`);
  for (const wp of WALLPAPERS) {
    await optimize(wp);
  }
  console.log("Done.");
}

main().catch((err) => {
  console.error("Wallpaper optimization failed:", err);
  process.exit(1);
});
