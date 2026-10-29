"use client";
import { useState } from "react";
import type { PlannerTask } from "@/lib/planner-import";
import type { AnalystStatsMarket } from "@/lib/analyst-stats";
import type { PlannerRegistrySummary } from "@/lib/planner-registry";
import { defaultComparison, type ComparisonConfig } from "@/lib/simulation-comparison";
import { SimulationComparison } from "./simulation-comparison";
import { SupplierVariationDashboard } from "./supplier-variation-dashboard";

export function SupplierStatisticsPage({ tasks, markets, registry, updatedAt }: {
  tasks: PlannerTask[]; markets: AnalystStatsMarket[]; registry: PlannerRegistrySummary; updatedAt: string;
}) {
  const [comparison, setComparison] = useState<ComparisonConfig>(() => ({ ...defaultComparison(), metric: "variation" }));
  return <main className="analyst-stats-page">
    <header className="stats-hero"><div><span>Fournisseurs</span><h1>Variations fournisseurs</h1><p>Évolutions tarifaires et comparaison des périodes à partir des simulations.</p></div></header>
    <details className="surface stats-supplier-comparison"><summary>Comparer deux périodes de variations</summary><SimulationComparison tasks={tasks} markets={markets} config={comparison} editing updatedAt={updatedAt} onChange={setComparison}/></details>
    <SupplierVariationDashboard tasks={tasks} markets={markets} registry={registry}/>
  </main>;
}
