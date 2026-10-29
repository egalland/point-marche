import test from 'node:test';import assert from 'node:assert/strict';import {build} from 'esbuild';import {createRequire} from 'node:module';import {Script} from 'node:vm';
const require=createRequire(import.meta.url);
const b=await build({stdin:{contents:`export * from './features/market-pulse/point-model';export * from './features/market-pulse/point-exports';`,resolveDir:process.cwd()},bundle:true,platform:'node',format:'cjs',packages:'external',write:false});const m={exports:{}};new Function('require','module','exports',b.outputFiles[0].text)(require,m,m.exports);
test('HTML has full details enhanced by native modals; mail stays flat and complete',()=>{
 const {initialData,defaultMarkets,buildMailHtml,buildInteractiveHtml}=m.exports,d=initialData();d.meetingDate='2026-10-28';d.dossiers=[{id:'1',title:'Exemple',status:'En cours',richHtml:'<p>INFORMATION_FINALE</p>'}];
 const html=buildInteractiveHtml(d,defaultMarkets[0],[]),mail=buildMailHtml(d,defaultMarkets[0],[]);
 assert.match(html,/INFORMATION_FINALE/);assert.match(html,/showModal/);assert.match(html,/marker.replaceWith\(content/);assert.match(html,/export-body/);
 for(const script of html.matchAll(/<script>([\s\S]*?)<\/script>/g))new Script(script[1]);
 assert.match(mail,/INFORMATION_FINALE/);assert.doesNotMatch(mail,/<dialog|<script|<details|export-detail-open/);
});
