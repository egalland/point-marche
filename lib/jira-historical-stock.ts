import {isIsoDate} from './iso-week';
import {isAbandonedJiraStatus,isClosedJiraStatus} from './jira-import';

type StockTicket={status:string;createdAt?:string;resolutionAt?:string};
export type StockState='open'|'closed'|'not-created'|'excluded'|'unknown';
export function jiraStockState(ticket:StockTicket,asOf:string):{state:StockState;reason:string}{
 if(!isIsoDate(asOf))return {state:'unknown',reason:'Date de référence invalide'};
 if(isAbandonedJiraStatus(ticket.status))return {state:'excluded',reason:'Ticket abandonné'};
 const created=ticket.createdAt?.slice(0,10)??'';
 if(!isIsoDate(created))return {state:'unknown',reason:'Création absente ou invalide'};
 if(created>asOf)return {state:'not-created',reason:''};
 const resolved=ticket.resolutionAt?.slice(0,10)??'';
 if(ticket.resolutionAt){
  if(!isIsoDate(resolved)||resolved<created)return {state:'unknown',reason:'Résolution invalide ou antérieure à la création'};
  if(resolved>asOf)return {state:'open',reason:''};
  return isClosedJiraStatus(ticket.status)?{state:'closed',reason:''}:{state:'unknown',reason:'Ticket rouvert ou résolution incompatible avec le statut actuel'};
 }
 if(isClosedJiraStatus(ticket.status))return {state:'unknown',reason:'Ticket fermé sans date de résolution'};
 if(!ticket.status.trim())return {state:'unknown',reason:'Statut non renseigné'};
 return {state:'open',reason:''};
}
