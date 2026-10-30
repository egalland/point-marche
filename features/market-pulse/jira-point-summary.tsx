"use client";
import {jiraBlockReport} from '../../lib/jira-block-report';
import {jiraBlockViews,jiraBlockMetrics,type JiraBlockPresentation} from '../../lib/jira-block-settings';
import {jiraTrendChartHtml,jiraCategoryChartHtml,jiraPresentationNumber as fmt} from '../../lib/jira-presentation-charts';
import {safeExternalUrl} from '../../lib/safe-link';
import {JiraResolutionKpis} from './jira-resolution-kpis';
import type {PointData,Market,PointRecord} from './point-model';
export function JiraPointSummary({data,market}:{data:PointData;market:Market;archive:PointRecord[];onPresentationChange?:(value:JiraBlockPresentation)=>void}){
 const report=jiraBlockReport(data,market),config=report.config;
 return <section className="jira-point-summary jira-unified jira-presentation" aria-label={`Synthèse des tickets · ${market.name}`}>
 {!!config.metrics.length&&<div className="jira-summary-counts" style={{gridTemplateColumns:`repeat(${Math.min(3,config.metrics.length)},minmax(0,1fr))`}}>{config.metrics.map(metric=><article key={metric} className={metric==='completed'?'completed-spotlight':metric==='resolution'?'resolution-spotlight':''}><span>{jiraBlockMetrics[metric]}</span><strong>{fmt(report.metrics[metric])}{metric==='resolution'&&<small> j ouvrés</small>}</strong></article>)}</div>}
 {config.showTrend&&<div dangerouslySetInnerHTML={{__html:jiraTrendChartHtml(report.resolution?.trend,config.trendWeeks,config.showTrendResolution)}}/>}
 {config.showCategorySummary&&<div dangerouslySetInnerHTML={{__html:jiraCategoryChartHtml(data.jira,report.known)}}/>}
 {config.view!=='summary'&&<section className="jira-block-list" aria-label={jiraBlockViews[config.view]}><header><strong>{jiraBlockViews[config.view]}</strong><span>{!report.known||config.view==='completed'&&!report.completedKnown?'—':report.total} ticket(s)</span></header>{!report.known||config.view==='completed'&&!report.completedKnown?<p>Données de cette liste non enregistrées dans le point.</p>:report.rows.length?report.groups.map(group=><div key={group.label}>{group.label&&<h4>{group.label}</h4>}<ul>{group.items.map(t=><li key={t.id}><div><b>{safeExternalUrl(t.link)?<a href={safeExternalUrl(t.link)} target="_blank" rel="noreferrer">{t.key||'Ticket'}</a>:t.key||'Synthèse'}</b><span>{t.summary||'Sans résumé'}</span><em>{t.status}</em></div>{config.showCategories&&<small>{[t.category,t.subcategory].filter(Boolean).join(' / ')||'Catégorie non renseignée'}</small>}{config.showDates&&<small>{t.assignee||'Non assigné'} · {t.resolutionAt?.slice(0,10)||t.lastActivity?.slice(0,10)||'Date non renseignée'}</small>}{config.showComment&&t.comment&&<p>{t.comment}</p>}</li>)}</ul></div>):<p>Aucun ticket correspondant.</p>}{report.remaining>0&&<small>{report.rows.length} ligne(s) présentée(s) sur {report.rowCount} · {report.remaining} autre(s) ligne(s).</small>}</section>}
 {config.showMonthlyResolution&&<JiraResolutionKpis showWeekly={false} tickets={data.jira} date={data.meetingDate} snapshot={data.jiraMode==='automatic'?data.jiraResolution:undefined}/>}
 {!report.completedKnown&&<small className="jira-source-note">Actualise les données Jira du point pour récupérer les tickets terminés. Les points enregistrés conservent leur instantané.</small>}
 </section>;
}
