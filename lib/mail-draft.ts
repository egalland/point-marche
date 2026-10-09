type MailAttachment = { name: string; html: string };
export type MailDraft = { to: string; cc: string; subject: string; html: string; attachment: MailAttachment };

const utf8Base64 = (value: string) => {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
};
const foldedBase64 = (value: string) => value.match(/.{1,76}/g)?.join("\r\n") ?? "";
const headerText = (value: string) => value.replace(/[\r\n\0]/g, " ").trim();
const encodedHeader = (value: string) => {
  const chunks: string[] = [];
  let current = "";
  for (const character of headerText(value)) {
    if (new TextEncoder().encode(current + character).length > 39) { chunks.push(current); current = ""; }
    current += character;
  }
  if (current) chunks.push(current);
  return chunks.map((chunk) => `=?UTF-8?B?${utf8Base64(chunk)}?=`).join("\r\n ");
};
function addresses(value: string) {
  return Array.from(new Set(value.split(/[;,\r\n]/).map((address) => address.trim()).filter((address) => /^[^\s<>:@]+@[^\s<>:@]+\.[^\s<>:@]+$/.test(address)))).join(", ");
}

export function mailPlainText(html: string) {
  return html.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, "")
    .replace(/<\/(?:td|th)>/gi, "\t").replace(/<(?:br|hr)\s*\/?\s*>|<\/(?:p|h[1-6]|div|tr|table|section|li)>/gi, "\n")
    .replace(/<[^>]*>/g, "").replace(/&(?:amp|lt|gt|quot|apos|#39|nbsp);/g, (entity) => ({ "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&apos;": "'", "&#39;": "'", "&nbsp;": " " })[entity] ?? entity)
    .replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

/** A local Outlook draft: formatted body, inline charts and the standalone page. */
export function buildMailDraft(mail: MailDraft) {
  const suffix = crypto.randomUUID();
  const mixed = `mixed-${suffix}`, related = `related-${suffix}`, alternative = `alternative-${suffix}`;
  const images: { type: string; base64: string; cid: string }[] = [];
  const html = mail.html.replace(/src=["']data:(image\/(?:png|jpeg|gif));base64,([A-Za-z0-9+/=]+)["']/g, (_, type: string, base64: string) => {
    const cid = `chart-${images.length}-${suffix}@market-pulse.local`;
    images.push({ type, base64, cid });
    return `src="cid:${cid}"`;
  });
  const filename = headerText(mail.attachment.name).replace(/[\\/"<>]/g, "_") || "point.html";
  const asciiFilename = filename.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\x20-\x7E]/g, "_");
  const lines = [
    "MIME-Version: 1.0", "X-Unsent: 1", `Date: ${new Date().toUTCString()}`,
    `To: ${addresses(mail.to)}`, ...(addresses(mail.cc) ? [`Cc: ${addresses(mail.cc)}`] : []),
    `Subject: ${encodedHeader(mail.subject || "Point marché")}`,
    `Content-Type: multipart/mixed; boundary="${mixed}"`, "",
    `--${mixed}`, `Content-Type: multipart/related; boundary="${related}"`, "",
    `--${related}`, `Content-Type: multipart/alternative; boundary="${alternative}"`, "",
    `--${alternative}`, 'Content-Type: text/plain; charset="utf-8"', "Content-Transfer-Encoding: base64", "", foldedBase64(utf8Base64(mailPlainText(mail.html))),
    `--${alternative}`, 'Content-Type: text/html; charset="utf-8"', "Content-Transfer-Encoding: base64", "", foldedBase64(utf8Base64(html)), `--${alternative}--`,
  ];
  for (const image of images) lines.push(`--${related}`, `Content-Type: ${image.type}`, "Content-Transfer-Encoding: base64", `Content-ID: <${image.cid}>`, "Content-Disposition: inline", "", foldedBase64(image.base64));
  lines.push(`--${related}--`, `--${mixed}`, 'Content-Type: text/html; charset="utf-8"', "Content-Transfer-Encoding: base64",
    `Content-Disposition: attachment; filename="${asciiFilename}";`, ` filename*=UTF-8''${encodeURIComponent(filename)}`, "", foldedBase64(utf8Base64(mail.attachment.html)), `--${mixed}--`, "");
  return lines.join("\r\n");
}
