import { desc, sql } from "drizzle-orm";
import { getDb } from "../../../db";
import { plannerTasks } from "../../../db/schema";
import { parsePlannerTasks, type PlannerSpecialty, type PlannerTask } from "../../../lib/planner-import";
import { getEditorUser } from "../../simple-auth";

function taskDate(task: PlannerTask, specialty: PlannerSpecialty) {
  return task.checklist.filter((item) => item.kind === specialty && item.date).map((item) => item.date).sort().at(-1) ?? "";
}

function serializeTask(row: typeof plannerTasks.$inferSelect) {
  return JSON.parse(row.payload) as PlannerTask;
}

function routeError(error: unknown) {
  const message = error instanceof Error ? error.message : "Erreur inattendue";
  if (/no such table|planner_tasks/i.test(message)) return "Le registre Planner n’est pas encore disponible.";
  return message;
}

export async function GET() {
  try {
    const editor = await getEditorUser();
    if (!editor) return Response.json({ error: "Connecte-toi pour consulter les simulations Planner." }, { status: 401 });
    const db = getDb();
    const rows = await db.select().from(plannerTasks).orderBy(desc(plannerTasks.effectiveMonth), desc(plannerTasks.updatedAt)).limit(5000);
    return Response.json({
      tasks: rows.map(serializeTask),
      updatedAt: rows.map((row) => row.updatedAt).sort().at(-1) ?? "",
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json({ error: routeError(error) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const editor = await getEditorUser();
    if (!editor) return Response.json({ error: "Connecte-toi pour importer les simulations Planner." }, { status: 401 });
    const body = await request.json() as { rawText?: unknown };
    const rawText = typeof body.rawText === "string" ? body.rawText.trim() : "";
    if (!rawText) return Response.json({ error: "Colle d’abord l’export Planner." }, { status: 400 });
    if (rawText.length > 4_000_000) return Response.json({ error: "L’export Planner est trop volumineux." }, { status: 413 });
    const parsed = parsePlannerTasks(rawText);
    if (!parsed.tasks.length) return Response.json({ error: "Le tableau Planner avec les colonnes ID de tâche et Nom de tâche n’a pas été reconnu." }, { status: 400 });
    if (parsed.tasks.length > 2000) return Response.json({ error: "L’import est limité à 2 000 tâches à la fois." }, { status: 413 });

    const db = getDb();
    for (let start = 0; start < parsed.tasks.length; start += 25) {
      const chunk = parsed.tasks.slice(start, start + 25);
      await Promise.all(chunk.map((task) => db.insert(plannerTasks).values({
        externalId: task.externalId,
        taskName: task.taskName,
        effectiveMonth: task.effectiveMonth,
        plannerStatus: task.plannerStatus,
        category: task.category,
        simulationDate: taskDate(task, "simulation"),
        controlDate: taskDate(task, "control"),
        labels: JSON.stringify(task.labels),
        payload: JSON.stringify(task),
        importedBy: editor.username,
      }).onConflictDoUpdate({
        target: plannerTasks.externalId,
        set: {
          taskName: task.taskName,
          effectiveMonth: task.effectiveMonth,
          plannerStatus: task.plannerStatus,
          category: task.category,
          simulationDate: taskDate(task, "simulation"),
          controlDate: taskDate(task, "control"),
          labels: JSON.stringify(task.labels),
          payload: JSON.stringify(task),
          importedBy: editor.username,
          updatedAt: sql`CURRENT_TIMESTAMP`,
        },
      })));
    }
    return Response.json({ tasks: parsed.tasks, imported: parsed.tasks.length, ignoredRows: parsed.ignoredRows, updatedAt: new Date().toISOString() }, { status: 201 });
  } catch (error) {
    return Response.json({ error: routeError(error) }, { status: 500 });
  }
}
