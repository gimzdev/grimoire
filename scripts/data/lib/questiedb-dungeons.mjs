// Forever's new dungeons and the first tier's raids as QuestieDB (GPLv3, https://github.com/Questie/QuestieDB) knows them:
// the entrance, and the bosses its traces met inside. scripts/data/questiedb.mjs and build.mjs (--questiedb) write them into data/dungeons.json
// (`entrances`) and data/encounters.json (an encounter with `src: 'questiedb'`, in the shape of Classic's).
//
// The boss rule, strict on purpose (a wrong name on a raid page is worse than none): a creature is a boss of a new instance
// when QuestieDB's traces (src/corrections/Forever/traces/foreverNpcTraces.lua, what Questie's players met) place it inside
// the instance, a spawn or its zone in the instance's root area or a subarea of it (support/Forever/Zones:
// instanceIdToAreaId.lua, subZoneToParentZone.lua), rank it 3, and QuestieDB knows its level and finds it hostile to both
// sides. Rank 3 is the only boss rank of QuestieDB's `rank` field: its schema (src/meta/npcMeta.lua) points to cmangos'
// creature_template, where 3 is CREATURE_ELITE_WORLDBOSS ("World Boss") and 1 is any elite. In QuestieDB no boss of Classic's
// five-player dungeons is rank 3 (they are elites like their trash), so the rule cannot name a five-player boss, and does not
// try; check-dungeons.mjs measures it on Classic's instances, where Grimoire knows the bosses from VMaNGOS.

import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readLua } from './lua.mjs';
import { dungeonCreatures, NEW_DUNGEON_AREAS } from './questiedb.mjs';

const RANK_BOSS = 3;
const STATIC = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'static');
const staticJson = (f) => JSON.parse(readFileSync(path.join(STATIC, f), 'utf8'));

/** QuestieDB's instances: Map(root area -> { map, areas }), each instance map's root area and its subareas. */
function instanceAreas(dir) {
  const zones = path.join(dir, 'support', 'Forever', 'Zones');
  const enumText = readFileSync(path.join(dir, 'src', 'corrections', 'enum', 'zones.lua'), 'utf8');
  const zoneIds = new Map([...enumText.matchAll(/^\s*([A-Z0-9_]+) = (\d+),/gm)].map((m) => [m[1], Number(m[2])]));
  const area = (num, sym) => (num ? Number(num) : zoneIds.get(sym));
  const out = new Map();
  for (const m of readFileSync(path.join(zones, 'instanceIdToAreaId.lua'), 'utf8').matchAll(/^\s*\[(\d+)\] = (?:(\d+)|ZoneDB\.zoneIDs\.(\w+)),/gm)) {
    const root = area(m[2], m[3]);
    if (root) out.set(root, { map: Number(m[1]), areas: new Set([root]) });
  }
  // the parent table and its override (the override wins, as in Questie)
  const parents = new Map();
  for (const m of readFileSync(path.join(zones, 'subZoneToParentZone.lua'), 'utf8').matchAll(/^\s*\[(\d+)\] = (\d+),/gm)) parents.set(Number(m[1]), Number(m[2]));
  for (const [sub, parent] of parents) out.get(parent)?.areas.add(sub);
  return out;
}

/** The trace layer's own rows (foreverNpcTraces.lua): Map(id -> Map(field -> value)), what players met, before other layers. */
function npcTraces(dir) {
  const text = readFileSync(path.join(dir, 'src', 'corrections', 'Forever', 'traces', 'foreverNpcTraces.lua'), 'utf8');
  const at = text.indexOf('return {', text.indexOf('function ForeverNpcTraces:Load()'));
  return readLua(text, at + 'return '.length, (p) => (p.startsWith('npcKeys.') ? p.slice('npcKeys.'.length) : undefined)).value;
}

/** Whether a record's zone or one of its spawns lies in the areas. */
const placedIn = (rec, areas) => areas.has(Number(rec.get('zoneID'))) || (rec.get('spawns') instanceof Map && [...rec.get('spawns').keys()].some((a) => areas.has(Number(a))));

/** Whether QuestieDB ranks a creature as a boss: rank 3, a level, hostile to both sides (friendlyToFaction nil). */
const isBossRank = (rec) => Number(rec.get('rank')) === RANK_BOSS && Number(rec.get('minLevel')) > 0 && !rec.get('friendlyToFaction');

/**
 * What QuestieDB has for each new dungeon and raid and each raid of the first tier (data/dungeons.json's `isNew` or `opens`,
 * battlegrounds aside): its instance, its entrances, the creatures it places inside and the bosses the rule finds there.
 * @param qdb readQuestieDB(dir)
 * @returns Map(slug -> { root, map, entrances: [{ zone, x, y }], inside, bosses: [{ id, n, lv }] })
 */
