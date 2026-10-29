"use client";
import {AppIcon} from '@/components/app-icon';
import type {CommercialOperation} from './point-model';
/** Available to editors in both the reading card and inline form. */
export function ManualSimulationRemove({item,onRemove}:{item:CommercialOperation;onRemove?: (id:string)=>void}){
 if(!onRemove||item.plannerSource||item.id.startsWith('planner:'))return null;
 return <button type="button" className="manual-simulation-remove" aria-label={`Retirer la simulation ${item.name||'sans titre'}`} onPointerDown={event=>event.stopPropagation()} onClick={event=>{event.preventDefault();event.stopPropagation();onRemove(item.id);}}><AppIcon name="trash" size={15}/> Retirer cette simulation</button>;
}
