import { build } from "esbuild";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = process.cwd();
const outputPath = resolve(process.argv[2] || "MARKET_PULSE_PORTABLE.html");
const bundle = await build({
  entryPoints: [resolve(root, "offline/entry.tsx")],
  bundle: true,
  minify: true,
  format: "iife",
  platform: "browser",
  target: ["chrome110", "edge110"],
  jsx: "automatic",
  write: false,
});
const javascript = bundle.outputFiles.find((file) => file.path.endsWith(".js"))?.text ?? bundle.outputFiles[0]?.text;
if (!javascript) throw new Error("Le bundle JavaScript n'a pas été généré.");
const stylesheet = (await readFile(resolve(root, "app/globals.css"), "utf8")).replace(/^@import\s+["']tailwindcss["'];?\s*/m, "");
const safeJavascript = javascript.replace(/<\/script/gi, "<\\/script");
const html = `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark"><title>Market Pulse — Outil portable</title>
<style>${stylesheet}</style></head><body><div id="root"></div><script>${safeJavascript}</script></body></html>`;
await writeFile(outputPath, html, "utf8");
console.log(outputPath);
