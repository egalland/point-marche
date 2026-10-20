'use client';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { activateDialog } from '@/lib/dialog-controller';
import { nextTableSort, queryTable, type TableSort, type ColumnFilter, type QueryColumn } from '@/lib/table-query';
export function useQueryTable<T>(rows: T[], columns: QueryColumn<T>[]) {
  const [sort, setSort] = useState<TableSort>(null);
  const [filters, setFilters] = useState<Record<string, ColumnFilter>>({});
  const filtered = useMemo(() => queryTable(rows, columns, filters, sort), [rows, columns, filters, sort]);
  return { rows: filtered, sort, filters, setFilters,
    sortBy: (key: string) => setSort(current => nextTableSort(current, key)),
    selectionKey: JSON.stringify({sort, filters}),
  };
}
type Controller = ReturnType<typeof useQueryTable>;
export function QueryTableTools({table, total}: {table: Controller; total: number}) {
  return <div className="query-table-tools"><span>Clic droit sur un en-tête pour filtrer · Bouton filtre sur mobile</span>{Object.keys(table.filters).length > 0 && <button type="button" className="secondary-button" onClick={() => table.setFilters({})}>Effacer les filtres ({Object.keys(table.filters).length})</button>}<span role="status">{table.rows.length.toLocaleString('fr-FR')} / {total.toLocaleString('fr-FR')} lignes · Filtres du tableau uniquement</span></div>;
}
export function ColumnFilterFields<T>({column, filter, update}: {column: QueryColumn<T>; filter: ColumnFilter; update: (patch: ColumnFilter) => void}) {
  return <div className="query-table-filter">{column.kind ? (['min','max'] as const).map((bound,index) => <label key={bound}>{column.kind === 'date' ? (bound === 'min' ? 'Du' : 'Au') : (bound === 'min' ? 'Minimum' : 'Maximum')}<input data-autofocus={index === 0 ? '' : undefined} type={column.kind === 'date' ? 'date' : 'number'} step={column.kind === 'number' ? 'any' : undefined} aria-label={`${column.label} ${bound === 'min' ? 'minimum' : 'maximum'}`} value={filter[bound] ?? ''} onChange={event => update({[bound]: event.target.value})}/></label>) : <label>Contient<input data-autofocus="" type="search" aria-label={`Filtrer ${column.label}`} placeholder="Filtrer…" value={filter.text ?? ''} onChange={event => update({text: event.target.value})}/></label>}</div>;
}
export function QueryTableHead<T>({columns, table}: {columns: QueryColumn<T>[]; table: Controller}) {
  const id = useId();
  const [menu,setMenu] = useState<{key:string;x:number;y:number} | null>(null);
  const panel = useRef<HTMLDivElement>(null);
  const column = columns.find(item => item.key === menu?.key);
  useEffect(() => {
    if (!menu || !panel.current) return;
    return activateDialog(panel.current, () => setMenu(null), () => false);
  }, [menu]);
  const open = (key:string, x:number, y:number) => setMenu({key,x:Math.max(8,Math.min(x,window.innerWidth-312)),y:Math.max(8,Math.min(y,window.innerHeight-350))});
  const update = (patch:ColumnFilter) => {
    if (!column) return;
    table.setFilters(current => {
      const next = {...current, [column.key]: {...current[column.key], ...patch}};
      if (!Object.values(next[column.key]).some(Boolean)) delete next[column.key];
      return next;
    });
  };
  return <thead><tr>{columns.map(column => {
    const direction = table.sort?.key === column.key ? table.sort.direction : null;
    const filtering = Object.values(table.filters[column.key] ?? {}).some(Boolean);
    return <th key={column.key} scope="col" aria-sort={direction === 'asc' ? 'ascending' : direction === 'desc' ? 'descending' : 'none'} onContextMenu={event => {event.preventDefault();event.stopPropagation();event.currentTarget.querySelector<HTMLButtonElement>("button")?.focus();open(column.key,event.clientX,event.clientY);}}><div className="query-table-heading"><button className="query-table-sort" type="button" title={`Trier ${column.label} par ordre ${direction === 'asc' ? 'décroissant' : 'croissant'} · Clic droit pour filtrer`} onClick={() => table.sortBy(column.key)} onKeyDown={event => {if(event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')){event.preventDefault();event.stopPropagation();const box=event.currentTarget.getBoundingClientRect();open(column.key,box.left,box.bottom);}}}>{column.label}<span aria-hidden="true">{direction === 'asc' ? '↑' : direction === 'desc' ? '↓' : '↕'}</span></button><button type="button" className={`query-table-filter-button${filtering ? ' is-active' : ''}`} aria-label={`Filtrer ${column.label}${filtering ? ' · filtre actif' : ''}`} aria-haspopup="dialog" aria-expanded={menu?.key === column.key} title={`Filtrer ${column.label}`} onClick={event=>{const box=event.currentTarget.getBoundingClientRect();open(column.key,box.left,box.bottom);}}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M3 4h18l-7 8v7l-4 2v-9z"/></svg></button></div></th>;
  })}</tr>{menu && column && typeof document !== 'undefined' && createPortal(<div className="query-filter-backdrop" onClick={event=>event.stopPropagation()} onContextMenu={event=>{event.preventDefault();event.stopPropagation();}} onPointerDown={event=>{if(event.target===event.currentTarget)setMenu(null);}}><div ref={panel} className="query-filter-menu" role="dialog" aria-modal="true" aria-labelledby={`${id}-title`} tabIndex={-1} style={{left:menu.x,top:menu.y}}><header><strong id={`${id}-title`}>Filtrer · {column.label}</strong><button type="button" aria-label="Fermer le filtre" onClick={()=>setMenu(null)}>×</button></header><ColumnFilterFields column={column} filter={table.filters[column.key] ?? {}} update={update}/><p>Appliqué à toutes les pages du tableau.</p><footer><button type="button" onClick={()=>table.setFilters(current=>{const next={...current};delete next[column.key];return next;})}>Effacer ce filtre</button><button type="button" onClick={()=>setMenu(null)}>Terminer</button></footer></div></div>,document.querySelector('.app-shell') ?? document.body)}</thead>;
}
