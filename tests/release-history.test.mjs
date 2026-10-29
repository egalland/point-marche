import test from 'node:test';
import assert from 'node:assert/strict';
import {moduleUrl} from './helpers/module-url.mjs';
const {releaseHistory,findReleases}=await import(moduleUrl('../../lib/release-history.ts'));
const {APP_VERSION}=await import(moduleUrl('../../lib/app-version.ts'));
test('release history includes every saved version exactly once, newest first',()=>{
 const current=Number(APP_VERSION.slice(1));assert.equal(releaseHistory.length,current);
 assert.deepEqual(releaseHistory.map(v=>v.version),Array.from({length:current},(_,i)=>current-i));
 for(const entry of releaseHistory){assert.match(entry.date,/^\d{4}-\d{2}-\d{2}$/);assert.ok(entry.title&&entry.changes.length);}
});
test('release search finds exact old versions and ignores accents in features',()=>{
 assert.deepEqual(findReleases('V1').map(v=>v.version),[1]);assert.deepEqual(findReleases(' 121 ').map(v=>v.version),[121]);assert.equal(findReleases('').length,releaseHistory.length);assert.ok(findReleases('edition').some(v=>v.version===40));assert.ok(findReleases('mobile').some(v=>v.version===121));assert.deepEqual(findReleases('V9999'),[]);
});
