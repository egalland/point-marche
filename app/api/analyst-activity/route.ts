import {directoryUsersAt} from '../../../lib/directory-store';
import {loadJiraAnalyticsTickets,latestCompletedJiraBatch} from '../../../lib/jira-registry-server';
import {parseJiraStatsQuery,buildAnalystJiraStats} from '../../../lib/analyst-jira-stats';
import {getDb} from '../../../db';import {marketDefinitions} from '../../../db/schema';import {eq} from 'drizzle-orm';
export async function GET(request:Request){
 let q;try{q=parseJiraStatsQuery(new URL(request.url));}catch(e){return Response.json({error:e instanceof Error?e.message:'Périodes invalides.'},{status:400});}
 try{const [tickets,users,definitions,batch]=await Promise.all([loadJiraAnalyticsTickets(),directoryUsersAt(),getDb().select().from(marketDefinitions).where(eq(marketDefinitions.isActive,true)),latestCompletedJiraBatch()]);
 const markets=definitions.map(m=>({id:m.id,shortCode:m.shortCode,plannerTags:JSON.parse(m.plannerTags) as string[]}));
 return Response.json({report:buildAnalystJiraStats(tickets,users,markets,q),updatedAt:batch?.completedAt??batch?.createdAt??'',hasSource:!!batch},{headers:{'Cache-Control':'no-store'}});
 }catch{return Response.json({error:'Activité Jira indisponible. Réessaie après avoir vérifié le registre importé.'},{status:503});}
}
