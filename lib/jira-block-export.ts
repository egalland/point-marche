import {jiraBlockReport} from './jira-block-report';
import {jiraBlockViews,jiraBlockMetrics} from './jira-block-settings';
import {escapeRichText as esc} from './point-rich-content';
import {safeExternalUrl} from './safe-link';
import {resolutionKpiHtml} from './jira-market-kpis';
import {jiraTrendChartHtml,jiraCategoryChartHtml} from './jira-presentation-charts';
import type {PointData,Market} from '../features/market-pulse/point-model';
/** The fixed presentation is shared by the point, email and standalone HTML. */
export function jiraBlockSummaryHtml(data:PointData,market:Market,mail=false){
 const r=jiraBlockReport(data,market),c=r.config,number=(v:number|null)=>v===null?'—':v.toLocaleString('fr-FR',{maximumFractionDigits:1});
 const unavailable=!r.known||c.view==='completed'&&!r.completedKnown;
 const kpis=c.metrics.length?`<table role="presentation" width="100%"><tr>${c.metrics.map(metric=>`<td style="padding:10px;vertical-align:top"><span style="font-size:11px">${esc(jiraBlockMetrics[metric])}</span><br><strong style="font-size:23px">${number(r.metrics[metric])}${metric==='resolution'?' j ouvrés':''}</strong></td>`).join('')}</tr></table>`:'';
 const rows=c.view==='summary'?'':`<h3>${esc(jiraBlockViews[c.view])} · ${unavailable?'—':r.total} ticket(s)</h3>${unavailable?'<p>Actualise les données Jira du point pour récupérer les tickets terminés.</p>':r.groups.map(group=>`${group.label?`<h4>${esc(group.label)}</h4>`:''}<table width="100%" cellspacing="0" cellpadding="0">${group.items.map(t=>`<tr><td style="padding:9px;border-bottom:1px solid #dce5e2"><strong>${safeExternalUrl(t.link)?`<a href="${esc(safeExternalUrl(t.link))}">${esc(t.key||'Ticket')}</a>`:esc(t.key||'Synthèse')}</strong> · ${esc(t.summary)}<br><small>${esc(t.status)}${c.showCategories?' · '+esc([t.category,t.subcategory].filter(Boolean).join(' / ')):''}${c.showDates?' · '+esc(t.assignee||'Non assigné')+' · '+esc(t.resolutionAt?.slice(0,10)||t.lastActivity?.slice(0,10)||'Date non renseignée'):''}</small>${c.showComment&&t.comment?`<p style="white-space:pre-wrap">${esc(t.comment)}</p>`:''}</td></tr>`).join('')}</table>`).join('')||'<p>Aucun ticket correspondant à cette vue.</p>'}${r.remaining?`<p>${r.rows.length} ligne(s) présentée(s) sur ${r.rowCount} · ${r.remaining} autre(s) ligne(s).</p>`:''}`;
 return `<section class="jira-point-summary jira-unified-export">${kpis}${c.showTrend?jiraTrendChartHtml(r.resolution?.trend,c.trendWeeks,c.showTrendResolution):''}${c.showCategorySummary?jiraCategoryChartHtml(data.jira,r.known):''}${rows}${c.showMonthlyResolution?resolutionKpiHtml(data.jira,data.meetingDate,data.jiraMode==='automatic'?data.jiraResolution:undefined):''}${!r.completedKnown?'<p>Actualise les données Jira du point pour récupérer les tickets terminés. Les points enregistrés conservent leur instantané.</p>':''}</section>`;
}
