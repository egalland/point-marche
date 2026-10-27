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
  return async (path, method='GET', body, cookie='', usercode='A0000001', view='') => {
    const response=await worker.fetch(new Request('https://test.invalid'+path,{method,headers:{'content-type':'application/json','X-Market-USERCODE':usercode,'X-Market-View':view,...(cookie?{cookie}:{})},...(body?{body:JSON.stringify(body)}:{})}),env,ctx);
    return {status:response.status,body:await response.json()};
  };
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
