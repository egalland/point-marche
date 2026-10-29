"use client";
import { useAccess } from "./access-panel";
import { useEffect, useRef, useState } from "react";
import { appFetch } from "@/lib/app-transport";
import { feedbackMail, validFeedbackRecipients, feedbackStatuses, type FeedbackRequest, type FeedbackSummary, type FeedbackCapture } from "@/lib/feedback";
import { feedbackExportBytes } from "@/lib/feedback-export";
import { AppIcon } from "@/components/app-icon";
import { AppDialog } from "@/components/app-dialog";

export function FeedbackLauncher({ onOpen }: { onOpen: () => void }) {
  return <button type="button" className="feedback-launcher" aria-label="Signaler un bug ou proposer une idée" title="Signaler un bug ou proposer une idée" aria-haspopup="dialog" onClick={onOpen}><AppIcon name="bug" size={22}/><span aria-hidden="true">/</span><AppIcon name="idea" size={22}/></button>;
}
const statusTones: Record<string, string> = { Nouveau: "new", "En cours": "progress", "En attente": "waiting", Résolu: "resolved", Refusé: "declined" };
export function FeedbackStatusBadge({ status }: { status: string }) {
  return <span className={`feedback-status-badge status-${statusTones[status] ?? "new"}`} aria-label={`Statut : ${status}`}><i aria-hidden="true"/>{status}</span>;
}

