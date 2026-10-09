function sourceTime(value: string | null | undefined) {
  if (!value) return 0;
  const normalized = value.includes("T") ? value : `${value.replace(" ", "T")}Z`;
  const parsed = Date.parse(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function shouldPreferCentralJira(centralUpdatedAt: string | null | undefined, weeklyUpdatedAt: string | null | undefined, force = false) {
  if (!centralUpdatedAt) return false;
  if (force || !weeklyUpdatedAt) return true;
  return sourceTime(centralUpdatedAt) > sourceTime(weeklyUpdatedAt);
}
