import {accessHeaders,clientCan} from "../lib/access-client";
import type {AppTransport,LocalDraft,LocalDraftBridge} from "../lib/app-transport";
import type {PublishedPoint,StoredPointDraft} from "../lib/point-persistence";
export type {AppTransport,LocalDraft,LocalDraftBridge} from "../lib/app-transport";
let transport:AppTransport|null=null;
let drafts:LocalDraftBridge|null=null;
/** Portable builds use only the workbook bridge; they never fall back to a network request. */
export function installLocalTransport(next:AppTransport,bridge:LocalDraftBridge){transport=next;drafts=bridge;}
export function isLocalWorkspace(){return true;}
export function appFetch(input:RequestInfo|URL,init?:RequestInit){
 if(!transport)return Promise.reject(new Error("Le classeur local n’est pas encore ouvert."));
 return transport(input,accessHeaders(init));
}
export function readLocalDraft(scope:LocalDraft["scope"],ownerId:string,date?:string){return drafts?.read(scope,ownerId,date)??null;}
export function writeLocalDraft(draft:LocalDraft){if(clientCan(draft.scope==="analyst"?"analyst.edit":"point.edit"))drafts?.write(draft);}
export function markLocalFormPending(key:string,pending:boolean){drafts?.pending?.(key,pending);}
export function readLocalPreference(key:string){return drafts?.readPreference?.(key);}
export function writeLocalPreference(key:string,value:string){drafts?.writePreference?.(key,value);}
export function openLocalFiles(){drafts?.openFiles?.();}
export function saveLocalFile(saveAs=false){return drafts?.saveFile?.(saveAs)??Promise.resolve(false);}
export function loadPointDraft(scope:LocalDraft["scope"],ownerId:string,date?:string){return Promise.resolve(readLocalDraft(scope,ownerId,date));}
// Compatibility with shared screens; all remote queue and reconciliation code is excluded.
export function configureHostedDrafts(_editor:string|null){}
export function markPointSaved(_draft:LocalDraft,_point?:PublishedPoint){}
export function hasUnsavedSessionDrafts(){return false;}
export function clearSessionDrafts(){}
export function preparePointSave(_draft:LocalDraft){return Promise.resolve({});}
export function finishPointSave(_draft:LocalDraft,_saved?:{point:PublishedPoint;draft?:StoredPointDraft},_conflict=false){}
export const hostedPointDrafts={state:(_scope:string,_owner:string,_date:string)=>({status:"idle" as const,updatedAt:"",message:""}),flushAll:(_keepalive=false)=>Promise.resolve(true)};
