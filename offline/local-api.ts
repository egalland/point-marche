import {prepareJiraAnalytics,jiraAnalyticsDigest,JIRA_ANALYTICS_VERSION} from '../lib/jira-analytics-source';
import {JiraAnalyticsSession} from '../lib/jira-analytics-cache';
import {parseJiraStatsQuery} from "../lib/analyst-jira-stats";
import {marketJiraSummary} from "../lib/jira-point-activity";
import {builtinJobRoles,directoryPersonAt,validateAssignments,legacyAssignment,parseJobRole,type JobRole} from "../lib/directory-profiles";
import { jiraMarketKpis } from "../lib/jira-market-kpis";
import { selectMarketTickets } from "../lib/jira-market-scope";
import { localPURCHASES } from "./purchaseData-api";
import { guardLocalApi } from "./access-api";
import { validFeedbackRecipients, parseFeedbackRequest, feedbackSummary, updateFeedbackStatus, type FeedbackRequest } from "../lib/feedback";
import type { AppTransport } from "../lib/app-transport";
import { isGlobalRole, roleMailMode, roleUsesAutomaticJira, type GlobalDirectoryUser } from "../lib/global-directory";
import { canonicalJiraStatus, isAbandonedJiraStatus, isClosedJiraStatus, jiraSummaryFromDetailedTickets, type JiraDetailedTicket } from "../lib/jira-import";
import { jiraActivityForAnalyst } from "../lib/jira-analyst-activity";
import { jiraCompletionWeeks, validateJiraHistoryRange } from "../lib/analyst-jira-history";
import { isIsoDate, isoWeekRange, isoWeekForDate, isoWeekParts } from "../lib/iso-week";
import { parsePlannerTasks } from "../lib/planner-import";
import { recoverPlannerTasksFromPoints, mergePlannerTaskRegistry } from "../lib/planner-registry";
import type { JiraCsvTicket } from "../lib/jira-csv";
import type { AnalystPointData, AnalystPointRecord } from "../lib/analyst-point";
import type { LocalJiraBatch, LocalMarket, LocalPoint, WorkspaceData } from "./workspace-data";
import { WorkspaceStore } from "./workspace-store";

class LocalApiError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
const clean = (value: unknown, max = 180) => typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, max) : "";
const now = () => new Date().toISOString();
const id = () => crypto.randomUUID();
const json = (value: unknown, status = 200) => Response.json(value, { status });
const activeMarkets = (data: WorkspaceData) => data.markets.filter((market) => market.isActive !== false).sort((a, b) => a.position - b.position || a.name.localeCompare(b.name, "fr"));
const orderedUsers = (data: WorkspaceData) => [...data.users].sort((a, b) => a.name.localeCompare(b.name, "fr"));
const pointOrder = (a: { year: number; week: number }, b: { year: number; week: number }) => b.year - a.year || b.week - a.week;

function requirePeriod(year: number, week: number) {
  if (!Number.isInteger(year) || year < 2020 || year > 2200 || !Number.isInteger(week) || week < 1 || week > 53) throw new LocalApiError("Semaine ISO invalide.");
}

function plannerRegistry(data: WorkspaceData) {
  const tags = Object.fromEntries(data.markets.map((market) => [market.id, market.plannerTags]));
  const recovered = recoverPlannerTasksFromPoints(data.points.map((point) => ({ marketId: point.marketId, payload: point.data })), tags);
  return mergePlannerTaskRegistry(data.plannerTasks, recovered);
}

function marketInput(body: Record<string, unknown>) {
  const name = clean(body.name, 80);
  if (!name) throw new LocalApiError("Le nom du marché est requis.");
  const warning = Number(body.jiraWarningDays);
  const critical = Number(body.jiraCriticalDays);
  const jiraWarningDays = Number.isInteger(warning) && warning >= 1 && warning <= 364 ? warning : 10;
  const jiraCriticalDays = Math.min(365, Math.max(jiraWarningDays + 1, Number.isInteger(critical) && critical >= 1 && critical <= 365 ? critical : 20));
  const tags = Array.isArray(body.plannerTags) ? body.plannerTags : typeof body.plannerTags === "string" ? body.plannerTags.split(/[;,\n]/) : [];
  return {
    name, shortCode: (clean(body.shortCode) || name).toLocaleUpperCase("fr-FR").replace(/\s+/g, "–").slice(0, 12),
    tone: ["mint", "violet", "aqua", "peach", "red"].includes(String(body.tone)) ? String(body.tone) : "mint",
    colorHex: /^#[0-9a-f]{6}$/i.test(String(body.colorHex)) ? String(body.colorHex).toUpperCase() : "",
    plannerTags: Array.from(new Set(tags.map((tag) => clean(tag, 40).toUpperCase()).filter(Boolean))).slice(0, 20),
    jiraWarningDays, jiraCriticalDays, updatedAt: now(),
  };
}

