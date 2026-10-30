import {buildAnalystJiraStats,pageJiraStatsReport,type AnalystJiraStats,type JiraStatsQuery,type JiraStatsMarket} from './analyst-jira-stats';
import {jiraAnalyticsDigest,prepareJiraAnalytics,JIRA_ANALYTICS_VERSION,type PreparedJiraAnalytics} from './jira-analytics-source';
import type {GlobalDirectoryUser} from './global-directory';

export function jiraStatsSelection(q:JiraStatsQuery){const {sort,direction,page,detailPeriod,...selection}=q;void sort;void direction;void page;void detailPeriod;return {...selection,analystIds:[...new Set(q.analystIds)].sort(),marketIds:[...new Set(q.marketIds??[])].sort()};}
type Row=AnalystJiraStats['a']['rows'][number];
type RowRef=Pick<Row,'key'|'date'|'analyst'|'delay'|'fallbackDate'>;
type CompactReport=Omit<AnalystJiraStats,'a'|'b'>&{a:Omit<AnalystJiraStats['a'],'rows'>&{rows:RowRef[]};b:Omit<AnalystJiraStats['b'],'rows'>&{rows:RowRef[]}};
export function compactJiraStats(report:AnalystJiraStats):CompactReport{
 const period=(p:'a'|'b')=>({...report[p],rows:report[p].rows.map(({key,date,analyst,delay,fallbackDate})=>({key,date,analyst,delay,fallbackDate}))});
 return {...report,a:period('a'),b:period('b')};
}
export function expandJiraStats(report:CompactReport,prepared:PreparedJiraAnalytics):AnalystJiraStats{
 const tickets=new Map(prepared.tickets.map(t=>[t.key,t]));
 const period=(p:'a'|'b')=>({...report[p],rows:report[p].rows.map(row=>{const t=tickets.get(row.key);if(!t)throw Error('Cache Jira incomplet.');return {...t,...row};})});
 return {...report,a:period('a'),b:period('b')};
}
/** Same engine for portable workbooks; no global cache shared between workspaces. */
export class JiraAnalyticsSession{
 prime(tickets:PreparedJiraAnalytics['tickets'],prepared:PreparedJiraAnalytics){this.input=tickets;this.prepared=prepared;this.reports.clear();}
 private input:unknown;private prepared?:PreparedJiraAnalytics;private directory='';private reports=new Map<string,AnalystJiraStats>();
 constructor(private build=buildAnalystJiraStats){}
 report(tickets:PreparedJiraAnalytics['tickets'],users:GlobalDirectoryUser[],markets:JiraStatsMarket[],q:JiraStatsQuery,refresh=false){
  const directory=JSON.stringify([users,markets]);
  if(refresh||this.input!==tickets){this.input=tickets;this.prepared=prepareJiraAnalytics(tickets);this.reports.clear();}
  if(directory!==this.directory){this.directory=directory;this.reports.clear();}
  const key=JSON.stringify(jiraStatsSelection(q));let report=this.reports.get(key);
  if(!report){report=this.build(tickets,users,markets,q,{prepared:this.prepared,unpaged:true});this.reports.set(key,report);if(this.reports.size>8)this.reports.delete(this.reports.keys().next().value!);}
  return pageJiraStatsReport(report,q);
 }
}
export {jiraAnalyticsDigest,JIRA_ANALYTICS_VERSION};
