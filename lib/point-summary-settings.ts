export const summaryMetricNames={dossiers:'Dossiers actifs',operations:'Simulations à suivre',jira:'Tickets ouverts',promotions:'Promotions en cours'};
export type SummaryMetric=keyof typeof summaryMetricNames;
export type PointSummarySettings={visible:boolean;metrics:SummaryMetric[];note:string};
export function normalizePointSummary(value:unknown):PointSummarySettings{const v=value&&typeof value==='object'?value as Partial<PointSummarySettings>:{};return {visible:v.visible!==false,metrics:Array.isArray(v.metrics)?[...new Set(v.metrics.filter(k=>Object.hasOwn(summaryMetricNames,k)))]:['dossiers','jira','promotions','operations'],note:typeof v.note==='string'?v.note.slice(0,2000):''};}
