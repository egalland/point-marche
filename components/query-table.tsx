'use client';
import { useId, useMemo, useState } from 'react';
import { nextTableSort, queryTable, type TableSort, type ColumnFilter, type QueryColumn } from '@/lib/table-query';
export function useQueryTable<T>(rows: T[], columns: QueryColumn<T>[]) {
  const [sort, setSort] = useState<TableSort>(null);
  const [filters, setFilters] = useState<Record<string, ColumnFilter>>({});
  const [showFilters, setShowFilters] = useState(false);
  const filtered = useMemo(() => queryTable(rows, columns, filters, sort), [rows, columns, filters, sort]);
  return { rows: filtered, sort, filters, showFilters, setShowFilters, setFilters,
    sortBy: (key: string) => setSort(current => nextTableSort(current, key)),
    selectionKey: JSON.stringify({sort, filters}),
  };
}
type Controller = ReturnType<typeof useQueryTable>;
export function QueryTableTools({table, total}: {table: Controller; total: number}) {
  return <div className="query-table-tools"><button type="button" className="secondary-button" aria-pressed={table.showFilters} onClick={() => table.setShowFilters(!table.showFilters)}>Filtrer les colonnes</button>{Object.keys(table.filters).length > 0 && <button type="button" className="secondary-button" onClick={() => table.setFilters({})}>Effacer les filtres</button>}<span role="status">{table.rows.length.toLocaleString('fr-FR')} / {total.toLocaleString('fr-FR')} lignes · Filtres du tableau uniquement</span></div>;
}
export function QueryTableHead<T>({columns, table}: {columns: QueryColumn<T>[]; table: Controller}) {
  const id = useId();
  return <thead><tr>{columns.map(column => {
    const active = table.sort?.key === column.key;
    const direction = active ? table.sort!.direction : null;
    const filter = table.filters[column.key] ?? {};
    const update = (patch: ColumnFilter) => table.setFilters(current => {
      const next = {...current, [column.key]: {...current[column.key], ...patch}};
      if (!Object.values(next[column.key]).some(Boolean)) delete next[column.key];
      return next;
    });
    return <th key={column.key} scope="col" aria-sort={direction === 'asc' ? 'ascending' : direction === 'desc' ? 'descending' : 'none'}><button className="query-table-sort" type="button" title={`Trier ${column.label} par ordre ${direction === 'asc' ? 'décroissant' : 'croissant'}`} onClick={() => table.sortBy(column.key)}>{column.label}<span aria-hidden="true">{direction === 'asc' ? '↑' : direction === 'desc' ? '↓' : '↕'}</span></button>{table.showFilters && <div className="query-table-filter">{column.kind ? <>{(['min','max'] as const).map(bound => <input key={bound} type={column.kind === 'date' ? 'date' : 'number'} step={column.kind === 'number' ? 'any' : undefined} aria-label={`${column.label} ${bound === 'min' ? 'minimum' : 'maximum'}`} placeholder={bound === 'min' ? 'Min.' : 'Max.'} value={filter[bound] ?? ''} onChange={event => update({[bound]: event.target.value})}/>)}</> : <input id={`${id}-${column.key}`} type="search" aria-label={`Filtrer ${column.label}`} placeholder="Filtrer…" value={filter.text ?? ''} onChange={event => update({text: event.target.value})}/>}</div>}</th>;
  })}</tr></thead>;
}
