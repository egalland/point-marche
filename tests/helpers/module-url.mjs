import { existsSync, readFileSync } from "node:fs";
import ts from "typescript";

export function moduleUrl(path, replacements = {}) {
  const file = new URL(path, import.meta.url);
  let source = ts.transpileModule(readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  for (const [specifier, target] of Object.entries(replacements)) source = source.replaceAll(`from "${specifier}"`, `from "${target}"`);
  source = source.replace(/from "(\.{1,2}\/[^\"]+)"/g, (match, specifier) => {
    const target = new URL(specifier, file);
    const resolved = [target, new URL(`${target.href}.ts`), new URL(`${target.href}.tsx`)].find(existsSync);
    return resolved ? `from "${moduleUrl(resolved.href)}"` : match;
  });
  return sourceUrl(source);
}

export function sourceUrl(source) {
  return `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;
}
