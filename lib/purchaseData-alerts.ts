import {isIsoDate} from './iso-week';
import {purchaseDataText,type PURCHASESRow} from './purchaseData';
export type PURCHASESAlertSettings={enabled:boolean;warningDays:number;criticalDays:number;repeatLines:number;gapAmount:number};
export type PURCHASESAlert={title:string;detail:string;severity:'warning'|'danger';category:'PURCHASES';targetId?:string};
export function normalizePURCHASESAlerts(raw?:Partial<PURCHASESAlertSettings>):PURCHASESAlertSettings{
 const n=(v:unknown,f:number,min:number,max:number)=>typeof v==='number'&&Number.isFinite(v)?Math.max(min,Math.min(max,Math.round(v))):f;
 const warningDays=n(raw?.warningDays,14,1,3650);return {enabled:raw?.enabled!==false,warningDays,criticalDays:Math.max(warningDays,n(raw?.criticalDays,30,1,3650)),repeatLines:n(raw?.repeatLines,3,2,100000),gapAmount:n(raw?.gapAmount,0,0,1000000000)};
}
/** Current extraction only; age is calendar days since first extraction, not proof of resolution delay. */
export function purchaseDataAlerts(rows:PURCHASESRow[],specialties:string[],asOf:string,raw?:Partial<PURCHASESAlertSettings>):PURCHASESAlert[]{
 const s=normalizePURCHASESAlerts(raw);if(!s.enabled||!specialties.length||!isIsoDate(asOf))return [];
 const selected=new Set(specialties.map(purchaseDataText));const scoped=rows.filter(r=>selected.has(purchaseDataText(r.specialty))&&isIsoDate(r.extracted)&&r.extracted<=asOf);
 const age=(r:PURCHASESRow)=>Math.round((Date.parse(asOf+'T12:00:00Z')-Date.parse(r.extracted+'T12:00:00Z'))/86400000);
 const old=scoped.filter(r=>age(r)>=s.warningDays),critical=old.filter(r=>age(r)>=s.criticalDays);const alerts:PURCHASESAlert[]=[];
 if(old.length)alerts.push({title:`PURCHASES anciens · ${old.length} ligne(s)`,detail:`Première extraction depuis au moins ${s.warningDays} jours calendaires ; ${critical.length} à ${s.criticalDays} jours ou plus. Stock de l’extraction, au ${asOf}.`,severity:critical.length?'danger':'warning',category:'PURCHASES'});
 const articles=new Map<string,number>();for(const r of scoped)if(r.article)articles.set(r.article,(articles.get(r.article)??0)+1);const repeated=[...articles].filter(([,count])=>count>=s.repeatLines);
 if(repeated.length)alerts.push({title:`PURCHASES récurrents · ${repeated.length} article(s)`,detail:`Au moins ${s.repeatLines} lignes par article dans l’extraction des spécialités sélectionnées. Exemple : ${repeated.slice(0,3).map(([a,n])=>`${a} (${n})`).join(', ')}.`,severity:'warning',category:'PURCHASES'});
 if(s.gapAmount>0){const large=scoped.filter(r=>Number.isFinite(r.gap)&&Math.abs(r.gap)>=s.gapAmount);if(large.length)alerts.push({title:`PURCHASES écart élevé · ${large.length} ligne(s)`,detail:`Valeur absolue de l’écart par ligne ≥ ${s.gapAmount.toLocaleString('fr-FR')} €.`,severity:'danger',category:'PURCHASES'});}
 return alerts;
}
