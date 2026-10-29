import {directoryDb,directoryRoles,directoryUsersAt} from '../../../lib/directory-store';
import {directoryPersonAt,validateAssignments,legacyAssignment,type ProfiledUser} from '../../../lib/directory-profiles';
import {isGlobalRole,roleUsesAutomaticJira,type GlobalRole} from '../../../lib/global-directory';
import {isIsoDate} from '../../../lib/iso-week';
const clean=(v:unknown,max=100)=>typeof v==='string'?v.trim().replace(/\s+/g,' ').slice(0,max):'';
export async function GET(request:Request){try{const date=new URL(request.url).searchParams.get('date')||undefined;if(date&&!isIsoDate(date))return Response.json({error:'Date invalide.'},{status:400});return Response.json({users:await directoryUsersAt(date)},{headers:{'Cache-Control':'no-store'}});}catch(e){return Response.json({error:e instanceof Error?e.message:'Annuaire indisponible.'},{status:503});}}
async function save(request:Request,creating:boolean){
 try{
  const body=await request.json(),db=await directoryDb(),users=await directoryUsersAt();
  const name=clean(body.name),email=clean(body.email,180).toLowerCase(),usercode=clean(body.usercode).toUpperCase();
  if(!name||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw Error('Nom et adresse e-mail valide requis.');
  const old=creating?undefined:users.find(u=>u.id===body.id);if(!creating&&!old)return Response.json({error:'Personne introuvable.'},{status:404});
  if(users.some(u=>u.id!==old?.id&&(u.email===email||(usercode&&u.usercode===usercode))))return Response.json({error:'Cette adresse e-mail ou ce USERCODE existe déjà dans l’annuaire.'},{status:409});
  const role:GlobalRole=isGlobalRole(body.role)?body.role:'autre';
  const activeMarkets=(await db.prepare('SELECT id FROM market_definitions WHERE is_active = 1').all<{id:string}>()).results.map(m=>m.id);
  if(old?.assignments&&!body.assignments)throw Error('Recharge la fiche pour conserver son historique de rôles.');
  const assignments=validateAssignments(body.assignments??[legacyAssignment({role,marketIds:Array.isArray(body.marketIds)?body.marketIds:body.marketId?[body.marketId]:[]})],await directoryRoles(),activeMarkets);
  if(old?.assignments?.some(a=>!assignments.some(n=>n.id===a.id)))throw Error("Les anciennes périodes doivent être conservées.");
  if((usercode||assignments.some(a=>roleUsesAutomaticJira(a.role)||a.role==='vente'))&&!/^[A-Z]\d{7}$/.test(usercode))throw Error('Un USERCODE valide (une lettre et 7 chiffres) est requis, notamment pour le profil Vente.');
  const person=directoryPersonAt({role,marketIds:[] as string[],assignments});
  if(person.role==='manager-tarif'&&users.some(u=>u.id!==old?.id&&u.role==='manager-tarif'))return Response.json({error:'Un manager Tarif est déjà actif.'},{status:409});
  if(old?.profileRevision!==body.profileRevision)return Response.json({error:'Cette fiche a changé. Recharge-la avant de réessayer.'},{status:409});
  const id=old?.id??crypto.randomUUID(),revision=crypto.randomUUID(),serialized=JSON.stringify(assignments);
  const gate='EXISTS (SELECT 1 FROM app_directory_profiles WHERE person_id = ? AND revision = ?)';
  const statements=[old?.profileRevision?db.prepare('UPDATE app_directory_profiles SET payload = ?, revision = ? WHERE person_id = ? AND revision = ?').bind(serialized,revision,id,old.profileRevision):db.prepare('INSERT OR IGNORE INTO app_directory_profiles (person_id,payload,revision) VALUES (?,?,?)').bind(id,serialized,revision)];
  statements.push(db.prepare(`INSERT INTO global_users (id,name,email,jira_name,planner_alias,role,is_active) SELECT ?,?,?,?,?,?,1 WHERE ${gate} ON CONFLICT(id) DO UPDATE SET name=excluded.name,email=excluded.email,jira_name=excluded.jira_name,planner_alias=excluded.planner_alias,role=excluded.role,is_active=1,updated_at=CURRENT_TIMESTAMP`).bind(id,name,email,usercode,clean(body.plannerAlias,80),person.role,id,revision));
  statements.push(db.prepare(`DELETE FROM global_user_markets WHERE user_id = ? AND ${gate}`).bind(id,id,revision));
  for(const marketId of person.marketIds)statements.push(db.prepare(`INSERT INTO global_user_markets (id,user_id,market_id) SELECT ?,?,? WHERE ${gate}`).bind(crypto.randomUUID(),id,marketId,id,revision));
  statements.push(db.prepare(`DELETE FROM jira_market_assignments WHERE (assignee = ? OR assignee = ?) AND ${gate}`).bind(old?.usercode??usercode,usercode,id,revision));
  if(usercode)for(const marketId of person.marketIds)statements.push(db.prepare(`INSERT OR IGNORE INTO jira_market_assignments (id,market_id,assignee) SELECT ?,?,? WHERE ${gate}`).bind(crypto.randomUUID(),marketId,usercode,id,revision));
  await db.batch(statements);
  const stored=await db.prepare('SELECT revision FROM app_directory_profiles WHERE person_id = ?').bind(id).first<{revision:string}>();if(stored?.revision!==revision)return Response.json({error:'Cette fiche a changé. Recharge-la.'},{status:409});
  const all=await directoryUsersAt();return Response.json({user:all.find(u=>u.id===id),users:all},{status:creating?201:200});
 }catch(e){const msg=e instanceof Error?e.message:'Enregistrement impossible.';return Response.json({error:/unique/i.test(msg)?'Cette adresse e-mail existe déjà.':msg},{status:400});}
}
export const POST=(r:Request)=>save(r,true);
export const PATCH=(r:Request)=>save(r,false);
export async function DELETE(request:Request){try{const id=new URL(request.url).searchParams.get('id');const db=await directoryDb();const person=(await directoryUsersAt()).find(u=>u.id===id);if(!person)return Response.json({error:'Personne introuvable.'},{status:404});await db.batch([db.prepare('UPDATE global_users SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?').bind(id),db.prepare('DELETE FROM global_user_markets WHERE user_id = ?').bind(id),db.prepare('DELETE FROM jira_market_assignments WHERE assignee = ?').bind(person.usercode)]);return Response.json({removedId:id,users:await directoryUsersAt()});}catch{return Response.json({error:'Suppression impossible.'},{status:500});}}
