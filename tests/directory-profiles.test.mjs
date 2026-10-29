import test from 'node:test';import assert from 'node:assert/strict';import {moduleUrl} from './helpers/module-url.mjs';
const {validateAssignments,builtinJobRoles,directoryPersonAt,legacyAssignment,nextAssignment,hasAnalystHistory}=await import(moduleUrl('../../lib/directory-profiles.ts'));
const a={...legacyAssignment({role:'analyste-tarif-referentiel',marketIds:['m1','m2']}),from:'2026-01-01',to:'2026-10-31'};
const b={id:'next',roleId:'vente',role:'vente',label:'Vente',marketIds:['m2'],from:'2026-11-01',to:''};
test('dated roles retain multi-market history and apply inclusive dates without leaking expired access',()=>{
 const assignments=validateAssignments([b,a],builtinJobRoles,['m1','m2']);const person={role:'analyste-tarif-referentiel',marketIds:['m1'],assignments};
 assert.deepEqual(directoryPersonAt(person,'2026-10-31').marketIds,['m1','m2']);assert.equal(directoryPersonAt(person,'2026-11-01').role,'vente');assert.equal(directoryPersonAt(person,'2025-12-31').role,'autre');assert.equal(person.role,'analyste-tarif-referentiel');assert.ok(hasAnalystHistory(directoryPersonAt(person,'2026-11-01')));
});
test('period validation rejects overlap, unknown markets/roles, reversed dates and duplicate IDs',()=>{
 for(const raw of [[a,{...b,from:'2026-10-31'}],[a,{...b,from:'2026-02-30'}],[{...a,marketIds:['missing']}],[{...a,roleId:'missing'}],[{...a,to:'2025-01-01'}],[a,{...b,id:a.id}]])assert.throws(()=>validateAssignments(raw,builtinJobRoles,['m1','m2']));
 const custom={id:'job-demo',label:'Référent commercial',baseRole:'vente'};assert.equal(validateAssignments([{...b,roleId:custom.id}],[...builtinJobRoles,custom],['m2'])[0].role,'vente');
});
test('adding a career evolution closes the previous open period and keeps its data',()=>{
 const items=nextAssignment([{...a,to:''}],'2026-11-01');assert.equal(items[0].to,'2026-10-31');assert.deepEqual(items[0].marketIds,['m1','m2']);assert.equal(items[1].from,'2026-11-01');
});
