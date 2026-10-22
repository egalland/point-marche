"use client";
import { useEffect, useState } from "react";
import { appFetch } from "@/lib/app-transport";
import { feedbackMail, validFeedbackEmail } from "@/lib/feedback";
import { AppDialog } from "@/components/app-dialog";

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
    if (next && !validFeedbackEmail(next)) { setMessage("Saisis une adresse mail valide."); return; }
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
    <p>Adresse commune aux deux boutons du menu. Enregistrée automatiquement en quittant le champ, pour toute l’application et tous les marchés.</p>
    <label className="field"><span>Adresse mail destinataire</span><input type="email" maxLength={254} placeholder="contact@entreprise.fr" value={contact.draft} disabled={!contact.ready || contact.saving} onChange={event => contact.setDraft(event.target.value)} onBlur={() => void contact.save()} aria-describedby="feedback-save-status" /></label>
    <p id="feedback-save-status" role="status">{contact.saving ? "Enregistrement…" : contact.message || (contact.ready ? "Le mail s’ouvre dans la messagerie de l’utilisateur, qui confirme l’envoi." : "Chargement…")}</p>
    {!contact.ready && contact.message && <button type="button" className="secondary-button" onClick={() => void contact.load()}>Réessayer</button>}
  </section>;
}
export function FeedbackDialog({ kind, email, ready, context, onClose, onSettings }: { kind: "bug" | "idea" | null; email: string; ready: boolean; context: string; onClose: () => void; onSettings: () => void }) {
  const [title, setTitle] = useState("");
  const [detail, setDetail] = useState("");
  const [message, setMessage] = useState("");
  // Keep the draft when the mail application opens or the dialog is closed.
  return <AppDialog open={!!kind} onClose={onClose} labelledBy="feedback-title" className="feedback-dialog">
    <h2 id="feedback-title">{kind === "bug" ? "Signaler un bug" : "Soumettre une idée"}</h2>
    {!ready || !validFeedbackEmail(email) ? <><p>{ready ? "Renseigne d’abord l’adresse destinataire dans les paramètres." : "Le contact n’est pas encore disponible. Vérifie les paramètres."}</p><button type="button" className="primary-button" onClick={onSettings}>Ouvrir les paramètres</button></> : <form onSubmit={event => { event.preventDefault(); const mail = feedbackMail(email, kind ?? "bug", title, detail, context); window.location.href = mail.url; setMessage("Mail préparé. Confirme l’envoi dans ta messagerie. Si elle ne s’ouvre pas, utilise « Copier le message »."); }}>
      <p>À : <strong>{email}</strong> · L’envoi se confirme dans ta messagerie.</p>
      <label className="field"><span>Objet</span><input required maxLength={100} value={title} onChange={event => setTitle(event.target.value)} /></label>
      <label className="field"><span>{kind === "bug" ? "Étapes, résultat obtenu et résultat attendu" : "Ton idée et son intérêt"}</span><textarea required maxLength={1200} rows={7} value={detail} onChange={event => setDetail(event.target.value)} /></label>
      <small>La version, le marché et la rubrique sont ajoutés au message. Tu peux joindre une capture depuis ta messagerie.</small>
      <div className="feedback-actions"><button type="button" className="secondary-button" onClick={async () => { try { const mail = feedbackMail(email, kind ?? "bug", title, detail, context); await navigator.clipboard.writeText(`À : ${email}\nObjet : ${mail.subject}\n\n${mail.body}`); setMessage("Message copié. Colle-le dans ta messagerie."); } catch { setMessage("Copie indisponible. Sélectionne le texte du formulaire pour le copier."); } }}>Copier le message</button><button type="submit" className="primary-button">Ouvrir le mail</button></div>
      <p role="status">{message}</p>
    </form>}
  </AppDialog>;
}
