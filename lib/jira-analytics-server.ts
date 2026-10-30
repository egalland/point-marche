import {getRawDb} from '../db';
import {latestCompletedJiraBatch,loadJiraAnalyticsTickets,loadJiraAnalyticsTicketPage} from './jira-registry-server';
import {prepareJiraAnalytics,type PreparedJiraAnalytics} from './jira-analytics-source';
import {buildAnalystJiraStats,pageJiraStatsReport,type JiraStatsQuery,type JiraStatsMarket} from './analyst-jira-stats';
import {compactJiraStats,expandJiraStats,pageCompactJiraStats,jiraStatsSelection,jiraAnalyticsDigest,JIRA_ANALYTICS_VERSION} from './jira-analytics-cache';
import type {GlobalDirectoryUser} from './global-directory';
type DB=ReturnType<typeof getRawDb>;
type Header={revision:string;token:string;chunks:number;checksum:string};
const CHUNK=120000,MAX_CHARS=CHUNK*64;
const sourceMemory=new WeakMap<object,{revision:string;token:string;prepared:PreparedJiraAnalytics}>();
export const jiraBatchRevision=(batch:Awaited<ReturnType<typeof latestCompletedJiraBatch>>)=>batch?`${batch.id}:${batch.completedAt}:${batch.ticketCount}:${batch.participantCount}`:'empty';
export async function jiraAnalyticsCacheDb(){const db=getRawDb();await db.exec('CREATE TABLE IF NOT EXISTS app_jira_analytics_cache (cache_key TEXT NOT NULL, part INTEGER NOT NULL, revision TEXT NOT NULL, payload TEXT NOT NULL, PRIMARY KEY(cache_key,part));');return db;}
export async function jiraRegistryRevision(batch:Awaited<ReturnType<typeof latestCompletedJiraBatch>>){const db=getRawDb();try{await jiraAnalyticsCacheDb();}catch{return jiraBatchRevision(batch)+':uncached';}const row=await db.prepare("SELECT payload FROM app_jira_analytics_cache WHERE cache_key = 'registry' AND part = -1").first<{payload:string}>();return jiraBatchRevision(batch)+':'+(row?.payload??'legacy');}
export async function jiraCacheHeader(db:DB,key:string):Promise<Header|null>{try{const row=await db.prepare('SELECT payload FROM app_jira_analytics_cache WHERE cache_key = ? AND part = -1').bind(key).first<{payload:string}>();return row?JSON.parse(row.payload):null;}catch{return null;}}
export async function readJiraCache<T>(db:DB,key:string,revision:string,meta?:Header|null):Promise<T|null>{try{const h=meta??await jiraCacheHeader(db,key);if(!h||h.revision!==revision)return null;const rows=(await db.prepare('SELECT part,payload FROM app_jira_analytics_cache WHERE cache_key = ? AND revision = ? AND part >= 0 ORDER BY part').bind(key,h.token).all<{part:number;payload:string}>()).results;if(rows.length!==h.chunks||rows.some((r,i)=>r.part!==i))return null;const value=JSON.parse(rows.map(r=>r.payload).join('')) as T;return await jiraAnalyticsDigest(value)===h.checksum?value:null;}catch{return null;}}
export async function writeJiraCache(db:DB,key:string,revision:string,value:unknown,token=crypto.randomUUID()):Promise<Header|null>{
 try{const payload=JSON.stringify(value);if(payload.length>MAX_CHARS)return null;
 const chunks=Math.max(1,Math.ceil(payload.length/CHUNK)),meta={revision,token,chunks,checksum:await jiraAnalyticsDigest(value)};
 // Atomic replacement: a reader sees the previous complete JSON or the new complete JSON.
 await db.batch([db.prepare('DELETE FROM app_jira_analytics_cache WHERE cache_key = ?').bind(key),...Array.from({length:chunks},(_,i)=>db.prepare('INSERT INTO app_jira_analytics_cache(cache_key,part,revision,payload) VALUES (?,?,?,?)').bind(key,i,token,payload.slice(i*CHUNK,(i+1)*CHUNK))),db.prepare('INSERT INTO app_jira_analytics_cache(cache_key,part,revision,payload) VALUES (?,-1,?,?)').bind(key,revision,JSON.stringify(meta))]);return meta;
 }catch{return null;}
}
/** Durable private JSON snapshot. Never cache pending I/O across Worker request contexts. */
export async function storedJiraAnalytics(revision:string,refresh=false){
 const db=await jiraAnalyticsCacheDb(),identity=`${JIRA_ANALYTICS_VERSION}:${revision}`,meta=refresh?null:await jiraCacheHeader(db,'source'),memory=sourceMemory.get(db);
 if(meta?.revision===identity){if(memory?.token===meta.token&&memory.revision===identity)return {...memory,persisted:meta.chunks>0};const prepared=await readJiraCache<PreparedJiraAnalytics>(db,'source',identity,meta);if(prepared?.tickets&&prepared.facts){const result={revision:identity,token:meta.token,prepared};sourceMemory.set(db,result);return {...result,persisted:true};}}
 const tickets=await loadJiraAnalyticsTickets(),prepared=prepareJiraAnalytics(tickets);
 // The import transaction may have committed during the read. Never label a mixed/new registry as an old import.
 if(await jiraRegistryRevision(await latestCompletedJiraBatch())!==revision)throw Error('Le registre Jira vient de changer. Réessaie.');
 const token=!refresh&&meta?.revision===identity?meta.token:crypto.randomUUID(),saved=await writeJiraCache(db,'source',identity,prepared,token);
 if(!saved)await db.prepare("INSERT INTO app_jira_analytics_cache(cache_key,part,revision,payload) VALUES ('source',-1,?,?) ON CONFLICT(cache_key,part) DO UPDATE SET revision=excluded.revision,payload=excluded.payload").bind(identity,JSON.stringify({revision:identity,token,chunks:0,checksum:''})).run();
 const result={revision:identity,token,prepared};
 sourceMemory.set(db,result);return {...result,persisted:!!saved};
}
export async function storedJiraStats(revision:string,users:GlobalDirectoryUser[],markets:JiraStatsMarket[],q:JiraStatsQuery,refresh=false){
 const cacheDb=getRawDb();try{await jiraAnalyticsCacheDb();}catch{}
 const sourceHead=refresh?null:await jiraCacheHeader(cacheDb,'source');
 const fingerprintFor=(token:string)=>jiraAnalyticsDigest([2,JIRA_ANALYTICS_VERSION,token,users,markets,jiraStatsSelection(q)]);
 if(sourceHead?.revision===`${JIRA_ANALYTICS_VERSION}:${revision}`){
  const fingerprint=await fingerprintFor(sourceHead.token),slot='report:'+String(parseInt(fingerprint.slice(0,8),16)%12);
  const cached=await readJiraCache<ReturnType<typeof compactJiraStats>>(cacheDb,slot,fingerprint);
  if(cached){try{const page=pageCompactJiraStats(cached,q),keys=[...page.a.rows,...page.b.rows].map(r=>r.key),tickets=await loadJiraAnalyticsTicketPage(keys);
   const report=expandJiraStats(page,{tickets,facts:{}});
   if(await jiraRegistryRevision(await latestCompletedJiraBatch())!==revision)throw Error('Le registre Jira vient de changer. Réessaie.');
   return {report,analytics:{prepared:true,persisted:sourceHead.chunks>0,selectionCached:true,version:JIRA_ANALYTICS_VERSION}};
  }catch(error){if(error instanceof Error&&error.message.includes('vient de changer'))throw error;}}
 }
 let source;
 try{source=await storedJiraAnalytics(revision,refresh);}catch(error){
  if(error instanceof Error&&error.message.includes('vient de changer'))throw error;
  const prepared=prepareJiraAnalytics(await loadJiraAnalyticsTickets());
  return {report:pageJiraStatsReport(buildAnalystJiraStats(prepared.tickets,users,markets,q,{prepared,unpaged:true}),q),analytics:{prepared:true,persisted:false,selectionCached:false,version:JIRA_ANALYTICS_VERSION}};
 }
 const db=getRawDb();
 const fingerprint=await fingerprintFor(source.token);
 // Fixed slots bound storage even when users try many arbitrary filter combinations.
 const slot='report:'+String(parseInt(fingerprint.slice(0,8),16)%12);
 const cached=await readJiraCache<ReturnType<typeof compactJiraStats>>(db,slot,fingerprint);
 let report,hit=false;
 if(cached){try{report=expandJiraStats(cached,source.prepared);hit=true;}catch{}}
 if(!report){report=buildAnalystJiraStats(source.prepared.tickets,users,markets,q,{prepared:source.prepared,unpaged:true});await writeJiraCache(db,slot,fingerprint,compactJiraStats(report));}
 return {report:pageJiraStatsReport(report,q),analytics:{prepared:true,persisted:source.persisted,selectionCached:hit,version:JIRA_ANALYTICS_VERSION}};
}
