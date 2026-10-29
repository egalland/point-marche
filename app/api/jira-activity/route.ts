import {jiraActivityResponse} from "../analyst-activity/route";
export async function GET(request:Request){return jiraActivityResponse(request,true);}
