import test from 'node:test';import assert from 'node:assert/strict';import {moduleUrl} from './helpers/module-url.mjs';
const {jiraStockState}=await import(moduleUrl('../../lib/jira-historical-stock.ts'));
const ticket={status:'Terminé',createdAt:'2026-10-01T09:00:00',resolutionAt:'2026-11-01T09:00:00'};
test('end-of-day stock includes creation day and excludes resolution day, independent of current closed status',()=>{
 for(const [date,state] of [['2026-09-30','not-created'],['2026-10-01','open'],['2026-10-31','open'],['2026-11-01','closed']])assert.equal(jiraStockState(ticket,date).state,state);
 assert.equal(jiraStockState({...ticket,status:'En cours',resolutionAt:''},'2026-10-31').state,'open');
});
test('missing or incoherent dates and known reopens are indeterminate; modification never replaces resolution',()=>{
 for(const patch of [{createdAt:''},{createdAt:'2026-02-30'},{resolutionAt:''},{resolutionAt:'invalid'},{resolutionAt:'2026-09-01'},{status:'Réouvert',resolutionAt:'2026-10-10'}])assert.equal(jiraStockState({...ticket,...patch},'2026-10-31').state,'unknown');
 assert.equal(jiraStockState({...ticket,status:'Abandonné'},'2026-10-31').state,'excluded');assert.equal(jiraStockState(ticket,'invalid').state,'unknown');
});
