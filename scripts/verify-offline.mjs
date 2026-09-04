import assert from 'node:assert/strict';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { Script } from 'node:vm';

const input = process.argv[2];
const reportPath = process.argv[3];
if (!input || !reportPath) throw new Error('Usage: node scripts/verify-offline.mjs APP.html VERIFICATION.json');
const root = process.cwd();
const html = await readFile(resolve(input), 'utf8');
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)];
let executableScripts = 0;
for (const [, attributes, source] of scripts) {
  assert.doesNotMatch(attributes, /\bsrc\s*=/i, 'External JavaScript');
  if (/application\/json/.test(attributes)) continue;
  new Script(source);
  executableScripts += 1;
}
assert.equal(executableScripts, 2);
assert.match(html, /connect-src 'none'/);
assert.doesNotMatch(html, /<link\b[^>]*href=["']https?:/i);
const css = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)].map((match) => match[1]).join('\n');
assert.doesNotMatch(css, /@import\b/);
for (const match of css.matchAll(/url\(\s*["']?([^"')\s]+)/g)) assert.ok(match[1].startsWith('data:'), 'External style resource');
assert.doesNotMatch(css, /\.offline-(?:filebar|welcome|app-content|shell)\b/);
const embeddedFonts = [...css.matchAll(/url\(data:font\/woff2;base64,([A-Za-z0-9+/=]+)\)/g)].map((match) => sha(Buffer.from(match[1], 'base64'))).sort();
const sourceFonts = [];
for (const family of ['geist', 'geist-mono']) {
  const directory = resolve(root, 'offline/fonts', family);
  const origin = resolve(root, '.vinext/fonts', family === 'geist' ? 'geist-8ac0455e797f' : 'geist-mono-00e989178794');
  for (const name of await readdir(directory)) if (name.endsWith('.woff2')) {
    const fontHash = sha(await readFile(resolve(directory, name)));
    assert.equal(fontHash, sha(await readFile(resolve(origin, name))), `Site font changed: ${name}`);
    sourceFonts.push(fontHash);
  }
}
assert.deepEqual(embeddedFonts, sourceFonts.sort());
const layout = JSON.parse(await readFile(resolve(root, 'offline/fonts/layout.json'), 'utf8'));
assert.ok(html.includes(`<body class="${layout.bodyClass}">`));
assert.ok(css.includes(layout.variablesCss));
const localEntry = await readFile(resolve(root, 'offline/offline-app.tsx'), 'utf8');
assert.match(localEntry, /import \{ MarketPulseApp \} from "\.\.\/features\/market-pulse\/market-pulse-app"/);
assert.match(localEntry, /<MarketPulseApp\s*\/>/);
assert.doesNotMatch(localEntry, /className="offline-(?:welcome|filebar|shell)/);
assert.doesNotMatch(localEntry, /completeMigration|market-pulse-migration|csvInput/);
const importCenter = await readFile(resolve(root, 'features/market-pulse/import-center.tsx'), 'utf8');
assert.doesNotMatch(importCenter, /localMigrationRequired|completeLocalMigration|registryWarning/);

const presentationPaths = [
  'app/styles/theme.css', 'app/styles/components.css', 'app/styles/workspace.css', 'app/styles/analyst.css', 'app/styles/simulations.css',
  'components/app-icon.tsx', 'components/appearance-control.tsx', 'components/action-menu.tsx', 'components/app-dialog.tsx',
  'features/market-pulse/supplier-mini-chart.tsx', 'features/market-pulse/supplier-variation-dashboard.tsx',
  'features/market-pulse/analyst-stats-dashboard.tsx', 'features/market-pulse/analyst-jira-panel.tsx',
  'lib/supplier-mini-trend.ts', 'lib/analyst-jira-history-html.ts',
];
const baseline = '5b669025992454e15a02e351a00847dc974a9f6e';
const unchanged = [];
for (const path of presentationPaths) {
  const original = execFileSync('git', ['show', `${baseline}:${path}`], { cwd: root });
  const current = await readFile(resolve(root, path));
  assert.equal(sha(original), sha(current), `Site V38 presentation changed: ${path}`);
  unchanged.push({ path, sha256: sha(current) });
}
const jsonBlock = scripts.find((match) => /id="market-pulse-workspace"/.test(match[1]));
assert.ok(jsonBlock, 'Embedded data missing');
const envelope = JSON.parse(jsonBlock[2]);
assert.equal(envelope.checksum, sha(JSON.stringify(envelope.data)));
assert.equal(envelope.format, 'market-pulse-local');
const data = envelope.data;
assert.equal(data.source?.pendingJira, undefined);
assert.match(importCenter, /import \{ appFetch as fetch \} from "@\/lib\/app-transport"/);
assert.match(importCenter, /onManual/);
assert.match(css, /\.meeting-edit-dialog/);
assert.match(css, /\.market-comparison-grid/);
const marketPoint = await readFile(resolve(root, 'features/market-pulse/market-pulse-app.tsx'), 'utf8');
assert.match(marketPoint, /Modification active/);
assert.match(marketPoint, /ModuleInsertion/);
assert.match(marketPoint, /Modifiée? dans le point/);
assert.match(marketPoint, /Valeur importée/);
const navigation = await readFile(resolve(root, 'features/market-pulse/workspace-navigation.tsx'), 'utf8');
assert.doesNotMatch(navigation, /Préparer le point/);
const featurePaths = ['app/globals.css', 'app/styles/meeting.css', 'features/market-pulse/market-pulse-app.tsx', 'features/market-pulse/workspace-navigation.tsx', 'features/market-pulse/analyst-point-dashboard.tsx', 'features/market-pulse/import-center.tsx', 'features/market-pulse/source-mode-control.tsx', 'features/market-pulse/manual-analyst-jira.tsx', 'features/market-pulse/market-comparison.tsx', 'lib/analyst-point.ts', 'lib/analyst-point-export.ts', 'lib/market-simulation.ts', 'lib/point-source-mode.ts', 'lib/point-planner-enrichment.ts', 'lib/planner-registry.ts', 'lib/market-comparison.ts', 'lib/mail-draft.ts'];
const featureSources = [];
for (const path of featurePaths) featureSources.push({ path, sha256: sha(await readFile(resolve(root, path))) });
const report = {
  checkedAt: new Date().toISOString(), sourceVersion: 40, baseline,
  htmlSha256: sha(html), htmlBytes: Buffer.byteLength(html), parsedScripts: executableScripts,
  externalPresentationResources: 0, embeddedFonts: embeddedFonts.length,
  bodyFontClasses: layout.bodyClass, unchangedPresentationFiles: unchanged,
  opensSharedApplication: true, separateWelcomeOrTopBar: false,
  data: { markets: data.markets.length, people: data.users.length, marketPoints: data.points.length, analystPoints: data.analystPoints.length, plannerTasks: data.plannerTasks.length, jiraTickets: data.jiraTickets.length, jiraImports: data.jiraImports.length },
  sharedImportCenter: true, originalCsvRequired: false,
  requestedFeatures: ['Direct editing in the market point with a guarded switch', 'Composable point blocks', 'Final business state only for simulations', 'Persistent field overrides over Jira and Planner imports', 'Email draft with formatted body and HTML page attachment', 'Persistent manual source modes', 'Optional market comparison pie chart'],
  featureSources,
  adaptations: ['File commands replace the server session action', 'Saving uses a local data file'],
  interactiveBrowserComparison: false, productionChanged: true,
};
await writeFile(resolve(reportPath), JSON.stringify(report, null, 2)+'\n');
console.log(JSON.stringify({ checked: true, htmlBytes: report.htmlBytes, fonts: embeddedFonts.length, unchangedPresentationFiles: unchanged.length, requestedFeatures: report.requestedFeatures.length, originalCsvRequired: false }));
