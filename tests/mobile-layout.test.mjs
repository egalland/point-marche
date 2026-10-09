import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import postcss from "postcss";

const globals = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
const mobileSource = readFileSync(new URL("../app/styles/mobile.css", import.meta.url), "utf8");
const appSource = readFileSync(new URL("../features/market-pulse/point-preview.tsx", import.meta.url), "utf8");

test("loads the shared mobile layer last and keeps every responsive selector valid", () => {
  const imports = [...globals.matchAll(/@import\s+["']([^"']+)["']/g)].map((match) => match[1]);
  assert.ok(imports.indexOf("./styles/mobile.css") > imports.indexOf("./styles/components.css"));
  const css = postcss.parse(mobileSource);
  const media = css.nodes.filter((node) => node.type === "atrule" && node.name === "media").map((node) => node.params);
  assert.ok(media.includes("(max-width: 700px)"));
  assert.ok(media.includes("(max-width: 430px)"));
  css.walkRules((rule) => assert.ok(rule.selector.trim(), "mobile: empty selector"));
});

test("mobile point editing keeps one touch-friendly layout control", () => {
  assert.match(appSource, /className="canvas-module-options"/);
  assert.match(appSource, /aria-haspopup="menu"/);
  assert.doesNotMatch(appSource, /className="surface market-layout-settings"/);
  assert.doesNotMatch(appSource, /<ModuleLayoutEditor modules=\{pointModules\}/);
  assert.match(mobileSource, /\.canvas-context-menu\s*\{[^}]*bottom:\s*12px/s);
  assert.match(mobileSource, /\.report-module-item\.width-two-thirds/);
});
