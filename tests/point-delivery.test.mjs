import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {createRequire} from 'node:module';
import {writeFileSync} from 'node:fs';
const require=createRequire(import.meta.url);
async function load(path){const result=await build({entryPoints:[path],bundle:true,packages:'external',platform:'node',format:'cjs',write:false,logLevel:'silent'});const m={exports:{}};new Function('require','module','exports',result.outputFiles[0].text)(require,m,m.exports);return m.exports;}
const model=await load('features/market-pulse/point-model.ts'),exports=await load('features/market-pulse/point-exports.ts'),purchaseData=await load('lib/purchaseData.ts'),mail=await load('lib/point-export-data.ts');
const market=model.defaultMarkets[0],data=model.initialData();data.meetingDate='2026-10-19';data.priority='Confirmer les actions de la semaine';
const row={id:'1',entity:'TEST',supplier:'F1',name:'Fournisseur exemple',piece:'P1',line:'1',article:'123',description:'Article exemple',extracted:'2026-10-01',invoice:'2026-09-01',gap:12,specialty:'TEST'};
const config={...purchaseData.defaultPURCHASES(),from:'2026-10-01',to:'2026-10-31',title:'Suivi achats'};
const rows=[row,{...row,id:'2',line:'2',extracted:'2026-10-08'},{...row,id:'3',supplier:'HORS',extracted:'2025-01-01',gap:999}];
config.report=purchaseData.createPURCHASESReport(rows,config);config.snapshot=rows;data.purchaseDataConfigs=[config];
data.jira=[{id:'J1',key:'TEST-1',summary:'Contrôler le dossier',status:'En cours',priority:'',assignee:'Camille Exemple',lastActivity:'2026-10-01',link:'https://jira.example.test/browse/TEST-1',comment:'Relancer jeudi'}];
data.preferences.mailModules.purchaseData=true;data.preferences.htmlModules.purchaseData=true;
data.preferences.freeLayout={mode:'windows',blocks:{purchaseData:{x:0,y:0,width:588,height:480},jira:{x:600,y:0,width:600,height:840}},titles:{purchaseData:'Achats à suivre'},copies:[]};
test('PURCHASES : même périmètre, mêmes priorités dans le rapport et les exports',()=>{assert.equal(config.report.summary.lines,2);assert.equal(config.report.priorities.suppliers[0].lines,2);assert.equal(config.report.priorities.articles[0].weeks,2);const html=purchaseData.purchaseDataExport([config],true);assert.match(html,/Fournisseur exemple/);assert.doesNotMatch(html,/HORS|999|<details/);assert.match(html,/Articles récurrents/);});
test('mail : détails dépliés et valeur sélectionnée en texte',()=>{const html=mail.mailTables('<details><summary>Historique</summary><select><option>Tous</option><option selected>Octobre</option></select><input value="12"><button>Voir</button><table><tr><td>Donnée</td></tr></table></details>');assert.doesNotMatch(html,/<\/?(?:details|summary|select|input|button)\b/);assert.match(html,/>Octobre</);assert.match(html,/>12</);assert.match(html,/Donnée/);});
test('diffusion : titres personnalisés, commentaires et positions conservés',()=>{const body=exports.buildMailHtml(data,market,[]),web=exports.buildInteractiveHtml(data,market,[]);for(const html of [body,web]){assert.match(html,/Achats à suivre/);assert.match(html,/Relancer jeudi/);assert.match(html,/Fournisseur exemple/);}assert.doesNotMatch(body,/<(?:details|select|script|button|input)\b/);assert.match(web,/data-x="600"/);assert.match(web,/export-positioned/);assert.match(web,/<details open class="person-card"/);if(process.env.POINT_PREVIEW_FIXTURES){writeFileSync('public/qa-mail.html',body);writeFileSync('public/qa-point.html',web);}});
test('visibilité du comparatif propre à chaque destination',()=>{const copy=structuredClone(data);copy.preferences.readModules.comparison=true;copy.preferences.mailModules.comparison=false;copy.preferences.htmlModules.comparison=false;assert.doesNotMatch(exports.buildMailHtml(copy,market,[]),/Comparaison des marchés/);assert.doesNotMatch(exports.buildInteractiveHtml(copy,market,[]),/id="export-comparison"/);});

test('géométrie : les blocs enregistrés précèdent les blocs ajoutés après eux',()=>{const html=exports.buildInteractiveHtml(data,market,[]);assert.ok(html.indexOf('id="export-purchaseData"')<html.indexOf('id="export-dossiers"'));});
test('source absente : aucune synthèse zéro trompeuse',()=>{const html=purchaseData.purchaseDataExport([{...config,report:undefined,snapshot:undefined}],true);assert.match(html,/Données PURCHASES indisponibles/);assert.doesNotMatch(html,/<table/);});
