"use client";
import { useEffect, useState } from "react";
import { AppDialog } from "@/components/app-dialog";
import { hostedPointDrafts, isLocalWorkspace } from "@/lib/app-transport";
import { pointDifferences, remotePointData } from "@/lib/point-conflict";
import { pointTimeLabel, type DraftSnapshot, type PointDraft, type PointScope } from "@/lib/point-persistence";

function useDraftUpdates() {
  const [, update] = useState(0);
  useEffect(() => hostedPointDrafts.subscribe(() => update((value) => value + 1)), []);
}
export function DraftQueueStatus() {
  useDraftUpdates();
  const pending = hostedPointDrafts.pendingCount();
  if (isLocalWorkspace() || !pending) return null;
  return <span className="draft-queue-state" role="status">{pending} brouillon{pending > 1 ? "s" : ""} à synchroniser</span>;
}

export function PointSyncStatus({ scope, ownerId, date, onRestore, onReconnect, compact=false }: { compact?:boolean; scope: PointScope; ownerId: string; date: string; onRestore: (draft: PointDraft, snapshot: DraftSnapshot) => void; onReconnect?: () => void }) {
  useDraftUpdates();
  const [review, setReview] = useState<DraftSnapshot | null>(null);
  const [reviewData, setReviewData] = useState<Record<string, unknown> | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  if (isLocalWorkspace()) return null;
  const state = hostedPointDrafts.state(scope, ownerId, date);
  const compare = async () => {
    setBusy(true); setError("");
    try { const snapshot = await hostedPointDrafts.review(scope, ownerId, date); setReviewData(hostedPointDrafts.read(scope, ownerId, date)?.data ?? {}); setReview(snapshot); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Comparaison indisponible."); }
    finally { setBusy(false); }
  };
  const resolve = async (useMine: boolean) => {
    if (!review) return;
    setBusy(true); setError("");
    try {
      const restored = await hostedPointDrafts.resolve(scope, ownerId, date, review, useMine);
      onRestore(restored, review); setReview(null);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Sauvegarde impossible."); }
    finally { setBusy(false); }
  };
  const label = state.status === "saved" ? `Brouillon sauvegardé${state.updatedAt ? ` · ${pointTimeLabel(state.updatedAt)}` : ""}`
    : state.status === "conflict" ? "Deux copies à comparer" : state.status === "error" ? "Sauvegarde interrompue" : state.status === "idle" ? "Sauvegarde automatique activée" : "Sauvegarde du brouillon…";
  const differences = review && reviewData ? pointDifferences(reviewData, remotePointData(review)) : [];
  return <>
    {(!compact || (state.status!=="idle"&&state.status!=="saved"))&&<div className={`point-sync-status ${state.status}`} role={state.status === "error" || state.status === "conflict" ? "alert" : "status"}>
      <div><strong>{label}</strong>{state.message && <span>{state.message}</span>}{error && !review && <span>{error}</span>}</div>
      {state.status === "error" && <button type="button" className="secondary-button" onClick={() => { void hostedPointDrafts.retry(scope, ownerId, date); }}>Réessayer</button>}

      {state.status === "conflict" && <button type="button" className="secondary-button" disabled={busy} onClick={() => { void compare(); }}>Comparer les copies</button>}
    </div>}
    <AppDialog open={Boolean(review)} busy={busy} onClose={() => { if (!busy) setReview(null); }} className="point-conflict-dialog" labelledBy="point-conflict-title">
      <header><h2 id="point-conflict-title">Choisir la copie à conserver</h2><p>Une autre personne ou un autre onglet a sauvegardé ce point. Vérifie les différences avant de choisir le brouillon à garder.</p></header>
      {review && <p className="comparison-caption">Copie en ligne du {pointTimeLabel(review.draft?.updatedAt ?? review.point?.updatedAt ?? review.point?.createdAt ?? "")}. Le point sera mis à jour automatiquement après résolution.</p>}
      <div className="point-conflict-table"><table><thead><tr><th>Élément</th><th>Ma copie</th><th>Copie en ligne</th></tr></thead><tbody>{differences.length ? differences.map((row) => <tr key={row.key}><th scope="row">{row.label}</th><td>{row.mine}</td><td>{row.remote}</td></tr>) : <tr><td colSpan={3}>Aucune différence dans les champs affichés. Les métadonnées d’import peuvent avoir changé.</td></tr>}</tbody></table></div>
      {error && <p role="alert" className="form-error">{error}</p>}
      <footer><button type="button" className="secondary-button" disabled={busy} onClick={() => setReview(null)}>Décider plus tard</button><button type="button" className="secondary-button" disabled={busy || !review || (!review.draft && !review.point)} onClick={() => { void resolve(false); }}>Reprendre la copie en ligne</button><button type="button" className="primary-button" disabled={busy} onClick={() => { void resolve(true); }}>{busy ? "Sauvegarde…" : "Conserver ma copie"}</button></footer>
    </AppDialog>
  </>;
}
