"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type CSSProperties, type ReactNode } from "react";

type Tone = "mint" | "violet" | "aqua" | "peach" | "red";
type View = "edit" | "preview" | "mail";
type Section = "general" | "dossiers" | "operations" | "tariffs" | "jira" | "versions" | "mail";
type Dossier = { id: string; title: string; universe: string; reference: string; status: string; owner: string; action: string; deadline: string; progress: number; comment: string };
type CommercialOperation = { id: string; name: string; month: string; state: string; summary: string; steps: [string, string][] };
type Tariff = { id: string; code: string; supplier: string; month: string; state: string; receptionDate: string; dueDate: string; owner: string; comment: string };
type JiraTicket = { id: string; key: string; summary: string; status: string; priority: string; assignee: string; lastActivity: string; link: string; comment: string };
type PointData = { pointName: string; themeColor: ThemeKey; meetingDate: string; priority: string; dossiers: Dossier[]; operations: CommercialOperation[]; tariffs: Tariff[]; jira: JiraTicket[]; mail: { to: string; cc: string; subject: string; intro: string } };
type AlertItem = { title: string; detail: string; severity: "warning" | "danger" };
type ThemeKey = "mint" | "violet" | "aqua" | "peach" | "red";
type PointRecord = { id: string; marketId: string; year: number; week: number; version: number; meetingDate: string; pointName: string; themeColor: ThemeKey; data: PointData; createdAt: string };

const markets = [
  { id: "revetements-menuiserie", name: "Revêtements & Menuiserie", short: "REV–MEN", tone: "mint" as Tone },
  { id: "bois-amex", name: "Bois amont / AMEX", short: "BOIS", tone: "peach" as Tone },
  { id: "outillage-quincaillerie", name: "Outillage & Quincaillerie", short: "OUT–QUIN", tone: "aqua" as Tone },
  { id: "panneaux", name: "Panneaux", short: "PAN", tone: "violet" as Tone },
] as const;

const themes: { id: ThemeKey; label: string; accent: string; soft: string }[] = [
  { id: "mint", label: "Menthe", accent: "#72f5c5", soft: "rgba(114,245,197,.12)" },
  { id: "violet", label: "Violet", accent: "#b39aff", soft: "rgba(179,154,255,.12)" },
  { id: "aqua", label: "Azur", accent: "#70d8ff", soft: "rgba(112,216,255,.12)" },
  { id: "peach", label: "Corail", accent: "#ffb083", soft: "rgba(255,176,131,.12)" },
  { id: "red", label: "Framboise", accent: "#ff7287", soft: "rgba(255,114,135,.12)" },
];

const statusOptions = ["Dans les délais", "En cours", "En attente", "À surveiller", "Action requise", "Bloquant", "Terminé"];
const stepOptions = ["À faire", "En attente", "En cours", "Fait", "Non applicable"];
const uid = () => typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const isoToday = () => new Date().toISOString().slice(0, 10);

function initialData(marketId = "revetements-menuiserie"): PointData {
  const market = markets.find((item) => item.id === marketId) ?? markets[0];
  const common = {
    pointName: "Point marché",
    themeColor: market.tone,
    meetingDate: isoToday(),
    priority: "Sécuriser les dossiers à surveiller et confirmer les prochaines échéances.",
    mail: { to: "", cc: "", subject: `Point marché — ${market.name}`, intro: "Bonjour à tous, voici le point d’avancement de la semaine." },
  };
  if (marketId !== "revetements-menuiserie") return { ...common, dossiers: [], operations: [], tariffs: [], jira: [] };
  return {
    ...common,
    dossiers: [
      { id: uid(), title: "EDAC", universe: "Revêtements", reference: "B9822", status: "En attente", owner: "Équipe marché", action: "Obtenir le retour de l’équipe marché.", deadline: "", progress: 35, comment: "Évolution décalée en septembre." },
      { id: uid(), title: "JELDWEN ALLEMAGNE", universe: "Menuiserie", reference: "D2381", status: "Action requise", owner: "", action: "Vérifier la trame transmise avant poursuite.", deadline: "", progress: 55, comment: "Trame à contrôler." },
      { id: uid(), title: "CIB", universe: "Dossier marché", reference: "", status: "En attente", owner: "Équipe vente", action: "Relancer l’équipe vente.", deadline: "", progress: 25, comment: "En attente du retour de l’équipe vente." },
    ],
    operations: [
      { id: uid(), name: "Incontournables de la rentrée", month: "Septembre 2026", state: "Vente à finaliser", summary: "2 étapes finalisées · 1 non applicable · 1 en attente", steps: [["Complétude de la trame", "Fait"], ["Intégration tarif achat", "Non applicable"], ["Contrôle tarif achat", "Fait"], ["Tarif vente", "En attente"]] },
      { id: uid(), name: "Champagne Flooring", month: "Octobre 2026", state: "Délai de traitement dépassé", summary: "Trame reçue · étapes achat toujours en attente", steps: [["Réception de la trame", "Fait"], ["Complétude de la trame", "En attente"], ["Intégration tarif achat", "En attente"], ["Contrôle tarif achat", "En attente"]] },
    ],
    tariffs: [
      ["D2381", "JELDWEN ALLEMAGNE", "Août 2026", "Trame reçue", "", "", "", ""],
      ["B9822", "EDAC", "Septembre 2026", "Décalé", "", "", "", "Décalage septembre"],
      ["B9642", "THEUMA", "Août 2026", "En cours", "", "", "", ""],
      ["B6515", "BLOCFER", "Août 2026", "En cours", "", "", "", ""],
      ["C8074", "FELDOR", "Août 2026", "En cours", "", "", "", ""],
      ["A5633", "COULIDOOR", "Août 2026", "En cours", "", "", "", ""],
      ["A3453", "SOGAL", "Septembre 2026", "À préparer", "", "", "", ""],
      ["A8226", "GIMM GAM", "Septembre 2026", "À préparer", "", "", "", ""],
      ["D6280", "LEBO DOORS", "Septembre 2026", "À préparer", "", "", "", ""],
      ["A1170", "BEL’M", "Septembre 2026", "À préparer", "", "", "", ""],
    ].map(([code, supplier, month, state, receptionDate, dueDate, owner, comment]) => ({ id: uid(), code, supplier, month, state, receptionDate, dueDate, owner, comment })),
    jira: [
      ["MAR-101", "Contrôle règle tarifaire", "En attente d’un tiers", "Moyenne", "Louise Pepin", "", "", ""],
      ["MAR-102", "Écart de promotion", "En cours", "Haute", "Baptiste Plaisir", "", "", ""],
      ["MAR-103", "Mise à jour fournisseur", "En attente de changement", "Moyenne", "Sarah Daniel", "", "", ""],
    ].map(([key, summary, status, priority, assignee, lastActivity, link, comment]) => ({ id: uid(), key, summary, status, priority, assignee, lastActivity, link, comment })),
  };
}

function normalizePointData(value: unknown, marketId: string): PointData {
  const fallback = initialData(marketId);
  if (!value || typeof value !== "object") return fallback;
  const source = value as Partial<PointData> & { simulations?: CommercialOperation[] };
  const themeColor = themes.some((theme) => theme.id === source.themeColor) ? source.themeColor as ThemeKey : fallback.themeColor;
  return {
    pointName: typeof source.pointName === "string" && source.pointName.trim() ? source.pointName : fallback.pointName,
    themeColor,
    meetingDate: typeof source.meetingDate === "string" ? source.meetingDate : fallback.meetingDate,
    priority: typeof source.priority === "string" ? source.priority : fallback.priority,
    dossiers: Array.isArray(source.dossiers) ? source.dossiers : [],
    operations: Array.isArray(source.operations) ? source.operations : Array.isArray(source.simulations) ? source.simulations : [],
    tariffs: Array.isArray(source.tariffs) ? source.tariffs : [],
    jira: Array.isArray(source.jira) ? source.jira : [],
    mail: { ...fallback.mail, ...(source.mail && typeof source.mail === "object" ? source.mail : {}) },
  };
}

