export function isIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

export function isoWeekParts(dateString: string) {
  const date = new Date(`${dateString}T12:00:00Z`);
  const target = new Date(date);
  target.setUTCDate(date.getUTCDate() - (date.getUTCDay() + 6) % 7 + 3);
  const year = target.getUTCFullYear();
  const firstThursday = new Date(Date.UTC(year, 0, 4, 12));
  firstThursday.setUTCDate(firstThursday.getUTCDate() - (firstThursday.getUTCDay() + 6) % 7 + 3);
  return { year, week: 1 + Math.round((target.valueOf() - firstThursday.valueOf()) / 604800000) };
}

export function addIsoDays(value: string, days: number) {
  const date = new Date(`${value}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function isoWeekForDate(value: string) {
  const parts = isoWeekParts(value);
  return { ...parts, ...isoWeekRange(parts.year, parts.week) };
}

export function calendarWeeks(year: number, month: number) {
  const first = new Date(Date.UTC(year, month, 1, 12)).toISOString().slice(0, 10);
  const last = new Date(Date.UTC(year, month + 1, 0, 12)).toISOString().slice(0, 10);
  const weeks: ReturnType<typeof isoWeekForDate>[] = [];
  for (let day = isoWeekForDate(first).from; day <= last; day = addIsoDays(day, 7)) weeks.push(isoWeekForDate(day));
  return weeks;
}

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
