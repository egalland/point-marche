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

const presentationPaths = [
  'app/globals.css', 'app/styles/theme.css', 'app/styles/components.css', 'app/styles/workspace.css', 'app/styles/analyst.css', 'app/styles/simulations.css',
  'components/app-icon.tsx', 'components/appearance-control.tsx', 'components/action-menu.tsx', 'components/app-dialog.tsx',
  'features/market-pulse/supplier-mini-chart.tsx', 'features/market-pulse/supplier-variation-dashboard.tsx',
  'features/market-pulse/analyst-stats-dashboard.tsx', 'features/market-pulse/analyst-jira-panel.tsx',
  'lib/analyst-point-export.ts', 'lib/supplier-mini-trend.ts', 'lib/analyst-jira-history-html.ts',
];
const baseline = '5b669025992454e15a02e351a00847dc974a9f6e';
const unchanged = [];
for (const path of presentationPaths) {
  const original = execFileSync('git', ['show', `${baseline}:${path}`], { cwd: root });
  const current = await readFile(resolve(root, path));
  assert.equal(sha(original), sha(current), `Site V38 presentation changed: ${path}`);
  unchanged.push({ path, sha256: sha(current) });
}
const jsonBlock = scripts.find((match) => /id="market-pulse-(migration|workspace)"/.test(match[1]));
assert.ok(jsonBlock, 'Embedded data missing');
const envelope = JSON.parse(jsonBlock[2]);
assert.equal(envelope.checksum, sha(JSON.stringify(envelope.data)));
const isMigration = envelope.format === 'market-pulse-migration';
const data = isMigration ? envelope.data.base : envelope.data;
const report = {
  checkedAt: new Date().toISOString(), sourceVersion: 38, baseline,
  htmlSha256: sha(html), htmlBytes: Buffer.byteLength(html), parsedScripts: executableScripts,
  externalPresentationResources: 0, embeddedFonts: embeddedFonts.length,
  bodyFontClasses: layout.bodyClass, unchangedPresentationFiles: unchanged,
  opensSharedApplication: true, separateWelcomeOrTopBar: false,
  data: { markets: data.markets.length, people: data.users.length, marketPoints: data.points.length, analystPoints: data.analystPoints.length, plannerTasks: data.plannerTasks.length,
    jiraComplete: !isMigration || (envelope.data.recoveredTickets.length === envelope.data.expected.tickets && envelope.data.recoveredParticipants.length === envelope.data.expected.participants),
    ...(isMigration ? { jiraExpected: envelope.data.expected, jiraRecovered: { tickets: envelope.data.recoveredTickets.length, participants: envelope.data.recoveredParticipants.length }, missingCsv: envelope.data.csvFilename } : {}) },
  adaptations: ['File commands replace the server session action', 'Saving uses a local data file', 'Incomplete Jira is signalled; derived analyst calculations wait for the complete source'],
  interactiveBrowserComparison: false, productionChanged: false,
};
await writeFile(resolve(reportPath), JSON.stringify(report, null, 2)+'\n');
console.log(JSON.stringify({ checked: true, htmlBytes: report.htmlBytes, fonts: embeddedFonts.length, unchangedPresentationFiles: unchanged.length, jiraComplete: report.data.jiraComplete }));
