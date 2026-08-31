export function isoWeekRange(year: number, week: number) {
  const januaryFourth = new Date(Date.UTC(year, 0, 4, 12));
  const januaryFourthDay = (januaryFourth.getUTCDay() + 6) % 7;
  const monday = new Date(januaryFourth);
  monday.setUTCDate(januaryFourth.getUTCDate() - januaryFourthDay + (week - 1) * 7);
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  return { from: monday.toISOString().slice(0, 10), to: sunday.toISOString().slice(0, 10) };
}

export function dateIsInIsoWeek(value: string, year: number, week: number) {
  const date = value.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const range = isoWeekRange(year, week);
  return date >= range.from && date <= range.to;
}
