import { APP_VERSION } from "./app-version";

export function validFeedbackEmail(value: string) {
  return value.length <= 254 && /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9.-]*[A-Za-z0-9])?\.[A-Za-z]{2,}$/.test(value);
}

export function feedbackMail(email: string, kind: "bug" | "idea", title: string, detail: string, context: string) {
  if (!validFeedbackEmail(email)) throw new Error("Renseigne une adresse mail valide dans les paramètres.");
  const subject = `[Point marché · ${kind === "bug" ? "Bug" : "Idée"}] ${title.replace(/[\r\n]/g, " ").trim().slice(0, 100)}`;
  const body = `${detail.trim()}\r\n\r\n---\r\nApplication : Point marché ${APP_VERSION}\r\n${context}`;
  return { subject, body, url: `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}` };
}
