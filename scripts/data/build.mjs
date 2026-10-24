#!/usr/bin/env node
// Rebuilds every file in data/ from three openly licensed sources and Grimoire's own hand-written facts:
//
//   VMaNGOS world database   GPL-2.0-or-later  Classic quests, NPCs, objects, items, loot, vendors, zones
//   talentsforever.com export CC BY 4.0        talents, trainer abilities, racials, Legacy perks and challenges (WoW Forever beta client)
//   LibQuestDB                MIT              Forever's quest list and XP table, its new quests, and which zone each NPC and object stands in
//
// Nothing here is read from World of Warcraft database sites (NOTICE.md says where a source did). See scripts/data/README.md
// for where to get each source.
//
//   node scripts/data/build.mjs --vmangos mangos.sqlite --talents data.json --libquestdb path/to/QuestDB [--out data]

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildLegacy } from './lib/legacy.mjs';
import { buildEncounters } from './lib/encounters.mjs';
import { dungeonQuests } from './lib/dungeon-quests.mjs';
import { questEvents } from './lib/events.mjs';
import { questSides } from './lib/quest-sides.mjs';
import { buildGuide, guideData, readSpawns } from './lib/guide.mjs';
import { header, readRows, readSections, readSpawnZones } from './lib/lua.mjs';
import { buildAbilities, buildClasses, buildRaces, buildTalents, skippedText } from './lib/talents.mjs';
import { buildWorld, inPatch, latest, openVmangos } from './lib/world.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const args = Object.fromEntries(
  process.argv
    .slice(2)
    .join(' ')
    .split(/\s*--/)
    .filter(Boolean)
    .map((a) => {
      const [k, ...v] = a.split(/\s+/);
      return [k, v.join(' ')];
    }),
);
for (const k of ['vmangos', 'talents', 'libquestdb']) if (!args[k]) throw new Error(`Missing --${k}. See scripts/data/README.md.`);
const OUT = path.resolve(args.out || path.join(here, '..', '..', 'data'));
const json = (f) => JSON.parse(readFileSync(f, 'utf8'));
const staticFile = (f) => json(path.join(here, 'static', f));

/* ── Sources ── */
const tf = json(args.talents);
if (tf.license !== 'CC-BY-4.0') throw new Error(`The talentsforever export says its licence is ${tf.license}, not CC-BY-4.0: check before using it.`);
const db = openVmangos(args.vmangos);
const LQ = path.join(args.libquestdb, 'Data', 'Forever');
const lq = {
  quests: readRows(path.join(LQ, '_core', 'Quests.lua')),
  questXP: new Map([...readRows(path.join(LQ, '_core', 'QuestXP.lua'))].map(([level, [tiers]]) => [level, String(tiers).split(',').filter(Boolean).map(Number)])),
  harvest: readRows(path.join(LQ, '_core', 'Harvest.lua')),
  harvestText: readRows(path.join(LQ, 'enUS', 'HarvestText.lua')),
  npcZones: readSpawnZones(path.join(LQ, '_core', 'NPCSpawns.lua')),
  objectZones: readSpawnZones(path.join(LQ, '_core', 'ObjectSpawns.lua')),
};
const lqVersion = /## Version:\s*(\S+)/.exec(readFileSync(path.join(args.libquestdb, 'QuestDB.toc'), 'utf8'))?.[1] ?? 'unknown';
const lqHarvest = header(path.join(LQ, '_core', 'Harvest.lua')).find((l) => l.startsWith('source')) ?? '';
const lqClient = /build (\d+\.\d+\.\d+\.\d+)/.exec(header(path.join(LQ, '_core', 'QuestXP.lua')).join(' '))?.[1] ?? 'unknown';

/* ── Classes, races, talents, abilities ── */
const staticClasses = staticFile('classes.json');
const talents = buildTalents(tf, staticClasses);

// Classic trainer levels (VMaNGOS): the trainer lists a teaching spell that teaches the real one.
const classicLevels = new Map();
{
  const teach = new Map();
  for (const r of db.prepare('SELECT entry, effect1, effectTriggerSpell1 FROM spell_template WHERE effect1 = 36 ORDER BY entry, build').all()) teach.set(r.entry, r.effectTriggerSpell1);
  for (const table of ['npc_trainer', 'npc_trainer_template']) {
    for (const r of db.prepare(`SELECT spell, reqlevel FROM ${table}`).all()) {
      const real = teach.get(r.spell) ?? r.spell;
      if (r.reqlevel && (!classicLevels.has(real) || classicLevels.get(real) > r.reqlevel)) classicLevels.set(real, r.reqlevel);
    }
  }
}
const abilities = buildAbilities(tf, talents, classicLevels);

