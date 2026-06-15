import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  // `@vitejs/plugin-react` and `vitest` resolve different copies of `vite`,
  // so `react()` produces a `Plugin` typed against a different vite instance
  // than `defineConfig` expects. The cast bridges the structurally-identical
  // but nominally-distinct `Plugin` types; runtime behavior is unaffected.
  plugins: [react() as never],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
  },
});
