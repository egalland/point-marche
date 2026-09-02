import { supplierMiniTrend } from "@/lib/supplier-mini-trend";
import type { SupplierVariationPoint } from "@/lib/supplier-variations";

export function SupplierMiniChart({ points }: { points: SupplierVariationPoint[] }) {
  const trend = supplierMiniTrend(points);
  return <svg className={`supplier-mini-chart ${trend.series === "globalVariation" ? "global" : "weighted"}`} width={trend.width} height={trend.height} viewBox={`0 0 ${trend.width} ${trend.height}`} aria-hidden="true" focusable="false">
    {trend.paths.map((path, index) => <path key={index} d={path} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>)}
    {trend.dots.map((point, index) => <circle key={index} cx={point.x} cy={point.y} r="2" fill="currentColor"/>)}
  </svg>;
}
