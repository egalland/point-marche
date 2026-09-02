import { build } from "esbuild";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import postcss from "postcss";
import tailwindcss from "@tailwindcss/postcss";

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
const cssEntry = resolve(root, "offline/entry.css");
const styles = await postcss([tailwindcss({ base: root, optimize: { minify: true } })]).process(await readFile(cssEntry, "utf8"), { from: cssEntry });
const stylesheet = styles.css;
if (/@import\b/.test(stylesheet) || /url\(\s*["']?https?:/i.test(stylesheet)) throw new Error("La feuille de style contient une dépendance externe.");
const appearanceBundle = await build({ entryPoints: [resolve(root, "lib/appearance.ts")], bundle: true, format: "esm", platform: "node", write: false });
const { appearanceBootstrapScript } = await import(`data:text/javascript;base64,${Buffer.from(appearanceBundle.outputFiles[0].text).toString("base64")}`);
const safeJavascript = javascript.replace(/<\/script/gi, "<\\/script");
const html = `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; connect-src 'none'; frame-src 'self' blob: data:; worker-src blob:; base-uri 'none'; form-action 'none'; object-src 'none'">
<meta name="color-scheme" content="light dark"><title>Market Pulse — Outil portable</title>
<script>${appearanceBootstrapScript}</script><style>${stylesheet}</style></head><body><div id="root"></div><script>${safeJavascript}</script></body></html>`;
await writeFile(outputPath, html, "utf8");
console.log(outputPath);
