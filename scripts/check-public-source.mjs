import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

// Run locally before publishing. An optional private term list must stay outside this repository.
const files = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "-z"], { encoding: "utf8" }).split("\0").filter(Boolean);
const terms = process.env.PUBLIC_SOURCE_TERMS_FILE
  ? readFileSync(process.env.PUBLIC_SOURCE_TERMS_FILE, "utf8").split(/\r?\n/).map(x=>x.trim()).filter(Boolean) : [];
const findings = [];
for (const path of files) {
  if (/\.(?:csv|tsv|xlsx?|xlsm|zip|bundle|sqlite|db|eml|pdf)$/i.test(path) || /(?:^|\/)(?:imports|donnees|sauvegardes|history)\//.test(path) || /\.marketpulse\.json$|point-sync-.*\.json$|(?:^|\/)qa-.*\.html$/.test(path)) findings.push([path, "Fichier de données ou de livraison interdit"]);
  const bytes = readFileSync(path);
  if (bytes.includes(0) || path === "package-lock.json") continue;
  const source = bytes.toString("utf8");
  if (terms.some(term => source.toLocaleLowerCase().includes(term.toLocaleLowerCase()))) findings.push([path, "Terme de la liste privée détecté"]);
  if (/(?:gh[pousr]_[a-zA-Z0-9]{30,}|github_pat_[a-zA-Z0-9_]{30,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----)/.test(source)) findings.push([path, "Secret potentiel"]);
  if (path.startsWith("tests/") && [...source.matchAll(/[A-Z]\d{7}/g)].some(([id])=>!/[A-Z](?:0{4}\d{3}|1234567|7654321|1111111|2222222)$/.test(id))) findings.push([path, "Identifiant non fictif dans un test"]);
  if (path === "lib/chart-excel-template.ts" && (/<x:c\s|<c:(?:numCache|strCache)>/.test(source))) findings.push([path, "Cellules ou cache de données dans le modèle Excel"]);
}
if (findings.length) {
  for (const [path, reason] of findings) console.error(`${path}: ${reason}`);
  process.exitCode = 1;
} else console.log(`${files.length} fichiers contrôlés. Aucun motif bloquant détecté${terms.length ? " avec la liste privée" : " (sans liste privée)"}. Une relecture humaine reste nécessaire.`);
