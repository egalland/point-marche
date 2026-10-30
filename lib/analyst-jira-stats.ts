import {isIsoDate,isoWeekForDate,addIsoDays} from './iso-week';
import {type JiraDetailedTicket} from './jira-import';
import {jiraResolutionSample} from './jira-market-kpis';
import {directoryPersonAt,hasAnalystHistory} from './directory-profiles';
import type {GlobalDirectoryUser} from './global-directory';
import {marketSpecialties} from './jira-market-scope';
import {prepareJiraAnalytics,preparedJiraStock,type PreparedJiraAnalytics} from './jira-analytics-source';
export type JiraStatsMarket={id:string;short?:string;shortCode?:string;shortLabel?:string;plannerTags?:string[]};
export type JiraStatsQuery={scope?:"registry"|"analysts";a:{from:string;to:string};b:{from:string;to:string};marketId:string;marketIds?:string[];analystIds:string[];category:string;subcategory:string;status:string;basis:'activity'|'created'|'updated'|'resolved'|'stock';involvement:'both'|'assigned'|'participant';sort:'date'|'key'|'category'|'subcategory'|'status'|'analyst'|'createdAt'|'resolutionAt'|'delay';direction:'asc'|'desc';detailPeriod:'a'|'b';page:number};
export function parseJiraStatsQuery(url:URL):JiraStatsQuery{
 const p=url.searchParams,a={from:p.get('from')??'',to:p.get('to')??''},b={from:p.get('compareFrom')??'',to:p.get('compareTo')??''};
 for(const r of [a,b])if(!isIsoDate(r.from)||!isIsoDate(r.to)||r.from>r.to||Date.parse(r.to)-Date.parse(r.from)>3660*86400000)throw Error('Choisis deux périodes valides de dix ans maximum.');
 const one=<T extends string>(key:string,values:readonly T[],fallback:T):T=>values.includes(p.get(key) as T)?p.get(key) as T:fallback;
 return {a,b,marketId:p.get('marketId')||'all',marketIds:[...new Set((p.get('markets')||'').split(',').map(v=>v.trim()).filter(Boolean))].slice(0,100),analystIds:(p.get('analysts')||'').split(',').filter(Boolean).slice(0,100),category:p.get('category')||'all',subcategory:p.get('subcategory')||'all',status:p.get('status')||'all',basis:one('basis',['activity','created','updated','resolved','stock'],'activity'),involvement:one('involvement',['both','assigned','participant'],'both'),sort:one('sort',['date','key','category','subcategory','status','analyst','createdAt','resolutionAt','delay'],'date'),direction:one('direction',['asc','desc'],'desc'),detailPeriod:one('detailPeriod',['a','b'],'a'),page:Math.max(0,Math.min(100000,Math.floor(Number(p.get('page'))||0)))};
}
const bucket=(values:string[])=>{const m=new Map<string,number>();for(const v of values)m.set(v,(m.get(v)??0)+1);return [...m].map(([label,value])=>({label,value})).sort((a,b)=>b.value-a.value||a.label.localeCompare(b.label,'fr'));};
export function buildAnalystJiraStats(input:JiraDetailedTicket[],users:GlobalDirectoryUser[],markets:JiraStatsMarket[],q:JiraStatsQuery,options:{prepared?:PreparedJiraAnalytics;unpaged?:boolean}={}){
 const prepared=options.prepared??prepareJiraAnalytics(input),facts=prepared.facts;
 const analysts=users.filter(u=>q.scope==='registry'||hasAnalystHistory(u)).filter(u=>/^[A-Z]\d{7}$/i.test(u.usercode));
 const chosen=analysts.filter(u=>!q.analystIds.length||q.analystIds.includes(u.id));
 const unique=prepared.tickets;
 const involvement=new Map<string,typeof chosen>();
 const involved=(t:JiraDetailedTicket)=>{let people=involvement.get(t.key);if(people)return people;people=chosen.filter(u=>q.involvement!=='participant'&&t.assigneeUserCode.toUpperCase()===u.usercode.toUpperCase()||q.involvement!=='assigned'&&t.participants?.some(p=>p.usercode.toUpperCase()===u.usercode.toUpperCase()));involvement.set(t.key,people);return people;};
 const base=unique.filter(t=>q.scope==='registry'&&!q.analystIds.length||involved(t).length>0);
 const selectedIds=q.marketIds?.length?q.marketIds:q.marketId==='all'?[]:[q.marketId];
 const shownMarkets=markets.filter(m=>!selectedIds.length||selectedIds.includes(m.id));
 // Reuse membership sets over directory eras, rather than rescoping every ticket for every week.
 const boundaries=[...new Set(users.flatMap(u=>((u as GlobalDirectoryUser&{assignments?:{from:string;to:string}[]}).assignments??[]).flatMap(a=>[a.from,a.to?addIsoDays(a.to,1):''])).filter(Boolean))].sort();
 const membership=new Map<string,Set<string>>(),known=new Set(markets.flatMap(marketSpecialties));
 const marketScope=(tickets:JiraDetailedTicket[],market:JiraStatsMarket,at:string)=>{
  const era=boundaries.filter(d=>d<=at).at(-1)??'',key=market.id+':'+era;let keys=membership.get(key);
  if(!keys){const people=new Set(users.map(u=>directoryPersonAt(u,at)).filter(u=>u.marketIds.includes(market.id)).map(u=>u.usercode.toUpperCase())),specialties=new Set(marketSpecialties(market));
   keys=new Set(unique.filter(t=>known.has(facts[t.key].specialty)?specialties.has(facts[t.key].specialty):people.has(t.assigneeUserCode.toUpperCase())).map(t=>t.key));membership.set(key,keys);}
  return tickets.filter(t=>keys!.has(t.key));
 };
 const scope=(tickets:JiraDetailedTicket[],at:string)=>{if(!selectedIds.length)return tickets;const keys=new Set(shownMarkets.flatMap(m=>marketScope(tickets,m,at).map(t=>t.key)));return tickets.filter(t=>keys.has(t.key));};
 const delayFor=(t:{key?:string})=>facts[t.key??'']?.delay??null;
 const report=(range:{from:string;to:string})=>{
  const scoped=scope(base,range.to);
  const filtered=scoped.filter(t=>(q.category==='all'||(t.category?.trim()||'Non renseignée')===q.category)&&(q.subcategory==='all'||(t.subcategory?.trim()||'Non renseignée')===q.subcategory)&&(q.status==='all'||t.status===q.status));
  const closed=filtered.filter(t=>facts[t.key].closed);
  const resolved=closed.filter(t=>isIsoDate(t.resolutionAt?.slice(0,10)??'')&&t.resolutionAt!.slice(0,10)>=range.from&&t.resolutionAt!.slice(0,10)<=range.to);
  const sample=resolved.flatMap(t=>{const delay=delayFor(t);return delay===null?[]:[delay];}).sort((a,b)=>a-b);
  const missingResolution=closed.filter(t=>!t.resolutionAt);
  const invalidResolution=closed.filter(t=>!!t.resolutionAt&&!isIsoDate(t.resolutionAt.slice(0,10)));
  const missingCreation=resolved.filter(t=>!t.createdAt);
  const invalidCreation=resolved.filter(t=>!!t.createdAt&&!isIsoDate(t.createdAt.slice(0,10)));
  const invalidOrder=resolved.filter(t=>isIsoDate(t.createdAt.slice(0,10))&&t.createdAt.slice(0,10)>t.resolutionAt!.slice(0,10));
  const excluded=resolved.filter(t=>delayFor(t)===null);
  const resolution={completed:resolved.length,sample:sample.length,mean:sample.length?sample.reduce((a,b)=>a+b,0)/sample.length:null,median:sample.length?(sample[Math.floor((sample.length-1)/2)]+sample[Math.floor(sample.length/2)])/2:null,missingResolution:missingResolution.length,invalidResolution:invalidResolution.length,missingCreation:missingCreation.length,invalidCreation:invalidCreation.length,invalidOrder:invalidOrder.length,excluded:excluded.length,examples:[...missingResolution,...invalidResolution,...excluded].slice(0,5).map(t=>({key:t.key,createdAt:t.createdAt,resolutionAt:t.resolutionAt??''}))};
  const stock=filtered.map(t=>({ticket:t,...preparedJiraStock(facts[t.key],range.to)}));
  const stockAtEnd=stock.filter(t=>t.state==='open').length,stockUnknown=stock.filter(t=>t.state==='unknown').length;
  const dateFor=(t:JiraDetailedTicket)=>q.basis==='created'||q.basis==='stock'?t.createdAt.slice(0,10):q.basis==='updated'?t.updatedAt.slice(0,10):q.basis==='resolved'?(facts[t.key].closed?t.resolutionAt?.slice(0,10)??'':''):facts[t.key].activity;
  const selected=q.basis==='stock'?stock.filter(t=>t.state==='open').map(t=>t.ticket):filtered.filter(t=>{const d=dateFor(t);return isIsoDate(d)&&d>=range.from&&d<=range.to;});
  const completed=q.basis==='stock'?[]:selected.filter(t=>facts[t.key].closed),delays=completed.flatMap(t=>{const d=delayFor(t);return d===null?[]:[d];}).sort((a,b)=>a-b);
  const rows=selected.map(t=>({...t,date:dateFor(t),analyst:involved(t).map(u=>u.name).join(' · '),delay:q.basis!=='stock'&&facts[t.key].closed?delayFor(t):null,fallbackDate:q.basis==='activity'&&facts[t.key].closed&&facts[t.key].fallback}));
  if(!options.unpaged)rows.sort((a,b)=>{const av=q.sort==='date'?a.date:q.sort==='delay'?a.delay:a[q.sort]??'',bv=q.sort==='date'?b.date:q.sort==='delay'?b.delay:b[q.sort]??'';if(av===null)return bv===null?0:1;if(bv===null)return -1;const d=typeof av==='number'&&typeof bv==='number'?av-bv:String(av).localeCompare(String(bv),'fr',{numeric:true,sensitivity:'base'});return (q.direction==='asc'?d:-d)||a.key.localeCompare(b.key);});
  const marketCounts=shownMarkets.map(m=>({id:m.id,label:m.shortCode||m.short||m.id,value:marketScope(selected,m,range.to).length,resolution:jiraResolutionSample(marketScope(filtered,m,range.to),range.from,range.to,delayFor)}));
  return {resolution,marketCounts,stockAtEnd,stockUnknown,stockAsOf:range.to,stockUnknownReasons:bucket(stock.filter(t=>t.state==='unknown').map(t=>t.reason)),total:selected.length,completed:completed.length,open:selected.length-completed.length,mean:delays.length?delays.reduce((a,b)=>a+b,0)/delays.length:null,median:delays.length?(delays[Math.floor((delays.length-1)/2)]+delays[Math.floor(delays.length/2)])/2:null,datedResolved:delays.length,fallbackDates:rows.filter(r=>r.fallbackDate).length,undated:filtered.filter(t=>!isIsoDate(dateFor(t))).length,charts:{category:bucket(selected.map(t=>t.category?.trim()||'Non renseignée')),subcategory:bucket(selected.map(t=>t.subcategory?.trim()||'Non renseignée')),status:bucket(selected.map(t=>t.status)),analyst:bucket(selected.flatMap(t=>involved(t).map(u=>u.name)))},rows};
 };
 const timeline=(range:{from:string;to:string})=>{
  const weeks=[];
  const filtered=base.filter(t=>(q.category==='all'||(t.category?.trim()||'Non renseignée')===q.category)&&(q.subcategory==='all'||(t.subcategory?.trim()||'Non renseignée')===q.subcategory)&&(q.status==='all'||t.status===q.status));
  const dated=filtered.map(ticket=>({ticket,date:q.basis==='created'?ticket.createdAt.slice(0,10):q.basis==='updated'?ticket.updatedAt.slice(0,10):q.basis==='resolved'?(facts[ticket.key].closed?ticket.resolutionAt?.slice(0,10)??'':''):facts[ticket.key].activity}));
  const events=new Map<string,JiraDetailedTicket[]>(),completions=new Map<string,JiraDetailedTicket[]>();
  for(const {ticket,date} of dated){if(isIsoDate(date)&&date>=range.from&&date<=range.to){const key=isoWeekForDate(date).from;const rows=events.get(key)??[];rows.push(ticket);events.set(key,rows);}
   const end=ticket.resolutionAt?.slice(0,10)??'';if(facts[ticket.key].closed&&isIsoDate(end)&&end>=range.from&&end<=range.to){const key=isoWeekForDate(end).from,rows=completions.get(key)??[];rows.push(ticket);completions.set(key,rows);}}
  for(let day=isoWeekForDate(range.from).from;day<=range.to;day=addIsoDays(day,7)){
   const week=isoWeekForDate(day),from=day<range.from?range.from:day,to=week.to>range.to?range.to:week.to;
   const selected=q.basis==='stock'?filtered.filter(t=>preparedJiraStock(facts[t.key],to).state==='open'):events.get(day)??[];
   const counts=shownMarkets.map(m=>({id:m.id,label:m.shortCode||m.short||m.id,value:marketScope(selected,m,to).length,resolution:jiraResolutionSample(marketScope(completions.get(day)??[],m,to),from,to,delayFor)}));
   weeks.push({from,to,label:`S${String(week.week).padStart(2,'0')} · ${week.year}`,total:scope(selected,to).length,resolution:jiraResolutionSample(scope(completions.get(day)??[],to),from,to,delayFor),markets:counts});
  }return weeks;
 };
 const same=q.a.from===q.b.from&&q.a.to===q.b.to,a=report(q.a),b=same?a:report(q.b),timelineA=timeline(q.a),timelineB=same?timelineA:timeline(q.b),pages=Math.max(1,Math.ceil((q.detailPeriod==='b'?b:a).rows.length/50)),page=Math.min(q.page,pages-1);
 return {timeline:{a:timelineA,b:timelineB},a:{...a,rows:options.unpaged?a.rows:a.rows.slice(page*50,(page+1)*50)},b:{...b,rows:options.unpaged?b.rows:b.rows.slice(page*50,(page+1)*50)},page,pages,pageSize:50,options:{categories:[...new Set(base.map(t=>t.category?.trim()||'Non renseignée'))].sort(),subcategories:[...new Set(base.filter(t=>q.category==='all'||(t.category?.trim()||'Non renseignée')===q.category).map(t=>t.subcategory?.trim()||'Non renseignée'))].sort(),statuses:[...new Set(base.map(t=>t.status))].sort()},analystCount:chosen.length};
}
export type AnalystJiraStats=ReturnType<typeof buildAnalystJiraStats>;

/** Sorting and paging never run KPI or weekly calculations. Does not mutate a shared cached report. */
export function pageJiraStatsReport(report:AnalystJiraStats,q:JiraStatsQuery):AnalystJiraStats{
 const pages=Math.max(1,Math.ceil(report[q.detailPeriod].rows.length/50)),page=Math.min(q.page,pages-1);
 const rows=(period:'a'|'b')=>[...report[period].rows].sort((a,b)=>{const av=q.sort==='date'?a.date:q.sort==='delay'?a.delay:a[q.sort]??'',bv=q.sort==='date'?b.date:q.sort==='delay'?b.delay:b[q.sort]??'';if(av===null)return bv===null?0:1;if(bv===null)return -1;const d=typeof av==='number'&&typeof bv==='number'?av-bv:String(av).localeCompare(String(bv),'fr',{numeric:true,sensitivity:'base'});return (q.direction==='asc'?d:-d)||a.key.localeCompare(b.key);}).slice(page*50,(page+1)*50);
 return {...report,page,pages,a:{...report.a,rows:rows('a')},b:{...report.b,rows:rows('b')}};
}
