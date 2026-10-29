import { GLOBAL_ROLE_OPTIONS, isGlobalRole, type GlobalRole, type GlobalDirectoryUser } from './global-directory';
import { isIsoDate, addIsoDays } from './iso-week';
export type JobRole = {id:string;label:string;baseRole:GlobalRole};
export type DirectoryAssignment = {id:string;roleId:string;role:GlobalRole;label:string;marketIds:string[];from:string;to:string};
export const builtinJobRoles:JobRole[]=GLOBAL_ROLE_OPTIONS.map(r=>({id:r.id,label:r.label,baseRole:r.id}));
export const profileToday=()=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Paris'}).format(new Date());
export function directoryPersonAt<T extends {role:string;marketIds?:string[];assignments?:DirectoryAssignment[]}>(person:T,date=profileToday()):T {
 if(!person.assignments?.length)return person;
 const active=person.assignments.find(a=>(!a.from||a.from<=date)&&(!a.to||a.to>=date));
 return {...person,role:active?.role??'autre',marketIds:active?.marketIds??[],jobLabel:active?.label??'Aucune affectation active',profileInactive:!active};
}
export function legacyAssignment(person:{role:GlobalRole;marketIds:string[]}):DirectoryAssignment{return {id:'initial',roleId:person.role,role:person.role,label:builtinJobRoles.find(r=>r.id===person.role)?.label??person.role,marketIds:[...person.marketIds],from:'',to:''};}
export function validateAssignments(raw:unknown,roles:JobRole[],markets:string[]):DirectoryAssignment[]{
 if(!Array.isArray(raw)||!raw.length||raw.length>100)throw Error('Ajoute entre 1 et 100 périodes de rôle.');
 const ids=new Set<string>();
 const result=raw.map(v=>{
  if(!v||typeof v!=='object')throw Error('Période de rôle invalide.');
  const role=roles.find(r=>r.id===v.roleId);if(!role)throw Error('Rôle inconnu. Recharge la liste des rôles.');
  if(typeof v.id!=='string'||!v.id||v.id.length>80||ids.has(v.id))throw Error('Identifiant de période invalide ou en double.');ids.add(v.id);
  const from=typeof v.from==='string'?v.from:'',to=typeof v.to==='string'?v.to:'';
  if((from&&!isIsoDate(from))||(to&&!isIsoDate(to))||(from&&to&&from>to))throw Error('Dates de validité invalides : le début doit précéder la fin.');
  if(!Array.isArray(v.marketIds)||v.marketIds.some((id:unknown)=>typeof id!=='string'||!markets.includes(id as string)))throw Error('Un marché de cette période est inconnu ou inactif.');
  const marketIds=[...new Set<string>(v.marketIds)];
  if(['chef-produit','chef-marche','analyste-tarif-referentiel'].includes(role.baseRole)&&!marketIds.length)throw Error('Choisis au moins un marché pour ce rôle.');
  return {id:v.id.slice(0,80),roleId:role.id,role:role.baseRole,label:role.label,marketIds,from,to};
 }).sort((a,b)=>a.from.localeCompare(b.from));
 for(let i=1;i<result.length;i++)if(!result[i-1].to||!result[i].from||result[i].from<=result[i-1].to)throw Error('Les périodes de rôle se chevauchent. Termine la période précédente avant la suivante.');
 return result;
}
export function nextAssignment(items:DirectoryAssignment[],from=profileToday()):DirectoryAssignment[]{
 const ended=items.map(a=>(!a.from||a.from<from)&&(!a.to||a.to>=from)?{...a,to:addIsoDays(from,-1)}:a);
 return [...ended,{id:crypto.randomUUID(),roleId:'autre',role:'autre',label:'Autre rôle',marketIds:[],from,to:''}];
}
export function parseJobRole(raw:unknown):JobRole {
 const v=raw as Partial<JobRole>;if(!v||typeof v.label!=='string'||!v.label.trim()||v.label.trim().length>80||!isGlobalRole(String(v.baseRole)))throw Error('Nom de rôle (80 caractères maximum) et fonctionnement de référence requis.');
 return {id:'job-'+crypto.randomUUID(),label:v.label.trim(),baseRole:v.baseRole as GlobalRole};
}
export type ProfiledUser=GlobalDirectoryUser&{assignments?:DirectoryAssignment[];profileRevision?:string;jobLabel?:string};

export const hasAnalystHistory=(person:{role:string;assignments?:DirectoryAssignment[]})=>person.role==='analyste-tarif-referentiel'||Boolean(person.assignments?.some(a=>a.role==='analyste-tarif-referentiel'));
