export const JIRA_SUMMARY_STATUSES = [
  "À faire",
  "Réouvert",
  "En cours",
  "En attente du client",
  "En attente d’un tiers",
  "En attente de changement",
] as const;

export type JiraSummaryStatus = { status: string; count: number; link: string };
export type JiraSummaryPerson = { assignee: string; displayName?: string; marketId?: string; statuses: JiraSummaryStatus[]; total: number; totalLink: string };
export type JiraSummaryItem = JiraSummaryStatus & { assignee: string };
export type JiraParticipant = { usercode: string; jiraUserId: string };
export type JiraDetailedTicket = {
  key: string;
  internalId: string;
  status: string;
  summary: string;
  createdAt: string;
  assigneeUserCode: string;
  assigneeName?: string;
  marketId?: string;
  updatedAt: string;
  link: string;
  resolutionAt?: string;
  participants?: JiraParticipant[];
};
export type JiraSummaryImport = {
  personCount: number;
  tickets: number;
  people: JiraSummaryPerson[];
  items: JiraSummaryItem[];
  detailedTickets: JiraDetailedTicket[];
  mode: "detailed" | "summary";
  format: "tabulated" | "markdown" | "semicolon" | "unknown";
};

const mojibakePairs: [string, string][] = [
  ["Ã‰", "É"], ["Ã©", "é"], ["Ãˆ", "È"], ["Ã¨", "è"], ["ÃŠ", "Ê"], ["Ãª", "ê"], ["Ã‹", "Ë"], ["Ã«", "ë"],
  ["Ã€", "À"], ["Ã ", "à"], ["Ã‚", "Â"], ["Ã¢", "â"], ["Ã„", "Ä"], ["Ã¤", "ä"],
  ["ÃŽ", "Î"], ["Ã®", "î"], ["Ã¯", "ï"], ["Ã”", "Ô"], ["Ã´", "ô"], ["Ã¶", "ö"],
  ["Ã™", "Ù"], ["Ã¹", "ù"], ["Ã›", "Û"], ["Ã»", "û"], ["Ãœ", "Ü"], ["Ã¼", "ü"],
  ["Ã‡", "Ç"], ["Ã§", "ç"], ["Å“", "œ"], ["Å’", "Œ"], ["â€™", "’"], ["â€“", "–"], ["â€”", "—"],
  ["Â ", " "], ["Â", ""],
];

export function repairJiraText(value: string) {
  return mojibakePairs.reduce((result, [broken, repaired]) => result.replaceAll(broken, repaired), value);
}

export function repairJiraTextWithCount(value: string) {
  let repaired = value;
  let repairedTextCount = 0;
  mojibakePairs.forEach(([broken, replacement]) => {
    if (broken === "Â") return;
    const occurrences = repaired.split(broken).length - 1;
    if (!occurrences) return;
    repairedTextCount += occurrences;
    repaired = repaired.replaceAll(broken, replacement);
  });
  return { text: repaired, repairedTextCount };
}

