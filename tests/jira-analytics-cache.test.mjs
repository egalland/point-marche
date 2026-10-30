import test from 'node:test';import assert from 'node:assert/strict';import {moduleUrl} from './helpers/module-url.mjs';
const {JiraAnalyticsSession,compactJiraStats,expandJiraStats}=await import(moduleUrl('../../lib/jira-analytics-cache.ts'));
const {buildAnalystJiraStats,parseJiraStatsQuery,pageJiraStatsReport}=await import(moduleUrl('../../lib/analyst-jira-stats.ts'));
const {prepareJiraAnalytics}=await import(moduleUrl('../../lib/jira-analytics-source.ts'));
const user={id:'a',name:'Alex',usercode:'A1234567',role:'analyste-tarif-referentiel',marketIds:['m'],email:'alex@example.test'};
const markets=[{id:'m',shortCode:'TEST'}];
const q=parseJiraStatsQuery(new URL('https://example.test?from=2026-10-01&to=2026-10-30&compareFrom=2026-09-01&compareTo=2026-09-30'));
const tickets=Array.from({length:121},(_,i)=>({key:'TEST-'+i,internalId:'',status:'Fini',summary:'TEST - Vérification',assigneeUserCode:user.usercode,participants:[],createdAt:'2026-10-01',updatedAt:'2026-10-29',resolutionAt:'2026-10-27',link:'',category:i%2?'Tarifs':'Autre',subcategory:''}));
test('prepared analytics and compact JSON preserve every KPI while paging/sorting never recalculates them',()=>{
 let calls=0;const session=new JiraAnalyticsSession((...args)=>{calls++;return buildAnalystJiraStats(...args);});
 const first=session.report(tickets,[user],markets,q);
 for(const change of [{sort:'key',direction:'asc',page:2},{detailPeriod:'b'},{page:1}]){
  const query={...q,...change};assert.deepEqual(session.report(tickets,[user],markets,query),buildAnalystJiraStats(tickets,[user],markets,query));
 }
 assert.equal(calls,1);assert.equal(first.a.total,121);
 const full=buildAnalystJiraStats(tickets,[user],markets,q,{prepared:prepareJiraAnalytics(tickets),unpaged:true});
 const compact=JSON.parse(JSON.stringify(compactJiraStats(full)));assert.equal('summary' in compact.a.rows[0],false);
 assert.deepEqual(pageJiraStatsReport(expandJiraStats(compact,prepareJiraAnalytics(tickets)),q),first);
 session.report(tickets,[user],markets,{...q,category:'Tarifs'});assert.equal(calls,2);
 session.report(tickets,[{...user,name:'Nouveau nom'}],markets,q);assert.equal(calls,3);
 session.report([...tickets],[user],markets,q);assert.equal(calls,4);
 session.report(tickets,[user],markets,q,true);assert.equal(calls,5);
});
test('indexed weekly memberships respect historical assignments, specialty precedence and partial weeks',()=>{
 const users=[{...user,assignments:[{id:'old',role:'analyste-tarif-referentiel',marketIds:['m'],from:'',to:'2026-10-18'},{id:'new',role:'analyste-tarif-referentiel',marketIds:['other'],from:'2026-10-19',to:''}]}];
 const other=[...markets,{id:'other',shortCode:'MEN'}],data=[{...tickets[0],summary:'Non classé',resolutionAt:'2026-10-16'},{...tickets[1],summary:'Non classé',resolutionAt:'2026-10-20'},{...tickets[2],summary:'TEST - Spécialité',resolutionAt:'2026-10-20'}];
 const report=buildAnalystJiraStats(data,users,other,{...q,scope:'registry',a:{from:'2026-10-16',to:'2026-10-20'},basis:'resolved'});
 assert.deepEqual(report.timeline.a.map(w=>w.markets.map(m=>m.value)),[[1,0],[1,1]]);
 assert.equal(report.timeline.a[1].resolution.sample,2);
});

test('import-prepared stock states match the historical classifier including uncertain dates and reopenings',async()=>{
 const {jiraStockState}=await import(moduleUrl('../../lib/jira-historical-stock.ts'));
 const {preparedJiraStock}=await import(moduleUrl('../../lib/jira-analytics-source.ts'));
 let i=0;
 for(const status of ['Fini','En cours',''])for(const createdAt of ['','2026-02-30','2026-10-01','2026-10-28'])for(const resolutionAt of ['','2026-02-30','2026-09-30','2026-10-27','2026-11-02']){
  const t={...tickets[0],key:'TEST-'+i++,status,createdAt,resolutionAt},prepared=prepareJiraAnalytics([t]);
  for(const date of ['2026-09-30','2026-10-01','2026-10-26','2026-10-30','2026-11-03'])assert.deepEqual(preparedJiraStock(prepared.facts[t.key],date),jiraStockState(t,date));
 }
});
