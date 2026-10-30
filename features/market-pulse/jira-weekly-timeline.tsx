"use client";
import {InteractiveChart} from '../../components/interactive-chart';
import {chartColor} from '../../lib/interactive-chart';
import type {AnalystJiraStats} from '../../lib/analyst-jira-stats';
type Range={from:string;to:string};
const date=(value:string)=>value.split('-').reverse().join('/');
export function JiraWeeklyTimeline({timeline,comparisonEnabled,stock,onSelectRange,byMarket,onByMarketChange}:{timeline:AnalystJiraStats['timeline'];comparisonEnabled:boolean;stock:boolean;byMarket:boolean;onByMarketChange:(value:boolean)=>void;onSelectRange?:(range:Range,reference:boolean)=>void}){
 const periods=comparisonEnabled?['a','b'] as const:['a'] as const;
 const markets=[...new Map(periods.flatMap(p=>timeline[p].flatMap(w=>w.markets.map(m=>[m.id,m] as const)))).values()].sort((a,b)=>a.id.localeCompare(b.id));
 const groups=byMarket?markets.map((m,i)=>({...m,color:chartColor(i)})):[{id:'all',label:'Tous les tickets',color:chartColor(0)}];
 const value=(w:typeof timeline.a[number],id:string)=>id==='all'?w.total:w.markets.find(m=>m.id===id)?.value??0;
 const dates=(w:typeof timeline.a[number])=>`${date(w.from)} → ${date(w.to)}`;
 const count=Math.max(timeline.a.length,comparisonEnabled?timeline.b.length:0);
 const categories=Array.from({length:count},(_,i)=>({key:timeline.a[i]?.from??`reference:${timeline.b[i]?.from}`,label:timeline.a[i]?.label??`Réf. ${timeline.b[i]?.label??''}`,detail:[timeline.a[i]?`Période : ${dates(timeline.a[i])}`:'Période absente',comparisonEnabled?(timeline.b[i]?`Référence : ${dates(timeline.b[i])}`:'Référence absente'):''].filter(Boolean).join(' · ')}));
 const series=groups.flatMap(m=>periods.map(p=>{const values=Array.from({length:count},(_,i)=>timeline[p][i]?value(timeline[p][i],m.id):null);return {id:m.id+(p==='b'?':reference':''),label:m.label,color:m.color,reference:p==='b',values,summary:stock?(timeline[p].length?value(timeline[p].at(-1)!,m.id):null):values.reduce<number>((n,v)=>n+(v??0),0)};}));
 const apply=(index:number,reference:boolean)=>{const week=timeline[reference?'b':'a'][index];if(week)onSelectRange?.({from:week.from,to:week.to},reference);};
 return <section className="jira-weekly-timeline surface" aria-label="Évolution hebdomadaire Jira"><header><div><p>{stock?'Stock ouvert en fin de semaine':'Tickets distincts par semaine'} · dates limitées aux périodes choisies.</p></div><label>Périmètre<select value={byMarket?'market':'week'} onChange={e=>onByMarketChange(e.target.value==='market')}><option value="market">Par marché</option><option value="week">Global</option></select></label></header>
 <InteractiveChart title={byMarket?'Évolution des marchés':'Évolution globale'} categories={categories} series={series} pieBy="series" onApply={onSelectRange?apply:undefined} compositionNote={stock?'Répartition du stock de la dernière semaine de chaque période, sans cumul des semaines.':'Répartition du volume sur la période affichée. Un ticket partagé peut figurer dans plusieurs marchés.'}/>
 <p className="ic-note">Les semaines sont alignées par rang ; leurs dates exactes apparaissent au survol. Épingler une valeur ne change pas les filtres. Le bouton « Utiliser cette semaine » applique le filtre.</p>
 <details><summary>Voir les valeurs et les dates</summary><div className="data-table-wrap"><table><thead><tr><th>Période</th><th>Semaine</th><th>Dates</th>{groups.map(m=><th key={m.id}>{m.label}</th>)}</tr></thead><tbody>{periods.flatMap(p=>timeline[p].map(w=><tr key={p+w.from} className={p==='b'?'jira-reference-row':''}><th>{p==='a'?'Période sélectionnée':'Référence'}</th><td>{w.label}</td><td>{dates(w)}</td>{groups.map(m=><td key={m.id}>{value(w,m.id)}</td>)}</tr>))}</tbody></table></div></details>
 </section>;
}
