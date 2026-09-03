import { build } from "esbuild";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import postcss from "postcss";
import tailwindcss from "@tailwindcss/postcss";

const root = process.cwd();
const outputPath = resolve(process.argv[2] || "MARKET_PULSE_PORTABLE.html");
let embeddedData = "";
if (process.argv[3]) {
  const workspace = await readFile(resolve(process.argv[3]), "utf8");
  const validationBundle = await build({ entryPoints: [resolve(root, "offline/workspace-data.ts")], bundle: true, format: "esm", platform: "node", write: false });
  const validation = await import(`data:text/javascript;base64,${Buffer.from(validationBundle.outputFiles[0].text).toString("base64")}`);
  const data = validation.removeLegacyJiraRequirement(await validation.decodeWorkspace(workspace));
  const encoded = await validation.encodeWorkspace(data);
  embeddedData = `<script type="application/json" id="market-pulse-workspace">${encoded.replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026")}</script>`;
}
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
let fonts = "";
for (const family of ["geist", "geist-mono"]) {
  const directory = resolve(root, "offline/fonts", family);
  let css = await readFile(resolve(directory, "style.css"), "utf8");
  for (const match of css.matchAll(/url\(([^)]+)\)/g)) {
    const font = await readFile(resolve(directory, match[1].replace(/["']/g, "")));
    css = css.replace(match[0], `url(data:font/woff2;base64,${font.toString("base64")})`);
  }
  fonts += css;
}
const fontLayout = JSON.parse(await readFile(resolve(root, "offline/fonts/layout.json"), "utf8"));
fonts += fontLayout.variablesCss;
const stylesheet = fonts + styles.css;
if (/@import\b/.test(stylesheet) || /url\(\s*["']?(?!data:)[^"')\s]+/i.test(stylesheet)) throw new Error("La feuille de style contient une dépendance externe.");
const favicon = (await readFile(resolve(root, "public/favicon.svg"))).toString("base64");
const appearanceBundle = await build({ entryPoints: [resolve(root, "lib/appearance.ts")], bundle: true, format: "esm", platform: "node", write: false });
const { appearanceBootstrapScript } = await import(`data:text/javascript;base64,${Buffer.from(appearanceBundle.outputFiles[0].text).toString("base64")}`);
const safeJavascript = javascript.replace(/<\/script/gi, "<\\/script");
const html = `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; connect-src 'none'; frame-src 'self' blob: data:; worker-src blob:; base-uri 'none'; form-action 'none'; object-src 'none'">
<meta name="color-scheme" content="light dark"><title>Point marché Revêtements et Menuiserie</title><link rel="icon" href="data:image/svg+xml;base64,${favicon}">
<script>${appearanceBootstrapScript}</script><style>${stylesheet}</style></head><body class="${fontLayout.bodyClass}">${embeddedData}<div id="root"></div><script>${safeJavascript}</script></body></html>`;
await writeFile(outputPath, html, "utf8");
console.log(outputPath);
