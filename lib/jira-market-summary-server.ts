import {getDb,getRawDb} from '../db';
import {marketDefinitions} from '../db/schema';
import {eq} from 'drizzle-orm';
import {directoryUsersAt} from './directory-store';
import {latestCompletedJiraBatch,loadOpenMarketJiraSummary} from './jira-registry-server';
import {jiraAnalyticsDigest,JIRA_ANALYTICS_VERSION} from './jira-analytics-cache';
import {jiraAnalyticsCacheDb,jiraCacheHeader,jiraRegistryRevision,storedJiraAnalytics,readJiraCache,writeJiraCache} from './jira-analytics-server';
import {selectMarketTickets} from './jira-market-scope';
import {marketJiraSummary} from './jira-point-activity';
import type {JiraSummaryImport} from './jira-import';
/** Reuse a date/market summary across requests without reopening the complete ticket registry. */
export async function loadCachedMarketJiraSummary(marketId:string,reference:string){
 try{
  const [users,definitions,batch]=await Promise.all([directoryUsersAt(reference),getDb().select().from(marketDefinitions).where(eq(marketDefinitions.isActive,true)),latestCompletedJiraBatch()]);
  const markets=definitions.map(m=>({id:m.id,shortCode:m.shortCode,plannerTags:JSON.parse(m.plannerTags) as string[]})),market=markets.find(m=>m.id===marketId);if(!market)return null;
  const revision=await jiraRegistryRevision(batch),db=await jiraAnalyticsCacheDb();
  let head=await jiraCacheHeader(db,'source'),source;
  if(head?.revision!==`${JIRA_ANALYTICS_VERSION}:${revision}`){source=await storedJiraAnalytics(revision);head=await jiraCacheHeader(db,'source');}
  const identity=await jiraAnalyticsDigest([3,revision,head?.token??source?.token,reference,marketId,users,markets]);
  const slot='point:'+String(parseInt(identity.slice(0,8),16)%16),cached=await readJiraCache<JiraSummaryImport>(db,slot,identity);
  if(cached)return cached;
  source??=await storedJiraAnalytics(revision);
  const people=new Map(users.filter(u=>u.marketIds.includes(marketId)).map(u=>[u.usercode.toUpperCase(),u.name]));
  const relevant=selectMarketTickets(source.prepared.tickets,market,markets,people);
  const result=marketJiraSummary(relevant,reference,'unknown',ticket=>source!.prepared.facts[ticket.key??'']?.delay??null);
  // Never publish a summary under the wrong import if one committed during preparation.
  if(await jiraRegistryRevision(await latestCompletedJiraBatch())!==revision)throw Error('Le registre Jira vient de changer. Réessaie.');
  await writeJiraCache(getRawDb(),slot,identity,result);return result;
 }catch(error){
  if(error instanceof Error&&error.message.includes('vient de changer'))throw error;
  // The private cache is disposable. An unavailable cache must not remove the Jira source.
  return loadOpenMarketJiraSummary(marketId,reference);
 }
}
