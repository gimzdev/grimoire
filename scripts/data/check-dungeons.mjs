#!/usr/bin/env node
// Checks what Grimoire takes from QuestieDB for the new dungeons and the first tier's raids
// (scripts/data/lib/questiedb-dungeons.mjs) against QuestieDB itself:
//   1. data/ holds it: applying it again to data/dungeons.json and data/encounters.json changes nothing, with the new
//      dungeons' own facts and the bosses Blizzard or two sites name (static/dungeons.json, static/encounters.json); every
//      such boss names its sources: two, or Blizzard.
//   2. The boss rule (rank 3, a level, hostile to both sides) on Classic's instances, where Grimoire knows the bosses from
//      VMaNGOS: every creature it names there is a boss, but for the exceptions listed below with their reason.
//   3. The guides say what the data says: the new dungeons' entrances and bosses (content/guides/new-dungeons.md), the
//      raids' sizes, bosses and entrances (content/guides/raids-preview.md), and the day of QuestieDB's traces; each named
//      boss list ("**Bosses:** ...") is the data's.
// Needs GRIMOIRE_QUESTIEDB; without it it says what it skipped.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readQuestieDB } from './lib/questiedb.mjs';
import { addNamedBosses, applyNewDungeons, bossLine, newDungeonFacts, rankAgainstClassic, syncNewDungeons } from './lib/questiedb-dungeons.mjs';

const qd = process.env.GRIMOIRE_QUESTIEDB;
if (!qd) {
  console.log('skipped: needs GRIMOIRE_QUESTIEDB (QuestieDB checkout)');
  process.exit(0);
}
const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '..', '..');
const json = (f) => JSON.parse(readFileSync(path.join(root, f), 'utf8'));
const qdb = readQuestieDB(qd);
const dungeons = json('data/dungeons.json');
const encounters = json('data/encounters.json');
const zoneNames = json('data/zone-names.json');
let bad = 0;
const fail = (line) => {
  console.log(line);
  bad++;
};

/* 1. data/ holds what QuestieDB has. */
const facts = newDungeonFacts(qdb, qd, dungeons);
{
  const d2 = structuredClone(dungeons);
  const e2 = structuredClone(encounters.dungeons);
  syncNewDungeons(json('scripts/data/static/dungeons.json'), d2);
  applyNewDungeons(facts, d2, e2, qdb.date);
  addNamedBosses(json('scripts/data/static/encounters.json'), e2, qdb);
  if (JSON.stringify(d2) !== JSON.stringify(dungeons) || JSON.stringify(e2) !== JSON.stringify(encounters.dungeons))
    fail('data/dungeons.json or data/encounters.json differs from QuestieDB: run node scripts/data/questiedb.mjs --questiedb <checkout>');
}

/* Every named boss says who names it: two sites, or Blizzard. */
for (const [slug, e] of Object.entries(encounters.dungeons)) {
  if (e.src !== 'sites') continue;
  for (const b of e.wings.flatMap((w) => w.bosses)) {
    const src = b.src ?? [];
    if (!(src.length >= 2 || src.some((x) => x.startsWith('Blizzard')))) fail(`${slug}: ${b.n} has ${src.length ? `only ${src.join(', ')}` : 'no source'}`);
    for (const x of src) if (!e.sources.some((s) => s.name === x)) fail(`${slug}: ${b.n}: source ${x} is not in the entry's sources`);
  }
}

/* 2. The rule on Classic's instances. A creature listed here that the rule no longer names fails too: take it out. */
const NOT_BOSSES = {
  15114: 'Gahz’ranka is a boss of Zul’Gurub (VMaNGOS spawns it there); QuestieDB’s Classic data places it in Zul’Farrak',
  15963: 'The Master’s Eye stands in Ahn’Qiraj (VMaNGOS map 531) but is no encounter of Grimoire’s',
};
{
  const r = rankAgainstClassic(qdb, dungeons, encounters.dungeons);
  for (const o of r.others) if (!NOT_BOSSES[o.id]) fail(`boss rule: ${o.n} (${o.id}) in ${o.slug} is ranked 3 but is no boss of Grimoire's`);
  for (const id of Object.keys(NOT_BOSSES)) if (!r.others.some((o) => o.id === Number(id))) fail(`boss rule: ${id} is no longer named; take it out of NOT_BOSSES`);
  console.log(`boss rule on Classic's instances: ${r.named} named, ${r.bosses} of them bosses (${r.small} of a five-player dungeon), ${r.others.length} listed exceptions`);
}

/* 3. The guides. */
const day = new Date(`${qdb.date}T12:00:00Z`).toLocaleDateString('en-US', { month: 'long', day: 'numeric', timeZone: 'UTC' });
const words = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];
const place = (e) => `${zoneNames[e.zone]}, ${e.x.toFixed(1)}, ${e.y.toFixed(1)}`;
const has = (file, text, want) => {
  if (!text.includes(want)) fail(`content/guides/${file}: no "${want}"`);
};
// a boss list ends its sentence or goes on with a comma ("..., in no order two sites agree on")
const hasBosses = (file, text, enc) => {
  const want = `**Bosses:** ${bossLine(enc)}`;
  if (!text.includes(`${want}.`) && !text.includes(`${want},`)) fail(`content/guides/${file}: no "${want}"`);
};
{
  const file = 'new-dungeons.md';
  const text = readFileSync(path.join(root, 'content', 'guides', file), 'utf8');
  const fresh = dungeons.filter((d) => d.isNew && d.kind === 'dungeon');
  for (const d of fresh) for (const e of d.entrances ?? []) has(file, text, `**Entrance:** ${place(e)}.`);
  for (const d of fresh) if (encounters.dungeons[d.slug]?.src) hasBosses(file, text, encounters.dungeons[d.slug]);
  // the paragraph after the table names the bosses the data has, or says it has none
  const blocks = text.split('\n\n');
  const after = blocks[blocks.findIndex((b) => b.startsWith('|')) + 1] ?? '';
  const bosses = fresh.flatMap((d) => facts.get(d.slug)?.bosses ?? []);
  if (bosses.length) for (const b of bosses) has(file, after, b.n);
  else has(file, after, `QuestieDB’s traces of ${day} rank no creature inside them as a boss`);
  const questie = new Set(json('data/quests.json').filter((q) => q.qd).map((q) => q.i));
  const quests = fresh.filter((d) => (d.questIds ?? []).some((id) => questie.has(id))).length;
  const entrances = fresh.filter((d) => d.entrances?.length).length;
  has(file, after, `QuestieDB has the quests of ${words[quests]} of them and the entrances of ${words[entrances]}`);
}
{
  const file = 'raids-preview.md';
  const text = readFileSync(path.join(root, 'content', 'guides', file), 'utf8');
  for (const d of dungeons.filter((x) => x.kind === 'raid' && x.opens)) {
    has(file, text, `| [${d.name}](/dungeons/${d.slug}) | ${d.size} players | ${d.bossCount} |`);
    for (const e of d.entrances ?? []) has(file, text, `**Entrance:** ${place(e)}, as QuestieDB places it.`);
    if (facts.get(d.slug)?.bosses.length) fail(`${file}: QuestieDB's traces now rank bosses in ${d.name}: name them`);
    if (encounters.dungeons[d.slug]?.src) hasBosses(file, text, encounters.dungeons[d.slug]);
  }
}

console.log(bad ? `${bad} problems` : `QuestieDB ${qdb.version} (traces of ${qdb.date}): the new dungeons and raids in data/ and the guides match it`);
process.exit(bad ? 1 : 0);