function personInput(body: Record<string, unknown>, data: WorkspaceData, currentId = ""): GlobalDirectoryUser {
  const name = clean(body.name, 100);
  const email = clean(body.email).toLowerCase();
  const usercode = clean(body.usercode).toUpperCase();
  const role = isGlobalRole(String(body.role)) ? String(body.role) as GlobalDirectoryUser["role"] : "autre";
  const requested = body.marketId ? [body.marketId] : Array.isArray(body.marketIds) ? body.marketIds : [];
  const knownMarkets = new Set(activeMarkets(data).map((market) => market.id));
  const marketIds = [...new Set(requested.map((value) => clean(value)).filter((value) => knownMarkets.has(value)))];
  const old=data.users.find(p=>p.id===currentId);
  if(old?.assignments&&!body.assignments)throw new LocalApiError("Recharge la fiche pour conserver son historique.");
  if(old?.profileRevision!==body.profileRevision)throw new LocalApiError("Cette fiche a changé. Recharge-la.",409);
  const roles=[...builtinJobRoles,...Object.entries(data.preferences).filter(([k])=>k.startsWith("job-role:")).map(([,v])=>JSON.parse(v) as JobRole)];
  const assignments=validateAssignments(body.assignments??[legacyAssignment({role,marketIds})],roles,[...knownMarkets]);
  if(old?.assignments?.some(a=>!assignments.some(n=>n.id===a.id)))throw new LocalApiError("Les anciennes périodes doivent être conservées.");
  if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new LocalApiError("Nom et adresse e-mail valide requis.");
  if ((usercode || assignments.some(a=>roleUsesAutomaticJira(a.role)||a.role==="vente")) && !/^[A-Z]\d{7}$/.test(usercode)) throw new LocalApiError("Le USERCODE doit contenir une lettre suivie de 7 chiffres.");
  if (role !== "manager-tarif" && roleMailMode(role) === "to" && !marketIds.length) throw new LocalApiError("Sélectionne le marché de cette personne.");
  if (data.users.some((person) => person.id !== currentId && person.email.toLowerCase() === email)) throw new LocalApiError("Cette adresse e-mail existe déjà dans l’annuaire.", 409);
  if (usercode && data.users.some((person) => person.id !== currentId && person.usercode.toUpperCase() === usercode)) throw new LocalApiError("Ce USERCODE existe déjà dans l’annuaire.", 409);
  if (role === "manager-tarif" && data.users.some((person) => person.id !== currentId && person.role === role)) throw new LocalApiError("Un manager Tarif est déjà renseigné.", 409);
  return directoryPersonAt({ id: currentId || id(), name, email, usercode, plannerAlias: clean(body.plannerAlias, 80), role, marketIds,assignments,profileRevision:id() });
}

function cleanTicket(value: unknown): JiraCsvTicket {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new LocalApiError("Ticket invalide.");
  const ticket = value as JiraCsvTicket;
  if (!/^[A-Z][A-Z0-9]+-\d+$/.test(ticket.key) || typeof ticket.summary !== "string" || typeof ticket.status !== "string") throw new LocalApiError("Ticket invalide.");
  for (const date of [ticket.createdAt, ticket.updatedAt, ticket.resolutionAt]) {
    if (date && (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(date) || !isIsoDate(date.slice(0, 10)))) throw new LocalApiError("Date Jira invalide.");
  }
  const participants = Array.isArray(ticket.participants) ? ticket.participants : [];
  if (!participants.every((person) => typeof person.usercode === "string" && /^[A-Z]\d{7}$/i.test(person.usercode))) throw new LocalApiError("Participant Jira invalide.");
  return {
    key: ticket.key, internalId: clean(ticket.internalId, 60), status: canonicalJiraStatus(ticket.status),
    summary: ticket.summary.slice(0, 4000), createdAt: ticket.createdAt || "", updatedAt: ticket.updatedAt || "", resolutionAt: ticket.resolutionAt || "",
    assigneeUserCode: /^[A-Z]\d{7}$/i.test(ticket.assigneeUserCode) ? ticket.assigneeUserCode.toUpperCase() : "",
    participants: Array.from(new Map(participants.map((person) => [person.usercode.toUpperCase(), { usercode: person.usercode.toUpperCase(), jiraUserId: clean(person.jiraUserId, 80) }])).values()),
    link: /^https?:\/\//i.test(ticket.link) ? ticket.link : `https://jira.example.example.net/browse/${ticket.key}`,
  };
}

