export type TableSort = { key: string; direction: 'asc' | 'desc' } | null;
export type ColumnFilter = { text?: string; min?: string; max?: string };
export type QueryColumn<T> = { key: string; label: string; value: (row: T) => string | number; kind?: 'number' | 'date' };
export const nextTableSort = (sort: TableSort, key: string): TableSort => ({key, direction: sort?.key === key && sort.direction === 'asc' ? 'desc' : 'asc'});
const collator = new Intl.Collator('fr', { numeric: true, sensitivity: 'base' });
const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('fr').trim();
export function queryTable<T>(rows: T[], columns: QueryColumn<T>[], filters: Record<string, ColumnFilter>, sort: TableSort): T[] {
  const result = rows.filter(row => columns.every(column => {
    const filter = filters[column.key];
    if (!filter) return true;
    const value = column.value(row);
    if (filter.text && !normalize(String(value)).includes(normalize(filter.text))) return false;
    if ((filter.min || filter.max) && value === '') return false;
    if (column.kind === 'number') {
      const number = Number(value);
      if (filter.min && number < Number(filter.min.replace(',', '.'))) return false;
      if (filter.max && number > Number(filter.max.replace(',', '.'))) return false;
    } else {
      if (filter.min && String(value) < filter.min) return false;
      if (filter.max && String(value) > filter.max) return false;
    }
    return true;
  }));
  const column = columns.find(item => item.key === sort?.key);
  if (!column || !sort) return result;
  return result.sort((a,b) => {
    const left = column.value(a), right = column.value(b);
    // Missing values stay last in both directions; equal values retain source order.
    if (left === '' || right === '') return left === right ? 0 : left === '' ? 1 : -1;
    const compared = column.kind === 'number' ? Number(left) - Number(right) : collator.compare(String(left), String(right));
    return sort.direction === 'asc' ? compared : -compared;
  });
}
