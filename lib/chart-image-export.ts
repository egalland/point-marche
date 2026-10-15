export type ChartImageInfo = { title: string; subtitle: string; global: boolean; weighted: boolean };

function escapeXml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[char]!);
}

/** Fixed export palette keeps charts readable when pasted into a mail or workbook. */
export function chartImageSvg(markup: string, width: number, height: number, info: ChartImageInfo) {
  const wrap = (value: string, maxLength: number) => {
    const lines: string[] = []; let line = "";
    for (const word of value.split(/\s+/)) {
      if (line && `${line} ${word}`.length > maxLength) { lines.push(line); line = word; }
      else line += `${line ? " " : ""}${word}`;
    }
    if (line) lines.push(line);
    return lines;
  };
  const titleLines = wrap(info.title, Math.max(20, Math.floor((width - 48) / 12)));
  const subtitleLines = wrap(info.subtitle, Math.max(20, Math.floor((width - 48) / 8)));
  const legendY = 30 + titleLines.length * 25 + subtitleLines.length * 20 + 12;
  const chartTop = legendY + 24;
  const totalHeight = chartTop + height + 20;
  const title = titleLines.map((line, index) => `<text x="24" y="${30 + index * 25}" font-size="20" font-weight="700">${escapeXml(line)}</text>`).join("");
  const subtitle = subtitleLines.map((line, index) => `<text x="24" y="${34 + titleLines.length * 25 + index * 20}" font-size="13">${escapeXml(line)}</text>`).join("");
  const legend = [info.global ? { label: "Variation GLOBAL", color: "#087fa0" } : null, info.weighted ? { label: "Variation pondérée", color: "#b35c0c" } : null].filter((item) => item !== null).map((item, index) => `<rect x="${24 + index * 200}" y="${legendY - 10}" width="14" height="10" rx="2" fill="${item.color}"/><text x="${45 + index * 200}" y="${legendY}" font-size="13">${item.label}</text>`).join("");
  return { width, height: totalHeight, svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${totalHeight}" viewBox="0 0 ${width} ${totalHeight}"><style>text{font-family:Arial,sans-serif;fill:#1e293b}.supplier-chart-grid{stroke:#dbe2ea;stroke-width:1}.supplier-chart-zero{stroke:#475569;stroke-width:1.7}.supplier-chart-bar.global{fill:#087fa0}.supplier-chart-bar.weighted{fill:#b35c0c}.supplier-column-value{font-size:12px;font-weight:700}.supplier-column-highlight{display:none}</style><rect width="100%" height="100%" fill="#ffffff"/>${title}${subtitle}${legend}<g transform="translate(0 ${chartTop})">${markup}</g></svg>` };
}

export async function chartPngBlob(element: SVGSVGElement, info: ChartImageInfo): Promise<Blob> {
  const viewBox = element.viewBox.baseVal;
  if (!viewBox.width || !viewBox.height) throw new Error("Le graphique n’est pas prêt.");
  const clone = element.cloneNode(true) as SVGSVGElement;
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.setAttribute("width", String(viewBox.width)); clone.setAttribute("height", String(viewBox.height));
  clone.removeAttribute("tabindex"); clone.removeAttribute("aria-describedby");
  const image = chartImageSvg(new XMLSerializer().serializeToString(clone), viewBox.width, viewBox.height, info);
  const url = URL.createObjectURL(new Blob([image.svg], { type: "image/svg+xml;charset=utf-8" }));
  try {
    const bitmap = new Image();
    await new Promise<void>((resolve, reject) => { bitmap.onload = () => resolve(); bitmap.onerror = () => reject(new Error("Impossible de convertir le graphique en image.")); bitmap.src = url; });
    const scale = Math.min(2, 8192 / Math.max(image.width, image.height), Math.sqrt(16_000_000 / (image.width * image.height)));
    const canvas = document.createElement("canvas"); canvas.width = Math.round(image.width * scale); canvas.height = Math.round(image.height * scale);
    const context = canvas.getContext("2d");
    if (!context) throw new Error("La création d’image est indisponible dans ce navigateur.");
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("La génération du PNG a échoué.")), "image/png"));
  } finally { URL.revokeObjectURL(url); }
}

export function downloadChartPng(blob: Blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a"); link.href = url; link.download = "point-marche-variations.png";
  document.body.appendChild(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
