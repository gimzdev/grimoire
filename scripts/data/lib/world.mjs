// Items, quests, NPCs, objects, loot, vendors, zones and factions from the VMaNGOS world database
// (GPL-2.0-or-later, https://github.com/vmangos/core), at patch 1.12. Which zone an NPC or object stands in, and
// Forever's own new quests, come from LibQuestDB (MIT).

import { DatabaseSync } from 'node:sqlite';
import { spellText } from './spelltext.mjs';

export const PATCH = 10; // VMaNGOS patch 10 = 1.12, the last Classic patch
const CLIENT_BUILD = 5875; // 1.12.1

const ALLIANCE_RACES = 1 | 4 | 8 | 64; // Human, Dwarf, Night Elf, Gnome
const HORDE_RACES = 2 | 16 | 32 | 128; // Orc, Undead, Tauren, Troll
const ALL_CLASSES = 0x5df; // the nine Classic classes

export function openVmangos(file) {
  return new DatabaseSync(file, { readOnly: true });
}

/** The newest row at or before 1.12 for every key of a table with a `patch` column. */
export function latest(db, table, key = 'entry', patchCol = 'patch') {
  const map = new Map();
  for (const r of db.prepare(`SELECT * FROM ${table} WHERE ${patchCol} <= ? ORDER BY ${key}, ${patchCol}`).all(PATCH)) map.set(r[key], r);
  return map;
}

export const inPatch = (r) => (r.patch_min ?? 0) <= PATCH && PATCH <= (r.patch_max ?? 10);
export const round = (v, d = 2) => Math.round(v * 10 ** d) / 10 ** d;

/* ── Spells (for item effects) ─────────────────────────────────────────── */

function loadSpells(db) {
  const map = new Map();
  for (const r of db.prepare('SELECT * FROM spell_template WHERE build <= ? ORDER BY entry, build').all(CLIENT_BUILD)) map.set(r.entry, r);
  return map;
}

/* ── Zones and areas ───────────────────────────────────────────────────── */

function loadAreas(db) {
  const areas = new Map();
  for (const r of db.prepare('SELECT * FROM area_template').all()) areas.set(r.entry, r);
  const maps = latest(db, 'map_template');
  return { areas, maps };
}

/* ── Loot ──────────────────────────────────────────────────────────────── */

/**
 * Chance per item for one loot template, the way the 1.12 server rolls it: ungrouped rows roll on their own,
 * a group hands out one item (equal-chance rows share what the explicit chances leave), references are rolled
 * as many times as the row says. Returns Map(item -> { pct, quest }).
 *
 * Rows a condition gives to one team count for that team only, and the chance shown is the better team's: Onyxia,
 * for one, carries two rolls on a Horde set of tier helms and two on an Alliance set, and counting all four would make
 * each shared helm look nearly twice as likely as the two a kill really gives.
 */
function makeLootResolver(db) {
  const TEAMS = [469, 67]; // Alliance, Horde
  const teamOf = new Map(db.prepare('SELECT condition_entry, value1 FROM conditions WHERE type = 6').all().map((r) => [r.condition_entry, r.value1])); // CONDITION_TEAM
  const allowed = (r, team) => !team || !teamOf.has(r.condition_id) || teamOf.get(r.condition_id) === team;
  const tables = {};
  const rowsOf = (table) => {
    if (!tables[table]) {
      const m = new Map();
      for (const r of db.prepare(`SELECT * FROM ${table}`).all()) {
        if (!inPatch(r)) continue;
        let list = m.get(r.entry);
        if (!list) m.set(r.entry, (list = []));
        list.push(r);
      }
      tables[table] = m;
    }
    return tables[table];
  };
  const cache = new Map();
  function resolve(table, entry, team, depth = 0) {
    const key = `${table}:${entry}:${team}`;
    if (cache.has(key)) return cache.get(key);
    const out = new Map();
    const rows = rowsOf(table).get(entry) ?? [];
    const add = (item, p, quest) => {
      if (p <= 0) return;
      const was = out.get(item);
      if (was) {
        was.pct = 1 - (1 - was.pct) * (1 - p);
        was.quest = was.quest && quest;
      } else out.set(item, { pct: p, quest });
    };
    const addRef = (refEntry, p, times) => {
      if (depth > 4) return;
      for (const [item, v] of resolve('reference_loot_template', refEntry, team, depth + 1)) add(item, 1 - (1 - p * v.pct) ** Math.max(1, times), v.quest);
    };
    const groups = new Map();
    for (const r of rows) {
      if (r.groupid > 0) {
        let g = groups.get(r.groupid);
        if (!g) groups.set(r.groupid, (g = []));
        g.push(r);
        continue;
      }
      if (!allowed(r, team)) continue;
      const p = Math.abs(r.ChanceOrQuestChance) / 100;
      const quest = r.ChanceOrQuestChance < 0;
      if (r.mincountOrRef < 0) addRef(-r.mincountOrRef, p, r.maxcount);
      else add(r.item, p, quest);
    }
    for (const g of groups.values()) {
      const explicit = g.filter((r) => r.ChanceOrQuestChance !== 0);
      const equal = g.filter((r) => r.ChanceOrQuestChance === 0);
      const used = explicit.reduce((n, r) => n + Math.abs(r.ChanceOrQuestChance), 0);
      const share = equal.length ? Math.max(0, 100 - used) / equal.length : 0;
      for (const r of g) {
        if (!allowed(r, team)) continue; // still part of the roll (it shares the group), just not lootable by this team
        const p = (r.ChanceOrQuestChance === 0 ? share : Math.abs(r.ChanceOrQuestChance)) / 100;
        const quest = r.ChanceOrQuestChance < 0;
        if (r.mincountOrRef < 0) addRef(-r.mincountOrRef, p, r.maxcount);
        else add(r.item, p, quest);
      }
    }
    cache.set(key, out);
    return out;
  }
  /** Each item at the chance of the team that gets it more often (the same for both when no row is a team's). */
  function resolveBest(table, entry) {
    const byTeam = TEAMS.map((team) => resolve(table, entry, team));
    const out = new Map();
    for (const item of resolve(table, entry, 0).keys()) {
      // in the order the rows come in, so equal chances keep their order
      let best;
      for (const m of byTeam) {
        const v = m.get(item);
        if (v && (!best || v.pct > best.pct)) best = v;
      }
      if (best) out.set(item, best);
    }
    return out;
  }
  return { resolve: resolveBest, rowsOf };
}

