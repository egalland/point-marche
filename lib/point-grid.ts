import type { ModuleWidth } from "@/components/module-layout-editor";

export const GRID_WIDTHS: ModuleWidth[] = ["quarter", "half", "three-quarters", "full"];
export function moduleColumns(width: ModuleWidth): number {
  return width === "quarter" ? 1 : width === "half" ? 2 : width === "two-thirds" || width === "three-quarters" ? 3 : 4;
}
export function normalizeModuleWidth(width: unknown, fallback: ModuleWidth = "full"): ModuleWidth {
  if (width === "two-thirds") return "three-quarters";
  return GRID_WIDTHS.includes(width as ModuleWidth) ? width as ModuleWidth : fallback;
}
export function gridRows<T extends string>(order: T[], widths: Record<T, ModuleWidth>): T[][] {
  const rows: T[][] = []; let used = 0;
  for (const id of order) {
    const span = moduleColumns(widths[id]);
    if (!rows.length || used + span > 4) { rows.push([]); used = 0; }
    rows[rows.length - 1].push(id); used += span;
  }
  return rows;
}
export function resizeMovesOtherBlocks<T extends string>(order: T[], widths: Record<T, ModuleWidth>, id: T, width: ModuleWidth): boolean {
  const positions = (values: Record<T, ModuleWidth>) => {
    const result = new Map<T, string>();
    gridRows(order, values).forEach((row, index) => { let column = 0; for (const item of row) { result.set(item, `${index}:${column}`); column += moduleColumns(values[item]); } });
    return result;
  };
  const before = positions(widths), after = positions({ ...widths, [id]: width });
  return order.some(item => item !== id && before.get(item) !== after.get(item));
}
