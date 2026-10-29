import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
async function load(path) {
  const result = await build({ entryPoints: [path], bundle: true, packages: 'external', format: 'cjs', platform: 'node', write: false, logLevel: 'silent' });
  const m = { exports: {} }; new Function('require', 'module', 'exports', result.outputFiles[0].text)(createRequire(import.meta.url), m, m.exports); return m.exports;
}
const { AnalystPointCanvas } = await load('features/market-pulse/analyst-point-canvas.tsx');
const { siteMapGroups, siteMapXml } = await load('lib/site-map.ts');
const { GET } = await load('app/sitemap.xml/route.ts');
const props = { order: ['overview', 'planner', 'cycle20'], widths: { overview: 'full', planner: 'half', cycle20: 'half' }, visible: { overview: true, planner: true, cycle20: true }, includeCycle20: false, editing: null, onEdit() {}, onOrder() {}, onWidth() {}, onVisibility() {}, onSettings() {}, children: id => createElement('p', null, `Contenu ${id}`) };
test('analyst point starts in reading mode and keeps only enabled modules', () => {
  const html = renderToStaticMarkup(createElement(AnalystPointCanvas, props));
  assert.match(html, /Contenu overview/); assert.match(html, /Contenu planner/);
  assert.doesNotMatch(html, /Contenu cycle20|Terminer|is-selected|<textarea|<input/);
  assert.match(html, /Outils du point/); assert.match(html, /role="slider"/);
  assert.match(html, /grid-column:span 6/);
});
test('only the selected analyst block has editing tools', () => {
  const html = renderToStaticMarkup(createElement(AnalystPointCanvas, { ...props, editing: 'planner', includeCycle20: true }));
  assert.equal((html.match(/is-selected/g) ?? []).length, 1);
  assert.equal((html.match(/>Terminer</g) ?? []).length, 1);
  assert.match(html, /Contenu cycle20/);
});
test('sitemap uses real application deep links, excludes APIs and stays valid XML', async () => {
  const pages = siteMapGroups.flatMap(group => group.pages);
  assert.equal(new Set(pages.map(page => page.href)).size, pages.length);
  assert.ok(pages.some(page => page.href === '/?mode=analyst'));
  assert.ok(pages.some(page => page.href === '/aide'));
  const xml = siteMapXml('https://example.test');
  assert.equal((xml.match(/<url>/g) ?? []).length, 14);
  assert.doesNotMatch(xml, /\/api\/|analystId|supplier=/);
  assert.match(siteMapXml('https://example.test/?x=1&y=2'), /<urlset/);
  const response = GET(new Request('https://example.test/sitemap.xml'));
  assert.match(response.headers.get('content-type'), /application\/xml/);
  assert.equal(await response.text(), xml);
});
const analystModel = await load('lib/analyst-point.ts');
const analystExport = await load('lib/analyst-point-export.ts');
test('all analyst block widths survive persistence and appear in the web attachment', () => {
  const analyst = { id: 'a', name: 'Analyste', email: '', role: 'analyste-tarif-referentiel', marketIds: [] };
  const data = analystModel.initialAnalystPoint(analyst);
  data.preferences.widths.overview = 'quarter';
  data.preferences.widths.planner = 'three-quarters';
  const restored = analystModel.normalizeAnalystPoint(JSON.parse(JSON.stringify(data)), analyst);
  assert.equal(restored.preferences.widths.overview, 'quarter');
  assert.equal(restored.preferences.widths.planner, 'three-quarters');
  const stats = { contributions: [], simulations: 0, controls: 0, totalActivities: 0, distinctTasks: 0 };
  const html = analystExport.analystInteractiveHtml(restored, analyst, stats, null);
  assert.match(html, /grid-template-columns:repeat\(12/);
  assert.match(html, /data-module="overview" style="--columns:3"/);
  assert.match(html, /data-module="planner" style="--columns:9"/);
});
