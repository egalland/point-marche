import type { JiraDetailedTicket } from "./jira-import";
type ScopeMarket={id:string;short?:string;shortLabel?:string;shortCode?:string;plannerTags?:string[]};
const token=(value:string)=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toUpperCase();
export function marketSpecialties(market:ScopeMarket):string[]{
 return [...new Set([...(market.plannerTags??[]).map(t=>t.split('-')[0]),...(market.short??market.shortLabel??market.shortCode??'').split(/[–—/&·\s-]+/)].map(token).filter(t=>/^[A-Z]{2,12}$/.test(t)))];
}
export function ticketSpecialty(ticket:Pick<JiraDetailedTicket,'summary'|'category'>){
 const prefix=/^\s*([\p{L}]{2,12})\s*[:–—-]/u.exec(ticket.summary)?.[1];return token(prefix??ticket.category??'');
}
/** A recognized specialty wins over assignment. Unclassified tickets use all market roles. */
export function selectMarketTickets(tickets:JiraDetailedTicket[],market:ScopeMarket,markets:ScopeMarket[],people:Map<string,string>){
 const selected=new Set(marketSpecialties(market)),known=new Set(markets.flatMap(marketSpecialties));
 return tickets.filter(ticket=>{const specialty=ticketSpecialty(ticket);return known.has(specialty)?selected.has(specialty):people.has(ticket.assigneeUserCode.toUpperCase());}).map(t=>({...t,marketId:market.id,assigneeName:people.get(t.assigneeUserCode.toUpperCase())}));
}
