import test from 'node:test';import assert from 'node:assert/strict';import {build} from 'esbuild';import {createRequire} from 'node:module';import {setImmediate} from 'node:timers/promises';
const require=createRequire(import.meta.url), React=require('react');let hooks,context;
const react={...React,useContext:()=>context,useState(initial){const i=hooks.i++;if(!(i in hooks.slots))hooks.slots[i]=typeof initial==='function'?initial():initial;return[hooks.slots[i],v=>{hooks.slots[i]=typeof v==='function'?v(hooks.slots[i]):v;}];},useCallback:fn=>fn,useEffect(fn,deps){const i=hooks.i++,before=hooks.slots[i];if(!before||deps.some((v,j)=>!Object.is(v,before[j]))){hooks.slots[i]=deps;hooks.effects.push(fn);}}};
async function load(path){const r=await build({entryPoints:[path],bundle:true,platform:'node',format:'cjs',write:false,packages:'external',logLevel:'silent'});const m={exports:{}};new Function('require','module','exports',r.outputFiles[0].text)(id=>id==='react'?react:require(id),m,m.exports);return m.exports;}
const {SuperAdminPanel}=await load('features/market-pulse/admin-panel.tsx');const {AccessViewSelector}=await load('features/market-pulse/access-panel.tsx');const {defaultPolicy,hasPermission}=await load('lib/access-control.ts');
const nodes=value=>Array.isArray(value)?value.flatMap(nodes):value?.props?[value,...nodes(value.props.children)]:[];
const find=(tree,p)=>{const n=nodes(tree).find(p);assert.ok(n,'Expected UI control');return n;};
const oldFetch=globalThis.fetch,oldWindow=globalThis.window;test.afterEach(()=>{globalThis.fetch=oldFetch;globalThis.window=oldWindow;});
test('superadmin permissions are managed centrally and account rights are delegated to directory checkboxes',async()=>{
 const people=[{usercode:'A0000001',name:'Administrateur exemple',role:'superadmin'},{usercode:'A1234567',name:'Analyste',role:'user',jobRole:'analyste-tarif-referentiel'}];const policy=defaultPolicy();let sent;
 context={person:people[0],effective:people[0],can:()=>true};hooks={i:0,slots:[],effects:[]};globalThis.window={dispatchEvent(){}};
 globalThis.fetch=async(path,init)=>{if(init?.method==='PUT')sent=JSON.parse(init.body);return Response.json(path==='/api/admin/roles'?{people}:{policy});};
 const render=()=>{hooks.i=0;const tree=SuperAdminPanel();hooks.effects.splice(0).forEach(fn=>fn());return tree;};render();await setImmediate();let tree=render();
 assert.ok(find(tree,n=>n.type==='button'&&n.props.children==='Gérer les cases Admin et Super admin dans l’annuaire'));
 assert.equal(nodes(tree).filter(n=>n.props['aria-label']?.startsWith('Rôle de ')).length,0);
 for(const label of ['Ajouter des personnes dans l’annuaire','Changer le statut des bugs et idées','Consulter le journal complet de l’application','Exporter les graphiques en PNG et Excel'])assert.ok(find(tree,n=>n.props['aria-label']===label));
 const field=find(tree,n=>n.props['aria-label']==='Ajouter des personnes dans l’annuaire');field.props.onChange({target:{value:'superadmin'}});tree=render();find(tree,n=>n.type==='button'&&n.props.children==='Enregistrer les autorisations').props.onClick();await setImmediate();assert.equal(sent.policy['directory.create'],'superadmin');assert.equal(sent.expected['directory.create'],'admin');
});
test('admin view selector cannot offer a superadmin view; users get no selector',()=>{
 context={person:{role:'admin'},viewMode:'admin',setViewMode(){}};let tree=AccessViewSelector();const select=find(tree,n=>n.type==='select');assert.deepEqual(nodes(select.props.children).map(n=>n.props.value),['admin','reader']);
 context={person:{role:'user'}};assert.equal(AccessViewSelector(),null);
});

test('directory has two nested role checkboxes, with superadmin implying Admin and locked root',async()=>{
 const {DirectoryRoleCheckboxes}=await load('features/market-pulse/directory-access.tsx');let value;
 let tree=DirectoryRoleCheckboxes({name:'A',role:'user',locked:false,onChange:r=>{value=r;}});let inputs=nodes(tree).filter(n=>n.type==='input');assert.equal(inputs.length,2);assert.equal(inputs[0].props.checked,false);inputs[1].props.onChange({target:{checked:true}});assert.equal(value,'superadmin');
 tree=DirectoryRoleCheckboxes({name:'A',role:'superadmin',locked:false,onChange:r=>{value=r;}});inputs=nodes(tree).filter(n=>n.type==='input');assert.equal(inputs[0].props.checked,true);assert.equal(inputs[0].props.disabled,true);inputs[1].props.onChange({target:{checked:false}});assert.equal(value,'admin');
 tree=DirectoryRoleCheckboxes({name:'Root',role:'superadmin',locked:true,onChange(){}});assert.ok(nodes(tree).filter(n=>n.type==='input').every(n=>n.props.disabled));
});
