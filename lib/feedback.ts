import { APP_VERSION } from "./app-version";

export function validFeedbackEmail(value: string) {
  return value.length <= 254 && /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9.-]*[A-Za-z0-9])?\.[A-Za-z]{2,}$/.test(value);
}

export function feedbackRecipients(value: string) {
  return Array.from(new Set(value.split(/[;,]/).map(item => item.trim()).filter(Boolean)));
}
export function validFeedbackRecipients(value: string) {
  const recipients = feedbackRecipients(value);
  return recipients.length > 0 && recipients.length <= 10 && recipients.every(validFeedbackEmail);
}

export const feedbackStatuses = ["Nouveau", "En cours", "En attente", "Résolu", "Refusé"] as const;
export type FeedbackStatus = typeof feedbackStatuses[number];
export type FeedbackCapture = { name: string; dataUrl: string };
export type FeedbackRequest = { id: string; kind: "bug" | "idea"; title: string; detail: string; context: string; captures: FeedbackCapture[]; createdAt: string; updatedAt: string; reporterUserCode: string; status: FeedbackStatus; history: { date: string; status: FeedbackStatus; by: string }[] };
export type FeedbackSummary = Omit<FeedbackRequest, "captures" | "detail" | "history"> & { captureCount: number };
export function feedbackSummary(item: FeedbackRequest): FeedbackSummary {
  const { captures, detail: _detail, history: _history, ...summary } = item;
  return { ...summary, captureCount: captures.length };
}
export function parseFeedbackRequest(value: unknown): FeedbackRequest {
  const item = value as FeedbackRequest;
  if (!item || typeof item !== "object" || !/^[a-f0-9-]{36}$/i.test(item.id) || !["bug", "idea"].includes(item.kind) || typeof item.title !== "string" || !item.title.trim() || item.title.length > 100 || typeof item.detail !== "string" || !item.detail.trim() || item.detail.length > 1200 || typeof item.context !== "string" || item.context.length > 1000 || !Array.isArray(item.captures) || item.captures.length > 3) throw new Error("Demande invalide : titre, description et 3 captures maximum.");
  for (const capture of item.captures) {
    if (!capture || typeof capture.name !== "string" || capture.name.length > 150 || typeof capture.dataUrl !== "string" || capture.dataUrl.length > 2800000 || !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(capture.dataUrl)) throw new Error("Capture invalide : PNG, JPEG ou WebP, 2 Mo maximum.");
  }
  if (typeof item.reporterUserCode !== "string" || !/^[A-Z]\d{7}$/i.test(item.reporterUserCode.trim())) throw new Error("USERCODE requis : une lettre suivie de 7 chiffres.");
  const now = new Date().toISOString();
  return { reporterUserCode: item.reporterUserCode.trim().toUpperCase(), status: "Nouveau", updatedAt: now, history: [{ date: now, status: "Nouveau", by: item.reporterUserCode.trim().toUpperCase() }], id: item.id, kind: item.kind, title: item.title.trim(), detail: item.detail.trim(), context: item.context, captures: item.captures.map(capture => ({ name: capture.name, dataUrl: capture.dataUrl })), createdAt: new Date().toISOString() };
}

export function feedbackMail(email: string, kind: "bug" | "idea", title: string, detail: string, context: string) {
  if (!validFeedbackRecipients(email)) throw new Error("Renseigne une adresse mail valide dans les paramètres.");
  const subject = `[Point marché · ${kind === "bug" ? "Bug" : "Idée"}] ${title.replace(/[\r\n]/g, " ").trim().slice(0, 100)}`;
  const body = `${detail.trim()}\r\n\r\n---\r\nApplication : Point marché ${APP_VERSION}\r\n${context}`;
  return { subject, body, url: `mailto:${feedbackRecipients(email).map(encodeURIComponent).join(",")}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}` };
}

export function updateFeedbackStatus(item: FeedbackRequest, status: unknown, by: unknown, expectedUpdatedAt: unknown): FeedbackRequest {
  if (!feedbackStatuses.includes(status as FeedbackStatus) || typeof by !== "string" || !/^[A-Z]\d{7}$/i.test(by.trim())) throw new Error("Statut et USERCODE de la personne qui modifie requis.");
  if (expectedUpdatedAt !== item.updatedAt) throw new Error("Cette demande a été modifiée. Actualise avant de réessayer.");
  if (status === item.status) return item;
  const now = new Date(Math.max(Date.now(), (Date.parse(item.updatedAt) || 0) + 1)).toISOString();
  return { ...item, status: status as FeedbackStatus, updatedAt: now, history: [...(item.history ?? []), { date: now, status: status as FeedbackStatus, by: by.trim().toUpperCase() }] };
}
