import type { SupplierVariationPoint } from "./supplier-variations";

export function supplierMiniTrend(points: SupplierVariationPoint[]) {
  const width = 120;
  const height = 36;
  const inset = 3;
  const last = points.at(-1);
  const series = typeof last?.globalVariation === "number" && Number.isFinite(last.globalVariation) ? "globalVariation" : "weightedVariation";
  const label = series === "globalVariation" ? "GLOBAL" : "Pondérée";
  const values = points.map((point) => point[series]).filter((value): value is number => value !== null && Number.isFinite(value));
  const minimum = values.reduce((min, value) => Math.min(min, value), values[0] ?? 0);
  const maximum = values.reduce((max, value) => Math.max(max, value), values[0] ?? 0);
  const span = Math.max(1, maximum - minimum);
  const center = (maximum + minimum) / 2;
  const segments: { x: number; y: number }[][] = [];
  let current: { x: number; y: number }[] = [];
  points.forEach((point, index) => {
    const value = point[series];
    if (value === null || !Number.isFinite(value)) {
      if (current.length) segments.push(current);
      current = [];
      return;
    }
    current.push({
      x: points.length <= 1 ? width / 2 : inset + index / (points.length - 1) * (width - 2 * inset),
      y: height / 2 - (value - center) / span * (height - 2 * inset),
    });
  });
  if (current.length) segments.push(current);
  const value = last?.[series] != null && Number.isFinite(last[series]) ? last[series] : null;
  const previous = points.at(-2);
  const previousValue = previous?.[series] != null && Number.isFinite(previous[series]) ? previous[series] : null;
  return {
    width, height, series, label, value,
    period: last?.period ?? "",
    previousPeriod: previous?.period ?? "",
    delta: value !== null && previousValue !== null ? value - previousValue : null,
    paths: segments.filter((segment) => segment.length > 1).map((segment) => segment.map((point, index) => `${index ? "L" : "M"}${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(" ")),
    dots: segments.filter((segment) => segment.length === 1).map((segment) => segment[0]),
  };
}