function decodeEntities(value: string) {
  return value.replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&quot;/gi, '"').replace(/(?:&#39;|&apos;)/gi, "'").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">");
}

function plainCell(value: string) {
  return repairJiraText(decodeEntities(value)).replace(/<br\s*\/?\s*>/gi, " ").replace(/<[^>]+>/g, " ").replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").replace(/\*\*/g, "").replace(/\s+/g, " ").trim();
}

function normalized(value: string) {
  return plainCell(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[’']/g, " ").replace(/[^a-zA-Z0-9]+/g, " ").trim().toLowerCase();
}

function countAndLink(value: string) {
  const markdownLink = value.match(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/i);
  const htmlLink = value.match(/<a\b[^>]*href=["'](https?:\/\/[^"']+)["'][^>]*>([\s\S]*?)<\/a>/i);
  const label = plainCell(markdownLink?.[1] ?? htmlLink?.[2] ?? value);
  const number = label.replace(/\s/g, "").match(/\d+/)?.[0];
  const plainLink = value.match(/https?:\/\/[^\s<>)]+/i)?.[0] ?? "";
  return { count: number ? Number(number) : 0, link: decodeEntities(markdownLink?.[2] ?? htmlLink?.[1] ?? plainLink) };
}

function splitMarkdownRow(line: string) {
  return line.trim().replace(/^\|/, "").replace(/\|\s*$/, "").split("|").map((cell) => cell.trim());
}

function splitRow(line: string) {
  if (line.includes("\t")) return line.split("\t").map((cell) => cell.trim());
  if (line.trim().startsWith("|")) return splitMarkdownRow(line);
  if (line.includes(";")) return line.split(";").map((cell) => cell.trim());
  return [];
}

function detectedFormat(text: string): JiraSummaryImport["format"] {
  if (text.includes("\t")) return "tabulated";
  if (text.split(/\r?\n/).some((line) => line.trim().startsWith("|"))) return "markdown";
  if (text.includes(";")) return "semicolon";
  return "unknown";
}

export function canonicalJiraStatus(value: string) {
  const label = normalized(value);
  if (/^(?:a faire|to do)$/.test(label)) return JIRA_SUMMARY_STATUSES[0];
  if (/^reouvert(?:e)?$/.test(label)) return JIRA_SUMMARY_STATUSES[1];
  if (/^en cours$/.test(label)) return JIRA_SUMMARY_STATUSES[2];
  if (/^en attente (?:du )?client$/.test(label)) return JIRA_SUMMARY_STATUSES[3];
  if (/^en attente (?:d un |de |du )?tiers$/.test(label)) return JIRA_SUMMARY_STATUSES[4];
  if (/^en attente (?:de |du )?changement$/.test(label)) return JIRA_SUMMARY_STATUSES[5];
  return plainCell(value);
}

function canonicalHeaderStatus(value: string) {
  const status = canonicalJiraStatus(value);
  return JIRA_SUMMARY_STATUSES.includes(status as typeof JIRA_SUMMARY_STATUSES[number]) ? status : "";
}

function isHeader(cells: string[]) {
  const row = normalized(cells.join(" "));
  return /personne assignee|assignee|responsable/.test(row) && /a faire|reouvert|en cours|attente/.test(row);
}

function isSeparatorRow(cells: string[]) {
  return cells.every((cell) => !cell || /^:?-{3,}:?$/.test(cell.trim()));
}

function jiraDate(value: string) {
  const match = plainCell(value).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2}))?/);
  if (!match) return "";
  const [, day, month, year, hour = "00", minute = "00"] = match;
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}T${hour.padStart(2, "0")}:${minute}:00`;
}

function detailedTicket(cells: string[]): JiraDetailedTicket | null {
  const clean = cells.map((cell) => plainCell(cell));
  const keyIndex = clean.findIndex((cell) => /^[A-Z][A-Z0-9]+-\d+$/i.test(cell));
  if (keyIndex < 0) return null;
  const usercodeIndex = clean.findIndex((cell, index) => index > keyIndex && /^[A-Z]\d{7}$/i.test(cell));
  const dateIndexes = clean.map((cell, index) => jiraDate(cell) ? index : -1).filter((index) => index > keyIndex);
  if (usercodeIndex < 0 || dateIndexes.length < 2) return null;
  const createdIndex = dateIndexes[0];
  const updatedIndex = dateIndexes[dateIndexes.length - 1];
  const internalIdIndex = clean.findIndex((cell, index) => index > keyIndex && index < createdIndex && /^\d{5,}$/.test(cell));
  const statusIndex = clean.findIndex((cell, index) => index > (internalIdIndex >= 0 ? internalIdIndex : keyIndex) && index < createdIndex && Boolean(canonicalHeaderStatus(cell)));
  if (statusIndex < 0) return null;
  const key = clean[keyIndex].toUpperCase();
  return {
    key,
    internalId: internalIdIndex >= 0 ? clean[internalIdIndex] : "",
    status: canonicalJiraStatus(clean[statusIndex]),
    summary: clean.slice(statusIndex + 1, createdIndex).filter(Boolean).join(" "),
    createdAt: jiraDate(clean[createdIndex]),
    assigneeUserCode: clean[usercodeIndex].toUpperCase(),
    updatedAt: jiraDate(clean[updatedIndex]),
    link: countAndLink(cells[keyIndex]).link || `https://jira.example.test/browse/${key}`,
  };
}

