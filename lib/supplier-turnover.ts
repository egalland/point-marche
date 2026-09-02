export const supplierTurnoverLabel = "CA fournisseur · 12 mG";
export const supplierTurnoverSource = "Montant « Achats 12 mG » importé pour cette simulation, sur 12 mois glissants. Aucun cumul entre simulations.";

const euroFormatter = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function amount(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function formatSupplierTurnover(value: number | null | undefined) {
  const current = amount(value);
  return current === null ? "—" : euroFormatter.format(current);
}

export function compareSupplierTurnover(left: number | null | undefined, right: number | null | undefined, direction: "asc" | "desc") {
  const first = amount(left);
  const second = amount(right);
  if (first === null) return second === null ? 0 : 1;
  if (second === null) return -1;
  return direction === "asc" ? first - second : second - first;
}

export function supplierTurnoverHtml(value: number | null | undefined) {
  return `<span title="${supplierTurnoverSource}" style="display:block;margin-top:7px"><span style="color:#61736E;font-size:10px;font-weight:400">${supplierTurnoverLabel}</span><br><strong style="font-size:13px;white-space:nowrap;font-variant-numeric:tabular-nums">${formatSupplierTurnover(value)}</strong></span>`;
}
