import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { viteSingleFile } from "vite-plugin-singlefile";

// The single-page build for the Claude artifact: the same screens as the Next app, with
// next/link and next/navigation swapped for an in-memory router, everything inlined into one
// HTML file (fonts included), and the artifact runtime instead of the server route.
const src = fileURLToPath(new URL("./src", import.meta.url));

export default defineConfig({
  plugins: [react(), tailwindcss(), viteSingleFile({ removeViteModuleLoader: true })],
  resolve: {
    alias: [
      { find: /^next\/link$/, replacement: `${src}/spa/next-link.tsx` },
      { find: /^next\/navigation$/, replacement: `${src}/spa/next-navigation.ts` },
      { find: /^@\//, replacement: `${src}/` },
    ],
  },
  define: {
    "process.env.NEXT_PUBLIC_TARGET": JSON.stringify("artifact"),
    "process.env.NEXT_PUBLIC_BUILD_ID": JSON.stringify(String(Date.now())),
    "process.env.NODE_ENV": JSON.stringify("production"),
  },
  // The Next build's postcss config runs Tailwind too; here the Vite plugin does it, once.
  css: { postcss: { plugins: [] } },
  build: {
    outDir: "dist-artifact",
    emptyOutDir: true,
    assetsInlineLimit: 100_000_000,
    cssCodeSplit: false,
    rollupOptions: { input: "spa.html" },
  },
});
