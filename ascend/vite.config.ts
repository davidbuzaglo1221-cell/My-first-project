import { defineConfig, loadEnv, type PluginOption, type ViteDevServer, type PreviewServer } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { pathToFileURL } from "node:url";

// Dev and preview only: serves api/coach.js from the same origin, so the AI coach can be tested locally.
// On Vercel the same file runs as a serverless function.
type Server = ViteDevServer | PreviewServer;

function mountCoachApi(server: Server, mode: string) {
  const env = loadEnv(mode, process.cwd(), "");
  for (const key of ["ANTHROPIC_API_KEY", "ASCEND_ACCESS_TOKEN", "ASCEND_COACH_MODEL"]) {
    if (env[key] && process.env[key] === undefined) process.env[key] = env[key];
  }
  server.middlewares.use("/api/coach", async (req, res) => {
    // Load the handler through Vite so edits are picked up in dev. Preview serves the built server copy.
    const mod = "ssrLoadModule" in server
      ? await (server as ViteDevServer).ssrLoadModule("/api/coach.js")
      : await import(/* @vite-ignore */ pathToFileURL(path.resolve(process.cwd(), "api/coach.js")).href);
    await mod.default(req, res);
  });
}

const coachApiPlugin: PluginOption = {
  name: "ascend-coach-api",
  configureServer(server) {
    mountCoachApi(server, server.config.mode);
  },
  configurePreviewServer(server) {
    mountCoachApi(server, "production");
  },
};

export default defineConfig({
  base: "./",
  plugins: [react(), coachApiPlugin],
  server: { port: 5173 },
});
