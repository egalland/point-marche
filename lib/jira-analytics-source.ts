import {isAbandonedJiraStatus,isClosedJiraStatus,type JiraDetailedTicket} from './jira-import';
import {jiraCompletionDate} from './jira-point-activity';
import {workingDays} from './jira-market-kpis';
import {isIsoDate} from './iso-week';
import type {StockState} from './jira-historical-stock';
import {ticketSpecialty} from './jira-market-scope';
/** Only import-dependent facts live here. Directory memberships remain date-dependent. */
export type JiraTicketFacts={closed:boolean;delay:number|null;activity:string;fallback:boolean;specialty:string;stock:{created:string;resolved:string;issue:string;afterIssue:string;closed:boolean}};
export type PreparedJiraAnalytics={tickets:JiraDetailedTicket[];facts:Record<string,JiraTicketFacts>};
export const JIRA_ANALYTICS_VERSION=2;
export function prepareJiraAnalytics(input:JiraDetailedTicket[]):PreparedJiraAnalytics{
 const tickets=[...new Map(input.map(t=>[t.key,t])).values()].filter(t=>!isAbandonedJiraStatus(t.status));
 const facts:Record<string,JiraTicketFacts>=Object.create(null);
 for(const t of tickets){const closed=isClosedJiraStatus(t.status),completion=closed?jiraCompletionDate(t):null;facts[t.key]={closed,delay:workingDays(t.createdAt??'',t.resolutionAt??''),activity:closed?completion?.date??'':t.updatedAt.slice(0,10),fallback:!!completion?.fallback,specialty:ticketSpecialty(t),stock:prepareStock(t,closed)};}
 return {tickets,facts};
}
export async function jiraAnalyticsDigest(value:unknown){const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(value)));return Array.from(new Uint8Array(bytes),n=>n.toString(16).padStart(2,'0')).join('');}

function prepareStock(t:JiraDetailedTicket,closed:boolean){
 const created=t.createdAt?.slice(0,10)??'',resolved=t.resolutionAt?.slice(0,10)??'';
 const issue=!isIsoDate(created)?'Création absente ou invalide':t.resolutionAt&&(!isIsoDate(resolved)||resolved<created)?'Résolution invalide ou antérieure à la création':'';
 const afterIssue=t.resolutionAt?closed?'':'Ticket rouvert ou résolution incompatible avec le statut actuel':closed?'Ticket fermé sans date de résolution':!t.status.trim()?'Statut non renseigné':'';
 return {created,resolved,issue,afterIssue,closed};
}
export function preparedJiraStock(fact:JiraTicketFacts,asOf:string):{state:StockState;reason:string}{
 const s=fact.stock;
 if(s.issue==='Création absente ou invalide')return {state:'unknown',reason:s.issue};
 if(s.created>asOf)return {state:'not-created',reason:''};
 if(s.issue)return {state:'unknown',reason:s.issue};
 if(s.resolved&&s.resolved>asOf)return {state:'open',reason:''};
 if(s.afterIssue)return {state:'unknown',reason:s.afterIssue};
 return {state:s.resolved&&s.closed?'closed':'open',reason:''};
}
