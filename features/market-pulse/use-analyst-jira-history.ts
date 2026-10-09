"use client";

import { useEffect, useState } from "react";
import { fetchAnalystJiraHistory } from "@/lib/analyst-jira-client";
import { validateJiraHistoryRange, type AnalystJiraHistory, type JiraHistoryRange } from "@/lib/analyst-jira-history";
import { previousJiraWeek, previousJiraWeekCount } from "@/lib/analyst-jira-metrics";

export function useAnalystJiraHistory(analystId: string, range: JiraHistoryRange, reload: number) {
  const [state, setState] = useState<{ key: string; history: AnalystJiraHistory | null; error: string }>({ key: "", history: null, error: "" });
  const rangeError = validateJiraHistoryRange(range);
  const key = analystId && !rangeError ? `${analystId}:${range.from}:${range.to}:${reload}` : "";
  useEffect(() => {
    if (!key) return;
    const controller = new AbortController();
    let active = true;
    void fetchAnalystJiraHistory(analystId, { from: range.from, to: range.to }, controller.signal)
      .then((history) => { if (active) setState({ key, history, error: "" }); })
      .catch((error) => { if (active) setState({ key, history: null, error: error instanceof Error ? error.message : "Historique Jira indisponible." }); });
    return () => { active = false; controller.abort(); };
  }, [key, analystId, range.from, range.to]);
  return {
    history: key && state.key === key ? state.history : null,
    loading: Boolean(key && state.key !== key),
    error: rangeError || (key && state.key === key ? state.error : ""),
  };
}

export function usePreviousAnalystJiraWeek(analystId: string, pointDate: string, chart: ReturnType<typeof useAnalystJiraHistory>, reload: number) {
  const previous = previousJiraWeek(pointDate);
  const cachedCount = previousJiraWeekCount(chart.history?.analystId === analystId ? chart.history : null, pointDate);
  const shouldLoad = Boolean(analystId && previous && !chart.loading && cachedCount === null && (chart.history || chart.error));
  const fallback = useAnalystJiraHistory(shouldLoad ? analystId : "", previous ?? { from: "", to: "" }, reload);
  return {
    count: cachedCount ?? previousJiraWeekCount(fallback.history, pointDate),
    loading: Boolean(analystId && previous && (chart.loading || shouldLoad && fallback.loading)),
    error: shouldLoad ? fallback.error : "",
  };
}
