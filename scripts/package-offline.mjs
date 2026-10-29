import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// Always package into a new, empty staging directory, never an installation.
export async function packageOffline(input, output, mode = 'update') {
  if (!['update', 'install'].includes(mode)) throw new Error('Mode attendu : update ou install.');
  const html = await readFile(resolve(input), 'utf8');
  if (!/<!doctype html>/i.test(html) || !html.includes("connect-src 'none'")) throw new Error('Un HTML autonome est requis.');
  if (/<script\b[^>]*\bid\s*=\s*["']market-pulse-workspace["']/i.test(html)) throw new Error('Distribution refusée : ce HTML contient un classeur embarqué.');
  const destination = resolve(output);
  await mkdir(destination, { recursive: true });
  if ((await readdir(destination)).length) throw new Error('Le dossier de préparation doit être vide. Ne jamais cibler une installation ou un dossier de données.');
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const files = {
    'application/Point_Marche.html': html,
    'application/MISE_A_JOUR.txt': await readFile(resolve(root, 'docs/mise-a-jour-locale.md'), 'utf8'),
    'application/MODE_EMPLOI_PARTAGE.md': await readFile(resolve(root, 'docs/partage-local.md'), 'utf8'),
    'application/MODE_EMPLOI_BUGS_IDEES.md': await readFile(resolve(root, 'docs/bugs-et-idees.md'), 'utf8'),
  };
  const versionSource = await readFile(resolve(root, 'lib/app-version.ts'), 'utf8');
  const applicationVersion = versionSource.match(/APP_VERSION = "(V\d+)"/)?.[1];
  if (!applicationVersion) throw new Error('Version de l’application introuvable.');
  files['application/version.json'] = JSON.stringify({ applicationVersion, distributionLayout: 1, mode }, null, 2) + '\n';
  if (mode === 'install') {
    files['donnees/LIRE_MOI.txt'] = 'Enregistrer ici le classeur .marketpulse.json ou sélectionner un sous-dossier dédié au journal partagé. Choisir cet emplacement dans l’application : aucun accès automatique au dossier depuis le HTML. Un partage existant peut rester à son emplacement actuel.\n';
    files['sauvegardes/LIRE_MOI.txt'] = 'Conserver ici les copies datées du classeur et du journal partagé entier. Ce dossier est exclu des paquets de mise à jour.\n';
    files['DEMARRER.html'] = '<!doctype html><html lang="fr"><meta charset="utf-8"><meta http-equiv="refresh" content="0;url=application/Point_Marche.html"><title>Point marché</title><a href="application/Point_Marche.html">Ouvrir Point marché</a></html>';
  }
  // Update packages contain only application/. Installation scaffolding never ships in an update.
  for (const [name, content] of Object.entries(files)) {
    await mkdir(dirname(resolve(destination, name)), { recursive: true });
    await writeFile(resolve(destination, name), content, { flag: 'wx' });
  }
  return Object.keys(files);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.length < 4 || process.argv.length > 5) throw new Error('Usage: node scripts/package-offline.mjs APP.html DOSSIER_VIDE [update|install]');
  console.log((await packageOffline(process.argv[2], process.argv[3], process.argv[4])).join('\n'));
}