function analystTicket(ticket: JiraDetailedTicket) {
  return { id: `${ticket.key}:${ticket.updatedAt}`, key: ticket.key, internalId: ticket.internalId, summary: ticket.summary, status: ticket.status, createdAt: ticket.createdAt, updatedAt: ticket.updatedAt, link: ticket.link };
}

export function createLocalApi(store: WorkspaceStore): AppTransport { return guardLocalApi(store, createUnguardedLocalApi(store)); }

function createUnguardedLocalApi(store: WorkspaceStore): AppTransport {
  const staging = new Map<string, Map<string, JiraCsvTicket>>();
  const jiraAnalytics = new JiraAnalyticsSession();
  let analyticsTickets:WorkspaceData['jiraTickets']|undefined;
  async function prepareLocalAnalytics(refresh=false){
    const current=store.read();if(!refresh&&analyticsTickets===current.jiraTickets)return;
    const sourceHash=await jiraAnalyticsDigest(current.jiraTickets),saved=current.jiraAnalytics;
    const reusable=!refresh&&saved?.version===JIRA_ANALYTICS_VERSION&&saved.sourceHash===sourceHash&&saved.facts&&typeof saved.facts==='object'&&current.jiraTickets.every(t=>{const f=saved.facts[t.key];return !f||typeof f.closed==='boolean'&&(f.delay===null||Number.isSafeInteger(f.delay)&&f.delay>=0)&&typeof f.activity==='string'&&typeof f.fallback==='boolean'&&typeof f.specialty==='string'&&f.stock&&typeof f.stock.created==='string'&&typeof f.stock.resolved==='string'&&typeof f.stock.issue==='string'&&typeof f.stock.afterIssue==='string'&&typeof f.stock.closed==='boolean';});
    let prepared;
    if(reusable){const tickets=current.jiraTickets.filter(t=>!isAbandonedJiraStatus(t.status));prepared=tickets.every(t=>saved.facts[t.key])?{tickets,facts:saved.facts}:prepareJiraAnalytics(current.jiraTickets);}
    else prepared=prepareJiraAnalytics(current.jiraTickets);
    jiraAnalytics.prime(current.jiraTickets,prepared);analyticsTickets=current.jiraTickets;
    if(!reusable)store.update(data=>({...data,jiraAnalytics:{version:JIRA_ANALYTICS_VERSION,sourceHash,facts:prepared.facts}}));
  }
  return async (input, init) => {
    try {
      if (init?.signal?.aborted) throw new DOMException("Requête annulée", "AbortError");
      const url = new URL(input instanceof Request ? input.url : String(input), "https://local.market-pulse.invalid");
      if (url.origin !== "https://local.market-pulse.invalid") throw new LocalApiError("Le mode local ne communique pas avec un serveur.", 403);
      const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
      if (url.pathname === "/api/purchaseData") {
        try { return await localPURCHASES(new Request(input instanceof Request ? input : url, init), store); }
        catch (error) { throw new LocalApiError(error instanceof Error ? error.message : "Import PURCHASES impossible."); }
      }
      const body = init?.body ? JSON.parse(String(init.body)) as Record<string, unknown> : {};
      const data = store.read();
      const path = url.pathname;
      if (["/api/session", "/api/login", "/api/logout"].includes(path)) return json({ user: { username: "GLOBAL", displayName: "GLOBAL" }, local: true });

      if (path === "/api/feedback") {
        const inbox = JSON.parse(data.preferences.feedbackInbox || "[]") as FeedbackRequest[];
        if (method === "GET") {
          const selected = url.searchParams.get("id");
          if (selected) { const item = inbox.find(item => item.id === selected); return item ? json({ item }) : json({ error: "Demande introuvable." }, 404); }
          return json({ items: inbox.map(feedbackSummary).reverse() });
        }
        if (method === "PATCH") {
          const previous = inbox.find(item => item.id === body.id);
          if (!previous) return json({ error: "Demande introuvable." }, 404);
          if (body.expectedUpdatedAt !== previous.updatedAt) return json({ error: "Cette demande a été modifiée. Actualise avant de réessayer." }, 409);
          const item = updateFeedbackStatus(previous, body.status, new Headers(init?.headers??(input instanceof Request?input.headers:undefined)).get("X-Market-USERCODE")||body.by, body.expectedUpdatedAt);
          store.update(current => {
            const currentInbox = JSON.parse(current.preferences.feedbackInbox || "[]") as FeedbackRequest[];
            return { ...current, preferences: { ...current.preferences, feedbackInbox: JSON.stringify(currentInbox.map(entry => entry.id === item.id ? item : entry)) } };
          });
          return json({ item });
        }
        if (method === "POST") {
          const item = parseFeedbackRequest({...body,reporterUserCode:new Headers(init?.headers??(input instanceof Request?input.headers:undefined)).get("X-Market-USERCODE")||body.reporterUserCode});
          const existing = inbox.find(entry => entry.id === item.id);
          if (existing) return json({ item: feedbackSummary(existing) });
          store.update(current => {
            const currentInbox = JSON.parse(current.preferences.feedbackInbox || "[]") as FeedbackRequest[];
            return { ...current, preferences: { ...current.preferences, feedbackInbox: JSON.stringify([...currentInbox.filter(entry => entry.id !== item.id), item]) } };
          });
          return json({ item: feedbackSummary(item) }, 201);
        }
      }
      if (path === "/api/feedback-settings") {
        if (method === "GET") return json({ email: data.preferences.feedbackEmail ?? "" });
        if (method === "PUT") {
          const email = typeof body.email === "string" ? body.email.trim() : "";
          if (typeof body.email !== "string" || (email && !validFeedbackRecipients(email))) throw new LocalApiError("Adresse mail invalide.");
          store.update(current => ({ ...current, preferences: { ...current.preferences, feedbackEmail: email } }));
          return json({ email });
        }
      }
      if (path === "/api/markets") {
        if (method === "GET") return json({ markets: activeMarkets(data) });
        if (method === "POST" || method === "PATCH") {
          const values = marketInput(body);
          const existing = method === "PATCH" ? data.markets.find((market) => market.id === body.id && market.isActive !== false) : data.markets.find((market) => market.name === values.name && market.isActive === false);
          if (method === "PATCH" && !existing) throw new LocalApiError("Marché introuvable.", 404);
          if (data.markets.some((market) => market.id !== existing?.id && market.name === values.name && market.isActive !== false)) throw new LocalApiError("Un marché porte déjà ce nom.", 409);
          const market: LocalMarket = { id: existing?.id ?? `market-${id()}`, position: existing?.position ?? Math.max(-1, ...data.markets.map((item) => item.position)) + 1, createdAt: existing?.createdAt ?? now(), ...values, isActive: true };
          store.update((current) => ({ ...current, markets: [...current.markets.filter((item) => item.id !== market.id), market] }));
          return json({ market }, method === "POST" ? 201 : 200);
        }
        if (method === "DELETE") {
          const marketId = url.searchParams.get("id");
          if (!activeMarkets(data).some((market) => market.id === marketId)) throw new LocalApiError("Marché introuvable.", 404);
          if (activeMarkets(data).length < 2) throw new LocalApiError("Il faut conserver au moins un marché actif.", 409);
          store.update((current) => ({ ...current, markets: current.markets.map((market) => market.id === marketId ? { ...market, isActive: false, updatedAt: now() } : market) }));
          return json({ removedId: marketId });
        }
      }

      if(path==="/api/directory-roles"){
        const roles=[...builtinJobRoles,...Object.entries(data.preferences).filter(([k])=>k.startsWith("job-role:")).map(([,v])=>JSON.parse(v) as JobRole)];
        if(method==="GET")return json({roles});
        if(method==="POST"){const role=parseJobRole(body);if(roles.some(r=>r.label.toLowerCase()===role.label.toLowerCase()))throw new LocalApiError("Ce rôle existe déjà.",409);store.writePreference(`job-role:${role.id}`,JSON.stringify(role));return json({role,roles:[...roles,role]},201);}
      }
      if (path === "/api/global-users") {
        if (method === "GET") { const date=url.searchParams.get("date")||undefined; if(date&&!isIsoDate(date))throw new LocalApiError("Date invalide."); return json({ users: orderedUsers(data).map(u=>directoryPersonAt(u,date)) }); }
        if (method === "POST" || method === "PATCH") {
          const currentId = method === "PATCH" ? clean(body.id, 80) : "";
          if (method === "PATCH" && !data.users.some((person) => person.id === currentId)) throw new LocalApiError("Utilisateur introuvable.", 404);
          const user = personInput(body, data, currentId);
          store.update((current) => ({ ...current, users: [...current.users.filter((person) => person.id !== user.id), user] }));
          return json({ user, users: orderedUsers(store.read()) }, method === "POST" ? 201 : 200);
        }
        if (method === "DELETE") {
          const userId = url.searchParams.get("id");
          if (!data.users.some((person) => person.id === userId)) throw new LocalApiError("Utilisateur introuvable.", 404);
          store.update((current) => ({ ...current, users: current.users.filter((person) => person.id !== userId) }));
          return json({ removedId: userId, users: orderedUsers(store.read()) });
        }
      }

      if (path === "/api/points") {
        const marketId = method === "GET" ? url.searchParams.get("marketId") ?? "" : clean(body.marketId, 100);
        const market = data.markets.find((item) => item.id === marketId);
        if (!market) throw new LocalApiError("Marché introuvable.", 404);
        if (method === "GET") {
          return json({ points: data.points.filter((point) => point.marketId === marketId).sort(pointOrder) });
        }
        if (method === "POST") {
          const payload = body.data as Record<string, unknown>;
          if (!payload || !isIsoDate(String(payload.meetingDate))) throw new LocalApiError("Date complète et contenu du point requis.");
          const meetingDate = String(payload.meetingDate);
          const period = isoWeekParts(meetingDate);
          const existing = data.points.find((point) => point.marketId === marketId && point.year === period.year && point.week === period.week);
          const point: LocalPoint = { id: existing?.id ?? id(), marketId, ...period, meetingDate, pointName: market.name, themeColor: clean(payload.themeColor) || "mint", data: structuredClone(payload), createdAt: now() };
          store.update((current) => ({ ...current, points: [...current.points.filter((item) => item.id !== point.id), point] }));
          return json({ point }, existing ? 200 : 201);
        }
      }

      if (path === "/api/analyst-points") {
        const analystId = method === "GET" ? url.searchParams.get("analystId") ?? "" : clean(body.analystId, 100);
        if (!data.users.some((person) => person.id === analystId && (person.role === "analyste-tarif-referentiel"||Boolean(person.assignments?.some(a=>a.role==="analyste-tarif-referentiel"))))) throw new LocalApiError("Analyste introuvable.", 404);
        if (method === "GET") return json({ points: data.analystPoints.filter((point) => point.analystId === analystId).sort(pointOrder) });
        if (method === "POST") {
          const payload = body.data as AnalystPointData;
          if (!payload || ![payload.meetingDate, payload.periodFrom, payload.periodTo].every(isIsoDate) || payload.periodFrom > payload.periodTo) throw new LocalApiError("Choisis des dates complètes et une période valide.");
          const period = isoWeekParts(payload.meetingDate);
          const existing = data.analystPoints.find((point) => point.analystId === analystId && point.year === period.year && point.week === period.week);
          const point: AnalystPointRecord = { id: existing?.id ?? id(), revision: id(), analystId, ...period, meetingDate: payload.meetingDate, periodFrom: payload.periodFrom, periodTo: payload.periodTo, data: structuredClone(payload), createdAt: existing?.createdAt ?? now(), updatedAt: now() };
          store.update((current) => ({ ...current, analystPoints: [...current.analystPoints.filter((item) => item.id !== point.id), point] }));
          return json({ point }, 201);
        }
      }

      if (path === "/api/planner-tasks") {
        if (method === "GET") { const registry = plannerRegistry(data); return json({ tasks: registry.tasks, registry: registry.summary, updatedAt: data.plannerUpdatedAt }); }
        if (method === "POST") {
          const rawText = typeof body.rawText === "string" ? body.rawText.trim() : "";
          if (!rawText) throw new LocalApiError("Colle d’abord l’export Planner.");
          if (rawText.length > 20_000_000) throw new LocalApiError("L’export Planner dépasse 20 Mo.", 413);
          const parsed = parsePlannerTasks(rawText);
          if (!parsed.tasks.length) throw new LocalApiError("Le tableau Planner n’a pas été reconnu.");
          const tasks = new Map(data.plannerTasks.map((task) => [task.externalId, task]));
          const updatedAt = now();
          parsed.tasks.forEach((task) => tasks.set(task.externalId, { ...task, importedAt: updatedAt }));
          store.update((current) => ({ ...current, plannerTasks: Array.from(tasks.values()), plannerUpdatedAt: updatedAt }));
          return json({ tasks: parsed.tasks, imported: parsed.tasks.length, ignoredRows: parsed.ignoredRows, updatedAt }, 201);
        }
      }

      if (path === "/api/jira-imports") {
        if (method === "GET") return json({ batches: [...data.jiraImports].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 12), registry: { ticketCount: data.jiraTickets.length, participantCount: data.jiraTickets.reduce((sum, ticket) => sum + ticket.participants.length, 0) } });
        if (method === "POST") {
          if (body.action === "start") {
            const batch: LocalJiraBatch = { id: id(), filename: clean(body.filename, 240), sourceProfile: "jira-participants", status: "uploading", rowCount: Math.max(0, Number(body.rowCount) || 0), ticketCount: 0, participantCount: 0, rejectedCount: 0, repairedTextCount: 0, unknownUserCodeCount: 0, createdAt: now(), completedAt: null };
            staging.set(batch.id, new Map());
            store.update((current) => ({ ...current, jiraImports: [...current.jiraImports, batch] }));
            return json({ batch, maxChunkSize: 250 }, 201);
          }
          const importId = clean(body.importId, 100);
          const tickets = staging.get(importId);
          if (!tickets) throw new LocalApiError("Session d’import introuvable ou déjà terminée.", 409);
          if (body.action === "chunk") {
            if (!Array.isArray(body.tickets) || !body.tickets.length || body.tickets.length > 250) throw new LocalApiError("Lot Jira invalide.");
            const chunk = body.tickets.map(cleanTicket);
            chunk.forEach((ticket) => tickets.set(ticket.key, ticket));
            return json({ accepted: chunk.length });
          }
          if (body.action === "finish") {
            const integrityError = jiraImportCountError({ tickets: body.expectedTicketCount, participants: body.expectedParticipantCount }, { tickets: tickets.size, participants: Array.from(tickets.values()).reduce((sum, ticket) => sum + ticket.participants.length, 0) });
            if (integrityError) throw new LocalApiError(integrityError, 409);
            const registry = new Map(data.jiraTickets.map((ticket) => [ticket.key, ticket]));
            tickets.forEach((ticket, key) => registry.set(key, ticket));
            const updatedAt = now();
            const changes = { status: "completed", completedAt: updatedAt, ticketCount: tickets.size, participantCount: Array.from(tickets.values()).reduce((sum, ticket) => sum + ticket.participants.length, 0), rejectedCount: Math.max(0, Number(body.rejectedCount) || 0), repairedTextCount: Math.max(0, Number(body.repairedTextCount) || 0), unknownUserCodeCount: Math.max(0, Number(body.unknownUserCodeCount) || 0) };
            store.update((current) => ({ ...current, jiraTickets: Array.from(registry.values()), jiraUpdatedAt: updatedAt, jiraImports: current.jiraImports.map((batch) => batch.id === importId ? { ...batch, ...changes } : batch) }));
            await prepareLocalAnalytics();
            staging.delete(importId);
            return json({ batch: store.read().jiraImports.find((batch) => batch.id === importId) });
          }
          if (body.action === "fail") {
            staging.delete(importId);
            store.update((current) => ({ ...current, jiraImports: current.jiraImports.map((batch) => batch.id === importId ? { ...batch, status: "failed", completedAt: now() } : batch) }));
            return json({ failed: true });
          }
          throw new LocalApiError("Action d’import inconnue.");
        }
      }

      if (path === "/api/jira-week" && method === "GET") {
        const marketId = url.searchParams.get("marketId") ?? "";
        const year = Number(url.searchParams.get("year")); const week = Number(url.searchParams.get("week"));
        requirePeriod(year, week);
        const people = data.users.map(u=>directoryPersonAt(u,isIsoDate(url.searchParams.get("date")??"")?url.searchParams.get("date")!:isoWeekRange(year,week).to));
        const assignments: Record<string, string[]> = {};
        people.forEach((person) => person.marketIds.forEach((market) => { (assignments[market] ??= []).push(person.usercode); }));
        if (!data.jiraUpdatedAt && !data.jiraTickets.length) return json({ snapshot: null, assignments });
        await prepareLocalAnalytics();
        const reference=isIsoDate(url.searchParams.get("date")??"")?url.searchParams.get("date")!:isoWeekRange(year,week).to;
        const summary=jiraAnalytics.marketSummary(data.jiraTickets,data.users,activeMarkets(data),marketId,reference)??marketJiraSummary([],reference);
        return json({ snapshot: { year, week, rawText: "", summary, updatedAt: data.jiraUpdatedAt, source: "central" }, assignments });
      }

      if((path === "/api/analyst-activity" || path === "/api/jira-activity") && method === "GET"){ const q=parseJiraStatsQuery(url); await prepareLocalAnalytics(url.searchParams.get('refresh')==='1'); if(path === "/api/jira-activity")q.scope="registry"; return json({report:jiraAnalytics.report(data.jiraTickets,data.users,activeMarkets(data),q),updatedAt:data.jiraUpdatedAt,hasSource:!!data.jiraUpdatedAt||data.jiraTickets.length>0}); }
      if (path === "/api/analyst-jira" && method === "GET") {
        const analystId = url.searchParams.get("analystId") ?? "";
        const person = data.users.find((user) => user.id === analystId && (user.role === "analyste-tarif-referentiel"||Boolean(user.assignments?.some(a=>a.role==="analyste-tarif-referentiel"))));
        if (!person) throw new LocalApiError("Analyste introuvable.", 404);
        const tickets = store.jiraForPerson(person.usercode);
        if (url.searchParams.get("view") === "history") {
          const range = { from: url.searchParams.get("from") ?? "", to: url.searchParams.get("to") ?? "" };
          const error = validateJiraHistoryRange(range);
          if (error) throw new LocalApiError(error);
          if (!/^[A-Z]\d{7}$/i.test(person.usercode)) throw new LocalApiError("Renseigne un USERCODE Jira valide pour cet analyste.", 409);
          if (!data.jiraUpdatedAt && !data.jiraTickets.length) return json({ history: null });
          const weeks = jiraCompletionWeeks(range);
          const byMonday = new Map(weeks.map((week) => [week.from, week]));
          tickets.forEach((ticket) => {
            if (!isClosedJiraStatus(ticket.status) || isAbandonedJiraStatus(ticket.status) || !isIsoDate(ticket.updatedAt.slice(0, 10))) return;
            const week = byMonday.get(isoWeekForDate(ticket.updatedAt.slice(0, 10)).from);
            if (week) week.count += 1;
          });
          return json({ history: { from: weeks[0].from, to: weeks[weeks.length - 1].to, weeks, analystId, updatedAt: data.jiraUpdatedAt } });
        }
        const year = Number(url.searchParams.get("year")); const week = Number(url.searchParams.get("week"));
        requirePeriod(year, week);
        if (!data.jiraUpdatedAt && !data.jiraTickets.length) return json({ snapshot: null });
        const activity = jiraActivityForAnalyst(tickets, person.usercode, year, week);
        return json({ snapshot: { analystId, year, week, rawText: "", tickets: activity.open.map(analystTicket), resolvedTickets: activity.resolved.map(analystTicket), updatedAt: data.jiraUpdatedAt, source: "central" } });
      }
      throw new LocalApiError("Cette action n’est pas disponible dans la version locale.", 404);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") throw error;
      return json({ error: error instanceof Error ? error.message : "Action locale impossible." }, error instanceof LocalApiError ? error.status : 500);
    }
  };
}
import { jiraImportCountError } from "../lib/jira-import-integrity";
