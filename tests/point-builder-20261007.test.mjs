import assert from 'node:assert/strict';
import test from 'node:test';
import { build } from 'esbuild';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
const require = createRequire(import.meta.url);
async function bundled(sourcefile, suffix = '', plugins = [], reactOverride = null) {
  const result = await build({ stdin: { contents: await readFile(sourcefile, 'utf8') + suffix, sourcefile: resolve(sourcefile), resolveDir: resolve(sourcefile, '..'), loader: sourcefile.endsWith('tsx') ? 'tsx' : 'ts' }, tsconfig: resolve('tsconfig.json'), bundle: true, packages: 'external', format: 'cjs', platform: 'node', write: false, plugins, logLevel: 'silent' });
  const holder = { exports: {} }; new Function('require','module','exports',result.outputFiles[0].text)((id) => id === 'react' && reactOverride ? reactOverride : id === 'react-dom' && reactOverride ? {createPortal: children=>children} : require(id),holder,holder.exports); return holder.exports;
}
const rich = await bundled('lib/point-rich-content.ts');
const comparison = await bundled('lib/simulation-comparison.ts');
const rules = await bundled('lib/jira-alert-rules.ts');
const csv = await bundled('lib/jira-csv.ts');
const app = await bundled('features/market-pulse/market-pulse-app.tsx', '\nexport { initialData, normalizePointData, buildMailHtml, buildInteractiveHtml, defaultMarkets, PreviewDashboard };');
const { jiraAttention, buildAlerts } = await bundled("features/market-pulse/point-model.ts");
const market = app.defaultMarkets[0];
const config = { fromA:'2025-05',toA:'2025-05',fromB:'2026-05',toB:'2026-05',marketId:market.id,supplierKey:'all',metric:'count' };
const mkTask = (id, month, variation = null, extra = {}) => ({ externalId:id,taskName:`${month}-Fournisseur test`,effectiveMonth:month,labels:['REV-PB'],workflowState:'completed',metrics:{supplierCode:'F1',globalVariation:variation,weightedVariation:variation},...extra });
test('Excel paste keeps table cells, Unicode and line breaks without executable markup', () => {
  const html = rich.excelTextToHtml('Fournisseur\tVariation\nÉté\t-2 %');
  assert.match(html, /<table/); assert.equal((html.match(/<td /g)??[]).length,4); assert.match(html,/Été/);
  const unsafe = rich.sanitizePointHtml('<script>alert(1)</script><img src="javascript:alert(2)" onerror="evil()"><p style="font-size:24px;background:url(evil)"><b>Bon</b></p><svg onload="evil()"></svg>');
  assert.doesNotMatch(unsafe,/script|onerror|javascript|svg|url\(/); assert.match(unsafe,/font-size:24px/); assert.match(unsafe,/<b>Bon<\/b>/);
});
test('toolbar font commands retain size, font and color after saving', () => {
  const html = rich.sanitizePointHtml('<font face="Georgia" size="5" color="#123456">Titre</font>');
  assert.match(html,/font-size:24px/); assert.match(html,/font-family:Georgia/); assert.match(html,/color:#123456/); assert.doesNotMatch(html,/<font/);
});
test('attachment links use absolute URLs in mail and malicious URLs are removed', () => {
  const url = '/api/point-assets?id=12345678-1234-1234-1234-123456789012';
  const html = rich.dossierContentHtml({richHtml:`<img src="${url}">`,attachments:[{id:'x',name:'Tarif <2026>.xlsx',url,size:100,type:'application/octet-stream'}]},'https://site.test');
  assert.match(html,/src="https:\/\/site.test\/api\/point-assets/); assert.match(html,/Tarif &lt;2026&gt;.xlsx/);
  assert.equal(rich.normalizeAttachments([{id:'x',name:'x',url:'javascript:alert(1)'}]).length,0);
});
test('comparative counts distinct simulations in their effective month, scoped by market and supplier', () => {
  const tasks = [mkTask('a','2025-05'),mkTask('a','2025-05'),mkTask('b','2026-05'),mkTask('stopped','2026-05',0,{workflowState:'stopped'}),mkTask('other','2026-05',0,{labels:['BOIS']})];
  const snapshot = comparison.buildSimulationComparison(tasks,[market],config);
  assert.equal(snapshot.totalA,1); assert.equal(snapshot.totalB,1); assert.equal(snapshot.buckets.length,1);
  const unknown = comparison.buildSimulationComparison(tasks,[market],{...config,supplierKey:'F999'}); assert.equal(unknown.countA,0);
});
test('variation comparisons retain negative and zero values while excluding missing values', () => {
  const snapshot = comparison.buildSimulationComparison([mkTask('a','2025-05',-2),mkTask('b','2025-05',0),mkTask('c','2025-05',null),mkTask('d','2026-05',2)],[market],{...config,metric:'variation'});
  assert.equal(snapshot.totalA,-1); assert.equal(snapshot.totalB,2);
  const empty = comparison.buildSimulationComparison([], [market], {...config,metric:'variation'}); assert.equal(empty.totalA,null);
  const html = comparison.comparisonHtml({...snapshot,title:'<script>evil</script>'}); assert.doesNotMatch(html,/script/); assert.match(html,/-1 %/);
});
test('Jira CSV categories and custom subcategories survive decoding', () => {
  const parsed = csv.parseJiraCsv('Clé de ticket;État;Résumé;Création;Personne assignée;Mise à jour;Champs personnalisés (Catégorie);Champs personnalisés (Sous-catégorie)\nGLOBAL-1;En cours;Flux;01/05/2026;A1234567;03/05/2026;Appro;Validation changement de flux');
  assert.equal(parsed.tickets[0].category,'Appro'); assert.equal(parsed.tickets[0].subcategory,'Validation changement de flux');
});
test('specific Jira rules override general thresholds and use last activity, without alerting closed tickets', () => {
  const r = rules.normalizeJiraRules([{id:'flow',category:'Appro',subcategory:'Validation flux',warningDays:2,criticalDays:5,priority:'high'}]);
  const ticket = {id:'x',key:'GLOBAL-1',summary:'Flux',status:'En cours',category:'Appro',subcategory:'Validation flux',assignee:'Chef marché',lastActivity:'2026-10-04'};
  assert.equal(jiraAttention(ticket,'2026-10-07',market,r).level,'warning');
  const data = {...app.initialData(),meetingDate:'2026-10-07',jira:[ticket],jiraAlertRules:r};
  assert.equal(buildAlerts(data,market)[0].severity,'warning'); assert.match(buildAlerts(data,market)[0].detail,/Validation flux/);
  assert.equal(buildAlerts({...data,jira:[{...ticket,status:'Terminé'}]},market).length,0);
  assert.equal(jiraAttention({...ticket,lastActivity:''},data.meetingDate,market,r).level,'undated');
});
test('rich dossiers, comparative snapshot and rules survive point normalization and exports follow visible block order', () => {
  const base = app.initialData(); const snapshot = comparison.buildSimulationComparison([mkTask('a','2025-05')],[market],config);
  const data = app.normalizePointData({...base,simulationComparisonConfig:config,simulationComparisonSnapshot:snapshot,jiraAlertRules:[{id:'r',subcategory:'Flux',warningDays:2,criticalDays:5}],dossiers:[{id:'d',title:'Décision',status:'En cours',richHtml:'<p><strong>Texte enrichi</strong></p>',attachments:[]}],preferences:{...base.preferences,moduleOrder:['dossiers','simulationComparison','jira','operations','promotions','alerts','comparison'],readModules:{...base.preferences.readModules,simulationComparison:true,jira:false},mailModules:{...base.preferences.mailModules,jira:true,simulationComparison:false}}},market.id,market);
  assert.match(data.dossiers[0].richHtml,/<strong>/); assert.equal(data.jiraAlertRules[0].warningDays,2); assert.equal(data.simulationComparisonSnapshot.totalA,1);
  const mail=app.buildMailHtml(data,market,[]);assert.match(mail,/Texte enrichi/);assert.doesNotMatch(mail,/Comparatif des simulations/);assert.match(mail,/Tickets Jira/);
  data.preferences.htmlModules={...data.preferences.htmlModules,simulationComparison:true,jira:false};const html=app.buildInteractiveHtml(data,market,[]);assert.match(html,/Texte enrichi/);assert.match(html,/Comparatif des simulations/);assert.doesNotMatch(html,/Tickets Jira ·/);assert.ok(html.indexOf('Décision')<html.indexOf('Comparatif des simulations'));
  const ui = renderToStaticMarkup(createElement(app.PreviewDashboard,{data,market,archive:[],tasks:[],markets:[market],editing:true,actions:{updateFreeLayout(){}}}));
  assert.match(ui,/Ajouter un module/); assert.match(ui,/Modifier/);
});
const asset = await bundled('app/api/point-assets/route.ts', '\nexport { runWithRuntimeEnv } from "../../../lib/runtime-env";', [{ name:'auth-fixture', setup(build) { build.onLoad({filter:/app\/simple-auth\.ts$/},()=>({contents:'export async function getEditorUser(){return globalThis.assetEditor ?? null}',loader:'ts'})); } }]);
test('uploaded attachments persist in object storage, require editor access and download as files', async () => {
  const files = new Map(); const env = { FILES:{async put(key,bytes,opts){files.set(key,{body:bytes,...opts});},async get(key){return files.get(key)??null;}}};
  const form = new FormData(); form.append('file',new File(['hello'],'note.html',{type:'text/html'}));
  globalThis.assetEditor = null;
  const denied = await asset.runWithRuntimeEnv(env,()=>asset.POST(new Request('https://site.test/api/point-assets',{method:'POST',body:form}))); assert.equal(denied.status,401);
  globalThis.assetEditor = {username:'editor'};
  const uploaded = await asset.runWithRuntimeEnv(env,()=>asset.POST(new Request('https://site.test/api/point-assets',{method:'POST',body:form}))); assert.equal(uploaded.status,201);
  const saved = (await uploaded.json()).asset;
  const read = await asset.runWithRuntimeEnv(env,()=>asset.GET(new Request('https://site.test'+saved.url))); assert.equal(read.status,200); assert.match(read.headers.get('content-disposition'),/^attachment/); assert.equal(read.headers.get('content-type'),'application/octet-stream'); assert.equal(await read.text(),'hello');
  const unavailable = await asset.runWithRuntimeEnv({},()=>asset.POST(new Request('https://site.test/api/point-assets',{method:'POST',body:form}))); assert.equal(unavailable.status,503);
  delete globalThis.assetEditor;
});

const actualReact = require('react');
let canvasHooks = { cursor: 0, slots: [] };
const interactiveReact = { ...actualReact, useState(initial) { const index = canvasHooks.cursor++; if (!(index in canvasHooks.slots)) canvasHooks.slots[index] = typeof initial === 'function' ? initial() : initial; return [canvasHooks.slots[index], next => { canvasHooks.slots[index] = typeof next === 'function' ? next(canvasHooks.slots[index]) : next; }]; }, useRef(initial) { const index = canvasHooks.cursor++; return canvasHooks.slots[index] ??= { current: initial }; }, useMemo(fn) { return fn(); }, useId() { return "test-canvas"; }, useEffect() {} };
const interactiveCanvas = await bundled('features/market-pulse/market-pulse-app.tsx', '\nexport { PreviewDashboard };', [], interactiveReact);
const treeNodes = (value) => Array.isArray(value) ? value.flatMap(treeNodes) : value && typeof value === 'object' ? [value, ...treeNodes(value.props?.children)] : [];
const freeCanvas = await bundled('features/market-pulse/free-point-canvas.tsx','',[],interactiveReact);
test('V51 édition sur place et menu sans modifier la disposition',()=>{
 canvasHooks={cursor:0,slots:[]}; const data=app.initialData(market.id),edits=[],writes=[];
 const props={data,content:{},actions:{updateFreeLayout:l=>writes.push(l)},editingModule:null,onEdit:id=>edits.push(id)};
 const render=()=>{canvasHooks.cursor=0;return treeNodes(freeCanvas.FreePointCanvas(props));};
 let nodes=render();const before=nodes.find(n=>n.props?.['data-point-module']==='operations').props.style;
 nodes.find(n=>n.props?.['aria-label']==='Modifier Simulations').props.onClick();
 assert.deepEqual(edits,['operations']);assert.equal(writes.length,0);nodes=render();assert.deepEqual(nodes.find(n=>n.props?.['data-point-module']==='operations').props.style,before);
 canvasHooks={cursor:0,slots:[]};assert.ok(!treeNodes(freeCanvas.FreePointCanvas({...props,actions:undefined})).some(n=>n.props?.className==='v51-block-tools'));
});

const dossierUi = await bundled('features/market-pulse/dossier-board.tsx', '\nexport { DossierEditor };', [], interactiveReact);
test('editing a dossier keeps the rich editor inside its publication card', () => {
  canvasHooks = {cursor:0,slots:[]};
  const row = {id:'inline',title:'Dossier',status:'En cours',universe:'',reference:'',owner:'',action:'Texte',comment:'',deadline:'',progress:0};
  const props = {items:[row],editing:true,onUpdate(){}};
  const render = () => {canvasHooks.cursor = 0;return treeNodes(dossierUi.DossierBoard(props));};
  const previousDocument=globalThis.document;globalThis.document={getElementById(){return null;}};
  let nodes = render(); nodes.find(n => n.props?.id === 'dossier-inline').props.onDoubleClick();globalThis.document=previousDocument;
  nodes = render(); const card = nodes.find(n => n.props?.id === 'dossier-inline');
  const editor = treeNodes(card).find(n => n.type?.name === 'DossierEditor');
  assert.ok(editor); assert.ok(!nodes.some(n => n.type?.name === 'AppDialog'));
  canvasHooks = {cursor:0,slots:[]}; const editing = dossierUi.DossierEditor(editor.props);
  assert.equal(editing.type,'section');
  assert.ok(treeNodes(editing).some(n => n.props?.role === 'toolbar'));
  assert.ok(treeNodes(editing).some(n => n.props?.contentEditable));
});

const sharedAuth = await bundled('app/simple-auth.ts', '\nexport { runWithRuntimeEnv } from "../lib/runtime-env";');
test('V48 permits editing without a cookie and reuses the existing draft account', async () => {
  const anonymous = await sharedAuth.runWithRuntimeEnv({}, () => sharedAuth.getEditorUser());
  assert.equal(anonymous.displayName, 'Espace partagé');
  assert.equal(anonymous.username, 'market-pulse-shared');
  const configured = await sharedAuth.runWithRuntimeEnv({ MARKET_PULSE_USERNAME: 'existing-account' }, () => sharedAuth.getEditorUser());
  assert.equal(configured.username, 'existing-account');
});

test('formatted dossier titles persist in normalization, mail and page exports', () => {
  const data = app.normalizePointData({ ...app.initialData(market.id), dossiers:[{id:'title',title:'Titre',status:'En cours',titleHtml:'<span style="font-size:24px;color:#123456">Titre</span>',richHtml:'<p>Texte</p>'}] },market.id,market);
  assert.match(data.dossiers[0].titleHtml, /font-size:24px/);
  for (const html of [app.buildMailHtml(data,market,[]), app.buildInteractiveHtml(data,market,[])]) assert.match(html, /font-size:24px;color:#123456/);
});

test('V51 pointer resize keeps sibling positions and saves both dimensions',()=>{
 canvasHooks={cursor:0,slots:[]};const old=globalThis.window, listeners=new Map();globalThis.window={scrollY:0,scrollBy(){},innerWidth:1400,innerHeight:1000,addEventListener:(n,f)=>listeners.set(n,f),removeEventListener:n=>listeners.delete(n)};
 try {const data=app.initialData(market.id);data.preferences.freeLayout={flow:false,enabled:true,snap:true,showGrid:true,blocks:{operations:{x:0,y:0,width:576,height:480},jira:{x:600,y:0,width:576,height:480}},titles:{},copies:[]};const writes=[];
 const props={data,content:{},actions:{updateFreeLayout:l=>writes.push(l)},editingModule:null,onEdit(){}};const render=()=>{canvasHooks.cursor=0;return treeNodes(freeCanvas.FreePointCanvas(props));};let nodes=render();nodes.find(n=>n.props?.['aria-label']==='Organiser les blocs').props.onClick();nodes=render();
 const stage=nodes.find(n=>n.props?.className?.startsWith('v51-stage'));stage.props.ref.current={getBoundingClientRect(){return {width:1200};}};
 nodes.find(n=>n.props?.['aria-label']==='Redimensionner Simulations').props.onPointerDown({preventDefault(){},stopPropagation(){},clientX:576,clientY:480});listeners.get('pointermove')({clientX:624,clientY:528,altKey:false});listeners.get('pointerup')();
 assert.equal(writes.at(-1).blocks.operations.width,624);assert.equal(writes.at(-1).blocks.operations.height,528);assert.deepEqual(writes.at(-1).blocks.jira,data.preferences.freeLayout.blocks.jira);
 }finally{globalThis.window=old;}
});
