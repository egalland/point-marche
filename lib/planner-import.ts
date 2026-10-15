export type PlannerSpecialty = "simulation" | "control";

export type PlannerChecklistItem = {
  order: number | null;
  label: string;
  date: string;
  kind: PlannerSpecialty | "trame" | "other";
  analystName: string;
  nonApplicable: boolean;
};

export type PlannerTaskMetrics = {
  purchases12m: number | null;
  supplierCode: string;
  announcedVariation: number | null;
  globalVariation: number | null;
  weightedVariation: number | null;
  tariffStructure: string;
};

export type PlannerTask = {
  externalId: string;
  taskName: string;
  effectiveMonth: string;
  category: string;
  goal: string;
  plannerStatus: string;
  priority: string;
  assignedTo: string;
  createdBy: string;
  createdAt: string;
  dueDate: string;
  startDate: string;
  recurring: boolean;
  overdue: boolean;
  completedAt: string;
  completedBy: string;
  checklistCompleted: number;
  checklistTotal: number;
  checklist: PlannerChecklistItem[];
  labels: string[];
  comments: string;
  metrics: PlannerTaskMetrics;
  workflowState: "active" | "completed" | "stopped" | "needs-closure";
  importedAt?: string;
  integratedAt?: string;
  registrySource?: "planner-import" | "point-recovery";
};

export type PlannerImport = {
  format: "tabulated" | "markdown" | "semicolon" | "unknown";
  tasks: PlannerTask[];
  ignoredRows: number;
};

const mojibakePairs: [string, string][] = [
  ["Ã‰", "É"], ["Ã©", "é"], ["Ãˆ", "È"], ["Ã¨", "è"], ["ÃŠ", "Ê"], ["Ãª", "ê"],
  ["Ã€", "À"], ["Ã ", "à"], ["ÃŽ", "Î"], ["Ã®", "î"], ["Ã´", "ô"], ["Ã¹", "ù"],
  ["Ã‡", "Ç"], ["Ã§", "ç"], ["Å“", "œ"], ["â€™", "’"], ["â€“", "–"], ["â€”", "—"],
  ["Â ", " "], ["Â", ""],
];

function repairText(value: string) {
  return mojibakePairs.reduce((result, [broken, repaired]) => result.replaceAll(broken, repaired), value);
}

function decodeEntities(value: string) {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/(?:&#39;|&apos;)/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function cleanCell(value: string) {
  return repairText(decodeEntities(value))
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\s*\n\s*/g, "\n")
    .trim();
}

function normalized(value: string) {
  return cleanCell(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, " ")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .toLocaleLowerCase("fr-FR");
}

function splitMarkdownRow(line: string) {
  return line.trim().replace(/^\|/, "").replace(/\|\s*$/, "").split("|").map((cell) => cell.trim());
}

