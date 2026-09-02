import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";
import { readFileSync } from "node:fs";
import postcss from "postcss";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { moduleUrl, sourceUrl } from "./helpers/module-url.mjs";
import { reactImports, dialogUrl } from "./helpers/ui-modules.mjs";

const appearanceUrl = moduleUrl("../../lib/appearance.ts");
const transportImports = { "@/lib/app-transport": moduleUrl("../../lib/app-transport.ts") };
const { appearanceStorageKey, normalizeAppearance, resolveAppearance, appearanceBootstrapScript } = await import(appearanceUrl);
const { accentTokens, contrastRatio } = await import(moduleUrl("../../lib/color-contrast.ts"));
const providerUrl = moduleUrl("../../components/appearance-provider.tsx", { ...reactImports, ...transportImports, "@/lib/appearance": appearanceUrl });
const iconUrl = moduleUrl("../../components/app-icon.tsx", reactImports);
const { AppearanceProvider } = await import(providerUrl);
const { AppearanceControl, AppearanceSettings } = await import(moduleUrl("../../components/appearance-control.tsx", {
  ...reactImports, "./appearance-provider": providerUrl, "./app-icon": iconUrl, "@/lib/appearance": appearanceUrl,
}));

test("normalizes appearance preferences without changing a report preference", () => {
  for (const mode of ["light", "dark", "system"]) assert.equal(normalizeAppearance(mode), mode);
  for (const value of [null, undefined, "", "automatic", {}, 0]) assert.equal(normalizeAppearance(value), "system");
  assert.equal(resolveAppearance("system", true), "dark");
  assert.equal(resolveAppearance("system", false), "light");
  assert.equal(resolveAppearance("light", true), "light");
  assert.equal(resolveAppearance("dark", false), "dark");
});

test("sets the saved theme before hydration and tolerates unavailable browser storage", () => {
  for (const [saved, prefersDark, expected] of [["light", true, "light"], ["dark", false, "dark"], [null, true, "dark"], ["invalid", false, "light"]]) {
    const dataset = {};
    vm.runInNewContext(appearanceBootstrapScript, {
      document: { documentElement: { dataset } },
      localStorage: { getItem(key) { assert.equal(key, appearanceStorageKey); return saved; } },
      window: { matchMedia: () => ({ matches: prefersDark }) },
    });
    assert.equal(dataset.theme, expected);
    assert.equal(dataset.appearance, normalizeAppearance(saved));
  }
  const dataset = {};
  vm.runInNewContext(appearanceBootstrapScript, {
    document: { documentElement: { dataset } },
    localStorage: { getItem() { throw new Error("Storage blocked"); } },
    window: { matchMedia: () => ({ matches: true }) },
  });
  assert.equal(dataset.theme, "dark");
});

test("preserves readable text and custom accent contrast in both themes", () => {
  const colors = ["#72f5c5", "#91e7ff", "#bcafff", "#ffbc8b", "#ff7c98", "#000000", "#ffffff", "#808080", "#0000ff", "#ffff00", "bad"];
  for (const color of colors) {
    const tokens = accentTokens(color);
    assert.ok(contrastRatio(tokens["--accent-light"], "#eaf0f6") >= 4.5, color);
    assert.ok(contrastRatio(tokens["--accent-dark"], "#1b2a3c") >= 4.5, color);
    for (const mode of ["light", "dark"]) assert.ok(contrastRatio(tokens[`--on-accent-${mode}`], tokens[`--accent-${mode}`]) >= 4.5, `${color} ${mode}`);
  }
  const css = postcss.parse(readFileSync(new URL("../app/styles/theme.css", import.meta.url), "utf8"));
  for (const selector of [":root", ':root[data-theme="dark"]']) {
    const colors = new Map(css.nodes.find((rule) => rule.selector === selector).nodes.map(({ prop, value }) => [prop, value]));
    for (const text of ["--text", "--muted", "--mint", "--aqua", "--violet", "--peach", "--red"]) {
      assert.ok(contrastRatio(colors.get(text), colors.get("--surface")) >= 4.5, `${selector} ${text}`);
    }
  }
});

