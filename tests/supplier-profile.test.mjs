import assert from 'node:assert/strict';
import test from 'node:test';
import {moduleUrl} from './helpers/module-url.mjs';
const {buildSupplierProfiles,supplierProfileSummary,filterSupplierProfiles,supplierSelectionUrl,supplierSelectionFromUrl}=await import(moduleUrl('../../lib/supplier-profile.ts'));
const task=(id,code,name,month='2026-10',amount=null)=>({externalId:id,taskName:`${month}-OCTOBRE-${name}`,effectiveMonth:month,category:'1 - Simulation à faire',goal:'',plannerStatus:'',priority:'',assignedTo:'',createdBy:'',createdAt:'',dueDate:'',startDate:'',recurring:false,overdue:false,completedAt:'',completedBy:'',checklistCompleted:0,checklistTotal:0,checklist:[],labels:['REV-PB'],comments:'',metrics:{supplierCode:code,purchases12m:amount,globalVariation:null,weightedVariation:null,announcedVariation:null,tariffStructure:''},workflowState:'active'});
const row=(id,code,name)=>({id,supplier:code,name,extracted:'2026-10-01',invoice:'2026-09-01',entity:'E',piece:id,line:'1',article:'A',description:'Article',agency:'1',specialty:'REV',specialtyCode:'14',gap:2});
test('exact supplier codes join Planner and PURCHASES while same names with different codes remain separate',()=>{
 const profiles=buildSupplierProfiles([task('one',' f001 ','Même nom'),task('two','F002','Même nom'),task('missing','','Même nom')],[row('r','F001','Autre libellé'),row('r2','F003','PURCHASES uniquement')]);
 assert.equal(profiles.length,4);
 const found=profiles.find(p=>p.code==='F001');assert.equal(found.tasks.length,1);assert.equal(found.purchaseData.length,1);assert.ok(found.aliases.includes('Autre libellé'));
 assert.equal(profiles.find(p=>p.key.startsWith('name:')).purchaseData.length,0);
 assert.equal(profiles.find(p=>p.code==='F003').tasks.length,0);
});
test('duplicate tasks and PURCHASES rows do not inflate totals or rolling supplier purchases',()=>{
 const old=task('old','F1','Test','2026-09',100),recent=task('new','F1','Test','2026-10',0);recent.metrics.globalVariation=0;recent.metrics.weightedVariation=-2;
 const [profile]=buildSupplierProfiles([old,recent,recent],[row('r','F1','Test'),row('r','F1','Test')]);
 const summary=supplierProfileSummary(profile);assert.equal(summary.total,2);assert.equal(profile.purchaseData.length,1);assert.equal(summary.turnoverTask.metrics.purchases12m,0);assert.equal(summary.latestVariation.metrics.globalVariation,0);assert.equal(summary.variations.length,1);
});
test('lifecycle averages expose sample counts and exclude missing or reversed dates',()=>{
 const a=task('a','F1','Test'),b=task('b','F1','Test');
 const step=(label,date)=>({label,date,kind:'other',order:null,nonApplicable:false,analystName:''});
 a.checklist=[step('Avis de hausse','2026-10-01'),step('Trame WORKSPACE envoyée','2026-10-04'),step('Tarif fournisseur','2026-10-10')];
 b.checklist=[step('Avis de hausse','2026-10-08'),step('Trame WORKSPACE envoyée','2026-10-04')];
 const summary=supplierProfileSummary(buildSupplierProfiles([a,b],[])[0]);assert.deepEqual(summary.preparation,{days:3,count:1});assert.deepEqual(summary.supplierReturn,{days:6,count:1});assert.equal(summary.dateIssues,1);assert.equal(summary.sent,2);
});
test('dropdown search includes names, codes and aliases without dropping the selected profile',()=>{
 const profiles=buildSupplierProfiles([task('a','F1','Été')],[row('r','F1','Ancien nom')]);
 for(const search of ['ete','f1','ancien'])assert.equal(filterSupplierProfiles(profiles,search).length,1);
 assert.equal(filterSupplierProfiles(profiles,'absent').length,0);
});
test('selected supplier survives page refresh via URL and preserves unrelated parameters',()=>{
 const url=supplierSelectionUrl('https://site.test/?market=REV','code:F001');assert.equal(supplierSelectionFromUrl(url),'code:F001');assert.equal(new URL(url).searchParams.get('mode'),'suppliers');assert.equal(new URL(url).searchParams.get('market'),'REV');assert.equal(supplierSelectionFromUrl(supplierSelectionUrl(url,'')),'');
});
