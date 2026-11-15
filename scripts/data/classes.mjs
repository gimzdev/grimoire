#!/usr/bin/env node
// Rebuilds the class data of a finished data/ from a newer talentsforever.com export: the talents, the trainer abilities, the
// races, the classes, Legacy and the recommended builds, then Blizzard's hotfixes since launch on top (lib/live.mjs). build.mjs
// does the same from all the sources; this is for a newer export when the rest of data/ stays as it is.
//
// The classes take three facts from VMaNGOS: the level and price of each rank at a Classic trainer, and the classes each race had
// in Classic. With --vmangos they come from it as in build.mjs (only the trainer tables, spell_template and playercreateinfo are
// read). Without it they are kept from data/: the prices and the race and class pairs exactly, and a rank already marked as taught
// at another level than Classic's stays marked while any other keeps its level in data/ as Classic's (a rank that moves in the
// newer export is listed for checking).
//
//   node scripts/data/classes.mjs --talents talentsforever.json [--vmangos mangos.sqlite] [--data data] [--dry]
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildBuilds } from './lib/builds.mjs';
import { buildLegacy } from './lib/legacy.mjs';
import { applyLive, liveMeta } from './lib/live.mjs';
import { addLayouts, buildAbilities, buildClasses, buildRaces, buildTalents, classicCombos, relevelTalentSpells, skippedText } from './lib/talents.mjs';
import { addCosts, trainerCosts, trainerLevels } from './lib/trainers.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const arg = (name) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : undefined;
};
if (!arg('talents')) throw new Error('Missing --talents: the talentsforever.com export (see scripts/data/README.md).');
const data = path.resolve(arg('data') ?? path.join(here, '..', '..', 'data'));
const dry = process.argv.includes('--dry');
const json = (f) => JSON.parse(readFileSync(f, 'utf8'));
const staticFile = (f) => json(path.join(here, 'static', f));
const read = (f) => json(path.join(data, f));

const tf = json(arg('talents'));
if (tf.license !== 'CC-BY-4.0') throw new Error(`The talentsforever export says its licence is ${tf.license}, not CC-BY-4.0: check before using it.`);
const meta = read('meta.json');
if (tf.generated < meta.sources.talents.date) throw new Error(`The export was read on ${tf.generated}, before the one data/ is built from (${meta.sources.talents.date}).`);

/* ── What VMaNGOS gives the classes: from it, or as data/ has it ── */
const before = { abilities: read('abilities.json'), races: read('races.json'), talents: read('talents.json'), builds: read('builds.json') };
const oldAbilities = Object.values(before.abilities).flat();
let classicLevels;
let costs;
let combos;
if (arg('vmangos')) {
  const db = new DatabaseSync(path.resolve(arg('vmangos')), { readOnly: true });
  classicLevels = trainerLevels(db);
  costs = trainerCosts(db);
  combos = classicCombos(db);
} else {
  // A rank marked as taught at another level than Classic's stays marked (-1 is no level); any other rank had Classic's level.
  classicLevels = new Map(oldAbilities.map((a) => [a.id, a.change === 'changedLevels' ? -1 : a.level]));
  costs = new Map(oldAbilities.filter((a) => a.cost).map((a) => [a.id, a.cost]));
  combos = new Map();
  for (const r of before.races) {
    const known = r.classes.filter((c) => !r.newClasses.includes(c));
    if (known.length) combos.set(r.slug, new Set(known));
  }
}

/* ── The classes, as build.mjs makes them ── */
const staticClasses = staticFile('classes.json');
// Each talent keeps its id from static/talent-ids.json; a talent new to it gets one and is added to the list.
const talentIds = staticFile('talent-ids.json');
const freshIds = [];
const talents = buildTalents(tf, staticClasses, talentIds.ids, freshIds);
// The orders older talent links were written in, for the classes whose trees moved since (static/talent-layouts.json).
addLayouts(talents, staticFile('talent-layouts.json'));
const abilities = buildAbilities(tf, talents, classicLevels);
const relevelled = relevelTalentSpells(abilities, talents);
const races = buildRaces(tf, staticFile('races.json'), combos);
const priced = addCosts(abilities, costs);
const classes = buildClasses(staticClasses, talents, abilities, races);
const legacy = buildLegacy(tf, staticFile('legacy.json'), classes);
const { builds, problems } = buildBuilds(staticFile('builds.json'), talents);

/* ── Blizzard's hotfixes since launch: the quests, creatures and guide of data/ have them already ── */
const world = { quests: read('quests.json'), npcs: read('npcs.json'), guide: read('guide.json') };
const live = applyLive({ abilities, talents, races, ...world });

/* ── meta.json ── */
const build = /build (\d+\.\d+\.\d+\.\d+)/.exec(tf.talents.Warrior?.source ?? '')?.[1] ?? 'unknown';
meta.build = build;
meta.extracted = tf.generated;
meta.sources.talents = { ...meta.sources.talents, build, date: tf.generated };
delete meta.sources.hotfix;
delete meta.sources.notes;
const all = Object.values(talents);
const abil = Object.values(abilities).flat();
Object.assign(meta.counts, {
  talents: all.reduce((n, c) => n + c.stats.total, 0),
  talentsNew: all.reduce((n, c) => n + c.stats.new, 0),
  talentsChanged: all.reduce((n, c) => n + c.stats.changed, 0),
  talentsRemoved: all.reduce((n, c) => n + c.stats.removed, 0),
  abilities: abil.length,
  abilitiesIntroduced: abil.filter((a) => a.change === 'introduced').length,
});
liveMeta(meta);

