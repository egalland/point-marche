import assert from 'node:assert/strict';
import test from 'node:test';
import { build } from 'esbuild';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const bundle = await build({entryPoints:['lib/point-grid.ts'],bundle:true,platform:'node',format:'cjs',write:false});
const holder={exports:{}};new Function('require','module','exports',bundle.outputFiles[0].text)(require,holder,holder.exports);
const {gridRows,resizeMovesOtherBlocks,normalizeModuleWidth}=holder.exports;
test('four-column packing keeps empty space and ordered rows without backfilling',()=>{
 assert.deepEqual(gridRows(['a','b','c','d'],{a:'three-quarters',b:'half',c:'quarter',d:'full'}),[['a'],['b','c'],['d']]);
});
test('resizing blocks defaults to preserving sibling positions',()=>{
 const widths={a:'half',b:'half',c:'full'};
 assert.equal(resizeMovesOtherBlocks(['a','b','c'],widths,'a','three-quarters'),true);
 assert.equal(resizeMovesOtherBlocks(['a','b','c'],widths,'c','half'),false);
 assert.equal(resizeMovesOtherBlocks(['a','b','c'],widths,'a','half'),false);
});
test('legacy thirds migrate to three columns and invalid values keep their fallback',()=>{
 assert.equal(normalizeModuleWidth('two-thirds'),'three-quarters');
 assert.equal(normalizeModuleWidth('broken','half'),'half');
 assert.equal(normalizeModuleWidth('quarter'),'quarter');
});
