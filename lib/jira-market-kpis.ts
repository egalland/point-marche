import { isIsoDate, addIsoDays } from "./iso-week";
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
export function jiraMarketKpis(tickets:ResolutionTicket[],reference:string){
 const valid=isIsoDate(reference),month=reference.slice(0,7),previous=valid?addIsoDays(`${month}-01`,-1).slice(0,7):'';
 const unique=[...new Map(tickets.map((t,i)=>[t.key||`manual-${i}`,t])).values()].filter(t=>!isAbandonedJiraStatus(t.status)&&(t.count===undefined||t.count===1));
 const resolved=unique.filter(t=>isClosedJiraStatus(t.status)&&t.resolutionAt&&t.resolutionAt.slice(0,10)<=reference);
 const sample=(m:string)=>resolved.filter(t=>t.resolutionAt!.startsWith(m)).map(t=>workingDays(t.createdAt??'',t.resolutionAt!)).filter((d):d is number=>d!==null);
 const current=valid?sample(month):[],prior=valid?sample(previous):[];
 const ages=unique.filter(t=>!isClosedJiraStatus(t.status)).map(t=>workingDays(t.createdAt??'',reference)).filter((d):d is number=>d!==null);
 const avg=mean(current),prev=mean(prior);
 return {month,previous,asOf:reference,mean:avg,median:median(current),previousMean:prev,delta:avg===null||prev===null?null:avg-prev,resolved:current.length,previousResolved:prior.length,openAge:mean(ages),openDated:ages.length,missingDates:unique.filter(t=>isClosedJiraStatus(t.status)&&(!isIsoDate(t.resolutionAt?.slice(0,10)??'')||workingDays(t.createdAt??'',t.resolutionAt??'')===null)).length};
}

export type JiraResolutionMetrics = ReturnType<typeof jiraMarketKpis>;
export function normalizeResolutionMetrics(value:unknown):JiraResolutionMetrics|undefined {
 if(!value||typeof value!=='object')return undefined;
 const v=value as Record<string,unknown>;
 if(typeof v.asOf!=='string'||!isIsoDate(v.asOf)||v.month!==v.asOf.slice(0,7)||typeof v.previous!=='string'||!/^\d{4}-\d{2}$/.test(v.previous))return undefined;
 for(const field of ['mean','median','previousMean','delta','openAge'])if(v[field]!==null&&(typeof v[field]!=='number'||!Number.isFinite(v[field])))return undefined;
 for(const field of ['resolved','previousResolved','openDated','missingDates'])if(typeof v[field]!=='number'||!Number.isSafeInteger(v[field])||Number(v[field])<0)return undefined;
 return Object.fromEntries(['month','previous','asOf','mean','median','previousMean','delta','resolved','previousResolved','openAge','openDated','missingDates'].map(key=>[key,v[key]])) as JiraResolutionMetrics;
}
export function resolutionKpiHtml(tickets:ResolutionTicket[],date:string,snapshot?:JiraResolutionMetrics){
 const k=snapshot??jiraMarketKpis(tickets,date),n=(v:number|null)=>v===null?'—':new Intl.NumberFormat('fr-FR',{maximumFractionDigits:1}).format(v);
 return `<section class="resolution-export"><h3>Résolution · ${k.month} · au ${k.asOf}</h3><table style="width:100%;border-collapse:collapse"><tr>${[['Délai moyen',n(k.mean)],['Médiane',n(k.median)],['Écart au mois précédent',n(k.delta)],['Ancienneté du stock',n(k.openAge)]].map(([label,value])=>`<td style="padding:10px;border:1px solid #dce5e2"><small>${label}</small><br><strong>${value} j ouvrés</strong></td>`).join('')}</tr></table><p>${k.resolved} ticket(s) résolu(s) daté(s) ce mois, ${k.previousResolved} le mois précédent complet (${n(k.previousMean)} j). ${k.missingDates} ticket(s) fermé(s) exclu(s) pour dates absentes ou incohérentes. Hors weekends et jours fériés nationaux français, création exclue et résolution incluse. Mois courant arrêté à la date du point. Le stock reflète l’extraction importée.</p></section>`;
}
