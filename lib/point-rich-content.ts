export type PointAttachment = { id: string; name: string; url: string; size: number; type: string };
export function escapeRichText(value: string) {
  return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}
export function safeAssetUrl(value: string) {
  if (/^data:image\/(?:png|jpeg|webp|gif);base64,[A-Za-z0-9+/]+={0,2}$/.test(value) && value.length <= 210_000) return value;
  if (/^\/api\/point-assets\?id=[0-9a-f-]{36}$/.test(value)) return value;
  try { const url = new URL(value); return url.protocol === "https:" ? url.href : ""; } catch { return ""; }
}
const tags = new Set("p div span strong b em i u s br ul ol li table thead tbody tfoot tr th td h2 h3 h4 blockquote a img".split(" "));
export function sanitizePointHtml(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.slice(0, 1_500_000).replace(/<font\b([^>]*)>/gi, (_, attrs) => {
    const get = (name: string) => new RegExp(`${name}=[\x22\x27]?([^\x22\x27\x20>]+)`, "i").exec(attrs)?.[1] ?? "";
    const size = ({ 1: 12, 2: 14, 3: 16, 4: 18, 5: 24, 6: 32, 7: 36 } as Record<string, number>)[get("size")] ?? 16;
    return `<span style="font-size:${size}px;font-family:${get("face")};color:${get("color")}">`;
  }).replace(/<\/font\s*>/gi, "</span>").replace(/<(script|style|iframe|object|svg|math|template)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, "").replace(/<!--[\s\S]*?-->/g, "").replace(/<[^>]*>/g, (token) => {
    const match = /^<\s*(\/?)\s*([a-z0-9]+)/i.exec(token);
    if (!match || !tags.has(match[2].toLowerCase())) return "";
    const tag = match[2].toLowerCase();
    if (match[1]) return tag === "img" || tag === "br" ? "" : `</${tag}>`;
    const attrs: Record<string, string> = {};
    for (const attr of token.matchAll(/\s([a-z][\w-]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi)) attrs[attr[1].toLowerCase()] = (attr[2] ?? attr[3] ?? attr[4] ?? "").replace(/&(?:amp|quot|apos|lt|gt|#39);/g, entity => ({"&amp;":"&","&quot;":'"',"&apos;":"'","&#39;":"'","&lt;":"<","&gt;":">"})[entity] ?? entity);
    let output = "";
    if (tag === "a" || tag === "img") {
      const url = safeAssetUrl(attrs[tag === "a" ? "href" : "src"] ?? "");
      if (!url || (tag === "a" && url.startsWith("data:"))) return tag === "img" ? "" : "<span>";
      output += ` ${tag === "a" ? "href" : "src"}="${escapeRichText(url)}"`;
      output += tag === "a" ? ' target="_blank" rel="noopener noreferrer"' : ` alt="${escapeRichText(attrs.alt ?? "Image du dossier")}" style="max-width:100%;height:auto"`;
    }
    if (tag === "td" || tag === "th") {
      for (const key of ["colspan", "rowspan"]) if (/^\d{1,2}$/.test(attrs[key] ?? "")) output += ` ${key}="${Math.max(1, Math.min(50, Number(attrs[key])))}"`;
      output += ' style="border:1px solid #cbd5d1;padding:6px;vertical-align:top"';
    } else if (tag === "table") output += ' style="border-collapse:collapse;width:100%;max-width:100%"';
    else if (tag !== "img" && attrs.style) {
      const safe = attrs.style.split(";").flatMap((entry) => {
        const [rawKey, ...rest] = entry.split(":"); const key = rawKey.trim().toLowerCase(); const val = rest.join(":").trim();
        const valid = key === "font-size" ? /^(?:1[0-9]|2[0-9]|3[0-6])px$/.test(val) : key === "font-family" ? /^(Arial|Verdana|Georgia|Calibri|sans-serif|serif)$/i.test(val) : key === "font-weight" ? /^(bold|normal|[4-9]00)$/.test(val) : key === "font-style" ? /^(italic|normal)$/.test(val) : key === "text-decoration" ? /^(underline|line-through|none)$/.test(val) : key === "text-align" ? /^(left|center|right)$/.test(val) : (key === "color" || key === "background-color") ? /^#[0-9a-f]{3,8}$/i.test(val) : false;
        return valid ? [`${key}:${val}`] : [];
      }).join(";");
      if (safe) output += ` style="${escapeRichText(safe)}"`;
    }
    // execCommand generates legacy font markup; only modern styles are kept.
    return `<${tag}${output}>`;
  });
}
export function normalizeAttachments(value: unknown): PointAttachment[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((v) => v && typeof v === "object" && typeof v.id === "string" && typeof v.name === "string" && typeof v.url === "string" && safeAssetUrl(v.url) ? [{ id: v.id, name: v.name.slice(0, 240), url: safeAssetUrl(v.url), size: Math.max(0, Number(v.size) || 0), type: typeof v.type === "string" ? v.type : "" }] : []).slice(0, 30);
}
export function dossierContentHtml(item: { richHtml?: string; action?: string; comment?: string; attachments?: PointAttachment[] }, origin = "") {
  const html = sanitizePointHtml(item.richHtml) || `<p>${escapeRichText(item.action || item.comment || "")}</p>`;
  const absolute = origin ? html.replace(/(src|href)="(\/api\/point-assets\?id=[0-9a-f-]{36})"/g, (_, key, path) => `${key}="${escapeRichText(origin)}${path}"`) : html;
  return absolute + normalizeAttachments(item.attachments).map((a) => `<p><a href="${escapeRichText(a.url.startsWith("/") ? origin + a.url : a.url)}" target="_blank" rel="noopener noreferrer">📎 ${escapeRichText(a.name)}</a></p>`).join("");
}
export function excelTextToHtml(value: string) {
  if (!value.includes("\t")) return `<p>${escapeRichText(value).replace(/\r?\n/g, "<br>")}</p>`;
  return sanitizePointHtml(`<table><tbody>${value.trimEnd().split(/\r?\n/).slice(0, 200).map((row) => `<tr>${row.split("\t").slice(0, 50).map((cell) => `<td>${escapeRichText(cell)}</td>`).join("")}</tr>`).join("")}</tbody></table><p><br></p>`);
}
