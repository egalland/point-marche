import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
const result=await build({stdin:{contents:`
export * from './features/market-pulse/point-model';
export * from './features/market-pulse/point-exports';
export {newWorkspace,encodeWorkspace,decodeWorkspace} from './offline/workspace-data';
export {WorkspaceStore} from './offline/workspace-store';
export {createLocalApi} from './offline/local-api';
export {workspaceParts} from './offline/shared-workspace';
export {ROOT_ADMIN} from './lib/access-control';
export {parseJiraCsv} from './lib/jira-csv';
export {defaultPURCHASES} from './lib/purchaseData';
export {createPURCHASESPointReport} from './lib/purchaseData-point';
export {buildMailDraft} from './lib/mail-draft';
`,resolveDir:process.cwd()},bundle:true,platform:'node',format:'cjs',packages:'external',write:false});
const mod={exports:{}};new Function('require','module','exports',result.outputFiles[0].text)(require,mod,mod.exports);const m=mod.exports;

test('prepare a complete point: imports, market filtering, correction, save, reopen, mail and HTML',async()=>{
 const workspace=m.newWorkspace();workspace.markets[0].plannerTags=['TEST-A'];
 workspace.users=[{id:'chief',usercode:'A1234567',name:'Alex Exemple',email:'alex@example.test',role:'chef-produit',plannerAlias:'Alex',marketIds:['market-local']}];
 const store=new m.WorkspaceStore(workspace),api=m.createLocalApi(store);
 const call=async(path,body)=>{const response=await api(path,{headers:{'X-Market-USERCODE':m.ROOT_ADMIN,'Content-Type':'application/json'},...(body?{method:'POST',body:JSON.stringify(body)}:{})});const payload=await response.json();assert.ok(response.ok,JSON.stringify(payload));return payload;};
 const csv=['Clé de ticket;ID de ticket;État;Résumé;Création;Personne assignée;Mise à jour',
 'TEST-101;1001;En cours;Décision attendue;01/10/2026 10:00;A1234567;27/10/2026 10:00',
 'TEST-102;1002;En cours;HORS PERIMETRE;01/10/2026 10:00;B1234567;27/10/2026 10:00'].join('\n');
 const parsed=m.parseJiraCsv(csv);assert.equal(parsed.tickets.length,2);
 const {batch}=await call('/api/jira-imports',{action:'start',filename:'synthetic-test.csv',rowCount:2});
 await call('/api/jira-imports',{action:'chunk',importId:batch.id,tickets:parsed.tickets});
 await call('/api/jira-imports',{action:'finish',importId:batch.id,expectedTicketCount:2,expectedParticipantCount:0});
 const planner=['ID de tâche\tNom de tâche\tCatégorie\tÉtiquettes', 'test-task-1\t2026-10-OCTOBRE-FOURNISSEUR EXEMPLE\t2-En cours\tTEST-A', 'test-task-2\t2026-10-OCTOBRE-HORS PERIMETRE\t2-En cours\tTEST-B'].join('\n');
 await call('/api/planner-tasks',{rawText:planner});
 const registry=await call('/api/planner-tasks');
 const market={...m.defaultMarkets[0],id:'market-local',name:'Marché exemple',short:'TEST',plannerTags:['TEST-A']};
 const data=m.initialData(market.id,market);data.meetingDate='2026-10-28';data.priority='Confirmer les prochaines actions';data.mail.to='alex@example.test';
 const weekly=await call('/api/jira-week?year=2026&week=44&marketId=market-local');
 assert.ok(weekly.snapshot);
 data.jira=m.jiraTicketsFromSummary(weekly.snapshot.summary,['A1234567'],market.id,[]);
 assert.equal(data.jira.length,1);
 data.jira[0].pointOverride={comment:'Correction locale à conserver'};data.jira[0].comment='Correction locale à conserver';
 data.jira=m.jiraTicketsFromSummary(weekly.snapshot.summary,['A1234567'],market.id,data.jira);
 assert.equal(data.jira[0].comment,'Correction locale à conserver');
 const relevant=m.plannerTasksForPoint(registry.tasks,market,data.meetingDate);assert.equal(relevant.length,1);
 data.operations=m.mergePlannerOperations([],relevant,registry.tasks);
 data.sourceFreshness={jira:weekly.snapshot.updatedAt,planner:registry.updatedAt};
 data.dossiers=[{id:'dossier-test',title:'Décision commerciale',universe:'Test',reference:'TEST-1',status:'En cours',owner:'Alex Exemple',action:'Valider jeudi',deadline:'2026-10-29',progress:50,comment:'',attachments:[]}];
 const purchaseData=['Extrait le\tSpé\tEntité\tCd Fournisseur\tNom Fournisseur\tN° pièce\tN° de lig de fact\tDescription\tDate facture\tMontant de l’écart', '27/10/2026\tTEST\tEXEMPLE\tF0001\tFournisseur exemple\tP1\t1\t123/F:TEST/Produit exemple\t01/10/2026\t12,50'].join('\n');
 const form=new FormData();form.append('file',new Blob([purchaseData]),'synthetic.tsv');form.append('filename','synthetic.tsv');
 const imported=await api('/api/purchaseData',{method:'POST',headers:{'X-Market-USERCODE':m.ROOT_ADMIN},body:form});assert.equal(imported.status,200);
 const previousPURCHASES=store.readPreference('purchaseData-source');
 const invalid=await api('/api/purchaseData',{method:'POST',headers:{'X-Market-USERCODE':m.ROOT_ADMIN,'Content-Type':'application/json'},body:JSON.stringify({text:purchaseData+'\nINVALID\tTEST\tEXEMPLE\tF0002\tErreur\tP2\t1\tProduit\t01/10/2026'})});assert.equal(invalid.status,422);assert.equal(store.readPreference('purchaseData-source'),previousPURCHASES);
 assert.ok(m.workspaceParts(store.snapshot()).has('preferences/purchaseData-source'));
 const purchase=await call('/api/purchaseData');assert.equal(purchase.rows.length,1);
 const config={...m.defaultPURCHASES(),from:'2026-10-26',to:'2026-11-01',specialties:['TEST'],pointPeriod:'custom'};
 data.purchaseDataConfigs=[{...config,report:m.createPURCHASESPointReport(purchase.rows,config,purchase.updatedAt)}];data.preferences.readModules.purchaseData=true;
 await call('/api/points',{marketId:market.id,data});
 const reopened=new m.WorkspaceStore(await m.decodeWorkspace(await m.encodeWorkspace(store.snapshot())));
 assert.equal(JSON.parse(reopened.readPreference('purchaseData-source')).rows.length,1);
 const saved=reopened.snapshot().points[0];assert.equal(saved.data.jira[0].comment,'Correction locale à conserver');assert.equal(saved.data.dossiers[0].action,'Valider jeudi');
 const normalized=m.normalizePointData(saved.data,market.id,market);
 for(const html of [m.buildMailHtml(normalized,market,[]),m.buildInteractiveHtml(normalized,market,[])]){
  assert.match(html,/Correction locale à conserver/);assert.match(html,/Valider jeudi/);assert.match(html,/Nombre de PURCHASES/);assert.doesNotMatch(html,/HORS PERIMETRE/);
 }
 const html=m.buildMailHtml(normalized,market,[]);assert.doesNotMatch(html,/<(?:script|details|select|button)\b/);
 const draft=m.buildMailDraft({...data.mail,html,attachment:{name:'point-test.html',html:m.buildInteractiveHtml(normalized,market,[])}});
 assert.match(draft,/X-Unsent: 1/);assert.match(draft,/To: alex@example.test/);assert.match(draft,/filename="point-test.html"/);
 assert.deepEqual(m.initialData(market.id,market).dossiers,[]);
});
