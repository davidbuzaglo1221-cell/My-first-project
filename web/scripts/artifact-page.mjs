// Turns the single-file Vite build into the page the Artifact tool publishes: the tool wraps the
// file in its own <!doctype>/<html>/<head>/<body>, so this keeps only the title, the styles, the
// app root and the script, in that order.
import { readFileSync, writeFileSync } from "node:fs";

const html = readFileSync("dist-artifact/spa.html", "utf8");
const grab = (re) => [...html.matchAll(re)].map((m) => m[0]);
const styles = grab(/<style[^>]*>[\s\S]*?<\/style>/g);
const scripts = grab(/<script[^>]*>[\s\S]*?<\/script>/g);
if (!styles.length || !scripts.length) throw new Error("build output is missing its styles or script");

const page = [
  "<title>אימונים ותזונה</title>",
  '<meta name="claude:viewport-fit-sides" content="cover">',
  ...styles,
  '<div id="root"></div>',
  ...scripts,
].join("\n");
writeFileSync("dist-artifact/app.html", page);
console.log(`app.html: ${(page.length / 1024 / 1024).toFixed(2)} MB`);
