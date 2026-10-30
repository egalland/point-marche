export type ChartFormat = 'line' | 'area' | 'bar' | 'donut' | 'pie';
export type ChartCategory = {key:string;label:string;detail?:string};
export type ChartSeries = {id:string;label:string;color:string;reference?:boolean;values:(number|null)[];summary?:number|null};
export const chartPalette=['#2584d6','#d77b24','#23977a','#a866ce','#d65c83','#768f29','#239eb1','#9b7357'];
export const chartColor=(index:number)=>chartPalette[index]??`hsl(${index*137.5%360} 58% 48%)`;
export const chartNumber=(value:number|null|undefined,unit='')=>value==null||!Number.isFinite(value)?'—':`${value.toLocaleString('fr-FR',{maximumFractionDigits:2})}${unit?` ${unit}`:''}`;
export function chartDomain(series:ChartSeries[]){
 const values=series.flatMap(s=>s.values).filter((v):v is number=>typeof v==='number'&&Number.isFinite(v));
 const low=Math.min(0,...values),high=Math.max(0,...values);
 if(low===high)return {min:0,max:1};
 const span=high-low;return {min:low<0?low-span*.06:0,max:high>0?high+span*.08:0};
}
/** Keep absent observations as gaps, never connect them to zero. */
export function chartSegments(values:(number|null)[],x:(i:number)=>number,y:(n:number)=>number){
 const segments:string[][]=[];let current:string[]=[];
 values.forEach((v,i)=>{if(v===null||!Number.isFinite(v)){if(current.length)segments.push(current);current=[];}else current.push(`${x(i)},${y(v)}`);});if(current.length)segments.push(current);return segments;
}
export function chartSummary(series:ChartSeries){return series.summary!==undefined?series.summary:series.values.reduce<number>((n,v)=>n+(v??0),0);}
