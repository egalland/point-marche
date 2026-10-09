export type PointSourceMode = "automatic" | "manual";

export function normalizeSourceMode(value: unknown): PointSourceMode {
  return value === "manual" ? "manual" : "automatic";
}

export function usesManualSource(point: unknown, source: "jira" | "planner") {
  return !!point && typeof point === "object" && (point as Record<string, unknown>)[`${source}Mode`] === "manual";
}
