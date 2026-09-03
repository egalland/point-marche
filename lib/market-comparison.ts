import { isClosedJiraStatus } from "./jira-import";

export type MarketComparisonRow = { marketId: string; label: string; color: string; count: number | null; source: "import" | "manual" | "saved" | "unavailable"; updatedAt: string };
export type MarketComparison = { metric: "open-jira"; year: number; week: number; measuredAt: string; rows: MarketComparisonRow[] };
export const marketComparisonColors = ["#128467", "#7859C5", "#177FAD", "#CF752A", "#BB4268", "#576D7C"];
const escapeHtml = (text: string) => text.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);

export function openTicketCount(tickets: { status: string; count?: number }[]) {
  return tickets.filter((ticket) => !isClosedJiraStatus(ticket.status)).reduce((sum, ticket) => sum + (Number.isFinite(ticket.count) && Number(ticket.count) > 0 ? Math.round(Number(ticket.count)) : 1), 0);
}

export function normalizeMarketComparison(value: unknown): MarketComparison | null {
  if (!value || typeof value !== "object") return null;
  const source = value as MarketComparison;
  if (source.metric !== "open-jira" || !Number.isInteger(source.year) || !Number.isInteger(source.week) || source.week < 1 || source.week > 53 || !Array.isArray(source.rows)) return null;
  const seen = new Set<string>();
  const rows: MarketComparisonRow[] = [];
  for (const row of source.rows) {
    if (!row || typeof row.marketId !== "string" || !row.marketId || seen.has(row.marketId) || typeof row.label !== "string") continue;
    seen.add(row.marketId);
    rows.push({ marketId: row.marketId, label: row.label, color: /^#[\da-f]{6}$/i.test(row.color) ? row.color : marketComparisonColors[rows.length % marketComparisonColors.length], count: typeof row.count === "number" && Number.isSafeInteger(row.count) && row.count >= 0 ? row.count : null, source: ["import", "manual", "saved"].includes(row.source) ? row.source : "unavailable", updatedAt: typeof row.updatedAt === "string" ? row.updatedAt : "" });
  }
  return { metric: "open-jira", year: source.year, week: source.week, measuredAt: typeof source.measuredAt === "string" ? source.measuredAt : "", rows };
}

export function comparisonTotals(rows: MarketComparisonRow[]) {
  const available = rows.filter((row) => row.count !== null);
  return { total: available.reduce((sum, row) => sum + row.count!, 0), available: available.length, missing: rows.length - available.length };
}

export function comparisonSlices(rows: MarketComparisonRow[]) {
  const { total } = comparisonTotals(rows);
  let angle = -Math.PI / 2;
  return rows.filter((row) => row.count !== null && row.count > 0).map((row) => {
    const start = angle, end = start + row.count! / total * Math.PI * 2;
    angle = end;
    const point = (theta: number) => `${(120 + 104 * Math.cos(theta)).toFixed(4)} ${(120 + 104 * Math.sin(theta)).toFixed(4)}`;
    const path = row.count === total ? `M 120 16 A 104 104 0 1 1 120 224 A 104 104 0 1 1 120 16 Z` : `M 120 120 L ${point(start)} A 104 104 0 ${end - start > Math.PI ? 1 : 0} 1 ${point(end)} Z`;
    return { ...row, percent: row.count! / total * 100, start, end, path };
  });
}

export function comparisonSvg(rows: MarketComparisonRow[]) {
  const paths = comparisonSlices(rows);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240" role="img" aria-label="Répartition des tickets Jira ouverts par marché">${paths.length ? paths.map((slice) => `<path d="${slice.path}" fill="${slice.color}" stroke="#FFFFFF" stroke-width="2"><title>${escapeHtml(slice.label)} : ${slice.count} (${slice.percent.toFixed(1)} %)</title></path>`).join("") : '<circle cx="120" cy="120" r="104" fill="#E4EAE7"/>'}</svg>`;
}

export function comparisonPng(rows: MarketComparisonRow[]) {
  if (typeof document === "undefined") return "";
  const canvas = document.createElement("canvas");
  canvas.width = 480; canvas.height = 480;
  const context = canvas.getContext("2d");
  if (!context) return "";
  context.fillStyle = "#FFFFFF"; context.fillRect(0, 0, 480, 480);
  const slices = comparisonSlices(rows);
  if (!slices.length) { context.fillStyle = "#E4EAE7"; context.beginPath(); context.arc(240, 240, 208, 0, Math.PI * 2); context.fill(); }
  for (const slice of slices) { context.beginPath(); context.moveTo(240, 240); context.arc(240, 240, 208, slice.start, slice.end); context.closePath(); context.fillStyle = slice.color; context.fill(); context.strokeStyle = "#FFFFFF"; context.lineWidth = 4; context.stroke(); }
  return canvas.toDataURL("image/png");
}

export function marketComparisonHtml(snapshot: MarketComparison | null, png?: string) {
  if (!snapshot) return '<p style="color:#61736E;padding:12px">Comparaison non renseignée.</p>';
  const { total, missing } = comparisonTotals(snapshot.rows);
  const chart = png ? `<img width="220" height="220" alt="Répartition des tickets Jira ouverts par marché" src="${png}" style="display:block;width:220px;height:220px"/>` : comparisonSvg(snapshot.rows);
  return `<div style="padding:12px;color:#203D33;background:#FFFFFF"><p style="margin:0 0 12px;font-size:12px">Tickets Jira ouverts · ${snapshot.year} · S${String(snapshot.week).padStart(2, "0")}<br><small>Dernier import ou saisie manuelle de chaque marché.</small></p><table role="presentation" width="100%"><tr><td width="220" valign="top">${chart}</td><td valign="middle"><table width="100%" cellspacing="0" cellpadding="5">${snapshot.rows.map((row) => `<tr><td style="color:${row.color};font-weight:bold">●</td><td style="font-size:12px">${escapeHtml(row.label)}${row.source === "manual" ? " (manuel)" : ""}</td><td style="text-align:right;font-weight:bold">${row.count === null ? "—" : row.count}</td><td style="text-align:right;font-size:11px">${row.count === null || !total ? "—" : `${(row.count / total * 100).toFixed(1)} %`}</td></tr>`).join("")}</table><p style="font-size:12px">${total} ticket${total > 1 ? "s" : ""} sur les marchés renseignés${missing ? ` · ${missing} marché${missing > 1 ? "s" : ""} sans données` : ""}.</p></td></tr></table></div>`;
}
