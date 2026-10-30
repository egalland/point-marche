import test from 'node:test';import assert from 'node:assert/strict';import {build} from 'esbuild';import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
async function load(file){const b=await build({entryPoints:[file],bundle:true,platform:'node',packages:'external',format:'cjs',write:false});const m={exports:{}};new Function('require','module','exports',b.outputFiles[0].text)(require,m,m.exports);return m.exports;}
const {marketJiraSummary,jiraWeeklyActivity,jiraCategoryGroups,normalizeJiraWeekCoverage}=await load('lib/jira-point-activity.ts');
const {parseJiraAssigneeSummary}=await load('lib/jira-import.ts');
const {initialData,defaultMarkets,jiraTicketsFromSummary,normalizePointData,jiraDashboardStats}=await load('features/market-pulse/point-model.ts');
const {buildMailHtml,buildInteractiveHtml}=await load('features/market-pulse/point-exports.ts');
const t={key:'TEST-1',internalId:'10001',status:'Fini',summary:'TEST - Test terminé',category:'Tarifs',subcategory:'Contrôle',createdAt:'2026-10-20T10:00:00',resolutionAt:'2026-10-27T10:00:00',updatedAt:'2026-10-29T10:00:00',assigneeUserCode:'A1234567',marketId:'test',link:'https://jira.example.test/browse/TEST-1'};
test('weekly completion retains only actual week, uses resolution first, labels fallback and excludes abandoned or incoherent dates',()=>{
 const rows=[t,t,{...t,key:'TEST-2',resolutionAt:'2026-10-23T12:00:00'},{...t,key:'TEST-3',resolutionAt:'',updatedAt:'2026-10-28T10:00:00'},{...t,key:'TEST-4',resolutionAt:'2026-10-30T10:00:00'},{...t,key:'TEST-5',status:'Abandonné'},{...t,key:'TEST-6',resolutionAt:'invalid'},{...t,key:'TEST-7',createdAt:'2026-11-01T10:00:00'}];
 const a=jiraWeeklyActivity(rows,'2026-10-29');assert.deepEqual(a.completed.map(t=>t.key),['TEST-1','TEST-3']);assert.equal(a.coverage.fallbackCount,1);assert.equal(a.coverage.undatedClosed,1);assert.equal(a.coverage.from,'2026-10-26');assert.equal(a.coverage.to,'2026-11-01');assert.deepEqual(normalizeJiraWeekCoverage(a.coverage),a.coverage);assert.equal(normalizeJiraWeekCoverage({...a.coverage,from:'2026-10-27'}),undefined);
 assert.equal(jiraWeeklyActivity([{...t,resolutionAt:'2027-01-01T12:00:00',createdAt:'2026-12-20'}],'2027-01-02').coverage.from,'2026-12-28');
});
test('point keeps open totals separate from weekly completed details and freezes them through normalization and both exports',()=>{
 const summary=marketJiraSummary([t,{...t,key:'TEST-2',status:'En cours'},{...t,key:'TEST-3',resolutionAt:'',updatedAt:'2026-10-28T12:00:00'}],'2026-10-29');
 assert.equal(summary.tickets,1);assert.equal(summary.people[0].total,1);assert.equal(summary.detailedTickets.length,3);
 const market={...defaultMarkets[0],id:'test'};const data=initialData('test',market);data.meetingDate='2026-10-29';data.jiraMode='automatic';data.jira=jiraTicketsFromSummary(summary,['A1234567'],'test');data.jiraWeekly=summary.weeklyCoverage;data.jiraResolution=summary.resolutionMetrics;data.jiraAlertRules=[{id:'r',category:'Tarifs',subcategory:'',warningDays:2,criticalDays:5,priority:'normal',enabled:true,impact:'high',implication:'Contrôler <les agences>'}];
 const saved=normalizePointData(JSON.parse(JSON.stringify(data)),'test');assert.equal(saved.jira.length,3);assert.equal(jiraDashboardStats(saved,market,[]).currentVolume,1);assert.equal(jiraCategoryGroups(saved.jira,saved.jiraAlertRules)[0].impact,'high');
 for(const html of [buildMailHtml(saved,market,[]),buildInteractiveHtml(saved,market,[])]){assert.match(html,/2 ticket\(s\) terminé\(s\)/);assert.match(html,/TEST-1/);assert.match(html,/TEST-3/);assert.match(html,/Tarifs \/ Contrôle/);assert.match(html,/Contrôler &lt;les agences&gt;/);}
 const next=marketJiraSummary([],'2026-10-29');assert.equal(next.tickets,0);assert.equal(saved.jira.length,3);
});
test('manual detailed paste recognizes closed status, categories and resolution columns',()=>{
 const text='Clé de ticket\tID de ticket\tÉtat\tRésumé\tCréation\tPersonne assignée\tMise à jour\tCatégorie\tSous-catégorie\tRésolution\nTEST-1\t10001\tTerminé\tDemande tarif\t20/10/2026 10:00\tA1234567\t29/10/2026 10:00\tTarifs\tContrôle\t27/10/2026 10:00';
 const p=parseJiraAssigneeSummary(text);assert.equal(p.detailedTickets.length,1);assert.equal(p.detailedTickets[0].category,'Tarifs');assert.equal(p.detailedTickets[0].subcategory,'Contrôle');assert.equal(p.detailedTickets[0].updatedAt,'2026-10-29T10:00:00');assert.equal(p.detailedTickets[0].resolutionAt,'2026-10-27T10:00:00');
});

test('point summary promotes the completed count and exposes its list without opening the generic Jira modal',async()=>{
 const {build}=await import('esbuild'),{createRequire}=await import('node:module');const React=await import('react'),{renderToStaticMarkup}=await import('react-dom/server');
 const b=await build({entryPoints:['features/market-pulse/jira-point-summary.tsx'],bundle:true,platform:'node',format:'cjs',packages:'external',write:false});const module={exports:{}};new Function('require','module','exports',b.outputFiles[0].text)(createRequire(import.meta.url),module,module.exports);
 const date='2026-10-30',data={meetingDate:date,jiraMode:'manual',jira:[{id:'one',key:'TEST-1',status:'Fini',summary:'Terminé visible',assignee:'Alex',createdAt:'2026-10-23',resolutionAt:'2026-10-27',lastActivity:'2026-10-29',count:1}],jiraAlertRules:[]};
 const html=renderToStaticMarkup(React.createElement(module.exports.JiraPointSummary,{data,market:{id:'m',name:'Marché',jiraWarningDays:10,jiraCriticalDays:20},archive:[]}));assert.match(html,/completed-spotlight/);assert.match(html,/Terminés cette semaine<\/span><strong>1<\/strong>/);assert.match(html,/<summary>Voir les tickets terminés/);assert.match(html,/Terminé visible/);
 const old=renderToStaticMarkup(React.createElement(module.exports.JiraPointSummary,{data:{...data,jiraMode:'automatic',jira:[]},market:{id:'m',name:'Marché'},archive:[]}));assert.match(old,/Actualise les données Jira du point/);assert.match(old,/Terminés cette semaine<\/span><strong>—<\/strong>/);
});