/* ── Factions and reactions ────────────────────────────────────────────── */

function makeReaction(db) {
  const templates = new Map();
  for (const r of db.prepare('SELECT * FROM faction_template ORDER BY id, build').all()) templates.set(r.id, r);
  const PLAYER = {
    a: { mask: 1 | 2, factions: [1, 3, 4, 115] }, // any player | Alliance
    h: { mask: 1 | 4, factions: [2, 5, 6, 116] }, // any player | Horde
  };
  const ftOf = (id) => templates.get(id);
  const enemies = (ft) => [ft.enemy_faction1, ft.enemy_faction2, ft.enemy_faction3, ft.enemy_faction4].filter(Boolean);
  const friends = (ft) => [ft.friend_faction1, ft.friend_faction2, ft.friend_faction3, ft.friend_faction4].filter(Boolean);
  function react(ftId, side) {
    const ft = ftOf(ftId);
    if (!ft) return 'n';
    const p = PLAYER[side];
    if (enemies(ft).some((f) => p.factions.includes(f))) return 'h';
    if (friends(ft).some((f) => p.factions.includes(f))) return 'f';
    if (ft.hostile_mask & p.mask) return 'h';
    if (ft.friendly_mask & p.mask || ft.our_mask & p.mask) return 'f';
    return 'n';
  }
  return (ftId) => react(ftId, 'a') + react(ftId, 'h');
}

/* ── Items ─────────────────────────────────────────────────────────────── */

const STAT_KEY = { 3: 'agi', 4: 'str', 5: 'int', 6: 'spi', 7: 'sta' };
const STAT_NAME = { agi: 'Agility', str: 'Strength', int: 'Intellect', spi: 'Spirit', sta: 'Stamina' };
const RES = [
  ['holy_res', 'holres', 'Holy'],
  ['fire_res', 'firres', 'Fire'],
  ['nature_res', 'natres', 'Nature'],
  ['frost_res', 'frores', 'Frost'],
  ['shadow_res', 'shares', 'Shadow'],
  ['arcane_res', 'arcres', 'Arcane'],
];
const SCHOOL = ['Physical', 'Holy', 'Fire', 'Nature', 'Frost', 'Shadow', 'Arcane'];
const BINDING = { 1: 'Binds when picked up', 2: 'Binds when equipped', 3: 'Binds when used', 4: 'Quest Item' };
const TRIGGER = { 0: 'Use', 1: 'Equip', 2: 'Chance on hit', 5: 'Use' };
const SKILL = { 164: 'Blacksmithing', 165: 'Leatherworking', 171: 'Alchemy', 182: 'Herbalism', 185: 'Cooking', 186: 'Mining', 197: 'Tailoring', 202: 'Engineering', 333: 'Enchanting', 356: 'Fishing', 393: 'Skinning', 129: 'First Aid', 633: 'Lockpicking', 762: 'Riding' };
const REP = ['Hated', 'Hostile', 'Unfriendly', 'Neutral', 'Friendly', 'Honored', 'Revered', 'Exalted'];
const RACE_NAME = { 1: 'Human', 2: 'Orc', 4: 'Dwarf', 8: 'Night Elf', 16: 'Undead', 32: 'Tauren', 64: 'Gnome', 128: 'Troll' };

/** Names that mark developer or unused entries. */
export const JUNK = /^(Monster - |OLD|\[PH\]|Deprecated|TEST|Test |QA |zz|ZZ|Unused|NPC Equip|DEBUG|Big Blue|Dev |GM |Programmer)/;

/**
 * Quest XP as Forever pays it. Forever's client carries Blizzard's quest XP table (one row per quest level, a few
 * fixed amounts per row) and the game pays the amount nearest the old formula's value, ties to the higher one.
 * LibQuestDB reads the table from Forever's client. Adapted from nearestTier and roundXp in LibQuestDB-1.0.lua
 * (LibQuestDB by Pimptasty, MIT: see NOTICE.md).
 */
function foreverXp(xp, level, table) {
  if (!(xp > 0)) return undefined;
  const tiers = table?.get(level);
  if (!tiers?.length) return xp;
  let best = tiers[0];
  for (const t of tiers) if (Math.abs(t - xp) < Math.abs(best - xp) || (Math.abs(t - xp) === Math.abs(best - xp) && t > best)) best = t;
  // The client shows the amount rounded: to 5 up to 100, 10 up to 500, 25 up to 1000, 50 beyond.
  const v = best * 10;
  if (v <= 1000) return 5 * Math.floor((v + 20) / 50);
  if (v <= 5000) return 10 * Math.floor((v + 50) / 100);
  if (v <= 10000) return 25 * Math.floor((v + 120) / 250);
  return 50 * Math.floor((v + 250) / 500);
}

/** Developer, test and placeholder items that never reached players. */
const DEV_ITEM = /\btest\b|JEFFTEST|QATest|\[PH\]|DEPRECATED|DELETE ME|Pwnage|^(Martin (Fury|Thunder)|Stone of (Pierce|Lapidis|Goodman|Kurtz|Backus|Brownell)$|Bland Dagger$|Indalamar|Tigole|JYoo|Chows )/i;
const isDevItem = (it) => (DEV_ITEM.test(it.name) && !/^High Test /.test(it.name)) || it.item_level > 92;
/** Gear left in the database as placeholders: the "90 Epic Warrior" test sets, deprecated copies and unused items. */
const UNUSED_GEAR = /^90 (Epic|Green|Blue|Rare) |\bDEP$|\bUNUSED\b|\bPH\b|Critical Testing/;

function isGear(it) {
  return (it.class === 2 || it.class === 4) && it.quality >= 2 && it.inventory_type > 0;
}

/* ── The builder ───────────────────────────────────────────────────────── */