const pointSignature = (marketId: string, data: PointData) => JSON.stringify({ marketId, data });

async function fetchPointRecords(marketId: string): Promise<PointRecord[]> {
  const response = await fetch(`/api/points?marketId=${encodeURIComponent(marketId)}`, { cache: "no-store" });
  const payload = await response.json() as { points?: PointRecord[]; error?: string };
  if (!response.ok) throw new Error(payload.error || "Impossible de charger les sauvegardes.");
  return (payload.points ?? []).map((record) => ({ ...record, data: normalizePointData(record.data, record.marketId) }));
}

function Icon({ name, size = 18 }: { name: string; size?: number }) {
  const paths: Record<string, ReactNode> = {
    edit: <><path d="M4 20h4l11-11-4-4L4 16v4Z"/><path d="m13.5 6.5 4 4"/></>,
    eye: <><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"/><circle cx="12" cy="12" r="2.5"/></>,
    mail: <><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m4 7 8 6 8-6"/></>,
    folder: <><path d="M3 7h6l2 2h10v10H3Z"/><path d="M3 7V5h7l2 2"/></>,
    trend: <><path d="M4 19V9M10 19V5M16 19v-7M22 19H2"/><path d="m3 8 6-4 6 7 6-5"/></>,
    ticket: <><path d="M20 13a2 2 0 0 0 0-4V5H4v4a2 2 0 0 1 0 4v4h16Z"/><path d="M9 8.5h6M9 12h6M9 15.5h3"/></>,
    alert: <><path d="M12 3 2.7 20h18.6Z"/><path d="M12 9v5M12 17.5v.1"/></>,
    plus: <path d="M12 5v14M5 12h14"/>, trash: <><path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13"/><path d="M10 11v5M14 11v5"/></>,
    copy: <><rect x="8" y="8" width="11" height="11" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/></>,
    download: <><path d="M12 3v12m0 0 5-5m-5 5-5-5"/><path d="M4 20h16"/></>, upload: <><path d="M12 16V4m0 0 5 5m-5-5L7 9"/><path d="M4 20h16"/></>,
    spark: <><path d="m12 2 1.4 5.1L18 9l-4.6 1.9L12 16l-1.4-5.1L6 9l4.6-1.9Z"/><path d="m19 15 .7 2.3L22 18l-2.3.7L19 21l-.7-2.3L16 18l2.3-.7Z"/></>,
    chevron: <path d="m9 6 6 6-6 6"/>, check: <path d="m5 12 4 4L19 6"/>,
  };
  return <svg className="icon" width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">{paths[name]}</svg>;
}

function isoWeek(dateString: string) {
  const date = new Date(`${dateString || isoToday()}T12:00:00`); const target = new Date(date.valueOf()); const day = (date.getDay() + 6) % 7;
  target.setDate(target.getDate() - day + 3); const firstThursday = new Date(target.getFullYear(), 0, 4); const firstDay = (firstThursday.getDay() + 6) % 7;
  firstThursday.setDate(firstThursday.getDate() - firstDay + 3); return 1 + Math.round((target.valueOf() - firstThursday.valueOf()) / 604800000);
}
function isoWeekYear(dateString: string) { const date = new Date(`${dateString || isoToday()}T12:00:00`); const day = (date.getDay() + 6) % 7; date.setDate(date.getDate() - day + 3); return date.getFullYear(); }
function dateLabel(value: string) { if (!value) return "Date à définir"; return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(`${value}T12:00:00`)); }
function daysBetween(from: string, to: string) { if (!from || !to) return 0; return Math.floor((new Date(`${to}T12:00:00`).valueOf() - new Date(`${from}T12:00:00`).valueOf()) / 86400000); }
function isClosed(status: string) { return /(termin|cl[oô]tur|r[eé]solu|annul)/i.test(status); }
function toneForStatus(status: string): Tone { if (/(bloqu|d[eé]pass|retard)/i.test(status)) return "red"; if (/(attente|surveill|action|pr[eé]par)/i.test(status)) return "peach"; if (/(fait|termin|re[cç]u|d[eé]lai)/i.test(status)) return "mint"; if (/cours/i.test(status)) return "aqua"; return "violet"; }
function escapeHtml(value: string) { return value.replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character] ?? character); }

function TextField({ label, value, onChange, placeholder, type = "text", wide = false }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; type?: string; wide?: boolean }) {
  return <label className={`field ${wide ? "field-wide" : ""}`}><span>{label}</span><input type={type} value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} /></label>;
}
function SelectField({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: string[] }) {
  return <label className="field"><span>{label}</span><select value={value} onChange={(event) => onChange(event.target.value)}>{options.map((option) => <option key={option}>{option}</option>)}</select></label>;
}
function SectionTitle({ eyebrow, title, detail, action }: { eyebrow: string; title: string; detail: string; action?: ReactNode }) {
  return <div className="section-title"><div><span>{eyebrow}</span><h2>{title}</h2><p>{detail}</p></div>{action}</div>;
}
function EmptyState({ label, onAdd }: { label: string; onAdd: () => void }) { return <button className="empty-state" onClick={onAdd}><span className="empty-plus"><Icon name="plus" size={22} /></span><strong>Ajouter {label}</strong><small>La section est vide pour le moment.</small></button>; }

function PasteImporter({ kind, onImport }: { kind: "tariffs" | "jira"; onImport: (text: string) => number }) {
  const [open, setOpen] = useState(false); const [text, setText] = useState(""); const [message, setMessage] = useState("");
  const label = kind === "tariffs" ? "évolutions tarifaires" : "tickets Jira";
  const columns = kind === "tariffs" ? "Code | Fournisseur | Mois | État | Réception | Échéance | Responsable | Commentaire" : "Clé | Résumé | Statut | Priorité | Responsable | Dernière activité | Lien | Commentaire";
  return <div className={`paste-importer ${open ? "is-open" : ""}`}><button className="secondary-button" onClick={() => setOpen((value) => !value)}><Icon name="copy" /> Coller un tableau</button>{open && <div className="paste-panel"><div><strong>Import rapide des {label}</strong><span>Copie les lignes depuis Excel ou Jira, avec ou sans en-tête.</span></div><code>{columns}</code><textarea value={text} onChange={(event) => setText(event.target.value)} placeholder="Colle ici les lignes séparées par des tabulations ou des points-virgules…" /><div className="paste-actions"><span>{message}</span><button className="primary-button small" onClick={() => { const count = onImport(text); setMessage(count ? `${count} ligne${count > 1 ? "s" : ""} importée${count > 1 ? "s" : ""}.` : "Aucune ligne reconnue."); if (count) setText(""); }}>Importer</button></div></div>}</div>;
}

