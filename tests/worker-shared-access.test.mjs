import assert from 'node:assert/strict';
import test from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { readdirSync, readFileSync } from 'node:fs';
import worker from '../dist/server/index.js';

function fixture(t, legacyPolicy) {
  const sqlite = new DatabaseSync(':memory:');
  const migrations = new URL('../drizzle/', import.meta.url);
  for (const name of readdirSync(migrations).filter(name => name.endsWith('.sql')).sort()) sqlite.exec(readFileSync(new URL(name,migrations),'utf8'));
  sqlite.exec("INSERT OR IGNORE INTO market_definitions (id,name,short_code) VALUES ('shared-test','Marché test','TEST')");
  if(legacyPolicy){sqlite.exec("CREATE TABLE app_access_policy (id INTEGER PRIMARY KEY, value TEXT NOT NULL)");sqlite.prepare("INSERT INTO app_access_policy (id,value) VALUES (1,?)").run(JSON.stringify(legacyPolicy));}
  const DB = {
    async exec(query){sqlite.exec(query);},
    prepare(query) {
      const statement = sqlite.prepare(query); let values = [];
      return {bind(...params){values=params;return this;},async first(column){const row=statement.get(...values);return column?row?.[column]??null:row??null;},async all(){return {results:statement.all(...values)};},async raw(){return statement.all(...values).map(row=>Object.values(row));},async run(){return statement.run(...values);}};
    },
    async batch(statements){sqlite.exec('BEGIN');try{const result=[];for(const statement of statements) result.push(await statement.all());sqlite.exec('COMMIT');return result;}catch(error){sqlite.exec('ROLLBACK');throw error;}}
  };
  const env = {DB,MARKET_PULSE_USERNAME:'existing-account',ASSETS:{fetch:async()=>new Response('Not found',{status:404})}};
  const ctx = {waitUntil(){},passThroughOnException(){}};
  t.after(()=>sqlite.close());
  const request=async (path, method='GET', body, cookie='', usercode='A0000001', view='') => {
    const response=await worker.fetch(new Request('https://test.invalid'+path,{method,headers:{'content-type':'application/json','X-Market-USERCODE':usercode,'X-Market-View':view,...(cookie?{cookie}:{})},...(body?{body:JSON.stringify(body)}:{})}),env,ctx);
    return {status:response.status,body:await response.json()};
  };
  request.sqlite=sqlite;return request;
}

test('built Worker permits shared directory, Planner and validation with a declared USERCODE and without a login cookie',async t=>{
 const request=fixture(t);
 const session=await request('/api/session','GET',undefined,'market_pulse_editor=expired');
 assert.equal(session.status,200); assert.equal(session.body.user.username,'existing-account');
 for(const path of ['/api/global-users','/api/planner-tasks']) {const result=await request(path);assert.equal(result.status,200,JSON.stringify(result.body));}
 const invalid=await request('/api/points','POST',{});assert.equal(invalid.status,400);
 const login=await request('/api/login','POST',{});assert.equal(login.status,200);assert.equal(login.body.user.username,'existing-account');
});

