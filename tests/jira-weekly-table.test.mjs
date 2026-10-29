import test from 'node:test';
import assert from 'node:assert/strict';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {moduleUrl} from './helpers/module-url.mjs';
const {JiraWeeklyTimeline}=await import(moduleUrl('../../features/market-pulse/jira-weekly-timeline.tsx',{'react/jsx-runtime':import.meta.resolve('react/jsx-runtime')}));
const week=(from,to,values)=>({from,to,label:from==='2026-10-19'?'S43 · 2026':'S44 · 2026',total:values.reduce((a,b)=>a+b,0),markets:values.map((value,i)=>({id:String(i),label:['Bois','Panneaux','Menuiserie','Revêtements'][i],value}))});
const timeline={a:[week('2026-10-19','2026-10-25',[0,2,3,4]),week('2026-10-26','2026-10-29',[1,2,3,4])],b:[week('2026-10-05','2026-10-11',[2,1,3,1])]};
const html=(comparisonEnabled)=>renderToStaticMarkup(createElement(JiraWeeklyTimeline,{timeline,comparisonEnabled,stock:false,byMarket:true,onByMarketChange:()=>{}}));
test('market table groups four market columns per week, including zero counts, without bar charts',()=>{
 const s=html(false);assert.equal((s.match(/colSpan="4"/g)||[]).length,2);assert.equal((s.match(/scope="col">Menuiserie/g)||[]).length,2);assert.match(s,/19\/10\/2026 → 25\/10\/2026/);assert.match(s,/>0<\/button>/);assert.doesNotMatch(s,/jira-timeline-track/);assert.doesNotMatch(s,/Réf\./);assert.doesNotMatch(s,/05\/10\/2026/);
});
test('reference and delta rows retain exact dates and distinguish missing weeks from zeros',()=>{
 const s=html(true);assert.match(s,/05\/10\/2026 → 11\/10\/2026/);assert.match(s,/<th scope="row">Référence<\/th>/);assert.match(s,/<th scope="row">Écart<\/th>/);assert.match(s,/<strong>-2<\/strong>/);assert.match(s,/<strong>\+1<\/strong>/);assert.match(s,/<strong>0<\/strong>/);assert.equal((s.match(/<td>—<\/td>/g)||[]).length,8);
});
