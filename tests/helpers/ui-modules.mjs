import { moduleUrl } from "./module-url.mjs";

export const reactImports = { react: import.meta.resolve("react"), "react-dom": import.meta.resolve("react-dom"), "react/jsx-runtime": import.meta.resolve("react/jsx-runtime") };
export const isoUrl = moduleUrl("../../lib/iso-week.ts");
export const dialogUrl = moduleUrl("../../components/app-dialog.tsx", { ...reactImports, "@/lib/dialog-controller": moduleUrl("../../lib/dialog-controller.ts") });
export const paginationUrl = moduleUrl("../../components/table-pagination.tsx", { ...reactImports, "@/lib/table-page": moduleUrl("../../lib/table-page.ts") });
export const safeDateUrl = moduleUrl("../../components/safe-date-input.tsx", { ...reactImports, "@/lib/iso-week": isoUrl });
export const miniTrendUrl = moduleUrl("../../lib/supplier-mini-trend.ts");
export const miniChartUrl = moduleUrl("../../features/market-pulse/supplier-mini-chart.tsx", { ...reactImports, "@/lib/supplier-mini-trend": miniTrendUrl });
export const supplierChartUrl = moduleUrl("../../features/market-pulse/supplier-variation-dashboard.tsx", {
  ...reactImports,
  "@/lib/supplier-turnover": moduleUrl("../../lib/supplier-turnover.ts"),
  "@/lib/supplier-variations": moduleUrl("../../lib/supplier-variations.ts"),
  "@/components/app-dialog": dialogUrl,
  "@/components/safe-date-input": safeDateUrl,
  "@/components/table-pagination": paginationUrl,
  "@/lib/supplier-mini-trend": miniTrendUrl,
  "./supplier-mini-chart": miniChartUrl,
});
