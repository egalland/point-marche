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
export function supplierPURCHASESColumns(inferred: Set<string>): QueryColumn<PURCHASESRow>[] {
  const byKey = new Map(purchaseDataTableColumns.map(column=>[column.key,column]));
  return [{key:'entity',label:'Entité',value:row=>row.entity},
    ...['piece','line','article','description','specialty','agency','invoice','extracted','gap'].map(key=>({...byKey.get(key)!, ...(key === 'specialty' ? {label:'Spécialité'} : {})})),
    {key:'match',label:'Rattachement',value:row=>inferred.has(`purchaseData:${row.id}`)?'Nom unique':'Code'}];
}