const RACE_SLUG = { 1: 'human', 2: 'orc', 3: 'dwarf', 4: 'night-elf', 5: 'undead', 6: 'tauren', 7: 'gnome', 8: 'troll' };
const CLASS_SLUG = { 1: 'warrior', 2: 'paladin', 3: 'hunter', 4: 'rogue', 5: 'priest', 7: 'shaman', 8: 'mage', 9: 'warlock', 11: 'druid' };
const classicCombos = new Map();
for (const r of db.prepare('SELECT DISTINCT race, class FROM playercreateinfo').all()) {
  const race = RACE_SLUG[r.race];
  const cls = CLASS_SLUG[r.class];
  if (!race || !cls) continue;
  if (!classicCombos.has(race)) classicCombos.set(race, new Set());
  classicCombos.get(race).add(cls);
}
const races = buildRaces(tf, staticFile('races.json'), classicCombos);
const classes = buildClasses(staticClasses, talents, abilities, races);
const legacy = buildLegacy(tf, staticFile('legacy.json'), classes);

/* ── Recommended builds: written by name, encoded against the current trees ── */
const ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
const sortedTalents = (tree) => [...tree.talents].sort((a, b) => a.row - b.row || a.col - b.col);
function addBlock(trees, ranks, talent, tree) {
  const rank = ranks[talent.id] ?? 0;
  if (rank >= talent.max) return 'max';
  const total = Object.values(ranks).reduce((n, v) => n + v, 0);
  if (total >= 51) return 'points';
  let below = 0;
  for (const t of tree.talents) if (t.row < talent.row) below += ranks[t.id] ?? 0;
  if (below < talent.row * 5) return 'tier';
  if (talent.req && (ranks[talent.req.id] ?? 0) < talent.req.qty) return 'prereq';
  return null;
}
const buildProblems = [];
const builds = staticFile('builds.json').map((b) => {
  const trees = talents[b.cls].trees;
  const byName = new Map();
  trees.forEach((tree) => tree.talents.forEach((t) => byName.set(t.name, { t, tree })));
  const all0 = new Map(trees.flatMap((tree) => tree.talents.map((t) => [t.id, t.name])));
  const ranks = {};
  const kept = [];
  const missing = new Set();
  // Replay the order point by point. A point that is not legal yet waits, and the waiting points are tried again,
  // oldest first, after every point placed, so each lands at the first level it can.
  const waiting = [];
  const place = (name) => {
    const hit = byName.get(name);
    if (addBlock(trees, ranks, hit.t, hit.tree) !== null) return false;
    ranks[hit.t.id] = (ranks[hit.t.id] ?? 0) + 1;
    kept.push(hit.t.id);
    return true;
  };
  const drain = () => {
    for (let i = 0; i < waiting.length; ) {
      if (place(waiting[i])) {
        waiting.splice(i, 1);
        i = 0;
      } else i++;
    }
  };
  for (const name of b.order) {
    if (!byName.has(name)) {
      missing.add(name);
      continue;
    }
    if (place(name)) drain();
    else waiting.push(name);
  }
  drain();
  const pending = waiting;
  const spent = kept.length;
  const replayed = kept.map((id) => all0.get(id));
  const reordered = !missing.size && !pending.length && replayed.some((n, i) => n !== b.order[i]);
  if (missing.size || spent !== b.order.length || reordered)
    buildProblems.push(
      `${b.id}: ${spent}/${b.order.length} points${missing.size ? `, not in the trees: ${[...missing].join(', ')}` : ''}${pending.length ? `, could not place: ${[...new Set(pending)].join(', ')}` : ''}${reordered ? ', placed in a different order than written (a point was not legal yet)' : ''}`,
    );
  const all = trees.flatMap(sortedTalents);
  const index = new Map(all.map((t, i) => [t.id, i]));
  const code = trees
    .map((tree) => sortedTalents(tree).map((t) => String(Math.min(9, ranks[t.id] ?? 0))).join('').replace(/0+$/, ''))
    .join('-')
    .replace(/-+$/, '');
  const { order, ...rest } = b;
  void order;
  return {
    ...rest,
    code,
    order: kept.map((id) => ALPHABET[index.get(id)]).join(''),
    points: trees.map((tree) => tree.talents.reduce((n, t) => n + (ranks[t.id] ?? 0), 0)),
  };
});