test('built Worker saves and reloads a shared draft and point through the full route stack',async t=>{
 const request=fixture(t), data={meetingDate:'2026-10-07',pointName:'Point marché',themeColor:'mint',priority:'Décision sauvegardée sans connexion'};
 const draft=await request('/api/point-drafts','PUT',{scope:'market',ownerId:'shared-test',data,expectedRevision:null,basePoint:null});
 assert.equal(draft.status,200,JSON.stringify(draft.body));
 const save=await request('/api/points','POST',{marketId:'shared-test',marketName:'Marché test',data,expectedPoint:null,draftRevision:draft.body.draft.revision});
 assert.equal(save.status,200,JSON.stringify(save.body));
 const records=await request('/api/points?marketId=shared-test');
 assert.equal(records.status,200);assert.equal(records.body.points[0].data.priority,data.priority);
 const restored=await request('/api/point-drafts?scope=market&ownerId=shared-test&meetingDate=2026-10-07');
 assert.equal(restored.status,200);assert.equal(restored.body.draft.basePoint.revision,save.body.point.revision);assert.equal(restored.body.draft.data.priority,data.priority);
});
test('built Worker persists permission changes, refuses stale updates and prevents elevation in a reduced view',async t=>{
 const request=fixture(t), initial=await request('/api/admin/policy');assert.equal(initial.status,200);
 const policy={...initial.body.policy,'directory.create':'superadmin'};
 assert.equal((await request('/api/admin/policy','PUT',{policy,expected:initial.body.policy})).status,200);
 assert.equal((await request('/api/admin/policy')).body.policy['directory.create'],'superadmin');
 assert.equal((await request('/api/admin/policy','PUT',{policy:initial.body.policy,expected:initial.body.policy})).status,409);
 assert.equal((await request('/api/admin/roles','PUT',{usercode:'B1234567',name:'Admin test',role:'admin'})).status,200);
 assert.equal((await request('/api/admin/policy','GET',undefined,'','B1234567')).status,403);
 assert.equal((await request('/api/admin/policy','GET',undefined,'','B1234567','superadmin')).status,403);
 assert.equal((await request('/api/global-users','POST',{},'','A0000001','reader')).status,403);
 const audit=await request('/api/admin/audit');assert.equal(audit.status,200);assert.ok(audit.body.events.some(e=>e.action==='Règles d’accès modifiées'));
});

test('legacy analyst policy levels migrate to Admin and remain editable with SQL concurrency guard',async t=>{
 const request=fixture(t,{'directory.create':'staff'});const initial=await request('/api/admin/policy');assert.equal(initial.body.policy['directory.create'],'admin');
 const after={...initial.body.policy,'directory.create':'superadmin'};assert.equal((await request('/api/admin/policy','PUT',{policy:after,expected:initial.body.policy})).status,200);assert.equal((await request('/api/admin/policy')).body.policy['directory.create'],'superadmin');
});

test('built Worker persists sales access and denies direct writes or view escalation',async t=>{
 const request=fixture(t);
 assert.equal((await request('/api/admin/roles','PUT',{usercode:'V1234567',name:'Vente test',role:'sales'})).status,200);
 const session=await request('/api/access/session','GET',undefined,'','V1234567');assert.equal(session.body.person.role,'sales');assert.equal(session.body.person.readOnly,true);
 assert.equal((await request('/api/points?marketId=shared-test','GET',undefined,'','V1234567')).status,200);
 for(const [path,method] of [['/api/points','POST'],['/api/point-drafts','PUT'],['/api/point-assets','POST'],['/api/feedback','POST'],['/api/global-users','POST']])assert.equal((await request(path,method,{},'','V1234567')).status,403,path);
 assert.equal((await request('/api/points','POST',{},'','V1234567','superadmin')).status,403);
});

