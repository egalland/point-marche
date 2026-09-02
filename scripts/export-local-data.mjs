import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const origin = process.env.MARKET_PULSE_EXPORT_URL;
const username = process.env.MARKET_PULSE_EXPORT_USER;
const password = process.env.MARKET_PULSE_EXPORT_PASSWORD;
const destination = process.argv[2] && resolve(process.argv[2]);
if (!origin || !username || !password || !destination) throw new Error("URL, identifiants et dossier de destination requis.");
const root = new URL(origin);
if (root.protocol !== "https:") throw new Error("L’export en ligne exige HTTPS.");
const login = await fetch(new URL("/api/login", root), { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username, password }), redirect: "error", signal: AbortSignal.timeout(60000) });
if (!login.ok) throw new Error(`Connexion refusée (${login.status}). Aucun export effectué.`);
const cookie = login.headers.getSetCookie().map((value) => value.split(";")[0]).join("; ");
if (!cookie) throw new Error("Session absente.");

async function read(path) {
  const response = await fetch(new URL(path, root), { headers: { cookie }, redirect: "error", signal: AbortSignal.timeout(90000) });
  if (!response.ok) throw new Error(`Lecture impossible : ${path.split("?")[0]} (${response.status}).`);
  return response.json();
}

await mkdir(destination, { recursive: true });
const startedAt = new Date().toISOString();
const [marketResult, userResult, plannerResult, jiraResult] = await Promise.all([read("/api/markets"), read("/api/global-users"), read("/api/planner-tasks"), read("/api/jira-imports")]);
const points = [];
for (const market of marketResult.markets) {
  const payload = await read(`/api/points?marketId=${encodeURIComponent(market.id)}`);
  points.push(...payload.points);
}
const analystPoints = [];
for (const user of userResult.users.filter((person) => person.role === "analyste-tarif-referentiel")) {
  const payload = await read(`/api/analyst-points?analystId=${encodeURIComponent(user.id)}`);
  analystPoints.push(...payload.points);
}
const result = {
  startedAt, exportedAt: new Date().toISOString(), sourceUrl: root.origin,
  markets: marketResult.markets, users: userResult.users, points, analystPoints,
  plannerTasks: plannerResult.tasks, plannerUpdatedAt: plannerResult.updatedAt,
  jiraImports: jiraResult.batches, expectedJiraRegistry: jiraResult.registry,
};
await writeFile(resolve(destination, "application-data.json"), JSON.stringify(result), { encoding: "utf8", mode: 0o600 });
console.log(JSON.stringify({ markets: result.markets.length, users: result.users.length, points: points.length, analystPoints: analystPoints.length, plannerTasks: result.plannerTasks.length, jira: jiraResult.registry }));
