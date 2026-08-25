export const JIRA_SUMMARY_STATUSES = [
  "À faire",
  "Réouvert",
  "En cours",
  "En attente du client",
  "En attente d’un tiers",
  "En attente de changement",
] as const;

export type JiraSummaryStatus = {
  status: string;
  count: number;
  link: string;
};

export type JiraSummaryPerson = {
  assignee: string;
  statuses: JiraSummaryStatus[];
  total: number;
  totalLink: string;
};

export type JiraSummaryItem = JiraSummaryStatus & {
  assignee: string;
};

export type JiraSummaryImport = {
  personCount: number;
  tickets: number;
  people: JiraSummaryPerson[];
  items: JiraSummaryItem[];
  format: "tabulated" | "markdown" | "semicolon" | "unknown";
};

function decodeEntities(value: string) {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/(?:&#39;|&apos;)/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function plainCell(value: string) {
  return decodeEntities(value)
    .replace(/<br\s*\/?\s*>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\*\*/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalized(value: string) {
  return plainCell(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, " ")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .toLowerCase();
}

function countAndLink(value: string) {
  const markdownLink = value.match(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/i);
  const htmlLink = value.match(/<a\b[^>]*href=["'](https?:\/\/[^"']+)["'][^>]*>([\s\S]*?)<\/a>/i);
  const label = plainCell(markdownLink?.[1] ?? htmlLink?.[2] ?? value);
  const number = label.replace(/\s/g, "").match(/\d+/)?.[0];
  const plainLink = value.match(/https?:\/\/[^\s<>)]+/i)?.[0] ?? "";
  return {
    count: number ? Number(number) : 0,
    link: decodeEntities(markdownLink?.[2] ?? htmlLink?.[1] ?? plainLink),
  };
}

function splitMarkdownRow(line: string) {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|\s*$/, "")
    .split("|")
    .map((cell) => cell.trim());
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

function canonicalHeaderStatus(value: string) {
  const label = normalized(value);
  const matches = [
    { status: JIRA_SUMMARY_STATUSES[0], test: /^(?:a faire|to do)$/ },
    { status: JIRA_SUMMARY_STATUSES[1], test: /^reouvert(?:e)?$/ },
    { status: JIRA_SUMMARY_STATUSES[2], test: /^en cours$/ },
    { status: JIRA_SUMMARY_STATUSES[3], test: /^en attente (?:du )?client$/ },
    { status: JIRA_SUMMARY_STATUSES[4], test: /^en attente (?:d un |de |du )?tiers$/ },
    { status: JIRA_SUMMARY_STATUSES[5], test: /^en attente (?:de |du )?changement$/ },
  ].filter((entry) => entry.test.test(label));
  return matches.length === 1 ? matches[0].status : "";
}

function isHeader(cells: string[]) {
  const row = normalized(cells.join(" "));
  return /personne assignee|assignee|responsable/.test(row)
    && /a faire|reouvert|en cours|attente/.test(row);
}

function isSeparatorRow(cells: string[]) {
  return cells.every((cell) => !cell || /^:?-{3,}:?$/.test(cell.trim()));
}

export function parseJiraAssigneeSummary(text: string): JiraSummaryImport {
  const rows = text
    .replace(/\u00a0/g, " ")
    .split(/\r?\n/)
    .map((line) => splitRow(line))
    .filter((cells) => cells.length > 1);

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

    const statuses = JIRA_SUMMARY_STATUSES.map((status, fallbackIndex) => {
      const column = statusColumns.get(status) ?? fallbackIndex + 1;
      return { status, ...countAndLink(cells[column] ?? "") };
    });
    const statusTotal = statuses.reduce((sum, item) => sum + item.count, 0);
    const reported = countAndLink(cells[totalColumn] ?? cells[7] ?? "");
    const total = Math.max(statusTotal, reported.count);
    if (!total) continue;

    const existing = people.get(assignee);
    if (existing) {
      existing.statuses = existing.statuses.map((item) => {
        const incoming = statuses.find((candidate) => candidate.status === item.status);
        return {
          ...item,
          count: item.count + (incoming?.count ?? 0),
          link: item.link || incoming?.link || "",
        };
      });
      existing.total += total;
      existing.totalLink ||= reported.link;
    } else {
      people.set(assignee, { assignee, statuses, total, totalLink: reported.link });
    }
  }

  const peopleRows = Array.from(people.values());
  const items = peopleRows.flatMap((person) => {
    const statusItems: JiraSummaryItem[] = person.statuses
      .filter((item) => item.count > 0)
      .map((item) => ({ assignee: person.assignee, ...item }));
    const represented = statusItems.reduce((sum, item) => sum + item.count, 0);
    if (person.total > represented) {
      statusItems.push({
        assignee: person.assignee,
        status: "Autres statuts",
        count: person.total - represented,
        link: person.totalLink,
      });
    }
    return statusItems;
  });

  return {
    personCount: peopleRows.length,
    tickets: peopleRows.reduce((sum, person) => sum + person.total, 0),
    people: peopleRows,
    items,
    format: detectedFormat(text),
  };
}
