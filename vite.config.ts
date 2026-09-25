import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

// Stamp the service worker with a unique build version so installed apps pick up updates.
function swVersion(): Plugin {
  let outDir = "dist";
  return {
    name: "sw-version",
    apply: "build",
    configResolved(c) { outDir = c.build.outDir; },
    closeBundle() {
      // GitHub Pages has no server rewrites: serve the app for unknown paths too.
      const idx = resolve(outDir, "index.html");
      if (existsSync(idx)) writeFileSync(resolve(outDir, "404.html"), readFileSync(idx));
      const p = resolve(outDir, "sw.js");
      if (!existsSync(p)) return;
      const v = new Date().toISOString().replace(/\D/g, "").slice(0, 14);
      writeFileSync(p, readFileSync(p, "utf8").replace("__BUILD_VERSION__", v));
    },
  };
}

export default defineConfig({
  base: process.env.BASE_PATH || "/",
  plugins: [react(), swVersion()],
  build: { target: "es2020", chunkSizeWarningLimit: 700 },
});
