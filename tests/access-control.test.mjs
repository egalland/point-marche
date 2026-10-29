import test from 'node:test';
import assert from 'node:assert/strict';
import { moduleUrl } from './helpers/module-url.mjs';
const { accessRequest, resolvePerson, effectivePerson, allowedViews, hasPermission, canView, canRequest, defaultPolicy, ROOT_ADMIN } = await import(moduleUrl('../../lib/access-control.ts'));
function fixture() {
 const roles=[], events=[];let policy=defaultPolicy();
 const store={directory:async()=>[{usercode:'A1234567',name:'Analyste',role:'analyste-tarif-referentiel'},{usercode:'M1234567',name:'Manager',role:'manager-tarif'}],roles:async()=>roles,setRole:async p=>{const i=roles.findIndex(x=>x.usercode===p.usercode);if(i<0)roles.push(p);else roles[i]=p;},append:async e=>{events.push(e);},events:async()=>events,policy:async()=>policy,setPolicy:async(next,expected)=>{if(JSON.stringify(policy)!==JSON.stringify(expected))return false;policy=next;return true;}};
 return {events,roles,store,call:async(usercode,path,method='GET',body,view='')=>accessRequest(new Request('https://test.invalid'+path,{method,headers:{'X-Market-USERCODE':usercode,'X-Market-View':view,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})}),store,async()=>Response.json({ok:true}))};
}
test('access roles are separate from jobs; migration retains staff access and immutable root',()=>{
 assert.equal(resolvePerson(ROOT_ADMIN,[],[{usercode:ROOT_ADMIN,name:'E',role:'user'}]).role,'superadmin');
 assert.equal(resolvePerson('X1234567',[],[]).role,'user');
 const legacy=resolvePerson('A1234567',[],[{usercode:'A1234567',name:'A',role:'analyst'}]);assert.equal(legacy.role,'admin');assert.equal(legacy.jobRole,'analyste-tarif-referentiel');
 for(const jobRole of ['analyste-tarif-referentiel','manager-tarif'])for(const view of ['analyst','settings','imports'])assert.equal(canView({role:'admin',jobRole},view),true);
 for(const view of ['analyst','settings','imports','admin','superadmin'])assert.equal(canView('user',view),false);
 assert.equal(canView('admin','superadmin'),false);
});
test('direct APIs and analyst drafts enforce roles; denials are recorded',async()=>{
 const f=fixture();assert.equal((await f.call('','/api/session')).status,401);
 for(const path of ['/api/admin/audit','/api/admin/roles','/api/analyst-points','/api/point-drafts?scope=analyst','/api/feedback'])assert.equal((await f.call('U1234567',path)).status,403);
 for(const path of ['/api/planner-tasks','/api/purchaseData','/api/global-users','/api/markets','/api/jira-imports','/api/feedback-settings'])assert.equal((await f.call('U1234567',path,'POST',{x:1})).status,403);
 assert.equal((await f.call('U1234567','/api/point-drafts','PUT',{scope:'analyst'})).status,403);
 assert.equal((await f.call('A1234567','/api/analyst-points')).status,200);
 for(const usercode of ['A1234567','M1234567'])assert.equal((await f.call(usercode,'/api/global-users','POST',{x:1})).status,200);
 assert.ok(f.events.filter(e=>e.status===403).length>=10);
});
test('only superadmins can assign roles and policies; root cannot be demoted',async()=>{
 const f=fixture();assert.equal((await f.call(ROOT_ADMIN,'/api/admin/roles','PUT',{usercode:'B1234567',name:'Admin',role:'admin'})).status,200);
 assert.equal((await f.call('B1234567','/api/admin/audit')).status,200);
 assert.equal((await f.call('B1234567','/api/admin/roles','PUT',{usercode:'C1234567',name:'C',role:'superadmin'})).status,403);
 assert.equal((await f.call(ROOT_ADMIN,'/api/admin/roles','PUT',{usercode:'C1234567',name:'C',role:'superadmin'})).status,200);
 assert.equal((await f.call('C1234567','/api/admin/roles','PUT',{usercode:ROOT_ADMIN,name:'Utilisateur Exemple',role:'user'})).status,409);
 assert.equal((await f.call('B1234567','/api/admin/policy')).status,403);
 assert.equal((await f.call('B1234567','/api/admin/audit','DELETE')).status,405);
});
test('view switching can only reduce permissions, including direct writes and feedback management',async()=>{
 const f=fixture();await f.call(ROOT_ADMIN,'/api/admin/roles','PUT',{usercode:'B1234567',name:'Admin',role:'admin'});
 assert.deepEqual(allowedViews('superadmin'),['superadmin','admin','reader']);assert.equal(effectivePerson({role:'admin'},'superadmin'),null);
 assert.equal((await f.call('B1234567','/api/points','POST',{},'superadmin')).status,403);
 assert.equal((await f.call(ROOT_ADMIN,'/api/admin/roles','GET',undefined,'admin')).status,403);
 for(const path of ['/api/points','/api/point-drafts','/api/global-users','/api/feedback-settings'])assert.equal((await f.call(ROOT_ADMIN,path,'POST',{scope:'market'},'reader')).status,403);
 assert.equal((await f.call(ROOT_ADMIN,'/api/feedback','PATCH',{id:'x'},'reader')).status,403);
 assert.equal((await f.call(ROOT_ADMIN,'/api/points','GET',undefined,'reader')).status,200);
 assert.equal((await f.call(ROOT_ADMIN,'/api/feedback','POST',{title:'Bug'},'reader')).status,200);
 assert.equal((await f.call('B1234567','/api/admin/audit','GET',undefined,'reader')).status,403);
});
test('policy changes apply immediately, detect stale saves and keep superadmin recovery',async()=>{
 const f=fixture(), before=defaultPolicy(), after={...before,'directory.create':'superadmin','feedback.manage':'admin','audit.read':'superadmin'};
 assert.equal((await f.call(ROOT_ADMIN,'/api/admin/policy','PUT',{policy:after,expected:before})).status,200);
 assert.equal((await f.call('A1234567','/api/global-users','POST',{})).status,403);
 assert.equal((await f.call('A1234567','/api/feedback','PATCH',{})).status,200);
 assert.equal((await f.call(ROOT_ADMIN,'/api/admin/policy','PUT',{policy:before,expected:before})).status,409);
 assert.equal(hasPermission({role:'superadmin'},'point.read',{...after,'point.read':'superadmin'}),true);
 assert.equal((await f.call(ROOT_ADMIN,'/api/admin/policy','PUT',{policy:{},expected:after})).status,400);
 assert.ok(f.events.some(e=>e.action==='Règles d’accès modifiées'));
});
test('activity retains real author; errors and conflicts retain their status',async()=>{
 const f=fixture();await f.call('U1234567','/api/activity','POST',{action:'Export',target:'Point',usercode:ROOT_ADMIN});assert.equal(f.events.at(-1).usercode,'U1234567');
 const req=new Request('https://test.invalid/api/points',{headers:{'X-Market-USERCODE':'A1234567'}});assert.equal((await accessRequest(req,f.store,async()=>Response.json({conflict:true},{status:409}))).status,409);assert.equal(f.events.at(-1).status,409);
 assert.equal(canRequest('user','/api/planner-tasks','GET'),true);
});

