import test from 'node:test';import assert from 'node:assert/strict';import {build} from 'esbuild';import {createRequire} from 'node:module';
async function load(entry){const b=await build({entryPoints:[entry],bundle:true,platform:'node',format:'cjs',write:false});const m={exports:{}};new Function('require','module','exports',b.outputFiles[0].text)(createRequire(import.meta.url),m,m.exports);return m.exports;}
const {normalizeFreeLayout,changeRect,normalizeRect,initialRects}=await load('lib/free-point-layout.ts');const {searchHelp,helpChapters}=await load('lib/point-help.ts');
test('placement libre et aimanté indépendants, Alt utilise le mode libre',()=>{const r={x:0,y:0,width:576,height:480};assert.equal(changeRect(r,37,51,false,true).x,48);assert.equal(changeRect(r,37,51,false,false).x,37);assert.equal(changeRect(r,37,51,false,true).y,48);assert.deepEqual(r,{x:0,y:0,width:576,height:480});});
test('redimensionnement horizontal et vertical respecte les limites',()=>{const r={x:0,y:0,width:576,height:480};assert.deepEqual(changeRect(r,24,48,true,true),{x:0,y:0,width:600,height:528});assert.equal(normalizeRect({width:Infinity,height:-10,x:NaN,y:-8}).height,144);assert.equal(normalizeRect({x:1190,width:500}).x,700);});
test('migration des quatre colonnes et conservation de vides après sauvegarde',()=>{const r=initialRects(['a','b','c'],{a:'half',b:'half',c:'full'});assert.equal(r.b.x,600);assert.equal(r.c.y,504);const l=normalizeFreeLayout(JSON.parse(JSON.stringify({blocks:{a:{x:72,y:720,width:576,height:240}},snap:false,showGrid:true})));assert.equal(l.blocks.a.y,720);assert.equal(l.snap,false);assert.equal(l.showGrid,true);});
test('recherche dans les étapes et recherche sans accents',()=>{assert.ok(searchHelp('echeance').some(c=>c.id==='dossiers'));assert.ok(searchHelp('Outlook').some(c=>c.id==='exports'));assert.equal(searchHelp('zzzzsansresultat').length,0);assert.equal(helpChapters.length,24);});
test('V70 ordre stable et ajout dans une zone libre sans écraser un bloc existant',async()=>{const {orderedBlockIds,reorderBlock,placeMissingBlocks}=await load('lib/free-point-layout.ts');assert.deepEqual(orderedBlockIds(['a','b','c'],['c','inconnu','c']),['c','a','b']);assert.deepEqual(reorderBlock(['a','b','c'],'c','a'),['c','a','b']);const saved={a:{x:0,y:500,width:1200,height:400}};const placed=placeMissingBlocks(['a','b'],{a:'full',b:'full'},saved);assert.deepEqual(placed.a,saved.a);assert.ok(placed.b.y>=924);const flow=normalizeFreeLayout({...saved,flow:false,order:['b','a']});assert.equal(flow.flow,false);assert.deepEqual(flow.order,['b','a']);});
test('V71 fenêtres par défaut, anciennes coordonnées conservées et lecture fluide explicite',()=>{const old={flow:true,blocks:{a:{x:48,y:96,width:576,height:480}},titles:{},copies:[]};const restored=normalizeFreeLayout(old);assert.equal(restored.flow,false);assert.equal(restored.mode,'windows');assert.deepEqual(restored.blocks.a,old.blocks.a);assert.equal(normalizeFreeLayout({...old,mode:'flow'}).flow,true);assert.equal(normalizeFreeLayout(null).flow,false);});