function aggregateDetailedTickets(tickets: JiraDetailedTicket[]) {
  const people = new Map<string, JiraSummaryPerson>();
  tickets.forEach((ticket) => {
    const existing = people.get(ticket.assigneeUserCode) ?? { assignee: ticket.assigneeUserCode, statuses: [], total: 0, totalLink: "" };
    const status = existing.statuses.find((item) => item.status === ticket.status);
    if (status) status.count += 1;
    else existing.statuses.push({ status: ticket.status, count: 1, link: ticket.link });
    existing.total += 1;
    people.set(ticket.assigneeUserCode, existing);
  });
  return Array.from(people.values());
}

function legacySummary(rows: string[][]) {
  let statusColumns = new Map<string, number>();
  let totalColumn = 7;
  const people = new Map<string, JiraSummaryPerson>();
  for (const cells of rows) {
    if (isSeparatorRow(cells)) continue;
    if (isHeader(cells)) {
      const detected = new Map<string, number>();
      cells.forEach((cell, index) => {
        const status = canonicalHeaderStatus(cell);
        if (status) detected.set(status, index);
        if (/^(?:t|total|total general|nombre total)$/.test(normalized(cell))) totalColumn = index;
      });
      statusColumns = detected.size >= 3 ? detected : new Map();
      continue;
    }
    const assignee = plainCell(cells[0]);
    if (!assignee || /personne assign[eé]e|nombre total|total g[eé]n[eé]ral/i.test(assignee)) continue;
    const statuses = JIRA_SUMMARY_STATUSES.map((status, fallbackIndex) => ({ status, ...countAndLink(cells[statusColumns.get(status) ?? fallbackIndex + 1] ?? "") }));
    const statusTotal = statuses.reduce((sum, item) => sum + item.count, 0);
    const reported = countAndLink(cells[totalColumn] ?? cells[7] ?? "");
    const total = Math.max(statusTotal, reported.count);
    if (!total) continue;
    const existing = people.get(assignee);
    if (existing) {
      existing.statuses = existing.statuses.map((item) => {
        const incoming = statuses.find((candidate) => candidate.status === item.status);
        return { ...item, count: item.count + (incoming?.count ?? 0), link: item.link || incoming?.link || "" };
      });
      existing.total += total;
      existing.totalLink ||= reported.link;
    } else people.set(assignee, { assignee, statuses, total, totalLink: reported.link });
  }
  return Array.from(people.values());
}

function summaryItems(people: JiraSummaryPerson[]) {
  return people.flatMap((person) => {
    const items: JiraSummaryItem[] = person.statuses.filter((item) => item.count > 0).map((item) => ({ assignee: person.assignee, ...item }));
    const represented = items.reduce((sum, item) => sum + item.count, 0);
    if (person.total > represented) items.push({ assignee: person.assignee, status: "Autres statuts", count: person.total - represented, link: person.totalLink });
    return items;
  });
}

export function jiraSummaryFromDetailedTickets(detailedTickets: JiraDetailedTicket[], format: JiraSummaryImport["format"] = "unknown"): JiraSummaryImport {
  const people = aggregateDetailedTickets(detailedTickets);
  return {
    personCount: people.length,
    tickets: detailedTickets.length,
    people,
    items: summaryItems(people),
    detailedTickets,
    mode: "detailed",
    format,
  };
}

export function parseJiraAssigneeSummary(text: string): JiraSummaryImport {
  const repairedText = repairJiraText(text).replace(/\u00a0/g, " ");
  const rows = repairedText.split(/\r?\n/).map((line) => splitRow(line)).filter((cells) => cells.length > 1);
  const detailedTickets = rows.map((cells) => detailedTicket(cells)).filter((ticket): ticket is JiraDetailedTicket => Boolean(ticket));
  if (detailedTickets.length) return jiraSummaryFromDetailedTickets(detailedTickets, detectedFormat(repairedText));
  const people = legacySummary(rows);
  return {
    personCount: people.length,
    tickets: detailedTickets.length || people.reduce((sum, person) => sum + person.total, 0),
    people,
    items: summaryItems(people),
    detailedTickets,
    mode: "summary",
    format: detectedFormat(repairedText),
  };
}
