import test from 'node:test';
import assert from 'node:assert/strict';
import {moduleUrl} from './helpers/module-url.mjs';
const lifecycle = await import(moduleUrl('../../lib/simulation-lifecycle.ts'));
const {plannerDelaySamples,buildAnalystStats} = await import(moduleUrl('../../lib/analyst-stats.ts'));
const {parsePlannerTasks} = await import(moduleUrl('../../lib/planner-import.ts'));
const {operationLifecycle} = await import(moduleUrl('../../lib/simulation-details.ts'));
const step=(label,date='',order=null)=>({label,date,order,kind:'other',analystName:'',nonApplicable:false});
const checklist=[step('Avis de hausse','2026-10-01',0),step('Trame WORKSPACE envoyée','2026-10-04',2),step('Tarif fournisseur','2026-10-10',1)];
const task={externalId:'test',taskName:'Simulation test',checklist,labels:[],metrics:{},workflowState:'active'};
test('trame completion requires a real date, irrespective of step order or yes/no text',()=>{
 const dates=lifecycle.simulationMilestones(checklist);
 assert.equal(lifecycle.simulationLifecycle(dates).noticeToTemplate,3);
 assert.equal(lifecycle.simulationLifecycle(dates).templateToSupplier,6);
 for(const value of ['','OUI','XX/XX/XXXX','2026-02-30'])assert.equal(lifecycle.simulationLifecycle(lifecycle.simulationMilestones([step('Trame WORKSPACE envoyée : OUI',value)])).templateDone,false);
 assert.equal(lifecycle.simulationLifecycle(lifecycle.simulationMilestones([step('Trame WORKSPACE envoyée : NON','2026-10-04')])).templateDone,true);
});
test('dedicated supplier return takes precedence; invalid and reversed dates never become zero',()=>{
 const dates=lifecycle.simulationMilestones([...checklist,step('Réception trame fournisseur','2026-10-12')]);
 assert.equal(lifecycle.simulationLifecycle(dates).templateToSupplier,8);
 assert.equal(lifecycle.elapsedCalendarDays('2026-10-04','2026-10-04'),0);
 assert.equal(lifecycle.elapsedCalendarDays('2026-10-04','2026-10-03'),null);
 assert.equal(lifecycle.elapsedCalendarDays('2026-02-30','2026-03-05'),null);
 const reversed=lifecycle.simulationLifecycle({...dates,templateSent:'2026-10-15'});
 assert.equal(reversed.invalidOrder,true);assert.equal(reversed.templateToSupplier,null);
});
test('Planner parser preserves dated second trame step and rejects impossible dates',()=>{
 const csv='ID de tâche\tNom de tâche\tÉléments de la liste de contrôle\n1\t2026-10-TEST\t"0 - Avis de hausse : 01/10/2026;2 - Trame WORKSPACE envoyée : OUI : 04/10/2026;1 - Tarif fournisseur : 10/10/2026"';
 const parsed=parsePlannerTasks(csv).tasks[0];
 assert.equal(parsed.checklist.find(s=>s.order===2).kind,'trame');
 assert.equal(lifecycle.simulationMilestones(parsed.checklist).templateSent,'2026-10-04');
});
test('point snapshots survive JSON roundtrip with the same lifecycle as statistics',()=>{
 const item=JSON.parse(JSON.stringify({steps:[],plannerSource:{checklist}}));
 assert.equal(operationLifecycle(item).noticeToTemplate,3);
 const samples=plannerDelaySamples([task],[],[]);
 assert.equal(samples.find(s=>s.kind==='templatePreparation').days,3);
 assert.equal(samples.find(s=>s.kind==='templateReturn').days,6);
 const stats=buildAnalystStats([task],[],[],{from:'2026-10-01',to:'2026-10-31',marketId:'all',specialty:'all',analystIds:[]});
 assert.equal(stats.delaySummaries.find(s=>s.kind==='templateReturn').average,6);
 assert.equal(stats.delaySummaries.find(s=>s.kind==='templateReturn').sampleCount,1);
});
test('mail and HTML simulation details carry the same dated milestones and escape content',async()=>{
 const {operationExportDetails}=await import(moduleUrl('../../lib/point-export-data.ts'));
 const item={steps:[],summary:'<script>test</script>',plannerSource:{checklist}};
 for(const mail of [true,false]){
  const html=operationExportDetails(JSON.parse(JSON.stringify(item)),mail);
  assert.match(html,/04\/10\/2026/);assert.match(html,/3 j/);assert.match(html,/6 j/);
  assert.doesNotMatch(html,/<script>/);assert.match(html,/&lt;script&gt;/);
 }
});
test('Planner enrichment never inserts the same external task twice',async()=>{
 const {enrichMarketPointFromPlanner}=await import(moduleUrl('../../lib/point-planner-enrichment.ts'));
 const source={...task,category:'',goal:'',plannerStatus:'',effectiveMonth:'2026-10',taskName:'2026-10-TEST',labels:['TEST-A'],metrics:{supplierCode:'F1',globalVariation:null,weightedVariation:null,purchases12m:null}};
 const point=enrichMarketPointFromPlanner({meetingDate:'2026-10-19',operations:[]},[source,source],['TEST-A']);
 assert.equal(point.operations.length,1);
 assert.equal(point.operations[0].plannerSource.checklist[1].date,'2026-10-04');
});
test('template eligibility uses Planner tags or applicable checklist labels, not every simulation',()=>{
 assert.equal(lifecycle.hasTemplateTracking({labels:['TEST-A'],checklist:[step('Avis de hausse','2026-10-01')]}),false);
 assert.equal(lifecycle.hasTemplateTracking({labels:['Trame WORKSPACE'],checklist:[]}),true);
 assert.equal(lifecycle.hasTemplateTracking({labels:['Sans trame'],checklist:[]}),false);
 assert.equal(lifecycle.hasTemplateTracking({labels:[],checklist:[step('Trame WORKSPACE envoyée')]}),true);
 assert.equal(lifecycle.hasTemplateTracking({labels:[],checklist:[{...step('Trame WORKSPACE envoyée'),nonApplicable:true}]}),false);
 const excluded=lifecycle.simulationLifecycle({notice:'2026-10-01',templateSent:'',supplierReceived:'2026-10-03'},false);
 assert.equal(excluded.templateDone,null);assert.equal(excluded.noticeToTemplate,null);assert.equal(excluded.templateToSupplier,null);
});
test('an untracked simulation adds no artificial zero to supplier denominators or delay samples',async()=>{
 const {buildSupplierProfiles,supplierProfileSummary}=await import(moduleUrl('../../lib/supplier-profile.ts'));
 const tracked={...task,externalId:'tracked',taskName:'2026-10-OCTOBRE-Test',effectiveMonth:'2026-10',category:'1 - À faire',goal:'',plannerStatus:'',labels:['TEST-A'],metrics:{supplierCode:'A0001',globalVariation:null,weightedVariation:null}};
 const untracked={...tracked,externalId:'untracked',checklist:[step('Avis de hausse','2026-10-01'),step('Tarif fournisseur','2026-10-03')]};
 const summary=supplierProfileSummary(buildSupplierProfiles([tracked,untracked],[])[0]);
 assert.equal(summary.total,2);assert.equal(summary.tracked,1);assert.equal(summary.sent,1);assert.deepEqual(summary.preparation,{days:3,count:1});assert.deepEqual(summary.supplierReturn,{days:6,count:1});
 const sample=plannerDelaySamples([untracked],[],[]);assert.ok(sample.every(item=>!item.kind.startsWith('template')));
 const zero={...tracked,externalId:'zero',checklist:[step('Avis de hausse','2026-10-04'),step('Trame WORKSPACE envoyée','2026-10-04'),step('Tarif fournisseur','2026-10-04')]};
 assert.equal(plannerDelaySamples([zero],[],[]).find(item=>item.kind==='templatePreparation').days,0);
});
test('untracked point exports do not present a template as unsent and tag metadata survives JSON',async()=>{
 const {operationExportDetails}=await import(moduleUrl('../../lib/point-export-data.ts'));
 const item={steps:[['Avis de hausse','2026-10-01'],['Tarif fournisseur','2026-10-03']],summary:''};
 assert.equal(operationLifecycle(item).templateApplicable,false);
 for(const mail of [true,false])assert.doesNotMatch(operationExportDetails(item,mail),/Trame non datée|Avis → trame|Trame → retour|0 j/);
 const tagged=JSON.parse(JSON.stringify({...item,plannerSource:{externalId:'x',labels:['TRAME WORKSPACE']}}));
 assert.equal(operationLifecycle(tagged).templateApplicable,true);assert.equal(operationLifecycle(tagged).noticeToTemplate,null);
});
