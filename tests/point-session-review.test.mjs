import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { build } from "esbuild";
import { setImmediate } from "node:timers/promises";

const require = createRequire(import.meta.url);
const sourcefile = resolve("features/market-pulse/market-pulse-app.tsx");
const bundled = await build({
  stdin: { contents: await readFile(sourcefile, "utf8") + '\nexport { MarketPulseWorkspace, AnalystPointDashboard, initialData, defaultMarkets };\nexport { initialAnalystPoint } from "@/lib/analyst-point";\nexport { clearSessionDrafts, readLocalDraft, hasUnsavedSessionDrafts } from "@/lib/app-transport";', sourcefile, resolveDir: resolve("features/market-pulse"), loader: "tsx" },
  tsconfig: resolve("tsconfig.json"), bundle: true, packages: "external", format: "cjs", platform: "node", write: false, logLevel: "silent",
});
const exportsHolder = { exports: {} };
let hooks;
const react = require("react");
const reactStub = {
  ...react,
  useState(initial) { const index = hooks.cursor++; if (!(index in hooks.slots)) hooks.slots[index] = typeof initial === "function" ? initial() : initial; return [hooks.slots[index], (next) => { hooks.slots[index] = typeof next === "function" ? next(hooks.slots[index]) : next; }]; },
  useRef(initial) { const index = hooks.cursor++; return hooks.slots[index] ??= { current: initial }; },
  useMemo(callback, deps) { const index = hooks.cursor++; const previous = hooks.slots[index]; if (!previous || deps.some((dep, i) => !Object.is(dep, previous.deps[i]))) hooks.slots[index] = { deps, value: callback() }; return hooks.slots[index].value; },
  useCallback(callback, deps) { return reactStub.useMemo(() => callback, deps); },
  useEffect(effect, deps) { const index = hooks.cursor++; const previous = hooks.slots[index]; if (!previous || !deps || deps.some((dep, i) => !Object.is(dep, previous.deps?.[i]))) { hooks.slots[index] = { deps, cleanup: previous?.cleanup }; hooks.effects.push(() => { previous?.cleanup?.(); hooks.slots[index].cleanup = effect(); }); } },
};
new Function("require", "module", "exports", bundled.outputFiles[0].text)((id) => id === "react" ? reactStub : require(id), exportsHolder, exportsHolder.exports);
const app = exportsHolder.exports;
const originalFetch = globalThis.fetch;
const originalWindow = globalThis.window;
let timers, tree, records, post, failedMarket, renderComponent;
const deferred = () => { let resolve; const promise = new Promise((done) => { resolve = done; }); return { promise, resolve }; };
const response = (body, status = 200) => new Response(JSON.stringify(body), { status });
function nodes(value) { if (Array.isArray(value)) return value.flatMap(nodes); if (!value || typeof value !== "object") return []; return [value, ...nodes(value.props?.children)]; }
function find(predicate) { const found = nodes(tree).find(predicate); assert.ok(found, "Expected control is available"); return found; }
const preview = () => find((node) => node.type?.name === "PreviewDashboard").props;
const navigation = () => find((node) => node.type?.name === "WorkspaceNavigation").props;
const saveButton = () => find((node) => node.type === "button" && node.props.className?.includes("save-point")).props;
function render() { hooks.cursor = 0; tree = renderComponent(); const effects = hooks.effects.splice(0); effects.forEach((effect) => effect()); return tree; }
async function settle() { for (let i = 0; i < 5; i++) { render(); const pending = [...timers]; timers.clear(); pending.forEach(([, callback]) => callback()); await setImmediate(); } render(); }

function pointRecord(marketId, date = "2026-09-03", priority = "Priorité enregistrée") {
  const data = { ...app.initialData(marketId), meetingDate: date, priority, jiraMode: "manual", plannerMode: "manual" };
  return { id: `${marketId}:36`, marketId, year: 2026, week: 36, meetingDate: date, createdAt: "2026-09-03T10:00:00Z", data };
}

test.beforeEach(async () => {
  app.clearSessionDrafts(); renderComponent = app.MarketPulseWorkspace; hooks = { slots: [], effects: [], cursor: 0 }; timers = new Map(); let timerId = 0; post = null; failedMarket = "";
  records = new Map(app.defaultMarkets.map((market) => [market.id, [pointRecord(market.id)]]));
  globalThis.window = { location: { search: "" }, scrollTo() {}, addEventListener() {}, removeEventListener() {}, setTimeout(callback, delay) { const id = ++timerId; if (!delay) timers.set(id, callback); return id; }, clearTimeout(id) { timers.delete(id); } };
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input), "https://test.invalid");
    if (url.pathname === "/api/session") return response({ user: { displayName: "GLOBAL", username: "test" } });
    if (url.pathname === "/api/markets") return response({ markets: app.defaultMarkets.map((market) => ({ ...market, shortCode: market.short })) });
    if (url.pathname === "/api/global-users") return response({ users: [] });
    if (url.pathname === "/api/planner-tasks") return response({ tasks: [] });
    if (url.pathname === "/api/points" && init?.method === "POST") { post = { body: JSON.parse(init.body), deferred: deferred() }; return post.deferred.promise; }
    if (url.pathname === "/api/points") { const id = url.searchParams.get("marketId"); return id === failedMarket ? response({ error: "Connexion interrompue" }, 503) : response({ points: records.get(id) ?? [] }); }
    if (url.pathname === "/api/analyst-points" && init?.method === "POST") { post = { body: JSON.parse(init.body), deferred: deferred() }; return post.deferred.promise; }
    if (url.pathname === "/api/analyst-points") return response({ points: [] });
    if (url.pathname === "/api/analyst-jira") return response({ snapshot: null, history: null });
    if (url.pathname === "/api/jira-week") return response({ snapshot: null, assignments: {} });
    throw new Error(`Unexpected request ${url.pathname}`);
  };
  await settle();
});
test.afterEach(() => { hooks.slots.forEach((slot) => slot?.cleanup?.()); globalThis.fetch = originalFetch; globalThis.window = originalWindow; app.clearSessionDrafts(); });

