import test from 'node:test';import assert from 'node:assert/strict';import {build} from 'esbuild';import {createRequire} from 'node:module';import {createElement} from 'react';import {renderToStaticMarkup} from 'react-dom/server';
const require=createRequire(import.meta.url);
async function load(file){const b=await build({entryPoints:[file],bundle:true,platform:'node',packages:'external',format:'cjs',write:false});const m={exports:{}};new Function('require','module','exports',b.outputFiles[0].text)(require,m,m.exports);return m.exports;}
const {PointBlockBody}=await load('features/market-pulse/point-block-body.tsx'),{JiraPointSummary}=await load('features/market-pulse/jira-point-summary.tsx'),model=await load('features/market-pulse/point-model.ts');
test('editing renders content in the block; details stay closed until explicitly requested',()=>{
 const html=renderToStaticMarkup(createElement(PointBlockBody,{title:'Dossier',editing:true},createElement('textarea',{defaultValue:'Saisie directe'})));
 assert.match(html,/Saisie directe/);assert.match(html,/<textarea/);assert.doesNotMatch(html,/aria-modal|point-block-dialog-heading/);
 const read=renderToStaticMarkup(createElement(PointBlockBody,{title:'Jira',editing:false,detailsLabel:'Détails des tickets',detailContent:createElement('p',null,'DÉTAIL_PERSONNE')},createElement('p',null,'SYNTHÈSE')));
 assert.match(read,/SYNTHÈSE/);assert.match(read,/Détails des tickets/);assert.doesNotMatch(read,/DÉTAIL_PERSONNE|aria-modal/);
});
test('Jira summary shows counts and delays without exposing the person list in the default block',()=>{
 const data=model.initialData();data.meetingDate='2026-10-28';data.jira=[{id:'test',key:'TEST-1',summary:'CONFIDENTIAL_DETAIL_FIXTURE',status:'En cours',assignee:'PERSON_FIXTURE',lastActivity:'2026-10-01',createdAt:'2026-09-01',link:'',comment:'',priority:''}];
 const html=renderToStaticMarkup(createElement(JiraPointSummary,{data,market:model.defaultMarkets[0],archive:[]}));
 assert.match(html,/Tickets ouverts/);assert.match(html,/Délai moyen/);assert.match(html,/Détails des tickets/);assert.doesNotMatch(html,/PERSON_FIXTURE|CONFIDENTIAL_DETAIL_FIXTURE/);
});
