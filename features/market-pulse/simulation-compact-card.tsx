"use client";
import {useState} from 'react';
import type {CommercialOperation} from './point-model';
import type {PointCanvasActions} from './point-preview';
import {toneForStatus} from './point-model';
import {MARKET_SIMULATION_STATES,hasMarketSimulationOverride} from '@/lib/market-simulation';
import {SimulationDetails} from './simulation-details';
import {SimulationHistoryMini} from './simulation-point-metrics';
import {ManualSimulationRemove} from './manual-simulation-remove';
export function SimulationCompactCard({item,months,history,actions}:{item:CommercialOperation;months:string[];history:boolean;actions?:PointCanvasActions}){
 const [open,setOpen]=useState(false),m=item.plannerSource?.metrics;
 const pct=(v:number|null|undefined)=>typeof v==='number'&&Number.isFinite(v)?`${v.toLocaleString('fr-FR',{maximumFractionDigits:2})} %`:'—';
 return <article className={`simulation-compact-card ${open?'is-open':''}`} onClick={e=>e.stopPropagation()}>
  <div className="simulation-compact-line"><strong title={item.name}>{item.plannerOverride?.name||item.plannerSource?.supplierLabel||item.name||'Simulation sans titre'}</strong>{actions?<select className={`tone-${toneForStatus(item.state)}`} aria-label={`État ${item.name}`} value={item.state} onChange={e=>actions.updateOperation(item.id,{state:e.target.value})}>{[...new Set([item.state,...MARKET_SIMULATION_STATES])].map(s=><option key={s}>{s}</option>)}</select>:<span className={`report-pill tone-${toneForStatus(item.state)}`}>{item.state}</span>}{m&&<span className="simulation-compact-values"><span title="Variation GLOBAL">D {pct(m.globalVariation)}</span><span title="Variation pondérée">P {pct(m.weightedVariation)}</span></span>}{history&&!!item.plannerSource?.variationHistory?.length&&<div className="simulation-compact-trend"><SimulationHistoryMini item={item}/></div>}<button type="button" className="simulation-compact-toggle" aria-label={`${open?'Fermer':'Ouvrir'} les détails de ${item.name}`} aria-expanded={open} onClick={()=>setOpen(!open)}>{open?'−':'⋯'}</button></div>
  {item.summary&&!open&&<p className="simulation-compact-comment" title={item.summary}>{item.summary}</p>}
  {open&&<div className="simulation-compact-detail">{actions&&<div className="simulation-compact-form"><label>Nom<input aria-label={`Nom de la simulation ${item.id}`} value={item.name} onChange={e=>actions.updateOperation(item.id,{name:e.target.value})}/></label><label>Période<select value={item.month} onChange={e=>actions.updateOperation(item.id,{month:e.target.value})}>{[...new Set([...months,item.month])].map(month=><option key={month}>{month}</option>)}</select></label><label className="simulation-comment-field">Commentaire<textarea rows={2} value={item.summary} onChange={e=>actions.updateOperation(item.id,{summary:e.target.value})}/></label>{hasMarketSimulationOverride(item.plannerOverride)&&<button type="button" onClick={()=>actions.resetOperation(item.id)}>Rétablir la valeur importée</button>}</div>}<SimulationDetails item={item} showHistory={false}/><ManualSimulationRemove item={item} onRemove={actions?.removeOperation}/></div>}
 </article>;
}
