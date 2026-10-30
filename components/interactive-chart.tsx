"use client";
import {useId,useMemo,useState,useRef,useEffect,type PointerEvent,type KeyboardEvent} from 'react';
import {chartColor,chartDomain,chartNumber,chartSegments,chartSummary,type ChartCategory,type ChartSeries,type ChartFormat} from '../lib/interactive-chart';
export type InteractiveChartProps={
 title:string;categories:ChartCategory[];series:ChartSeries[];unit?:string;initialFormat?:ChartFormat;formats?:ChartFormat[];pieBy?:'category'|'series';
 onApply?:(index:number,reference:boolean)=>void;applyLabel?:string;onFilter?:(index:number)=>void;filterLabel?:string;compositionNote?:string;
};
const formatNames:Record<ChartFormat,string>={line:'Courbes',area:'Aires',bar:'Bâtons',donut:'Anneau',pie:'Camembert'};
export function InteractiveChart({title,categories,series,unit='',initialFormat='line',formats=['line','area','bar','donut','pie'],pieBy='category',onApply,applyLabel='Utiliser cette semaine',onFilter,filterLabel='Filtrer sur cette valeur',compositionNote}:InteractiveChartProps){
 const id=useId().replace(/:/g,''),[format,setFormat]=useState<ChartFormat>(initialFormat),[hidden,setHidden]=useState<string[]>([]),[hover,setHover]=useState<string|null>(null),[pinned,setPinned]=useState<string|null>(null),[highlight,setHighlight]=useState<string|null>(null),[windowSize,setWindow]=useState(0);
 const plotRef=useRef<HTMLDivElement>(null),[chartWidth,setChartWidth]=useState(920);
 useEffect(()=>{const element=plotRef.current;if(!element)return;const measure=()=>setChartWidth(Math.max(320,Math.round(element.clientWidth)));measure();if(typeof ResizeObserver==='undefined')return;const observer=new ResizeObserver(measure);observer.observe(element);return()=>observer.disconnect();},[categories.length>0]);
 const circular=format==='pie'||format==='donut',start=windowSize?Math.max(0,categories.length-windowSize):0;
 const visibleCategories=categories.slice(start),source=series.map(s=>({...s,values:s.values.slice(start)}));
 const legend=pieBy==='series'?series.filter(s=>!s.reference).map(s=>({id:s.id,label:s.label,color:s.color})):categories.map((c,i)=>({id:c.key,label:c.label,color:chartColor(i)}));
 const displayed=source.filter(s=>pieBy!=='series'||!hidden.includes(s.id.replace(/:reference$/,''))).map(s=>({...s,values:s.values.map((v,i)=>pieBy==='category'&&hidden.includes(visibleCategories[i]?.key)?null:v)}));
 const activeKey=hover??pinned,activeIndex=categories.findIndex(c=>c.key===activeKey),activeLegend=legend.find(l=>l.id===activeKey),selected=categories[activeIndex];
 const focusKey=(key:string)=>setHover(key),pin=(key:string)=>{setPinned(v=>v===key?null:key);setHover(key);};
 const toggle=(key:string)=>setHidden(v=>v.includes(key)?v.filter(k=>k!==key):[...v,key]);
 const domain=useMemo(()=>{const d=chartDomain(displayed);return unit?d:{min:Math.floor(d.min/4)*4,max:Math.max(4,Math.ceil(d.max/4)*4)};},[displayed,unit]);
 const left=45,right=chartWidth-22,top=26,bottom=238,width=right-left;
 const x=(i:number)=>visibleCategories.length===1?(left+right)/2:left+i/Math.max(1,visibleCategories.length-1)*width;
 const y=(n:number)=>bottom-(n-domain.min)/(domain.max-domain.min)*(bottom-top),zero=y(0);
 const pointKey=(i:number)=>visibleCategories[Math.max(0,Math.min(visibleCategories.length-1,i))]?.key;
 const handlePointer=(event:PointerEvent<SVGSVGElement>)=>{
  if(circular||!visibleCategories.length)return;const rect=event.currentTarget.getBoundingClientRect(),position=(event.clientX-rect.left)/rect.width*chartWidth;
  if(position<left||position>right){setHover(null);return;}
  const index=Math.round((position-left)/width*Math.max(0,visibleCategories.length-1));setHover(pointKey(index)??null);
 };
 const keyNavigation=(event:KeyboardEvent<SVGSVGElement>)=>{
  if(circular)return;let index=Math.max(0,visibleCategories.findIndex(c=>c.key===activeKey));
  if(event.key==='ArrowRight'||event.key==='ArrowLeft'){event.preventDefault();index=Math.max(0,Math.min(visibleCategories.length-1,index+(event.key==='ArrowRight'?1:-1)));setHover(pointKey(index)??null);}
  if(event.key==='Enter'||event.key===' '){event.preventDefault();if(pointKey(index))pin(pointKey(index)!);}
  if(event.key==='Escape'){setHover(null);setPinned(null);}
 };
 const seriesValue=(s:ChartSeries,index:number)=>s.values[index];
 const inspectorIndex=circular&&pieBy==='series'?-1:activeIndex;
 const primarySeries=series.filter(s=>!s.reference),referenceSeries=series.filter(s=>s.reference);
 const composition=(reference:boolean)=>pieBy==='series'?source.filter(s=>Boolean(s.reference)===reference&&!hidden.includes(s.id.replace(/:reference$/,''))).map(s=>({key:s.id.replace(/:reference$/,''),label:s.label,color:s.color,value:chartSummary(s)??0})):visibleCategories.filter(c=>!hidden.includes(c.key)).map(c=>{const i=visibleCategories.indexOf(c);return {key:c.key,label:c.label,color:chartColor(categories.indexOf(c)),value:source.filter(s=>Boolean(s.reference)===reference).reduce((n,s)=>n+(s.values[i]??0),0)};});
 const drawPie=(reference:boolean)=>{
  const items=composition(reference),positive=items.filter(i=>i.value>0),sum=positive.reduce((n,i)=>n+i.value,0);let angle=-Math.PI/2;
  return <div className={reference?'ic-pie ic-pie-reference':'ic-pie'}><svg viewBox="0 0 200 200" role="group" aria-label={`${title} · ${reference?'Référence':'Période'}`} onPointerLeave={()=>setHover(null)}><title>{`${title} · ${reference?'Référence':'Période'}`}</title>{sum?positive.map(item=>{const begin=angle;angle+=item.value/sum*Math.PI*2;const p=(a:number)=>[100+82*Math.cos(a),100+82*Math.sin(a)],a=p(begin),b=p(angle),selected=(activeKey??highlight)===item.key;return <g key={item.key} role="button" tabIndex={0} aria-label={`${item.label} : ${chartNumber(item.value,unit)} · ${chartNumber(item.value/sum*100,'%')}`} className={selected?'ic-slice active':'ic-slice'} style={{opacity:(activeKey??highlight)&&!selected?0.35:1}} onPointerEnter={()=>focusKey(item.key)} onFocus={()=>focusKey(item.key)} onClick={()=>pin(item.key)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();pin(item.key);}if(e.key==='Escape'){setPinned(null);setHover(null);}}}>{item.value===sum?<circle cx="100" cy="100" r="82" fill={item.color}/>:<path d={`M100 100 L${a.join(' ')} A82 82 0 ${item.value/sum>.5?1:0} 1 ${b.join(' ')} Z`} fill={item.color}/>}<title>{`${item.label} : ${chartNumber(item.value,unit)}`}</title></g>;}):<circle cx="100" cy="100" r="82" fill="var(--line)"/>}{format==='donut'&&<><circle cx="100" cy="100" r="52" fill="var(--surface)" pointerEvents="none"/><text x="100" y="106" textAnchor="middle" className="ic-donut-total" pointerEvents="none">{chartNumber(sum)}</text></>}</svg><small>{reference?'Référence':'Période sélectionnée'}</small></div>;
 };
 return <section className="interactive-chart" aria-label={title}>
 <header className="ic-header"><h3>{title}</h3><div className="ic-formats" role="group" aria-label={`Format · ${title}`}>{formats.map(f=><button type="button" key={f} aria-pressed={format===f} title={formatNames[f]} onClick={()=>{setFormat(f);if(f==='pie'||f==='donut')setWindow(0);setHover(null);setPinned(null);}}>{formatNames[f]}</button>)}</div></header>
 {!categories.length?<p className="ic-empty">Aucune donnée disponible.</p>:<>
 {!circular&&categories.length>12&&<div className="ic-window" role="group" aria-label={`Zoom · ${title}`}><span>Afficher</span>{[12,26,0].map(n=><button key={n} type="button" aria-pressed={windowSize===n} onClick={()=>{setWindow(n);setHover(null);setPinned(null);}}>{n?`${n} dernières périodes`:'Tout'}</button>)}</div>}
 <div ref={plotRef} className="ic-plot" onPointerLeave={()=>setHover(null)}>
 {circular?<div className="ic-pie-pair">{drawPie(false)}{referenceSeries.length>0&&drawPie(true)}</div>:<svg className="ic-cartesian" viewBox={`0 0 ${chartWidth} 280`} role="group" tabIndex={0} aria-label={`${title} · graphique interactif. Flèches pour parcourir, Entrée pour épingler, Échap pour fermer.`} onPointerMove={handlePointer} onClick={()=>{if(hover)pin(hover);}} onKeyDown={keyNavigation} onFocus={()=>{if(!activeKey&&visibleCategories.length)setHover(visibleCategories.at(-1)!.key);}}>
 <defs>{displayed.map((s,i)=><linearGradient key={s.id} id={`${id}-fill-${i}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={s.color} stopOpacity=".28"/><stop offset="100%" stopColor={s.color} stopOpacity=".02"/></linearGradient>)}</defs>
 {[0,1,2,3,4].map(i=>{const n=domain.min+(domain.max-domain.min)*i/4;return <g key={i}><line x1={left} x2={right} y1={y(n)} y2={y(n)} className="ic-grid"/><text x={left-10} y={y(n)+4} textAnchor="end">{chartNumber(n)}</text></g>;})}
 {displayed.map((s,si)=>{const dimmed=pieBy==='series'&&highlight&&highlight!==s.id.replace(/:reference$/,''),opacity=dimmed ? .2 : s.reference ? .48 : 1,segments=chartSegments(s.values,x,y),step=width/Math.max(1,visibleCategories.length),barWidth=Math.min(32,step*.74/Math.max(1,displayed.length));return <g key={s.id} style={{opacity}} className="ic-series">
 {format==='bar'?s.values.map((v,i)=>v===null?null:<rect key={i} x={x(i)+(si-(displayed.length-1)/2)*barWidth-barWidth*.45} y={Math.min(y(v),zero)} width={barWidth*.9} height={Math.max(1,Math.abs(y(v)-zero))} rx="3" fill={pieBy==='category'?chartColor(i+start):s.color} stroke={s.reference?s.color:undefined} strokeDasharray={s.reference?'3 3':undefined} opacity={pieBy==='category'&&highlight&&visibleCategories[i]?.key!==highlight?.25:1}/>):segments.map((segment,i)=><g key={i}>{format==='area'&&<path d={`M${segment[0].split(',')[0]},${zero} L${segment.join(' L')} L${segment.at(-1)!.split(',')[0]},${zero} Z`} fill={`url(#${id}-fill-${si})`}/>}<polyline points={segment.join(' ')} fill="none" stroke={s.color} strokeWidth={s.reference?1.8:3} strokeDasharray={s.reference?'6 5':undefined} strokeLinejoin="round" strokeLinecap="round"/></g>)}
 {format!=='bar'&&s.values.map((v,i)=>v===null?null:<circle key={i} cx={x(i)} cy={y(v)} r={visibleCategories[i]?.key===activeKey?5:visibleCategories.length<40?2.5:0} fill={s.color} stroke="var(--surface)" strokeWidth="2"/>)}
 </g>;})}
 {activeIndex>=start&&activeKey&&<line x1={x(activeIndex-start)} x2={x(activeIndex-start)} y1={top} y2={bottom} className="ic-crosshair"/>}
 {visibleCategories.map((c,i)=>i%Math.max(1,Math.ceil(visibleCategories.length/Math.max(2,Math.floor(width/110))))===0||i===visibleCategories.length-1?<text key={c.key} x={x(i)} y="262" textAnchor="middle">{c.label.length>15?c.label.slice(0,13)+'…':c.label}</text>:null)}
 <rect x={left} y={top} width={width} height={bottom-top} fill="transparent"/>
 </svg>}
 {activeKey&&(activeLegend||selected)&&<div className="ic-tooltip" role="status"><strong>{activeLegend?.label??selected?.label}</strong>{selected?.detail&&<small>{selected.detail}</small>}{(circular&&pieBy==='series'?series.filter(s=>s.id.replace(/:reference$/,'')===activeKey):series).filter(s=>!hidden.includes(s.id.replace(/:reference$/,''))).map(s=><div key={s.id} className={s.reference?'ic-reference-value':''}><i style={{background:s.color}}/><span>{s.reference?'Réf. · ':''}{s.label}</span><b>{chartNumber(circular&&pieBy==='series'?chartSummary(s):seriesValue(s,inspectorIndex),unit)}</b></div>)}<small>{pinned===activeKey?'Valeur épinglée · Échap pour fermer':'Clique pour épingler la valeur'}</small></div>}
 </div>
 {circular&&compositionNote&&<p className="ic-note">{compositionNote}</p>}
 <div className="ic-legend" aria-label={`Séries · ${title}`}>{legend.map(l=><button key={l.id} type="button" aria-pressed={!hidden.includes(l.id)} onPointerEnter={()=>setHighlight(l.id)} onPointerLeave={()=>setHighlight(null)} onFocus={()=>setHighlight(l.id)} onBlur={()=>setHighlight(null)} onClick={()=>toggle(l.id)}><i style={{background:l.color}}/>{l.label}{pieBy==='series'&&<strong>{chartNumber(chartSummary(series.find(s=>s.id===l.id)!),unit)}</strong>}</button>)}{hidden.length>0&&<button type="button" onClick={()=>setHidden([])}>Tout réafficher</button>}</div>
 {pinned&&(activeLegend||selected)&&<div className="ic-inspector" aria-label={`Détail épinglé · ${title}`}><div><strong>{activeLegend?.label??selected?.label}</strong><small>{selected?.detail}</small></div><div className="ic-inspector-values">{(circular&&pieBy==='series'?series.filter(s=>s.id.replace(/:reference$/,'')===pinned):series).map(s=><span key={s.id} className={s.reference?'ic-reference-value':''}>{s.reference?'Réf. · ':''}{s.label}<b>{chartNumber(circular&&pieBy==='series'?chartSummary(s):s.values[activeIndex],unit)}</b></span>)}</div><div className="ic-inspector-actions">{onApply&&!circular&&activeIndex>=0&&<><button type="button" className="primary-button" disabled={!primarySeries.some(s=>s.values[activeIndex]!=null)} onClick={()=>onApply(activeIndex,false)}>{applyLabel}</button>{referenceSeries.length>0&&<button type="button" className="secondary-button" disabled={!referenceSeries.some(s=>s.values[activeIndex]!=null)} onClick={()=>onApply(activeIndex,true)}>Utiliser la semaine de référence</button>}</>}{onFilter&&activeIndex>=0&&<button type="button" className="primary-button" onClick={()=>onFilter(activeIndex)}>{filterLabel}</button>}<button type="button" className="secondary-button" onClick={()=>{setPinned(null);setHover(null);}}>Fermer le détail</button></div></div>}
 <p className="ic-note">Survole pour lire les valeurs, clique pour les épingler. Les légendes affichent ou masquent les séries.{referenceSeries.length>0?(circular?' Référence en petit.':' Référence en petit et en pointillés.'):''}</p>
 </>}
 </section>;
}
