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

 test('historical stock counts tickets resolved later, ignores activity dates, and separates uncertain closures',()=>{
 const long={...ticket,createdAt:'2026-09-01T10:00:00',updatedAt:'2026-12-01T10:00:00'};
 const data=[{...long,key:'TEST-10',resolutionAt:'2026-11-01T10:00:00'}, {...long,key:'TEST-11',resolutionAt:'2026-10-25T10:00:00'}, {...long,key:'TEST-12',status:'En cours',resolutionAt:''}, {...long,key:'TEST-13',resolutionAt:'',updatedAt:'2026-10-28T10:00:00'}, {...long,key:'TEST-14',createdAt:'',resolutionAt:'2026-11-01T10:00:00'}, {...long,key:'TEST-15',createdAt:'2026-11-01T10:00:00',resolutionAt:'2026-11-03T10:00:00'}, {...long,key:'TEST-16',resolutionAt:'2026-10-29T10:00:00'}, {...long,key:'TEST-17',status:'Abandonnée',resolutionAt:''}];
 const r=buildAnalystJiraStats(data,users,markets,query());assert.equal(r.a.stockAtEnd,2);assert.equal(r.b.stockAtEnd,4);assert.equal(r.a.stockUnknown,2);assert.equal(r.b.stockUnknown,2);assert.equal(r.a.stockAsOf,'2026-10-29');
 const stock=buildAnalystJiraStats([...data,data[0]],users,markets,query('&basis=stock'));assert.equal(stock.a.total,2);assert.equal(stock.a.open,2);assert.equal(stock.a.completed,0);assert.equal(stock.a.mean,null);assert.deepEqual(stock.a.rows.map(t=>t.key),['TEST-10','TEST-12']);assert.equal(stock.a.charts.category[0].value,2);assert.equal(stock.b.total,4);
 const narrower=buildAnalystJiraStats(data,users,markets,{...query('&basis=stock'),a:{from:'2026-10-29',to:'2026-10-29'}});assert.equal(narrower.a.stockAtEnd,2);assert.equal(narrower.a.total,2);
 });

test('weekly timeline includes empty and partial weeks, market scope, and independent reference dates',()=>{
 const q={...query('&basis=resolved'),a:{from:'2026-10-20',to:'2026-11-02'},b:{from:'2026-10-01',to:'2026-10-04'}};
 const r=buildAnalystJiraStats([ticket,{...ticket,key:'TEST-2',resolutionAt:'2026-11-02T12:00:00'}],users,markets,q);
 assert.deepEqual(r.timeline.a.map(w=>[w.from,w.to,w.total]),[['2026-10-20','2026-10-25',0],['2026-10-26','2026-11-01',1],['2026-11-02','2026-11-02',1]]);
 assert.equal(r.timeline.a.reduce((n,w)=>n+w.total,0),r.a.total);
 assert.equal(r.timeline.a[1].markets.find(m=>m.id==='m').value,1);
 assert.equal(r.timeline.a[1].markets.find(m=>m.id==='other').value,0);
 assert.deepEqual(r.timeline.b.map(w=>[w.from,w.to,w.total]),[['2026-10-01','2026-10-04',0]]);
 const filtered=buildAnalystJiraStats([ticket],users,markets,{...q,category:'Autre'});assert.equal(filtered.timeline.a.reduce((n,w)=>n+w.total,0),0);
});
test('weekly stock is reconstructed at each week end instead of grouping tickets by creation',()=>{
 const q={...query('&basis=stock'),a:{from:'2026-10-19',to:'2026-11-01'}};
 const r=buildAnalystJiraStats([{...ticket,createdAt:'2026-09-01T10:00:00',resolutionAt:'2026-10-27T12:00:00'}],users,markets,q);
 assert.deepEqual(r.timeline.a.map(w=>w.total),[1,0]);
 assert.deepEqual(r.timeline.a.map(w=>w.markets.find(m=>m.id==='m').value),[1,0]);
});
test('weekly timeline uses ISO week year across New Year',()=>{
 const r=buildAnalystJiraStats([],users,markets,{...query(),a:{from:'2026-12-31',to:'2027-01-05'}});
 assert.deepEqual(r.timeline.a.map(w=>w.label),['S53 · 2026','S01 · 2027']);
});

test('global Jira registry includes non-analysts and unassigned tickets, with optional person filters',()=>{
 const manager={...users[0],id:'manager',usercode:'C1234567',name:'Morgan',role:'chef-produit'};
 const data=[ticket,{...ticket,key:'TEST-40',assigneeUserCode:'C1234567',participants:[]},{...ticket,key:'TEST-41',assigneeUserCode:'',participants:[]}];
 const q={...query(),scope:'registry'};
 const report=buildAnalystJiraStats(data,[...users,manager],markets,q);
 assert.equal(report.a.total,3);assert.equal(report.a.charts.analyst.find(i=>i.label==='Morgan').value,1);
 assert.equal(buildAnalystJiraStats(data,[...users,manager],markets,query()).a.total,1);
 assert.equal(buildAnalystJiraStats(data,[...users,manager],markets,{...q,analystIds:['manager']}).a.total,1);
 assert.equal(report.timeline.a.reduce((n,w)=>n+w.total,0),3);
});