async function resolveSave() {
  assert.ok(post);
  const saved = { ...pointRecord(post.body.marketId), data: post.body.data };
  records.set(post.body.marketId, [saved]);
  post.deferred.resolve(response({ point: saved }));
  await settle();
}

test("a late save preserves newer text and leaves it unsaved", async () => {
  preview().actions.updatePriority("Version envoyée"); await settle();
  const pendingSave = saveButton().onClick();
  preview().actions.updatePriority("Texte ajouté pendant la sauvegarde"); await settle();
  await resolveSave(); await pendingSave;
  assert.equal(preview().data.priority, "Texte ajouté pendant la sauvegarde");
  assert.equal(app.readLocalDraft("market", post.body.marketId).data.priority, "Texte ajouté pendant la sauvegarde");
  assert.equal(app.hasUnsavedSessionDrafts(), true);
  assert.match(saveButton().className, /has-changes/);
});

test("changing markets during a save never applies the old point to the new market", async () => {
  preview().actions.updatePriority("Modification marché A"); await settle();
  const pendingSave = saveButton().onClick();
  const next = app.defaultMarkets.find((market) => market.id !== post.body.marketId);
  const select = find((node) => node.type === "select" && node.props.value === post.body.marketId && nodes(node.props.children).some((option) => option.props?.value === next.id));
  await select.props.onChange({ target: { value: next.id } }); await settle();
  await resolveSave(); await pendingSave;
  assert.equal(preview().market.id, next.id);
  assert.equal(preview().data.priority, "Priorité enregistrée");
});

test("a failed market load keeps the current point and its draft", async () => {
  preview().actions.updatePriority("Brouillon à conserver"); await settle();
  const current = preview().market.id;
  failedMarket = app.defaultMarkets.find((market) => market.id !== current).id;
  const select = find((node) => node.type === "select" && node.props.value === current && nodes(node.props.children).some((option) => option.props?.value === failedMarket));
  await select.props.onChange({ target: { value: failedMarket } }); await settle();
  assert.equal(preview().market.id, current);
  assert.equal(preview().data.priority, "Brouillon à conserver");
});

test("a draft survives switching away from the market point", async () => {
  preview().actions.updatePriority("Note de réunion"); await settle();
  navigation().onSelect("imports"); await settle();
  navigation().onSelect("read"); await settle();
  assert.equal(preview().data.priority, "Note de réunion");
});

const analysts = ["a", "b"].map((id) => ({ id, name: `Analyste ${id}`, email: `${id}@example.test`, usercode: id === "a" ? "A1234567" : "B1234567", role: "analyste-tarif-referentiel", marketIds: [] }));
async function openAnalyst() {
  hooks.slots.forEach((slot) => slot?.cleanup?.());
  hooks = { slots: [], effects: [], cursor: 0 }; timers.clear();
  renderComponent = () => app.AnalystPointDashboard({ users: analysts, tasks: [], markets: [], plannerUpdatedAt: "", onPlannerImport: async () => ({ imported: 0, message: "" }) });
  await settle();
}
async function editAnalystNote(value) {
  find((node) => node.props?.["aria-label"] === "Modifier le point analyste").props.onChange({ target: { checked: true } }); await settle();
  find((node) => node.type === "textarea" && node.props["aria-label"] === "Message de synthèse").props.onChange({ target: { value } }); await settle();
}

test("analyst notes remain editable in the point and survive unmounting the view", async () => {
  await openAnalyst();
  await editAnalystNote("Décision prise en réunion");
  assert.equal(nodes(tree).some((node) => node.type?.name === "AppDialog" && node.props.open), false);
  await openAnalyst();
  assert.equal(app.readLocalDraft("analyst", "a").data.note, "Décision prise en réunion");
  assert.ok(nodes(tree).some((node) => node.type === "strong" && node.props.children === "Décision prise en réunion"));
});

test("analyst drafts survive changing analysts and a late save preserves newer notes", async () => {
  await openAnalyst(); await editAnalystNote("Note analyste A");
  const save = find((node) => node.type === "button" && node.props.children === "Sauvegarder la semaine").props.onClick();
  await editAnalystNote("Ajout pendant la sauvegarde");
  const savedData = post.body.data;
  post.deferred.resolve(response({ point: { id: "a-week", analystId: "a", year: 2026, week: 36, meetingDate: savedData.meetingDate, periodFrom: savedData.periodFrom, periodTo: savedData.periodTo, createdAt: "2026-09-08T10:00:00Z", updatedAt: "2026-09-08T10:00:00Z", data: savedData } }));
  await save; await settle();
  assert.equal(app.readLocalDraft("analyst", "a").data.note, "Ajout pendant la sauvegarde");
  find((node) => node.type === "select" && node.props.value === "a").props.onChange({ target: { value: "b" } }); await settle();
  await editAnalystNote("Note analyste B");
  find((node) => node.type === "select" && node.props.value === "b").props.onChange({ target: { value: "a" } }); await settle();
  assert.equal(find((node) => node.type === "textarea" && node.props["aria-label"] === "Message de synthèse").props.value, "Ajout pendant la sauvegarde");
  assert.equal(app.readLocalDraft("analyst", "b").data.note, "Note analyste B");
});
