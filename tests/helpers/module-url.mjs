import { readFileSync } from "node:fs";
import ts from "typescript";

export function moduleUrl(path, replacements = {}) {
  let source = ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  for (const [specifier, target] of Object.entries(replacements)) source = source.replaceAll(`from "${specifier}"`, `from "${target}"`);
  return sourceUrl(source);
}

export function sourceUrl(source) {
  return `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;
}
