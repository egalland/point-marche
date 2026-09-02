"use client";

import { useState } from "react";
import { tablePage } from "@/lib/table-page";

export function useTablePage<T>(rows: T[], selectionKey: string, size = 100) {
  const [selection, setSelection] = useState({ key: selectionKey, page: 1 });
  const pagination = tablePage(rows.length, selection.key === selectionKey ? selection.page : 1, size);
  const onPageChange = (page: number) => setSelection({ key: selectionKey, page: tablePage(rows.length, page, size).page });
  return { ...pagination, rows: rows.slice(pagination.start, pagination.end), onPageChange };
}

type Props = ReturnType<typeof tablePage> & { onPageChange: (page: number) => void; label?: string };

export function TablePagination({ page, pages, start, end, total, onPageChange, label = "Pagination du tableau" }: Props) {
  if (pages <= 1) return null;
  return <nav className="table-pagination" aria-label={label}>
    <span role="status">{start + 1}–{end} sur {new Intl.NumberFormat("fr-FR").format(total)} lignes</span>
    <div><button type="button" disabled={page === 1} onClick={() => onPageChange(page - 1)} aria-label="Page précédente">← Précédente</button><span>Page {page} / {pages}</span><button type="button" disabled={page === pages} onClick={() => onPageChange(page + 1)} aria-label="Page suivante">Suivante →</button></div>
  </nav>;
}
