import assert from 'node:assert/strict';
import test from 'node:test';
import {moduleUrl} from './helpers/module-url.mjs';
const {buildSupplierProfiles,buildSupplierCatalog,supplierCode,supplierNotesWithoutTurnover,supplierProfileSummary,filterSupplierProfiles,supplierSelectionUrl,supplierSelectionFromUrl}=await import(moduleUrl('../../lib/supplier-profile.ts'));
const task=(id,code,name,month='2026-10',amount=null)=>({externalId:id,taskName:`${month}-OCTOBRE-${name}`,effectiveMonth:month,category:'1 - Simulation à faire',goal:'',plannerStatus:'',priority:'',assignedTo:'',createdBy:'',createdAt:'',dueDate:'',startDate:'',recurring:false,overdue:false,completedAt:'',completedBy:'',checklistCompleted:0,checklistTotal:0,checklist:[],labels:['REV-PB'],comments:'',metrics:{supplierCode:code,purchases12m:amount,globalVariation:null,weightedVariation:null,announcedVariation:null,tariffStructure:''},workflowState:'active'});
const row=(id,code,name)=>({id,supplier:code,name,extracted:'2026-10-01',invoice:'2026-09-01',entity:'E',piece:id,line:'1',article:'A',description:'Article',agency:'1',specialty:'REV',specialtyCode:'14',gap:2});
test('only a unique Code with one letter and four digits identifies a supplier',()=>{
 for(const value of [' a0001 ','A0001 VARIATION','Code : A0001'])assert.equal(supplierCode(value),'A0001');
 for(const value of ['F001','F1','12345','AA0001','A00012','A0001/A0002',''])assert.equal(supplierCode(value),'');
});
test('same name with different Code codes remains separate and ambiguous unkeyed data is excluded',()=>{
 const catalog=buildSupplierCatalog([task('one',' a0001 ','Même nom'),task('two','A0002','Même nom'),task('missing','','Même nom')],[row('r','A0001','Autre libellé'),row('r2','A0003','PURCHASES uniquement')]);
 assert.equal(catalog.profiles.length,3);assert.equal(catalog.unresolved.length,1);assert.equal(catalog.unresolved[0].reason,'ambiguous-name');
 assert.equal(catalog.profiles.find(p=>p.code==='A0001').purchaseData.length,1);assert.ok(catalog.profiles.find(p=>p.code==='A0001').aliases.includes('Autre libellé'));
 assert.equal(catalog.profiles.find(p=>p.code==='A0003').tasks.length,0);
});
test('missing or invalid codes correlate only through exact normalized aliases anchored to one Code',()=>{
 const catalog=buildSupplierCatalog([task('valid','A0001','Été & Bois'),task('missing','','ETE BOIS'),task('typo','','Ete boiss'),task('conflict','A0001 / A0002','Été & Bois')],[row('r','123','Été-Bois')]);
 assert.equal(catalog.profiles.length,1);assert.equal(catalog.profiles[0].tasks.length,2);assert.equal(catalog.profiles[0].purchaseData.length,1);assert.equal(catalog.correlated,2);assert.equal(catalog.unresolved.length,2);
 assert.ok(catalog.unresolved.some(item=>item.reason==='ambiguous-code'));
 // An inferred row is not a new vote or a bridge to a different supplier.
 assert.equal(catalog.profiles[0].labelTotal,1);
});
test('canonical name is the modal name over unique explicit-code records, independent of input order',()=>{
 const tasks=[task('old','A0001','Nom récurrent','2026-09'),task('new','A0001','Nom récent isolé','2026-10')];
 const rows=[row('r','A0001','Nom récurrent'),row('r2','A0001','Nom récurrent')];
 for(const [t,r] of [[tasks,rows],[[...tasks].reverse(),[...rows].reverse()]]){
  const [p]=buildSupplierProfiles([...t,t[0]],[...r,r[0]]);assert.equal(p.label,'Nom récurrent');assert.equal(p.labelCount,3);assert.equal(p.labelTotal,4);
 }
 const [tie]=buildSupplierProfiles([task('a','A0001','Zulu'),task('b','A0001','Alpha')],[]);assert.equal(tie.label,'Alpha');
});
test('duplicate rows do not inflate totals and purchase amounts are absent from supplier graph data',()=>{
 const old=task('old','A0001','Test','2026-09',100),recent=task('new','A0001','Test','2026-10',0);recent.metrics.globalVariation=0;recent.metrics.weightedVariation=-2;
 const [profile]=buildSupplierProfiles([old,recent,recent],[row('r','A0001','Test'),row('r','A0001','Test')]);
 const summary=supplierProfileSummary(profile);assert.equal(summary.total,2);assert.equal(profile.purchaseData.length,1);assert.equal(summary.latestVariation.metrics.globalVariation,0);assert.equal(summary.variations.length,1);assert.ok(!('turnoverTask' in summary));assert.ok(!('purchases12m' in summary.variations[0]));
 assert.equal(recent.metrics.purchases12m,0,'source remains intact');
});
test('name-correlated simulations share the same Code series in the graph',()=>{
 const a=task('a','A0001','Nom'),b=task('b','','Nom');a.metrics.globalVariation=2;b.metrics.globalVariation=3;
 const profile=buildSupplierProfiles([a,b],[])[0];assert.deepEqual([...new Set(supplierProfileSummary(profile).variations.map(p=>p.supplierKey))],['A0001']);
});
test('purchase amounts are omitted from supplier comments without losing other metric notes',()=>{
 const notes='Achats 12MG : 123 456,78 € Code fournisseur : A0001 Variation GLOBAL : 2 %\nAutre commentaire';
 const filtered=supplierNotesWithoutTurnover(notes);assert.doesNotMatch(filtered,/123|Achats/);assert.match(filtered,/A0001/);assert.match(filtered,/Variation GLOBAL : 2 %/);assert.match(filtered,/Autre commentaire/);
});
test('lifecycle averages expose sample counts and exclude missing or reversed dates',()=>{
 const a=task('a','A0001','Test'),b=task('b','A0001','Test');
 const step=(label,date)=>({label,date,kind:'other',order:null,nonApplicable:false,analystName:''});
 a.checklist=[step('Avis de hausse','2026-10-01'),step('Trame WORKSPACE envoyée','2026-10-04'),step('Tarif fournisseur','2026-10-10')];
 b.checklist=[step('Avis de hausse','2026-10-08'),step('Trame WORKSPACE envoyée','2026-10-04')];
 const summary=supplierProfileSummary(buildSupplierProfiles([a,b],[])[0]);assert.deepEqual(summary.preparation,{days:3,count:1});assert.deepEqual(summary.supplierReturn,{days:6,count:1});assert.equal(summary.dateIssues,1);assert.equal(summary.sent,2);
});
test('dropdown search includes names, Code and aliases',()=>{
 const profiles=buildSupplierProfiles([task('a','A0001','Été')],[row('r','A0001','Ancien nom')]);
 for(const search of ['ete','a0001','ancien'])assert.equal(filterSupplierProfiles(profiles,search).length,1);
 assert.equal(filterSupplierProfiles(profiles,'absent').length,0);
});
test('selected supplier survives page refresh via URL and preserves unrelated parameters',()=>{
 const url=supplierSelectionUrl('https://site.test/?market=REV','code:A0001');assert.equal(supplierSelectionFromUrl(url),'code:A0001');assert.equal(new URL(url).searchParams.get('mode'),'suppliers');assert.equal(new URL(url).searchParams.get('market'),'REV');assert.equal(supplierSelectionFromUrl(supplierSelectionUrl(url,'')),'');
});
test('supplier sheet omits purchase amounts from cards, nested details, notes and graph while keeping source data',async()=>{
 const {build}=await import('esbuild');const {readFileSync}=await import('node:fs');const {createRequire}=await import('node:module');const {createElement}=await import('react');const {renderToStaticMarkup}=await import('react-dom/server');
 const result=await build({stdin:{contents:readFileSync('features/market-pulse/supplier-dashboard.tsx','utf8')+'\nexport {SupplierSheet};',sourcefile:'features/market-pulse/supplier-dashboard.tsx',resolveDir:process.cwd()+'/features/market-pulse',loader:'tsx'},jsx:'automatic',tsconfig:'tsconfig.json',bundle:true,packages:'external',format:'cjs',platform:'node',write:false,logLevel:'silent'});
 const mod={exports:{}};new Function('require','module','exports',result.outputFiles[0].text)(createRequire(import.meta.url),mod,mod.exports);
 const a=task('a','A0001','Nom');a.metrics.purchases12m=123456.78;a.metrics.globalVariation=2;a.comments='Achats12MG : 123456,78 € Code fournisseur : A0001 Variation GLOBAL : 2 %';
 const profile=buildSupplierProfiles([a],[])[0];const html=renderToStaticMarkup(createElement(mod.exports.SupplierSheet,{profile,plannerReady:true,plannerError:'',purchaseDataReady:true,purchaseDataError:''}));
 assert.doesNotMatch(html,/Achats|12 mois glissants|123456|123.?456/);assert.match(html,/A0001/);assert.match(html,/Variation GLOBAL : 2 %/);assert.equal(a.metrics.purchases12m,123456.78);
});
