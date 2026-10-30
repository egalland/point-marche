import type {CommercialOperation} from '../features/market-pulse/point-model';
import {escapeRichText as esc} from './point-rich-content';
import {simulationAveragesHtml,type SimulationMetric} from './simulation-presentation';
import {normalizeComparisonSnapshot,comparisonValue,type ComparisonSnapshot} from './simulation-comparison';
const pct=(value:unknown)=>typeof value==='number'&&Number.isFinite(value)?value.toLocaleString('fr-FR',{maximumFractionDigits:2})+' %':'—';
/** Email is a reading summary. Source histories, workflow steps and web charts never enter it. */
export function simulationMailHtml(items:CommercialOperation[],months:string[],averages:SimulationMetric[]){
 return months.map(month=>{
  const rows=items.filter(item=>(item.month||'Mois à définir').toLocaleLowerCase('fr-FR')===month.toLocaleLowerCase('fr-FR'));
  const metrics=(['globalVariation','weightedVariation'] as const).filter(key=>rows.some(item=>typeof item.plannerSource?.metrics?.[key]==='number'&&Number.isFinite(item.plannerSource.metrics[key])));
  return `<h3>${esc(month)} · ${rows.length}</h3>${simulationAveragesHtml(rows,averages)}${rows.length?`<table class="simulation-mail-table" width="100%" cellspacing="0" cellpadding="0" style="width:100%;border-collapse:collapse;font:12px/1.5 Arial,sans-serif"><thead><tr><th>Fournisseur / simulation</th><th>État</th>${metrics.map(key=>`<th>${key==='globalVariation'?'Variation GLOBAL':'Pondérée'}</th>`).join('')}</tr></thead><tbody>${rows.map(item=>`<tr><td style="padding:9px 8px;border-bottom:1px solid #e7edea;vertical-align:top"><strong>${esc(item.plannerOverride?.name||item.plannerSource?.supplierLabel||item.name||'Simulation')}</strong>${item.summary?.trim()?`<p style="margin:4px 0 0;white-space:pre-wrap;font:12px/1.5 Arial,sans-serif;color:#41534e">${esc(item.summary)}</p>`:''}</td><td style="padding:9px 8px;border-bottom:1px solid #e7edea;vertical-align:top">${esc(item.state||'À faire')}</td>${metrics.map(key=>`<td style="padding:9px 8px;border-bottom:1px solid #e7edea;vertical-align:top;text-align:right">${pct(item.plannerSource?.metrics?.[key])}</td>`).join('')}</tr>`).join('')}</tbody></table>`:'<p>Aucune simulation sur cette période.</p>'}`;
 }).join('');
}
export function simulationComparisonMailHtml(input:ComparisonSnapshot|undefined){
 const snapshot=normalizeComparisonSnapshot(input);if(!snapshot)return '<p>Comparatif à configurer dans le point.</p>';
 const {config,totalA,totalB}=snapshot,delta=totalA===null||totalB===null?null:totalB-totalA;
 return `<p><b>${esc(snapshot.title)}</b></p><table width="100%" cellspacing="0" cellpadding="0"><thead><tr><th>Période</th><th>Valeur</th></tr></thead><tbody>${(['A','B'] as const).map(p=>`<tr><td>${p==='A'?'Période initiale':'Période comparée'} · ${esc(config[`from${p}`])} → ${esc(config[`to${p}`])}</td><td><b>${esc(comparisonValue(snapshot[`total${p}`],config.metric))}</b>${config.metric==='count'?'':`<br><small>${snapshot[`count${p}`]} simulation(s) dans la période</small>`}</td></tr>`).join('')}</tbody></table><p>Écart : <b>${delta===null?'Sans donnée':esc(delta.toLocaleString('fr-FR',{maximumFractionDigits:2}))}${delta!==null&&config.metric!=='count'?' points':''}</b></p>`;
}