test('built Worker creates Vente profiles, custom roles and dated multi-market history atomically',async t=>{
 const request=fixture(t);const m=await request('/api/markets','POST',{name:'Deuxième marché',shortCode:'SECOND'});assert.equal(m.status,201);const second=m.body.market.id;
 const custom=await request('/api/directory-roles','POST',{label:'Commercial régional',baseRole:'vente'});assert.equal(custom.status,201);
 const assignment={id:'first',roleId:custom.body.role.id,role:'vente',label:'Commercial régional',marketIds:['shared-test',second],from:'2026-01-01',to:''};
 const body={name:'Vente test',email:'vente@example.test',usercode:'V1234567',role:'vente',marketIds:assignment.marketIds,assignments:[assignment]};
 const created=await request('/api/global-users','POST',body);assert.equal(created.status,201,JSON.stringify(created.body));assert.equal(created.body.user.marketIds.length,2);
 assert.equal((await request('/api/access/session','GET',undefined,'','V1234567')).body.person.role,'sales');assert.equal((await request('/api/points','POST',{},'','V1234567')).status,403);
 const p=created.body.user;const changes={...body,id:p.id,profileRevision:p.profileRevision,assignments:[{...assignment,to:'2026-10-31'},{id:'second',roleId:'chef-produit',role:'chef-produit',label:'Chef',marketIds:[second],from:'2026-11-01',to:''}]};
 assert.equal((await request('/api/global-users','PATCH',changes)).status,200);assert.equal((await request('/api/global-users','PATCH',changes)).status,409);
 const future=(await request('/api/global-users?date=2026-11-01')).body.users.find(u=>u.id===p.id);assert.equal(future.role,'chef-produit');assert.equal(future.assignments.length,2);assert.deepEqual(future.marketIds,[second]);
 const unchanged=await request('/api/global-users?date=2026-10-01');assert.deepEqual(unchanged.body.users.find(u=>u.id===p.id).marketIds,['shared-test',second]);
});

 test('built Worker serves Jira analyst comparisons and market weekly completed tickets with read permissions',async t=>{
 const request=fixture(t),db=request.sqlite;
 db.exec("INSERT INTO global_users(id,name,email,jira_name,role) VALUES ('analyst-test','Alex test','alex@example.test','A1234567','analyste-tarif-referentiel'); INSERT INTO global_user_markets(id,user_id,market_id) VALUES ('link-test','analyst-test','shared-test'); INSERT INTO jira_import_batches(id,status,completed_at) VALUES ('batch-test','completed','2026-10-29T10:00:00Z')");
 const insert=db.prepare('INSERT INTO jira_tickets(ticket_key,status,summary,category,subcategory,jira_created_at,assignee_usercode,jira_updated_at,resolution_at) VALUES (?,?,?,?,?,?,?,?,?)');
 insert.run('TEST-1','Fini','TEST - Terminé','Tarifs','Contrôle','2026-10-23T10:00:00','A1234567','2026-10-28T10:00:00','2026-10-27T10:00:00');
 insert.run('TEST-2','En cours','TEST - Ouvert','Référentiel','Création article','2026-10-23T10:00:00','B1234567','2026-10-28T10:00:00','');
 db.exec("INSERT INTO jira_ticket_participants(id,ticket_key,usercode) VALUES ('p-test','TEST-2','A1234567')");
 const url='/api/analyst-activity?from=2026-10-26&to=2026-10-29&compareFrom=2026-10-19&compareTo=2026-10-22';
 const result=await request(url);assert.equal(result.status,200,JSON.stringify(result.body));assert.equal(result.body.report.a.total,2);assert.equal(result.body.report.a.completed,1);assert.equal(result.body.report.a.mean,2);assert.equal(result.body.report.b.total,0);
 assert.equal((await request(url,'GET',undefined,'','U1234567')).status,403);assert.equal((await request('/api/analyst-activity?from=invalid')).status,400);
 const week=await request('/api/jira-week?marketId=shared-test&year=2026&week=44&date=2026-10-29&preferCentral=1');assert.equal(week.status,200);assert.equal(week.body.snapshot.summary.tickets,1);assert.ok(week.body.snapshot.summary.detailedTickets.some(t=>t.key==='TEST-1'));assert.equal(week.body.snapshot.summary.weeklyCoverage.from,'2026-10-26');
 });

 test('built Worker reconstructs end-of-period stock from imported resolution dates and keeps uncertain closures separate',async t=>{
 const request=fixture(t),db=request.sqlite;
 db.exec("INSERT INTO global_users(id,name,email,jira_name,role) VALUES ('stock-analyst','Alex test','stock@example.test','A1234567','analyste-tarif-referentiel'); INSERT INTO jira_import_batches(id,status,completed_at) VALUES ('stock-batch','completed','2026-11-02T10:00:00Z')");
 const insert=db.prepare('INSERT INTO jira_tickets(ticket_key,status,summary,category,jira_created_at,assignee_usercode,jira_updated_at,resolution_at) VALUES (?,?,?,?,?,?,?,?)');
 insert.run('TEST-20','Fini','Terminé plus tard','Tarifs','2026-09-01T10:00:00','A1234567','2026-11-02T10:00:00','2026-11-01T10:00:00');insert.run('TEST-21','Fini','Date absente','Tarifs','2026-09-01T10:00:00','A1234567','2026-10-28T10:00:00','');
 const r=await request('/api/analyst-activity?from=2026-10-26&to=2026-10-29&compareFrom=2026-10-19&compareTo=2026-10-22&basis=stock');assert.equal(r.status,200,JSON.stringify(r.body));assert.equal(r.body.report.a.stockAtEnd,1);assert.equal(r.body.report.a.stockUnknown,1);assert.equal(r.body.report.a.total,1);assert.equal(r.body.report.a.rows[0].key,'TEST-20');assert.equal(r.body.report.b.stockAtEnd,1);
 });

