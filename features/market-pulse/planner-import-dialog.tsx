"use client";
import { useAccess } from "./access-panel";
import { LoadingStatus } from "@/components/loading-status";

import { useMemo, useState } from "react";
import { AppDialog } from "@/components/app-dialog";
import { SupplierTurnover } from "@/components/supplier-turnover";
import { parsePlannerTasks } from "@/lib/planner-import";

type Market = { id: string; name: string; plannerTags: string[] };

type Props = {
  markets: Market[];
  onImport: (rawText: string) => Promise<{ imported: number; message: string }>;
};

function normalized(value: string) {
  return value.trim().toLocaleUpperCase("fr-FR");
}

export function PlannerImportDialog({ markets, onImport }: Props) {
  const { can } = useAccess();
  const [open, setOpen] = useState(false);
  const [rawText, setRawText] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const parsed = useMemo(() => parsePlannerTasks(rawText), [rawText]);
  const mapped = useMemo(() => parsed.tasks.map((task) => ({
    task,
    markets: markets.filter((market) => market.plannerTags.some((tag) => task.labels.map(normalized).includes(normalized(tag)))),
  })), [markets, parsed.tasks]);
  const unmatched = mapped.filter((item) => !item.markets.length).length;
  const globalVariations = parsed.tasks.filter((task) => task.metrics.globalVariation !== null).length;
  const weightedVariations = parsed.tasks.filter((task) => task.metrics.weightedVariation !== null).length;
  const submit = async () => {
    if (!parsed.tasks.length || saving) return;
    setSaving(true);
    setMessage("");
    try {
      const result = await onImport(rawText);
      setMessage(result.message);
      if (result.imported) setRawText("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Import impossible.");
    } finally {
      setSaving(false);
    }
  };

  if (!can("imports.planner")) return null;
  return <>
    <button className="primary-button" type="button" onClick={() => setOpen(true)}>Importer Planner</button>
    <AppDialog open={open} onClose={() => setOpen(false)} busy={saving} labelledBy="planner-import-title" className="planner-import-dialog">
      <div className="dialog-heading"><span className="planner-import-emblem">P</span><div><span>Source des simulations</span>{saving && <LoadingStatus label="Enregistrement des simulations Planner…"/>}<h2 id="planner-import-title">Importer l’export Planner</h2><p>Colle le tableau complet. Les tâches existantes seront mises à jour grâce à leur identifiant.</p></div></div>
      <textarea data-autofocus value={rawText} onChange={(event) => { setRawText(event.target.value); setMessage(""); }} placeholder="Colle ici l’export Planner tabulé ou le tableau copié…"/>
      <div className="planner-import-summary">
        <article><span>Tâches reconnues</span><strong>{parsed.tasks.length}</strong></article>
        <article><span>Marchés reconnus</span><strong>{new Set(mapped.flatMap((item) => item.markets.map((market) => market.id))).size}</strong></article>
        <article><span>Variations GLOBAL</span><strong>{globalVariations}</strong></article>
        <article><span>Variations pondérées</span><strong>{weightedVariations}</strong></article>
        <article className={unmatched ? "warning" : ""}><span>Sans tag paramétré</span><strong>{unmatched}</strong></article>
        <article><span>Lignes ignorées</span><strong>{parsed.ignoredRows}</strong></article>
      </div>
      {parsed.tasks.length > 0 && <div className="planner-preview-list">{mapped.slice(0, 8).map(({ task, markets: taskMarkets }) => <article key={task.externalId}><div><strong>{task.taskName}</strong><small>{task.category || task.plannerStatus || "Étape non renseignée"}</small><SupplierTurnover value={task.metrics.purchases12m}/></div><span>{taskMarkets.map((market) => market.name).join(" · ") || task.labels.join(" · ") || "Aucun tag"}</span></article>)}{parsed.tasks.length > 8 && <small>+ {parsed.tasks.length - 8} autres tâches reconnues</small>}</div>}
      <div className="planner-import-footer"><span>{message || "Les anciennes simulations sans nom d’analyste restent importables."}</span><div><button className="secondary-button" type="button" disabled={saving} onClick={() => setOpen(false)}>Fermer</button><button className="primary-button" type="button" disabled={saving || !parsed.tasks.length} onClick={submit}>{saving ? "Import…" : `Enregistrer ${parsed.tasks.length || ""}`}</button></div></div>
    </AppDialog>
  </>;
}
