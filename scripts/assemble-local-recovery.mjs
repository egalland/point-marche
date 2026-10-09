import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { build } from "esbuild";

const [recoveryPath, csvPath, destination] = process.argv.slice(2);
if (!recoveryPath || !csvPath || !destination) throw new Error("Usage : node scripts/assemble-local-recovery.mjs REPRISE.json JIRA.csv CLASSEUR.marketpulse.json");
async function load(file) {
  const result = await build({ entryPoints: [resolve(file)], bundle: true, platform: "node", format: "esm", write: false, logLevel: "silent" });
  return import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString("base64")}`);
}
const [migration, workspace, csv, recoveryText, csvBytes] = await Promise.all([
  load("offline/migration-data.ts"), load("offline/workspace-data.ts"), load("lib/jira-csv.ts"), readFile(resolve(recoveryPath), "utf8"), readFile(resolve(csvPath)),
]);
const checkpoint = await migration.decodeMigrationCheckpoint(recoveryText);
const { data, report } = migration.completeMigrationWithCsv(checkpoint, csv.decodeJiraCsv(csvBytes).text);
const content = await workspace.encodeWorkspace(data);
await workspace.decodeWorkspace(content);
await writeFile(resolve(destination), content, { encoding: "utf8", flag: "wx", mode: 0o600 });
console.log(JSON.stringify({ ...report, bytes: Buffer.byteLength(content), integrity: "SHA-256 et relecture validés" }));
