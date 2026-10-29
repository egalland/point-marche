import type { GlobalDirectoryUser } from "../lib/global-directory";
import type { AnalystPointRecord } from "../lib/analyst-point";
import type { JiraCsvTicket } from "../lib/jira-csv";
import type { PlannerTask } from "../lib/planner-import";
import type { LocalDraft } from "../lib/app-transport";
import { isIsoDate } from "../lib/iso-week";

export type LocalMarket = {
  id: string; name: string; shortCode: string; tone: string; colorHex: string;
  plannerTags: string[]; position: number; jiraWarningDays: number; jiraCriticalDays: number;
  isActive?: boolean; createdAt?: string; updatedAt?: string;
};
export type LocalPoint = {
  id: string; marketId: string; year: number; week: number; meetingDate: string;
  pointName: string; themeColor: string; data: Record<string, unknown>; createdAt: string;
};
export type LocalJiraBatch = {
  id: string; sourceProfile: string; filename: string; status: string;
  rowCount: number; ticketCount: number; participantCount: number; rejectedCount: number;
  repairedTextCount: number; unknownUserCodeCount: number; createdAt: string; completedAt: string | null;
};
export type WorkspaceData = {
  id: string; name: string; createdAt: string; updatedAt: string;
  markets: LocalMarket[]; users: GlobalDirectoryUser[]; points: LocalPoint[];
  analystPoints: AnalystPointRecord[]; plannerTasks: PlannerTask[]; plannerUpdatedAt: string;
  jiraTickets: JiraCsvTicket[]; jiraImports: LocalJiraBatch[]; jiraUpdatedAt: string;
  drafts: LocalDraft[]; preferences: Record<string, string>;
  source?: {
    exportedAt: string; siteUrl?: string; version?: number; notes?: string[];
    pendingJira?: { csvFilename: string; expectedTickets: number; expectedParticipants: number; recoveredTickets: number; recoveredParticipants: number };
  };
};
export type WorkspaceEnvelope = {
  format: "market-pulse-local"; schemaVersion: 1; savedAt: string; checksum: string; data: WorkspaceData;
};

export function newWorkspace(): WorkspaceData {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(), name: "Mes points marché", createdAt: now, updatedAt: now,
    markets: [{ id: "market-local", name: "Mon marché", shortCode: "MARCHÉ", tone: "mint", colorHex: "", plannerTags: [], position: 0, jiraWarningDays: 10, jiraCriticalDays: 20, isActive: true }],
    users: [], points: [], analystPoints: [], plannerTasks: [], plannerUpdatedAt: "",
    jiraTickets: [], jiraImports: [], jiraUpdatedAt: "", drafts: [], preferences: {},
  };
}

export function isEmptyStarterWorkspace(data: WorkspaceData) {
  const market = data.markets[0];
  return data.name === "Mes points marché" && data.markets.length === 1 && market?.id === "market-local" && market.name === "Mon marché" && market.shortCode === "MARCHÉ" && market.tone === "mint" && market.colorHex === "" && !market.plannerTags.length && market.jiraWarningDays === 10 && market.jiraCriticalDays === 20 && !data.users.length && !data.points.length && !data.analystPoints.length && !data.plannerTasks.length && !data.jiraTickets.length && !data.jiraImports.length && !data.drafts.length && !data.preferences["purchaseData-source"] && !data.source;
}

/** Retire the old CSV requirement when opening an earlier portable workbook. */
export function removeLegacyJiraRequirement(data: WorkspaceData): WorkspaceData {
  if (!data.source?.pendingJira) return data;
  const source = { ...data.source };
  delete source.pendingJira;
  // These batches described the remote export, whose ticket registry was never loaded.
  return { ...data, source, jiraImports: [], jiraUpdatedAt: "" };
}