/* ── World ── */
const world = buildWorld({ db, lq, scriptedSpawns: staticFile('scripted-spawns.json') });
// The side each quest is for as players meet it (fs), where it says more than the game's own (scripts/data/lib/quest-sides.mjs).
{
  const sides = questSides(world);
  for (const q of world.quests) if (sides.has(q.i)) q.fs = sides.get(q.i);
}
const newZones = staticFile('zones.json');
const zones = [...world.zones, ...newZones.filter((z) => !world.zones.some((w) => w.id === z.id))].sort((a, b) => a.cat - b.cat || a.n.localeCompare(b.n));
const zoneNames = { ...world.zoneNames };
for (const z of newZones) zoneNames[z.id] = z.n;
const dungeons = staticFile('dungeons.json');
// Classic's dungeons: levels from the creatures inside them (VMaNGOS), from one under the lowest quarter of them to three
// over the last boss, at most 60. (Ranges written by hand drift: Dire Maul once read 44 to 54, with its creatures at 54 to
// 62.) Forever's new dungeons keep the levels Blizzard announced.
{
  const templates = latest(db, 'creature_template');
  const onMap = new Map();
  for (const r of db.prepare('SELECT id, map, patch_min, patch_max FROM creature').all()) {
    if (!inPatch(r)) continue;
    if (!onMap.has(r.map)) onMap.set(r.map, []);
    onMap.get(r.map).push(r.id);
  }
  const bossList = staticFile('encounters.json');
  for (const d of dungeons) {
    const e = bossList[d.slug];
    if (d.kind !== 'dungeon' || d.isNew || !e?.map) continue;
    const levels = (onMap.get(e.map) ?? [])
      .map((id) => templates.get(id))
      .filter((c) => c && c.type !== 8 && !c.npc_flags)
      .map((c) => (c.level_min + c.level_max) / 2)
      .sort((a, b) => a - b);
    const bosses = e.wings.flatMap((w) => w.bosses.map((b) => templates.get(b.npc[0])?.level_max ?? 0));
    if (!levels.length || !bosses.length) throw new Error(`dungeon ${d.slug}: no creatures on map ${e.map}`);
    const hi = Math.min(60, Math.max(...bosses) + 3);
    d.levels = [Math.min(hi, Math.round(levels[Math.floor(levels.length / 4)]) - 1), hi];
    d.levelSource = 'creatures';
  }
}
// A dungeon, raid or battleground page and its zone page show the same level range.
for (const d of dungeons) {
  const z = d.zoneId && d.levels ? zones.find((x) => x.id === d.zoneId) : undefined;
  if (z) [z.lo, z.hi] = d.levels;
}
const site = staticFile('site.json');

/* ── Each dungeon's and raid's quests: filed under it, or with their work inside it (scripts/data/lib/dungeon-quests.mjs) ── */
{
  const lists = dungeonQuests({ world, dungeons });
  for (const d of dungeons) if (lists[d.slug]) d.questIds = lists[d.slug];
}

/* ── Dungeon and raid bosses: order, abilities, loot; notable drops of the regular mobs ── */
const encounters = buildEncounters({ db, world, dungeons, staticEncounters: staticFile('encounters.json'), bossScripts: staticFile('boss-scripts.json'), tf });

/* ── Leveling guide: a route of steps from 1 to 60 for each starting zone (scripts/data/lib/guide.mjs) ── */
const routePlan = staticFile('route.json');
const guide = guideData(
  buildGuide({
    db,
    lq: {
      quests: lq.quests,
      npcSpawns: readSpawns(path.join(LQ, '_core', 'NPCSpawns.lua')),
      objectSpawns: readSpawns(path.join(LQ, '_core', 'ObjectSpawns.lua')),
      zones: readSections(path.join(LQ, '_core', 'Zones.lua')),
    },
    world: { quests: world.quests, npcs: world.npcs, objects: world.objects, drops: world.drops },
    plan: routePlan,
    races,
    events: questEvents({ db, quests: world.quests, log: (m) => console.log(m) }),
    log: (m) => console.log(m),
  }),
  { world: { ...world, itemNames: Object.fromEntries(world.items.map((i) => [i.i, i.n])) }, zoneNames, plan: routePlan, dungeons },
);