export function newDungeonFacts(qdb, dir, dungeons) {
  const instances = instanceAreas(dir);
  const traced = npcTraces(dir);
  const out = new Map();
  for (const d of dungeons) {
    if (!(d.isNew || d.opens) || d.kind === 'battleground') continue;
    // the instance among the areas QuestieDB files the dungeon's quests under (its outside areas are not the instance), or
    // a Classic instance's own zone
    const root = (NEW_DUNGEON_AREAS[d.slug] ?? [d.zoneId]).find((a) => instances.has(a));
    const inst = root ? instances.get(root) : null;
    const entrances = (root ? qdb.dungeons.get(root)?.entrances ?? [] : []).map(({ area, x, y }) => ({ zone: area, x, y }));
    let inside = 0;
    const bosses = [];
    if (inst) {
      for (const [id, n] of qdb.npcs) {
        if (!placedIn(n, inst.areas)) continue;
        inside++;
        const t = traced.get(id);
        if (t instanceof Map && placedIn(t, inst.areas) && Number(t.get('rank')) === RANK_BOSS && isBossRank(n)) {
          bosses.push({ id, n: n.get('name'), lv: [Number(n.get('minLevel')), Number(n.get('maxLevel')) || Number(n.get('minLevel'))] });
        }
      }
    }
    bosses.sort((a, b) => a.lv[0] - b.lv[0] || a.id - b.id);
    out.set(d.slug, { root: root ?? null, map: inst?.map ?? null, entrances, inside, bosses });
  }
  return out;
}

/**
 * Writes the facts into data/dungeons.json's rows (`entrances`) and data/encounters.json (`dungeons[slug]`, Classic's shape
 * with `src: 'questiedb'` and the traces' date; no abilities or loot: QuestieDB has none). What QuestieDB no longer has is
 * taken out again; Classic's encounters are never touched. Running it twice gives the same data.
 * @param encounters data/encounters.json's `dungeons`
 * @returns one line per new dungeon and raid: what was written
 */
export function applyNewDungeons(facts, dungeons, encounters, date) {
  const lines = [];
  for (const d of dungeons) {
    const f = facts.get(d.slug);
    if (!f) continue;
    if (f.entrances.length) d.entrances = f.entrances;
    else delete d.entrances;
    if (f.bosses.length) {
      encounters[d.slug] = {
        map: f.map,
        bosses: f.bosses.length,
        rares: 0,
        src: 'questiedb',
        date,
        wings: [{ bosses: f.bosses.map((b) => ({ key: b.n.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''), n: b.n, npcs: [{ id: b.id, n: b.n, lv: b.lv, r: RANK_BOSS, ty: 0, how: 'spawned' }], abilities: [], loot: [] })) }],
        trash: [],
      };
    } else if (encounters[d.slug]?.src === 'questiedb') delete encounters[d.slug];
    const where = f.entrances.map((e) => `${e.zone} ${e.x}, ${e.y}`).join('; ');
    lines.push(`${d.name}: ${where ? `entrance ${where}` : 'no entrance'}; ${f.root ? `instance ${f.root} (map ${f.map}), ${f.inside} creatures placed inside` : 'no instance in QuestieDB'}; ${f.bosses.length ? f.bosses.map((b) => `${b.n} (${b.lv.join('-')})`).join(', ') : 'no boss'}`);
  }
  return lines;
}

/** The new dungeons' and the first tier's raids' own facts (static/dungeons.json) on a finished data/'s rows, as build.mjs
 * writes them, keeping what is generated (their quests and QuestieDB's entrances). */
export function syncNewDungeons(staticDungeons, dungeons) {
  for (const s of staticDungeons) {
    if (!(s.isNew || s.opens)) continue;
    const i = dungeons.findIndex((d) => d.slug === s.slug);
    if (i < 0) continue;
    const row = { ...s };
    for (const k of ['questIds', 'entrances']) if (dungeons[i][k] !== undefined) row[k] = dungeons[i][k];
    dungeons[i] = row;
  }
}

/**
 * The bosses of the new dungeons and raids that Blizzard or two independent sites name (static/encounters.json, entries
 * with src 'sites'), into data/encounters.json in Classic's shape: names, order, rare flags, each boss's sources, and
 * QuestieDB's creature id where QuestieDB has one new creature of that name (or one filed under the dungeon). No level,
 * abilities or loot: no open source has them. An entry the static file no longer has is taken out.
 * @param qdb readQuestieDB() or null (then no ids)
 * @returns the number of bosses written
 */
