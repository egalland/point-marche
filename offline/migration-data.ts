import { parseJiraCsv, type JiraCsvTicket } from "../lib/jira-csv";
import { validateWorkspace, type WorkspaceData } from "./workspace-data";

export type MigrationParticipant = { ticketKey: string; usercode: string; jiraUserId: string };
export type MigrationCheckpoint = {
  base: WorkspaceData;
  csvFilename: string;
  expected: { tickets: number; participants: number; rows: number };
  recoveredTickets: JiraCsvTicket[];
  recoveredParticipants: MigrationParticipant[];
};
export type MigrationReport = {
  tickets: number; participants: number; checkedTickets: number; checkedParticipants: number;
  completedTickets: number; completedParticipants: number; csvFilename: string | null;
};

const isObject = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
const participantKey = (person: MigrationParticipant) => `${person.ticketKey}:${person.usercode}`;

export function validateMigrationCheckpoint(value: unknown): asserts value is MigrationCheckpoint {
  if (!isObject(value) || !isObject(value.expected) || typeof value.csvFilename !== "string") throw new Error("La sauvegarde de reprise est incomplète.");
  validateWorkspace(value.base);
  const expected = value.expected;
  if (!Object.values(expected).every((count) => Number.isSafeInteger(count) && Number(count) >= 0) || !["tickets", "participants", "rows"].every((key) => key in expected)) throw new Error("Les totaux de reprise sont invalides.");
  const checkpoint = value as unknown as MigrationCheckpoint;
  if (checkpoint.base.jiraTickets.length || !Array.isArray(checkpoint.recoveredTickets) || !Array.isArray(checkpoint.recoveredParticipants)) throw new Error("La structure de reprise est invalide.");
  validateWorkspace({ ...checkpoint.base, jiraTickets: checkpoint.recoveredTickets });
  if (checkpoint.recoveredTickets.some((ticket) => ticket.participants.length)) throw new Error("Les participations de reprise doivent être vérifiées séparément.");
  if (checkpoint.recoveredTickets.length > checkpoint.expected.tickets || checkpoint.recoveredParticipants.length > checkpoint.expected.participants || checkpoint.expected.rows < checkpoint.expected.tickets) throw new Error("Les totaux de reprise sont incohérents.");
  const people = new Set<string>();
  for (const person of checkpoint.recoveredParticipants) {
    if (!isObject(person) || typeof person.ticketKey !== "string" || !/^[A-Z][A-Z0-9]+-\d+$/.test(person.ticketKey) || typeof person.usercode !== "string" || !/^[A-Z]\d{7}$/.test(person.usercode) || typeof person.jiraUserId !== "string") throw new Error("Une participation de reprise est invalide.");
    const key = participantKey(person);
    if (people.has(key)) throw new Error("Une participation de reprise apparaît en double.");
    people.add(key);
  }
}

async function digest(value: unknown) {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(value)));
  return Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function encodeMigrationCheckpoint(checkpoint: MigrationCheckpoint) {
  validateMigrationCheckpoint(checkpoint);
  return JSON.stringify({ format: "market-pulse-migration", schemaVersion: 1, checksum: await digest(checkpoint), data: checkpoint });
}

export async function decodeMigrationCheckpoint(text: string): Promise<MigrationCheckpoint> {
  if (text.length > 200_000_000) throw new Error("La sauvegarde de reprise dépasse 200 Mo.");
  let envelope: unknown;
  try {
    envelope = JSON.parse(text, (key, value) => {
      if (["__proto__", "prototype", "constructor"].includes(key)) throw new Error("Clé non autorisée.");
      return value;
    });
  } catch { throw new Error("La sauvegarde de reprise est illisible."); }
  if (!isObject(envelope) || envelope.format !== "market-pulse-migration" || envelope.schemaVersion !== 1) throw new Error("Le format de reprise est incompatible.");
  validateMigrationCheckpoint(envelope.data);
  if (await digest(envelope.data) !== envelope.checksum) throw new Error("La sauvegarde de reprise est incomplète ou a été modifiée.");
  return envelope.data;
}

function complete(checkpoint: MigrationCheckpoint, tickets: JiraCsvTicket[], csvFilename: string | null) {
  const data = structuredClone(checkpoint.base);
  data.jiraTickets = tickets;
  if (data.source) data.source.notes = [...(data.source.notes ?? []), csvFilename ? `Reprise contrôlée avec le CSV d’origine : ${csvFilename}.` : "Registre Jira natif intégral vérifié."];
  validateWorkspace(data);
  const report: MigrationReport = {
    tickets: tickets.length,
    participants: tickets.reduce((sum, ticket) => sum + ticket.participants.length, 0),
    checkedTickets: checkpoint.recoveredTickets.length,
    checkedParticipants: checkpoint.recoveredParticipants.length,
    completedTickets: tickets.length - checkpoint.recoveredTickets.length,
    completedParticipants: checkpoint.expected.participants - checkpoint.recoveredParticipants.length,
    csvFilename,
  };
  return { data, report };
}

