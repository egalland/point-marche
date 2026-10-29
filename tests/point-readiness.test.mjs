import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
async function load(file) { const b=await build({entryPoints:[file],bundle:true,platform:'node',packages:'external',format:'cjs',write:false});const m={exports:{}};new Function('require','module','exports',b.outputFiles[0].text)(require,m,m.exports);return m.exports; }
const {pointReadiness,sourceReadiness}=await load('lib/point-readiness.ts');
const {initialData,defaultMarkets}=await load('features/market-pulse/point-model.ts');
const {inspectMailRecipients}=await load('lib/mail-recipients.ts');
const {buildMailDraft}=await load('lib/mail-draft.ts');
const {chartExcelTemplate}=await load('lib/chart-excel-template.ts');
const {readBoundedXlsxBytes}=await load('lib/purchaseData-xlsx.ts');

test('source checks use the selected ISO week, including year boundaries and historical/future imports',()=>{
 assert.equal(sourceReadiness('2026-12-28T11:00:00Z','automatic','2027-01-01').state,'ok');
 assert.equal(sourceReadiness('2026-12-27','automatic','2027-01-01').state,'review');
 assert.equal(sourceReadiness('2027-01-04','automatic','2027-01-01').state,'review');
 assert.equal(sourceReadiness('invalid','automatic','2027-01-01').state,'review');
 assert.equal(sourceReadiness(undefined,'manual','2027-01-01').state,'ok');
});
test('new point distinguishes missing sources from actual zero and flags unsaved edits and defaults',()=>{
 const data=initialData();data.meetingDate='2026-10-28';
 let r=pointReadiness(data,defaultMarkets[0],'pending');
 assert.equal(r.metrics.find(x=>x.label==='Tickets ouverts').value,null);
 assert.equal(r.metrics.find(x=>x.label==='Simulations à suivre').value,null);
 assert.equal(r.checks.some(x=>x.id==='priority'),false);
 data.jiraMode='manual';data.plannerMode='manual';data.priority='Confirmer la décision';data.mail.to='reader@example.test';
 r=pointReadiness(data,defaultMarkets[0],'saved');
 assert.equal(r.metrics.find(x=>x.label==='Tickets ouverts').value,0);assert.equal(r.review,0);
 data.preferences.readModules.jira=false;
 assert.equal(pointReadiness(data,defaultMarkets[0]).checks.some(x=>x.id==='jira'),false);
 assert.equal(pointReadiness(data,defaultMarkets[0],'error').blocked,true);
});
test('active dossiers need a title and content, completed dossiers do not; attachments require review',()=>{
 const data=initialData();data.dossiers=[{id:'1',title:'Décision',owner:'',action:'',status:'En cours',attachments:[]}];
 let r=pointReadiness(data,defaultMarkets[0]);assert.equal(r.checks.find(x=>x.id==='dossiers').state,'review');
 data.dossiers[0].status='Terminé';data.dossiers[0].attachments=[{id:'file'}];
 r=pointReadiness(data,defaultMarkets[0]);assert.equal(r.checks.find(x=>x.id==='dossiers').state,'ok');assert.equal(r.checks.find(x=>x.id==='assets').state,'review');
});
test('mail typos and header injection are reported instead of silently dropping recipients',()=>{
 assert.deepEqual(inspectMailRecipients('a@example.test; A@example.test, bad-address\nb@example.test'),{valid:['a@example.test','b@example.test'],invalid:['bad-address']});
 assert.throws(()=>buildMailDraft({to:'correct@example.test;incorrect',cc:'',subject:'Test',html:'test',attachment:{name:'point.html',html:'test'}}),/adresses/);
 assert.throws(()=>buildMailDraft({to:'a@example.test\r\nBcc:other@example.test',cc:'',subject:'Test',html:'test',attachment:{name:'point.html',html:'test'}}),/adresses/);
});
test('Excel template contains layout only, without cells, cached observations or hidden data connections',()=>{
 for(const [path,xml] of Object.entries(chartExcelTemplate)) {
  if(/worksheets\/sheet/.test(path)) assert.match(xml,/<x:sheetData><\/x:sheetData>/);
  assert.doesNotMatch(xml,/<c:(?:numCache|strCache)>|TargetMode="External"/);
  assert.doesNotMatch(path,/externalLink|pivotCache|connection|customXml|docProps/);
 }
});
test('XLSX limit is measured during decompression and cancels a stream beyond the limit',async()=>{
 let cancelled=false;
 const stream=new ReadableStream({pull(c){c.enqueue(new Uint8Array(4));},cancel(){cancelled=true;}});
 await assert.rejects(readBoundedXlsxBytes(stream,8),/volumineux/);assert.equal(cancelled,true);
 const small=new ReadableStream({start(c){c.enqueue(new Uint8Array([1,2]));c.enqueue(new Uint8Array([3]));c.close();}});
 assert.deepEqual(await readBoundedXlsxBytes(small,3),new Uint8Array([1,2,3]));
});