test('analysts and manager resolve to Admin with identical permissions; explicit directory checkbox can remove Admin',()=>{
 for(const jobRole of ['analyste-tarif-referentiel','manager-tarif']){const p=resolvePerson('A1234567',[{usercode:'A1234567',name:'A',role:jobRole}],[]);assert.equal(p.role,'admin');for(const permission of Object.keys(defaultPolicy()))assert.equal(hasPermission(p,permission),hasPermission({role:'admin'},permission));}
 const p=resolvePerson('A1234567',[{usercode:'A1234567',name:'A',role:'analyste-tarif-referentiel'}],[{usercode:'A1234567',name:'A',role:'user'}]);assert.equal(p.role,'user');assert.equal(hasPermission(p,'admin.open'),false);
});
test('directory checkbox changes are superadmin-only, retain root and refuse stale role edits',async()=>{
 const f=fixture();assert.equal((await f.call('A1234567','/api/admin/roles','PUT',{usercode:'M1234567',name:'M',role:'superadmin'})).status,403);
 assert.equal((await f.call(ROOT_ADMIN,'/api/admin/roles','PUT',{usercode:'A1234567',name:'A',role:'superadmin',expectedRole:'admin'})).status,200);
 assert.equal((await f.call(ROOT_ADMIN,'/api/admin/roles','PUT',{usercode:'A1234567',name:'A',role:'user',expectedRole:'admin'})).status,409);
 assert.equal((await f.call(ROOT_ADMIN,'/api/admin/roles','PUT',{usercode:'A1234567',name:'A',role:'admin',expectedRole:'superadmin'})).status,200);
});