test("renders theme controls and an accessible current destination without client storage", async () => {
  const html = renderToStaticMarkup(createElement(AppearanceProvider, null, createElement(AppearanceControl), createElement(AppearanceSettings)));
  assert.match(html, /Mode clair/);
  assert.match(html, /Mode sombre/);
  assert.match(html, /Système/);
  assert.match(html, /aria-pressed="true"/);
  assert.match(html, /fond blanc des mails/);
  const { WorkspaceNavigation } = await import(moduleUrl("../../features/market-pulse/workspace-navigation.tsx", { ...reactImports, ...transportImports, "@/components/app-dialog": dialogUrl, "@/components/app-icon": iconUrl }));
  const nav = renderToStaticMarkup(createElement(WorkspaceNavigation, { view: "imports", userName: null, onSelect() {}, onLogin() {}, onLogout() {} }));
  assert.equal((nav.match(/aria-current="page"/g) ?? []).length, 1);
  assert.match(nav, /Centre d’import/);
  assert.match(nav, /Mode lecture/);
  assert.match(nav, /Ouvrir la navigation/);
});

test("theme controller follows system changes only in system mode and syncs other tabs", async (t) => {
  const hooksUrl = sourceUrl(`export * from "${reactImports.react}"; export const effects=[]; export const useEffect=setup=>effects.push(setup); export const useCallback=fn=>fn; export const useRef=value=>({current:value}); export const useState=value=>[value,()=>{}];`);
  const { effects } = await import(hooksUrl);
  const { AppearanceProvider: Controller } = await import(moduleUrl("../../components/appearance-provider.tsx", { ...reactImports, ...transportImports, react: hooksUrl, "@/lib/appearance": appearanceUrl }));
  const windowListeners = new Map(); const mediaListeners = new Map(); const writes = [];
  const dataset = {};
  const media = { matches: false, addEventListener: (key, callback) => mediaListeners.set(key, callback), removeEventListener: (key) => mediaListeners.delete(key) };
  const previousWindow = globalThis.window; const previousDocument = globalThis.document;
  globalThis.window = { localStorage: { getItem: () => "system", setItem: (...args) => writes.push(args) }, matchMedia: () => media, addEventListener: (key, callback) => windowListeners.set(key, callback), removeEventListener: (key) => windowListeners.delete(key) };
  globalThis.document = { documentElement: { dataset } };
  t.after(() => { globalThis.window = previousWindow; globalThis.document = previousDocument; });
  const output = Controller({ children: null });
  const cleanup = effects[0]();
  assert.equal(dataset.theme, "light");
  media.matches = true; mediaListeners.get("change")();
  assert.equal(dataset.theme, "dark");
  output.props.value.chooseMode("light");
  mediaListeners.get("change")();
  assert.equal(dataset.theme, "light");
  assert.deepEqual(writes, [[appearanceStorageKey, "light"]]);
  windowListeners.get("storage")({ key: appearanceStorageKey, newValue: "dark" });
  assert.equal(dataset.theme, "dark");
  media.matches = false;
  windowListeners.get("storage")({ key: null, newValue: null });
  assert.equal(dataset.appearance, "system");
  assert.equal(dataset.theme, "light");
  assert.equal(writes.length, 1);
  cleanup();
  assert.equal(windowListeners.size + mediaListeners.size, 0);
});

test("modular styles contain valid selectors and resolved local design tokens", () => {
  const names = ["theme", "analyst", "components", "workspace", "simulations"];
  const definitions = new Set(["--font-geist-sans", "--font-geist-mono", "--accent-light", "--accent-dark", "--on-accent-light", "--on-accent-dark", "--swatch"]);
  const used = new Set();
  for (const name of names) {
    const css = postcss.parse(readFileSync(new URL(`../app/styles/${name}.css`, import.meta.url), "utf8"));
    css.walkRules((rule) => assert.ok(rule.selector.trim(), `${name}: empty selector`));
    css.walkDecls((decl) => {
      if (decl.prop.startsWith("--")) definitions.add(decl.prop);
      for (const match of decl.value.matchAll(/var\((--[\w-]+)/g)) used.add(match[1]);
      if (decl.prop.startsWith("--")) assert.ok(!decl.value.includes(`var(${decl.prop})`), `${name}: cyclic ${decl.prop}`);
    });
  }
  assert.deepEqual([...used].filter((name) => !definitions.has(name)), []);
});
