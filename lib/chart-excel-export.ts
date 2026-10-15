import { chartExcelTemplate } from "./chart-excel-template";
import { supplierVariationView, type SupplierVariationPoint } from "./supplier-variations";
import type { ChartImageInfo } from "./chart-image-export";

type ExcelInfo = ChartImageInfo & { supplierLabel?: string; supplierCode?: string; exportedAt?: Date };
const xml = (value: string) => value.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[character]!);
const textCell = (address: string, text: string, style = 1) => `<x:c r="${address}" s="${style}" t="inlineStr"><x:is><x:t xml:space="preserve">${xml(text)}</x:t></x:is></x:c>`;
const finite = (value: number | null) => typeof value === "number" && Number.isFinite(value);
const percentCell = (address: string, value: number | null) => finite(value) ? `<x:c r="${address}" s="8"><x:v>${value! / 100}</x:v></x:c>` : `<x:c r="${address}" s="8"/>`;
const formulaCell = (address: string, formula: string, cached: number | null) => `<x:c r="${address}" s="8"${cached === null ? ' t="str"' : ""}><x:f>${xml(formula)}</x:f><x:v>${cached ?? ""}</x:v></x:c>`;
const row = (index: number, cells: string, height = 23) => `<x:row r="${index}" ht="${height}" customHeight="1">${cells}</x:row>`;
const periodLabel = (period: string) => new Intl.DateTimeFormat("fr-FR", { month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${period}-01T12:00:00Z`)).replace(".", "");
const views = [
  { name: "GLOBAL & pondérée - mois", title: "GLOBAL et pondérée · tous les mois", mode: "months", global: true, weighted: true },
  { name: "GLOBAL - mois", title: "GLOBAL · tous les mois", mode: "months", global: true, weighted: false },
  { name: "GLOBAL - variations", title: "GLOBAL · variations uniquement", mode: "variations", global: true, weighted: false },
  { name: "Pondérée - mois", title: "Pondérée · tous les mois", mode: "months", global: false, weighted: true },
  { name: "Pondérée - variations", title: "Pondérée · variations uniquement", mode: "variations", global: false, weighted: true },
] as const;

function exportIdentity(points: SupplierVariationPoint[], info: ExcelInfo) {
  const first = points[0];
  const label = info.supplierLabel || (first?.supplierKey === "selection-average" ? "Sélection fournisseurs" : first?.supplierLabel) || "Fournisseur";
  const code = info.supplierCode ?? first?.supplierCode ?? "";
  const date = info.exportedAt ?? new Date();
  const dateParts = Object.fromEntries(new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(date).map((part) => [part.type, part.value]));
  const dateLabel = `${dateParts.day}/${dateParts.month}/${dateParts.year} ${dateParts.hour}:${dateParts.minute}`;
  const dateSerial = Date.UTC(Number(dateParts.year), Number(dateParts.month) - 1, Number(dateParts.day), Number(dateParts.hour), Number(dateParts.minute)) / 86_400_000 + 25569;
  return { label, code, dateLabel, dateSerial, dateStamp: `${dateParts.year}-${dateParts.month}-${dateParts.day}_${dateParts.hour}-${dateParts.minute}` };
}

export function chartExcelFilename(points: SupplierVariationPoint[], info: ExcelInfo) {
  const identity = exportIdentity(points, info);
  const safe = (value: string) => value.normalize("NFD").replace(/\p{Diacritic}/gu, "").replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 90);
  return ["Point-marche", safe(identity.label), identity.code ? `Code-${safe(identity.code)}` : "", identity.dateStamp].filter(Boolean).join("_") + ".xlsx";
}

/** All five views are exported independently of the visible graph's toggles. */
export function chartExcelParts(observations: SupplierVariationPoint[], info: ExcelInfo): Record<string, string> {
  if (!observations.some((point) => finite(point.globalVariation) || finite(point.weightedVariation))) throw new Error("Aucune donnée à exporter.");
  if (observations.length > 100_000) throw new Error("Réduis la période avant d’exporter.");
  const calendar = supplierVariationView(observations, "months");
  if (calendar.length > 100_000) throw new Error("Réduis la période avant d’exporter.");
  const parts = { ...chartExcelTemplate };
  const identity = exportIdentity(observations, info);
  const period = `${periodLabel(calendar[0].period)} — ${periodLabel(calendar.at(-1)!.period)}`;
  const context = `${identity.label}${identity.code ? ` · Code ${identity.code}` : ""} · export du ${identity.dateLabel}`;
  const summaryRows: string[] = [];
  const links: string[] = [];
  views.forEach((view, index) => {
    const points = view.mode === "months" ? calendar : supplierVariationView(observations, "variations", view.global, view.weighted);
    const series = [
      { key: "globalVariation" as const, label: "Variation GLOBAL", visible: view.global },
      { key: "weightedVariation" as const, label: "Variation pondérée", visible: view.weighted },
    ].filter((item) => item.visible);
    // An empty view still has a blank, editable table row, without a made-up month or zero.
    const lastRow = 28 + Math.max(points.length, 1), lastColumn = series.length === 2 ? "C" : "B";
    const tableRange = `A28:${lastColumn}${lastRow}`;
    const labels = points.map((point) => periodLabel(point.period));
    const means = series.map((item) => {
      const values = points.map((point) => point[item.key]).filter((value): value is number => finite(value));
      return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length / 100 : null;
    });
    const averages = series.map((_, seriesIndex) => {
      const column = String.fromCharCode(66 + seriesIndex), range = `${column}29:${column}${lastRow}`;
      return formulaCell(`${column}5`, `IF(COUNT(${range})=0,"",AVERAGE(${range}))`, means[seriesIndex]);
    }).join("");
    const header = row(28, textCell("A28", "Mois", 9) + series.map((item, j) => textCell(`${String.fromCharCode(66 + j)}28`, item.label, 9)).join(""), 26);
    const data = points.length ? points.map((point, i) => row(i + 29, textCell(`A${i + 29}`, labels[i]) + series.map((item, j) => percentCell(`${String.fromCharCode(66 + j)}${i + 29}`, point[item.key])).join(""))).join("") : row(29, textCell("A29", "") + percentCell("B29", null));
    const rows = row(2, textCell("A2", view.title, 2), 28) + row(3, textCell("A3", context, 3)) + row(4, textCell("A4", "Retour à la présentation", 7)) + row(5, textCell("A5", "Moyenne des données") + averages, 26) + header + data;
    const sheetPath = `xl/worksheets/sheet${index + 2}.xml`;
    parts[sheetPath] = parts[sheetPath].replace(/<x:sheetData>[\s\S]*?<\/x:sheetData>/, `<x:sheetData>${rows}</x:sheetData><x:hyperlinks><x:hyperlink ref="A4" location="&apos;Présentation&apos;!A1" display="Retour à la présentation"/></x:hyperlinks>`);
    const tablePath = `xl/tables/table${index + 1}.xml`;
    parts[tablePath] = parts[tablePath].replace(/ref="[^"]+"/, `ref="${tableRange}"`).replace(/<x:tableColumns/, `<x:autoFilter ref="${tableRange}"/><x:tableColumns`);
    const chartPath = `xl/drawings/charts/chart${index + 1}.xml`;
    const originalSeries = parts[chartPath].match(/<c:ser>[\s\S]*?<\/c:ser>/g)!;
    const categoryCache = `<c:strCache><c:ptCount val="${points.length}"/>${labels.map((label, i) => `<c:pt idx="${i}"><c:v>${xml(label)}</c:v></c:pt>`).join("")}</c:strCache>`;
    const updatedSeries = series.map((item, j) => {
      const column = String.fromCharCode(66 + j);
      const cache = `<c:numCache><c:formatCode>0.00%</c:formatCode><c:ptCount val="${points.length}"/>${points.map((point, i) => finite(point[item.key]) ? `<c:pt idx="${i}"><c:v>${point[item.key]! / 100}</c:v></c:pt>` : "").join("")}</c:numCache>`;
      return originalSeries[j]
        .replace(/<c:cat>[\s\S]*?<\/c:cat>/, `<c:cat><c:strRef><c:f>${xml(`'${view.name}'!$A$29:$A$${lastRow}`)}</c:f>${categoryCache}</c:strRef></c:cat>`)
        .replace(/<c:val>[\s\S]*?<\/c:val>/, `<c:val><c:numRef><c:f>${xml(`'${view.name}'!$${column}$29:$${column}$${lastRow}`)}</c:f>${cache}</c:numRef></c:val>`);
    }).join("");
    parts[chartPath] = parts[chartPath].replace(/<c:ser>[\s\S]*<\/c:ser>/, updatedSeries)
      .replace(`<a:t>${xml(view.name)}</a:t>`, `<a:t>${xml(view.title)}</a:t>`)
      .replace('<c:barDir val="col" />', '<c:barDir val="col"/><c:grouping val="clustered"/>')
      .replace('<c:plotVisOnly val="1" />', '<c:plotVisOnly val="1"/><c:dispBlanksAs val="gap"/>');
    const summaryRow = index + 10;
    const summaryMean = (address: string, seriesIndex: number) => {
      if (seriesIndex === -1) return textCell(address, "");
      const ref = `'${view.name}'!${String.fromCharCode(66 + seriesIndex)}5`;
      return formulaCell(address, `IF(${ref}="","",${ref})`, means[seriesIndex]);
    };
    summaryRows.push(row(summaryRow, textCell(`A${summaryRow}`, view.title, 7) + summaryMean(`B${summaryRow}`, series.findIndex((item) => item.key === "globalVariation")) + summaryMean(`C${summaryRow}`, series.findIndex((item) => item.key === "weightedVariation")), 28));
    links.push(`<x:hyperlink ref="A${summaryRow}" location="${xml(`'${view.name}'!A1`)}" display="${xml(view.title)}"/>`);
  });
  const coverRows = row(2, textCell("A2", identity.label, 2), 28) + row(3, textCell("A3", "Point marché · variations fournisseur", 3))
    + row(4, textCell("A4", "Code Code") + textCell("B4", identity.code))
    + row(5, textCell("A5", "Date d’export (Paris)") + `<x:c r="B5" s="4"><x:v>${identity.dateSerial}</x:v></x:c>`)
    + row(6, textCell("A6", "Période") + textCell("B6", period))
    + row(7, textCell("A7", info.subtitle, 3))
    + row(9, textCell("A9", "Ouvrir une vue", 6) + textCell("B9", "Moyenne GLOBAL", 6) + textCell("C9", "Moyenne pondérée", 6), 26)
    + summaryRows.join("")
    + row(17, textCell("A17", "Les moyennes excluent les cellules vides et incluent les vrais 0 %."))
    + row(18, textCell("A18", "Chaque feuille contient son graphique et ses données modifiables."))
    + row(19, textCell("A19", "Modifier une feuille recalcule sa moyenne et ce récapitulatif."));
  parts["xl/worksheets/sheet1.xml"] = parts["xl/worksheets/sheet1.xml"].replace(/<x:sheetData>[\s\S]*?<\/x:sheetData>/, `<x:sheetData>${coverRows}</x:sheetData><x:hyperlinks>${links.join("")}</x:hyperlinks>`);
  parts["xl/workbook.xml"] = parts["xl/workbook.xml"].replace("</x:workbook>", '<x:calcPr calcMode="auto" fullCalcOnLoad="1" forceFullCalc="1"/></x:workbook>');
  return parts;
}

// Small uncompressed ZIP writer: no service, dependency download or network request.
function zipParts(parts: Record<string, string>): Uint8Array<ArrayBuffer> {
  const encoder = new TextEncoder();
  const crcTable = Array.from({ length: 256 }, (_, index) => { let crc = index; for (let bit = 0; bit < 8; bit++) crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1; return crc >>> 0; });
  const files = Object.entries(parts).map(([path, content]) => {
    const name = encoder.encode(path), data = encoder.encode(content);
    let crc = 0xffffffff; for (const byte of data) crc = crcTable[(crc ^ byte) & 255] ^ (crc >>> 8);
    return { name, data, crc: (crc ^ 0xffffffff) >>> 0, offset: 0 };
  });
  const localSize = files.reduce((sum, file) => sum + 30 + file.name.length + file.data.length, 0);
  const centralSize = files.reduce((sum, file) => sum + 46 + file.name.length, 0);
  const result = new Uint8Array(localSize + centralSize + 22), view = new DataView(result.buffer);
  let offset = 0;
  for (const file of files) {
    file.offset = offset; view.setUint32(offset, 0x04034b50, true); view.setUint16(offset + 4, 20, true); view.setUint16(offset + 6, 0x800, true); view.setUint16(offset + 12, 0x21, true);
    view.setUint32(offset + 14, file.crc, true); view.setUint32(offset + 18, file.data.length, true); view.setUint32(offset + 22, file.data.length, true); view.setUint16(offset + 26, file.name.length, true);
    result.set(file.name, offset + 30); result.set(file.data, offset + 30 + file.name.length); offset += 30 + file.name.length + file.data.length;
  }
  for (const file of files) {
    view.setUint32(offset, 0x02014b50, true); view.setUint16(offset + 4, 20, true); view.setUint16(offset + 6, 20, true); view.setUint16(offset + 8, 0x800, true); view.setUint16(offset + 14, 0x21, true);
    view.setUint32(offset + 16, file.crc, true); view.setUint32(offset + 20, file.data.length, true); view.setUint32(offset + 24, file.data.length, true); view.setUint16(offset + 28, file.name.length, true); view.setUint32(offset + 42, file.offset, true);
    result.set(file.name, offset + 46); offset += 46 + file.name.length;
  }
  view.setUint32(offset, 0x06054b50, true); view.setUint16(offset + 8, files.length, true); view.setUint16(offset + 10, files.length, true); view.setUint32(offset + 12, centralSize, true); view.setUint32(offset + 16, localSize, true);
  return result;
}

export function chartExcelBytes(points: SupplierVariationPoint[], info: ExcelInfo) {
  return zipParts(chartExcelParts(points, info));
}

export function downloadChartExcel(points: SupplierVariationPoint[], info: ExcelInfo) {
  const blob = new Blob([chartExcelBytes(points, info)], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob), link = document.createElement("a");
  link.href = url; link.download = chartExcelFilename(points, info); document.body.appendChild(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
