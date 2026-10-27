import test from 'node:test';import assert from 'node:assert/strict';import {build} from 'esbuild';
const result=await build({stdin:{contents:`export * from './offline/app-transport'; export {setAccessIdentity,setClientPermissions} from './lib/access-client'; export {createLocalApi} from './offline/local-api'; export {WorkspaceStore} from './offline/workspace-store';`,resolveDir:process.cwd()},bundle:true,platform:'node',format:'esm',write:false,metafile:true,plugins:[{name:'portable-transport',setup(b){b.onResolve({filter:/app-transport$/},()=>({path:process.cwd()+'/offline/app-transport.ts'}));}}]});
const module=await import('data:text/javascript;base64,'+Buffer.from(result.outputFiles[0].text).toString('base64'));
test('portable transport excludes hosted queues and database/worker code',()=>{for(const name of Object.keys(result.metafile.inputs))assert.doesNotMatch(name,/hosted-point-drafts|session-drafts|app\/api\/|(?:^|\/)(?:db|worker)\//);});
test('portable transport fails closed before opening a workbook and keeps local data and identity without network fallback',async t=>{
 const original=globalThis.fetch;let calls=0;globalThis.fetch=async()=>{calls++;throw Error('Network forbidden');};t.after(()=>{globalThis.fetch=original;});
 await assert.rejects(module.appFetch('/api/markets'),/classeur local/);
 const store=new module.WorkspaceStore();module.installLocalTransport(module.createLocalApi(store),{read:store.readDraft,write:store.writeDraft,readPreference:store.readPreference,writePreference:store.writePreference});module.setAccessIdentity('A0000001');
 const response=await module.appFetch('/api/markets');assert.equal(response.status,200);assert.ok((await response.json()).markets.length);
 const draft={scope:'market',ownerId:'market-local',data:{meetingDate:'2026-10-27',priority:'Texte conservé'}};module.writeLocalDraft(draft);assert.equal(module.readLocalDraft('market','market-local').data.priority,'Texte conservé');
 module.setClientPermissions({'point.edit':false});module.writeLocalDraft({...draft,data:{...draft.data,priority:'Interdit'}});assert.equal(module.readLocalDraft('market','market-local').data.priority,'Texte conservé');module.setClientPermissions(null);assert.equal(calls,0);
});