test('analyst activity follows analyst access while data tabs and mail settings retain their policy',()=>{
 for(const role of ['admin','superadmin'])for(const view of ['analyst','analyst-activity'])assert.equal(canView(role,view),true);
 assert.equal(canView('user','analyst-activity'),false);
 const policy={...defaultPolicy(),'analyst.read':'superadmin'};
 assert.equal(canView('admin','analyst-activity',policy),false);
 assert.equal(canView('superadmin','analyst-activity',policy),true);
 assert.equal(canView('user','stats'),true);
 assert.equal(hasPermission({role:'user'},'settings.mail'),false);
 assert.equal(hasPermission({role:'admin'},'settings.mail'),true);
});

test('sales job and assigned sales role enforce read-only permissions even with permissive policy',async()=>{
 const job=resolvePerson('V1234567',[{usercode:'V1234567',name:'Vente',role:'vente'}],[{usercode:'V1234567',name:'Vente',role:'superadmin'}]);
 assert.equal(job.role,'sales');assert.equal(job.readOnly,true);assert.deepEqual(allowedViews('sales'),['sales']);assert.equal(effectivePerson(job,'admin'),null);
 const assigned=resolvePerson('V1234567',[],[{usercode:'V1234567',name:'Vente',role:'sales'}]);assert.equal(assigned.readOnly,true);
 const policy=Object.fromEntries(Object.keys(defaultPolicy()).map(k=>[k,'user']));
 for(const person of [job,assigned,{role:'sales'}]){
  for(const permission of ['point.read','stats.read','suppliers.read','exports.html'])assert.equal(hasPermission(person,permission,policy),true);
  for(const permission of ['point.edit','point.assets','directory.edit','imports.planner','settings.open','feedback.submit','admin.open'])assert.equal(hasPermission(person,permission,policy),false);
 }
 const f=fixture();assert.equal((await f.call(ROOT_ADMIN,'/api/admin/roles','PUT',{usercode:'V1234567',name:'Vente',role:'sales'})).status,200);
 assert.equal((await f.call('V1234567','/api/points')).status,200);
 for(const [path,method] of [['/api/points','POST'],['/api/point-drafts','PUT'],['/api/point-assets','POST'],['/api/feedback','POST'],['/api/planner-tasks','POST'],['/api/unknown','POST']])assert.equal((await f.call('V1234567',path,method,{})).status,403,path);
 assert.equal((await f.call('V1234567','/api/points','POST',{},'user')).status,403);
 assert.equal((await f.call('V1234567','/api/activity','POST',{action:'Lecture'})).status,200);
 assert.equal((await f.call(ROOT_ADMIN,'/api/admin/roles','PUT',{usercode:'V1234567',name:'Vente',role:'user',expectedRole:'sales'})).status,200);
});

test('an expired assignment cannot inherit editing from a saved administrator override',()=>{
 const p=resolvePerson('A1234567',[{usercode:'A1234567',name:'Test',role:'autre',profileInactive:true}],[{usercode:'A1234567',name:'Test',role:'admin'}]);
 assert.equal(p.readOnly,true);assert.equal(hasPermission(p,'point.read'),true);assert.equal(hasPermission(p,'point.edit'),false);assert.equal(hasPermission(p,'directory.create'),false);
});

 test('Jira standalone page uses analyst read authorization independently of point editing',()=>{
 assert.equal(canView('admin','jira'),true);assert.equal(canView('user','jira'),false);assert.equal(canView('sales','jira'),false);
 });