test('lightweight weekly counts agree with complete reports for every basis, filters and historical market memberships',()=>{
 const data=[ticket,{...ticket,key:'TEST-50',status:'En cours',resolutionAt:''},{...ticket,key:'TEST-51',createdAt:'2026-08-01',resolutionAt:'2026-11-01',category:'Autre'}];
 for(const basis of ['activity','created','updated','resolved','stock'])for(const marketId of ['all','m','other']){
  const q={...query(),scope:'registry',basis,marketId,a:{from:'2026-10-01',to:'2026-11-02'}};
  const r=buildAnalystJiraStats(data,users,markets,q);
  for(const w of r.timeline.a){const expected=buildAnalystJiraStats(data,users,markets,{...q,a:{from:w.from,to:w.to},b:{from:w.from,to:w.to}});assert.equal(w.total,expected.a.total,`${basis} ${marketId} ${w.from}`);assert.deepEqual(w.markets,expected.a.marketCounts);}
 }
});

test('resolution KPIs use true completion dates independent of activity basis, with actionable missing-date diagnostics',()=>{
 const data=[ticket,{...ticket,key:'TEST-60',createdAt:'',resolutionAt:'2026-10-27'},{...ticket,key:'TEST-61',resolutionAt:''},{...ticket,key:'TEST-62',createdAt:'2026-10-29',resolutionAt:'2026-10-27'},{...ticket,key:'TEST-63',resolutionAt:'invalid'}];
 for(const basis of ['activity','stock','created','updated','resolved']){
  const r=buildAnalystJiraStats(data,users,markets,{...query(),basis});assert.equal(r.a.resolution.mean,2);assert.equal(r.a.resolution.median,2);assert.equal(r.a.resolution.sample,1);assert.equal(r.a.resolution.completed,3);assert.equal(r.a.resolution.excluded,2);assert.equal(r.a.resolution.missingCreation,1);assert.equal(r.a.resolution.invalidOrder,1);assert.equal(r.a.resolution.missingResolution,1);assert.equal(r.a.resolution.invalidResolution,1);assert.equal(r.b.resolution.mean,null);
 }
});

test('weekly resolution cohorts use actual finish dates, valid working-day samples and deduplicated multi-market unions',()=>{
 const multiUsers=[{...users[0],marketIds:['m','other']}],multiMarkets=[{id:'m',shortCode:'TEST'},{id:'other',shortCode:'MEN'},{id:'third',shortCode:'PAN'}];
 const base={...ticket,summary:'Sans spécialité',participants:[],assigneeUserCode:'A1234567'};
 const data=[{...base,key:'TEST-100',createdAt:'2026-10-26',resolutionAt:'2026-10-26'}, {...base,key:'TEST-101',createdAt:'2026-10-19',resolutionAt:'2026-11-02'}, {...base,key:'TEST-102',createdAt:'2026-10-19',resolutionAt:'2026-11-03'}, {...base,key:'TEST-103',createdAt:'2026-10-19',resolutionAt:'2026-11-04'}, {...base,key:'TEST-104',createdAt:'',resolutionAt:'2026-11-04'}, {...base,key:'TEST-105',summary:'PAN - Hors sélection',resolutionAt:'2026-11-03'}, {...base,key:'TEST-106',resolutionAt:'',updatedAt:'2026-11-03'}];
 const q={...query('&markets=m,other,m'),scope:'registry',basis:'created',a:{from:'2026-10-26',to:'2026-11-08'},b:{from:'2026-10-12',to:'2026-10-25'}};
 const r=buildAnalystJiraStats([...data,data[0]],multiUsers,multiMarkets,q),[one,two]=r.timeline.a;
 assert.deepEqual(q.marketIds,['m','other']);assert.equal(one.resolution.sample,1);assert.equal(one.resolution.mean,0);assert.equal(two.resolution.sample,3);assert.equal(two.resolution.excluded,1);assert.equal(two.resolution.days,33);assert.equal(two.resolution.mean,11);
 assert.equal(r.a.resolution.sample,4);assert.equal(r.a.resolution.mean,8.25);assert.notEqual(r.a.resolution.mean,(one.resolution.mean+two.resolution.mean)/2);
 assert.deepEqual(two.markets.map(m=>m.id),['m','other']);for(const market of two.markets)assert.equal(market.resolution.sample,3);
 assert.equal(r.b.resolution.mean,null);assert.equal(r.timeline.b[0].resolution.mean,null);
 assert.equal(buildAnalystJiraStats(data,multiUsers,multiMarkets,{...q,marketIds:['third']}).a.resolution.sample,1);
});