/* ── Write ── */
mkdirSync(OUT, { recursive: true });
const write = (name, value) => writeFileSync(path.join(OUT, name), JSON.stringify(value));
const migration = db.prepare('SELECT MAX(id) AS id FROM migrations').get()?.id ?? 'unknown';
const talentBuild = /build (\d+\.\d+\.\d+\.\d+)/.exec(tf.talents.Warrior?.source ?? '')?.[1] ?? 'unknown';
const counts = {
  talents: Object.values(talents).reduce((n, c) => n + c.stats.total, 0),
  talentsNew: Object.values(talents).reduce((n, c) => n + c.stats.new, 0),
  talentsChanged: Object.values(talents).reduce((n, c) => n + c.stats.changed, 0),
  talentsRemoved: Object.values(talents).reduce((n, c) => n + c.stats.removed, 0),
  abilities: Object.values(abilities).reduce((n, l) => n + l.length, 0),
  abilitiesIntroduced: Object.values(abilities).reduce((n, l) => n + l.filter((a) => a.change === 'introduced').length, 0),
  items: world.items.length,
  itemsNew: 0,
  itemsUpdated: 0,
  quests: world.quests.length,
  questsNew: world.foreverNew,
  npcs: Object.keys(world.npcs).length,
  zones: zones.length,
  newDungeons: dungeons.filter((d) => d.isNew && d.kind === 'dungeon').length,
  newRaids: dungeons.filter((d) => d.isNew && d.kind === 'raid').length,
  bosses: encounters.report.bosses,
  bossAbilities: encounters.report.abilities,
};
const meta = {
  build: talentBuild,
  extracted: tf.generated,
  ...site,
  counts,
  sources: {
    talents: { name: 'talentsforever.com', url: 'https://talentsforever.com', license: 'CC BY 4.0', build: talentBuild, date: tf.generated },
    vmangos: { name: 'VMaNGOS', url: 'https://github.com/vmangos/core', license: 'GPL-2.0-or-later', migration: String(migration), patch: '1.12' },
    libquestdb: { name: 'LibQuestDB', url: 'https://www.curseforge.com/wow/addons/questdb', license: 'MIT', version: lqVersion, client: lqClient, harvest: lqHarvest },
  },
};
write('meta.json', meta);
write('classes.json', classes);
write('races.json', races);
write('talents.json', talents);
write('abilities.json', abilities);
write('builds.json', builds);
write('items.json', world.items);
write('sets.json', []);
write('minor-items.json', world.minor);
write('quests.json', world.quests);
write('npcs.json', world.npcs);
write('objects.json', world.objects);
write('drops.json', world.drops);
write('npc-loot.json', world.npcLoot);
write('vendors.json', world.vendors);
write('zones.json', zones);
write('zone-names.json', zoneNames);
write('zone-pages.json', {});
write('factions.json', world.factions);
write('dungeons.json', dungeons);
write('encounters.json', { npcs: encounters.names, dungeons: encounters.encounters });
write('legacy.json', legacy);
write('guide.json', guide);

console.log(`data/ rebuilt: ${counts.talents} talents (build ${talentBuild}), ${counts.abilities} trainer ranks, ${counts.items} gear items, ${Object.keys(world.minor).length} other items, ${counts.quests} quests (${counts.questsNew} new in Forever), ${counts.npcs} NPCs, ${zones.length} zones, ${legacy.challenges.length} Legacy challenges, ${legacy.trees.reduce((n, t) => n + t.perks.length, 0)} perks and ${guide.routes.length} leveling routes (${guide.routes.reduce((n, r) => n + r.steps.length, 0)} steps).`);
{
  const r = encounters.report;
  const listed = Object.keys(encounters.encounters).length;
  console.log(`Encounters: ${r.bosses} bosses in ${listed} dungeons and raids, ${r.withAbilities} with abilities (${r.abilities} in all: ${r.bySource.list} from spell lists, ${r.bySource.eventai} from EventAI, ${r.bySource.script} from C++ boss scripts, ${r.bySource.aura} auras); ${r.trash} notable drops of regular mobs.`);
  const later = dungeons.filter((d) => d.kind !== 'battleground' && !encounters.encounters[d.slug]).map((d) => d.name);
  if (later.length) console.log(`  No open database has the bosses of: ${later.join(', ')}.`);
  if (r.noAbilities.length) console.log(`  Bosses without abilities in VMaNGOS: ${r.noAbilities.join('; ')}.`);
  if (r.summoned.length) console.log(`  Summoned or event bosses (no spawn in the instance): ${r.summoned.length}.`);
  if (encounters.problems.length) console.log(`  Encounter problems:\n    ${encounters.problems.join('\n    ')}`);
}
if (buildProblems.length) console.log(`Builds to check:\n  ${buildProblems.join('\n  ')}`);
if (skippedText.length) console.log(`Tooltips left out because the export took them from Wowhead Classic (s=classic): ${skippedText.join(', ')}`);
