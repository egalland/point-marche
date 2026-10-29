import {isIsoDate} from './iso-week';
import {isAbandonedJiraStatus,isClosedJiraStatus,type JiraDetailedTicket} from './jira-import';
import {jiraCompletionDate} from './jira-point-activity';
import {workingDays} from './jira-market-kpis';
import {directoryPersonAt,hasAnalystHistory} from './directory-profiles';
import type {GlobalDirectoryUser} from './global-directory';
import {selectMarketTickets} from './jira-market-scope';
export type JiraStatsMarket={id:string;short?:string;shortCode?:string;shortLabel?:string;plannerTags?:string[]};
export type JiraStatsQuery={a:{from:string;to:string};b:{from:string;to:string};marketId:string;analystIds:string[];category:string;subcategory:string;status:string;basis:'activity'|'created'|'updated'|'resolved';involvement:'both'|'assigned'|'participant';sort:'date'|'key'|'category'|'subcategory'|'status'|'analyst'|'delay';direction:'asc'|'desc';detailPeriod:'a'|'b';page:number};
export function parseJiraStatsQuery(url:URL):JiraStatsQuery{
 const p=url.searchParams,a={from:p.get('from')??'',to:p.get('to')??''},b={from:p.get('compareFrom')??'',to:p.get('compareTo')??''};
 for(const r of [a,b])if(!isIsoDate(r.from)||!isIsoDate(r.to)||r.from>r.to||Date.parse(r.to)-Date.parse(r.from)>3660*86400000)throw Error('Choisis deux périodes valides de dix ans maximum.');
 const one=<T extends string>(key:string,values:readonly T[],fallback:T):T=>values.includes(p.get(key) as T)?p.get(key) as T:fallback;
 return {a,b,marketId:p.get('marketId')||'all',analystIds:(p.get('analysts')||'').split(',').filter(Boolean).slice(0,100),category:p.get('category')||'all',subcategory:p.get('subcategory')||'all',status:p.get('status')||'all',basis:one('basis',['activity','created','updated','resolved'],'activity'),involvement:one('involvement',['both','assigned','participant'],'both'),sort:one('sort',['date','key','category','subcategory','status','analyst','delay'],'date'),direction:one('direction',['asc','desc'],'desc'),detailPeriod:one('detailPeriod',['a','b'],'a'),page:Math.max(0,Math.min(100000,Math.floor(Number(p.get('page'))||0)))};
}
const bucket=(values:string[])=>{const m=new Map<string,number>();for(const v of values)m.set(v,(m.get(v)??0)+1);return [...m].map(([label,value])=>({label,value})).sort((a,b)=>b.value-a.value||a.label.localeCompare(b.label,'fr'));};
export function buildAnalystJiraStats(input:JiraDetailedTicket[],users:GlobalDirectoryUser[],markets:JiraStatsMarket[],q:JiraStatsQuery){
 const analysts=users.filter(hasAnalystHistory).filter(u=>/^[A-Z]\d{7}$/i.test(u.usercode));
 const chosen=analysts.filter(u=>!q.analystIds.length||q.analystIds.includes(u.id));
 const unique=[...new Map(input.map(t=>[t.key,t])).values()].filter(t=>!isAbandonedJiraStatus(t.status));
 const involved=(t:JiraDetailedTicket)=>chosen.filter(u=>q.involvement!=='participant'&&t.assigneeUserCode.toUpperCase()===u.usercode.toUpperCase()||q.involvement!=='assigned'&&t.participants?.some(p=>p.usercode.toUpperCase()===u.usercode.toUpperCase()));
 const base=unique.filter(t=>involved(t).length>0);
 const report=(range:{from:string;to:string})=>{
  let scoped=base;
  if(q.marketId!=='all'){const market=markets.find(m=>m.id===q.marketId);const people=users.map(u=>directoryPersonAt(u,range.to)).filter(u=>u.marketIds.includes(q.marketId));scoped=market?selectMarketTickets(scoped,market,markets,new Map(people.map(u=>[u.usercode.toUpperCase(),u.name]))):[];}
  const filtered=scoped.filter(t=>(q.category==='all'||(t.category?.trim()||'Non renseignée')===q.category)&&(q.subcategory==='all'||(t.subcategory?.trim()||'Non renseignée')===q.subcategory)&&(q.status==='all'||t.status===q.status));
  const dateFor=(t:JiraDetailedTicket)=>q.basis==='created'?t.createdAt.slice(0,10):q.basis==='updated'?t.updatedAt.slice(0,10):q.basis==='resolved'?(isClosedJiraStatus(t.status)?t.resolutionAt?.slice(0,10)??'':''):isClosedJiraStatus(t.status)?jiraCompletionDate(t)?.date??'':t.updatedAt.slice(0,10);
  const selected=filtered.filter(t=>{const d=dateFor(t);return isIsoDate(d)&&d>=range.from&&d<=range.to;});
  const completed=selected.filter(t=>isClosedJiraStatus(t.status)),delays=completed.flatMap(t=>{const d=workingDays(t.createdAt,t.resolutionAt??'');return d===null?[]:[d];}).sort((a,b)=>a-b);
  const rows=selected.map(t=>({...t,date:dateFor(t),analyst:involved(t).map(u=>u.name).join(' · '),delay:isClosedJiraStatus(t.status)?workingDays(t.createdAt,t.resolutionAt??''):null,fallbackDate:q.basis==='activity'&&isClosedJiraStatus(t.status)&&!!jiraCompletionDate(t)?.fallback}));
  rows.sort((a,b)=>{const av=q.sort==='date'?a.date:q.sort==='delay'?a.delay:a[q.sort]??'',bv=q.sort==='date'?b.date:q.sort==='delay'?b.delay:b[q.sort]??'';if(av===null)return bv===null?0:1;if(bv===null)return -1;const d=typeof av==='number'&&typeof bv==='number'?av-bv:String(av).localeCompare(String(bv),'fr',{numeric:true,sensitivity:'base'});return (q.direction==='asc'?d:-d)||a.key.localeCompare(b.key);});
  return {total:selected.length,completed:completed.length,open:selected.length-completed.length,mean:delays.length?delays.reduce((a,b)=>a+b,0)/delays.length:null,median:delays.length?(delays[Math.floor((delays.length-1)/2)]+delays[Math.floor(delays.length/2)])/2:null,datedResolved:delays.length,fallbackDates:rows.filter(r=>r.fallbackDate).length,undated:filtered.filter(t=>!isIsoDate(dateFor(t))).length,charts:{category:bucket(selected.map(t=>t.category?.trim()||'Non renseignée')),subcategory:bucket(selected.map(t=>t.subcategory?.trim()||'Non renseignée')),status:bucket(selected.map(t=>t.status)),analyst:bucket(selected.flatMap(t=>involved(t).map(u=>u.name)))},rows};
 };
 const a=report(q.a),b=report(q.b),pages=Math.max(1,Math.ceil((q.detailPeriod==='b'?b:a).rows.length/50)),page=Math.min(q.page,pages-1);
 return {a:{...a,rows:a.rows.slice(page*50,(page+1)*50)},b:{...b,rows:b.rows.slice(page*50,(page+1)*50)},page,pages,pageSize:50,options:{categories:[...new Set(base.map(t=>t.category?.trim()||'Non renseignée'))].sort(),subcategories:[...new Set(base.filter(t=>q.category==='all'||(t.category?.trim()||'Non renseignée')===q.category).map(t=>t.subcategory?.trim()||'Non renseignée'))].sort(),statuses:[...new Set(base.map(t=>t.status))].sort()},analystCount:chosen.length};
}
export type AnalystJiraStats=ReturnType<typeof buildAnalystJiraStats>;