test('V72 composition sans chevauchement, ancrage du bloc manipulé et disposition stable',async()=>{
 const {arrangePresentationBlocks}=await load('lib/free-point-layout.ts');
 const source={a:{x:0,y:0,width:576,height:480},b:{x:600,y:0,width:576,height:480},c:{x:0,y:504,width:1200,height:240}};
 assert.deepEqual(arrangePresentationBlocks(['a','b','c'],source),source);
 const changed={...source,a:{...source.a,width:1200,height:600}};
 const result=arrangePresentationBlocks(['a','b','c'],changed,'a');
 assert.deepEqual(result.a,changed.a);assert.equal(result.b.y,600);assert.equal(result.c.y,1080);
 assert.deepEqual(arrangePresentationBlocks(['a','b','c'],result),result);assert.equal(source.b.y,0);
 const dragged=arrangePresentationBlocks(['a','b','c'],{...source,b:{...source.b,x:0}},'b');
 assert.equal(dragged.b.y,0);assert.equal(dragged.a.y,480);assert.equal(dragged.c.y,960);
});
test('V73 les huit poignées conservent le bord opposé et respectent les limites',async()=>{
 const {resizeFromEdge}=await load('lib/free-point-layout.ts');const r={x:240,y:240,width:480,height:480};
 for(const edge of ['n','s','e','w','ne','nw','se','sw']){const v=resizeFromEdge(r,48,24,edge);assert.equal(v.x,edge.includes('w')?288:240);assert.equal(v.y,edge.includes('n')?264:240);assert.equal(v.width,edge.includes('w')?432:edge.includes('e')?528:480);assert.equal(v.height,edge.includes('n')?456:edge.includes('s')?504:480);}
 const limited=resizeFromEdge(r,10000,10000,'nw');assert.equal(limited.width,240);assert.equal(limited.height,144);assert.equal(limited.x+limited.width,720);assert.equal(limited.y+limited.height,720);
});
test('V73 repères bords et centres, Alt libre et dimensions alignées',async()=>{
 const {alignPresentationRect}=await load('lib/free-point-layout.ts');const neighbour={x:600,y:100,width:400,height:300};
 const moved=alignPresentationRect({x:605,y:102,width:240,height:144},[neighbour],null,true);assert.equal(moved.rect.x,600);assert.equal(moved.rect.y,100);assert.deepEqual(moved.guides,{x:600,y:100});
 const center=alignPresentationRect({x:676,y:500,width:240,height:144},[neighbour],null,true);assert.equal(center.rect.x+120,800);assert.equal(center.guides.x,800);
 const resized=alignPresentationRect({x:240,y:100,width:365,height:295},[neighbour],'se',true);assert.equal(resized.rect.x+resized.rect.width,600);assert.equal(resized.rect.y+resized.rect.height,400);
 const raw={x:605,y:106,width:240,height:144};assert.deepEqual(alignPresentationRect(raw,[neighbour],null,false),{rect:raw,guides:{}});
});

test('V92 touching blocks and small deliberate gaps survive arranging, saving and reopening',async()=>{
 const {arrangePresentationBlocks}=await load('lib/free-point-layout.ts');
 for(const gap of [0,1,7,23]){
  const blocks={a:{x:0,y:0,width:576,height:480},b:{x:0,y:480+gap,width:576,height:240},c:{x:576,y:0,width:624,height:480}};
  assert.deepEqual(arrangePresentationBlocks(['a','b','c'],blocks,'b'),blocks);
  const restored=normalizeFreeLayout(JSON.parse(JSON.stringify({blocks})));
  assert.deepEqual(arrangePresentationBlocks(['a','b','c'],restored.blocks),blocks);
 }
});

test('V92 edge docking does not push neighbours, including ungridded positions and resizing',async()=>{
 const {alignPresentationRect,arrangePresentationBlocks}=await load('lib/free-point-layout.ts');
 const a={x:0,y:13,width:576,height:490};
 const b={x:0,y:509,width:576,height:240};
 const docked=alignPresentationRect(b,[a],null,true);
 assert.equal(docked.rect.y,503);assert.equal(docked.guides.y,503);
 const blocks={a,b:docked.rect};
 assert.deepEqual(arrangePresentationBlocks(['a','b'],blocks,'b'),blocks);
 const resized=alignPresentationRect({...a,height:494},[b],'s',true);
 assert.equal(resized.rect.y+resized.rect.height,b.y);
 const adjacent=alignPresentationRect({x:581,y:13,width:600,height:240},[a],null,true);
 assert.equal(adjacent.rect.x,a.x+a.width);
});

test('V92 a nearby touching edge wins over a distracting centre alignment',async()=>{
 const {alignPresentationRect}=await load('lib/free-point-layout.ts');
 const neighbours=[{x:0,y:0,width:600,height:480},{x:900,y:458,width:240,height:60}];
 const result=alignPresentationRect({x:0,y:487,width:600,height:240},neighbours,null,true);
 assert.equal(result.rect.y,480);assert.equal(result.guides.y,480);
});
