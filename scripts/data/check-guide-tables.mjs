#!/usr/bin/env node
// Checks that the generated tables in content/guides are what their generators (scripts/guides/*.mjs) write today:
// each generator runs in memory against VMaNGOS and data/, and a guide whose file differs fails. Fix it by running
// the generator the failure names, not by editing the table. Every item, creature, quest and zone a table links to
// must be in data/, or the site would print "Item 1234" in its place.
//
//   GRIMOIRE_VMANGOS=mangos.sqlite node scripts/data/check-guide-tables.mjs
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '..', '..');
if (!process.env.GRIMOIRE_VMANGOS) {
  console.log('skipped: the VMaNGOS world database (set GRIMOIRE_VMANGOS to its SQLite file)');
  process.exit(0);
}
const { openVmangos } = await import('./lib/world.mjs');
const { fill, readData } = await import('../guides/lib.mjs');
const db = openVmangos(path.resolve(process.env.GRIMOIRE_VMANGOS));
const data = readData(path.join(root, 'data'));

const items = new Set(data('items.json').map((it) => it.i));
const quests = new Set(data('quests.json').map((q) => q.i));
const zones = new Set(data('zones.json').map((z) => z.id));
const known = { item: (id) => items.has(id) || id in data('minor-items.json'), npc: (id) => id in data('npcs.json'), quest: (id) => quests.has(id), world: (id) => zones.has(id) };

const dir = path.join(root, 'scripts', 'guides');
const bad = [];
let n = 0;
for (const f of readdirSync(dir).filter((x) => x.endsWith('.mjs') && x !== 'lib.mjs').sort()) {
  const gen = await import(pathToFileURL(path.join(dir, f)).href);
  const text = readFileSync(path.join(root, gen.guide), 'utf8');
  const blocks = gen.blocks({ db, data });
  n += Object.keys(blocks).length;
  for (const body of Object.values(blocks))
    for (const m of body.matchAll(/\[\[(item|npc|quest):(\d+)\]\]|\]\(\/(world)\/(\d+)\)/g)) {
      const [kind, id] = m[1] ? [m[1], Number(m[2])] : [m[3], Number(m[4])];
      if (!known[kind](id)) bad.push(`${gen.guide}: links ${kind} ${id}, which data/ does not have`);
    }
  if (fill(text, blocks) !== text) bad.push(`${gen.guide}: its tables differ from what scripts/guides/${f} writes; run node scripts/guides/${f} --vmangos <sqlite>`);
}
console.log(`guide tables: ${n} blocks checked`);
if (bad.length) {
  console.log(bad.join('\n'));
  process.exitCode = 1;
}