export function buildWorld({ db, lq, scriptedSpawns = {} }) {
  const spells = loadSpells(db);
  const { areas, maps } = loadAreas(db);
  const reaction = makeReaction(db);
  const loot = makeLootResolver(db);

  const factionNames = {};
  for (const r of db.prepare('SELECT id, name FROM faction ORDER BY id, build').all()) if (r.name) factionNames[r.id] = r.name;
  const items = latest(db, 'item_template');
  const icons = new Map(db.prepare('SELECT ID, icon FROM item_display_info').all().map((r) => [r.ID, (r.icon || '').toLowerCase()]));
  const creatures = latest(db, 'creature_template');
  const objects = latest(db, 'gameobject_template');
  const questsRaw = latest(db, 'quest_template');

  // Spawns: which creatures and objects exist in 1.12, and on which maps.
  const creatureMaps = new Map();
  for (const r of db.prepare('SELECT id, id2, id3, id4, id5, map, patch_min, patch_max FROM creature').all()) {
    if (!inPatch(r)) continue;
    for (const id of [r.id, r.id2, r.id3, r.id4, r.id5]) {
      if (!id) continue;
      let s = creatureMaps.get(id);
      if (!s) creatureMaps.set(id, (s = new Set()));
      s.add(r.map);
    }
  }
  // Raid bosses and adds the server summons by script have no spawn row: their raid comes from Grimoire's own list.
  for (const [id, map] of Object.entries(scriptedSpawns)) if (!creatureMaps.has(Number(id)) && Number.isFinite(map)) creatureMaps.set(Number(id), new Set([map]));
  const objectMaps = new Map();
  for (const r of db.prepare('SELECT id, map, patch_min, patch_max FROM gameobject').all()) {
    if (!inPatch(r)) continue;
    let s = objectMaps.get(r.id);
    if (!s) objectMaps.set(r.id, (s = new Set()));
    s.add(r.map);
  }

  // The zone of a map that is an instance; an outdoor spawn's zone comes from LibQuestDB's placements.
  const instanceZone = (mapId) => {
    const m = maps.get(mapId);
    return m && m.map_type > 0 ? m.linked_zone || 0 : 0;
  };
  // LibQuestDB files some instance spawns under the client's newer area ids (Blackrock Depths and Spire as 17803 and
  // 17804, the Sunken Temple's rooms as 1417), which no dungeon matches. An NPC that spawns in an instance belongs to
  // that instance unless LibQuestDB names an instance itself; an object (herbs and chests spawn everywhere) keeps
  // LibQuestDB's zone unless the area is one the game files do not know.
  const instanceZones = new Set([...maps.values()].filter((m) => m.map_type > 0 && m.linked_zone).map((m) => m.linked_zone));
  const zoneOf = (spawnZones, mapsOf, id, npc) => {
    const z = spawnZones.get(id);
    const top = z ? topZone(z) : 0;
    if (top && (instanceZones.has(top) || (!npc && areas.has(top)))) return top;
    const ms = mapsOf.get(id);
    if (ms) for (const m of ms) if (instanceZone(m)) return instanceZone(m);
    return top;
  };
  const topZone = (areaId) => {
    let a = areas.get(areaId);
    let guard = 0;
    while (a && a.zone_id && guard++ < 5) {
      const parent = areas.get(a.zone_id);
      if (!parent) break;
      a = parent;
    }
    return a ? a.entry : areaId;
  };

  /* Quest relations */
  const rel = (table) => {
    const m = new Map();
    for (const r of db.prepare(`SELECT * FROM ${table}`).all()) {
      if (!inPatch(r)) continue;
      let list = m.get(r.quest);
      if (!list) m.set(r.quest, (list = []));
      list.push(r.id);
    }
    return m;
  };
  const cStart = rel('creature_questrelation');
  const cEnd = rel('creature_involvedrelation');
  const oStart = rel('gameobject_questrelation');
  const oEnd = rel('gameobject_involvedrelation');
  const itemStart = new Map();
  for (const it of items.values()) if (it.start_quest) itemStart.set(it.start_quest, it.entry);
  const events = new Map(db.prepare('SELECT quest, event, patch_min FROM game_event_quest').all().filter((r) => (r.patch_min ?? 0) <= PATCH).map((r) => [r.quest, r.event]));

  /* ── Quests ── */
  const quests = [];
  const questIds = new Set();
  for (const q of questsRaw.values()) {
    const st = [...(cStart.get(q.entry) ?? []).map((id) => ['n', id]), ...(oStart.get(q.entry) ?? []).map((id) => ['o', id])];
    if (itemStart.has(q.entry)) st.push(['i', itemStart.get(q.entry)]);
    const en = [...(cEnd.get(q.entry) ?? []).map((id) => ['n', id]), ...(oEnd.get(q.entry) ?? []).map((id) => ['o', id])];
    if (!st.length && !en.length) continue; // nobody gives it: unused
    // Forever's own quest list (LibQuestDB): a quest it does not list, or marks as unobtainable or retired, is left out.
    const fq = lq.quests.get(q.entry);
    if (!fq || fq[28] === 'u' || fq[28] === 'r') continue;
    if (JUNK.test(q.Title) || /<(NYI|UNUSED|TXT)>|\[PH\]|DEPRECATED|<CHANGE/i.test(q.Title)) continue;
    const rq = [];
    for (let i = 1; i <= 4; i++) {
      const id = q[`ReqCreatureOrGOId${i}`];
      const text = q[`ObjectiveText${i}`] || null;
      if (id > 0) rq.push(['n', id, text, q[`ReqCreatureOrGOCount${i}`] || 1]);
      else if (id < 0) rq.push(['o', -id, text, q[`ReqCreatureOrGOCount${i}`] || 1]);
      else if (text) rq.push(['t', null, text, 1]);
    }
    for (let i = 1; i <= 4; i++) if (q[`ReqItemId${i}`]) rq.push(['i', q[`ReqItemId${i}`], null, q[`ReqItemCount${i}`] || 1]);
    if (q.RepObjectiveFaction) rq.push(['r', q.RepObjectiveFaction, null, q.RepObjectiveValue]);
    const races = q.RequiredRaces;
    const side = !races || (races & ALLIANCE_RACES && races & HORDE_RACES) ? 3 : races & ALLIANCE_RACES ? 1 : 2;
    const ir = [];
    const ic = [];
    const rp = [];
    for (let i = 1; i <= 4; i++) if (q[`RewItemId${i}`]) ir.push([q[`RewItemId${i}`], q[`RewItemCount${i}`] || 1]);
    for (let i = 1; i <= 6; i++) if (q[`RewChoiceItemId${i}`]) ic.push([q[`RewChoiceItemId${i}`], q[`RewChoiceItemCount${i}`] || 1]);
    for (let i = 1; i <= 5; i++) if (q[`RewRepFaction${i}`] && q[`RewRepValue${i}`]) rp.push([q[`RewRepFaction${i}`], q[`RewRepValue${i}`]]);
    const clean = (t) => (t ? t.replace(/\r/g, '').replace(/\$[Bb]/g, '\n').replace(/\$[Nn]/g, '<name>').replace(/\$[Cc]/g, '<class>').replace(/\$[Rr]/g, '<race>').replace(/\$[Gg]\s*([^:;]*):([^;]*);/g, '<$1/$2>').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim() || undefined : undefined);
    const quest = {
      i: q.entry,
      n: q.Title,
      l: q.QuestLevel > 0 ? q.QuestLevel : q.MinLevel,
      r: q.MinLevel,
      s: side,
      z: q.ZoneOrSort,
      c2: 7,
      ...(q.Type ? { ty: q.Type } : {}),
      ...(q.RequiredClasses && (q.RequiredClasses & ALL_CLASSES) !== ALL_CLASSES ? { rc: q.RequiredClasses } : {}),
      ...(q.RewXP > 0 ? { xp: foreverXp(q.RewXP, q.QuestLevel > 0 ? q.QuestLevel : q.MinLevel, lq.questXP) } : {}),
      ...(q.RewOrReqMoney > 0 ? { m: q.RewOrReqMoney } : {}),
      ...(ir.length ? { ir } : {}),
      ...(ic.length ? { ic } : {}),
      ...(rp.length ? { rp } : {}),
      ch: 'c',
      ...(clean(q.Objectives) ? { o: clean(q.Objectives) } : {}),
      ...(rq.length ? { rq } : {}),
      ...(clean(q.Details) ? { d: clean(q.Details) } : {}),
      ...(clean(q.RequestItemsText) ? { pg: clean(q.RequestItemsText) } : {}),
      ...(clean(q.OfferRewardText) ? { cp: clean(q.OfferRewardText) } : {}),
      ...(st.length ? { st } : {}),
      ...(en.length ? { en } : {}),
      ...(q.PrevQuestId ? { pv: q.PrevQuestId } : {}),
      ...(q.NextQuestInChain ? { nx: q.NextQuestInChain } : {}),
      ...(q.ExclusiveGroup ? { ex: q.ExclusiveGroup } : {}),
      ...(q.SrcItemId ? { pi: q.SrcItemId } : {}),
      ...(q.SpecialFlags & 1 ? { rep: 1 } : {}),
      ...(q.RequiredSkill ? { sk: [q.RequiredSkill, q.RequiredSkillValue] } : {}),
      ...(q.LimitTime ? { tl: q.LimitTime } : {}),
      ...(q.SuggestedPlayers > 1 ? { gp: q.SuggestedPlayers } : {}),
      ...(q.RewSpellCast || q.RewSpell ? { sp: q.RewSpellCast || q.RewSpell } : {}),
      ...(events.has(q.entry) ? { ev: events.get(q.entry) } : {}),
    };
    quests.push(quest);
    questIds.add(q.entry);
  }
  // Quest groups: continent, dungeon, raid, class, profession, battleground, event, other
  const CLASS_SORTS = new Set([-61, -81, -82, -141, -161, -162, -261, -262, -263]);
  const PROF_SORTS = new Set([-24, -101, -121, -181, -182, -201, -264, -304, -324]);
  const EVENT_SORTS = new Set([-22, -364, -366, -369, -1001, -1002, -1003, -1004, -1005, -1006, -365, -368]);
  for (const q of quests) {
    if (q.z > 0) {
      const a = areas.get(q.z);
      const m = a ? maps.get(a.map_id) : undefined;
      q.c2 = !a ? 7 : a.map_id === 0 ? 0 : a.map_id === 1 ? 1 : m?.map_type === 2 ? 3 : m?.map_type === 3 ? 6 : m?.map_type === 1 ? 2 : 7;
    } else if (CLASS_SORTS.has(q.z)) q.c2 = 4;
    else if (PROF_SORTS.has(q.z)) q.c2 = 5;
    else if (q.z === -25) q.c2 = 6;
    else if (EVENT_SORTS.has(q.z) || q.ev) q.c2 = 9;
    else q.c2 = 7;
  }

  // Forever's own new quests (LibQuestDB, collected in game): title, level, group size and objectives only.
  let foreverNew = 0;
  for (const [id, row] of lq.harvest) {
    if (questIds.has(id)) continue;
    const text = lq.harvestText.get(id) ?? [];
    const title = text[0];
    if (!title) continue;
    const level = Number(row[1]) || 0;
    const players = Number(row[27]) || 0;
    const objectives = (text[2] || '').trim();
    const lines = text.slice(6, 10).map((t) => (t || '').trim()).filter(Boolean);
    quests.push({
      i: id,
      n: title,
      l: level,
      r: 0,
      s: 0, // faction not known: the client walk does not record it
      z: 0,
      c2: -2,
      ch: 'n',
      ...(objectives ? { o: objectives } : {}),
      ...(lines.length ? { rq: lines.map((t) => ['t', null, t, 1]) } : {}),
      ...(players > 1 ? { gp: players } : {}),
    });
    questIds.add(id);
    foreverNew++;
  }
  quests.sort((a, b) => a.i - b.i);

  /* ── Loot ── */
  const dropMap = new Map(); // item -> sources
  const addDrop = (item, src) => {
    let list = dropMap.get(item);
    if (!list) dropMap.set(item, (list = []));
    list.push(src);
  };
  const npcLoot = {};
  // Bosses and elites are often summoned by a script rather than spawned, so they count without a spawn.
  const exists = (c) => creatureMaps.has(c.entry) || (c.rank >= 1 && c.level_min > 1 && !JUNK.test(c.name));
  for (const c of creatures.values()) {
    if (!exists(c)) continue;
    if (c.loot_id) {
      const rows = [];
      for (const [item, v] of loot.resolve('creature_loot_template', c.loot_id)) {
        const pct = round(v.pct * 100, v.pct < 0.0001 ? 4 : 2);
        if (pct <= 0) continue;
        addDrop(item, ['n', c.entry, pct, v.quest ? 1 : 0]);
        rows.push([item, pct, v.quest ? 1 : 0]);
      }
      rows.sort((a, b) => b[1] - a[1]);
      if (rows.length) npcLoot[c.entry] = rows.slice(0, 40);
    }
    if (c.pickpocket_loot_id) for (const [item, v] of loot.resolve('pickpocketing_loot_template', c.pickpocket_loot_id)) addDrop(item, ['p', c.entry, round(v.pct * 100), 0]);
    if (c.skinning_loot_id) for (const [item, v] of loot.resolve('skinning_loot_template', c.skinning_loot_id)) addDrop(item, ['s', c.entry, round(v.pct * 100), 0]);
  }
  for (const o of objects.values()) {
    if (!objectMaps.has(o.entry) && o.type !== 3) continue; // boss chests appear by script
    if ((o.type === 3 || o.type === 25) && o.data1) for (const [item, v] of loot.resolve('gameobject_loot_template', o.data1)) addDrop(item, ['o', o.entry, round(v.pct * 100), v.quest ? 1 : 0]);
  }
  for (const it of items.values()) {
    if (!loot.rowsOf('item_loot_template').has(it.entry)) continue;
    for (const [item, v] of loot.resolve('item_loot_template', it.entry)) addDrop(item, ['i', it.entry, round(v.pct * 100), 0]);
  }
  for (const zone of loot.rowsOf('fishing_loot_template').keys()) for (const [item, v] of loot.resolve('fishing_loot_template', zone)) addDrop(item, ['f', zone, round(v.pct * 100), 0]);
  const drops = {};
  for (const [item, list] of dropMap) {
    const shown = list.filter((s) => s[2] >= 0.01).sort((a, b) => b[2] - a[2]);
    if (!shown.length) continue;
    drops[item] = { t: list.length, s: shown.slice(0, 25) };
  }

  /* ── Vendors ── */
  const vendorMap = new Map();
  const vendorTemplates = new Map();
  for (const r of db.prepare('SELECT entry, item FROM npc_vendor_template').all()) {
    let s = vendorTemplates.get(r.entry);
    if (!s) vendorTemplates.set(r.entry, (s = []));
    s.push(r.item);
  }
  const addVendor = (item, npc) => {
    let s = vendorMap.get(item);
    if (!s) vendorMap.set(item, (s = new Set()));
    s.add(npc);
  };
  for (const r of db.prepare('SELECT entry, item FROM npc_vendor').all()) if (creatures.has(r.entry) && creatureMaps.has(r.entry)) addVendor(r.item, r.entry);
  for (const c of creatures.values()) if (c.vendor_id && creatureMaps.has(c.entry)) for (const item of vendorTemplates.get(c.vendor_id) ?? []) addVendor(item, c.entry);
  const vendors = {};
  for (const [item, s] of vendorMap) vendors[item] = [...s].sort((a, b) => a - b).slice(0, 12);

  /* ── Crafted items: spells that create an item, and the profession that teaches them ── */
  const craftedBy = new Map(); // item -> skill id
  const spellSkill = new Map();
  for (const r of db.prepare('SELECT spell_id, skill_id FROM skill_line_ability').all()) if (SKILL[r.skill_id]) spellSkill.set(r.spell_id, r.skill_id);
  for (const sp of spells.values()) {
    for (let n = 1; n <= 3; n++) {
      if (sp[`effect${n}`] === 24 && sp[`effectItemType${n}`] && spellSkill.has(sp.entry)) craftedBy.set(sp[`effectItemType${n}`], spellSkill.get(sp.entry));
    }
  }

  /* ── NPC and object records ── */
  const usedNpcs = new Set();
  const usedObjects = new Set();
  for (const q of quests) {
    for (const [k, id] of q.st ?? []) (k === 'n' ? usedNpcs : k === 'o' ? usedObjects : new Set()).add(id);
    for (const [k, id] of q.en ?? []) (k === 'n' ? usedNpcs : usedObjects).add(id);
    for (const r of q.rq ?? []) if (r[0] === 'n') usedNpcs.add(r[1]);
    else if (r[0] === 'o') usedObjects.add(r[1]);
  }
  for (const list of Object.values(drops)) for (const s of list.s) if (s[0] === 'n' || s[0] === 'p' || s[0] === 's') usedNpcs.add(s[1]);
  else if (s[0] === 'o') usedObjects.add(s[1]);
  for (const id of Object.keys(npcLoot)) usedNpcs.add(Number(id));
  for (const list of Object.values(vendors)) for (const id of list) usedNpcs.add(id);
  for (const c of creatures.values()) if (creatureMaps.has(c.entry) && (c.rank >= 1 || c.npc_flags)) usedNpcs.add(c.entry);
  for (const id of Object.keys(npcLoot)) usedNpcs.add(Number(id));

  const npcs = {};
  for (const id of [...usedNpcs].sort((a, b) => a - b)) {
    const c = creatures.get(id);
    if (!c || JUNK.test(c.name)) continue;
    npcs[id] = [c.name, c.subname || '', c.level_min, c.level_max, c.rank, reaction(c.faction), zoneOf(lq.npcZones, creatureMaps, id, true), c.npc_flags, c.type];
  }
  const objectsOut = {};
  for (const id of [...usedObjects].sort((a, b) => a - b)) {
    const o = objects.get(id);
    if (!o || !o.name) continue;
    objectsOut[id] = [o.name, zoneOf(lq.objectZones, objectMaps, id, false), o.type];
  }
  // Drop sources and loot only where the NPC or object has a record
  for (const [item, d] of Object.entries(drops)) {
    d.s = d.s.filter((s) => (s[0] === 'o' ? objectsOut[s[1]] : s[0] === 'i' || s[0] === 'f' ? true : npcs[s[1]]));
    if (!d.s.length) delete drops[item];
  }

  /* ── Items ── */
  // Classic raids that are not among Forever's launch raids (Onyxia's Lair opens with Hyjal Summit and the Barrow Deeps).
  const LAUNCH_RAID_MAPS = new Set([249]);
  const laterRaidMaps = new Set([...maps.values()].filter((m) => m.map_type === 2 && !LAUNCH_RAID_MAPS.has(m.entry)).map((m) => m.entry));
  const laterRaidZones = new Set([...areas.values()].filter((a) => laterRaidMaps.has(a.map_id)).map((a) => a.entry));
  const inLaterRaid = (kind, id) => {
    const where = kind === 'o' ? objectMaps.get(id) : kind === 'n' ? creatureMaps.get(id) : undefined;
    if (where?.size) return [...where].every((m) => laterRaidMaps.has(m));
    const zone = kind === 'o' ? objectsOut[id]?.[1] : kind === 'n' ? npcs[id]?.[6] : 0;
    return laterRaidZones.has(zone);
  };
  const questReward = new Map();
  for (const q of quests) for (const [id] of [...(q.ir ?? []), ...(q.ic ?? [])]) if (!questReward.has(id)) questReward.set(id, q);
  const itemsOut = [];
  const minor = {};
  for (const it of items.values()) {
    if (!it.name || JUNK.test(it.name) || isDevItem(it)) continue;
    if (!isGear(it)) {
      minor[it.entry] = [it.name, it.quality, icons.get(it.display_id) || 'inv_misc_questionmark', it.class, it.subclass, it.item_level, it.required_level, it.buy_price, it.stackable, it.start_quest || 0];
      continue;
    }
    if (UNUSED_GEAR.test(it.name)) continue;
    const st = {};
    const wl = [];
    for (let n = 1; n <= 10; n++) {
      const key = STAT_KEY[it[`stat_type${n}`]];
      const v = it[`stat_value${n}`];
      if (!key || !v) continue;
      st[key] = (st[key] ?? 0) + v;
    }
    for (const [k, v] of Object.entries(st)) wl.push(`${v > 0 ? '+' : ''}${v} ${STAT_NAME[k]}`);
    for (const [col, key, name] of RES) {
      if (!it[col]) continue;
      st[key] = it[col];
      wl.push(`+${it[col]} ${name} Resistance`);
    }
    if (it.block) wl.unshift(`${it.block} Block`);
    let w;
    if (it.class === 2 && it.dmg_max1 > 0 && it.delay > 0) {
      const speed = it.delay / 1000;
      let min = it.dmg_min1;
      let max = it.dmg_max1;
      for (let n = 2; n <= 5; n++) {
        if (!it[`dmg_max${n}`]) continue;
        wl.unshift(`+ ${Math.round(it[`dmg_min${n}`])} - ${Math.round(it[`dmg_max${n}`])} ${SCHOOL[it[`dmg_type${n}`]] ?? ''} Damage`.replace(/\s+Damage$/, ' Damage'));
        min += it[`dmg_min${n}`];
        max += it[`dmg_max${n}`];
      }
      w = [Math.round(it.dmg_min1), Math.round(it.dmg_max1), round(speed, 2), round((min + max) / 2 / speed, 1), it.dmg_type1];
    }
    const fx = [];
    for (let n = 1; n <= 5; n++) {
      const sid = it[`spellid_${n}`];
      const trig = it[`spelltrigger_${n}`];
      if (!sid || !(trig in TRIGGER)) continue;
      const sp = spells.get(sid);
      if (!sp) continue;
      const text = spellText(sp.description, sp, spells);
      if (text) fx.push(`${TRIGGER[trig]}: ${text}`);
      const charges = Math.abs(it[`spellcharges_${n}`] || 0);
      if (charges) fx.push(`${charges} Charge${charges === 1 ? '' : 's'}`);
    }
    // Where it comes from
    const src = new Set();
    const sm = [];
    const d = drops[it.entry];
    const q = questReward.get(it.entry);
    if (craftedBy.has(it.entry)) {
      src.add(1);
      sm.push({ t: 6, s: craftedBy.get(it.entry) });
    }
    if (d) {
      src.add(2);
      const top = d.s[0];
      if (top[0] === 'n' || top[0] === 'p' || top[0] === 's') {
        const n = npcs[top[1]];
        sm.push({ t: 1, id: top[1], n: n?.[0], z: n?.[6] || undefined, ...(n?.[4] === 3 ? { bd: 1 } : {}) });
      } else if (top[0] === 'o') {
        const o = objectsOut[top[1]];
        sm.push({ t: 2, id: top[1], n: o?.[0], z: o?.[1] || undefined });
      } else if (top[0] === 'i') {
        sm.push({ t: 3, id: top[1], n: items.get(top[1])?.name });
      }
    }
    if (q) {
      src.add(4);
      sm.push({ t: 5, id: q.i, n: q.n, z: q.z > 0 ? q.z : undefined });
    }
    if (vendors[it.entry]) {
      src.add(5);
      if (!d) {
        const n = npcs[vendors[it.entry][0]];
        sm.push({ t: 1, id: vendors[it.entry][0], n: n?.[0], z: n?.[6] || undefined });
      }
    }
    if (it.required_honor_rank) src.add(3);
    // Loot of a Classic raid that is not among Forever's launch raids: every drop source is there and any quest that
    // rewards it is given there. Crafted, sold and PvP items always count as available.
    const dropRaid = d ? d.s.every((s) => (s[0] === 'n' || s[0] === 'o') && inLaterRaid(s[0], s[1])) : undefined;
    const questRaid = q ? laterRaidZones.has(q.z) : undefined;
    const inRaid = !src.has(1) && !src.has(3) && !src.has(5) && (dropRaid !== undefined || questRaid !== undefined) && dropRaid !== false && questRaid !== false;
    const rq = [];
    if (it.required_skill && SKILL[it.required_skill]) rq.push(`Requires ${SKILL[it.required_skill]} (${it.required_skill_rank})`);
    if (it.required_reputation_faction) rq.push(`Requires ${factionNames[it.required_reputation_faction] ?? 'a faction'} - ${REP[it.required_reputation_rank] ?? 'Friendly'}`);
    if (it.required_honor_rank) rq.push(`Requires rank ${it.required_honor_rank}`);
    const raceMask = it.allowable_race > 0 ? it.allowable_race & 0xff : 0;
    const raceNames = raceMask && raceMask !== 0xff ? Object.entries(RACE_NAME).filter(([bit]) => raceMask & Number(bit)).map(([, n]) => n) : [];
    const side = raceNames.length ? (raceMask & ALLIANCE_RACES && !(raceMask & HORDE_RACES) ? 1 : raceMask & HORDE_RACES && !(raceMask & ALLIANCE_RACES) ? 2 : undefined) : undefined;
    const classMask = it.allowable_class > 0 && (it.allowable_class & ALL_CLASSES) !== ALL_CLASSES ? it.allowable_class & ALL_CLASSES : 0;
    itemsOut.push({
      i: it.entry,
      n: it.name,
      q: it.quality,
      l: it.item_level,
      r: it.required_level,
      s: it.inventory_type,
      c: it.class,
      sc: it.subclass,
      ic: icons.get(it.display_id) || 'inv_misc_questionmark',
      ...(Object.keys(st).length ? { st } : {}),
      ...(it.armor ? { ar: it.armor } : {}),
      ...(w ? { w } : {}),
      ...(it.max_durability ? { du: it.max_durability } : {}),
      ...(it.sell_price ? { sell: it.sell_price } : {}),
      ...(src.size ? { src: [...src].sort((a, b) => a - b) } : {}),
      ...(sm.length ? { sm } : {}),
      ...(it.set_id ? { set: it.set_id } : {}),
      ...(classMask ? { cls: classMask } : {}),
      ...(side ? { side } : {}),
      ...(raceNames.length && !side ? { races: raceNames.join(', ') } : {}),
      ...(it.max_count === 1 ? { u: 'Unique', uq: 1 } : it.max_count > 1 ? { u: `Unique (${it.max_count})`, uq: it.max_count } : {}),
      ...(it.required_reputation_faction ? { rep: [it.required_reputation_faction, it.required_reputation_rank] } : {}),
      ...(it.required_skill ? { sk: [it.required_skill, it.required_skill_rank] } : {}),
      ...(it.container_slots ? { bag: it.container_slots } : {}),
      ...(fx.length ? { fx } : {}),
      ...(BINDING[it.bonding] ? { b: BINDING[it.bonding] } : {}),
      ...(it.description ? { f: it.description } : {}),
      ...(wl.length ? { wl } : {}),
      ...(rq.length ? { rq } : {}),
      ...(it.start_quest ? { bq: 1 } : {}),
      ...(it.required_level ? {} : { nr: 1 }),
      av: inRaid ? 'r' : src.size ? 'c' : 'e',
    });
  }
  itemsOut.sort((a, b) => a.i - b.i);

  // Items made by using another item: Sulfuras from the Eye of Sulfuras, the Zandalar charms from the Punctured Voodoo
  // Dolls, Benediction from the Splinter of Nordrassil. Each way to make one lists the item used and the spell's reagents;
  // the item can be had when everything one way needs can be had.
  const recipes = new Map(); // item -> [[item used, ...reagents]]
  for (const it of items.values()) {
    if (!it.name || isDevItem(it) || UNUSED_GEAR.test(it.name)) continue;
    for (let n = 1; n <= 5; n++) {
      if (it[`spelltrigger_${n}`] !== 0 || !it[`spellid_${n}`]) continue;
      const sp = spells.get(it[`spellid_${n}`]);
      if (!sp) continue;
      const reagents = [];
      for (let k = 1; k <= 8; k++) if (sp[`reagent${k}`] > 0 && sp[`reagent${k}`] !== it.entry) reagents.push(sp[`reagent${k}`]);
      for (let k = 1; k <= 3; k++) {
        const made = sp[`effectItemType${k}`];
        // 24 creates an item; 34 turns the used item into another (Benediction into Anathema).
        if ((sp[`effect${k}`] !== 24 && sp[`effect${k}`] !== 34) || !made || made === it.entry) continue;
        let list = recipes.get(made);
        if (!list) recipes.set(made, (list = []));
        list.push([it.entry, ...reagents]);
      }
    }
  }
  const gearById = new Map(itemsOut.map((x) => [x.i, x]));
  const sourceCodes = (id) => {
    const g = gearById.get(id);
    if (g) return g.av === 'e' ? [] : (g.src ?? []);
    const codes = [];
    if (craftedBy.has(id)) codes.push(1);
    if (drops[id]?.s.length) codes.push(2);
    if (questReward.has(id)) codes.push(4);
    if (vendors[id]) codes.push(5);
    return codes;
  };
  const usable = (id) => (recipes.get(id) ?? []).filter((r) => r.every((x) => sourceCodes(x).length));
  const onlyMade = new Set(); // items whose one source is another item
  // The ways to make an item down to things that drop, are sold, crafted or rewarded: a way that loops back to the item
  // itself (Benediction from Anathema, made from Benediction) does not count.
  const baseWays = (id, seen = new Set([id])) => {
    const out = [];
    for (const r of usable(id)) {
      let partial = [[]];
      for (const x of r) {
        if (!onlyMade.has(x)) {
          partial = partial.map((p) => [...p, x]);
          continue;
        }
        const sub = seen.has(x) ? [] : baseWays(x, new Set([...seen, x]));
        partial = partial.flatMap((p) => sub.map((w) => [...p, ...w]));
        if (!partial.length) break;
      }
      out.push(...partial);
    }
    return out;
  };
  for (let pass = 0; pass < 8; pass++) {
    let grew = false;
    for (const x of itemsOut) {
      if (x.av !== 'e') continue;
      const ways = usable(x.i);
      if (!ways.length) continue;
      x.av = 'c';
      x.src = [...new Set(ways.flatMap((r) => sourceCodes(r[0])))].sort((a, b) => a - b);
      x.sm = [{ t: 7, id: ways[0][0], n: items.get(ways[0][0])?.name }];
      onlyMade.add(x.i);
      grew = true;
    }
    if (!grew) break;
  }

  /* ── Zones ── */
  const questsByZone = new Map();
  for (const q of quests) if (q.z > 0 && q.ch === 'c') {
    let list = questsByZone.get(q.z);
    if (!list) questsByZone.set(q.z, (list = []));
    list.push(q);
  }
  const reqLevel = new Map();
  for (const r of db.prepare('SELECT * FROM areatrigger_teleport').all()) {
    if (r.required_level && (!reqLevel.has(r.target_map) || reqLevel.get(r.target_map) > r.required_level)) reqLevel.set(r.target_map, r.required_level);
  }
  const territory = (a) => (a.team === 2 ? 0 : a.team === 4 ? 1 : a.team === 6 ? 3 : 2);
  const zones = [];
  const zoneNames = {};
  for (const a of areas.values()) if (!a.zone_id && a.name) zoneNames[a.entry] = a.name;
  const pct = (list, p) => list[Math.min(list.length - 1, Math.max(0, Math.floor(p * (list.length - 1))))];
  // The zone of every instance map: the map's linked zone, else the top-level area drawn on that map.
  const instanceArea = new Map();
  for (const m of maps.values()) {
    if (!(m.map_type > 0)) continue;
    let zoneId = m.linked_zone;
    if (!zoneId) {
      const candidates = [...areas.values()].filter((a) => a.map_id === m.entry && !a.zone_id && a.name);
      candidates.sort((x, y) => (questsByZone.get(y.entry)?.length ?? 0) - (questsByZone.get(x.entry)?.length ?? 0) || x.entry - y.entry);
      zoneId = candidates[0]?.entry;
    }
    if (zoneId && areas.has(zoneId)) instanceArea.set(zoneId, m);
  }
  // Creatures by instance map, for an instance's level range.
  const creatureLevelsByMap = new Map();
  for (const [id, ms] of creatureMaps) {
    const c = creatures.get(id);
    if (!c || c.level_min < 2 || c.rank === 3) continue;
    for (const mapId of ms) {
      let list = creatureLevelsByMap.get(mapId);
      if (!list) creatureLevelsByMap.set(mapId, (list = []));
      list.push(c.level_min, c.level_max);
    }
  }
  const npcsInZone = new Map();
  const mobLevels = new Map(); // outdoor zone -> levels of the ordinary hostile creatures placed there
  for (const n of Object.values(npcs)) {
    if (!n[6]) continue;
    npcsInZone.set(n[6], (npcsInZone.get(n[6]) ?? 0) + 1);
    if (n[4] !== 0 || n[8] === 8 || !n[5].includes('h') || n[2] < 1) continue;
    let list = mobLevels.get(n[6]);
    if (!list) mobLevels.set(n[6], (list = []));
    list.push(n[2], n[3]);
  }
  const DEV_ZONE = /GM Island|Programmer|Designer|Test|Development|Unused|Monastery Interior|\bOLD\b/i;
  for (const a of areas.values()) {
    if (a.zone_id || !a.name || DEV_ZONE.test(a.name)) continue;
    const m = instanceArea.get(a.entry);
    const outdoor = !m && (a.map_id === 0 || a.map_id === 1);
    if (!m && !outdoor) continue;
    if (m && m.patch > PATCH) continue;
    const qs = (questsByZone.get(a.entry) ?? []).filter((q) => q.l > 0 && !q.ev);
    if (outdoor && !qs.length && (npcsInZone.get(a.entry) ?? 0) < 20) continue; // an empty or developer zone
    let lo = 0;
    let hi = 0;
    if (m && !creatureLevelsByMap.has(m.entry)) continue; // an instance nothing spawns in
    if (!m && qs.length >= 5) {
      // Outdoors, the levels of the zone's own quests say best where people level there.
      const levels = qs.map((q) => q.l).sort((x, y) => x - y);
      lo = levels[0] <= 2 ? 1 : pct(levels, 0.1);
      hi = pct(levels, 0.85);
    } else {
      const levels = [...(m ? creatureLevelsByMap.get(m.entry) : (mobLevels.get(a.entry) ?? []))];
      if (levels.length >= 6) {
        levels.sort((x, y) => x - y);
        lo = Math.max(1, pct(levels, 0.08));
        hi = pct(levels, 0.92);
      }
    }
    const inst = !m ? 0 : m.map_type === 1 ? 2 : m.map_type === 2 ? 3 : 4;
    zones.push({
      id: a.entry,
      n: a.name,
      cat: !m ? a.map_id : inst === 2 ? 2 : inst === 3 ? 3 : 6,
      inst,
      lo,
      hi,
      req: m ? reqLevel.get(m.entry) ?? 0 : 0,
      np: !m ? 0 : m.map_type === 1 ? 5 : m.player_limit || 5,
      t: territory(a),
      st: 'same',
    });
  }

  /* ── Factions ── */
  const factions = {};
  for (const r of db.prepare('SELECT * FROM faction ORDER BY id, build').all()) {
    if (r.reputation_list_id < 0 || !r.name) continue;
    factions[r.id] = { n: r.name, side: r.team === 469 ? 1 : r.team === 67 ? 2 : 0, new: false };
  }

  // Items that only come out of the raids not at launch, directly or through quests that need such items (Atiesh, for
  // one, is a quest reward made from splinters that drop in Naxxramas).
  const later = new Set(itemsOut.filter((x) => x.av === 'r').map((x) => x.i));
  for (const it of items.values()) {
    const id = it.entry;
    const d = drops[id];
    if (vendors[id] || craftedBy.has(id) || questReward.has(id) || !d?.s.length) continue;
    if (d.s.every((src) => (src[0] === 'n' || src[0] === 'o') && inLaterRaid(src[0], src[1]))) later.add(id);
  }
  const rewardedBy = new Map();
  for (const q of quests) for (const [id] of [...(q.ir ?? []), ...(q.ic ?? [])]) rewardedBy.set(id, [...(rewardedBy.get(id) ?? []), q]);
  // A quest belongs to those raids when it needs one of their items or follows a quest that does.
  const laterQuests = new Set();
  for (let pass = 0; pass < 12; pass++) {
    let grew = false;
    for (const q of quests) {
      if (laterQuests.has(q.i)) continue;
      if ((q.rq ?? []).some((r) => r[0] === 'i' && later.has(r[1])) || (q.pv > 0 && laterQuests.has(q.pv))) {
        laterQuests.add(q.i);
        grew = true;
      }
    }
    for (const [id, qs] of rewardedBy) {
      if (later.has(id) || vendors[id] || craftedBy.has(id)) continue;
      if (qs.every((q) => laterQuests.has(q.i))) {
        later.add(id);
        grew = true;
      }
    }
    // Made with an item that only those raids give (Sulfuras from the Eye of Sulfuras).
    for (const id of onlyMade) {
      if (later.has(id)) continue;
      const ways = baseWays(id);
      if (ways.length && ways.every((r) => r.some((x) => later.has(x)))) {
        later.add(id);
        grew = true;
      }
    }
    if (!grew) break;
  }
  for (const x of itemsOut) if (x.av === 'c' && later.has(x.i)) x.av = 'r';

  // Drop lists only for items the site has (developer and junk items are left out above).
  const shown = new Set(itemsOut.map((x) => x.i));
  for (const id of Object.keys(drops)) if (!shown.has(Number(id)) && !minor[id]) delete drops[id];
  return { items: itemsOut, minor, quests, npcs, objects: objectsOut, drops, npcLoot, vendors, zones, zoneNames, factions, foreverNew, creatures, maps, areas, loot, spells, itemTemplates: items, objectTemplates: objects, reaction };
}
