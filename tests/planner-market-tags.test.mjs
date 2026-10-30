import assert from 'node:assert/strict';
import test from 'node:test';
import {build} from 'esbuild';
const bundled=await build({stdin:{contents:`export * from './lib/planner-market-tags'; export {plannerTaskMatchesMarket} from './features/market-pulse/point-model'; export {buildSimulationComparison} from './lib/simulation-comparison'; export {plannerContributions} from './lib/analyst-stats'; export {enrichMarketPointFromPlanner} from './lib/point-planner-enrichment';`,resolveDir:process.cwd()},bundle:true,packages:'external',format:'esm',platform:'node',write:false,logLevel:'silent'});
const api=await import('data:text/javascript;base64,'+Buffer.from(bundled.outputFiles[0].text).toString('base64'));
const task=(id,labels)=>({externalId:id,taskName:'2026-10-OCTOBRE-EXEMPLE',effectiveMonth:'2026-10',category:'',goal:'',plannerStatus:'',priority:'',assignedTo:'',createdBy:'',createdAt:'',dueDate:'',startDate:'',recurring:false,overdue:false,completedAt:'',completedBy:'',checklistCompleted:1,checklistTotal:1,checklist:[{kind:'simulation',label:'Simulation',date:'2026-10-02',analystName:'Alex',order:1,nonApplicable:false}],labels,comments:'',metrics:{purchases12m:null,supplierCode:'F1000',announcedVariation:null,globalVariation:1,weightedVariation:2,tariffStructure:''},workflowState:'active'});
test('market prefix accepts former, current and future initials without partial-name matches; full rules remain exact',()=>{
 for(const label of ['MEN','MEN-AA','MEN-BB','men-XY',' MEN – SD '])assert.equal(api.plannerLabelMatches(label,' MEN '),true,label);
 for(const label of ['AMEN-BB','MENU-SD','REV-MEN','MENSD','MEN_XX','SANS MEN-BB',''])assert.equal(api.plannerLabelMatches(label,'MEN'),false,label);
 assert.equal(api.plannerLabelMatches('MEN-AA','MEN-AA'),true);assert.equal(api.plannerLabelMatches('MEN-BB','MEN-AA'),false);assert.equal(api.plannerLabelMatches('MEN-AA-ARCHIVE','MEN-AA'),false);assert.equal(api.plannerLabelMatches('MEN-BB',''),false);
 assert.equal(api.matchesPlannerMarket(['MEN-BB','Autre'],['REV','MEN','MEN-BB']),true);assert.equal(api.matchesPlannerMarket(['MEN-BB'],[]),false);
});
test('point matching, comparisons, analyst contributions and explicit refresh agree while preserving source labels and saved inputs',()=>{
 const market={id:'men',name:'Menuiserie',plannerTags:['MEN'],short:'MEN',tone:'mint',colorHex:'',position:0,jiraWarningDays:10,jiraCriticalDays:20};
 const tasks=[task('old',['MEN-AA']),task('new',['MEN-BB','MEN-AA']),task('future',['MEN-XY']),task('other',['MENU-SD'])],original=structuredClone(tasks);
 assert.deepEqual(tasks.filter(t=>api.plannerTaskMatchesMarket(t,market)).map(t=>t.externalId),['old','new','future']);
 const config={fromA:'2026-10',toA:'2026-10',fromB:'2026-10',toB:'2026-10',marketId:'men',supplierKey:'all',metric:'count'};
 const comparison=api.buildSimulationComparison(tasks,[market],config);assert.equal(comparison.countA,3);assert.equal(comparison.countB,3);
 const contributions=api.plannerContributions(tasks,[],[market]);assert.deepEqual(contributions.map(r=>r.marketIds),[['men'],['men'],['men'],[]]);assert.deepEqual(contributions[1].marketTags,['MEN-BB','MEN-AA']);
 const saved={meetingDate:'2026-10-30',plannerMode:'auto',operations:[{id:'manual',name:'Texte conservé'}],simulationComparisonSnapshot:comparison};const before=structuredClone(saved);
 const updated=api.enrichMarketPointFromPlanner(saved,tasks,['MEN']);assert.equal(updated.operations.length,4);assert.deepEqual(saved,before);assert.deepEqual(tasks,original);
 assert.deepEqual(updated.operations.filter(o=>o.plannerSource).map(o=>o.plannerSource.labels),original.slice(0,3).map(t=>t.labels));
 assert.equal(api.enrichMarketPointFromPlanner({...saved,plannerMode:'manual'},tasks,['MEN']).operations.length,1);
});
