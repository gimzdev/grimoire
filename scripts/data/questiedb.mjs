#!/usr/bin/env node
// Brings QuestieDB (GPLv3, https://github.com/Questie/QuestieDB) into a finished data/: Forever's own quests with their
// givers, takers, zones, experience and objectives, the givers and takers Forever added to Classic's quests, and the
// creatures, objects and items they name, and the new dungeons' quests (scripts/data/lib/questiedb.mjs says what is taken and
// how). It records the version, commit and date in data/meta.json and prints how complete QuestieDB is, zone by zone and for
// each of Forever's new dungeons. build.mjs does the same with --questiedb. Running it twice gives the same data.
//
//   node scripts/data/questiedb.mjs --questiedb path/to/QuestieDB [--data data] [--dry]
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { addDungeonQuests, asCoverage, mergeQuestieDB, questieMeta, readQuestieDB } from './lib/questiedb.mjs';
import { writeNewDungeons } from './lib/questiedb-dungeons.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const args = Object.fromEntries(
  process.argv
    .slice(2)
    .join(' ')
    .split(/\s*--/)
    .filter(Boolean)
    .map((a) => {
      const [k, ...v] = a.split(/\s+/);
      return [k, v.join(' ') || true];
    }),
);
if (!args.questiedb) throw new Error('Missing --questiedb <checkout>. See scripts/data/README.md.');
const data = path.resolve(args.data || path.join(here, '..', '..', 'data'));
const file = (f) => path.join(data, f);
const json = (f) => JSON.parse(readFileSync(file(f), 'utf8'));

const qdb = readQuestieDB(args.questiedb);
const d = { quests: json('quests.json'), npcs: json('npcs.json'), objects: json('objects.json'), minor: json('minor-items.json'), zones: json('zones.json') };
const report = mergeQuestieDB(d, qdb);
console.log(
  `QuestieDB ${qdb.version} (${qdb.commit.slice(0, 7)}, traces of ${qdb.date}): ${report.forever} of Forever's own quests (${report.added} new to Grimoire, ${report.updated} filled in), ${report.classicGained} Classic quests with a giver or taker only Forever has; ${report.npcsAdded} creatures, ${report.objectsAdded} objects and ${report.itemsAdded} items added.`,
);
const zoneNames = json('zone-names.json');
const dungeons = json('dungeons.json');
console.log(`new dungeons: ${addDungeonQuests(dungeons, d.quests)} of QuestieDB's quests on their lists`);
console.log(writeNewDungeons(qdb, args.questiedb, dungeons, file, args.dry));
console.log(asCoverage(d, qdb, { zoneNames, dungeons }));

const meta = json('meta.json');
meta.sources.questiedb = questieMeta(qdb);
meta.counts.quests = d.quests.length;
meta.counts.questsNew = d.quests.filter((q) => q.ch === 'n').length;
meta.counts.npcs = Object.keys(d.npcs).length;
if (!args.dry) {
  writeFileSync(file('quests.json'), JSON.stringify(d.quests));
  writeFileSync(file('npcs.json'), JSON.stringify(d.npcs));
  writeFileSync(file('objects.json'), JSON.stringify(d.objects));
  writeFileSync(file('minor-items.json'), JSON.stringify(d.minor));
  writeFileSync(file('meta.json'), JSON.stringify(meta));
  writeFileSync(file('dungeons.json'), JSON.stringify(dungeons));
}