export function useFeedbackContact() {
  const [email, setEmail] = useState("");
  const [draft, setDraft] = useState("");
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  async function load() {
    setReady(false);
    try {
      const response = await appFetch("/api/feedback-settings", { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setEmail(result.email); setDraft(result.email); setReady(true); setMessage("");
    } catch { setMessage("Impossible de charger le contact. Réessaie."); }
  }
  useEffect(() => { void load(); }, []);
  async function save() {
    const next = draft.trim();
    if (saving || !ready || next === email) return;
    if (next && !validFeedbackRecipients(next)) { setMessage("Saisis des adresses valides, séparées par des points-virgules (10 maximum)."); return; }
    setSaving(true); setMessage("");
    try {
      const response = await appFetch("/api/feedback-settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: next }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setEmail(result.email); setDraft(result.email); setMessage("Adresse enregistrée.");
    } catch { setMessage("Adresse non enregistrée. Quitte à nouveau le champ pour réessayer."); }
    finally { setSaving(false); }
  }
  return { email, draft, setDraft, ready, saving, message, save, load };
}
export function FeedbackSettings({ contact }: { contact: ReturnType<typeof useFeedbackContact> }) {
  return <section className="surface feedback-settings" aria-labelledby="feedback-settings-title">
    <h2 id="feedback-settings-title">Bugs et idées</h2>
    <p>Destinataires de notification communs aux bugs et aux idées. Sépare les adresses par des points-virgules (10 maximum). Enregistrée automatiquement en quittant le champ, pour toute l’application et tous les marchés.</p>
    <label className="field"><span>Adresses mail de notification</span><input type="text" inputMode="email" maxLength={2540} placeholder="contact@entreprise.fr; suivi@entreprise.fr" value={contact.draft} disabled={!contact.ready || contact.saving} onChange={event => contact.setDraft(event.target.value)} onBlur={() => void contact.save()} aria-describedby="feedback-save-status" /></label>
    <p id="feedback-save-status" role="status">{contact.saving ? "Enregistrement…" : contact.message || (contact.ready ? "La case « Signaler par mail » prépare un mail dans la messagerie par défaut (Outlook si configuré)." : "Chargement…")}</p>
    {!contact.ready && contact.message && <button type="button" className="secondary-button" onClick={() => void contact.load()}>Réessayer</button>}
  </section>;
}
export function FeedbackDialog({ open, email, ready, context, onClose, onSettings }: { open: boolean; email: string; ready: boolean; context: string; onClose: () => void; onSettings: () => void }) {
  const {person}=useAccess();
  const [kind, setKind] = useState<"bug" | "idea">("bug");
  const [title, setTitle] = useState("");
  const [detail, setDetail] = useState("");
  const [usercode, setUserCode] = useState(person.usercode);
  const [notify, setNotify] = useState(false);
  const [captures, setCaptures] = useState<FeedbackCapture[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [reading, setReading] = useState(false);
  const [saved, setSaved] = useState<FeedbackSummary | null>(null);
  const id = useRef("");
  useEffect(() => { setUserCode(person.usercode); }, [person.usercode,open]);
  useEffect(() => { if (open && saved) { setSaved(null); setTitle(""); setDetail(""); setCaptures([]); setMessage(""); id.current = ""; } }, [open]);
  async function addCaptures(files: File[]) {
    if (!files.length) return;
    setReading(true); setMessage("");
    try {
      if (captures.length + files.length > 3) throw new Error("3 captures maximum.");
      const additions: FeedbackCapture[] = [];
      for (const file of files) {
        if (!["image/png", "image/jpeg", "image/webp"].includes(file.type) || file.size > 2 * 1024 * 1024) throw new Error("Choisis des images PNG, JPEG ou WebP de 2 Mo maximum.");
        const dataUrl = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(new Error("Lecture de la capture impossible.")); reader.readAsDataURL(file); });
        additions.push({ name: (file.name || "capture.png").slice(0, 150), dataUrl });
      }
      setCaptures(current => [...current, ...additions]);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Capture indisponible."); }
    finally { setReading(false); }
  }
  function mailFor(item: FeedbackSummary) {
    return feedbackMail(email, item.kind, item.title, detail, `Demande : ${item.id}\r\nUSERCODE : ${item.reporterUserCode}\r\nStatut : ${item.status}\r\n${item.context}\r\nCaptures : ${item.captureCount}, consultables dans la boîte Bugs & idées.`);
  }
  function openMail(item: FeedbackSummary) {
    window.location.href = mailFor(item).url;
    setMessage("Demande enregistrée. Mail préparé : confirme l’envoi dans Outlook. Les captures restent dans la boîte ; joins-les manuellement au mail si nécessaire.");
  }
  async function submit() {
    if (busy || reading) return;
    if (!title.trim() || !detail.trim()) { setMessage("Complète l’objet et la description."); return; }
    if (notify && (!ready || !validFeedbackRecipients(email))) { setMessage("Configure les adresses de notification ou décoche « Signaler par mail »."); return; }
    setBusy(true); setMessage("");
    try {
      id.current ||= crypto.randomUUID();
      const response = await appFetch("/api/feedback", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: id.current, kind, title, detail, context, captures, reporterUserCode: usercode }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setSaved(result.item);
      try { localStorage.setItem("market-pulse:feedback-usercode", usercode.trim().toUpperCase()); } catch {}
      window.dispatchEvent(new Event("feedback-updated"));
      if (notify) openMail(result.item);
      else setMessage("Demande enregistrée dans la boîte Bugs & idées. Aucun mail ouvert.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Demande non enregistrée. Réessaie."); }
    finally { setBusy(false); }
  }
  return <AppDialog open={open} onClose={onClose} busy={busy || reading} labelledBy="feedback-title" className="feedback-dialog">
    <header className="feedback-dialog-heading"><h2 id="feedback-title">Bug ou idée</h2><p>Signale un problème ou propose une amélioration.</p></header>
    {saved ? <div><p>Demande enregistrée · {saved.id.slice(0, 8)}</p><FeedbackStatusBadge status={saved.status}/><p role="status">{message}</p><div className="feedback-actions">{validFeedbackRecipients(email) && <><button className="secondary-button" type="button" onClick={() => openMail(saved)}>Ouvrir le mail</button><button className="secondary-button" type="button" onClick={async () => { try { const mail = mailFor(saved); await navigator.clipboard.writeText(`À : ${email}\nObjet : ${mail.subject}\n\n${mail.body}`); setMessage("Mail copié. Colle-le dans Outlook."); } catch { setMessage("Copie indisponible dans ce navigateur. Utilise les informations du ticket."); } }}>Copier le mail</button></>}<button className="primary-button" type="button" onClick={() => { setSaved(null); setTitle(""); setDetail(""); setCaptures([]); setMessage(""); id.current = ""; }}>Nouvelle demande</button></div></div> : <form onSubmit={event => { event.preventDefault(); void submit(); }} onPaste={event => { const files = Array.from(event.clipboardData.files); if (files.length && !busy && !reading) { event.preventDefault(); void addCaptures(files); } }}>
      <fieldset disabled={busy || reading} className="feedback-fields">
        <fieldset className="feedback-kind-picker"><legend>Type de demande</legend><div>{(["bug", "idea"] as const).map(value => <label key={value} className={kind === value ? "selected" : ""}><input type="radio" name="feedback-request-kind" value={value} checked={kind === value} onChange={() => setKind(value)}/><AppIcon name={value === "bug" ? "bug" : "idea"}/><span>{value === "bug" ? "Signaler un bug" : "Proposer une idée"}</span></label>)}</div></fieldset>
        <label className="field"><span>Ton USERCODE</span><input required pattern="[A-Za-z][0-9]{7}" maxLength={8} placeholder="A1234567" value={usercode} readOnly/></label>
        <small>USERCODE du profil connecté, renseigné automatiquement.</small>
        <label className="field"><span>Objet</span><input required maxLength={100} value={title} onChange={event => setTitle(event.target.value)}/></label>
        <label className="field"><span>{kind === "bug" ? "Étapes, résultat obtenu et résultat attendu" : "Ton idée et son intérêt"}</span><textarea required maxLength={1200} rows={6} value={detail} onChange={event => setDetail(event.target.value)}/></label>
        <label className="field"><span>Captures d’écran · 3 maximum, 2 Mo chacune</span><input type="file" accept="image/png,image/jpeg,image/webp" multiple onChange={event => { void addCaptures(Array.from(event.target.files ?? [])); event.target.value = ""; }}/></label>
        <small>Tu peux aussi coller une capture dans le formulaire (Ctrl+V).</small>
        <div className="feedback-captures">{captures.map((capture, index) => <figure key={index}><img src={capture.dataUrl} alt={capture.name}/><figcaption>{capture.name}</figcaption><button type="button" className="secondary-button" onClick={() => setCaptures(current => current.filter((_, i) => i !== index))}>Retirer</button></figure>)}</div>
        <label className="feedback-notify"><input type="checkbox" checked={notify} onChange={event => setNotify(event.target.checked)}/><span>Signaler par mail</span></label>
        {notify && (ready && validFeedbackRecipients(email) ? <p>À : {email}. Le mail s’ouvrira après l’enregistrement. Confirme ensuite l’envoi dans Outlook.</p> : <div><p>Les destinataires doivent être configurés.</p><button type="button" className="secondary-button" onClick={onSettings}>Ouvrir les paramètres</button></div>)}
        <small>La version de l’application et la rubrique sont ajoutées à la demande.</small>
      </fieldset>
      <button type="submit" className="primary-button" disabled={busy || reading}>{busy ? "Enregistrement…" : reading ? "Lecture des captures…" : notify ? "Enregistrer et ouvrir le mail" : "Enregistrer la demande"}</button>
      <p role="status">{message}</p>
    </form>}
  </AppDialog>;
}

const dateLabel = (value: string) => value ? new Date(value).toLocaleString("fr-FR") : "—";
export function FeedbackInbox({ onCreate }: { onCreate?: () => void } = {}) {
  const { can,person } = useAccess();
  const [items, setItems] = useState<FeedbackSummary[]>([]);
  const [selected, setSelected] = useState<FeedbackRequest | null>(null);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [kind, setKind] = useState<"bug" | "idea">("bug");
  const [by, setBy] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const selection = useRef(0);
  async function load() {
    setLoading(true); setMessage("");
    try { const response = await appFetch("/api/feedback", { cache: "no-store" }); const result = await response.json(); if (!response.ok) throw new Error(result.error); setItems(result.items); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Chargement impossible."); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); const refresh = () => { void load(); }; window.addEventListener("feedback-updated", refresh); setBy(person.usercode); return () => window.removeEventListener("feedback-updated", refresh); }, [person.usercode]);
  async function select(id: string) {
    const request = ++selection.current;
    setMessage(""); setSelected(null);
    try { const response = await appFetch(`/api/feedback?id=${encodeURIComponent(id)}`, { cache: "no-store" }); const result = await response.json(); if (!response.ok) throw new Error(result.error); if (request === selection.current) setSelected(result.item); }
    catch (error) { if (request === selection.current) setMessage(error instanceof Error ? error.message : "Chargement impossible."); }
  }
  async function updateStatus(next: string) {
    if (!selected || saving) return;
    setSaving(true); setMessage("");
    try {
      const response = await appFetch("/api/feedback", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: selected.id, status: next, by, expectedUpdatedAt: selected.updatedAt }) });
      const result = await response.json(); if (!response.ok) throw new Error(result.error);
      setSelected(result.item); await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Modification impossible."); }
    finally { setSaving(false); }
  }
  async function exportTickets(id?: string) {
    if (exporting) return;
    setExporting(true); setMessage("Préparation des textes et captures…");
    try {
      let ids = id ? [id] : [];
      if (!id) {
        const response = await appFetch("/api/feedback", {cache:"no-store"});
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Liste des demandes indisponible.");
        ids = (result.items as FeedbackSummary[]).map(item=>item.id);
      }
      if (!ids.length) throw new Error("Aucune demande à exporter.");
      const tickets: FeedbackRequest[] = [];
      for (const ticketId of ids) {
        const response = await appFetch(`/api/feedback?id=${encodeURIComponent(ticketId)}`, {cache:"no-store"});
        const result = await response.json();
        if (!response.ok || !result.item) throw new Error(result.error || "Un ticket est indisponible. Réessaie l’export.");
        tickets.push(result.item);
      }
      const bytes = feedbackExportBytes(tickets);
      const url = URL.createObjectURL(new Blob([bytes], {type:"application/zip"}));
      const link = document.createElement("a"); link.href=url; link.download=`Market_Plus_${id?"ticket-"+id.slice(0,8):"bugs-idees"}_${new Date().toISOString().slice(0,10)}.zip`;
      document.body.append(link); link.click(); link.remove(); window.setTimeout(()=>URL.revokeObjectURL(url),60000);
      setMessage(`${tickets.length} demande(s) exportée(s), avec textes, historique et captures. Joins le ZIP à ta conversation.`);
    } catch(error) {setMessage(error instanceof Error?error.message:"Export impossible. Les demandes sont conservées.");}
    finally {setExporting(false);}
  }
  const filtered = items.filter(item => (!status || item.status === status) && (!kind || item.kind === kind) && `${item.title} ${item.reporterUserCode} ${item.context} ${item.id}`.toLocaleLowerCase("fr").includes(query.toLocaleLowerCase("fr")));
  return <section className="surface feedback-inbox" aria-labelledby="feedback-inbox-title">
    <header><div><h2 id="feedback-inbox-title">Bugs et idées</h2><p>{items.filter(item => !["Résolu", "Refusé"].includes(item.status)).length} demande(s) à suivre</p></div><div className="feedback-actions"><button type="button" className="secondary-button" onClick={()=>void exportTickets()} disabled={loading || exporting}><AppIcon name="download"/>{exporting?"Export en cours…":"Exporter bugs et idées (.zip)"}</button>{onCreate && <button type="button" className="primary-button" onClick={onCreate}>Nouvelle demande</button>}<button type="button" className="secondary-button" onClick={() => void load()} disabled={loading}>Actualiser</button></div></header>
    <div className="feedback-kind-tabs" role="group" aria-label="Type de demandes">{(["bug", "idea"] as const).map(value => <button type="button" key={value} aria-pressed={kind === value} onClick={() => setKind(value)}><AppIcon name={value === "bug" ? "bug" : "idea"}/>{value === "bug" ? "Bugs" : "Idées"}<span>{items.filter(item => item.kind === value).length}</span></button>)}</div>
    <div className="feedback-filters"><label className="field"><span>Rechercher une demande / USERCODE</span><input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Objet, demandeur, référence…"/></label><label className="field"><span>Filtrer par statut</span><select value={status} onChange={event => setStatus(event.target.value)}><option value="">Tous les statuts</option>{feedbackStatuses.map(value => <option key={value}>{value}</option>)}</select></label></div>
    <p className="feedback-result-count">{filtered.length} {kind === "bug" ? "bug(s)" : "idée(s)"} affiché(s)</p>
    <p role="status">{loading ? "Chargement des demandes…" : message}</p>
    {!loading && !filtered.length && <p>{items.length ? "Aucune demande ne correspond aux filtres." : "Aucune demande enregistrée."}</p>}
    <div className="feedback-ticket-head" aria-hidden="true"><span>Demande</span><span>Demandeur</span><span>État</span><span>Dernière modification</span><span/></div>
    <div className="feedback-ticket-list">{filtered.map(item => <button type="button" className="feedback-ticket-row" key={item.id} onClick={() => void select(item.id)}><span className="feedback-ticket-subject"><strong>{item.title}</strong><small>#{item.id.slice(0, 8)} · {item.captureCount} capture(s)</small></span><span className="feedback-ticket-reporter">{item.reporterUserCode}</span><FeedbackStatusBadge status={item.status}/><time dateTime={item.updatedAt}>{dateLabel(item.updatedAt)}</time><AppIcon name="chevron" size={17}/></button>)}</div>
    <AppDialog open={!!selected} busy={saving} onClose={() => { ++selection.current; setSelected(null); }} labelledBy="feedback-ticket-title" className="feedback-dialog">
      {selected && <><header className="feedback-dialog-heading"><h2 id="feedback-ticket-title">{selected.title}</h2><FeedbackStatusBadge status={selected.status}/></header><p>{selected.id} · {selected.kind === "bug" ? "Bug" : "Idée"}</p><p>Demandeur : <strong>{selected.reporterUserCode}</strong><br/>Créé le {dateLabel(selected.createdAt)}<br/>Modifié le {dateLabel(selected.updatedAt)}</p><p className="feedback-text">{selected.detail}</p><p className="feedback-text">{selected.context}</p>
        <div className="feedback-captures">{selected.captures.map((capture, index) => <figure key={index}><a href={capture.dataUrl} download={capture.name}><img src={capture.dataUrl} alt={capture.name}/><figcaption>Télécharger {capture.name}</figcaption></a></figure>)}</div>
        <label className="field"><span>USERCODE de la personne qui suit la demande</span><input maxLength={8} pattern="[A-Za-z][0-9]{7}" value={by} disabled={saving || !can("feedback.manage")} onChange={event => setBy(event.target.value.toUpperCase())}/></label>
        <label className="field"><span>Statut du ticket</span><select value={selected.status} disabled={saving || !can("feedback.manage")} onChange={event => void updateStatus(event.target.value)}>{feedbackStatuses.map(value => <option key={value}>{value}</option>)}</select></label>
        <p role="status">{saving ? "Enregistrement du statut…" : message}</p><button type="button" className="secondary-button" onClick={() => void select(selected.id)} disabled={saving || !can("feedback.manage")}>Recharger le ticket</button>
        <button type="button" className="primary-button" onClick={()=>void exportTickets(selected.id)} disabled={saving || exporting}><AppIcon name="download"/>{exporting?"Export en cours…":"Exporter ce ticket pour ChatGPT"}</button><h3>Historique</h3><ul>{selected.history?.map((event, index) => <li key={index}>{dateLabel(event.date)} · {event.status} · {event.by}</li>)}</ul>
      </>}
    </AppDialog>
  </section>;
}
