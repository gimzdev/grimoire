#!/usr/bin/env node
// Checks Grimoire's QuestieDB data (scripts/data/lib/questiedb.mjs) against its sources:
//   1. QuestieDB's places are Forever's map percentages: ten Classic creatures that stand in one place in both sources sit
//      where VMaNGOS's world position, converted with Forever's map rectangle (QuestieDB's conversion.json), puts them.
//   2. data/ holds what QuestieDB holds: merging it again changes nothing.
// Needs GRIMOIRE_VMANGOS and GRIMOIRE_QUESTIEDB; without them it says what it skipped.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mergeQuestieDB, readQuestieDB, spawnList } from './lib/questiedb.mjs';

const vm = process.env.GRIMOIRE_VMANGOS;
const qd = process.env.GRIMOIRE_QUESTIEDB;
if (!vm || !qd) {
  console.log('skipped: needs GRIMOIRE_VMANGOS (VMaNGOS SQLite) and GRIMOIRE_QUESTIEDB (QuestieDB checkout)');
  process.exit(0);
}
const { openVmangos } = await import('./lib/world.mjs');
const here = path.dirname(fileURLToPath(import.meta.url));
const data = path.join(here, '..', '..', 'data');
const json = (f) => JSON.parse(readFileSync(path.join(data, f), 'utf8'));
const db = openVmangos(vm);
const qdb = readQuestieDB(qd);
let bad = 0;

/* 1. Ten creatures, one spawn each in both sources: a quest giver of each of ten zones, two of them in changed map frames. */
const TEN = [197, 823, 1646, 3079, 344, 2229, 7564, 8381, 11039, 3429];
for (const id of TEN) {
  const w = db.prepare('SELECT map, position_x x, position_y y FROM creature WHERE id = ?').all(id);
  const q = spawnList(qdb.npcs.get(id)?.get('spawns'));
  if (w.length !== 1 || q.length !== 1) {
    console.log(`creature ${id}: ${w.length} VMaNGOS spawns and ${q.length} QuestieDB spawns, not one each`);
    bad++;
    continue;
  }
  const b = qdb.bounds.get(q[0].area);
  if (!b || b.map !== w[0].map) {
    console.log(`creature ${id}: no Forever map rectangle for area ${q[0].area} on map ${w[0].map}`);
    bad++;
    continue;
  }
  const x = ((b.left - w[0].y) / (b.left - b.right)) * 100;
  const y = ((b.top - w[0].x) / (b.top - b.bottom)) * 100;
  const off = Math.hypot(x - q[0].x, y - q[0].y);
  const name = qdb.npcs.get(id).get('name');
  console.log(`${off <= 0.1 ? 'ok ' : 'BAD'} ${id} ${name}: VMaNGOS (${w[0].x.toFixed(1)}, ${w[0].y.toFixed(1)}) on map ${w[0].map} -> area ${q[0].area} ${x.toFixed(2)}, ${y.toFixed(2)}; QuestieDB ${q[0].x}, ${q[0].y}`);
  if (off > 0.1) bad++;
}

/* 2. Merging again changes nothing. */
const d = { quests: json('quests.json'), npcs: json('npcs.json'), objects: json('objects.json'), minor: json('minor-items.json'), zones: json('zones.json') };
const before = JSON.stringify(d);
const r = mergeQuestieDB(d, qdb);
if (JSON.stringify(d) !== before || r.added || r.npcsAdded || r.objectsAdded || r.itemsAdded || r.classicGained) {
  console.log(`data/ differs from QuestieDB ${qdb.version}: run node scripts/data/questiedb.mjs --questiedb <checkout>`);
  bad++;
} else console.log(`data/ holds QuestieDB ${qdb.version} (${qdb.commit.slice(0, 7)}): ${r.forever} of Forever's own quests`);
const meta = json('meta.json').sources?.questiedb;
if (!meta || meta.commit !== qdb.commit || meta.version !== qdb.version) {
  console.log('data/meta.json does not name this QuestieDB');
  bad++;
}
process.exit(bad ? 1 : 0);
