import test from 'node:test';import assert from 'node:assert/strict';import {build} from 'esbuild';import {createRequire} from 'node:module';import {createElement} from 'react';import {renderToStaticMarkup} from 'react-dom/server';
const require=createRequire(import.meta.url),bundle=await build({entryPoints:['features/market-pulse/jira-weekly-timeline.tsx'],bundle:true,platform:'node',packages:'external',format:'cjs',write:false}),m={exports:{}};new Function('require','module','exports',bundle.outputFiles[0].text)(require,m,m.exports);const {JiraWeeklyTimeline}=m.exports;
const week=(from,to,values)=>({from,to,label:'S44 · 2026',total:values.reduce((a,b)=>a+b,0),markets:values.map((value,i)=>({id:String(i),label:['Bois','Panneaux','Menuiserie','Revêtements'][i],value}))});
const timeline={a:[week('2026-10-19','2026-10-25',[0,2,3,4]),week('2026-10-26','2026-10-29',[1,2,3,4])],b:[week('2026-10-05','2026-10-11',[2,1,3,1])]};
const html=(comparisonEnabled,stock=false)=>renderToStaticMarkup(createElement(JiraWeeklyTimeline,{timeline,comparisonEnabled,stock,byMarket:true,onByMarketChange:()=>{},onSelectRange:()=>{}}));
test('interactive market chart has distinct colors, format choices and keeps numeric detail collapsed',()=>{
 const s=html(false),strokes=[...s.matchAll(/<polyline[^>]+stroke="([^"]+)"/g)].map(m=>m[1]);assert.equal(new Set(strokes).size,4);assert.match(s,/<details><summary>Voir les valeurs et les dates/);assert.doesNotMatch(s,/<details open/);assert.match(s,/19\/10\/2026 → 25\/10\/2026/);for(const label of ['Courbes','Aires','Bâtons','Anneau','Camembert'])assert.ok(s.includes(label));assert.match(s,/Épingler une valeur ne change pas les filtres/);
});
test('reference keeps true dates and missing weeks as gaps, with a separate week-filter action',()=>{
 const s=html(true);assert.equal((s.match(/stroke-dasharray="6 5"/g)||[]).length,4);assert.match(s,/05\/10\/2026 → 11\/10\/2026/);assert.match(s,/Utiliser cette semaine/);assert.doesNotMatch(s,/ic-inspector-actions/);assert.doesNotMatch(s,/NaN|Infinity/);
});

test('weekly headline is weighted by valid ticket samples and weekly market table exposes working days and exclusions',()=>{
 const cohort=(sample,days)=>({mean:sample?days/sample:null,median:null,sample,days,completed:sample,excluded:0});
 const augmented={a:timeline.a.map((w,i)=>({...w,resolution:cohort(i?3:1,i?30:0),markets:w.markets.map(m=>({...m,resolution:cohort(i?3:1,i?30:0)}))})),b:timeline.b.map(w=>({...w,resolution:cohort(0,0),markets:w.markets.map(m=>({...m,resolution:cohort(0,0)}))}))};
 const html=renderToStaticMarkup(createElement(JiraWeeklyTimeline,{timeline:augmented,comparisonEnabled:true,stock:false,byMarket:true,onByMarketChange:()=>{}}));
 assert.match(html,/7,5/);assert.match(html,/4 ticket\(s\) avec dates valides/);assert.match(html,/Délai moyen · j ouvrés/);assert.match(html,/Échantillon \/ exclus/);assert.match(html,/Mettre en avant un indicateur/);assert.match(html,/Délai moyen de résolution par marché/);
});
