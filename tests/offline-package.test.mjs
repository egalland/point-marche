import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, mkdir, cp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { packageOffline } from '../scripts/package-offline.mjs';

test('copying a distribution over an installation preserves workbook and shared journal bytes', async t => {
  const root = await mkdtemp(join(tmpdir(), 'market-update-')); t.after(() => rm(root, {recursive:true,force:true}));
  const input=join(root,'new.html'), stage=join(root,'stage'), installation=join(root,'installed');
  const html="<!doctype html><meta content=\"connect-src 'none'\"><div>New application</div>";
  await writeFile(input,html); await mkdir(installation); await mkdir(join(installation,'data'));
  await mkdir(join(installation,'donnees')); await mkdir(join(installation,'sauvegardes'));
  const protectedFiles={'donnees/Mon-classeur.marketpulse.json':'class file', 'sauvegardes/backup.json':'backup bytes', 'My.marketpulse.json':'{"points":["existing"]}','data/point-sync-one.json':'{"journal":"existing"}','point-sync-two.json':'{"concurrent":"existing"}'};
  for(const [name,content] of Object.entries(protectedFiles)) await writeFile(join(installation,name),content);
  await mkdir(join(installation,'application'));
  await writeFile(join(installation,'application/Point_Marche.html'),'Old application');
  const names=await packageOffline(input,stage);
  assert.ok(names.every(name => name.startsWith('application/')));
  assert.equal(names.length,5);
  await cp(stage,installation,{recursive:true,force:true});
  assert.equal(await readFile(join(installation,'application/Point_Marche.html'),'utf8'),html);
  for(const [name,content] of Object.entries(protectedFiles)) assert.equal(await readFile(join(installation,name),'utf8'),content);
  await assert.rejects(packageOffline(input,installation),/doit être vide/);
});

test('distribution refuses a workbook embedded in the HTML', async t => {
  const root=await mkdtemp(join(tmpdir(),'market-private-'));t.after(()=>rm(root,{recursive:true,force:true}));
  const input=join(root,'private.html');
  await writeFile(input,`<!doctype html><meta content="connect-src 'none'"><script type="application/json" id="market-pulse-workspace">{}</script>`);
  await assert.rejects(packageOffline(input,join(root,'output')),/classeur embarqué/);
});


test('installation and later updates use the same app path and never reset data or backups', async t => {
  const root = await mkdtemp(join(tmpdir(), 'market-layout-')); t.after(() => rm(root,{recursive:true,force:true}));
  const input=join(root,'app.html'), install=join(root,'installation'), update=join(root,'update');
  await writeFile(input,`<!doctype html><meta content="connect-src 'none'"><p>Version one</p>`);
  const initial=await packageOffline(input,install,'install');
  assert.ok(initial.includes('DEMARRER.html')); assert.ok(initial.includes('donnees/LIRE_MOI.txt'));
  await writeFile(join(install,'donnees','work.marketpulse.json'),'my data');
  await writeFile(join(install,'sauvegardes','saved.marketpulse.json'),'my backup');
  await writeFile(input,`<!doctype html><meta content="connect-src 'none'"><p>Version two</p>`);
  const names=await packageOffline(input,update);
  assert.ok(names.every(name=>name.startsWith('application/')));
  await cp(update,install,{recursive:true,force:true});
  assert.match(await readFile(join(install,'application/Point_Marche.html'),'utf8'),/Version two/);
  assert.equal(await readFile(join(install,'donnees/work.marketpulse.json'),'utf8'),'my data');
  assert.equal(await readFile(join(install,'sauvegardes/saved.marketpulse.json'),'utf8'),'my backup');
  assert.match(await readFile(join(install,'DEMARRER.html'),'utf8'),/application\/Point_Marche.html/);
});