/* ── What moved: for checking before anything is written ── */
const key = (a) => `${a.name} ${a.rank}`.trim();
for (const cls of Object.keys(abilities)) {
  const was = new Map(before.abilities[cls].map((a) => [key(a), a]));
  const now = new Map(abilities[cls].map((a) => [key(a), a]));
  const added = [...now.keys()].filter((k) => !was.has(k));
  const gone = [...was.keys()].filter((k) => !now.has(k));
  const moved = [...now.values()].filter((a) => was.has(key(a)) && was.get(key(a)).level !== a.level).map((a) => `${key(a)} ${was.get(key(a)).level} -> ${a.level}`);
  const reworded = [...now.values()].filter((a) => was.has(key(a)) && was.get(key(a)).desc !== a.desc).length;
  const marked = [...now.values()].filter((a) => a.change === 'changedLevels' && was.get(key(a))?.change !== 'changedLevels').map(key);
  console.log(`${cls}: ${abilities[cls].length} ranks (was ${before.abilities[cls].length}), ${reworded} reworded`);
  if (added.length) console.log(`  new: ${added.join(', ')}`);
  if (gone.length) console.log(`  gone: ${gone.join(', ')}`);
  if (moved.length) console.log(`  level: ${moved.join(', ')}`);
  if (marked.length) console.log(`  newly marked as taught at another level than Classic's${arg('vmangos') ? '' : ' (check)'}: ${marked.join(', ')}`);
}
for (const cls of Object.keys(talents)) {
  const was = new Map(before.talents[cls].trees.flatMap((t) => t.talents.map((x) => [x.name, { ...x, tree: t.name }])));
  const now = talents[cls].trees.flatMap((t) => t.talents.map((x) => ({ ...x, tree: t.name })));
  const names = new Set(now.map((t) => t.name));
  const lines = [];
  for (const t of now) {
    const o = was.get(t.name);
    if (!o) lines.push(`+ ${t.tree}/${t.name} (${t.row + 1},${t.col + 1}) x${t.max}`);
    else {
      const what = [];
      if (o.tree !== t.tree || o.row !== t.row || o.col !== t.col) what.push(`${o.tree} ${o.row + 1},${o.col + 1} -> ${t.tree} ${t.row + 1},${t.col + 1}`);
      if (o.max !== t.max) what.push(`ranks ${o.max} -> ${t.max}`);
      if (JSON.stringify(o.desc) !== JSON.stringify(t.desc)) what.push('wording');
      if ((o.req ? was.get([...was.values()].find((x) => x.id === o.req.id)?.name)?.name : '') !== (t.req ? now.find((x) => x.id === t.req.id)?.name : '')) what.push('prerequisite');
      if (what.length) lines.push(`~ ${t.tree}/${t.name}: ${what.join('; ')}`);
    }
  }
  for (const [name, o] of was) if (!names.has(name)) lines.push(`- ${o.tree}/${name}`);
  console.log(`${cls} talents: ${lines.length ? '' : 'no change'}`);
  for (const l of lines) console.log(`  ${l}`);
}
for (const b of builds) {
  const o = before.builds.find((x) => x.id === b.id);
  if (o && (o.code !== b.code || o.order !== b.order)) console.log(`build ${b.id}: ${o.code} -> ${b.code}`);
}
console.log(`trainers: ${priced} abilities priced; ${relevelled.length} talent spells moved to their talent's row${relevelled.length ? `: ${relevelled.join(', ')}` : ''}`);
console.log(`live hotfixes: ${live.length} edits`);
for (const l of live) console.log(`  ${l}`);
if (problems.length) console.log(`Builds to check:\n  ${problems.join('\n  ')}`);
if (skippedText.length) console.log(`Tooltips left out because the export took them from Wowhead Classic (s=classic): ${skippedText.length}`);

if (freshIds.length) console.log(`talent ids: ${freshIds.map((f) => `${f.cls}/${f.name} ${f.id}`).join(', ')} new${dry ? '' : ', added to static/talent-ids.json'}`);
if (!dry) {
  if (freshIds.length) {
    for (const f of freshIds) (talentIds.ids[f.cls] ??= {})[f.name] = f.id;
    writeFileSync(path.join(here, 'static', 'talent-ids.json'), `${JSON.stringify(talentIds, null, 2)}\n`);
  }
  const write = (name, value) => writeFileSync(path.join(data, name), JSON.stringify(value));
  write('talents.json', talents);
  write('abilities.json', abilities);
  write('races.json', races);
  write('classes.json', classes);
  write('legacy.json', legacy);
  write('builds.json', builds);
  write('meta.json', meta);
  // The hotfixes also touch quests, creatures and the leveling guide.
  write('quests.json', world.quests);
  write('npcs.json', world.npcs);
  write('guide.json', world.guide);
  console.log(`data/ classes rebuilt from the export of ${tf.generated} (build ${build}).`);
}
