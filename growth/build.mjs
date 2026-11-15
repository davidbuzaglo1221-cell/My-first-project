// Inlines content.js and the face photos into the page: node build.mjs -> dist/app.html
import fs from "node:fs";
const dir = new URL(".", import.meta.url).pathname;
const faces = Object.fromEntries(fs.readdirSync(dir + "faces").filter((f) => f.endsWith(".jpg")).map((f) => [f.slice(0, -4), "data:image/jpeg;base64," + fs.readFileSync(dir + "faces/" + f).toString("base64")]));
const page = fs.readFileSync(dir + "app.src.html", "utf8")
  .replace("/*CONTENT*/", () => fs.readFileSync(dir + "content.js", "utf8"))
  .replace("/*FACES*/", () => "window.FACE_IMG = " + JSON.stringify(faces) + ";");
fs.mkdirSync(dir + "dist", { recursive: true });
fs.writeFileSync(dir + "dist/app.html", page);
console.log("dist/app.html", (page.length / 1024).toFixed(0) + " KB");
