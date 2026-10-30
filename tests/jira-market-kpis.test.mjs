import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
async function load(file){const b=await build({entryPoints:[file],bundle:true,platform:'node',packages:'external',format:'cjs',write:false});const m={exports:{}};new Function('require','module','exports',b.outputFiles[0].text)(require,m,m.exports);return m.exports;}
const {workingDays,jiraMarketKpis,frenchHolidays}=await load('lib/jira-market-kpis.ts');
const {selectMarketTickets}=await load('lib/jira-market-scope.ts');
const {sanitizePointHtml}=await load('lib/point-rich-content.ts');
const {initialData,defaultMarkets,normalizePointData,jiraTicketsFromSummary}=await load('features/market-pulse/point-model.ts');
const {buildInteractiveHtml,buildMailHtml}=await load('features/market-pulse/point-exports.ts');
test('elapsed working days exclude weekends, national holidays and invalid calendar dates',()=>{
 assert.equal(workingDays('2026-10-23','2026-10-26'),1);
 assert.equal(workingDays('2026-04-03','2026-04-07'),1); // Easter Monday
 assert.equal(workingDays('2026-05-13','2026-05-15'),1); // Ascension
 assert.equal(workingDays('2026-12-24','2026-12-28'),1);
 assert.equal(workingDays('2026-10-28','2026-10-28'),0);
 assert.equal(workingDays('2026-02-30','2026-03-01'),null);
 assert.equal(workingDays('2026-10-28','2026-10-27'),null);
});
test('monthly samples use resolution date, exclude missing dates, abandonment, future rows and duplicate keys',()=>{
 const ticket=(key,createdAt,resolutionAt,status='Résolu')=>({key,createdAt,resolutionAt,status});
 const a=ticket('TEST-1','2026-10-01','2026-10-05');
 const k=jiraMarketKpis([a,a,ticket('TEST-2','2026-10-01','2026-10-07'),ticket('TEST-3','2026-09-01','2026-09-02'),ticket('TEST-4','2026-10-01','','Fini'),ticket('TEST-5','2026-10-01','2026-10-07','Abandonnée'),ticket('TEST-6','2026-10-01','2026-10-30'),ticket('TEST-7','2026-10-23','','En cours')],'2026-10-28');
 assert.equal(k.resolved,2);assert.equal(k.mean,3);assert.equal(k.median,3);assert.equal(k.previousMean,1);assert.equal(k.delta,2);assert.equal(k.missingDates,1);assert.equal(k.openAge,3);
 assert.equal(jiraMarketKpis([],'2026-01-04').previous,'2025-12');
 assert.equal(jiraMarketKpis([],'2026-01-04').mean,null);
});
test('specialty outranks assignment, includes unknown assignees, and falls back to all directory roles only without recognized specialty',()=>{
 const rev={id:'rev',short:'REV–MEN',plannerTags:['TEST-A','TEST-B']},pan={id:'pan',short:'PAN',plannerTags:['TEST-C']};
 const tickets=[{key:'TEST-1',summary:'REV : Fournisseur exemple',assigneeUserCode:'A0000001'}, {key:'TEST-2',summary:'PAN : autre marché',assigneeUserCode:'B0000001'},{key:'TEST-3',summary:'Sans spécialité',assigneeUserCode:'B0000001'}];
 const result=selectMarketTickets(tickets,rev,[rev,pan],new Map([['B0000001','Analyste exemple']]));
 assert.deepEqual(result.map(t=>t.key),['TEST-1','TEST-3']);
 assert.ok(result.every(t=>t.marketId==='rev'));
 const mapped=jiraTicketsFromSummary({detailedTickets:result.map(t=>({...t,status:'En cours',internalId:t.key,link:'',createdAt:'2026-10-01',updatedAt:'2026-10-28'})),people:[],items:[],tickets:2,personCount:0},['B0000001'],'rev');assert.equal(mapped.length,2);
});
test('free text, dossier formatting and raster images survive normalization and both exports without weekly priority',()=>{
 const data=initialData();data.meetingDate='2026-10-28';data.priority='Legacy priority';
 data.preferences.freeLayout={mode:'flow',copies:[{id:'copy-text',title:'Commentaire',html:'<p><strong>Note libre</strong></p><img src="data:image/jpeg;base64,YWJj">'}]};
 data.dossiers=[{id:'d',title:'Sujet',width:'half',action:'Contenu',status:'En cours'}];
 const normalized=normalizePointData(data,defaultMarkets[0].id);assert.equal(normalized.dossiers[0].width,'half');
 for(const html of [buildMailHtml(normalized,defaultMarkets[0],[]),buildInteractiveHtml(normalized,defaultMarkets[0],[])]){assert.match(html,/Note libre/);assert.match(html,/data:image\/jpeg;base64,YWJj/);assert.doesNotMatch(html,/Priorité de la semaine|Legacy priority/);}
 assert.doesNotMatch(sanitizePointHtml('<img src="data:image/svg+xml;base64,YWJj"><a href="data:image/png;base64,YWJj">link</a>'),/src=|href=/);
});
test('central monthly KPI snapshot is saved without embedding closed ticket rows and survives reopen',async()=>{
 const {createLocalApi}=await load('offline/local-api.ts'),{WorkspaceStore}=await load('offline/workspace-store.ts'),{newWorkspace}=await load('offline/workspace-data.ts');
 const data=newWorkspace();data.markets[0].plannerTags=['TEST-A'];
 data.users=[{id:'analyst',name:'Analyste exemple',usercode:'A0000001',email:'analyst@example.test',role:'analyste-tarif-referentiel',plannerAlias:'',marketIds:['market-local']}];
 data.jiraUpdatedAt='2026-10-28T10:00:00Z';
 data.jiraTickets=[{key:'TEST-1',summary:'TEST : sujet résolu',status:'Résolu',createdAt:'2026-10-01T10:00:00',resolutionAt:'2026-10-05T10:00:00',updatedAt:'2026-10-28T10:00:00',assigneeUserCode:'B0000001',internalId:'1',participants:[],link:''},{key:'TEST-2',summary:'TEST : sujet ouvert',status:'En cours',createdAt:'2026-10-01T10:00:00',resolutionAt:'',updatedAt:'2026-10-28T10:00:00',assigneeUserCode:'B0000001',internalId:'2',participants:[],link:''}];
 const api=createLocalApi(new WorkspaceStore(data));const {ROOT_ADMIN}=await load('lib/access-control.ts');
 const response=await api('/api/jira-week?marketId=market-local&year=2026&week=44&date=2026-10-28',{headers:{'X-Market-USERCODE':ROOT_ADMIN}});assert.ok(response.ok);
 const payload=await response.json();assert.equal(payload.snapshot.summary.resolutionMetrics.mean,2);assert.equal(payload.snapshot.summary.resolutionMetrics.asOf,'2026-10-28');assert.equal(payload.snapshot.summary.detailedTickets.length,1);
 const point=initialData('market-local');point.meetingDate='2026-10-28';point.jiraResolution=payload.snapshot.summary.resolutionMetrics;
 const reopened=normalizePointData(JSON.parse(JSON.stringify(point)),'market-local');assert.equal(reopened.jiraResolution.mean,2);
});

