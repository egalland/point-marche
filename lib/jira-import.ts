export const JIRA_SUMMARY_STATUSES = [
  "À faire",
  "Réouvert",
  "En cours",
  "En attente du client",
  "En attente d’un tiers",
  "En attente de changement",
] as const;

export type JiraSummaryItem = {
  assignee: string;
  status: string;
  count: number;
  link: string;
};

export type JiraSummaryImport = {
  people: number;
  tickets: number;
  items: JiraSummaryItem[];
};

function plainCell(value: string) {
  return value
    .replace(/<br\s*\/?\s*>/gi, " ")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\*\*/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function countAndLink(value: string) {
  const markdownLink = value.match(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/i);
  const label = plainCell(markdownLink?.[1] ?? value);
  const number = label.match(/\d+/)?.[0];
  return {
    count: number ? Number(number) : 0,
    link: markdownLink?.[2] ?? "",
  };
}

function splitMarkdownRow(line: string) {
  const trimmed = line.trim();
  if (!trimmed.startsWith("|")) return [];
  return trimmed
    .replace(/^\|/, "")
    .replace(/\|\s*$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

export function parseJiraAssigneeSummary(text: string): JiraSummaryImport {
  const items: JiraSummaryItem[] = [];
  const people = new Set<string>();

  for (const line of text.split(/\r?\n/)) {
    const cells = splitMarkdownRow(line);
    if (cells.length < 8) continue;

    const assignee = plainCell(cells[0]);
    if (!assignee || /personne assign[eé]e|nombre total|^:?-{3,}:?$/i.test(assignee)) continue;

    const statusCells = JIRA_SUMMARY_STATUSES.map((status, index) => ({
      status,
      ...countAndLink(cells[index + 1]),
    }));
    const reportedTotal = countAndLink(cells[7]).count;
    const statusTotal = statusCells.reduce((sum, item) => sum + item.count, 0);
    if (!reportedTotal && !statusTotal) continue;

    people.add(assignee);
    statusCells.forEach((item) => {
      if (item.count > 0) items.push({ assignee, ...item });
    });
  }

  return {
    people: people.size,
    tickets: items.reduce((sum, item) => sum + item.count, 0),
    items,
  };
}
