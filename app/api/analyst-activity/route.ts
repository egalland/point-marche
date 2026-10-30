import {storedJiraStats,jiraRegistryRevision} from '../../../lib/jira-analytics-server';
import {directoryUsersAt} from '../../../lib/directory-store';
import {latestCompletedJiraBatch} from '../../../lib/jira-registry-server';
import {parseJiraStatsQuery} from '../../../lib/analyst-jira-stats';
import {getDb} from '../../../db';import {marketDefinitions} from '../../../db/schema';import {eq} from 'drizzle-orm';
export async function jiraActivityResponse(request:Request,registryScope=false){
 let q;try{q=parseJiraStatsQuery(new URL(request.url));}catch(e){return Response.json({error:e instanceof Error?e.message:'Périodes invalides.'},{status:400});}
 try{q.scope=registryScope?'registry':'analysts';
 const batch=await latestCompletedJiraBatch();
 const revision=await jiraRegistryRevision(batch);
 const [users,definitions]=await Promise.all([directoryUsersAt(),getDb().select().from(marketDefinitions).where(eq(marketDefinitions.isActive,true))]);
 const markets=definitions.map(m=>({id:m.id,shortCode:m.shortCode,plannerTags:JSON.parse(m.plannerTags) as string[]}));
 const result=await storedJiraStats(revision,users,markets,q,new URL(request.url).searchParams.get('refresh')==='1');
 return Response.json({...result,updatedAt:batch?.completedAt??batch?.createdAt??'',hasSource:!!batch},{headers:{'Cache-Control':'no-store'}});
 }catch{return Response.json({error:'Activité Jira indisponible. Réessaie après avoir vérifié le registre importé.'},{status:503});}
}

export async function GET(request:Request){return jiraActivityResponse(request);}
