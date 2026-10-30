import {jiraDashboardStats,jiraItemCount,type PointData,type Market} from '../features/market-pulse/point-model';
import {jiraWeeklyActivity} from './jira-point-activity';
import {jiraMarketKpis} from './jira-market-kpis';
import {isClosedJiraStatus,isAbandonedJiraStatus} from './jira-import';
import {normalizeJiraBlockPresentation} from './jira-block-settings';
export function jiraBlockReport(data:PointData,market:Market,presentation:unknown=data.preferences?.jiraPresentation,offset=0){
 const config=normalizeJiraBlockPresentation(presentation),stats=jiraDashboardStats(data,market,[]),weekly=jiraWeeklyActivity(data.jira,data.jiraWeekly?.asOf??data.meetingDate),known=data.jiraMode==='manual'||!!data.sourceFreshness?.jira||data.jira.length>0,completedKnown=data.jiraMode==='manual'||!!data.jiraWeekly;
 const resolution=data.jiraMode==='automatic'?data.jiraResolution:jiraMarketKpis(data.jira,data.meetingDate),days=resolution?.weekly;
 const metrics={open:known?stats.currentVolume:null,completed:completedKnown?weekly.count:null,attention:known?stats.attentionCount:null,critical:known?stats.criticalCount:null,resolution:days?.mean??null};
 const all=data.jira.filter(t=>!isAbandonedJiraStatus(t.status)),attention=new Set(stats.rows.filter(r=>r.level==='warning'||r.level==='critical').map(r=>r.item.id)),critical=new Set(stats.rows.filter(r=>r.level==='critical').map(r=>r.item.id));
 const selected=config.view==='completed'?weekly.completed:config.view==='critical'?all.filter(t=>critical.has(t.id)):config.view==='closed'?all.filter(t=>isClosedJiraStatus(t.status)):config.view==='attention'?all.filter(t=>attention.has(t.id)):config.view==='all'?all:all.filter(t=>!isClosedJiraStatus(t.status));
 const filtered=selected.filter(t=>(config.status==='all'||t.status===config.status)&&(config.category==='all'||(t.category||'Non renseignée')===config.category)&&(config.assignee==='all'||(t.assignee||'Non assigné')===config.assignee));
 const pages=Math.max(1,Math.ceil(filtered.length/config.limit)),page=Math.min(pages-1,Math.max(0,Math.floor(offset/config.limit))),rows=filtered.slice(page*config.limit,(page+1)*config.limit),groups=new Map<string,typeof rows>();
 for(const t of rows){const group=config.layout==='people'?t.assignee||'Non assigné':config.layout==='categories'?t.category||'Non renseignée':config.layout==='statuses'?t.status||'Non renseigné':'';groups.set(group,[...(groups.get(group)??[]),t]);}
 return {config,metrics,weekly,known,completedKnown,resolution,rows,allRows:filtered,page,pages,groups:[...groups].map(([label,items])=>({label,items})),total:filtered.reduce((n,t)=>n+jiraItemCount(t),0),rowCount:filtered.length,remaining:Math.max(0,filtered.length-(page+1)*config.limit),filtersActive:[config.status,config.category,config.assignee].some(v=>v!=='all'),options:{status:[...new Set(all.map(t=>t.status).filter(Boolean))].sort(),category:[...new Set(all.map(t=>t.category||'Non renseignée'))].sort(),assignee:[...new Set(all.map(t=>t.assignee||'Non assigné'))].sort()}};
}
