import test from 'node:test';import assert from 'node:assert/strict';import {moduleUrl} from './helpers/module-url.mjs';
const {workspaceViewFromUrl,workspaceViewUrl}=await import(moduleUrl('../../lib/workspace-route.ts'));
test('each tab is restored from its direct URL, including mail and supplier legacy links',()=>{
 for(const view of ['read','analyst','stats','suppliers','imports','mail','settings'])assert.equal(workspaceViewFromUrl(`https://site.test/?mode=${view}`),view);
 assert.equal(workspaceViewFromUrl('https://site.test/?mode=edit'),'read');assert.equal(workspaceViewFromUrl('https://site.test/?mode=unknown'),'read');assert.equal(workspaceViewFromUrl('https://site.test/'),'read');
});
test('tab changes keep unrelated parameters but remove a supplier selection and anchors from the previous tab',()=>{
 const href=workspaceViewUrl('https://site.test/?mode=suppliers&supplier=code%3AA0001&market=REV#supplier','stats'),url=new URL(href);
 assert.equal(url.searchParams.get('mode'),'stats');assert.equal(url.searchParams.get('supplier'),null);assert.equal(url.searchParams.get('market'),'REV');assert.equal(url.hash,'');
 assert.equal(new URL(workspaceViewUrl(href,'read')).searchParams.get('mode'),null);
 const supplier='https://site.test/?mode=suppliers&supplier=code%3AA0001';assert.equal(workspaceViewUrl(supplier,'suppliers'),supplier);
});
test('local standalone HTML keeps its filename and can restore any tab without server routes',()=>{
 const url=workspaceViewUrl('file:///network/Point_Marche.html','imports');assert.equal(url,'file:///network/Point_Marche.html?mode=imports');assert.equal(workspaceViewFromUrl(url),'imports');
});