function buildAlerts(data: PointData): AlertItem[] {
  const alerts: AlertItem[] = []; const pointDate = data.meetingDate || isoToday(); const day = new Date(`${pointDate}T12:00:00`).getDate();
  data.dossiers.forEach((item) => { if (isClosed(item.status)) return; if (/bloqu/i.test(item.status)) alerts.push({ title: item.title || "Dossier", detail: item.comment || "Dossier bloquant", severity: "danger" }); else if (item.deadline && daysBetween(item.deadline, pointDate) > 0) alerts.push({ title: item.title || "Dossier", detail: `Échéance dépassée depuis ${daysBetween(item.deadline, pointDate)} jour(s)`, severity: "danger" }); else if (/(surveill|action)/i.test(item.status)) alerts.push({ title: item.title || "Dossier", detail: item.comment || item.action || item.status, severity: "warning" }); });
  data.tariffs.forEach((item) => { if (isClosed(item.state)) return; if (!item.receptionDate && day >= 15) alerts.push({ title: item.supplier || "Évolution tarifaire", detail: "Trame non reçue après le 15", severity: "danger" }); else if (!item.receptionDate && day >= 8) alerts.push({ title: item.supplier || "Évolution tarifaire", detail: "Trame à sécuriser avant le 15", severity: "warning" }); else if (item.receptionDate && daysBetween(item.receptionDate, pointDate) > 5 && !/(termin|fait|valid)/i.test(item.state)) alerts.push({ title: item.supplier || "Évolution tarifaire", detail: `Trame reçue depuis ${daysBetween(item.receptionDate, pointDate)} jours · traitement à contrôler`, severity: "warning" }); });
  data.jira.forEach((item) => { if (!isClosed(item.status) && item.lastActivity && daysBetween(item.lastActivity, pointDate) > 10) alerts.push({ title: item.key || "Ticket Jira", detail: `Aucune activité depuis ${daysBetween(item.lastActivity, pointDate)} jours`, severity: "warning" }); });
  return alerts.slice(0, 12);
}

function PreviewDashboard({ data, market }: { data: PointData; market: typeof markets[number] }) {
  const alerts = useMemo(() => buildAlerts(data), [data]);
  const activeJira = data.jira.filter((item) => !isClosed(item.status));
  const metrics = [[data.dossiers.filter((item) => !isClosed(item.status)).length, "Dossiers suivis", "folder", "mint"], [data.tariffs.length, "Évolutions", "trend", "violet"], [activeJira.length, "Tickets Jira", "ticket", "aqua"], [alerts.length, "Vigilances", "alert", "peach"]] as const;
  const groupedTariffs = Array.from(new Set(data.tariffs.map((item) => item.month || "Sans mois"))).map((month) => ({ month, items: data.tariffs.filter((item) => (item.month || "Sans mois") === month) }));
  const jiraPeople = Array.from(new Set(activeJira.map((item) => item.assignee || "Non assigné"))).map((assignee) => ({ assignee, items: activeJira.filter((item) => (item.assignee || "Non assigné") === assignee) }));
  return <div className="report-canvas"><div className="report-ambient report-ambient-one"/><div className="report-ambient report-ambient-two"/>
    <header className="report-hero"><div><div className="market-badge"><i/> MARKET PULSE <b>/</b> {market.short}</div><h1>{data.pointName || "Point marché"}</h1><p><strong>{market.name}</strong><span>Dossiers · opérations commerciales · évolutions · Jira</span></p></div><div className="week-card"><strong>S{String(isoWeek(data.meetingDate)).padStart(2, "0")}</strong><i/><div><b>{dateLabel(data.meetingDate)}</b><span>Point hebdomadaire</span></div></div></header>
    <section className="report-metrics">{metrics.map(([value, label, icon, tone], index) => <article className={`report-metric tone-${tone}`} key={label}><span>0{index + 1}</span><div className="report-metric-icon"><Icon name={icon}/></div><strong>{value}</strong><small>{label}</small></article>)}</section>
    <section className="report-priority"><span>Priorité de la semaine</span><strong>{data.priority || "Aucune priorité renseignée."}</strong></section>
    <div className="report-grid"><article className="report-focus"><div className="report-heading"><span>01</span><div><small>Dossiers</small><h2>En cours</h2></div><b>{data.dossiers.length} suivi{data.dossiers.length > 1 ? "s" : ""}</b></div>
      {data.dossiers.length ? <div className="report-dossiers">{data.dossiers.map((item, index) => <div className="report-dossier" key={item.id}><span className={`status-dot tone-${toneForStatus(item.status)}`}/><code>{String(index + 1).padStart(2, "0")}</code><div><strong>{item.title || "Dossier sans titre"}</strong><small>{[item.universe, item.reference, item.owner].filter(Boolean).join(" · ") || "Contexte à compléter"}</small></div><p>{item.action || item.comment || "Prochaine action à compléter."}</p><span className={`report-pill tone-${toneForStatus(item.status)}`}>{item.status}</span></div>)}</div> : <div className="report-empty">Aucun dossier renseigné</div>}
      <div className="report-subheading">Opérations commerciales (promo)</div>{data.operations.length ? <div className="report-simulations">{data.operations.map((item, index) => <section className={`report-simulation simulation-${index % 2 ? "violet" : "mint"}`} key={item.id}><div><code>{String.fromCharCode(65 + index)}</code><span className={`report-pill tone-${toneForStatus(item.state)}`}>{item.state}</span></div><small>{item.month || "Mois à définir"}</small><h3>{item.name || "Opération sans titre"}</h3><p>{item.summary}</p><div>{item.steps.map(([label, state]) => <div className="report-step" key={label}><span>{label}</span><strong className={`tone-text-${toneForStatus(state)}`}><i/>{state}</strong></div>)}</div></section>)}</div> : <div className="report-empty">Aucune opération commerciale renseignée</div>}
    </article><aside className="report-side">
      <article className="report-dark-card"><div className="side-heading"><div><span>02</span><h2>Évolutions tarifaires</h2></div><b>{data.tariffs.length} total</b></div>{groupedTariffs.length ? groupedTariffs.map((group) => <section className="tariff-group" key={group.month}><h3>{group.month}<span>{group.items.length} fournisseur{group.items.length > 1 ? "s" : ""}</span></h3>{group.items.map((item) => <div className="tariff-line" key={item.id}><code>{item.code || "—"}</code><strong>{item.supplier || "Fournisseur"}</strong><small>{item.state}</small></div>)}</section>) : <div className="report-empty dark-empty">Aucune évolution</div>}</article>
      <article className="report-dark-card"><div className="side-heading"><div><span>03</span><h2>Jira</h2></div><b>{activeJira.length} actif{activeJira.length > 1 ? "s" : ""}</b></div>{jiraPeople.length ? <div className="jira-summary">{jiraPeople.map((person, index) => <div key={person.assignee}><i className={`tone-${(["mint", "violet", "aqua", "peach"] as Tone[])[index % 4]}`}/><p><strong>{person.assignee}</strong><small>{person.items.map((item) => item.status).join(" · ")}</small></p><b>{person.items.length}</b></div>)}</div> : <div className="report-empty dark-empty">Aucun ticket actif</div>}</article>
      <article className="report-alert-card"><div className="alert-heading"><span>04</span><h2>Vigilances</h2><b>{alerts.length}</b></div>{alerts.length ? alerts.map((item, index) => <div className="alert-line" key={`${item.title}-${index}`}><span>{String(index + 1).padStart(2, "0")}</span><div><strong>{item.title}</strong><small>{item.detail}</small></div></div>) : <div className="report-empty light-empty">Aucune vigilance détectée</div>}</article>
    </aside></div><footer className="report-footer"><span>Market Pulse · {market.name}</span><span>{data.pointName || "Point marché"} du {dateLabel(data.meetingDate)}</span></footer>
  </div>;
}

