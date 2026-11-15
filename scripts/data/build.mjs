#!/usr/bin/env node
// Rebuilds every file in data/ from four openly licensed sources and Grimoire's own hand-written facts:
//
//   VMaNGOS world database   GPL-2.0-or-later  Classic quests, NPCs, objects, items, loot, vendors, zones
//   talentsforever.com export CC BY 4.0        talents, trainer abilities, racials, Legacy perks and challenges (WoW Forever beta client)
//   LibQuestDB                MIT              Forever's quest list and XP table, its new quests, and which zone each NPC and object stands in
//   QuestieDB (--questiedb)   GPLv3            Forever's own quests with givers, takers, objectives and experience, and for the
//                                              routes where every creature and object stands
//
// Nothing here is read from World of Warcraft database sites (NOTICE.md says where a source did). See scripts/data/README.md
// for where to get each source.
//
//   node scripts/data/build.mjs --vmangos mangos.sqlite --talents data.json --libquestdb path/to/QuestDB [--questiedb path/to/QuestieDB] [--out data]

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildLegacy } from './lib/legacy.mjs';
import { buildBuilds } from './lib/builds.mjs';
import { buildEncounters } from './lib/encounters.mjs';
import { dungeonQuests } from './lib/dungeon-quests.mjs';
import { questEvents } from './lib/events.mjs';
import { questSides } from './lib/quest-sides.mjs';
import { buildGuide, guideData, readSpawns } from './lib/guide.mjs';
import { addForever } from './lib/forever.mjs';
import { applyLive, liveMeta } from './lib/live.mjs';
import { foreverItems } from './lib/items-forever.mjs';
import { addCosts, trainerCosts, trainerLevels } from './lib/trainers.mjs';
import { itemSets } from './lib/sets.mjs';
import { header, readRows, readSections, readSpawnZones } from './lib/lua.mjs';
import { addLayouts, buildAbilities, buildClasses, buildRaces, buildTalents, classicCombos, relevelTalentSpells, skippedText } from './lib/talents.mjs';
import { buildWorld, inPatch, latest, openVmangos } from './lib/world.mjs';
import { addDungeonQuests, mergeQuestieDB, questieMeta, readQuestieDB, routableLevels, routeInputs } from './lib/questiedb.mjs';
import { addNamedBosses, applyNewDungeons, newDungeonFacts } from './lib/questiedb-dungeons.mjs';

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
// Each talent keeps its id from static/talent-ids.json; a talent new to it gets one and is added to the list.
const talentIds = staticFile('talent-ids.json');
const freshIds = [];
const talents = buildTalents(tf, staticClasses, talentIds.ids, freshIds);
// The orders older talent links were written in, for the classes whose trees moved since (static/talent-layouts.json).
addLayouts(talents, staticFile('talent-layouts.json'));
if (freshIds.length) {
  for (const f of freshIds) (talentIds.ids[f.cls] ??= {})[f.name] = f.id;
  writeFileSync(path.join(here, 'static', 'talent-ids.json'), `${JSON.stringify(talentIds, null, 2)}\n`);
  console.log(`talent ids: ${freshIds.map((f) => `${f.cls}/${f.name} ${f.id}`).join(', ')} added to static/talent-ids.json`);
}

// Classic trainer levels (VMaNGOS, scripts/data/lib/trainers.mjs), so a rank Forever teaches at another level is marked.
const abilities = buildAbilities(tf, talents, trainerLevels(db));
// A spell a talent teaches comes at the first level its talent can be taken.
relevelTalentSpells(abilities, talents);
const races = buildRaces(tf, staticFile('races.json'), classicCombos(db));
// Classic's training price of each spell (scripts/data/lib/trainers.mjs).
console.log(`trainers: ${addCosts(abilities, trainerCosts(db))} abilities priced`);
const classes = buildClasses(staticClasses, talents, abilities, races);
const legacy = buildLegacy(tf, staticFile('legacy.json'), classes);

/* ── Recommended builds: written by name, encoded against the current trees (scripts/data/lib/builds.mjs) ── */
const { builds, problems: buildProblems } = buildBuilds(staticFile('builds.json'), talents);

/* ── World ── */
const world = buildWorld({ db, lq, scriptedSpawns: staticFile('scripted-spawns.json') });
// The side each quest is for as players meet it (fs), where it says more than the game's own (scripts/data/lib/quest-sides.mjs).
{
  const sides = questSides(world);
  for (const q of world.quests) if (sides.has(q.i)) q.fs = sides.get(q.i);
}
const newZones = staticFile('zones.json');
const zones = [...world.zones, ...newZones.filter((z) => !world.zones.some((w) => w.id === z.id))].sort((a, b) => a.cat - b.cat || a.n.localeCompare(b.n));
// Forever's own quests from QuestieDB, before the routes are worked out (scripts/data/lib/questiedb.mjs; scripts/data/questiedb.mjs
// does the same on a finished data/).
const qdb = args.questiedb ? readQuestieDB(args.questiedb) : null;
if (qdb) {
  const r = mergeQuestieDB({ quests: world.quests, npcs: world.npcs, objects: world.objects, minor: world.minor, zones }, qdb);
  console.log(`QuestieDB ${qdb.version}: ${r.forever} of Forever's own quests, ${r.npcsAdded} creatures, ${r.objectsAdded} objects, ${r.itemsAdded} items`);
}
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
  // the new dungeons' quests QuestieDB files under them
  if (qdb) addDungeonQuests(dungeons, world.quests);
}

