export const jiraBlockViews={summary:'Indicateurs seuls',open:'En cours',completed:'Terminés de la semaine',attention:'À surveiller',critical:'Critiques',closed:'Fermés du point',all:'Tous les tickets du point'};
export const jiraBlockLayouts={list:'Liste compacte',people:'Par personne',categories:'Par catégorie',statuses:'Par statut'};
export const jiraBlockMetrics={open:'Tickets ouverts',completed:'Terminés cette semaine',attention:'À surveiller',critical:'Critiques',resolution:'Délai moyen · semaine'};
export type JiraBlockView=keyof typeof jiraBlockViews;
export type JiraBlockMetric=keyof typeof jiraBlockMetrics;
export type JiraBlockPresentation={view:JiraBlockView;layout:keyof typeof jiraBlockLayouts;metrics:JiraBlockMetric[];limit:number;status:string;category:string;assignee:string;showComment:boolean;showDates:boolean;showCategories:boolean;showFilters:boolean;showTrend:boolean;trendWeeks:number;showTrendResolution:boolean;showMonthlyResolution:boolean;showCategorySummary:boolean};
export function normalizeJiraBlockPresentation(value:unknown):JiraBlockPresentation{
 const v=value&&typeof value==='object'?value as Partial<JiraBlockPresentation>:{};
 const filter=(value:unknown)=>typeof value==='string'&&value.trim()?value.trim().slice(0,240):'all';
 return {view:v.view&&Object.hasOwn(jiraBlockViews,v.view)?v.view:'summary',layout:v.layout&&Object.hasOwn(jiraBlockLayouts,v.layout)?v.layout:'list',metrics:Array.isArray(v.metrics)?[...new Set(v.metrics.filter(k=>Object.hasOwn(jiraBlockMetrics,k)))]:['open','completed','resolution'],limit:[5,10,20,50].includes(Number(v.limit))?Number(v.limit):10,status:filter(v.status),category:filter(v.category),assignee:filter(v.assignee),showComment:v.showComment===true,showDates:v.showDates===true,showCategories:v.showCategories===true,showFilters:false,showTrend:v.showTrend===true,trendWeeks:v.trendWeeks===3?3:4,showTrendResolution:v.showTrendResolution!==false,showMonthlyResolution:v.showMonthlyResolution===true,showCategorySummary:v.showCategorySummary===true};
}
