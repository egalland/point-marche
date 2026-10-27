"use client";
import {createContext,useContext,useEffect,useState,type ReactNode} from "react";
import {appFetch} from "@/lib/app-transport";
import {ROOT_ADMIN,normalizeUserCode,validUserCode,type AccessPerson,type AccessRole} from "@/lib/access-control";
import {useAccess} from "./access-panel";
import type {GlobalDirectoryUser} from "@/lib/global-directory";
type State={people:AccessPerson[];ready:boolean;busy:boolean;change:(usercode:string,name:string,role:AccessRole,expectedRole:AccessRole)=>Promise<void>};
const Context=createContext<State>({people:[],ready:false,busy:false,change:async()=>{}});
async function request(url:string,init?:RequestInit){const r=await appFetch(url,init),body=await r.json();if(!r.ok)throw Error(body.error||"Droits indisponibles.");return body;}
export function DirectoryAccessProvider({users,children}:{users:GlobalDirectoryUser[];children:ReactNode}){
 const {effective}=useAccess(),[people,setPeople]=useState<AccessPerson[]>([]),[ready,setReady]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState("");
 const signature=users.map(p=>`${p.usercode}:${p.role}:${p.name}`).join("|");
 useEffect(()=>{if(effective.role!=="superadmin")return;let active=true;setReady(false);void request("/api/admin/roles").then(r=>{if(active){setPeople(r.people);setReady(true);setError("");}}).catch(e=>{if(active)setError(e.message);});return()=>{active=false;};},[effective.role,signature]);
 const change=async(usercode:string,name:string,role:AccessRole,expectedRole:AccessRole)=>{
  if(effective.role!=="superadmin"||busy)return;setBusy(true);setError("");
  try{await request("/api/admin/roles",{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({usercode,name,role,expectedRole})});const r=await request("/api/admin/roles");setPeople(r.people);window.dispatchEvent(new Event("access-updated"));}
  catch(e){setError((e as Error).message);try{const r=await request("/api/admin/roles");setPeople(r.people);}catch{setReady(false);}}
  finally{setBusy(false);}
 };
 return <Context.Provider value={{people,ready,busy,change}}>{error&&<p role="alert">{error}</p>}{effective.role==="superadmin"&&<p className="access-note">Les cases Admin et Super admin sont enregistrées immédiatement. Super admin inclut Admin. Décoche Super admin avant de pouvoir retirer Admin.</p>}{children}</Context.Provider>;
}
export function DirectoryAccessCheckboxes({usercode,name}:{usercode:string;name:string}){
 const {effective}=useAccess(),state=useContext(Context);if(effective.role!=="superadmin")return null;
 const id=normalizeUserCode(usercode),person=state.people.find(p=>p.usercode===id),role=person?.role||(id===ROOT_ADMIN?"superadmin":"user");
 return <DirectoryRoleCheckboxes name={name} role={role} locked={!state.ready||state.busy||!validUserCode(id)||id===ROOT_ADMIN} onChange={next=>{void state.change(id,name,next,role);}}/>;
}
export function DirectoryRoleCheckboxes({name,role,locked,onChange}:{name:string;role:AccessRole;locked:boolean;onChange:(role:AccessRole)=>void}){
 return <div className="directory-access-checks" role="group" aria-label={`Droits de ${name}`}><label><input type="checkbox" aria-label={`Admin · ${name}`} checked={role!=="user"} disabled={locked||role==="superadmin"} onChange={e=>onChange(e.target.checked?"admin":"user")}/>Admin</label><label><input type="checkbox" aria-label={`Super admin · ${name}`} checked={role==="superadmin"} disabled={locked} onChange={e=>onChange(e.target.checked?"superadmin":"admin")}/>Super admin</label></div>;
}
