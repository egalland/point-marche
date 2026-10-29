import { canonicalJiraStatus, isAbandonedJiraStatus, isClosedJiraStatus, repairJiraTextWithCount, type JiraDetailedTicket, type JiraParticipant } from "./jira-import";

export type JiraCsvTicket = JiraDetailedTicket & { participants: JiraParticipant[]; resolutionAt: string };

export type JiraCsvParseResult = {
  tickets: JiraCsvTicket[];
  rows: number;
  rejectedRows: number;
  invalidDateRows: number;
  duplicateKeys: number;
  participantCount: number;
  repairedTextCount: number;
  openTicketCount: number;
  closedTicketCount: number;
  abandonedTicketCount: number;
  resolvedDatedCount: number;
  closedWithoutResolutionDate: number;
  hasResolutionColumn: boolean;
  resolutionColumn: string;
  delimiter: "comma" | "semicolon" | "tab" | "unknown";
  missingColumns: string[];
};

export type JiraCsvDecodeResult = {
  text: string;
  encoding: "UTF-8" | "Windows-1252";
  repairedTextCount: number;
};

function normalized(value: string) {
  return value.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]+/g, " ").trim().toLowerCase();
}

function firstRecord(text: string) {
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (character === '"') {
      if (quoted && text[index + 1] === '"') index += 1;
      else quoted = !quoted;
    }
    if (!quoted && (character === "\n" || character === "\r")) return text.slice(0, index);
  }
  return text;
}

function delimiterFor(text: string) {
  const header = firstRecord(text);
  const candidates = [",", ";", "\t"] as const;
  const scores = candidates.map((delimiter) => {
    let quoted = false;
    let count = 0;
    for (let index = 0; index < header.length; index += 1) {
      const character = header[index];
      if (character === '"') {
        if (quoted && header[index + 1] === '"') index += 1;
        else quoted = !quoted;
      } else if (!quoted && character === delimiter) count += 1;
    }
    return { delimiter, count };
  }).sort((left, right) => right.count - left.count);
  return scores[0].count ? scores[0].delimiter : "";
}

function csvRows(text: string, delimiter: string) {
  if (!delimiter) return [];
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  const pushRow = () => {
    row.push(cell.trim());
    if (row.some(Boolean)) rows.push(row);
    row = [];
    cell = "";
  };
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (character === '"') {
      if (quoted && text[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else quoted = !quoted;
    } else if (!quoted && character === delimiter) {
      row.push(cell.trim());
      cell = "";
    } else if (!quoted && (character === "\n" || character === "\r")) {
      if (character === "\r" && text[index + 1] === "\n") index += 1;
      pushRow();
    } else cell += character;
  }
  if (cell || row.length) pushRow();
  return rows;
}

function column(headers: string[], alternatives: RegExp[]) {
  return headers.findIndex((header) => alternatives.some((pattern) => pattern.test(header)));
}

function isoDateTime(parts: { year: number; month: number; day: number; hour?: number; minute?: number }) {
  const { year, month, day, hour = 0, minute = 0 } = parts;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return "";
  const date = new Date(Date.UTC(year, month - 1, day, hour, minute));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return "";
  return date.toISOString().slice(0, 19);
}

function jiraDate(value: string) {
  const clean = value.trim();
  if (!clean || /^#+$/.test(clean)) return "";
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T ](\d{1,2}):(\d{2}))?/.exec(clean);
  if (iso) return isoDateTime({ year: Number(iso[1]), month: Number(iso[2]), day: Number(iso[3]), hour: Number(iso[4] || 0), minute: Number(iso[5] || 0) });
  const french = /^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4}|\d{2})(?!\d)(?:\s+(\d{1,2}):(\d{2}))?/.exec(clean);
  if (french) {
    const shortYear = Number(french[3]);
    return isoDateTime({ year: shortYear < 100 ? 2000 + shortYear : shortYear, month: Number(french[2]), day: Number(french[1]), hour: Number(french[4] || 0), minute: Number(french[5] || 0) });
  }
  return "";
}

