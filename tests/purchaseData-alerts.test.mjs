import test from 'node:test';import assert from 'node:assert/strict';import {moduleUrl} from './helpers/module-url.mjs';
const {purchaseDataAlerts}=await import(moduleUrl('../../lib/purchaseData-alerts.ts'));const {pointPURCHASESConfig,createPURCHASESPointReport,savedPURCHASESPointReport}=await import(moduleUrl('../../lib/purchaseData-point.ts'));
const row={id:'1',specialty:'REV',extracted:'2026-09-01',article:'100',gap:-1500};
test('PURCHASES warnings use selected specialties, calendar age and absolute gaps; future rows excluded',()=>{
 const rows=[row,{...row,id:'2'},{...row,id:'3'},{...row,id:'4',specialty:'MEN'},{...row,id:'5',extracted:'2026-11-01'}];
 const a=purchaseDataAlerts(rows,['REV'],'2026-10-29',{gapAmount:1000});assert.equal(a.length,3);assert.match(a[0].title,/3 ligne/);assert.equal(a[0].severity,'danger');assert.match(a[1].detail,/100 \(3\)/);assert.match(a[2].title,/3 ligne/);assert.deepEqual(purchaseDataAlerts(rows,[],'2026-10-29'),[]);assert.deepEqual(purchaseDataAlerts(rows,['REV'],'2026-10-29',{enabled:false}),[]);
});
test('PURCHASES alerts are saved with a point and new registry rows do not change them',()=>{
 const c={...pointPURCHASESConfig([],'2026-10-29'),specialties:['REV']};const saved={...c,report:createPURCHASESPointReport([row],c)};const original=JSON.stringify(saved.report.vigilances);assert.equal(savedPURCHASESPointReport(saved),saved.report);assert.equal(saved.report.summary.lines,0);assert.match(saved.report.vigilances[0].title,/1 ligne/);assert.equal(JSON.stringify(savedPURCHASESPointReport(saved).vigilances),original);
});
