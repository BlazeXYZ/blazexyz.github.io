/** @type {import('next').NextConfig} */
const nextConfig = {
  // Produce a fully static site in the `out/` folder when you run `npm run build`.
  // This is what GitHub Pages serves (it only hosts static files, no Node server).
  output: "export",

  // GitHub Pages does not run Next.js's image optimizer, so serve images as-is.
  images: { unoptimized: true },

  // Avoids 404s on GitHub Pages by emitting folder/index.html instead of folder.html.
  trailingSlash: true,
};

export default nextConfig;
