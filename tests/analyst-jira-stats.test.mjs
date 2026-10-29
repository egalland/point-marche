import test from 'node:test';import assert from 'node:assert/strict';import {moduleUrl} from './helpers/module-url.mjs';
const {parseJiraStatsQuery,buildAnalystJiraStats}=await import(moduleUrl('../../lib/analyst-jira-stats.ts'));
const users=[{id:'a',name:'Alex',usercode:'A1234567',role:'analyste-tarif-referentiel',marketIds:['m']},{id:'b',name:'Camille',usercode:'B1234567',role:'analyste-tarif-referentiel',marketIds:['m']}];
const ticket={key:'TEST-1',internalId:'',summary:'TEST - Contrôle',status:'Fini',createdAt:'2026-10-23T10:00:00',updatedAt:'2026-10-28T12:00:00',resolutionAt:'2026-10-27T12:00:00',category:'Tarifs',subcategory:'Contrôle',assigneeUserCode:'A1234567',participants:[{usercode:'A1234567',jiraUserId:''},{usercode:'B1234567',jiraUserId:''}],link:''};
const markets=[{id:'m',shortCode:'TEST'},{id:'other',shortCode:'MEN'}];
const query=(extra='')=>parseJiraStatsQuery(new URL('https://example.test?from=2026-10-26&to=2026-10-29&compareFrom=2026-10-19&compareTo=2026-10-22'+extra));
test('Jira analytics compares periods, deduplicates tickets and explains analyst participations and dates',()=>{
 const data=[ticket,ticket,{...ticket,key:'TEST-2',status:'En cours',category:'',subcategory:'',resolutionAt:''},{...ticket,key:'TEST-3',resolutionAt:'2026-10-20T12:00:00'},{...ticket,key:'TEST-4',resolutionAt:'',updatedAt:'2026-10-29T12:00:00'},{...ticket,key:'TEST-5',status:'Abandonnée'}];
 const r=buildAnalystJiraStats(data,users,markets,query());assert.equal(r.a.total,3);assert.equal(r.a.completed,2);assert.equal(r.a.open,1);assert.equal(r.a.mean,2);assert.equal(r.a.datedResolved,1);assert.equal(r.a.fallbackDates,1);assert.equal(r.b.total,1);
 assert.equal(r.a.charts.category.reduce((n,g)=>n+g.value,0),3);assert.equal(r.a.charts.analyst.reduce((n,g)=>n+g.value,0),6);assert.equal(r.a.charts.analyst.find(g=>g.label==='Alex').value,3);assert.ok(r.options.categories.includes('Non renseignée'));
 assert.equal(buildAnalystJiraStats(data,users,markets,query('&category=Tarifs')).a.total,2);
 assert.equal(buildAnalystJiraStats(data,users,markets,query('&analysts=b&involvement=assigned')).a.total,0);
 assert.equal(buildAnalystJiraStats(data,users,markets,query('&analysts=b&involvement=participant')).a.total,3);
 assert.equal(buildAnalystJiraStats(data,users,markets,query('&basis=resolved')).a.total,1);
 assert.equal(buildAnalystJiraStats(data,users,markets,query('&marketId=other')).a.total,0);
});
test('analytics pages details without truncating chart/KPI totals and validates periods',()=>{
 const rows=Array.from({length:121},(_,i)=>({...ticket,key:'TEST-'+i}));const r=buildAnalystJiraStats(rows,users,markets,query('&page=2&sort=key&direction=asc'));
 assert.equal(r.a.total,121);assert.equal(r.a.rows.length,21);assert.equal(r.pages,3);assert.equal(r.a.charts.category[0].value,121);assert.equal(r.a.rows[0].key,'TEST-100');
 assert.throws(()=>parseJiraStatsQuery(new URL('https://example.test?from=2026-02-30&to=2026-10-29')));
});