function buildMailHtml(data: PointData, market: typeof markets[number]) {
  const alerts = buildAlerts(data); const activeJira = data.jira.filter((item) => !isClosed(item.status)).length;
  const theme = themes.find((item) => item.id === data.themeColor) ?? themes[0];
  const dossierRows = data.dossiers.map((item) => `<tr><td style="padding:12px 14px;border-bottom:1px solid #DDE7E3"><b style="color:#10201D">${escapeHtml(item.title || "Dossier")}</b><br><span style="color:#64736F;font-size:11px">${escapeHtml([item.universe, item.reference].filter(Boolean).join(" · "))}</span></td><td style="padding:12px 14px;border-bottom:1px solid #DDE7E3;color:#41534E;font-size:12px">${escapeHtml(item.action || item.comment || "—")}</td><td style="padding:12px 14px;border-bottom:1px solid #DDE7E3;text-align:right"><span style="display:inline-block;padding:6px 9px;border-radius:99px;background:#E7EEE9;color:#253E36;font-size:10px;font-weight:700">${escapeHtml(item.status)}</span></td></tr>`).join("");
  const tariffRows = data.tariffs.map((item) => `<tr><td style="padding:8px 10px;color:#7C8F92;font-family:monospace;font-size:10px">${escapeHtml(item.code || "—")}</td><td style="padding:8px 10px;color:#FFFFFF;font-size:11px;font-weight:700">${escapeHtml(item.supplier || "Fournisseur")}</td><td style="padding:8px 10px;color:#AFC0C2;font-size:10px">${escapeHtml(item.month || "—")}</td><td style="padding:8px 10px;color:${theme.accent};font-size:10px">${escapeHtml(item.state || "—")}</td></tr>`).join("");
  const jiraRows = data.jira.filter((item) => !isClosed(item.status)).map((item) => `<tr><td style="padding:8px 10px;color:#70D8FF;font-family:monospace;font-size:10px">${escapeHtml(item.key || "—")}</td><td style="padding:8px 10px;color:#FFFFFF;font-size:11px">${escapeHtml(item.summary || "Ticket")}</td><td style="padding:8px 10px;color:#AFC0C2;font-size:10px">${escapeHtml(item.assignee || "Non assigné")}</td><td style="padding:8px 10px;color:#FFB083;font-size:10px">${escapeHtml(item.status)}</td></tr>`).join("");
  const alertRows = alerts.map((item, index) => `<tr><td style="padding:9px 0;border-bottom:1px solid #E18B5E;width:34px;color:#743817;font-family:monospace;font-size:10px">${String(index + 1).padStart(2, "0")}</td><td style="padding:9px 0;border-bottom:1px solid #E18B5E"><b style="display:block;color:#23140C;font-size:11px">${escapeHtml(item.title)}</b><span style="color:#743817;font-size:10px">${escapeHtml(item.detail)}</span></td></tr>`).join("");
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>${escapeHtml(data.mail.subject)}</title></head><body style="margin:0;padding:0;background:#F2F5F4;font-family:Arial,sans-serif;color:#10201D"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#F2F5F4"><tr><td align="center" style="padding:26px 12px"><table role="presentation" width="1000" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:1000px;background:#071012">
  <tr><td style="padding:28px 30px 22px;background:#071012"><span style="display:inline-block;padding:6px 10px;border:1px solid ${theme.accent};border-radius:99px;color:${theme.accent};font-size:10px;font-weight:700">MARKET PULSE / ${escapeHtml(market.short)}</span><h1 style="margin:12px 0 4px;color:#FFFFFF;font-size:38px;line-height:42px">${escapeHtml(data.pointName || "Point marché")}</h1><p style="margin:0;color:${theme.accent};font-size:16px;font-weight:700">${escapeHtml(market.name)}</p><p style="margin:15px 0 0;color:#AFC0C2;font-size:12px">Semaine ${isoWeek(data.meetingDate)} · ${escapeHtml(dateLabel(data.meetingDate))}</p></td></tr>
  <tr><td style="padding:0 30px 22px;background:#071012"><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr>${[[data.dossiers.length,"Dossiers"],[data.tariffs.length,"Évolutions"],[activeJira,"Tickets Jira"],[alerts.length,"Vigilances"]].map(([value,label], index) => `<td width="25%" style="padding-right:${index < 3 ? "8px" : "0"}"><table role="presentation" width="100%" style="background:#102023;border:1px solid #263C40"><tr><td style="padding:13px"><b style="display:block;color:#FFFFFF;font-size:24px">${value}</b><span style="color:#AFC0C2;font-size:10px;text-transform:uppercase">${label}</span></td></tr></table></td>`).join("")}</tr></table></td></tr>
  <tr><td style="padding:0 30px 24px;background:#071012"><table role="presentation" width="100%" style="background:#132622;border-left:4px solid ${theme.accent}"><tr><td style="padding:14px 16px"><b style="display:block;color:${theme.accent};font-size:9px;text-transform:uppercase">Priorité de la semaine</b><span style="display:block;margin-top:5px;color:#FFFFFF;font-size:13px">${escapeHtml(data.priority || "Aucune priorité renseignée.")}</span></td></tr></table></td></tr>
  <tr><td style="padding:0 30px 18px;background:#071012"><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td valign="top" width="65%" style="padding-right:8px"><table role="presentation" width="100%" style="background:#F5F8F6"><tr><td style="padding:17px 18px 8px;color:#55716A;font-size:10px;font-weight:700;text-transform:uppercase">Dossiers en cours</td></tr><tr><td style="padding:0 8px 12px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0">${dossierRows || '<tr><td style="padding:16px;color:#64736F;font-size:12px">Aucun dossier renseigné</td></tr>'}</table></td></tr></table></td><td valign="top" width="35%" style="padding-left:8px"><table role="presentation" width="100%" style="background:#FFB083"><tr><td style="padding:16px"><b style="font-size:13px;text-transform:uppercase">Vigilances · ${alerts.length}</b><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:8px">${alertRows || '<tr><td style="padding:12px 0;color:#743817;font-size:11px">Aucune vigilance détectée</td></tr>'}</table></td></tr></table></td></tr></table></td></tr>
  <tr><td style="padding:0 30px 18px;background:#071012"><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td valign="top" width="50%" style="padding-right:8px"><table role="presentation" width="100%" style="background:#102023"><tr><td style="padding:15px;color:#B39AFF;font-size:11px;font-weight:700;text-transform:uppercase">Évolutions tarifaires</td></tr><tr><td style="padding:0 6px 12px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0">${tariffRows || '<tr><td style="padding:12px;color:#AFC0C2;font-size:11px">Aucune évolution</td></tr>'}</table></td></tr></table></td><td valign="top" width="50%" style="padding-left:8px"><table role="presentation" width="100%" style="background:#102023"><tr><td style="padding:15px;color:#70D8FF;font-size:11px;font-weight:700;text-transform:uppercase">Tickets Jira actifs</td></tr><tr><td style="padding:0 6px 12px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0">${jiraRows || '<tr><td style="padding:12px;color:#AFC0C2;font-size:11px">Aucun ticket actif</td></tr>'}</table></td></tr></table></td></tr></table></td></tr>
  <tr><td style="padding:18px 30px;background:#0C181B;color:#789094;font-size:9px;text-transform:uppercase">Market Pulse · ${escapeHtml(market.name)} · ${escapeHtml(data.pointName || "Point marché")} du ${escapeHtml(dateLabel(data.meetingDate))}</td></tr></table></td></tr></table></body></html>`;
}

export default function Home() {
  const [marketId, setMarketId] = useState("revetements-menuiserie");
  const [data, setData] = useState<PointData>(() => initialData());
  const [view, setView] = useState<View>("edit");
  const [section, setSection] = useState<Section>("general");
  const [ready, setReady] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [activeVersion, setActiveVersion] = useState<number | null>(null);
  const [archive, setArchive] = useState<PointRecord[]>([]);
  const [archiveLoading, setArchiveLoading] = useState(true);
  const [archiveError, setArchiveError] = useState("");
  const [saving, setSaving] = useState(false);
  const [lastSavedSignature, setLastSavedSignature] = useState("");
  const [toast, setToast] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const archiveRequest = useRef(0);
  const market = markets.find((item) => item.id === marketId) ?? markets[0];
  const theme = themes.find((item) => item.id === data.themeColor) ?? themes[0];
  const themeStyle = { "--accent": theme.accent, "--accent-soft": theme.soft } as CSSProperties;
  const alerts = useMemo(() => buildAlerts(data), [data]);
  const mailHtml = useMemo(() => buildMailHtml(data, market), [data, market]);
  const isDirty = pointSignature(marketId, data) !== lastSavedSignature;
  const currentWeek = isoWeek(data.meetingDate);
  const currentWeekYear = isoWeekYear(data.meetingDate);
  const currentWeekVersions = archive.filter((item) => item.week === currentWeek && item.year === currentWeekYear);

  const loadMarket = useCallback(async (nextMarket: string, loadLatest = true) => {
    const requestId = ++archiveRequest.current;
    setMarketId(nextMarket);
    setArchiveLoading(true);
    setArchiveError("");
    try {
      const points = await fetchPointRecords(nextMarket);
      if (requestId !== archiveRequest.current) return;
      setArchive(points);
      if (loadLatest) {
        const latest = points[0];
        if (latest) {
          const nextData = normalizePointData(latest.data, nextMarket);
          setData(nextData);
          setActiveVersion(latest.version);
          setSavedAt(new Date(latest.createdAt.replace(" ", "T") + (latest.createdAt.includes("Z") ? "" : "Z")));
          setLastSavedSignature(pointSignature(nextMarket, nextData));
        } else {
          setData(initialData(nextMarket));
          setActiveVersion(null);
          setSavedAt(null);
          setLastSavedSignature("");
        }
      }
    } catch (error) {
      if (requestId !== archiveRequest.current) return;
      setArchive([]);
      setArchiveError(error instanceof Error ? error.message : "Impossible de charger les sauvegardes.");
      if (loadLatest) {
        setData(initialData(nextMarket));
        setActiveVersion(null);
        setSavedAt(null);
        setLastSavedSignature("");
      }
    } finally {
      if (requestId === archiveRequest.current) {
        setArchiveLoading(false);
        setReady(true);
      }
    }
  }, []);

  useEffect(() => { const timer = window.setTimeout(() => { void loadMarket("revetements-menuiserie"); }, 0); return () => window.clearTimeout(timer); }, [loadMarket]);
  useEffect(() => { if (!toast) return; const timer = window.setTimeout(() => setToast(""), 2600); return () => window.clearTimeout(timer); }, [toast]);

  const chooseMarket = (nextMarket: string) => {
    if (nextMarket !== marketId && isDirty && !window.confirm("Changer de marché sans enregistrer ce brouillon ?")) return;
    setSection("general");
    void loadMarket(nextMarket);
  };
  const updateDossier = (id: string, patch: Partial<Dossier>) => setData((current) => ({ ...current, dossiers: current.dossiers.map((item) => item.id === id ? { ...item, ...patch } : item) }));
  const updateOperation = (id: string, patch: Partial<CommercialOperation>) => setData((current) => ({ ...current, operations: current.operations.map((item) => item.id === id ? { ...item, ...patch } : item) }));
  const updateTariff = (id: string, patch: Partial<Tariff>) => setData((current) => ({ ...current, tariffs: current.tariffs.map((item) => item.id === id ? { ...item, ...patch } : item) }));
  const updateJira = (id: string, patch: Partial<JiraTicket>) => setData((current) => ({ ...current, jira: current.jira.map((item) => item.id === id ? { ...item, ...patch } : item) }));
  const addDossier = () => setData((current) => ({ ...current, dossiers: [...current.dossiers, { id: uid(), title: "", universe: "", reference: "", status: "En cours", owner: "", action: "", deadline: "", progress: 0, comment: "" }] }));
  const addOperation = () => setData((current) => ({ ...current, operations: [...current.operations, { id: uid(), name: "", month: "", state: "En cours", summary: "", steps: [["Réception de la trame", "À faire"], ["Complétude de la trame", "À faire"], ["Intégration tarif achat", "À faire"], ["Contrôle tarif achat", "À faire"], ["Tarif vente", "À faire"]] }] }));
  const addTariff = () => setData((current) => ({ ...current, tariffs: [...current.tariffs, { id: uid(), code: "", supplier: "", month: "", state: "À préparer", receptionDate: "", dueDate: "", owner: "", comment: "" }] }));
  const addJira = () => setData((current) => ({ ...current, jira: [...current.jira, { id: uid(), key: "", summary: "", status: "À qualifier", priority: "Moyenne", assignee: "", lastActivity: "", link: "", comment: "" }] }));

  const importTable = (kind: "tariffs" | "jira", text: string) => {
    const parsed = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).map((line) => line.split(line.includes("\t") ? "\t" : ";").map((cell) => cell.trim())).filter((cells) => cells.length > 1);
    const rows = parsed.filter((cells, index) => !(index === 0 && /(fournisseur|supplier|r[eé]sum[eé]|summary|cl[eé]|ticket)/i.test(cells.join(" "))));
    if (!rows.length) return 0;
    if (kind === "tariffs") setData((current) => ({ ...current, tariffs: [...current.tariffs, ...rows.map((cells) => ({ id: uid(), code: cells[0] || "", supplier: cells[1] || "", month: cells[2] || "", state: cells[3] || "À préparer", receptionDate: cells[4] || "", dueDate: cells[5] || "", owner: cells[6] || "", comment: cells[7] || "" }))] }));
    else setData((current) => ({ ...current, jira: [...current.jira, ...rows.map((cells) => ({ id: uid(), key: cells[0] || "", summary: cells[1] || "", status: cells[2] || "À qualifier", priority: cells[3] || "Moyenne", assignee: cells[4] || "", lastActivity: cells[5] || "", link: cells[6] || "", comment: cells[7] || "" }))] }));
    return rows.length;
  };
  const download = (name: string, content: string, type: string) => { const url = URL.createObjectURL(new Blob([content], { type })); const anchor = document.createElement("a"); anchor.href = url; anchor.download = name; anchor.click(); window.setTimeout(() => URL.revokeObjectURL(url), 500); };
  const exportJson = (record?: PointRecord) => {
    const exportMarket = record?.marketId ?? marketId; const exportData = record?.data ?? data; const week = record?.week ?? isoWeek(exportData.meetingDate); const year = record?.year ?? isoWeekYear(exportData.meetingDate); const version = record?.version ?? activeVersion;
    download(`point-marche-${exportMarket}-${year}-S${String(week).padStart(2, "0")}${version ? `-V${version}` : "-brouillon"}.json`, JSON.stringify({ schemaVersion: 2, marketId: exportMarket, year, week, version, data: exportData }, null, 2), "application/json");
  };
  const importJson = (event: ChangeEvent<HTMLInputElement>) => { const file = event.target.files?.[0]; if (!file) return; const reader = new FileReader(); reader.onload = () => { try { const payload = JSON.parse(String(reader.result)) as { marketId?: string; data?: unknown }; if (!payload.data) throw new Error(); const importedMarket = markets.some((item) => item.id === payload.marketId) ? payload.marketId as string : marketId; const importedData = normalizePointData(payload.data, importedMarket); setMarketId(importedMarket); setData(importedData); setActiveVersion(null); setSavedAt(null); setLastSavedSignature(""); void loadMarket(importedMarket, false); setToast("JSON importé comme nouveau brouillon."); } catch { setToast("Fichier non reconnu."); } }; reader.readAsText(file); event.target.value = ""; };
  const resetPoint = () => { if (!window.confirm("Créer un nouveau point pour ce marché ? Le brouillon actuel sera remplacé, mais les versions enregistrées resteront disponibles.")) return; const fresh = initialData(marketId); fresh.dossiers = []; fresh.operations = []; fresh.tariffs = []; fresh.jira = []; fresh.mail = data.mail; fresh.pointName = data.pointName; fresh.themeColor = data.themeColor; setData(fresh); setActiveVersion(null); setSavedAt(null); setLastSavedSignature(""); setToast("Nouveau brouillon créé."); };
  const loadRecord = (record: PointRecord) => {
    if (isDirty && !window.confirm("Charger cette version et remplacer le brouillon non enregistré ?")) return;
    const nextData = normalizePointData(record.data, record.marketId);
    setMarketId(record.marketId); setData(nextData); setActiveVersion(record.version); setSavedAt(new Date(record.createdAt.replace(" ", "T") + (record.createdAt.includes("Z") ? "" : "Z"))); setLastSavedSignature(pointSignature(record.marketId, nextData)); setSection("general"); setView("edit"); setToast(`S${String(record.week).padStart(2, "0")} · V${record.version} chargée.`);
  };
  const saveVersion = async () => {
    if (saving || !ready) return;
    setSaving(true);
    try {
      const response = await fetch("/api/points", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ marketId, data }) });
      const payload = await response.json() as { point?: PointRecord; error?: string };
      if (!response.ok || !payload.point) throw new Error(payload.error || "Échec de la sauvegarde.");
      const savedData = normalizePointData(payload.point.data, marketId); const saved = { ...payload.point, data: savedData };
      setData(savedData); setArchive((current) => [saved, ...current].sort((a, b) => b.year - a.year || b.week - a.week || b.version - a.version)); setActiveVersion(saved.version); setSavedAt(new Date()); setLastSavedSignature(pointSignature(marketId, savedData)); setArchiveError(""); setToast(`S${String(saved.week).padStart(2, "0")} · version ${saved.version} enregistrée en ligne.`);
    } catch (error) { setToast(error instanceof Error ? error.message : "Échec de la sauvegarde en ligne."); }
    finally { setSaving(false); }
  };
  const copyMail = async () => {
    try {
      if (navigator.clipboard && typeof ClipboardItem !== "undefined") {
        await navigator.clipboard.write([new ClipboardItem({ "text/html": new Blob([mailHtml], { type: "text/html" }), "text/plain": new Blob([`${data.mail.intro}\n\n${data.priority}`], { type: "text/plain" }) })]);
      } else {
        const holder = document.createElement("div"); holder.innerHTML = mailHtml; holder.contentEditable = "true"; holder.style.position = "fixed"; holder.style.left = "-9999px"; document.body.appendChild(holder);
        const selection = window.getSelection(); const range = document.createRange(); range.selectNodeContents(holder); selection?.removeAllRanges(); selection?.addRange(range);
        if (!document.execCommand("copy")) throw new Error("copy"); holder.remove(); selection?.removeAllRanges();
      }
      setToast("Corps du mail copié.");
    } catch { setToast("Copie bloquée : télécharge le fichier HTML."); }
  };

  const navItems: { id: Section; label: string; icon: string; count?: number }[] = [
    { id: "general", label: "Cadre du point", icon: "spark" }, { id: "dossiers", label: "Dossiers en cours", icon: "folder", count: data.dossiers.length },
    { id: "operations", label: "Opérations commerciales", icon: "trend", count: data.operations.length }, { id: "tariffs", label: "Évolutions tarifaires", icon: "trend", count: data.tariffs.length },
    { id: "jira", label: "Tickets Jira", icon: "ticket", count: data.jira.length }, { id: "versions", label: "Sauvegardes & versions", icon: "download", count: archive.length }, { id: "mail", label: "Paramètres du mail", icon: "mail" },
  ];

  const renderEditor = () => <div className="editor-layout"><aside className="editor-nav"><div className="editor-nav-title"><span>Sommaire</span><small>Complète ton point</small></div>{navItems.map((item) => <button key={item.id} className={section === item.id ? "active" : ""} onClick={() => setSection(item.id)}><Icon name={item.icon}/><span>{item.label}</span>{item.count !== undefined && <b>{item.count}</b>}<Icon name="chevron" size={15}/></button>)}<div className={`autosave-card ${isDirty ? "is-dirty" : ""}`}><span><Icon name={isDirty ? "edit" : "check"} size={14}/> {isDirty ? "Brouillon à enregistrer" : "Sauvegarde en ligne"}</span><small>{archiveLoading ? "Chargement du registre…" : activeVersion ? `Version ${activeVersion}${savedAt ? ` · ${savedAt.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}` : ""}` : "Aucune version enregistrée"}</small></div></aside><main className="editor-content">
    {section === "general" && <section className="editor-section"><SectionTitle eyebrow="01 · Cadre" title="Préparer le point" detail="Le nom, le marché, la date et la couleur pilotent le rendu web et le mail."/><div className="surface form-grid general-grid"><TextField label="Nom du point" value={data.pointName} onChange={(pointName) => setData((current) => ({ ...current, pointName }))} placeholder="Point marché"/><label className="field"><span>Marché</span><select value={marketId} onChange={(event) => chooseMarket(event.target.value)}>{markets.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><TextField label="Date du point" type="date" value={data.meetingDate} onChange={(meetingDate) => setData((current) => ({ ...current, meetingDate }))}/><div className="week-display"><span>Semaine ISO</span><strong>S{String(isoWeek(data.meetingDate)).padStart(2, "0")}</strong></div><div className="field field-wide theme-field"><span>Couleur du point</span><div className="theme-picker">{themes.map((option) => <button key={option.id} type="button" className={data.themeColor === option.id ? "active" : ""} style={{ "--swatch": option.accent } as CSSProperties} onClick={() => setData((current) => ({ ...current, themeColor: option.id }))}><i/><b>{option.label}</b></button>)}</div></div><label className="field field-wide"><span>Priorité de la semaine</span><textarea value={data.priority} onChange={(event) => setData((current) => ({ ...current, priority: event.target.value }))} placeholder="L’action principale ou le message clé à retenir…"/></label></div><div className="guidance-grid"><article><span>01</span><strong>Complète les rubriques</strong><p>Ajoute les dossiers et opérations commerciales, puis colle les tableaux extraits.</p></article><article><span>02</span><strong>Crée une version</strong><p>Chaque sauvegarde ajoute une version JSON en ligne pour la semaine choisie.</p></article><article><span>03</span><strong>Prépare le mail</strong><p>Contrôle l’aperçu puis copie le rendu Outlook prêt à l’emploi.</p></article></div></section>}

    {section === "dossiers" && <section className="editor-section"><SectionTitle eyebrow="02 · Suivi détaillé" title="Dossiers en cours" detail="La zone la plus détaillée du point : contexte, responsable, action et risque." action={<button className="primary-button" onClick={addDossier}><Icon name="plus"/> Ajouter un dossier</button>}/>{data.dossiers.length ? <div className="record-stack">{data.dossiers.map((item, index) => <article className="surface record-card" key={item.id}><div className="record-header"><span className="record-index">{String(index + 1).padStart(2, "0")}</span><div><strong>{item.title || "Nouveau dossier"}</strong><small>{item.status}</small></div><button className="icon-button danger" aria-label="Supprimer le dossier" onClick={() => setData((current) => ({ ...current, dossiers: current.dossiers.filter((row) => row.id !== item.id) }))}><Icon name="trash"/></button></div><div className="form-grid"><TextField label="Dossier" value={item.title} onChange={(title) => updateDossier(item.id, { title })} placeholder="Nom du dossier"/><TextField label="Univers" value={item.universe} onChange={(universe) => updateDossier(item.id, { universe })}/><TextField label="Référence" value={item.reference} onChange={(reference) => updateDossier(item.id, { reference })}/><SelectField label="Statut" value={item.status} onChange={(status) => updateDossier(item.id, { status })} options={statusOptions}/><TextField label="Responsable" value={item.owner} onChange={(owner) => updateDossier(item.id, { owner })}/><TextField label="Échéance" type="date" value={item.deadline} onChange={(deadline) => updateDossier(item.id, { deadline })}/><label className="field field-wide"><span>Prochaine action</span><textarea value={item.action} onChange={(event) => updateDossier(item.id, { action: event.target.value })}/></label><label className="field field-wide"><span>Commentaire / risque</span><textarea value={item.comment} onChange={(event) => updateDossier(item.id, { comment: event.target.value })}/></label><label className="field progress-field field-wide"><span><b>Avancement</b><strong>{item.progress}%</strong></span><input type="range" min="0" max="100" step="5" value={item.progress} onChange={(event) => updateDossier(item.id, { progress: Number(event.target.value) })}/></label></div></article>)}</div> : <EmptyState label="un dossier" onAdd={addDossier}/>}</section>}

    {section === "operations" && <section className="editor-section"><SectionTitle eyebrow="03 · Promo" title="Opérations commerciales" detail="Suis chaque opération commerciale (promo), son mois, son état global et ses étapes de traitement." action={<button className="primary-button" onClick={addOperation}><Icon name="plus"/> Ajouter une opération</button>}/>{data.operations.length ? <div className="record-stack">{data.operations.map((item, index) => <article className="surface record-card" key={item.id}><div className="record-header"><span className="record-index letter">{String.fromCharCode(65 + index)}</span><div><strong>{item.name || "Nouvelle opération commerciale"}</strong><small>{item.month || "Mois à définir"}</small></div><button className="icon-button danger" aria-label="Supprimer l’opération commerciale" onClick={() => setData((current) => ({ ...current, operations: current.operations.filter((row) => row.id !== item.id) }))}><Icon name="trash"/></button></div><div className="form-grid"><TextField label="Nom de l’opération commerciale" value={item.name} onChange={(name) => updateOperation(item.id, { name })}/><TextField label="Mois affiché" value={item.month} onChange={(month) => updateOperation(item.id, { month })} placeholder="Septembre 2026"/><TextField label="État global" value={item.state} onChange={(state) => updateOperation(item.id, { state })} wide/><TextField label="Résumé" value={item.summary} onChange={(summary) => updateOperation(item.id, { summary })} wide/><div className="steps-editor field-wide"><span>Étapes de traitement</span>{item.steps.map(([label, state], stepIndex) => <div className="step-editor" key={`${item.id}-${stepIndex}`}><input value={label} onChange={(event) => updateOperation(item.id, { steps: item.steps.map((step, i) => i === stepIndex ? [event.target.value, step[1]] as [string,string] : step) })}/><select value={state} onChange={(event) => updateOperation(item.id, { steps: item.steps.map((step, i) => i === stepIndex ? [step[0], event.target.value] as [string,string] : step) })}>{stepOptions.map((option) => <option key={option}>{option}</option>)}</select><button className="icon-button subtle" aria-label="Supprimer l’étape" onClick={() => updateOperation(item.id, { steps: item.steps.filter((_, i) => i !== stepIndex) })}><Icon name="trash" size={15}/></button></div>)}<button className="inline-add" onClick={() => updateOperation(item.id, { steps: [...item.steps, ["Nouvelle étape", "À faire"]] })}><Icon name="plus" size={15}/> Ajouter une étape</button></div></div></article>)}</div> : <EmptyState label="une opération commerciale" onAdd={addOperation}/>}</section>}

    {section === "tariffs" && <section className="editor-section"><SectionTitle eyebrow="04 · Extraction manuelle" title="Évolutions tarifaires" detail="Colle directement ton extraction ou complète les lignes à la main." action={<div className="title-actions"><PasteImporter kind="tariffs" onImport={(text) => importTable("tariffs", text)}/><button className="primary-button" onClick={addTariff}><Icon name="plus"/> Ajouter</button></div>}/><div className="surface data-table-wrap"><table className="data-table"><thead><tr><th>Code</th><th>Fournisseur</th><th>Mois</th><th>État</th><th>Réception trame</th><th>Responsable</th><th>Commentaire</th><th/></tr></thead><tbody>{data.tariffs.map((item) => <tr key={item.id}><td><input value={item.code} onChange={(e) => updateTariff(item.id, { code: e.target.value })}/></td><td><input value={item.supplier} onChange={(e) => updateTariff(item.id, { supplier: e.target.value })}/></td><td><input value={item.month} onChange={(e) => updateTariff(item.id, { month: e.target.value })}/></td><td><input value={item.state} onChange={(e) => updateTariff(item.id, { state: e.target.value })}/></td><td><input type="date" value={item.receptionDate} onChange={(e) => updateTariff(item.id, { receptionDate: e.target.value })}/></td><td><input value={item.owner} onChange={(e) => updateTariff(item.id, { owner: e.target.value })}/></td><td><input value={item.comment} onChange={(e) => updateTariff(item.id, { comment: e.target.value })}/></td><td><button className="icon-button subtle" aria-label="Supprimer" onClick={() => setData((current) => ({ ...current, tariffs: current.tariffs.filter((row) => row.id !== item.id) }))}><Icon name="trash" size={15}/></button></td></tr>)}</tbody></table>{!data.tariffs.length && <div className="table-empty">Aucune évolution tarifaire. Utilise « Coller un tableau » ou « Ajouter ».</div>}</div><div className="rule-note"><Icon name="alert"/><div><strong>Vigilances automatiques</strong><span>Du 8 au 14 : trame à sécuriser · après le 15 : KO sans trame · trame reçue depuis plus de 5 jours : traitement à contrôler.</span></div></div></section>}

    {section === "jira" && <section className="editor-section"><SectionTitle eyebrow="05 · Extraction manuelle" title="Tickets Jira" detail="Les tickets sans activité depuis plus de 10 jours remontent automatiquement en vigilance." action={<div className="title-actions"><PasteImporter kind="jira" onImport={(text) => importTable("jira", text)}/><button className="primary-button" onClick={addJira}><Icon name="plus"/> Ajouter</button></div>}/><div className="surface data-table-wrap"><table className="data-table"><thead><tr><th>Clé</th><th>Résumé</th><th>Statut</th><th>Priorité</th><th>Responsable</th><th>Dernière activité</th><th>Commentaire</th><th/></tr></thead><tbody>{data.jira.map((item) => <tr key={item.id}><td><input value={item.key} onChange={(e) => updateJira(item.id, { key: e.target.value })}/></td><td><input value={item.summary} onChange={(e) => updateJira(item.id, { summary: e.target.value })}/></td><td><input value={item.status} onChange={(e) => updateJira(item.id, { status: e.target.value })}/></td><td><input value={item.priority} onChange={(e) => updateJira(item.id, { priority: e.target.value })}/></td><td><input value={item.assignee} onChange={(e) => updateJira(item.id, { assignee: e.target.value })}/></td><td><input type="date" value={item.lastActivity} onChange={(e) => updateJira(item.id, { lastActivity: e.target.value })}/></td><td><input value={item.comment} onChange={(e) => updateJira(item.id, { comment: e.target.value })}/></td><td><button className="icon-button subtle" aria-label="Supprimer" onClick={() => setData((current) => ({ ...current, jira: current.jira.filter((row) => row.id !== item.id) }))}><Icon name="trash" size={15}/></button></td></tr>)}</tbody></table>{!data.jira.length && <div className="table-empty">Aucun ticket Jira. Colle l’extraction ou ajoute une ligne.</div>}</div></section>}

    {section === "versions" && <section className="editor-section"><SectionTitle eyebrow="06 · Registre en ligne" title="Sauvegardes & versions" detail="Chaque sauvegarde crée un document JSON durable pour le marché et la semaine du point." action={<button className="primary-button" disabled={saving || !ready} onClick={saveVersion}><Icon name="check"/> {saving ? "Enregistrement…" : "Créer une nouvelle version"}</button>}/><div className="surface version-summary"><div className="version-week"><span>Semaine active</span><strong>{currentWeekYear} · S{String(currentWeek).padStart(2, "0")}</strong><small>{currentWeekVersions.length ? `${currentWeekVersions.length} version${currentWeekVersions.length > 1 ? "s" : ""} déjà enregistrée${currentWeekVersions.length > 1 ? "s" : ""}` : "Aucune version enregistrée"}</small></div><div className="version-next"><span>Prochaine sauvegarde</span><strong>V{Math.max(0, ...currentWeekVersions.map((item) => item.version)) + 1}</strong><small>Une nouvelle version est ajoutée, sans écraser les précédentes.</small></div><div className="version-actions"><button className="secondary-button" onClick={() => fileInput.current?.click()}><Icon name="upload"/> Importer JSON</button><button className="secondary-button" onClick={() => exportJson()}><Icon name="download"/> Exporter le brouillon</button></div></div>{archiveError && <div className="archive-message error"><Icon name="alert"/><span>{archiveError}</span></div>}{archiveLoading ? <div className="archive-message"><span>Chargement du registre en ligne…</span></div> : archive.length ? <div className="archive-list">{archive.map((record) => <article className={`surface archive-row ${activeVersion === record.version && record.week === currentWeek && record.year === currentWeekYear && !isDirty ? "active" : ""}`} key={record.id}><div className="archive-version"><span>S{String(record.week).padStart(2, "0")}</span><strong>V{record.version}</strong><small>{record.year}</small></div><div className="archive-copy"><span>{record.pointName || "Point marché"}</span><strong>{dateLabel(record.meetingDate)}</strong><small>Enregistré le {new Date(record.createdAt.replace(" ", "T") + (record.createdAt.includes("Z") ? "" : "Z")).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}</small></div><div className="archive-actions"><button className="secondary-button" onClick={() => exportJson(record)}><Icon name="download"/> JSON</button><button className="primary-button" onClick={() => loadRecord(record)}><Icon name="upload"/> Charger</button></div></article>)}</div> : !archiveError && <div className="surface archive-empty"><Icon name="download" size={28}/><strong>Aucune version en ligne</strong><span>Crée la première version de ce marché. Les versions suivantes de la même semaine seront numérotées V2, V3, etc.</span></div>}</section>}

    {section === "mail" && <section className="editor-section"><SectionTitle eyebrow="07 · Diffusion" title="Paramètres du mail" detail="Ces valeurs sont intégrées à chaque version JSON et au rendu Outlook."/><div className="surface form-grid mail-settings"><TextField label="Destinataires" value={data.mail.to} onChange={(to) => setData((current) => ({ ...current, mail: { ...current.mail, to } }))} wide/><TextField label="Copie" value={data.mail.cc} onChange={(cc) => setData((current) => ({ ...current, mail: { ...current.mail, cc } }))} wide/><TextField label="Objet" value={data.mail.subject} onChange={(subject) => setData((current) => ({ ...current, mail: { ...current.mail, subject } }))} wide/><label className="field field-wide"><span>Introduction</span><textarea value={data.mail.intro} onChange={(event) => setData((current) => ({ ...current, mail: { ...current.mail, intro: event.target.value } }))}/></label></div><button className="primary-button mail-next" onClick={() => setView("mail")}><Icon name="mail"/> Vérifier le mail</button></section>}
  </main></div>;

  return <div className={`app-shell market-${market.tone}`} style={themeStyle}><div className="ambient ambient-a"/><div className="ambient ambient-b"/>
    <header className="app-header"><a className="brand" href="#top"><span className="brand-mark"><Icon name="spark" size={19}/></span><div><strong>Market Pulse</strong><small>{data.pointName || "Générateur de point marché"}</small></div></a><div className="market-switch"><span>Marché actif</span><select value={marketId} onChange={(event) => chooseMarket(event.target.value)}>{markets.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div><nav className="view-tabs" aria-label="Mode d’affichage"><button className={view === "edit" ? "active" : ""} onClick={() => setView("edit")}><Icon name="edit"/> Saisie</button><button className={view === "preview" ? "active" : ""} onClick={() => setView("preview")}><Icon name="eye"/> Aperçu</button><button className={view === "mail" ? "active" : ""} onClick={() => setView("mail")}><Icon name="mail"/> Mail</button></nav><div className="header-actions"><button className="icon-button" title="Importer un fichier JSON" onClick={() => fileInput.current?.click()}><Icon name="upload"/></button><input ref={fileInput} className="sr-only" type="file" accept="application/json" onChange={importJson}/><button className="icon-button" title="Exporter le point en JSON" onClick={() => exportJson()}><Icon name="download"/></button><button className="secondary-button new-point" onClick={resetPoint}>Nouveau point</button><button className="primary-button save-point" disabled={saving || !ready} onClick={saveVersion}><Icon name="check"/> {saving ? "Enregistrement…" : "Sauvegarder une version"}</button></div></header>
    <div id="top" className="top-strip"><span className="live-dot"/><strong>{market.short}</strong><i/>S{String(isoWeek(data.meetingDate)).padStart(2, "0")}<i/>{dateLabel(data.meetingDate)}<i/>{isDirty ? "Brouillon" : activeVersion ? `Version ${activeVersion}` : "Non enregistré"}<b>{alerts.length ? `${alerts.length} vigilance${alerts.length > 1 ? "s" : ""}` : "Aucune vigilance"}</b></div>
    {view === "edit" && renderEditor()}
    {view === "preview" && <main className="preview-page"><div className="preview-toolbar"><div><span>Aperçu web</span><strong>Le rendu se met à jour en direct.</strong></div><button className="secondary-button" onClick={() => setView("edit")}><Icon name="edit"/> Modifier les données</button></div><PreviewDashboard data={data} market={market}/></main>}
    {view === "mail" && <main className="mail-page"><div className="mail-toolbar"><div><span>Version Outlook</span><strong>Statique, responsive et sans script.</strong><small>{data.mail.to ? `À : ${data.mail.to}` : "Destinataires à compléter dans Paramètres du mail"}</small></div><div><button className="secondary-button" onClick={() => { setSection("mail"); setView("edit"); }}><Icon name="edit"/> Paramètres</button><button className="secondary-button" onClick={() => download(`point-marche-mail-${marketId}-${data.meetingDate}.html`, mailHtml, "text/html;charset=utf-8")}><Icon name="download"/> Télécharger HTML</button><button className="primary-button" onClick={copyMail}><Icon name="copy"/> Copier pour Outlook</button></div></div><div className="mail-frame-wrap"><iframe title="Aperçu du mail Outlook" srcDoc={mailHtml}/></div></main>}
    {toast && <div className="toast"><Icon name="check"/>{toast}</div>}
  </div>;
}