function object(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function rows(value: unknown, label: string, identity: string) {
  if (!Array.isArray(value)) throw new Error(`Fichier incomplet : ${label} manquant.`);
  const keys = new Set<string>();
  for (const row of value) {
    if (!object(row) || typeof row[identity] !== "string" || !row[identity]) throw new Error(`Enregistrement invalide : ${label}.`);
    const key = row[identity] as string;
    if (keys.has(key)) throw new Error(`Identifiant en double dans ${label} : ${key}.`);
    keys.add(key);
  }
}

export function validateWorkspace(value: unknown): asserts value is WorkspaceData {
  if (!object(value) || typeof value.id !== "string" || typeof value.name !== "string") throw new Error("Ce fichier n’est pas un classeur Market Pulse complet.");
  rows(value.markets, "marchés", "id");
  rows(value.users, "personnes", "id");
  rows(value.points, "points marché", "id");
  rows(value.analystPoints, "points analystes", "id");
  rows(value.plannerTasks, "simulations", "externalId");
  rows(value.jiraTickets, "tickets Jira", "key");
  rows(value.jiraImports, "imports Jira", "id");
  if (!Array.isArray(value.drafts) || !object(value.preferences)) throw new Error("Brouillons ou préférences absents du classeur.");
  const data = value as unknown as WorkspaceData;
  if (data.source?.pendingJira) {
    const pending = data.source.pendingJira;
    if (typeof pending.csvFilename !== "string" || ![pending.expectedTickets, pending.expectedParticipants, pending.recoveredTickets, pending.recoveredParticipants].every((count) => Number.isSafeInteger(count) && count >= 0) || pending.recoveredTickets > pending.expectedTickets || pending.recoveredParticipants > pending.expectedParticipants || data.jiraTickets.length) throw new Error("L’état de reprise Jira est incohérent.");
  }
  if (!data.markets.some((market) => market.isActive !== false)) throw new Error("Le classeur doit contenir au moins un marché actif.");
  for (const market of data.markets) {
    if (typeof market.name !== "string" || typeof market.shortCode !== "string" || !Array.isArray(market.plannerTags) || !market.plannerTags.every((tag) => typeof tag === "string")) throw new Error("Marché invalide dans le classeur.");
  }
  for (const person of data.users) {
    if (![person.name, person.email, person.usercode, person.role].every((field) => typeof field === "string") || !Array.isArray(person.marketIds)) throw new Error("Personne invalide dans le classeur.");
  }
  for (const point of [...data.points, ...data.analystPoints]) {
    if (!object(point.data) || !isIsoDate(point.meetingDate) || !Number.isInteger(point.year) || !Number.isInteger(point.week) || point.week < 1 || point.week > 53) throw new Error("Point hebdomadaire invalide dans le classeur.");
  }
  for (const ticket of data.jiraTickets) {
    if (![ticket.key, ticket.status, ticket.summary, ticket.createdAt, ticket.updatedAt, ticket.assigneeUserCode].every((field) => typeof field === "string") || !Array.isArray(ticket.participants)) throw new Error("Ticket Jira incomplet dans le classeur.");
    if (!ticket.participants.every((person) => object(person) && typeof person.usercode === "string" && typeof person.jiraUserId === "string")) throw new Error("Participant Jira invalide.");
  }
  for (const task of data.plannerTasks) {
    if (typeof task.taskName !== "string" || typeof task.effectiveMonth !== "string" || !Array.isArray(task.checklist) || !Array.isArray(task.labels) || !object(task.metrics)) throw new Error("Simulation Planner incomplète dans le classeur.");
  }
  for (const draft of data.drafts) {
    if (!object(draft) || !["market", "analyst"].includes(draft.scope) || typeof draft.ownerId !== "string" || !object(draft.data)) throw new Error("Brouillon invalide dans le classeur.");
  }
}

async function checksum(value: unknown) {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function encodeWorkspace(data: WorkspaceData) {
  validateWorkspace(data);
  const snapshot = structuredClone(data);
  const envelope: WorkspaceEnvelope = { format: "market-pulse-local", schemaVersion: 1, savedAt: new Date().toISOString(), checksum: await checksum(snapshot), data: snapshot };
  return JSON.stringify(envelope);
}

export async function decodeWorkspace(text: string): Promise<WorkspaceData> {
  if (text.length > 200_000_000) throw new Error("Ce fichier dépasse 200 Mo. Utilise un classeur plus petit.");
  let envelope: unknown;
  try {
    envelope = JSON.parse(text, (key, value) => {
      if (key === "__proto__" || key === "prototype" || key === "constructor") throw new Error("Clé non autorisée.");
      return value;
    });
  } catch { throw new Error("Fichier illisible ou incomplet. Le classeur actuel n’a pas été modifié."); }
  if (!object(envelope) || envelope.format !== "market-pulse-local") throw new Error("Choisis le fichier complet .marketpulse.json, pas l’export JSON d’un seul point.");
  if (envelope.schemaVersion !== 1) throw new Error("Cette version de fichier n’est pas prise en charge. Conserve le fichier original.");
  validateWorkspace(envelope.data);
  if (typeof envelope.checksum !== "string" || await checksum(envelope.data) !== envelope.checksum) throw new Error("Le contrôle d’intégrité a échoué. Le fichier est incomplet ou a été modifié hors de l’outil.");
  return envelope.data;
}
