import { chartExcelTemplate } from "./chart-excel-template";
import type { SupplierVariationPoint } from "./supplier-variations";
import type { ChartImageInfo } from "./chart-image-export";

const xml = (value: string) => value.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[character]!);
const textCell = (address: string, text: string, style = 1) => `<x:c r="${address}" s="${style}" t="inlineStr"><x:is><x:t xml:space="preserve">${xml(text)}</x:t></x:is></x:c>`;
const percentCell = (address: string, value: number | null) => typeof value === "number" && Number.isFinite(value) ? `<x:c r="${address}" s="4"><x:v>${value / 100}</x:v></x:c>` : `<x:c r="${address}" s="4"/>`;
const periodLabel = (period: string) => new Intl.DateTimeFormat("fr-FR", { month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${period}-01T12:00:00Z`)).replace(".", "");

/** Populate the authored template, including native chart ranges and cached values. */
export function chartExcelParts(points: SupplierVariationPoint[], info: ChartImageInfo): Record<string, string> {
  const series = [
    { key: "globalVariation" as const, label: "Variation GLOBAL", visible: info.global, templateIndex: 0 },
    { key: "weightedVariation" as const, label: "Variation pondérée", visible: info.weighted, templateIndex: 1 },
  ].filter((item) => item.visible);
  if (!points.length || !series.length) throw new Error("Aucune donnée à exporter.");
  if (points.length > 100_000) throw new Error("Réduis la période avant d’exporter.");
  const parts = { ...chartExcelTemplate };
  const lastRow = 26 + points.length, lastColumn = series.length === 2 ? "C" : "B";
  const tableRange = `A26:${lastColumn}${lastRow}`;
  const labels = points.map((point) => periodLabel(point.period));
  const dataRows = points.map((point, index) => {
    const row = index + 27;
    return `<x:row r="${row}" ht="21" customHeight="1">${textCell(`A${row}`, labels[index])}${series.map((item, seriesIndex) => percentCell(`${String.fromCharCode(66 + seriesIndex)}${row}`, point[item.key])).join("")}</x:row>`;
  }).join("");
  const header = `<x:row r="26" ht="24" customHeight="1">${textCell("A26", "Mois", 5)}${series.map((item, index) => textCell(`${String.fromCharCode(66 + index)}26`, item.label, 5)).join("")}</x:row>`;
  const rows = `<x:row r="2">${textCell("A2", info.title, 2)}</x:row><x:row r="3">${textCell("A3", info.subtitle, 3)}</x:row>${header}${dataRows}`;
  parts["xl/worksheets/sheet1.xml"] = parts["xl/worksheets/sheet1.xml"].replace(/<x:sheetData>[\s\S]*?<\/x:sheetData>/, `<x:sheetData>${rows}</x:sheetData>`);
  parts["xl/tables/table1.xml"] = parts["xl/tables/table1.xml"]
    .replace(/ref="[^"]+"/, `ref="${tableRange}"`)
    .replace(/<x:tableColumns[\s\S]*?<\/x:tableColumns>/, `<x:autoFilter ref="${tableRange}"/><x:tableColumns count="${series.length + 1}"><x:tableColumn id="1" name="Mois"/>${series.map((item, index) => `<x:tableColumn id="${index + 2}" name="${item.label}"/>`).join("")}</x:tableColumns>`);
  const chartPath = "xl/drawings/charts/chart1.xml";
  const originalSeries = parts[chartPath].match(/<c:ser>[\s\S]*?<\/c:ser>/g)!;
  const categoryCache = `<c:strCache><c:ptCount val="${points.length}"/>${labels.map((label, index) => `<c:pt idx="${index}"><c:v>${xml(label)}</c:v></c:pt>`).join("")}</c:strCache>`;
  const updatedSeries = series.map((item, index) => {
    const column = String.fromCharCode(66 + index);
    const cache = `<c:numCache><c:formatCode>0.00%</c:formatCode><c:ptCount val="${points.length}"/>${points.map((point, pointIndex) => typeof point[item.key] === "number" && Number.isFinite(point[item.key]) ? `<c:pt idx="${pointIndex}"><c:v>${point[item.key]! / 100}</c:v></c:pt>` : "").join("")}</c:numCache>`;
    return originalSeries[item.templateIndex]
      .replace(/<c:idx val="\d+"\s*\/>/, `<c:idx val="${index}"/>`).replace(/<c:order val="\d+"\s*\/>/, `<c:order val="${index}"/>`)
      .replace(/<c:cat>[\s\S]*?<\/c:cat>/, `<c:cat><c:strRef><c:f>'Variations'!$A$27:$A$${lastRow}</c:f>${categoryCache}</c:strRef></c:cat>`)
      .replace(/<c:val>[\s\S]*?<\/c:val>/, `<c:val><c:numRef><c:f>'Variations'!$${column}$27:$${column}$${lastRow}</c:f>${cache}</c:numRef></c:val>`);
  }).join("");
  parts[chartPath] = parts[chartPath]
    .replace(/<c:ser>[\s\S]*<\/c:ser>/, updatedSeries)
    .replace("<a:t>Variation moyenne par mois</a:t>", `<a:t>${xml(info.title)}</a:t>`)
    .replace('<c:barDir val="col" />', '<c:barDir val="col"/><c:grouping val="clustered"/>')
    .replace('<c:plotVisOnly val="1" />', '<c:plotVisOnly val="1"/><c:dispBlanksAs val="gap"/>');
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

export function chartExcelBytes(points: SupplierVariationPoint[], info: ChartImageInfo) {
  return zipParts(chartExcelParts(points, info));
}

export function downloadChartExcel(points: SupplierVariationPoint[], info: ChartImageInfo) {
  const blob = new Blob([chartExcelBytes(points, info)], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob), link = document.createElement("a");
  link.href = url; link.download = "point-marche-variations.xlsx"; document.body.appendChild(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