test('built Worker global Jira page includes unassigned tickets and refreshes cache after request or import',async t=>{
 const request=fixture(t),db=request.sqlite;
 db.exec("INSERT INTO jira_import_batches(id,status,completed_at) VALUES ('global-batch','completed','2026-10-29T10:00:00Z')");
 const insert=db.prepare('INSERT INTO jira_tickets(ticket_key,status,summary,jira_created_at,jira_updated_at) VALUES (?,?,?,?,?)');
 insert.run('GLOBAL-1','En cours','Sans analyste','2026-09-01','2026-10-28');
 const url='/api/jira-activity?from=2026-10-26&to=2026-10-29&compareFrom=2026-10-19&compareTo=2026-10-22';
 assert.equal((await request(url)).body.report.a.total,1);
 const analyst=await request(url.replace('/jira-activity','/analyst-activity'));assert.equal(analyst.body.report.a.total,0);
 insert.run('GLOBAL-2','En cours','Ajout','2026-09-01','2026-10-28');
 assert.equal((await request(url+'&refresh=1')).body.report.a.total,2);
 insert.run('GLOBAL-3','En cours','Import suivant','2026-09-01','2026-10-28');
 db.exec("INSERT INTO jira_import_batches(id,status,completed_at) VALUES ('global-next','completed','2026-10-29T11:00:00Z')");
 assert.equal((await request(url)).body.report.a.total,3);
 assert.equal((await request(url,'GET',undefined,'','U1234567')).status,403);
});

test('Jira CSV Terminée reaches hosted registry and working-day KPIs through the complete import workflow',async t=>{
 const request=fixture(t);
 const {moduleUrl}=await import('./helpers/module-url.mjs');const {parseJiraCsv}=await import(moduleUrl('../../lib/jira-csv.ts'));
 const parsed=parseJiraCsv('Clé de ticket;État;Résumé;Création;Mise à jour;Terminée\nTEST-700;Fini;Date fin réelle;23/10/2026;29/10/2026;27/10/2026');
 const start=await request('/api/jira-imports','POST',{action:'start',filename:'fixture.csv',rowCount:1});assert.equal(start.status,201,JSON.stringify(start.body));
 const importId=start.body.batch.id;
 const chunk=await request('/api/jira-imports','POST',{action:'chunk',importId,tickets:parsed.tickets});assert.equal(chunk.status,200,JSON.stringify(chunk.body));
 const finish=await request('/api/jira-imports','POST',{action:'finish',importId});assert.equal(finish.status,200,JSON.stringify(finish.body));
 const stats=await request('/api/jira-activity?from=2026-10-26&to=2026-10-29&compareFrom=2026-10-19&compareTo=2026-10-22&basis=stock');assert.equal(stats.status,200,JSON.stringify(stats.body));
 assert.equal(stats.body.report.a.resolution.sample,1);assert.equal(stats.body.report.a.resolution.mean,2);assert.equal(stats.body.report.a.resolution.missingResolution,0);assert.equal(stats.body.report.b.resolution.mean,null);
 assert.equal(request.sqlite.prepare("SELECT resolution_at FROM jira_tickets WHERE ticket_key='TEST-700'").get().resolution_at,'2026-10-27T00:00:00');
});
