// Local server with the same routes as the Vercel deployment: /api/chat, /api/status and the dashboard.
// Reads settings from the environment (and .env.local when present). Never logs a key.
import { createServer } from "node:http";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { handleChat, handleOptions, handleStatus } from "../src/http.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const envFile = join(root, ".env.local");
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, "utf8").split("\n")) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (m && m[2] && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
  }
}
const port = Number(process.env.PORT ?? 3210);
const page = () => readFileSync(join(root, "public/index.html"));

createServer(async (req, res) => {
  const url = `http://localhost:${port}${req.url}`;
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  const request = new Request(url, {
    method: req.method,
    headers: req.headers as Record<string, string>,
    body: req.method === "GET" || req.method === "HEAD" ? undefined : Buffer.concat(chunks),
  });
  let response: Response;
  const path = new URL(url).pathname;
  if (req.method === "OPTIONS") response = handleOptions(request, process.env);
  else if (path === "/api/chat" && req.method === "POST") response = await handleChat(request, process.env);
  else if (path === "/api/status" && req.method === "GET") response = await handleStatus(request, process.env);
  else if (path === "/" || path === "/index.html") response = new Response(page(), { headers: { "content-type": "text/html; charset=utf-8" } });
  else response = new Response("not found", { status: 404 });
  res.writeHead(response.status, Object.fromEntries(response.headers));
  res.end(Buffer.from(await response.arrayBuffer()));
}).listen(port, "127.0.0.1", () => console.log(`ai-gateway on http://127.0.0.1:${port}`));
