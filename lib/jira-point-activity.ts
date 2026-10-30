import {isIsoDate,isoWeekForDate} from './iso-week';
import {isClosedJiraStatus,isAbandonedJiraStatus,jiraSummaryFromDetailedTickets,type JiraDetailedTicket,type JiraSummaryImport} from './jira-import';
import {jiraMarketKpis,type ResolutionTicket} from './jira-market-kpis';
import {jiraRuleFor,type JiraAlertRule} from './jira-alert-rules';
export type JiraWeekCoverage={from:string;to:string;asOf:string;fallbackCount:number;undatedClosed:number};
type ActivityTicket={key?:string;status:string;resolutionAt?:string;updatedAt?:string;lastActivity?:string;createdAt?:string;category?:string;subcategory?:string;count?:number};
/** Actual resolution wins. Updated date is an explicitly identified fallback, never used for resolution KPIs. */
export function jiraCompletionDate(t:ActivityTicket){
 if(t.resolutionAt){const d=t.resolutionAt.slice(0,10);return isIsoDate(d)?{date:d,fallback:false}:null;}
 const d=(t.updatedAt??t.lastActivity??'').slice(0,10);return isIsoDate(d)?{date:d,fallback:true}:null;
}
export function jiraWeeklyActivity<T extends ActivityTicket>(tickets:T[],asOf:string){
 const week=isIsoDate(asOf)?isoWeekForDate(asOf):{from:'',to:''};
 const unique=[...new Map(tickets.map((t,i)=>[t.key||`manual-${i}`,t])).values()];
 const closed=unique.filter(t=>isClosedJiraStatus(t.status)&&!isAbandonedJiraStatus(t.status));
 const completed=closed.filter(t=>{const d=jiraCompletionDate(t);return d&&week.from&&d.date>=week.from&&d.date<=asOf&&(!isIsoDate(t.createdAt?.slice(0,10)??'')||t.createdAt!.slice(0,10)<=d.date);});
 const coverage:JiraWeekCoverage={from:week.from,to:week.to,asOf,fallbackCount:completed.filter(t=>jiraCompletionDate(t)?.fallback).length,undatedClosed:closed.filter(t=>!jiraCompletionDate(t)).length};
 return {completed,coverage,count:completed.reduce((n,t)=>n+(Number.isInteger(t.count)&&t.count!>0?t.count!:1),0)};
}
export function normalizeJiraWeekCoverage(v:unknown):JiraWeekCoverage|undefined{
 if(!v||typeof v!=='object')return undefined;const x=v as JiraWeekCoverage;
 if(!isIsoDate(x.asOf)||!isIsoDate(x.from)||!isIsoDate(x.to))return undefined;
 const w=isoWeekForDate(x.asOf);if(w.from!==x.from||w.to!==x.to)return undefined;
 if(![x.fallbackCount,x.undatedClosed].every(n=>Number.isSafeInteger(n)&&n>=0))return undefined;
 return {from:x.from,to:x.to,asOf:x.asOf,fallbackCount:x.fallbackCount,undatedClosed:x.undatedClosed};
}
export function marketJiraSummary(tickets:JiraDetailedTicket[],reference:string,format:JiraSummaryImport['format']='unknown',delayFor?: (ticket:ResolutionTicket)=>number|null):JiraSummaryImport{
 const relevant=tickets.filter(t=>!isAbandonedJiraStatus(t.status));
 const open=relevant.filter(t=>!isClosedJiraStatus(t.status));const {completed,coverage}=jiraWeeklyActivity(relevant,reference);
 return {...jiraSummaryFromDetailedTickets(open,format),detailedTickets:[...open,...completed],weeklyCoverage:coverage,resolutionMetrics:jiraMarketKpis(relevant,reference,delayFor)};
}
export const jiraImpactLabels={unknown:'Non qualifié',low:'Limité',medium:'Modéré',high:'Fort'};
export function jiraCategoryGroups<T extends ActivityTicket>(tickets:T[],rules:JiraAlertRule[]=[]){
 const groups=new Map<string,{category:string;subcategory:string;count:number;impact:keyof typeof jiraImpactLabels;implication:string}>();
 for(const t of tickets){if(isClosedJiraStatus(t.status))continue;const category=t.category?.trim()||'Non renseignée',subcategory=t.subcategory?.trim()||'',key=JSON.stringify([category,subcategory]);const rule=jiraRuleFor(t,rules);
  const group=groups.get(key)??{category,subcategory,count:0,impact:rule?.impact??'unknown',implication:rule?.implication??''};group.count+=Number.isInteger(t.count)&&t.count!>0?t.count!:1;groups.set(key,group);
 }
 return [...groups.values()].sort((a,b)=>({unknown:0,low:1,medium:2,high:3}[b.impact]-{unknown:0,low:1,medium:2,high:3}[a.impact])||b.count-a.count||a.category.localeCompare(b.category,'fr'));
}
