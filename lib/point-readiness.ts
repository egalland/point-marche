import { isIsoDate, isoWeekRange, isoWeekParts } from "./iso-week";
import { inspectMailRecipients } from "./mail-recipients";
import { isClosedJiraStatus } from "./jira-import";
import { jiraItemCount, isClosed, jiraAttention, type PointData, type Market } from "../features/market-pulse/point-model";

export type PreparationTarget = "point" | "imports" | "mail" | "save";
export type PreparationCheck = { id: string; label: string; detail: string; state: "ok" | "review" | "blocked"; target: PreparationTarget };
export type PreparationSave = "saved" | "pending" | "error" | "new";

/** Relative to the selected meeting week, so archived points do not become stale with time. */
export function sourceReadiness(value: string | undefined, mode: string, date: string) {
  if (mode === "manual") return { state: "ok" as const, detail: "Saisie manuelle sélectionnée : relis les éléments du point." };
  const day = value?.slice(0, 10) ?? "";
  if (!isIsoDate(day)) return { state: "review" as const, detail: "Date de source inconnue. Actualise les imports ou choisis la saisie manuelle." };
  if (!isIsoDate(date)) return { state: "blocked" as const, detail: "Choisis une date de point valide." };
  const { year, week } = isoWeekParts(date), range = isoWeekRange(year, week);
  if (day < range.from) return { state: "review" as const, detail: `Import du ${day.split("-").reverse().join("/")}, antérieur à la semaine du point.` };
  if (day > range.to) return { state: "review" as const, detail: "La source est postérieure à la semaine du point : vérifie le périmètre historique." };
  return { state: "ok" as const, detail: `Import de la semaine du point · ${day.split("-").reverse().join("/")}.` };
}

export function pointReadiness(data: PointData, market: Market, save: PreparationSave = "new") {
  const visible = data.preferences.readModules;
  const dossiers = data.dossiers.filter(item => !isClosed(item.status));
  const incomplete = dossiers.filter(item => !item.title.trim() || !item.owner.trim() || !item.action.trim());
  const tickets = data.jira.filter(item => !isClosedJiraStatus(item.status));
  const jiraKnown = data.jiraMode === "manual" || isIsoDate(data.sourceFreshness?.jira?.slice(0, 10) ?? "") || data.jira.length > 0;
  const plannerKnown = data.plannerMode === "manual" || isIsoDate(data.sourceFreshness?.planner?.slice(0, 10) ?? "") || data.operations.length > 0;
  const to = inspectMailRecipients(data.mail.to), cc = inspectMailRecipients(data.mail.cc);
  const checks: PreparationCheck[] = [
    { id: "date", label: "Semaine du point", state: isIsoDate(data.meetingDate) ? "ok" : "blocked", detail: isIsoDate(data.meetingDate) ? "La date du point est valide. Vérifie que c’est la semaine attendue." : "Une date valide est nécessaire.", target: "point" },
    { id: "priority", label: "Priorité de la semaine", state: data.priority.trim() && data.priority.trim() !== "Sécuriser les dossiers à surveiller et confirmer les prochaines échéances." ? "ok" : "review", detail: data.priority.trim() ? "Relis la priorité : elle doit exprimer la décision ou l’action attendue cette semaine." : "Ajoute la priorité à retenir dès la première lecture.", target: "point" },
  ];
  if (visible.jira) checks.push({ id: "jira", label: "Source Jira", ...sourceReadiness(data.sourceFreshness?.jira, data.jiraMode, data.meetingDate), target: "imports" });
  if (visible.operations || visible.simulationComparison) checks.push({ id: "planner", label: "Source Planner", ...sourceReadiness(data.sourceFreshness?.planner, data.plannerMode, data.meetingDate), target: "imports" });
  if (visible.dossiers) checks.push({ id: "dossiers", label: "Prochaines actions", state: incomplete.length ? "review" : "ok", detail: incomplete.length ? `${incomplete.length} dossier(s) actif(s) sans titre, responsable ou prochaine action.` : `${dossiers.length} dossier(s) actif(s) : titre, responsable et prochaine action renseignés.`, target: "point" });
  if (visible.purchaseData) {
    const configured = data.purchaseDataConfigs?.length && data.purchaseDataConfigs.every(config => !!config.report || Array.isArray(config.snapshot));
    checks.push({ id: "purchaseData", label: "Suivi PURCHASES", state: configured ? "ok" : "review", detail: configured ? "Un instantané PURCHASES est disponible. Vérifie la période et les spécialités du bloc." : "Aucun instantané PURCHASES disponible pour ce bloc.", target: "point" });
  }
  if (visible.dossiers && data.dossiers.some(item => item.attachments?.length || /<img\b/i.test(item.richHtml ?? ""))) checks.push({ id: "assets", label: "Images et pièces jointes", state: "review", detail: "Vérifie l’ouverture des images et fichiers chez les destinataires. Les fichiers liés au site ne sont pas intégrés à la pièce jointe HTML.", target: "point" });
  checks.push({ id: "mail", label: "Destinataires du mail", state: to.invalid.length || cc.invalid.length ? "blocked" : to.valid.length ? "ok" : "review", detail: to.invalid.length || cc.invalid.length ? `${to.invalid.length + cc.invalid.length} adresse(s) invalide(s). Corrige-les avant de préparer le fichier Outlook.` : to.valid.length ? `${to.valid.length} destinataire(s) et ${cc.valid.length} en copie. Vérifie le périmètre de diffusion.` : "Aucun destinataire principal. Tu peux encore le renseigner dans Outlook.", target: "mail" });
  checks.push({ id: "save", label: "Sauvegarde du point", state: save === "saved" ? "ok" : save === "error" ? "blocked" : "review", detail: save === "saved" ? "Le point est enregistré. En version locale, vérifie aussi l’état du fichier dans le bandeau." : save === "error" ? "La sauvegarde a échoué : réessaie avant de quitter." : save === "pending" ? "Des modifications sont encore à enregistrer." : "Ce point n’a pas encore été enregistré.", target: "save" });
  const metrics = [
    ...(visible.dossiers ? [{ label: "Dossiers actifs", value: dossiers.length as number | null, detail: `${incomplete.length} à compléter` }] : []),
    ...(visible.operations ? [{ label: "Simulations à suivre", value: plannerKnown ? data.operations.filter(item => item.state !== "Faite").length : null, detail: plannerKnown ? `${data.operations.filter(item => item.state === "Faite").length} finalisée(s)` : "Source à vérifier" }] : []),
    ...(visible.jira ? [{ label: "Tickets ouverts", value: jiraKnown ? tickets.reduce((sum, item) => sum + jiraItemCount(item), 0) : null, detail: jiraKnown ? `${tickets.filter(item => jiraAttention(item, data.meetingDate, market, data.jiraAlertRules).level === "critical").reduce((sum, item) => sum + jiraItemCount(item), 0)} critique(s)` : "Source à vérifier" }] : []),
    ...(visible.promotions ? [{ label: "Promotions", value: data.promotions.length as number | null, detail: "Dans le point affiché" }] : []),
  ];
  return { checks, metrics, review: checks.filter(c => c.state !== "ok").length, blocked: checks.some(c => c.state === "blocked") };
}
