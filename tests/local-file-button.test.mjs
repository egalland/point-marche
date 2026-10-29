import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
const bundle = await build({ stdin: { contents: 'export {LocalFileButton} from "./components/local-file-button"; export {LocalSyncContext} from "./components/local-sync-context";', resolveDir: process.cwd(), loader: 'tsx' }, bundle: true, packages: 'external', format: 'cjs', platform: 'node', write: false });
const module = { exports: {} };
new Function('module', 'exports', 'require', bundle.outputFiles[0].text)(module, module.exports, createRequire(import.meta.url));
const { LocalFileButton, LocalSyncContext } = module.exports;
function render(value) { return renderToStaticMarkup(createElement(LocalSyncContext.Provider, { value }, createElement(LocalFileButton, { onOpen() {} }))); }
test('disconnected local workbooks keep the file dialog entry', () => {
  const html = render(null);
  assert.match(html, /aria-label="Fichier local"/);
  assert.doesNotMatch(html, /workspace-sync-dot|role="alert"/);
});
test('shared state is exposed by the menu button, including conflicts and errors', () => {
  for (const status of ['ready', 'syncing', 'waiting', 'error', 'conflict']) {
    const html = render({ status, folder: 'Mon dossier', message: 'État du partage', conflicts: status === 'conflict' ? 2 : 0 });
    assert.match(html, new RegExp(`status-${status}`));
    assert.match(html, /aria-haspopup="dialog"/);
    assert.match(html, /Synchronisation · Mon dossier · État du partage/);
    assert.match(html, /workspace-sync-dot/);
    assert.match(html, status === 'error' || status === 'conflict' ? /role="alert"/ : /role="status"/);
    if (status === 'conflict') assert.match(html, /2 conflit\(s\)/);
  }
});
