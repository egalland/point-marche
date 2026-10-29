import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
const script=resolve('scripts/check-public-source.mjs');
test('publication guard rejects data files and private markers, including untracked files', t=>{
 const root=mkdtempSync(join(tmpdir(),'public-check-'));t.after(()=>rmSync(root,{recursive:true,force:true}));
 const cwd=join(root,'repo');mkdirSync(cwd);spawnSync('git',['init',cwd]);
 const terms=join(root,'private.txt');writeFileSync(terms,'CONFIDENTIAL_TEST_MARKER');
 const check=()=>spawnSync(process.execPath,[script],{cwd,encoding:'utf8',env:{...process.env,PUBLIC_SOURCE_TERMS_FILE:terms}});
 mkdirSync(join(cwd,'tests'));writeFileSync(join(cwd,'tests/example.mjs'),'const id="A1234567";');assert.equal(check().status,0);
 writeFileSync(join(cwd,'import.csv'),'synthetic content');assert.equal(check().status,1);rmSync(join(cwd,'import.csv'));
 writeFileSync(join(cwd,'README.md'),'CONFIDENTIAL_TEST_MARKER');assert.equal(check().status,1);rmSync(join(cwd,'README.md'));
 writeFileSync(join(cwd,'tests/example.mjs'),'const id="Z'+'9843210";');assert.equal(check().status,1);
});