export function completeMigrationWithCsv(checkpoint: MigrationCheckpoint, text: string) {
  validateMigrationCheckpoint(checkpoint);
  const csv = parseJiraCsv(text);
  if (csv.missingColumns.length) throw new Error(`Colonnes manquantes : ${csv.missingColumns.join(", ")}. Choisis le CSV Jira complet.`);
  if (csv.rejectedRows || csv.duplicateKeys || csv.invalidDateRows) throw new Error("Ce CSV contient des lignes rejetées, des doublons ou des dates invalides. La reprise n’a pas été appliquée.");
  if (csv.rows !== checkpoint.expected.rows || csv.tickets.length !== checkpoint.expected.tickets || csv.participantCount !== checkpoint.expected.participants) {
    throw new Error(`Le CSV contient ${csv.tickets.length.toLocaleString("fr-FR")} tickets et ${csv.participantCount.toLocaleString("fr-FR")} participations. La reprise attend ${checkpoint.expected.tickets.toLocaleString("fr-FR")} tickets et ${checkpoint.expected.participants.toLocaleString("fr-FR")} participations. Choisis « ${checkpoint.csvFilename} ».`);
  }
  const candidates = new Map(csv.tickets.map((ticket) => [ticket.key, ticket]));
  const fields = ["internalId", "status", "summary", "createdAt", "updatedAt", "resolutionAt", "assigneeUserCode", "link"] as const;
  for (const known of checkpoint.recoveredTickets) {
    const candidate = candidates.get(known.key);
    if (!candidate || fields.some((field) => (known[field] ?? "") !== (candidate[field] ?? ""))) throw new Error(`Le ticket ${known.key} diffère de la copie du site. Utilise le CSV d’origine pour reprendre cette sauvegarde.`);
  }
  const people = new Map<string, string>(csv.tickets.flatMap((ticket) => ticket.participants.map((person) => [`${ticket.key}:${person.usercode}`, person.jiraUserId] as const)));
  for (const known of checkpoint.recoveredParticipants) {
    if (people.get(participantKey(known)) !== known.jiraUserId) throw new Error(`Les participants du ticket ${known.ticketKey} diffèrent de la copie du site. La reprise n’a pas été appliquée.`);
  }
  const originals = new Map(checkpoint.recoveredTickets.map((ticket) => [ticket.key, ticket]));
  // Retain the exact exported fields, including dates, for every recovered ticket.
  const tickets = csv.tickets.map((ticket) => structuredClone({ ...(originals.get(ticket.key) ?? ticket), participants: ticket.participants }));
  return complete(checkpoint, tickets, checkpoint.csvFilename);
}

export function completeMigrationFromNative(checkpoint: MigrationCheckpoint) {
  validateMigrationCheckpoint(checkpoint);
  if (checkpoint.recoveredTickets.length !== checkpoint.expected.tickets || checkpoint.recoveredParticipants.length !== checkpoint.expected.participants) throw new Error("Export Jira incomplet : le CSV d’origine est requis pour finaliser le classeur.");
  const tickets = new Map(checkpoint.recoveredTickets.map((ticket) => [ticket.key, structuredClone(ticket)]));
  for (const person of checkpoint.recoveredParticipants) {
    const ticket = tickets.get(person.ticketKey);
    if (!ticket) throw new Error("Une participation n’a pas de ticket correspondant.");
    ticket.participants.push({ usercode: person.usercode, jiraUserId: person.jiraUserId });
  }
  return complete(checkpoint, Array.from(tickets.values()), null);
}

/** Open the verified non-Jira data without treating the partial registry as complete. */
export function openMigrationWorkspace(checkpoint: MigrationCheckpoint): WorkspaceData {
  validateMigrationCheckpoint(checkpoint);
  if (checkpoint.recoveredTickets.length === checkpoint.expected.tickets && checkpoint.recoveredParticipants.length === checkpoint.expected.participants) return completeMigrationFromNative(checkpoint).data;
  const data = structuredClone(checkpoint.base);
  data.source = {
    exportedAt: data.updatedAt, ...data.source,
    pendingJira: {
      csvFilename: checkpoint.csvFilename,
      expectedTickets: checkpoint.expected.tickets, expectedParticipants: checkpoint.expected.participants,
      recoveredTickets: checkpoint.recoveredTickets.length, recoveredParticipants: checkpoint.recoveredParticipants.length,
    },
  };
  validateWorkspace(data);
  return data;
}

/** Completing Jira must never replace edits made since the local file was opened. */
export function completeMigrationInWorkspace(checkpoint: MigrationCheckpoint, current: WorkspaceData, csv: string) {
  if (current.id !== checkpoint.base.id || !current.source?.pendingJira) throw new Error("Ce fichier de données ne correspond pas à cette reprise Jira.");
  const completed = completeMigrationWithCsv(checkpoint, csv);
  const source = { ...current.source, notes: [...(current.source.notes ?? []), `Reprise contrôlée avec le CSV d’origine : ${checkpoint.csvFilename}.`] };
  delete source.pendingJira;
  const data = { ...structuredClone(current), source, jiraTickets: completed.data.jiraTickets, jiraUpdatedAt: completed.data.jiraUpdatedAt };
  validateWorkspace(data);
  return { data, report: completed.report };
}
