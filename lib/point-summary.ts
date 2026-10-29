import {normalizePointSummary,summaryMetricNames,type SummaryMetric} from './point-summary-settings';
import {escapeRichText} from './point-rich-content';
import {isClosedJiraStatus} from './jira-import';
import {isPromotionClosed,isClosed,jiraItemCount,type PointData,type Market} from '../features/market-pulse/point-model';
export function pointSummary(data:PointData,_market:Market){
 const settings=normalizePointSummary(data.preferences.summary),dossiers=data.dossiers.filter(p=>!isClosed(p.status)),tickets=data.jira.filter(p=>!isClosedJiraStatus(p.status));
 const knownJira=data.jiraMode==='manual'||!!data.sourceFreshness?.jira||data.jira.length>0,knownPlanner=data.plannerMode==='manual'||!!data.sourceFreshness?.planner||data.operations.length>0;
 const all:Record<SummaryMetric,{value:number|null;detail:string}>={
 dossiers:{value:dossiers.length,detail:'Hors dossiers terminés ou annulés'},
 jira:{value:knownJira?tickets.reduce((n,t)=>n+jiraItemCount(t),0):null,detail:knownJira?'Tickets encore ouverts':'Source à vérifier'},
 operations:{value:knownPlanner?data.operations.filter(p=>p.state!=='Faite').length:null,detail:knownPlanner?'Hors simulations finalisées':'Source à vérifier'},
 promotions:{value:data.promotions.filter(p=>!isPromotionClosed(p)).length,detail:'Hors promotions terminées ou annulées'},
 };return {settings,metrics:settings.metrics.filter(key=>data.preferences.readModules[key]).map(key=>({key,label:summaryMetricNames[key],...all[key]}))};
}
export function pointSummaryHtml(data:PointData,market:Market){const {settings,metrics}=pointSummary(data,market);if(!settings.visible)return '';return `<section class="point-summary-export" style="padding:18px 24px;border-bottom:1px solid #dde5e2"><h2 style="font-size:14px;margin:0 0 12px">En un regard</h2><table role="presentation" width="100%"><tr>${metrics.map(m=>`<td style="padding:8px;vertical-align:top"><b style="font-size:23px">${m.value===null?'—':m.value}</b><br><span style="font-size:12px">${escapeRichText(m.label)}</span></td>`).join('')}</tr></table>${settings.note?`<p style="white-space:pre-wrap;font-size:13px">${escapeRichText(settings.note)}</p>`:''}</section>`;}
