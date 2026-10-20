import test from 'node:test';
import assert from 'node:assert/strict';
import {moduleUrl} from './helpers/module-url.mjs';
const {queryTable,nextTableSort}=await import(moduleUrl('../../lib/table-query.ts'));
const {purchaseDataTableColumns,supplierPURCHASESColumns}=await import(moduleUrl('../../lib/purchaseData-table-columns.ts'));
const row=(id,patch={})=>({id,name:'Équipement',supplier:'A0001',specialty:'Bois',piece:'P'+id,line:id,article:'ART'+id,description:'Panneau chêne',agency:'Paris',invoice:'2026-10-01',extracted:'2026-10-10',entity:'GLOBAL',gap:0,...patch});
test('PURCHASES sorting covers the full dataset before pagination, naturally and numerically, without source mutation',()=>{
 const rows=Array.from({length:110},(_,i)=>row(String(110-i),{gap:110-i}));const before=rows.map(r=>r.id);
 assert.equal(queryTable(rows,purchaseDataTableColumns,{}, {key:'piece',direction:'asc'})[0].piece,'P1');
 assert.equal(queryTable(rows,purchaseDataTableColumns,{}, {key:'gap',direction:'desc'})[0].gap,110);
 assert.deepEqual(rows.map(r=>r.id),before);
 assert.deepEqual(nextTableSort(null,'gap'),{key:'gap',direction:'asc'});
 assert.deepEqual(nextTableSort({key:'gap',direction:'asc'},'gap'),{key:'gap',direction:'desc'});
 assert.deepEqual(nextTableSort({key:'gap',direction:'desc'},'article'),{key:'article',direction:'asc'});
});
test('combined text, date and signed gap filters are inclusive and accent insensitive',()=>{
 const rows=[row('1',{gap:-12.5}),row('2',{gap:5}),row('3',{invoice:'',gap:-12.5}),row('4',{description:'Autre',gap:-12.5})];
 const filters={description:{text:'CHENE'},invoice:{min:'2026-10-01',max:'2026-10-01'},gap:{min:'-12,5',max:'0'}};
 assert.deepEqual(queryTable(rows,purchaseDataTableColumns,filters,null).map(r=>r.id),['1']);
 assert.equal(queryTable(rows,purchaseDataTableColumns,{},null).length,4);
});
test('dates sort chronologically, missing values stay last, and equal values stay stable',()=>{
 const rows=[row('1',{invoice:''}),row('2',{invoice:'2025-12-31'}),row('3',{invoice:'2026-01-01'}),row('4',{invoice:'2026-01-01'})];
 assert.deepEqual(queryTable(rows,purchaseDataTableColumns,{}, {key:'invoice',direction:'asc'}).map(r=>r.id),['2','3','4','1']);
 assert.deepEqual(queryTable(rows,purchaseDataTableColumns,{}, {key:'invoice',direction:'desc'}).map(r=>r.id),['3','4','2','1']);
});
test('supplier entity and inferred attachment columns support sorting and filtering',()=>{
 const columns=supplierPURCHASESColumns(new Set(['purchaseData:2'])),rows=[row('1'),row('2')];
 assert.deepEqual(queryTable(rows,columns,{match:{text:'nom'}},null).map(r=>r.id),['2']);
 assert.deepEqual(queryTable(rows,columns,{}, {key:'match',direction:'desc'}).map(r=>r.id),['2','1']);
});
