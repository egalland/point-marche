import { isIsoDate, addIsoDays, isoWeekForDate } from "./iso-week";
import { isClosedJiraStatus, isAbandonedJiraStatus } from "./jira-import";
export type ResolutionTicket = { key?: string; status: string; createdAt?: string; resolutionAt?: string; count?: number };
function easter(year: number) {
 const a=year%19,b=Math.floor(year/100),c=year%100,d=Math.floor(b/4),e=b%4,f=Math.floor((b+8)/25),g=Math.floor((b-f+1)/3),h=(19*a+b-d-g+15)%30,i=Math.floor(c/4),k=c%4,l=(32+2*e+2*i-h-k)%7,m=Math.floor((a+11*h+22*l)/451),month=Math.floor((h+l-7*m+114)/31),day=(h+l-7*m+114)%31+1;
 return `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
}
const holidayCache=new Map<number,Set<string>>();
export function frenchHolidays(year:number) {
 let dates=holidayCache.get(year);if(dates)return dates;
 const sunday=easter(year);dates=new Set(['01-01','05-01','05-08','07-14','08-15','11-01','11-11','12-25'].map(d=>`${year}-${d}`));
 for(const offset of [1,39,50])dates.add(addIsoDays(sunday,offset));holidayCache.set(year,dates);return dates;
}
/** Elapsed working dates, excluding creation day, including end day. Metropolitan national holidays. */
export function workingDays(from:string,to:string):number|null {
 const start=from?.slice(0,10),end=to?.slice(0,10);
 if(!isIsoDate(start)||!isIsoDate(end)||end<start||Number(end.slice(0,4))-Number(start.slice(0,4))>30)return null;
 const startDate=new Date(`${start}T12:00:00Z`),span=Math.round((Date.parse(`${end}T12:00:00Z`)-startDate.valueOf())/86400000);
 let count=Math.floor(span/7)*5;
 for(let offset=1;offset<=span%7;offset++){const dow=(startDate.getUTCDay()+offset)%7;if(dow!==0&&dow!==6)count++;}
 for(let year=Number(start.slice(0,4));year<=Number(end.slice(0,4));year++)for(const day of frenchHolidays(year)){
  if(day>start&&day<=end){const dow=new Date(`${day}T12:00:00Z`).getUTCDay();if(dow!==0&&dow!==6)count--;}
 }
 return count;
}
const mean=(v:number[])=>v.length?v.reduce((a,b)=>a+b,0)/v.length:null;
const median=(v:number[])=>{if(!v.length)return null;const s=[...v].sort((a,b)=>a-b),m=Math.floor(s.length/2);return s.length%2?s[m]:(s[m-1]+s[m])/2;};
/** True completion cohort: no updated-date fallback, no average of weekly averages. */
export function jiraResolutionSample(tickets:ResolutionTicket[],from:string,to:string,delayFor=(t:ResolutionTicket)=>workingDays(t.createdAt??'',t.resolutionAt??'')){
 if(!isIsoDate(from)||!isIsoDate(to)||from>to)return {mean:null,median:null,sample:0,days:0,completed:0,excluded:0};
 const closed=[...new Map(tickets.map((t,i)=>[t.key||`manual-${i}`,t])).values()].filter(t=>isClosedJiraStatus(t.status)&&!isAbandonedJiraStatus(t.status)&&(t.count===undefined||t.count===1));
 const completed=closed.filter(t=>isIsoDate(t.resolutionAt?.slice(0,10)??'')&&t.resolutionAt!.slice(0,10)>=from&&t.resolutionAt!.slice(0,10)<=to);
 const samples=completed.map(delayFor).filter((v):v is number=>v!==null),days=samples.reduce((n,v)=>n+v,0);
 return {mean:mean(samples),median:median(samples),sample:samples.length,days,completed:completed.length,excluded:completed.length-samples.length};
}
export type JiraTrendWeek={from:string;to:string;completed:number;mean:number|null;sample:number;excluded:number};
/** Four frozen ISO-week cohorts; only true resolution dates feed the history. */
export function jiraRecentWeeks(tickets:ResolutionTicket[],reference:string,delayFor=(t:ResolutionTicket)=>workingDays(t.createdAt??'',t.resolutionAt??'')):JiraTrendWeek[]{
 if(!isIsoDate(reference))return [];
 const monday=isoWeekForDate(reference).from;
 const weeks=Array.from({length:4},(_,i)=>{const from=addIsoDays(monday,(i-3)*7);return {from,to:i===3?reference:addIsoDays(from,6),completed:0,mean:null as number|null,sample:0,excluded:0,days:0};});
 for(const t of new Map(tickets.map((t,i)=>[t.key||`manual-${i}`,t])).values()){
  if(!isClosedJiraStatus(t.status)||isAbandonedJiraStatus(t.status))continue;
  const date=t.resolutionAt?.slice(0,10)??'';if(!isIsoDate(date))continue;
  const w=weeks.find(w=>date>=w.from&&date<=w.to);if(!w)continue;
  if(isIsoDate(t.createdAt?.slice(0,10)??'')&&t.createdAt!.slice(0,10)>date)continue;
  const count=Number.isInteger(t.count)&&t.count!>0?t.count!:1;w.completed+=count;
  const delay=count===1?delayFor(t):null;
  if(delay!==null&&Number.isFinite(delay)&&delay>=0){w.sample++;w.days+=delay;}else w.excluded+=count;
 }
 return weeks.map(({days,...w})=>({...w,mean:w.sample?days/w.sample:null}));
}
function normalizeTrend(value:unknown,reference:string):JiraTrendWeek[]|undefined{
 if(!Array.isArray(value)||value.length!==4)return undefined;
 const ranges=jiraRecentWeeks([],reference),result:JiraTrendWeek[]=[];
 for(let i=0;i<4;i++){const w=value[i];if(!w||typeof w!=='object'||w.from!==ranges[i]?.from||w.to!==ranges[i]?.to||!['completed','sample','excluded'].every(k=>Number.isSafeInteger(w[k])&&w[k]>=0)||w.sample+w.excluded!==w.completed||(w.sample===0?w.mean!==null:typeof w.mean!=='number'||!Number.isFinite(w.mean)||w.mean<0))return undefined;
 result.push({from:w.from,to:w.to,completed:w.completed,mean:w.mean,sample:w.sample,excluded:w.excluded});}
 return result;
}
export function jiraMarketKpis(tickets:ResolutionTicket[],reference:string,delayFor=(t:ResolutionTicket)=>workingDays(t.createdAt??'',t.resolutionAt??'')){
 const valid=isIsoDate(reference),month=reference.slice(0,7),previous=valid?addIsoDays(`${month}-01`,-1).slice(0,7):'';
 const unique=[...new Map(tickets.map((t,i)=>[t.key||`manual-${i}`,t])).values()].filter(t=>!isAbandonedJiraStatus(t.status)&&(t.count===undefined||t.count===1));
 const resolved=unique.filter(t=>isClosedJiraStatus(t.status)&&t.resolutionAt&&t.resolutionAt.slice(0,10)<=reference);
 const sample=(m:string)=>resolved.filter(t=>t.resolutionAt!.startsWith(m)).map(delayFor).filter((d):d is number=>d!==null);
 const current=valid?sample(month):[],prior=valid?sample(previous):[];
 const ages=unique.filter(t=>!isClosedJiraStatus(t.status)).map(t=>workingDays(t.createdAt??'',reference)).filter((d):d is number=>d!==null);
 const avg=mean(current),prev=mean(prior);
 const range=valid?isoWeekForDate(reference):{from:'',to:''},weekly={from:range.from,to:reference,...jiraResolutionSample(unique,range.from,reference,delayFor)};
 return {weekly,trend:jiraRecentWeeks(tickets,reference,delayFor),month,previous,asOf:reference,mean:avg,median:median(current),previousMean:prev,delta:avg===null||prev===null?null:avg-prev,resolved:current.length,previousResolved:prior.length,openAge:mean(ages),openDated:ages.length,missingDates:unique.filter(t=>isClosedJiraStatus(t.status)&&(!isIsoDate(t.resolutionAt?.slice(0,10)??'')||delayFor(t)===null)).length};
}

export type JiraResolutionMetrics = Omit<ReturnType<typeof jiraMarketKpis>,'weekly'|'trend'> & {weekly?:ReturnType<typeof jiraMarketKpis>['weekly'];trend?:JiraTrendWeek[];byType?:Record<string,JiraResolutionMetrics>};
export function normalizeResolutionMetrics(value:unknown,includeTypes=true):JiraResolutionMetrics|undefined {
 if(!value||typeof value!=='object')return undefined;
 const v=value as Record<string,unknown>;
 if(typeof v.asOf!=='string'||!isIsoDate(v.asOf)||v.month!==v.asOf.slice(0,7)||typeof v.previous!=='string'||!/^\d{4}-\d{2}$/.test(v.previous))return undefined;
 for(const field of ['mean','median','previousMean','delta','openAge'])if(v[field]!==null&&(typeof v[field]!=='number'||!Number.isFinite(v[field])))return undefined;
 for(const field of ['resolved','previousResolved','openDated','missingDates'])if(typeof v[field]!=='number'||!Number.isSafeInteger(v[field])||Number(v[field])<0)return undefined;
 const w=v.weekly as Record<string,unknown>|undefined;
 let weekly:JiraResolutionMetrics['weekly'];
 if(w&&typeof w==='object'&&w.from===isoWeekForDate(v.asOf).from&&w.to===v.asOf&&['mean','median'].every(k=>w[k]===null||(typeof w[k]==='number'&&Number.isFinite(w[k])&&Number(w[k])>=0))&&['sample','days','completed','excluded'].every(k=>typeof w[k]==='number'&&Number.isSafeInteger(w[k])&&Number(w[k])>=0)&&Number(w.sample)+Number(w.excluded)===w.completed&&(Number(w.sample)===0?w.mean===null&&w.median===null&&w.days===0:typeof w.mean==='number'&&w.median!==null&&Math.abs(w.mean-Number(w.days)/Number(w.sample))<1e-8))weekly={from:String(w.from),to:String(w.to),mean:w.mean as number|null,median:w.median as number|null,sample:Number(w.sample),days:Number(w.days),completed:Number(w.completed),excluded:Number(w.excluded)};
 const byType=includeTypes&&v.byType&&typeof v.byType==='object'?Object.fromEntries(Object.entries(v.byType).slice(0,100).flatMap(([key,value])=>{const metrics=normalizeResolutionMetrics(value,false);return metrics&&metrics.asOf===v.asOf?[[key,metrics]]:[];})):undefined;
 return {...(byType?{byType}:{}),...Object.fromEntries(['month','previous','asOf','mean','median','previousMean','delta','resolved','previousResolved','openAge','openDated','missingDates'].map(key=>[key,v[key]])),...(weekly?{weekly}:{}),...(normalizeTrend(v.trend,v.asOf)?{trend:normalizeTrend(v.trend,v.asOf)}:{})} as JiraResolutionMetrics;
}
export function resolutionKpiHtml(tickets:ResolutionTicket[],date:string,snapshot?:JiraResolutionMetrics){
 const k=snapshot??jiraMarketKpis(tickets,date),n=(v:number|null)=>v===null?'—':new Intl.NumberFormat('fr-FR',{maximumFractionDigits:1}).format(v);
 const weekly=k.weekly;
 return `<section class="resolution-export">${weekly?`<h3>Délai moyen de résolution · cette semaine</h3><p><strong style="font-size:22px">${n(weekly.mean)} j ouvrés</strong> · ${weekly.sample} ticket(s) avec dates valides, du ${weekly.from} au ${weekly.to}. Médiane : ${n(weekly.median)} j ; ${weekly.excluded} ticket(s) exclu(s).</p>`:'<p>Délai de cette semaine non enregistré : actualiser explicitement les données Jira du point.</p>'}<h3>Résolution · ${k.month} · au ${k.asOf}</h3><table style="width:100%;border-collapse:collapse"><tr>${[['Délai moyen',n(k.mean)],['Médiane',n(k.median)],['Écart au mois précédent',n(k.delta)],['Ancienneté du stock',n(k.openAge)]].map(([label,value])=>`<td style="padding:10px;border:1px solid #dce5e2"><small>${label}</small><br><strong>${value} j ouvrés</strong></td>`).join('')}</tr></table><p>${k.resolved} ticket(s) résolu(s) daté(s) ce mois, ${k.previousResolved} le mois précédent complet (${n(k.previousMean)} j). ${k.missingDates} ticket(s) fermé(s) exclu(s) pour dates absentes ou incohérentes. Hors weekends et jours fériés nationaux français, création exclue et résolution incluse. Mois courant arrêté à la date du point. Le stock reflète l’extraction importée.</p></section>`;
}