function participants(cells: string[], indexes: number[]) {
  const found = new Map<string, JiraParticipant>();
  indexes.forEach((index) => {
    const value = cells[index] ?? "";
    const expression = /([A-Z]\d{7})(?:\(([^)]+)\))?/gi;
    for (const match of value.matchAll(expression)) {
      const usercode = match[1].toUpperCase();
      found.set(usercode, { usercode, jiraUserId: match[2]?.trim() ?? "" });
    }
  });
  return Array.from(found.values());
}

function mergeParticipants(left: JiraParticipant[], right: JiraParticipant[]) {
  return Array.from(new Map([...left, ...right].map((participant) => [participant.usercode, participant])).values());
}

export function decodeJiraCsv(input: ArrayBuffer | Uint8Array): JiraCsvDecodeResult {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  let encoding: JiraCsvDecodeResult["encoding"] = "UTF-8";
  let text = "";
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    encoding = "Windows-1252";
    text = new TextDecoder("windows-1252").decode(bytes);
  }
  text = text.replace(/^\uFEFF/, "");
  const repaired = repairJiraTextWithCount(text);
  return { text: repaired.text, encoding, repairedTextCount: repaired.repairedTextCount };
}

export function parseJiraCsv(value: string): JiraCsvParseResult {
  const repaired = repairJiraTextWithCount(value.replace(/^\uFEFF/, ""));
  const delimiter = delimiterFor(repaired.text);
  const rows = csvRows(repaired.text, delimiter);
  const headers = (rows[0] ?? []).map(normalized);
  const keyIndex = column(headers, [/^cle de ticket$/, /^ticket key$/, /^issue key$/, /^key$/]);
  const idIndex = column(headers, [/^id de ticket$/, /^ticket id$/, /^issue id$/, /^id$/]);
  const statusIndex = column(headers, [/^etat$/, /^statut$/, /^status$/]);
  const summaryIndex = column(headers, [/^resume$/, /^summary$/]);
  const categoryIndex = column(headers, [/^(?:champs? personnalises? )?categorie$/, /^custom field category$/, /^category$/]);
  const subcategoryIndex = column(headers, [/^(?:champs? personnalises? )?sous categorie$/, /^souscategorie$/, /^sub category$/, /^subcategory$/, /^custom field subcategory$/, /^custom field sub category$/]);
  const createdIndex = column(headers, [/^creation$/, /^creee?$/, /^date de creation$/, /^created$/]);
  const assigneeIndex = column(headers, [/^personne assignee$/, /^assignee$/, /^responsable$/]);
  const updatedIndex = column(headers, [/^mise a jour$/, /^updated$/, /^date de mise a jour$/]);
  // Some Jira exports label the completion timestamp « Terminée ». A Resolution
  // column can also contain a textual outcome: use the first actual date per row.
  const resolutionIndexes = headers.flatMap((h,i)=>/^(resolution|date de resolution|resolved|resolved at|resolution date|resolue?|terminee?|terminee? le|date terminee?|date de fin|date de cloture|cloturee?|completed|completed at|completion date|done)$/.test(h)?[i]:[]);
  const resolutionIndex = resolutionIndexes[0] ?? -1;
  const participantIndexes = headers.map((header, index) => /participant/.test(header) ? index : -1).filter((index) => index >= 0);
  const required = [[keyIndex, "Clé de ticket"], [statusIndex, "État"], [summaryIndex, "Résumé"], [createdIndex, "Création"], [updatedIndex, "Mise à jour"]] as const;
  const missingColumns = required.filter(([index]) => index < 0).map(([, label]) => label);
  if (!rows.length || missingColumns.length) return { tickets: [], rows: Math.max(0, rows.length - 1), rejectedRows: Math.max(0, rows.length - 1), invalidDateRows: 0, duplicateKeys: 0, participantCount: 0, repairedTextCount: repaired.repairedTextCount, openTicketCount: 0, closedTicketCount: 0, abandonedTicketCount: 0, resolvedDatedCount: 0, closedWithoutResolutionDate: 0, hasResolutionColumn: resolutionIndex >= 0, resolutionColumn: resolutionIndexes.map(i=>(rows[0]??[])[i]).join(" / "), delimiter: delimiter === "," ? "comma" : delimiter === ";" ? "semicolon" : delimiter === "\t" ? "tab" : "unknown", missingColumns };

  const tickets = new Map<string, JiraCsvTicket>();
  let rejectedRows = 0;
  let invalidDateRows = 0;
  let duplicateKeys = 0;
  rows.slice(1).forEach((cells) => {
    const key = (cells[keyIndex] ?? "").trim().toUpperCase();
    if (!/^[A-Z][A-Z0-9]+-\d+$/.test(key)) {
      rejectedRows += 1;
      return;
    }
    const createdRaw = cells[createdIndex] ?? "";
    const updatedRaw = cells[updatedIndex] ?? "";
    const createdAt = jiraDate(createdRaw);
    const updatedAt = jiraDate(updatedRaw);
    const resolutionAt=resolutionIndexes.map(i=>jiraDate(cells[i]??"")).find(Boolean)??"";
    if ((createdRaw && !createdAt) || (updatedRaw && !updatedAt) || (resolutionIndexes.some(i=>Boolean(cells[i]?.trim()))&&!resolutionAt)) invalidDateRows += 1;
    const assigneeMatch = (cells[assigneeIndex] ?? "").match(/[A-Z]\d{7}/i);
    const ticket: JiraCsvTicket = {
      key,
      category: categoryIndex >= 0 ? (cells[categoryIndex] ?? "").trim() : "",
      subcategory: subcategoryIndex >= 0 ? (cells[subcategoryIndex] ?? "").trim() : "",
      internalId: idIndex >= 0 ? (cells[idIndex] ?? "").trim() : "",
      status: canonicalJiraStatus(cells[statusIndex] ?? ""),
      summary: (cells[summaryIndex] ?? "").replace(/\s+/g, " ").trim(),
      createdAt,
      assigneeUserCode: assigneeMatch?.[0].toUpperCase() ?? "",
      updatedAt,
      resolutionAt,
      participants: participants(cells, participantIndexes),
      link: `https://jira.example.test/browse/${key}`,
    };
    const existing = tickets.get(key);
    if (!existing) tickets.set(key, ticket);
    else {
      duplicateKeys += 1;
      const latest = !existing.updatedAt || ticket.updatedAt >= existing.updatedAt ? ticket : existing;
      tickets.set(key, { ...latest, participants: mergeParticipants(existing.participants, ticket.participants) });
    }
  });
  const parsedTickets = Array.from(tickets.values());
  const closedTickets = parsedTickets.filter((ticket) => isClosedJiraStatus(ticket.status) && !isAbandonedJiraStatus(ticket.status));
  return {
    tickets: parsedTickets,
    rows: Math.max(0, rows.length - 1),
    rejectedRows,
    invalidDateRows,
    duplicateKeys,
    participantCount: parsedTickets.reduce((total, ticket) => total + ticket.participants.length, 0),
    repairedTextCount: repaired.repairedTextCount,
    openTicketCount: parsedTickets.filter((ticket) => !isClosedJiraStatus(ticket.status)).length,
    closedTicketCount: closedTickets.length,
    abandonedTicketCount: parsedTickets.filter((ticket) => isAbandonedJiraStatus(ticket.status)).length,
    resolvedDatedCount: closedTickets.filter((ticket) => Boolean(ticket.resolutionAt)).length,
    closedWithoutResolutionDate: closedTickets.filter((ticket) => !ticket.resolutionAt).length,
    hasResolutionColumn: resolutionIndex >= 0, resolutionColumn: resolutionIndexes.map(i=>(rows[0]??[])[i]).join(" / "),
    delimiter: delimiter === "," ? "comma" : delimiter === ";" ? "semicolon" : delimiter === "\t" ? "tab" : "unknown",
    missingColumns,
  };
}