/* ── Dungeon and raid bosses: order, abilities, loot; notable drops of the regular mobs ── */
const encounters = buildEncounters({ db, world, dungeons, staticEncounters: staticFile('encounters.json'), bossScripts: staticFile('boss-scripts.json'), tf });
// the new dungeons' and raids' entrances, and the bosses QuestieDB's traces rank (scripts/data/lib/questiedb-dungeons.mjs)
if (qdb) applyNewDungeons(newDungeonFacts(qdb, args.questiedb, dungeons), dungeons, encounters.encounters, qdb.date);
addNamedBosses(staticFile('encounters.json'), encounters.encounters, qdb);

/* ── Leveling guide: a route of steps from 1 to 60 for each starting zone (scripts/data/lib/guide.mjs) ── */
const routePlan = staticFile('route.json');
// Forever's zones, band by band: where QuestieDB places enough of their quests to route them (lib/questiedb.mjs).
const routable = qdb ? routableLevels(world.quests, qdb, [16593, 16591, 16651, 616]) : new Map();
const guide = guideData(
  buildGuide({
    db,
    // With QuestieDB, where everything stands and the quests' relations come from it, as routes.mjs takes them.
    lq: qdb
      ? routeInputs(qdb, world.quests)
      : {
          quests: lq.quests,
          npcSpawns: readSpawns(path.join(LQ, '_core', 'NPCSpawns.lua')),
          objectSpawns: readSpawns(path.join(LQ, '_core', 'ObjectSpawns.lua')),
          zones: readSections(path.join(LQ, '_core', 'Zones.lua')),
        },
    world: { quests: world.quests, npcs: world.npcs, objects: world.objects, drops: world.drops },
    plan: routePlan,
    races,
    events: questEvents({ db, quests: world.quests, log: (m) => console.log(m) }),
    hoursBefore: staticFile('route-hours.json').hours,
    // what each route was as released: a route keeps its newer rules only where it is no worse than that (lib/guide.mjs)
    release: staticFile('route-release.json'),
    routable,
    log: (m) => console.log(m),
  }),
  { world: { ...world, itemNames: Object.fromEntries(world.items.map((i) => [i.i, i.n])) }, zoneNames, plan: routePlan, dungeons },
);
// Notes for Forever's own content, the dungeons worth running once, and the Skyborne routes
// (scripts/data/lib/forever.mjs; scripts/data/forever.mjs does the same on a finished data/).
guide.coverage = Object.fromEntries([...routable].map(([area, v]) => [area, v.bands]));
guide.incomplete = Object.fromEntries([...routable].map(([area, v]) => [area, Object.fromEntries(v.missing)]));
addForever(guide, { plan: routePlan, dungeons, quests: world.quests, npcs: world.npcs, log: (m) => console.log(m) });

// Blizzard's hotfixes since launch: wordings, quests and a creature it corrected (scripts/data/lib/live.mjs; scripts/data/live.mjs
// does the same on a finished data/).
console.log(`live hotfixes: ${applyLive({ abilities, talents, races, quests: world.quests, npcs: world.npcs, guide }).length} edits`);

/* ── Write ── */
mkdirSync(OUT, { recursive: true });
// Classic's items brought to what is known of Forever: the items Blizzard has shown and its published item rules
// (scripts/data/lib/items-forever.mjs).
const itemReport = foreverItems(world.items, staticFile('item-changes.json').items);
console.log(`items: ${itemReport.items} changed${itemReport.missing.length ? `; not in the data: ${itemReport.missing.join(', ')}` : ''}`);
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
  itemsUpdated: world.items.filter((i) => i.fr).length,
  quests: world.quests.length,
  questsNew: world.quests.filter((q) => q.ch === 'n').length,
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
    ...(qdb ? { questiedb: questieMeta(qdb) } : {}),
  },
};
liveMeta(meta);
write('meta.json', meta);
write('classes.json', classes);
write('races.json', races);
write('talents.json', talents);
write('abilities.json', abilities);
write('builds.json', builds);
write('items.json', world.items);
// Item sets from their pieces (scripts/data/lib/sets.mjs): names from the pieces, bonuses left to the game's tooltip.
write('sets.json', itemSets(world.items));
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
