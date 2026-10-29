import test from 'node:test';import assert from 'node:assert/strict';import {createElement} from 'react';import {renderToStaticMarkup} from 'react-dom/server';import {moduleUrl} from './helpers/module-url.mjs';
const {JiraWeeklyTimeline}=await import(moduleUrl('../../features/market-pulse/jira-weekly-timeline.tsx',{'react/jsx-runtime':import.meta.resolve('react/jsx-runtime')}));
const week=(from,to,values)=>({from,to,label:'S44 · 2026',total:values.reduce((a,b)=>a+b,0),markets:values.map((value,i)=>({id:String(i),label:['Bois','Panneaux','Menuiserie','Revêtements'][i],value}))});
const timeline={a:[week('2026-10-19','2026-10-25',[0,2,3,4]),week('2026-10-26','2026-10-29',[1,2,3,4])],b:[week('2026-10-05','2026-10-11',[2,1,3,1])]};
const html=(comparisonEnabled,stock=false)=>renderToStaticMarkup(createElement(JiraWeeklyTimeline,{timeline,comparisonEnabled,stock,byMarket:true,onByMarketChange:()=>{}}));
test('markets have distinct colored curves and primary values, with numeric detail collapsed',()=>{
 const s=html(false);assert.equal((s.match(/<polyline /g)||[]).length,4);const strokes=[...s.matchAll(/<polyline[^>]+stroke="([^"]+)"/g)].map(m=>m[1]);assert.equal(new Set(strokes).size,4);assert.match(s,/<details><summary>Voir les valeurs et les dates/);assert.doesNotMatch(s,/<details open/);assert.match(s,/19\/10\/2026 → 25\/10\/2026/);assert.match(s,/0 tickets/);assert.doesNotMatch(s,/stroke-dasharray/);
});
test('reference curves are dashed with exact independent dates and absent weeks stay absent',()=>{
 const s=html(true);assert.equal((s.match(/<polyline /g)||[]).length,8);assert.equal((s.match(/stroke-dasharray="6 5"/g)||[]).length,4);assert.match(s,/05\/10\/2026 → 11\/10\/2026/);assert.match(s,/Réf\. —/);assert.match(s,/référence.*pointillés/i);assert.match(html(true,true),/Les valeurs de stock ne se cumulent pas/);
});
