import type { PURCHASESRow } from './purchaseData';
import type { QueryColumn } from './table-query';
export const purchaseDataTableColumns: QueryColumn<PURCHASESRow>[] = [
  {key:'supplier',label:'Fournisseur',value:row=>`${row.name} (${row.supplier})`},
  {key:'specialty',label:'Spé',value:row=>row.specialty},
  {key:'piece',label:'Pièce',value:row=>row.piece},
  {key:'line',label:'Ligne',value:row=>row.line},
  {key:'article',label:'Article',value:row=>row.article},
  {key:'description',label:'Description',value:row=>row.description},
  {key:'agency',label:'Agence',value:row=>row.agency},
  {key:'invoice',label:'Facture',value:row=>row.invoice,kind:'date'},
  {key:'extracted',label:'Extraction',value:row=>row.extracted,kind:'date'},
  {key:'gap',label:'Écart €',value:row=>row.gap,kind:'number'},
];
// Count within the source perimeter, before table-only filters and pagination.
export function purchaseDataColumnsWithOccurrences(rows: PURCHASESRow[]): QueryColumn<PURCHASESRow>[] {
  const counts = new Map<string, number>();
  for (const row of rows) if (row.article) counts.set(row.article, (counts.get(row.article) ?? 0) + 1);
  const occurrence: QueryColumn<PURCHASESRow> = {key:'occurrences',label:'Occurrences article',kind:'number',value:row=>row.article ? counts.get(row.article) ?? 0 : ''};
  return purchaseDataTableColumns.flatMap(column=>column.key === 'article' ? [column,occurrence] : [column]);
}
export function supplierPURCHASESColumns(inferred: Set<string>, rows: PURCHASESRow[] = []): QueryColumn<PURCHASESRow>[] {
  const byKey = new Map(purchaseDataColumnsWithOccurrences(rows).map(column=>[column.key,column]));
  return [{key:'entity',label:'Entité',value:row=>row.entity},
    ...['piece','line','article','occurrences','description','specialty','agency','invoice','extracted','gap'].map(key=>({...byKey.get(key)!, ...(key === 'specialty' ? {label:'Spécialité'} : {})})),
    {key:'match',label:'Rattachement',value:row=>inferred.has(`purchaseData:${row.id}`)?'Nom unique':'Code'}];
}
