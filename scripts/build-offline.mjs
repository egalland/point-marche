import { build } from "esbuild";
import { writeFile } from "node:fs/promises";
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
const styles = await build({ entryPoints: [resolve(root, "app/globals.css")], bundle: true, minify: true, external: ["tailwindcss"], write: false });
const stylesheet = styles.outputFiles[0].text.replace(/@import\s*["']tailwindcss["'];?\s*/g, "");
const appearanceBundle = await build({ entryPoints: [resolve(root, "lib/appearance.ts")], bundle: true, format: "esm", platform: "node", write: false });
const { appearanceBootstrapScript } = await import(`data:text/javascript;base64,${Buffer.from(appearanceBundle.outputFiles[0].text).toString("base64")}`);
const safeJavascript = javascript.replace(/<\/script/gi, "<\\/script");
const html = `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light dark"><title>Market Pulse — Outil portable</title>
<script>${appearanceBootstrapScript}</script><style>${stylesheet}</style></head><body><div id="root"></div><script>${safeJavascript}</script></body></html>`;
await writeFile(outputPath, html, "utf8");
console.log(outputPath);