function splitDelimitedRows(text: string, delimiter: "\t" | ";") {
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
    if (character === '"' && (quoted || !cell)) {
      if (quoted && text[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else quoted = !quoted;
      continue;
    }
    if (!quoted && character === delimiter) {
      row.push(cell.trim());
      cell = "";
      continue;
    }
    if (!quoted && (character === "\n" || character === "\r")) {
      if (character === "\r" && text[index + 1] === "\n") index += 1;
      pushRow();
      continue;
    }
    cell += character;
  }
  if (cell || row.length) pushRow();
  return rows;
}

function isSeparatorRow(cells: string[]) {
  return cells.every((cell) => !cell || /^:?-{3,}:?$/.test(cell.trim()));
}

function detectedFormat(text: string): PlannerImport["format"] {
  if (text.includes("\t")) return "tabulated";
  if (text.split(/\r?\n/).some((line) => line.trim().startsWith("|"))) return "markdown";
  if (text.includes(";")) return "semicolon";
  return "unknown";
}

function tableRows(text: string, format: PlannerImport["format"]) {
  if (format === "tabulated") return splitDelimitedRows(text, "\t");
  if (format === "semicolon") return splitDelimitedRows(text, ";");
  if (format === "markdown") return text.split(/\r?\n/).filter((line) => line.trim().startsWith("|")).map(splitMarkdownRow);
  return [];
}

function mergeContinuationRows(rows: string[][], expectedColumns: number) {
  return rows.reduce<string[][]>((result, row) => {
    const previous = result.at(-1);
    if (previous && previous.length >= expectedColumns && row.length === 1) {
      previous[expectedColumns - 1] = [previous[expectedColumns - 1], row[0]].filter(Boolean).join("\n");
    } else result.push(row);
    return result;
  }, []);
}

function isoDate(value: string) {
  const clean = cleanCell(value);
  const iso = clean.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const french = clean.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (french) return `${french[3]}-${french[2].padStart(2, "0")}-${french[1].padStart(2, "0")}`;
  return "";
}

function booleanValue(value: string) {
  return /^(?:true|vrai|oui|1)$/i.test(cleanCell(value));
}

function numberValue(value: string) {
  const clean = cleanCell(value).replace(/\s/g, "").replace(/€/g, "").replace(/%/g, "").replace(/,/g, ".");
  const match = clean.match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : null;
}

function effectiveMonth(taskName: string) {
  const match = cleanCell(taskName).match(/^(20\d{2})-(0[1-9]|1[0-2])(?:-|\b)/);
  return match ? `${match[1]}-${match[2]}` : "";
}

function checklistKind(label: string): PlannerChecklistItem["kind"] {
  const value = normalized(label);
  if (/^simulation\b/.test(value)) return "simulation";
  if (/^controle\b/.test(value)) return "control";
  if (/trame workspace envoyee/.test(value)) return "trame";
  return "other";
}

function checklistAnalyst(label: string, kind: PlannerChecklistItem["kind"]) {
  if (kind !== "simulation" && kind !== "control") return "";
  return cleanCell(label).replace(/^\s*(?:simulation|contr[oô]le)\s*/i, "").replace(/^[-–—:]\s*/, "").trim();
}

function parseChecklist(value: string) {
  return cleanCell(value).split(";").map((segment) => segment.trim()).filter(Boolean).map((segment) => {
    const orderMatch = segment.match(/^\s*(\d+)\s*-/);
    const withoutOrder = segment.replace(/^\s*\d+\s*-\s*/, "");
    const dateMatch = withoutOrder.match(/:\s*(XX\/XX\/XXXX|\d{1,2}\/\d{1,2}\/\d{4}|\d{4}-\d{2}-\d{2})\s*$/i);
    const label = cleanCell(dateMatch ? withoutOrder.slice(0, dateMatch.index) : withoutOrder);
    const kind = checklistKind(label);
    const placeholder = Boolean(dateMatch && /^XX\/XX\/XXXX$/i.test(dateMatch[1]));
    return {
      order: orderMatch ? Number(orderMatch[1]) : null,
      label,
      date: dateMatch && !placeholder ? isoDate(dateMatch[1]) : "",
      kind,
      analystName: checklistAnalyst(label, kind),
      nonApplicable: kind === "trame" && placeholder,
    } satisfies PlannerChecklistItem;
  }).sort((left, right) => (left.order ?? 999) - (right.order ?? 999));
}

function parseChecklistCount(value: string) {
  const match = cleanCell(value).match(/(\d+)\s*\/\s*(\d+)/);
  return match ? { completed: Number(match[1]), total: Number(match[2]) } : { completed: 0, total: 0 };
}

const metricPatterns = {
  purchases12m: String.raw`achats?\s*12\s*m(?:g)?`,
  supplierCode: String.raw`code\s+fournisseur`,
  announcedVariation: String.raw`annonc(?:e|é|ée)`,
  globalVariation: String.raw`variation\s+global`,
  weightedVariation: String.raw`variation\s+pond[ée]r[ée]e`,
  tariffStructure: String.raw`structure\s+tarifaire`,
};

const metricBoundary = `(?:${Object.values(metricPatterns).join("|")})`;

function metricValue(comments: string, pattern: string) {
  const compact = cleanCell(comments).replace(/\n/g, " ");
  return compact.match(new RegExp(`${pattern}\\s*:\\s*(.*?)(?=\\s*${metricBoundary}\\s*:|$)`, "i"))?.[1]?.trim() ?? "";
}

export function parsePlannerTaskMetrics(comments: string): PlannerTaskMetrics {
  return {
    purchases12m: numberValue(metricValue(comments, metricPatterns.purchases12m)),
    supplierCode: metricValue(comments, metricPatterns.supplierCode).toUpperCase(),
    announcedVariation: numberValue(metricValue(comments, metricPatterns.announcedVariation)),
    globalVariation: numberValue(metricValue(comments, metricPatterns.globalVariation)),
    weightedVariation: numberValue(metricValue(comments, metricPatterns.weightedVariation)),
    tariffStructure: metricValue(comments, metricPatterns.tariffStructure),
  };
}

function workflowState(status: string, checklist: PlannerChecklistItem[]): PlannerTask["workflowState"] {
  const closed = /^terminee?s?$/.test(normalized(status));
  const applicable = checklist.filter((item) => !item.nonApplicable);
  const businessComplete = Boolean(applicable.length) && applicable.every((item) => Boolean(item.date));
  if (closed && !businessComplete) return "stopped";
  if (closed) return "completed";
  if (businessComplete) return "needs-closure";
  return "active";
}

function findColumn(headers: string[], candidates: RegExp[], fallback = -1) {
  const index = headers.findIndex((header) => candidates.some((candidate) => candidate.test(normalized(header))));
  return index >= 0 ? index : fallback;
}

export function parsePlannerTasks(text: string): PlannerImport {
  const repaired = repairText(text).replace(/\u00a0/g, " ");
  const format = detectedFormat(repaired);
  const rawRows = tableRows(repaired, format).filter((cells) => cells.length && !isSeparatorRow(cells));
  const preliminaryHeaderIndex = rawRows.findIndex((cells) => cells.some((cell) => /^id de tache$/.test(normalized(cell))) && cells.some((cell) => /^nom de tache$/.test(normalized(cell))));
  const rows = preliminaryHeaderIndex >= 0 ? mergeContinuationRows(rawRows, rawRows[preliminaryHeaderIndex].length) : rawRows;
  const headerIndex = rows.findIndex((cells) => cells.some((cell) => /^id de tache$/.test(normalized(cell))) && cells.some((cell) => /^nom de tache$/.test(normalized(cell))));
  if (headerIndex < 0) return { format, tasks: [], ignoredRows: rows.length };
  const headers = rows[headerIndex];
  const columns = {
    id: findColumn(headers, [/^id de tache$/]),
    name: findColumn(headers, [/^nom de tache$/]),
    category: findColumn(headers, [/^categorie$/]),
    goal: findColumn(headers, [/^but$/]),
    status: findColumn(headers, [/^statut$/]),
    priority: findColumn(headers, [/^priorite$/]),
    assignedTo: findColumn(headers, [/^attribue a$/]),
    createdBy: findColumn(headers, [/^cree par$/]),
    createdAt: findColumn(headers, [/^date de creation$/]),
    dueDate: findColumn(headers, [/^date d echeance$/]),
    startDate: findColumn(headers, [/^date de debut$/]),
    recurring: findColumn(headers, [/^est periodique$/]),
    overdue: findColumn(headers, [/^en retard$/]),
    completedAt: findColumn(headers, [/^date de fin$/]),
    completedBy: findColumn(headers, [/^execute par$/]),
    checklistCount: findColumn(headers, [/elements de la liste de controle effectues/]),
    checklist: findColumn(headers, [/^elements de la liste de controle$/]),
    labels: findColumn(headers, [/^etiquettes$/]),
    comments: findColumn(headers, [/^commentaires$/]),
  };
  const cell = (row: string[], index: number) => index >= 0 ? cleanCell(row[index] ?? "") : "";
  let ignoredRows = 0;
  const tasks = rows.slice(headerIndex + 1).map((row) => {
    const externalId = cell(row, columns.id);
    const taskName = cell(row, columns.name);
    if (!externalId || !taskName) {
      ignoredRows += 1;
      return null;
    }
    const checklist = parseChecklist(cell(row, columns.checklist));
    const checklistCount = parseChecklistCount(cell(row, columns.checklistCount));
    const comments = cell(row, columns.comments);
    return {
      externalId,
      taskName,
      effectiveMonth: effectiveMonth(taskName),
      category: cell(row, columns.category),
      goal: cell(row, columns.goal),
      plannerStatus: cell(row, columns.status),
      priority: cell(row, columns.priority),
      assignedTo: cell(row, columns.assignedTo),
      createdBy: cell(row, columns.createdBy),
      createdAt: isoDate(cell(row, columns.createdAt)),
      dueDate: isoDate(cell(row, columns.dueDate)),
      startDate: isoDate(cell(row, columns.startDate)),
      recurring: booleanValue(cell(row, columns.recurring)),
      overdue: booleanValue(cell(row, columns.overdue)),
      completedAt: isoDate(cell(row, columns.completedAt)),
      completedBy: cell(row, columns.completedBy),
      checklistCompleted: checklistCount.completed,
      checklistTotal: checklistCount.total,
      checklist,
      labels: cell(row, columns.labels).split(/[;,]/).map((label) => label.trim().toUpperCase()).filter(Boolean),
      comments,
      metrics: parsePlannerTaskMetrics(comments),
      workflowState: workflowState(cell(row, columns.status), checklist),
      registrySource: "planner-import",
    } satisfies PlannerTask;
  }).filter((task) => task !== null);
  return { format, tasks, ignoredRows };
}

export function plannerTaskMonthLabel(task: PlannerTask) {
  if (!/^\d{4}-\d{2}$/.test(task.effectiveMonth)) return "Mois non identifié";
  const date = new Date(`${task.effectiveMonth}-01T12:00:00Z`);
  const label = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric", timeZone: "UTC" }).format(date);
  return label.charAt(0).toLocaleUpperCase("fr-FR") + label.slice(1);
}