test('fast working-day count matches daily enumeration across leap years, Easter and weekends',()=>{
 const slow=(from,to)=>{let count=0;for(let d=new Date(from+'T12:00:00Z');;){d.setUTCDate(d.getUTCDate()+1);const day=d.toISOString().slice(0,10);if(day>to)return count;const weekday=d.getUTCDay();if(weekday!==0&&weekday!==6&&!frenchHolidays(d.getUTCFullYear()).has(day))count++;}};
 for(const year of [2024,2025,2026,2027])for(const month of [1,3,4,5,12])for(const span of [0,1,6,7,8,30,80,400]){
  const from=`${year}-${String(month).padStart(2,'0')}-15`,d=new Date(from+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+span);const to=d.toISOString().slice(0,10);assert.equal(workingDays(from,to),slow(from,to),`${from} ${to}`);
 }
});

test('point weekly resolution crosses month boundaries, excludes bad dates and survives snapshot normalization and both exports',async()=>{
 const {normalizeResolutionMetrics}=await load('lib/jira-market-kpis.ts');const {createElement}=require('react'),{renderToStaticMarkup}=require('react-dom/server'),{JiraPointSummary}=await load('features/market-pulse/jira-point-summary.tsx');
 const tickets=[{key:'TEST-700',status:'Fini',createdAt:'2026-10-23',resolutionAt:'2026-10-27'},{key:'TEST-701',status:'Fini',createdAt:'2026-10-23',resolutionAt:'2026-11-01'},{key:'TEST-702',status:'Fini',createdAt:'',resolutionAt:'2026-10-28'},{key:'TEST-703',status:'Abandonnée',createdAt:'2026-01-01',resolutionAt:'2026-10-28'},{key:'TEST-704',status:'Fini',createdAt:'2026-10-23',resolutionAt:'2026-11-02'}];
 const k=jiraMarketKpis(tickets,'2026-11-01');assert.equal(k.weekly.mean,3.5);assert.equal(k.weekly.sample,2);assert.equal(k.weekly.excluded,1);assert.equal(k.weekly.from,'2026-10-26');assert.equal(k.mean,5);
 const data=initialData();data.meetingDate='2026-11-01';data.jiraMode='automatic';data.jiraResolution=k;
 const restored=normalizePointData(JSON.parse(JSON.stringify(data)),defaultMarkets[0].id);assert.deepEqual(restored.jiraResolution.weekly,k.weekly);
 const source=JSON.stringify(restored);jiraMarketKpis([],'2026-12-01');assert.equal(JSON.stringify(restored),source);
 const ui=renderToStaticMarkup(createElement(JiraPointSummary,{data:restored,market:defaultMarkets[0],archive:[]}));assert.match(ui,/Résolution · semaine/);assert.match(ui,/3,5/);
 for(const html of [buildMailHtml(restored,defaultMarkets[0],[]),buildInteractiveHtml(restored,defaultMarkets[0],[])]){assert.match(html,/Délai moyen de résolution · cette semaine/);assert.match(html,/3,5 j ouvrés/);}
 const old={...k};delete old.weekly;assert.equal(normalizeResolutionMetrics(old).weekly,undefined);
 assert.equal(normalizeResolutionMetrics({...k,weekly:{...k.weekly,mean:99}}).weekly,undefined);
});
