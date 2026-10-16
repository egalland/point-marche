import { getRuntimeEnv } from "@/lib/runtime-env";
import { getEditorUser } from "../../simple-auth";
import { inspectPURCHASES, mergePURCHASES, purchaseDataSummary, type PURCHASESRow } from "@/lib/purchaseData";
import { PURCHASES_MAX_BYTES } from "@/lib/purchaseData-import";
const prefix = 'purchaseData-imports/', current = 'purchaseData-current.json';
type Snapshot = {chunks:string[];updatedAt:string;count:number;pieces?:number;articles?:number;gap?:number;sourceCount:number;duplicates:number;rejected:number;filename:string;sheet:string};
const options = {httpMetadata:{contentType:'application/json'},customMetadata:{name:'PURCHASES'}};
export async function GET(request?:Request){try{
 if(!await getEditorUser())return Response.json({error:'Accès refusé'},{status:401});
 const bucket=getRuntimeEnv()?.FILES;if(!bucket)throw Error('Stockage PURCHASES indisponible');
 const pointer=await bucket.get(current);let rows:PURCHASESRow[]=[],snapshot:Snapshot|null=null;
 if(pointer){snapshot=await new Response(pointer.body).json() as Snapshot;if(request&&new URL(request.url).searchParams.get('summary')==='1')return Response.json({metadata:snapshot},{headers:{'Cache-Control':'no-store'}});for(const key of snapshot.chunks){const f=await bucket.get(key);if(!f)throw Error('Extraction PURCHASES incomplète. Réessaie.');rows.push(...await new Response(f.body).json() as PURCHASESRow[]);}}
 else {const objects:{key:string}[]=[];let cursor:string|undefined;do{const list=await bucket.list({prefix,cursor});objects.push(...list.objects);cursor=list.truncated?list.cursor:undefined;}while(cursor);const batches=[];for(const object of objects){const f=await bucket.get(object.key);if(f){const b=await new Response(f.body).json() as {rows?:PURCHASESRow[];updatedAt?:string};if(Array.isArray(b.rows))batches.push(b);}}batches.sort((a,b)=>(a.updatedAt??'').localeCompare(b.updatedAt??''));rows=mergePURCHASES([],batches.flatMap(b=>b.rows??[]));}
 const metadata={...snapshot,count:rows.length,...purchaseDataSummary(rows)};
 if(request&&new URL(request.url).searchParams.get('summary')==='1')return Response.json({metadata},{headers:{'Cache-Control':'no-store'}});
 return Response.json({rows,updatedAt:snapshot?.updatedAt??'',metadata},{headers:{'Cache-Control':'no-store'}});
 }catch(e){return Response.json({error:e instanceof Error?e.message:'Lecture impossible'},{status:503});}}
export async function POST(request:Request){try{
 if(!await getEditorUser())return Response.json({error:'Accès refusé'},{status:401});
 const declared=Number(request.headers.get('Content-Length')||0);if(declared>PURCHASES_MAX_BYTES*1.1)return Response.json({error:'Extraction trop volumineuse : maximum 32 Mio de texte.'},{status:413});
 let text='',filename='',sheet='';
 if(request.headers.get('Content-Type')?.includes('multipart/form-data')){const form=await request.formData(),source=form.get('file');if(!(source instanceof File))throw Error('Fichier texte absent.');if(source.size>PURCHASES_MAX_BYTES)return Response.json({error:'Extraction trop volumineuse : maximum 32 Mio.'},{status:413});text=await source.text();filename=String(form.get('filename')??source.name).slice(0,250);sheet=String(form.get('sheet')??'').slice(0,150);}
 else {const body=await request.json() as {text?:unknown;filename?:string;sheet?:string};if(typeof body.text!=='string')throw Error('Extraction texte absente.');text=body.text;filename=String(body.filename??'Collage texte').slice(0,250);sheet=String(body.sheet??'').slice(0,150);}
 if(!text.trim())throw Error('Extraction vide.');if(new TextEncoder().encode(text).length>PURCHASES_MAX_BYTES)return Response.json({error:'Extraction trop volumineuse : maximum 32 Mio.'},{status:413});
 const parsed=inspectPURCHASES(text);if(parsed.rejected)return Response.json({error:`${parsed.rejected} ligne(s) invalide(s). Le registre précédent est conservé.`,issues:parsed.issues},{status:422});
 const bucket=getRuntimeEnv()?.FILES;if(!bucket)throw Error('Stockage PURCHASES indisponible');
 const id=crypto.randomUUID(),updatedAt=new Date().toISOString(),chunks:string[]=[];
 for(let i=0;i<parsed.rows.length;i+=1000){const key=`purchaseData-snapshots/${id}/${i}.json`;await bucket.put(key,new TextEncoder().encode(JSON.stringify(parsed.rows.slice(i,i+1000))),options);chunks.push(key);}
 const snapshot:Snapshot={...purchaseDataSummary(parsed.rows),chunks,updatedAt,count:parsed.rows.length,sourceCount:parsed.sourceCount,duplicates:parsed.duplicates,rejected:0,filename,sheet};
 await bucket.put(current,new TextEncoder().encode(JSON.stringify(snapshot)),options);
 return Response.json({...snapshot,...purchaseDataSummary(parsed.rows),mode:'replace'});
 }catch(e){return Response.json({error:e instanceof Error?e.message:'Import impossible. Le registre précédent est conservé.'},{status:400});}}
