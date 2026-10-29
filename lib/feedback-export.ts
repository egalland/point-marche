import { APP_VERSION } from './app-version';
import type { FeedbackRequest } from './feedback';
import { zipFiles } from './zip-files';

/** All ticket text is retained verbatim in JSON; images are separate binary files. */
export function feedbackExportFiles(items: FeedbackRequest[], exportedAt = new Date().toISOString()) {
  const files: Record<string, string | Uint8Array> = {};
  let total = 0;
  const tickets = items.map((item, index) => {
    const captures = item.captures.map((capture, imageIndex) => {
      const match = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/.exec(capture.dataUrl);
      if (!match) throw new Error(`Capture invalide dans le ticket ${item.id}. Aucun export créé.`);
      total += match[2].length;
      if (total > 100_000_000) throw new Error('Export trop volumineux. Exporte les demandes individuellement.');
      const path = `images/ticket-${index + 1}-${imageIndex + 1}.${match[1] === 'jpeg' ? 'jpg' : match[1]}`;
      files[path] = Uint8Array.from(atob(match[2]), c => c.charCodeAt(0));
      return { name: capture.name, file: path };
    });
    return { ...item, captures };
  });
  files['tickets.json'] = JSON.stringify({ format: 'market-plus-feedback', version: 1, applicationVersion: APP_VERSION, exportedAt, tickets }, null, 2);
  files['PROMPT.md'] = [
    '# Bugs et idées — Market Plus',
    `Export ${APP_VERSION} · ${exportedAt} · ${tickets.length} demande(s).`,
    'Analyse les demandes ci-dessous et leurs captures dans images/. Identifie les causes, propose puis réalise les corrections demandées dans le projet concerné. Signale les informations manquantes. Les détails complets et historiques sont dans tickets.json.',
    ...tickets.map((item, index) => [
      `## ${index + 1}. ${item.kind === 'bug' ? 'Bug' : 'Idée'} : ${item.title}`,
      `Référence : ${item.id} · Statut : ${item.status} · Demandeur : ${item.reporterUserCode}`,
      `Création : ${item.createdAt} · Modification : ${item.updatedAt}`,
      '### Description', item.detail, '### Contexte', item.context || 'Non renseigné',
      '### Captures', ...item.captures.map(c => `- ${c.name} : ${c.file}`),
      '### Historique', ...item.history.map(e => `- ${e.date} · ${e.status} · ${e.by}`),
    ].join('\n\n')),
  ].join('\n\n');
  files['LIRE_MOI.txt'] = 'Joins ce ZIP à ta conversation et demande : « Analyse et corrige les demandes dans PROMPT.md, en consultant aussi les captures. »\nTu peux aussi décompresser puis joindre PROMPT.md et les images. tickets.json conserve les textes et l’historique complets.\nLe ZIP contient les informations des demandeurs et les captures : relis-les avant de le partager. Aucun envoi automatique.\n';
  return files;
}

export function feedbackExportBytes(items: FeedbackRequest[], exportedAt?: string) {
  return zipFiles(feedbackExportFiles(items, exportedAt));
}