export function addNamedBosses(staticEncounters, encounters, qdb) {
  const byName = new Map();
  if (qdb)
    for (const [id, n] of qdb.npcs) {
      if (qdb.base.npcs.has(id) || typeof n.get('name') !== 'string') continue;
      if (!byName.has(n.get('name'))) byName.set(n.get('name'), []);
      byName.get(n.get('name')).push([id, Number(n.get('zoneID')) || 0]);
    }
  const idOf = (name, slug) => {
    const all = byName.get(name) ?? [];
    const inside = all.filter(([, z]) => (NEW_DUNGEON_AREAS[slug] ?? []).includes(z));
    return all.length === 1 ? all[0][0] : inside.length === 1 ? inside[0][0] : 0;
  };
  let n = 0;
  for (const slug of Object.keys(encounters)) if (encounters[slug].src === 'sites' && !staticEncounters[slug]?.src) delete encounters[slug];
  for (const [slug, def] of Object.entries(staticEncounters)) {
    if (def.src !== 'sites') continue;
    const bosses = def.wings.flatMap((w) => w.bosses);
    const rare = (b) => b.f?.includes('rare');
    encounters[slug] = {
      map: 0,
      bosses: bosses.filter((b) => !rare(b)).length,
      rares: bosses.filter(rare).length,
      src: 'sites',
      checked: def.checked,
      ordered: def.ordered,
      sources: def.sources,
      ...(def.note ? { note: def.note } : {}),
      wings: def.wings.map((w) => ({
        bosses: w.bosses.map((b) => ({
          key: b.n.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
          n: b.n,
          npcs: [{ id: idOf(b.n, slug), n: b.n, lv: [0, 0], r: 0, ty: 0, how: 'spawned' }],
          ...(b.f ? { f: b.f } : {}),
          src: b.src,
          abilities: [],
          loot: [],
        })),
      })),
      trash: [],
    };
    n += bosses.length;
  }
  return n;
}

/** A dungeon's named bosses as the guides print them: "Zul'Alai, Var'Taka and Gill (rare)". */
export function bossLine(enc) {
  const names = enc.wings.flatMap((w) => w.bosses).map((b) => `${b.n}${b.f?.includes('rare') ? ' (rare)' : ''}`);
  return names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names.at(-1)}` : names[0];
}

/** For scripts/data/questiedb.mjs: the new dungeons' own facts, QuestieDB's entrances and traced bosses, and the bosses
 * Blizzard or two sites name, into `dungeons` (written by the caller) and data/encounters.json (unless dry). @returns the report */
export function writeNewDungeons(qdb, dir, dungeons, file, dry) {
  const encounters = JSON.parse(readFileSync(file('encounters.json'), 'utf8'));
  syncNewDungeons(staticJson('dungeons.json'), dungeons);
  const lines = applyNewDungeons(newDungeonFacts(qdb, dir, dungeons), dungeons, encounters.dungeons, qdb.date);
  const named = addNamedBosses(staticJson('encounters.json'), encounters.dungeons, qdb);
  if (!dry) writeFileSync(file('encounters.json'), JSON.stringify(encounters));
  return `new dungeons and raids (QuestieDB's entrances and the bosses its traces rank):\n  ${lines.join('\n  ')}\n  ${named} bosses named by Blizzard or two sites (static/encounters.json)`;
}

/** The creatures QuestieDB ranks as bosses inside Classic's instances, against Grimoire's encounters (VMaNGOS): how many are
 * bosses, how many of them a five-player dungeon's, and the others (the rank alone is wrong there).
 * @returns { named, bosses, small, others: [{ id, n, slug }] } */
export function rankAgainstClassic(qdb, dungeons, encounters) {
  let named = 0;
  let bosses = 0;
  let small = 0;
  const others = [];
  for (const [slug, e] of Object.entries(encounters)) {
    if (e.src) continue;
    const d = dungeons.find((x) => x.slug === slug);
    const zone = d?.zoneId ?? (slug.startsWith('zone-') ? Number(slug.slice(5)) : 0);
    if (!zone) continue;
    const ids = new Set(e.wings.flatMap((w) => w.bosses.flatMap((b) => b.npcs.map((n) => n.id))));
    for (const c of dungeonCreatures(qdb, [zone, ...(qdb.dungeons.get(zone)?.alt ?? [])])) {
      if (!isBossRank(qdb.npcs.get(c.id))) continue;
      named++;
      if (!ids.has(c.id)) others.push({ id: c.id, n: c.name, slug });
      else {
        bosses++;
        if (d?.size === 5) small++;
      }
    }
  }
  return { named, bosses, small, others };
}
