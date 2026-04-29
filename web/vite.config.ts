import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// GitHub Project Pages: /news/ ; local dev: /
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  base: process.env.CI === "true" || process.env.GITHUB_ACTIONS === "true" ? "/news/" : "/",
  build: {
    outDir: "dist",
    sourcemap: false,
  },
});
