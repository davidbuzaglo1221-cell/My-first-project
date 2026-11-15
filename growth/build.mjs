// Inlines content.js into the page: node build.mjs -> dist/app.html
import fs from "node:fs";
const dir = new URL(".", import.meta.url).pathname;
const page = fs.readFileSync(dir + "app.src.html", "utf8").replace("/*CONTENT*/", () => fs.readFileSync(dir + "content.js", "utf8"));
fs.mkdirSync(dir + "dist", { recursive: true });
fs.writeFileSync(dir + "dist/app.html", page);
console.log("dist/app.html", (page.length / 1024).toFixed(0) + " KB");
