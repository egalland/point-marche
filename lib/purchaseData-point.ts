import {purchaseDataAlerts} from "./purchaseData-alerts";
import {purchaseDataText,type PURCHASESConfig,type PURCHASESReport,type PURCHASESRow} from './purchaseData';

export function pointWeek(meetingDate:string){
 const day=new Date(`${meetingDate}T00:00:00Z`);
 if(!/^\d{4}-\d{2}-\d{2}$/.test(meetingDate)||!Number.isFinite(+day)||day.toISOString().slice(0,10)!==meetingDate)return {from:'',to:''};
 day.setUTCDate(day.getUTCDate()-(day.getUTCDay()+6)%7);
 const from=day.toISOString().slice(0,10);day.setUTCDate(day.getUTCDate()+6);
 return {from,to:day.toISOString().slice(0,10)};
}
export function pointPURCHASESConfig(configs:PURCHASESConfig[]=[],meetingDate:string):PURCHASESConfig{
 const previous=configs[0],base:PURCHASESConfig=previous??{id:'point-purchaseData',title:'Nombre de PURCHASES',specialty:'',supplier:'',article:'',from:'',to:'',group:'week',date:'extracted',metric:'lines',display:'table',compare:false};
 const specialties=[...new Map((previous?.specialties??configs.map(c=>c.specialty)).filter(v=>typeof v==='string'&&v.trim()).map(v=>[purchaseDataText(v),v])).values()];
 return {...base,alertDate:meetingDate,title:'Nombre de PURCHASES',specialty:'',specialties,supplier:'',article:'',date:'extracted',metric:'lines',compare:false,pointPeriod:previous?.pointPeriod==='custom'?'custom':'week',...(previous?.pointPeriod==='custom'?{}:pointWeek(meetingDate))};
}
export function pointPURCHASESScope(c:PURCHASESConfig){return JSON.stringify([c.from,c.to,(c.specialties??[]).map(purchaseDataText).sort()]);}
export function validPointPURCHASESPeriod(c:PURCHASESConfig){const valid=(v:string)=>/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v+'T00:00:00Z'))&&new Date(v+'T00:00:00Z').toISOString().slice(0,10)===v;return valid(c.from)&&valid(c.to)&&c.from<=c.to;}
export function createPURCHASESPointReport(rows:PURCHASESRow[],c:PURCHASESConfig,updatedAt=''):PURCHASESReport{
 const counts=new Map((c.specialties??[]).map(s=>[purchaseDataText(s),{specialty:s,count:0}]));
 if(validPointPURCHASESPeriod(c))for(const row of rows){const item=counts.get(purchaseDataText(row.specialty));if(item&&row.extracted>=c.from&&row.extracted<=c.to)item.count++;}
 const pointCounts=[...counts.values()];
 return {vigilances:purchaseDataAlerts(rows,c.specialties??[],c.alertDate??c.to,c.alerts),alertAsOf:c.alertDate??c.to,summary:{lines:pointCounts.reduce((sum,item)=>sum+item.count,0),pieces:0,articles:0,gap:0},series:[],months:[],updatedAt,pointCounts,pointScope:pointPURCHASESScope(c)};
}
export function savedPURCHASESPointReport(c:PURCHASESConfig){
 if(c.report?.pointCounts&&c.report.pointScope===pointPURCHASESScope(c))return c.report;
 return undefined;
}
const esc=(v:unknown)=>String(v??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]!));
export function purchaseDataPointExport(configs:PURCHASESConfig[]=[],meetingDate:string){
 const c=pointPURCHASESConfig(configs,meetingDate),report=savedPURCHASESPointReport(c);
 if(!validPointPURCHASESPeriod(c))return '<p>Choisir une période valide pour les PURCHASES.</p>';
 const period=`<p>Du ${esc(c.from)} au ${esc(c.to)} · première extraction</p>`;
 if(!c.specialties?.length)return `${period}<p>Choisir une ou plusieurs spécialités dans le module PURCHASES du point.</p>`;
 if(!report)return `${period}<p>${c.specialties.map(esc).join(' · ')}</p><p>Données PURCHASES indisponibles pour cette sélection.</p>`;
 return `<section id="purchaseData-point" class="purchaseData-point-count">${period}<p><strong style="font-size:32px">${report.summary.lines.toLocaleString('fr-FR')}</strong> PURCHASES</p><table class="export-data"><thead><tr><th>Spécialité</th><th>Nombre de PURCHASES</th></tr></thead><tbody>${report.pointCounts!.map(row=>`<tr><td>${esc(row.specialty)}</td><td>${row.count.toLocaleString('fr-FR')}</td></tr>`).join('')}</tbody></table></section>`;
}
