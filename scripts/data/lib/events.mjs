// Scripted quest objectives: what a quest needs that its own kill and collect rows do not say, and where it is done.
//
// Many quests are completed by a scripted event rather than by kill or collect objectives: talking to someone, using
// an object, reaching a place, escorting someone, using the quest's own item on a creature or at an object (the
// hunter's Taming Rod, the Winterhoof Cleansing Totem). Others ask for an item nothing drops, because the player makes
// it with another item at a place (filling the Crystal Phial at a moonwell), or for a creature, or an item it drops,
// that only appears when something calls it up (the warlock's summoned voidwalker). Their quest rows say nothing about
// it, so a route built from the rows alone would accept such a quest and hand it in on the spot, or never find the
// creature or the item. Everything here is worked out from the VMaNGOS world database (GPL-2.0-or-later; facts only)
// and from Grimoire's own hand-written table, static/quest-events.json, which also cites, as facts, which creature or
// object a VMaNGOS core script completes a quest with.
//
// questEvents({ db, quests }) returns Map(questId -> { how, objectives, giver?, ender? }) for every quest of the
// leveling set that needs it, where each objective is
//
//   { kind: 'talk'|'use'|'explore'|'escort'|'item'|'kill', npc?, object?, item?, points: [{ map, x, y }], text, rq? }
//
// in the order they must be done. points are world positions (VMaNGOS spawns, area triggers, waypoints, the positions
// scripts put what they call up) in the open world (Eastern Kingdoms and Kalimdor), at most MAX_POINTS of them, the
// ones nearest the quest giver first, and none much farther than the nearest (the same object elsewhere is often the
// other faction's). rq, when present, is the index of the quest's own row (quests.json `rq`) the objective stands for:
// that row is not a plain kill, use or collect (a summoned creature, an item made with the quest's item, a creature
// that only gives credit), so the route should do this objective instead of the row. Rows no objective stands for keep
// their usual meaning. An objective with an item but no rq is a step to get or make that item (the quest uses it but
// does not list it, or lists it as a source item). giver and ender, when present, are { npc | object, points }: where
// to meet a giver or ender that has no spawn of its own (a spirit a script calls up), or that only offers the quest at
// one spot of its walk (the Gizelton caravan). objectives can then be empty, when only that placement was missing.
//
// The quests covered are the leveling set (continent quests and class quests, without professions, events,
// repeatables, reputation work, dungeons and raids) that are completed by an event (SpecialFlags 2), have an objective
// with only a text, hand out an item they also ask back, ask for an item that nothing in the open world drops, ask for
// a creature (or its drop) that has no open-world spawn, have a giver or ender with no spawn, or are class quests up
// to level 60 whose rows cannot be done as written. A quest that needs something this module cannot place is left out
// of the map (resolveQuestEvents lists it, with the reason), so the route can leave it out too.
//
// How each quest is resolved, the first that works (`how` says which, joined by + when rows needed their own):
//   static        static/quest-events.json, checked first: hand-written, it also overrides a method that gets a quest wrong
//   areatrigger   areatrigger_involvedrelation: reach a place
//   gossip        a gossip menu or option whose script completes the quest: talk to whoever has that menu
//   gameobject    gameobject_scripts (keyed by spawn) that complete the quest: use that object
//   event         event_scripts that complete the quest: the object that sends the event, or the item whose spell does
//   creature_ai   creature_ai_scripts that complete the quest: kill (on death), defeat (at low health) or emote at a creature
//   quest-start   the quest's own start script completes it after a while: wait by the quest giver
//   escort        the giver walks a path (script_waypoint, or a scripted map event won at a waypoint): escort it to the end
//   item-spell    a spell that completes the quest, or summons or credits what a row asks for, is cast by an item of the
//                 quest: use it on its target creature or object, or at the object its spell needs nearby (spell focus)
//   item-create   an item a row asks for is made by a spell of an item the player has for the quest (CREATE_ITEM):
//                 use that item where its spell needs to be, or combine it with the other parts anywhere
//   summon        a creature a row asks for (or the only one that drops its item) has no open-world spawn: what calls it
//                 up (a quest item used at its place or on a creature that turns into it, an object, a creature killed, a
//                 gossip, a quest taken alongside and turned in, the giver's own start script or walk), then the fight,
//                 where the script puts it; also a giver or ender placed where a script calls it up
//   container     an item a row asks for comes inside another item the player has or finds: open it (with the key the
//                 quest asks for, when it is locked)
//   vendor        an item a row asks for is only sold: buy it
//   pickpocket    an item a row asks for is only in a creature's pockets (a rogue's quest)
// Script rows reach the quest through START_SCRIPT, CAST_SPELL and the success script of a scripted map event as well.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PATCH = 10; // VMaNGOS patch 10 = 1.12
const BUILD = 5875; // client build 1.12.1
const OPEN_MAPS = new Set([0, 1]); // Eastern Kingdoms, Kalimdor
const MAX_POINTS = 12;
const MERGE = 5; // yards: points this close are one
const FAR = 1500; // yards: points farther than the nearest by this much (and by twice its distance) are left out
const NEAR = 250; // yards: a script's position this close to the quest giver is where the giver stands
const LEVEL_CAP = 60;
const CHAIN_DEPTH = 12; // quests back along a chain whose items the player still holds

const SCRIPT_TABLES = [
  'gossip_scripts',
  'gameobject_scripts',
  'event_scripts',
  'creature_ai_scripts',
  'quest_start_scripts',
  'quest_end_scripts',
  'generic_scripts',
  'spell_scripts',
  'creature_movement_scripts',
  'areatrigger_scripts',
];
// Script commands (VMaNGOS ScriptCommands)
const CMD = {
  questExplored: 7,
  killCredit: 8,
  summonCreature: 10,
  castSpell: 15,
  updateEntry: 27,
  createItem: 17,
  startScript: 39,
  startMapEvent: 61,
  endMapEvent: 62,
  startScriptForAll: 68,
  editMapEvent: 69,
  summonObject: 76,
  questCredit: 83,
};
// Spell effects
const EFFECT = { dummy: 3, questComplete: 16, createItem: 24, summon: 28, openLock: 33, summonWild: 41, summonGuardian: 42, sendEvent: 61, triggerSpell: 64, scriptEffect: 77 };
const AURA_CHANNEL_DEATH_ITEM = 86;
// Condition types (VMaNGOS ConditionType)
const COND = { and: -1, item: 23, nearbyCreature: 20 };
// Creature AI event types
const AI = { hp: 2, death: 6, spellHit: 8, oocLos: 10, receiveEmote: 22 };
const EMOTES = { 78: 'salute', 61: 'lay down' }; // text emotes the scripts answer (TextEmotes ids)
const HUMANOID = 7; // creature type
// Quest groups that are not leveling (quests.json c2): dungeon, raid, profession, battleground, other, event
const NOT_LEVELING = new Set([2, 3, 5, 6, 7, 9]);
const SOURCE_TABLE = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'static', 'quest-events.json');

/* ── Small helpers ────────────────────────────────────────────────────── */

const push = (map, key, value) => {
  let list = map.get(key);
  if (!list) map.set(key, (list = []));
  list.push(value);
  return list;
};
const round1 = (v) => Math.round(v * 10) / 10;
const levelOf = (q) => (q.l > 0 ? q.l : q.r);
const fieldsOf = (row, prefix, n) => Array.from({ length: n }, (_, k) => row[`${prefix}${k + 1}`]).filter(Boolean);

/** Quest text cleaned of the client's markup. */
function clean(text) {
  return String(text ?? '')
    .replace(/\r/g, '')
    .replace(/\$[Bb]/g, '\n')
    .replace(/\$[Nn]/g, '<name>')
    .replace(/\$[Cc]/g, '<class>')
    .replace(/\$[Rr]/g, '<race>')
    .replace(/\$[Gg]\s*([^:;]*):([^;]*);/g, '$1')
    .trim();
}

/** The first thing a quest's objective text asks, without the hand-in ("..., then return to X"). */
function firstClause(text) {
  let s = clean(text).split(/\n+/)[0] ?? '';
  s = s.split(/(?<=[.!?])\s+(?=[A-Z])/)[0];
  s = s
    .replace(/,?\s*(and\s+)?then\s+(return|report|speak|talk|go back|inform|tell|seek out|bring|take|deliver|head back)\b.*$/i, '')
    .replace(/,?\s+and\s+(return|report|tell|bring|take|deliver)\b.*$/i, '')
    .replace(/,?\s+before\s+returning\b.*$/i, '')
    .replace(/[.!\s]+$/, '');
  return s;
}

/** An object's name as the guide shows it: spell focus objects are named for the place they mark. */
function placeName(name) {
  return String(name)
    .replace(/\s*\((DND|dnd)\)\s*/g, ' ')
    .replace(/\s+(Spell\s+)?Focus(\s+\d+)?\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
/** "the X", unless X is a possessive or already has an article ("The Forgotten Pools" reads "the Forgotten Pools"). */
function the(name) {
  if (/^the\s/i.test(name)) return `the ${name.slice(4)}`;
  if (/^(a|an)\s/i.test(name)) return name.replace(/^A/, 'a');
  if (/'s\b|s'(\s|$)/.test(name)) return name; // "Dogran's Pendant", "Nathanos' Chest"
  return `the ${name}`;
}
const aOrAn = (name) => (/^[aeiou]/i.test(name) ? `an ${name}` : `a ${name}`);

/* ── The database ─────────────────────────────────────────────────────── */

function load(db) {
  const all = (sql, ...args) => db.prepare(sql).all(...args);
  const latest = (sql) => {
    const map = new Map();
    for (const r of all(sql, PATCH)) map.set(r.entry, r);
    return map;
  };
  const inPatch = (r) => (r.patch_min ?? 0) <= PATCH && PATCH <= (r.patch_max ?? PATCH);

  // Quests: the row with the highest patch of each entry.
  const quests = new Map();
  for (const r of all('SELECT * FROM quest_template ORDER BY entry, patch')) quests.set(r.entry, r);
  const creatures = latest(
    `SELECT entry, name, subname, rank, type, npc_flags, gossip_menu_id, loot_id, pickpocket_loot_id, script_name
       FROM creature_template WHERE patch <= ? ORDER BY entry, patch`,
  );
  const objects = latest('SELECT * FROM gameobject_template WHERE patch <= ? ORDER BY entry, patch');
  const items = latest(
    `SELECT entry, name, start_quest, lock_id, spellid_1, spellid_2, spellid_3, spellid_4, spellid_5, spelltrigger_1, spelltrigger_2,
            spelltrigger_3, spelltrigger_4, spelltrigger_5 FROM item_template WHERE patch <= ? ORDER BY entry, patch`,
  );
  const spells = new Map();
  for (const r of all(
    `SELECT s.entry, s.name, s.requiresSpellFocus, s.effect1, s.effect2, s.effect3, s.effectMiscValue1, s.effectMiscValue2,
            s.effectMiscValue3, s.effectItemType1, s.effectItemType2, s.effectItemType3, s.effectTriggerSpell1,
            s.effectTriggerSpell2, s.effectTriggerSpell3, s.effectApplyAuraName1, s.effectApplyAuraName2, s.effectApplyAuraName3,
            s.reagent1, s.reagent2, s.reagent3, s.reagent4, s.reagent5, s.reagent6, s.reagent7, s.reagent8
       FROM spell_template s JOIN (SELECT entry e, MAX(build) b FROM spell_template WHERE build <= ? GROUP BY entry) m
         ON m.e = s.entry AND m.b = s.build`,
    BUILD,
  ))
    spells.set(r.entry, r);

  // Spawns in 1.12, by entry (a creature spawn may be one of up to five entries).
  const creatureSpawns = new Map();
  const creatureByGuid = new Map();
  for (const r of all('SELECT guid, id, id2, id3, id4, id5, map, position_x x, position_y y, patch_min, patch_max FROM creature')) {
    if (!inPatch(r)) continue;
    creatureByGuid.set(r.guid, r);
    for (const id of new Set([r.id, r.id2, r.id3, r.id4, r.id5])) if (id) push(creatureSpawns, id, { map: r.map, x: r.x, y: r.y });
  }
  const objectSpawns = new Map();
  const objectByGuid = new Map();
  for (const r of all('SELECT guid, id, map, position_x x, position_y y, patch_min, patch_max FROM gameobject')) {
    if (!inPatch(r)) continue;
    objectByGuid.set(r.guid, r);
    push(objectSpawns, r.id, { map: r.map, x: r.x, y: r.y });
  }

  // Area triggers (the newest build at or before 1.12.1) and the quests they complete.
  const triggers = new Map();
  for (const r of all(
    `SELECT t.* FROM areatrigger_template t JOIN (SELECT id i, MAX(build) b FROM areatrigger_template WHERE build <= ? GROUP BY id) m
       ON m.i = t.id AND m.b = t.build`,
    BUILD,
  ))
    triggers.set(r.id, r);
  const questTriggers = new Map();
  for (const r of all('SELECT id, quest FROM areatrigger_involvedrelation')) push(questTriggers, r.quest, r.id);

  // Scripts, by table and id.
  const scripts = {};
  for (const t of SCRIPT_TABLES) {
    scripts[t] = new Map();
    for (const r of all(`SELECT * FROM ${t} ORDER BY id, delay, priority`)) push(scripts[t], r.id, r);
  }
  // Who starts a generic script (START_SCRIPT, START_SCRIPT_FOR_ALL, the success script of a map event).
  const genericStarters = new Map();
  for (const t of SCRIPT_TABLES)
    for (const rows of scripts[t].values())
      for (const r of rows) {
        if (r.command === CMD.startScript) for (const s of [r.datalong, r.datalong2, r.datalong3, r.datalong4]) if (s) push(genericStarters, s, { table: t, id: r.id });
        if (r.command === CMD.startScriptForAll && r.datalong) push(genericStarters, r.datalong, { table: t, id: r.id });
        if ((r.command === CMD.startMapEvent || r.command === CMD.editMapEvent) && r.dataint2) push(genericStarters, r.dataint2, { table: t, id: r.id });
      }

  // Gossip menus: who shows a menu (creatures, objects, and the menus whose options lead to it).
  const menuScripts = new Map(); // script id -> menus that run it
  const menuParents = new Map(); // menu -> menus with an option leading to it
  for (const r of all('SELECT entry, script_id FROM gossip_menu WHERE script_id > 0')) push(menuScripts, r.script_id, r.entry);
  for (const r of all('SELECT menu_id, action_menu_id, action_script_id FROM gossip_menu_option')) {
    if (r.action_script_id > 0) push(menuScripts, r.action_script_id, r.menu_id);
    if (r.action_menu_id > 0 && r.action_menu_id !== r.menu_id) push(menuParents, r.action_menu_id, r.menu_id);
  }
  const menuCreatures = new Map();
  for (const c of creatures.values()) if (c.gossip_menu_id) push(menuCreatures, c.gossip_menu_id, c.entry);
  const menuObjects = new Map();
  for (const o of objects.values()) {
    if (o.type === 2 && o.data3) push(menuObjects, o.data3, o.entry); // questgiver: gossip menu
    if (o.type === 10 && o.data19) push(menuObjects, o.data19, o.entry); // goober: gossip menu
  }

  const aiEvents = new Map(); // action script id -> events
  for (const r of all('SELECT * FROM creature_ai_events')) for (const s of new Set([r.action1_script, r.action2_script, r.action3_script])) if (s) push(aiEvents, s, r);

  const scriptTargets = new Map(); // spell -> [{ type, entry }] (0 object, 1 creature, 2 dead creature)
  for (const r of all('SELECT entry, type, targetEntry, build_min, build_max FROM spell_script_target'))
    if ((r.build_min ?? 0) <= BUILD && BUILD <= (r.build_max ?? BUILD)) push(scriptTargets, r.entry, { type: r.type, entry: r.targetEntry });
  const itemTargets = new Map(); // item -> [{ type, entry }] (1 creature, 2 dead creature)
  for (const r of all('SELECT entry, type, target_entry FROM item_required_target')) push(itemTargets, r.entry, { type: r.type, entry: r.target_entry });

  const focusObjects = new Map(); // spell focus id -> spell focus objects (type 8)
  for (const o of objects.values()) if (o.type === 8 && o.data0) push(focusObjects, o.data0, o.entry);

  const waypoints = new Map(); // creature entry -> escort path (script_waypoint)
  for (const r of all('SELECT entry, pointid, location_x x, location_y y FROM script_waypoint ORDER BY entry, pointid')) push(waypoints, r.entry, r);
  // Waypoints with a script, by script id: who walks there (creature_movement by spawn, creature_movement_template by
  // entry; creature_movement_special holds paths a script sets someone walking, by path id).
  const movementByScript = new Map();
  for (const r of all('SELECT id, point, position_x x, position_y y, script_id FROM creature_movement WHERE script_id > 0')) {
    const c = creatureByGuid.get(r.id);
    if (c) push(movementByScript, r.script_id, { creature: c.id, path: 0, map: c.map, point: r.point, x: r.x, y: r.y });
  }
  for (const r of all('SELECT entry, point, position_x x, position_y y, script_id FROM creature_movement_template WHERE script_id > 0'))
    push(movementByScript, r.script_id, { creature: creatures.has(r.entry) ? r.entry : 0, path: 0, map: null, point: r.point, x: r.x, y: r.y });
  for (const r of all('SELECT id, point, position_x x, position_y y, script_id FROM creature_movement_special WHERE script_id > 0'))
    push(movementByScript, r.script_id, { creature: 0, path: r.id, map: null, point: r.point, x: r.x, y: r.y });
  const paths = new Map(); // creature entry -> creature_movement_template path (path 0)
  for (const r of all('SELECT entry, point, position_x x, position_y y FROM creature_movement_template WHERE path_id = 0 ORDER BY entry, point')) push(paths, r.entry, r);

  // Item use spells, and which items cast each spell.
  const itemUse = new Map(); // item -> on-use spells
  const castBy = new Map(); // spell -> items
  for (const it of items.values()) {
    for (let k = 1; k <= 5; k++) {
      const s = it[`spellid_${k}`];
      if (s && it[`spelltrigger_${k}`] === 0) {
        push(itemUse, it.entry, s);
        push(castBy, s, it.entry);
      }
    }
  }
  // Loot: chests (by chest object), creatures (their loot), pockets and containers, with chances (negative = quest drop).
  const objectLoot = new Map(); // item -> [{ entry, chance, quest }]
  const chestsByLoot = new Map();
  for (const o of objects.values()) if (o.type === 3 && o.data1) push(chestsByLoot, o.data1, o.entry);
  for (const r of all('SELECT entry, item, ChanceOrQuestChance c, mincountOrRef m, patch_min, patch_max FROM gameobject_loot_template')) {
    if (!inPatch(r) || r.m < 0 || !r.c) continue;
    for (const g of chestsByLoot.get(r.entry) ?? []) push(objectLoot, r.item, { entry: g, chance: Math.abs(r.c), quest: r.c < 0 });
  }
  const creatureLoot = new Map();
  const creaturesByLoot = new Map();
  const creaturesByPocket = new Map();
  for (const c of creatures.values()) {
    if (c.loot_id) push(creaturesByLoot, c.loot_id, c.entry);
    if (c.pickpocket_loot_id) push(creaturesByPocket, c.pickpocket_loot_id, c.entry);
  }
  for (const r of all('SELECT entry, item, ChanceOrQuestChance c, mincountOrRef m, patch_min, patch_max FROM creature_loot_template')) {
    if (!inPatch(r) || r.m < 0 || !r.c) continue;
    for (const c of creaturesByLoot.get(r.entry) ?? []) push(creatureLoot, r.item, { entry: c, chance: Math.abs(r.c), quest: r.c < 0 });
  }
  const pocketLoot = new Map(); // item -> creatures
  for (const r of all('SELECT entry, item, mincountOrRef m, patch_min, patch_max FROM pickpocketing_loot_template')) {
    if (!inPatch(r) || r.m < 0) continue;
    for (const c of creaturesByPocket.get(r.entry) ?? []) push(pocketLoot, r.item, c);
  }
  const vendors = new Map(); // item -> creatures that sell it
  const vendorTemplates = new Map();
  for (const r of all('SELECT entry, item FROM npc_vendor_template')) push(vendorTemplates, r.entry, r.item);
  const vendorIds = new Map();
  for (const r of all(`SELECT entry, vendor_id FROM creature_template WHERE vendor_id > 0 AND patch <= ? ORDER BY entry, patch`, PATCH)) vendorIds.set(r.entry, r.vendor_id);
  for (const [entry, vid] of vendorIds) for (const item of vendorTemplates.get(vid) ?? []) push(vendors, item, entry);
  for (const r of all('SELECT entry, item FROM npc_vendor')) push(vendors, r.item, r.entry);
  const fished = new Set(all('SELECT DISTINCT item FROM fishing_loot_template').map((r) => r.item));
  const skinned = new Set(all('SELECT DISTINCT item FROM skinning_loot_template').map((r) => r.item));
  const containers = new Map(); // item -> items that hold it
  for (const r of all('SELECT entry, item, mincountOrRef m, patch_min, patch_max FROM item_loot_template')) if (inPatch(r) && r.m >= 0) push(containers, r.item, r.entry);

  // Items quests hand out: as a reward, or at the start.
  const rewardedBy = new Map();
  for (const q of quests.values()) {
    for (const i of [...fieldsOf(q, 'RewItemId', 4), ...fieldsOf(q, 'RewChoiceItemId', 6)]) push(rewardedBy, i, q.entry);
    if (q.SrcItemId) push(rewardedBy, q.SrcItemId, q.entry);
  }
  const before = new Map(); // quest -> quests that lead to it (NextQuestInChain, NextQuestId)
  const children = new Map(); // quest -> quests taken while it is on (their PrevQuestId = -quest, or its NextQuestId = -child)
  const startScriptOf = new Map(); // quest start script id -> quests
  for (const q of quests.values()) {
    if (q.NextQuestInChain > 0) push(before, q.NextQuestInChain, q.entry);
    if (q.NextQuestId > 0) push(before, q.NextQuestId, q.entry);
    if (q.PrevQuestId < 0) push(children, -q.PrevQuestId, q.entry);
    if (q.NextQuestId < 0) push(children, q.entry, -q.NextQuestId);
    if (q.StartScript) push(startScriptOf, q.StartScript, q.entry);
  }

  const conditions = new Map();
  for (const r of all('SELECT * FROM conditions')) conditions.set(r.condition_entry, r);

  // Spells that send each event, spells that make each item, objects that send each event.
  const eventSpells = new Map();
  const madeBy = new Map();
  for (const s of spells.values()) {
    for (let k = 1; k <= 3; k++) {
      if (s[`effect${k}`] === EFFECT.sendEvent && s[`effectMiscValue${k}`]) push(eventSpells, s[`effectMiscValue${k}`], s.entry);
      if (s[`effect${k}`] === EFFECT.createItem && s[`effectItemType${k}`]) push(madeBy, s[`effectItemType${k}`], s.entry);
    }
  }
  const eventObjects = new Map();
  for (const o of objects.values()) {
    if (o.type === 10 && o.data2) push(eventObjects, o.data2, o.entry); // goober: event
    if (o.type === 3 && o.data6) push(eventObjects, o.data6, o.entry); // chest: event when opened
  }
  // Where scripts call up each creature (SUMMON_CREATURE rows that give a position): creature -> [{ table, id, x, y }],
  // and each object (SUMMON_OBJECT).
  const summonSpots = new Map();
  const objectSummons = new Map();
  for (const t of SCRIPT_TABLES)
    for (const rows of scripts[t].values())
      for (const r of rows) {
        if (!r.datalong || !(r.x || r.y)) continue;
        if (r.command === CMD.summonCreature) push(summonSpots, r.datalong, { table: t, id: r.id, x: r.x, y: r.y });
        if (r.command === CMD.summonObject) push(objectSummons, r.datalong, { table: t, id: r.id, x: r.x, y: r.y });
      }
  // Scripted map events: where each is won (END_MAP_EVENT with the success flag), and where each is started.
  const mapEventEnds = new Map();
  const mapEventStarts = new Map();
  for (const t of SCRIPT_TABLES)
    for (const rows of scripts[t].values())
      for (const r of rows) {
        if (r.command === CMD.endMapEvent && r.datalong2) push(mapEventEnds, r.datalong, { table: t, id: r.id });
        if (r.command === CMD.startMapEvent) push(mapEventStarts, r.datalong, r);
      }

  return {
    quests,
    creatures,
    objects,
    items,
    spells,
    creatureSpawns,
    objectSpawns,
    objectByGuid,
    triggers,
    questTriggers,
    scripts,
    genericStarters,
    menuScripts,
    menuParents,
    menuCreatures,
    menuObjects,
    aiEvents,
    scriptTargets,
    itemTargets,
    focusObjects,
    waypoints,
    movementByScript,
    paths,
    itemUse,
    castBy,
    objectLoot,
    creatureLoot,
    pocketLoot,
    vendors,
    fished,
    skinned,
    containers,
    rewardedBy,
    before,
    children,
    startScriptOf,
    conditions,
    eventSpells,
    madeBy,
    eventObjects,
    mapEventEnds,
    mapEventStarts,
    summonSpots,
    objectSummons,
  };
}

/* ── What a script or spell leads to ──────────────────────────────────── */

/**
 * Follows scripts and spells to everything they end up doing for quests: the quests they complete (QUEST_EXPLORED,
 * a quest-complete spell effect), the creatures they give credit for (KILL_CREDIT; QUEST_CREDIT is credit for the
 * script's own creature, kept as 'self'), and the creatures they summon. A step reached through the success script of
 * a scripted map event is tagged with that event, since it only runs once the event is won.
 */
function scriptGraph(data) {
  const memo = new Map();
  const EMPTY = { quests: new Map(), kills: new Map(), summons: new Set() };
  const addTag = (map, key, tag) => {
    let set = map.get(key);
    if (!set) map.set(key, (set = new Set()));
    set.add(tag);
  };
  function merge(out, sub, tag) {
    for (const [q, tags] of sub.quests) for (const t of tags) addTag(out.quests, q, tag ?? t);
    for (const [c, tags] of sub.kills) for (const t of tags) addTag(out.kills, c, tag ?? t);
    for (const c of sub.summons) out.summons.add(c);
  }
  function spellNode(id, stack) {
    const key = `spell:${id}`;
    if (memo.has(key)) return memo.get(key);
    if (stack.has(key)) return EMPTY;
    stack.add(key);
    const out = { quests: new Map(), kills: new Map(), summons: new Set() };
    const s = data.spells.get(id);
    if (s) {
      for (let k = 1; k <= 3; k++) {
        const e = s[`effect${k}`];
        const misc = s[`effectMiscValue${k}`];
        if (e === EFFECT.questComplete && misc) addTag(out.quests, misc, '');
        if (e === EFFECT.sendEvent && misc) merge(out, scriptNode('event_scripts', misc, stack));
        if (e === EFFECT.triggerSpell && s[`effectTriggerSpell${k}`]) merge(out, spellNode(s[`effectTriggerSpell${k}`], stack));
        if ((e === EFFECT.dummy || e === EFFECT.scriptEffect) && data.scripts.spell_scripts.has(id)) merge(out, scriptNode('spell_scripts', id, stack));
        if ((e === EFFECT.summon || e === EFFECT.summonWild || e === EFFECT.summonGuardian) && misc) out.summons.add(misc);
      }
    }
    stack.delete(key);
    memo.set(key, out);
    return out;
  }
  function scriptNode(table, id, stack = new Set()) {
    const key = `${table}:${id}`;
    if (memo.has(key)) return memo.get(key);
    if (stack.has(key)) return EMPTY;
    stack.add(key);
    const out = { quests: new Map(), kills: new Map(), summons: new Set() };
    for (const r of data.scripts[table].get(id) ?? []) {
      switch (r.command) {
        case CMD.questExplored:
          if (r.datalong) addTag(out.quests, r.datalong, '');
          break;
        case CMD.killCredit:
          if (r.datalong) addTag(out.kills, r.datalong, '');
          break;
        case CMD.questCredit:
          addTag(out.kills, 'self', '');
          break;
        case CMD.summonCreature:
        case CMD.updateEntry: // the creature turns into another: as good as calling that one up
          if (r.datalong) out.summons.add(r.datalong);
          break;
        case CMD.castSpell:
          if (r.datalong) merge(out, spellNode(r.datalong, stack));
          break;
        case CMD.startScript:
          for (const s of [r.datalong, r.datalong2, r.datalong3, r.datalong4]) if (s) merge(out, scriptNode('generic_scripts', s, stack));
          break;
        case CMD.startScriptForAll:
          if (r.datalong) merge(out, scriptNode('generic_scripts', r.datalong, stack));
          break;
        case CMD.startMapEvent:
        case CMD.editMapEvent:
          if (r.dataint2) merge(out, scriptNode('generic_scripts', r.dataint2, stack), `map:${r.datalong}`);
          break;
      }
    }
    stack.delete(key);
    memo.set(key, out);
    return out;
  }
  return { scriptNode: (t, id) => scriptNode(t, id), spellNode: (id) => spellNode(id, new Set()) };
}

/** The creatures that show the gossip menus a gossip script belongs to (directly or through the menus leading to them). */
function menuCreaturesOf(data, scriptId) {
  const out = new Set();
  const seen = new Set();
  const walk = (menu) => {
    if (seen.has(menu)) return;
    seen.add(menu);
    for (const c of data.menuCreatures.get(menu) ?? []) out.add(c);
    for (const p of data.menuParents.get(menu) ?? []) walk(p);
  };
  for (const m of data.menuScripts.get(scriptId) ?? []) walk(m);
  return [...out];
}

/**
 * Every start a quest can be completed from: quest -> [{ table | 'spell', id, tags }]; the same for credit for a
 * creature, and for summoning a creature. Generic scripts are not starts (something else runs them); event scripts
 * are (the object or spell that sends the event is found later).
 */
function completionIndex(data, graph) {
  const byQuest = new Map();
  const byKill = new Map();
  const bySummon = new Map();
  const note = (start, res, owners = () => []) => {
    for (const [q, tags] of res.quests) push(byQuest, q, { ...start, tags });
    for (const [c, tags] of res.kills) {
      if (c === 'self') for (const o of owners()) push(byKill, o, { ...start, tags, self: true });
      else push(byKill, c, { ...start, tags });
    }
    for (const c of res.summons) push(bySummon, c, start);
  };
  for (const table of SCRIPT_TABLES) {
    if (table === 'generic_scripts') continue;
    for (const id of data.scripts[table].keys()) {
      const owners =
        table === 'creature_ai_scripts'
          ? () => (data.aiEvents.get(id) ?? []).map((e) => e.creature_id)
          : table === 'gossip_scripts'
            ? () => menuCreaturesOf(data, id)
            : () => [];
      note({ table, id }, graph.scriptNode(table, id), owners);
    }
  }
  // Creature AI reaches generic scripts with START_SCRIPT: their QUEST_CREDIT is credit for the AI's creature.
  for (const [id, events] of data.aiEvents) {
    for (const r of data.scripts.creature_ai_scripts.get(id) ?? []) {
      if (r.command !== CMD.startScript) continue;
      for (const s of [r.datalong, r.datalong2, r.datalong3, r.datalong4]) {
        if (!s) continue;
        const res = graph.scriptNode('generic_scripts', s);
        if (res.kills.has('self')) for (const e of events) push(byKill, e.creature_id, { table: 'creature_ai_scripts', id, tags: res.kills.get('self'), self: true });
      }
    }
  }
  // Spells cast by items and objects.
  const spellStarts = new Set(data.castBy.keys());
  for (const o of data.objects.values()) {
    if (o.type === 10 && o.data10) spellStarts.add(o.data10); // goober
    if (o.type === 22 && o.data0) spellStarts.add(o.data0); // spellcaster
  }
  for (const id of spellStarts) note({ table: 'spell', id }, graph.spellNode(id));
  return { byQuest, byKill, bySummon };
}

/* ── Which quests, and what they need ─────────────────────────────────── */

/** The quest_template slot behind each row of a quests.json quest (the rows are built in this order in world.mjs). */
function rowSlots(t) {
  const out = [];
  for (let k = 1; k <= 4; k++) {
    const id = t[`ReqCreatureOrGOId${k}`];
    const text = t[`ObjectiveText${k}`] || null;
    const spell = t[`ReqSpellCast${k}`] || 0;
    if (id > 0) out.push({ kind: 'n', id, text, spell });
    else if (id < 0) out.push({ kind: 'o', id: -id, text, spell });
    else if (text) out.push({ kind: 't', id: null, text, spell });
  }
  for (let k = 1; k <= 4; k++) if (t[`ReqItemId${k}`]) out.push({ kind: 'i', id: t[`ReqItemId${k}`], text: null, spell: 0 });
  return out;
}

/** The leveling set: continent quests and class quests, without professions, events, repeatables and reputation work. */
function leveling(q) {
  if (q.ch !== 'c') return false;
  if (NOT_LEVELING.has(q.c2)) return false;
  if (!(q.c2 === 0 || q.c2 === 1 || (q.rc && q.c2 === 4))) return false;
  if (q.sk || q.ev || q.rep) return false;
  if ((q.rq ?? []).some((r) => r[0] === 'r')) return false;
  return true;
}

function analyser(data) {
  const openSpawns = (kind, id) => (kind === 'n' ? data.creatureSpawns : data.objectSpawns).get(id)?.filter((p) => OPEN_MAPS.has(p.map)) ?? [];
  const anySpawns = (kind, id) => (kind === 'n' ? data.creatureSpawns : data.objectSpawns).get(id) ?? [];

  /** Loot sources a route would use: quest drops, and drops at a tenth of the best chance or better. */
  function lootSources(item) {
    const all = [...(data.creatureLoot.get(item) ?? []).map((s) => ({ ...s, kind: 'n' })), ...(data.objectLoot.get(item) ?? []).map((s) => ({ ...s, kind: 'o' }))];
    const best = Math.max(0, ...all.map((s) => s.chance));
    return all.filter((s) => s.quest || s.chance >= best / 10);
  }

  /** Quests the player has done (or has on) before this one: its prerequisites, and the quests that lead to it. */
  function chainOf(t) {
    const out = new Set();
    const queue = [t.entry];
    for (let depth = 0; queue.length && depth < CHAIN_DEPTH * 4; depth++) {
      const id = queue.shift();
      const q = data.quests.get(id);
      if (!q) continue;
      const prev = [Math.abs(q.PrevQuestId), ...(data.before.get(id) ?? [])].filter((p) => p && !out.has(p) && p !== t.entry);
      for (const p of prev) {
        out.add(p);
        if (out.size < CHAIN_DEPTH) queue.push(p);
      }
    }
    return out;
  }

  /** Items a condition requires the player to carry (CONDITION_ITEM, alone or in an AND), as the quest's RequiredCondition. */
  function carried(id, out = new Set(), depth = 0) {
    const c = data.conditions.get(id);
    if (!c || depth > 4 || c.flags & 1) return out; // a negated condition says what the player must not have
    if (c.type === COND.item && c.value1) out.add(c.value1);
    if (c.type === COND.and) for (const sub of [c.value1, c.value2, c.value3, c.value4]) if (sub) carried(sub, out, depth + 1);
    return out;
  }

  /**
   * Items the player holds for a quest without collecting them: given at its start or by an earlier quest of its chain,
   * or carried already, as the quest's own RequiredCondition demands (A Taste of Flame needs the molt in the bags).
   */
  function heldItems(t) {
    const held = new Set();
    if (t.SrcItemId) held.add(t.SrcItemId);
    if (t.RequiredCondition) for (const item of carried(t.RequiredCondition)) held.add(item);
    for (const r of data.scripts.quest_start_scripts.get(t.StartScript) ?? []) if (r.command === CMD.createItem && r.datalong) held.add(r.datalong);
    const chain = chainOf(t);
    for (const c of data.children.get(t.entry) ?? []) chain.add(c); // quests done while this one is on hand their rewards in to it
    const given = (item) => (data.rewardedBy.get(item) ?? []).some((q) => chain.has(q));
    return {
      held,
      // ...or inside such an item, when nothing locks it (a locked one needs its key: the container method).
      has: (item) => held.has(item) || given(item) || (data.containers.get(item) ?? []).some((box) => (held.has(box) || given(box)) && !data.items.get(box)?.lock_id),
    };
  }

  function analyse(q, t) {
    const slots = rowSlots(t);
    const rows = q.rq ?? [];
    const aligned = rows.length === slots.length && slots.every((s, i) => s.kind === rows[i][0] && (s.id ?? null) === (rows[i][1] ?? null));
    const reqItems = fieldsOf(t, 'ReqItemId', 4);
    const items = heldItems(t);
    const reasons = [];
    if (t.SpecialFlags & 2) reasons.push('event');
    if (rows.some((r) => r[0] === 't')) reasons.push('text');
    if (t.SrcItemId && reqItems.includes(t.SrcItemId)) reasons.push('item');
    // Rows a route cannot do as written.
    const open = [];
    const held = [];
    let instanceOnly = false;
    rows.forEach((r, index) => {
      const slot = aligned ? slots[index] : null;
      if (r[0] === 'n' || r[0] === 'o') {
        if (!openSpawns(r[0], r[1]).length) {
          const inside = anySpawns(r[0], r[1]).length > 0;
          if (inside) instanceOnly = true;
          open.push({ index, kind: r[0], id: r[1], why: inside ? 'instance' : 'summoned', slot });
        } else if (slot?.spell) open.push({ index, kind: r[0], id: r[1], why: 'cast', slot });
        else if (r[0] === 'n' && slot?.text) open.push({ index, kind: r[0], id: r[1], why: 'credit', slot });
      } else if (r[0] === 'i') {
        if (r[1] === t.SrcItemId) return; // handed out by the quest and given back
        const sources = lootSources(r[1]);
        if (sources.some((s) => openSpawns(s.kind, s.entry).length)) return;
        if (items.has(r[1])) {
          held.push({ index, id: r[1] });
          return;
        }
        const inside = sources.some((s) => anySpawns(s.kind, s.entry).length);
        if (inside) instanceOnly = true;
        const called = sources.length && sources.every((s) => s.kind === 'n' && !anySpawns('n', s.entry).length);
        open.push({ index, kind: 'i', id: r[1], why: inside ? 'instance' : called ? 'summoned-drop' : 'no-source', slot });
      } else if (r[0] === 't') open.push({ index, kind: 't', id: null, text: r[2], why: 'text', slot });
    });
    if (q.rc && levelOf(q) <= LEVEL_CAP && open.some((o) => o.kind !== 't')) reasons.push('class');
    if (open.some((o) => o.kind === 'i' && o.why === 'no-source')) reasons.push('no-source');
    if (open.some((o) => o.why === 'summoned' || o.why === 'summoned-drop')) reasons.push('summoned');
    return { reasons, open, held, instanceOnly, items };
  }
  return { analyse, lootSources, openSpawns, anySpawns };
}

/* ── Resolving one quest ──────────────────────────────────────────────── */

function resolver(data, idx, an, rawGivers = new Map(), rawEnders = new Map()) {
  const creatureName = (id) => data.creatures.get(id)?.name ?? `creature ${id}`;
  const objectName = (id) => placeName(data.objects.get(id)?.name ?? `object ${id}`);
  const itemName = (id) => data.items.get(id)?.name ?? `item ${id}`;
  const spawnsOf = an.openSpawns;
  /**
   * A creature with a name of its own (one spawn, a rank, a title) rather than one of many. One that only a script
   * calls up is named as the quest names it ("Kill Big Will", "subdue the felhunter"), else by the shape of its name.
   */
  const named = (id, ctx) => {
    const c = data.creatures.get(id);
    if (c && (c.rank >= 2 || c.subname)) return true; // rare or boss, or titled
    const spawns = data.creatureSpawns.get(id)?.length ?? 0;
    if (spawns === 1) return true;
    if (spawns > 1 || !c) return false;
    const said = ctx ? clean(`${ctx.t.Objectives} ${ctx.t.Details ?? ''}`) : '';
    const name = c.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (new RegExp(`\\b(the|a|an)\\s+${name}\\b`, 'i').test(said)) return false;
    if (new RegExp(`\\b${name}\\b`).test(said)) return true;
    return !c.name.includes(' ') || /^\S+ the \S+$/.test(c.name) || c.rank >= 1 || c.type === HUMANOID; // "Big Will", "Lord Kragaru"
  };
  const theOne = (id, ctx) => (named(id, ctx) ? creatureName(id) : `the ${creatureName(id)}`);
  const someone = (id, ctx) => (named(id, ctx) ? creatureName(id) : aOrAn(creatureName(id)));

  /**
   * Picks points: open world only, near duplicates merged, the ones nearest the reference (the quest giver) first, and
   * none much farther than the nearest (the same object or creature elsewhere, often for the other faction).
   */
  function picker(ref) {
    const near = (p) => {
      let best = Infinity;
      for (const r of ref) if (r.map === p.map) best = Math.min(best, Math.hypot(r.x - p.x, r.y - p.y));
      return best;
    };
    return (list) => {
      const kept = [];
      for (const p of list) {
        if (!p || !OPEN_MAPS.has(p.map)) continue;
        if (kept.some((k) => k.map === p.map && Math.hypot(k.x - p.x, k.y - p.y) < MERGE)) continue;
        kept.push(p);
      }
      let sorted = kept;
      if (ref.length) {
        const scored = kept.map((p) => ({ p, d: near(p) })).sort((a, b) => a.d - b.d);
        const d0 = scored[0]?.d ?? Infinity;
        const limit = Number.isFinite(d0) ? Math.max(2 * d0, d0 + FAR) : Infinity;
        sorted = scored.filter((e) => e.d <= limit).map((e) => e.p);
      }
      return sorted.slice(0, MAX_POINTS).map((p) => ({ map: p.map, x: round1(p.x), y: round1(p.y) }));
    };
  }

  /** Where scripts put an object they call up (SUMMON_OBJECT) near the reference points: on their map. */
  function summonedNear(ref, spots) {
    const out = [];
    for (const sp of spots ?? []) for (const r of ref) if (Math.hypot(sp.x - r.x, sp.y - r.y) < NEAR) out.push({ map: r.map, x: sp.x, y: sp.y });
    return out;
  }

  function context(q, t, a) {
    const ref = [];
    for (const [k, id] of q.st ?? []) if (k === 'n' || k === 'o') ref.push(...spawnsOf(k, id));
    if (!ref.length) for (const [k, id] of q.en ?? []) if (k === 'n' || k === 'o') ref.push(...spawnsOf(k, id));
    const questItems = [t.SrcItemId, ...fieldsOf(t, 'ReqSourceId', 4), ...fieldsOf(t, 'ReqItemId', 4)].filter(Boolean);
    const giver = (q.st ?? []).find(([k, id]) => (k === 'n' || k === 'o') && spawnsOf(k, id).length) ?? (q.st ?? []).find(([k]) => k === 'n' || k === 'o');
    const people = new Set([...(q.st ?? []), ...(q.en ?? [])].filter(([k]) => k === 'n').map(([, id]) => id));
    return { q, t, a, pick: picker(ref), ref, questItems: [...new Set(questItems)], giver, people, starts: idx.byQuest.get(q.i) ?? [], acquired: new Set() };
  }
  const usable = (ctx, item) => ctx.questItems.includes(item) || ctx.a.items.has(item);

  /**
   * The nearest of several entries with open-world spawns, and the points of all of them. An object with no spawn of
   * its own counts where a script calls it up next to the quest giver (Strahad's summoning circle).
   */
  function targetsOf(ctx, list) {
    const scored = [];
    for (const t of list) {
      let pts = ctx.pick(spawnsOf(t.kind, t.id));
      if (!pts.length && t.kind === 'o' && !an.anySpawns('o', t.id).length) pts = ctx.pick(summonedNear(ctx.ref, data.objectSummons.get(t.id)));
      if (pts.length) scored.push({ ...t, pts });
    }
    if (!scored.length) return null;
    const all = ctx.pick(scored.flatMap((s) => s.pts));
    const lead = scored.find((s) => s.pts.some((p) => p.map === all[0].map && p.x === all[0].x && p.y === all[0].y)) ?? scored[0];
    return { lead, points: all };
  }

  /** Where an item is used: at the object its spell needs nearby, or on the creatures or objects it is for. */
  function useItem(ctx, item, spell, opts = {}) {
    const s = data.spells.get(spell);
    const name = itemName(item);
    if (s?.requiresSpellFocus) {
      const focus = targetsOf(ctx, (data.focusObjects.get(s.requiresSpellFocus) ?? []).map((id) => ({ kind: 'o', id })));
      if (focus) return { kind: 'item', item, object: focus.lead.id, points: focus.points, text: `Use ${the(name)} at ${the(objectName(focus.lead.id))}`, place: objectName(focus.lead.id) };
    }
    const targets = [
      ...(data.itemTargets.get(item) ?? []).map((x) => ({ kind: 'n', id: x.entry, dead: x.type === 2 })),
      ...(data.scriptTargets.get(spell) ?? []).map((x) => ({ kind: x.type === 0 ? 'o' : 'n', id: x.entry, dead: x.type === 2 })),
    ].filter((x) => !(opts.notPeople && x.kind === 'n' && ctx.people.has(x.id)));
    const found = targetsOf(ctx, targets.length ? targets : opts.target ? [opts.target] : []);
    if (!found) return null;
    const { lead } = found;
    if (lead.kind === 'o') return { kind: 'item', item, object: lead.id, points: found.points, text: `Use ${the(name)} on ${the(objectName(lead.id))}`, place: objectName(lead.id) };
    const who = someone(lead.id, ctx);
    const text = lead.dead ? `Kill ${who} and use ${the(name)} on the body` : opts.kill ? `Use ${the(name)} on ${who}, then kill it` : `Use ${the(name)} on ${who}`;
    return { kind: 'item', item, npc: lead.id, points: found.points, text };
  }

  /** Steps to get an item the quest uses but does not hand out: a chest or a creature that holds it, or its pockets. */
  function acquire(ctx, item) {
    if (ctx.acquired.has(item) || ctx.a.items.has(item)) return [];
    const sources = an.lootSources(item);
    const chest = targetsOf(ctx, sources.filter((s) => s.kind === 'o').map((s) => ({ kind: 'o', id: s.entry })));
    const mob = targetsOf(ctx, sources.filter((s) => s.kind === 'n').map((s) => ({ kind: 'n', id: s.entry })));
    const pocket = targetsOf(ctx, (data.pocketLoot.get(item) ?? []).map((id) => ({ kind: 'n', id })));
    ctx.acquired.add(item);
    if (chest) return [{ kind: 'use', object: chest.lead.id, item, points: chest.points, text: `Take ${the(itemName(item))} from ${the(objectName(chest.lead.id))}` }];
    if (mob) return [{ kind: 'kill', npc: mob.lead.id, item, points: mob.points, text: `Kill ${someone(mob.lead.id, ctx)} for ${the(itemName(item))}` }];
    if (pocket) return [{ kind: 'kill', npc: pocket.lead.id, item, points: pocket.points, text: `Pick the pocket of ${someone(pocket.lead.id, ctx)} for ${the(itemName(item))}` }];
    ctx.acquired.delete(item);
    return null;
  }
  const acquireOr = (ctx, item) => acquire(ctx, item) ?? [];

  /* Methods for the event: each returns { how, objectives } or { fail } or null. */

  function byAreaTrigger(ctx) {
    const ids = data.questTriggers.get(ctx.q.i) ?? [];
    if (!ids.length) return null;
    const trig = ids.map((id) => data.triggers.get(id)).filter(Boolean);
    const points = ctx.pick(trig.map((t) => ({ map: t.map_id, x: t.x, y: t.y })));
    if (!points.length) return { fail: 'its area trigger is inside an instance' };
    const objText = clean(ctx.t.Objectives);
    const places = trig.map((t) => /^[^,]+,\s*(.+?)\s+-\s+Quest\b/.exec(t.name ?? '')?.[1]).filter(Boolean);
    const place = places.find((p) => objText.includes(p) || ctx.q.n.includes(p)) ?? places[0];
    // The place as the quest says it: "the Forgotten Pools" and "the Dead Fields", but "Dun Algaz".
    const article = place && !/^the\s/i.test(place) && new RegExp(`\\bthe\\s+${place.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i').test(objText) ? 'the ' : '';
    const text = place ? `Explore ${article}${place.replace(/^The\s/, 'the ')}` : firstClause(ctx.t.Objectives);
    return { how: 'areatrigger', objectives: [{ kind: 'explore', points, text }] };
  }

  function menuOwners(menu, seen = new Set()) {
    if (seen.has(menu)) return [];
    seen.add(menu);
    const out = [...(data.menuCreatures.get(menu) ?? []).map((id) => ({ kind: 'n', id })), ...(data.menuObjects.get(menu) ?? []).map((id) => ({ kind: 'o', id }))];
    for (const parent of data.menuParents.get(menu) ?? []) out.push(...menuOwners(parent, seen));
    return out;
  }
  const gossipOwners = (scriptId) => (data.menuScripts.get(scriptId) ?? []).flatMap((m) => menuOwners(m));

  function byGossip(ctx) {
    const starts = ctx.starts.filter((s) => s.table === 'gossip_scripts' && s.tags.has(''));
    if (!starts.length) return null;
    const owners = starts.flatMap((s) => gossipOwners(s.id));
    if (!owners.length) return { fail: 'the gossip that completes it belongs to no creature or object' };
    const found = targetsOf(ctx, owners);
    if (!found) {
      // A creature a script calls up (a spirit that comes when its body falls): call it up, then talk to it.
      for (const o of owners) {
        if (o.kind !== 'n' || an.anySpawns('n', o.id).length) continue;
        const call = summonedHere(ctx, o.id, '');
        if (!call) continue;
        const last = call.objectives[call.objectives.length - 1];
        return { how: 'summon', objectives: [...call.objectives.slice(0, -1), { kind: 'talk', npc: o.id, points: last.points, text: `Talk to ${theOne(o.id, ctx)}` }] };
      }
      return { fail: 'whoever has the gossip that completes it is not in the open world' };
    }
    const { lead } = found;
    const points = ctx.pick(spawnsOf(lead.kind, lead.id));
    if (lead.kind === 'o') return { how: 'gossip', objectives: [{ kind: 'use', object: lead.id, points, text: `Use ${the(objectName(lead.id))}` }] };
    return { how: 'gossip', objectives: [{ kind: 'talk', npc: lead.id, points, text: `Talk to ${creatureName(lead.id)}` }] };
  }

  function byObjectScript(ctx) {
    const starts = ctx.starts.filter((s) => s.table === 'gameobject_scripts' && s.tags.has(''));
    if (!starts.length) return null;
    for (const s of starts) {
      const g = data.objectByGuid.get(s.id);
      if (!g || !OPEN_MAPS.has(g.map)) continue;
      return { how: 'gameobject', objectives: [{ kind: 'use', object: g.id, points: ctx.pick([{ map: g.map, x: g.x, y: g.y }]), text: `Use ${the(objectName(g.id))}` }] };
    }
    return { fail: 'the object whose script completes it is not in the open world' };
  }

  function byEvent(ctx) {
    const starts = ctx.starts.filter((s) => s.table === 'event_scripts' && s.tags.has(''));
    if (!starts.length) return null;
    for (const s of starts) {
      const objects = targetsOf(ctx, (data.eventObjects.get(s.id) ?? []).map((id) => ({ kind: 'o', id })));
      if (objects) return { how: 'event', objectives: [{ kind: 'use', object: objects.lead.id, points: objects.points, text: `Use ${the(objectName(objects.lead.id))}` }] };
      for (const spell of data.eventSpells.get(s.id) ?? []) {
        for (const item of (data.castBy.get(spell) ?? []).filter((i) => usable(ctx, i))) {
          const o = useItem(ctx, item, spell);
          if (o) return { how: 'event', objectives: [...acquireOr(ctx, item), o] };
        }
      }
    }
    return { fail: 'nothing in the open world sends the event that completes it' };
  }

  /** What a creature's AI event asks of the player, as an objective at that creature. */
  function aiObjective(ctx, e, how, text, where) {
    const npc = e.creature_id;
    const own = ctx.pick(spawnsOf('n', npc));
    const points = own.length ? own : where ?? [];
    if (!points.length) return null;
    const name = creatureName(npc);
    if (e.event_type === AI.death) return { kind: 'kill', npc, points, text: text ?? `Kill ${name}` };
    if (e.event_type === AI.hp) return { kind: 'kill', npc, points, text: text ?? `Defeat ${name}` };
    if (e.event_type === AI.receiveEmote) return { kind: 'talk', npc, points, text: text ?? (EMOTES[e.event_param1] ? `Use the /${EMOTES[e.event_param1]} emote on ${name}` : `Use an emote on ${name}`) };
    if (e.event_type === AI.spellHit) {
      for (const item of data.castBy.get(e.event_param1) ?? []) if (usable(ctx, item)) return { kind: 'item', item, npc, points, text: text ?? `Use ${the(itemName(item))} on ${name}` };
      if (!data.castBy.has(e.event_param1) && text) return { kind: 'talk', npc, points, text }; // a spell of the player's own (a priest's heal)
      return null;
    }
    if (e.event_type === AI.oocLos) return { kind: 'explore', npc, points, text: text ?? `Go to ${name}` };
    return null;
  }

  function byCreatureAI(ctx) {
    const starts = ctx.starts.filter((s) => s.table === 'creature_ai_scripts' && s.tags.has(''));
    if (!starts.length) return null;
    for (const s of starts) for (const e of data.aiEvents.get(s.id) ?? []) {
      const o = aiObjective(ctx, e);
      if (o) return { how: 'creature_ai', objectives: [o] };
    }
    return { fail: 'the creature whose script completes it is not in the open world' };
  }

  function byQuestStart(ctx) {
    const own = ctx.t.StartScript;
    if (!own || !ctx.starts.some((s) => s.table === 'quest_start_scripts' && s.id === own && s.tags.has(''))) return null;
    const [k, id] = ctx.giver ?? [];
    if (!k) return null;
    const points = ctx.pick(spawnsOf(k, id));
    if (!points.length) return { fail: 'the quest giver is not in the open world' };
    const text = firstClause(ctx.t.Objectives) || `Wait by ${k === 'n' ? creatureName(id) : the(objectName(id))}`;
    return { how: 'quest-start', objectives: [k === 'n' ? { kind: 'talk', npc: id, points, text } : { kind: 'use', object: id, points, text }] };
  }

  function escortText(ctx, who, to) {
    const clause = firstClause(ctx.t.Objectives);
    if (/^(escort|protect|help|lead|guide|show|ensure|keep|defend|go with|follow|safely)\b/i.test(clause)) return clause.replace(/^safely\s+/i, '').replace(/^./, (c) => c.toUpperCase());
    return `Escort ${creatureName(who)}${to ? ` to ${creatureName(to)}` : ''}`;
  }
  /** The map a creature walks on: where it spawns (any map), else where the quest giver is. */
  const mapOf = (ctx, creature) => (creature && data.creatureSpawns.get(creature)?.[0]?.map) ?? ctx.ref[0]?.map;

  /** What wins a scripted map event: the waypoint where it ends, or the creature whose AI ends it. */
  function mapEventWin(ctx, ev, depth = 0) {
    const [gk, gid] = ctx.giver ?? [];
    for (const end of data.mapEventEnds.get(ev) ?? []) {
      if (end.table === 'creature_movement_scripts') {
        const wps = data.movementByScript.get(end.id) ?? [];
        const who = wps.find((w) => w.creature)?.creature || (gk === 'n' ? gid : 0);
        const map = wps.find((w) => w.map !== null)?.map ?? mapOf(ctx, who);
        const points = ctx.pick(wps.map((w) => ({ map: w.map ?? map, x: w.x, y: w.y })));
        if (points.length && who) return { kind: 'escort', npc: who, points, text: escortText(ctx, who) };
      }
      const aiEnds = end.table === 'creature_ai_scripts' ? [end.id] : [];
      if (end.table === 'generic_scripts' && depth < 3) for (const s of data.genericStarters.get(end.id) ?? []) if (s.table === 'creature_ai_scripts') aiEnds.push(s.id);
      for (const id of aiEnds) {
        for (const e of data.aiEvents.get(id) ?? []) {
          const npc = e.creature_id;
          const own = ctx.pick(spawnsOf('n', npc));
          const points = own.length ? own : gk ? ctx.pick(spawnsOf(gk, gid)) : [];
          if (!points.length) continue;
          const verb = e.event_type === AI.hp ? 'Defeat' : 'Kill';
          return { kind: 'kill', npc, points, text: `${verb} ${creatureName(npc)}` };
        }
      }
    }
    // Won when the escorted creature comes near another (CONDITION_NEARBY_CREATURE).
    for (const r of data.mapEventStarts.get(ev) ?? []) {
      const cond = data.conditions.get(r.dataint);
      if (cond?.type === COND.nearbyCreature && cond.value1 && gk === 'n') {
        const points = ctx.pick(spawnsOf('n', cond.value1));
        if (points.length) return { kind: 'escort', npc: gid, points, text: escortText(ctx, gid, cond.value1) };
      }
    }
    return null;
  }

  /** The escort or defence the quest's start script begins, won where its map event is won. */
  function byMapEvent(ctx) {
    const own = ctx.t.StartScript;
    const start = own && ctx.starts.find((s) => s.table === 'quest_start_scripts' && s.id === own && [...s.tags].some((t) => t.startsWith('map:')));
    if (!start) return null;
    const events = [...start.tags].filter((t) => t.startsWith('map:')).map((t) => Number(t.slice(4)));
    for (const ev of events) {
      const o = mapEventWin(ctx, ev);
      if (o) return { how: 'escort', objectives: [o] };
    }
    // Won by a condition this module does not read (the attackers dead, the time run out): it is fought where the giver
    // stands, or where the giver's own path ends when the start script sets it walking.
    const [gk, gid] = ctx.giver ?? [];
    if (gk !== 'n') return null;
    const walks = (data.scripts.quest_start_scripts.get(own) ?? []).some((r) => r.command === 60 || (r.command === 20 && r.datalong === 2));
    const path = walks ? data.paths.get(gid) : null;
    const map = mapOf(ctx, gid);
    const raw = path?.length ? [{ map, x: path[path.length - 1].x, y: path[path.length - 1].y }] : data.creatureSpawns.get(gid) ?? [];
    const points = ctx.pick(raw);
    if (!points.length) return { fail: 'the escort or defence is not in the open world' };
    return { how: 'escort', objectives: [{ kind: 'escort', npc: gid, points, text: path?.length ? escortText(ctx, gid) : escortText(ctx, gid).replace(/^Escort\b/, 'Protect') }] };
  }

  /** A giver that walks a scripted path (script_waypoint): the escort ends at its last waypoint. */
  function byWaypoints(ctx) {
    for (const [k, id] of ctx.q.st ?? []) {
      if (k !== 'n') continue;
      const path = data.waypoints.get(id);
      if (!path?.length) continue;
      const map = mapOf(ctx, id);
      const last = path[path.length - 1];
      const points = ctx.pick([{ map, x: last.x, y: last.y }]);
      if (!points.length) return { fail: 'the escort is not in the open world' };
      const text = path.length > 1 ? escortText(ctx, id) : `Protect ${creatureName(id)}`;
      return { how: 'escort', objectives: [{ kind: 'escort', npc: id, points, text }] };
    }
    return null;
  }

  /** The object or creature of the quest's own rows, for a spell that names no target of its own. */
  function rowTarget(ctx) {
    for (const r of ctx.q.rq ?? []) if ((r[0] === 'o' || r[0] === 'n') && spawnsOf(r[0], r[1]).length) return { kind: r[0], id: r[1] };
    return undefined;
  }

  /** A spell that completes the quest, cast by an item of the quest (or the start item's own spell, on its target). */
  function byItemSpell(ctx) {
    const spells = ctx.starts.filter((s) => s.table === 'spell' && s.tags.has('')).map((s) => s.id);
    for (const spell of spells) {
      const items = [...(data.castBy.get(spell) ?? [])].sort((a, b) => usable(ctx, b) - usable(ctx, a));
      for (const item of items) {
        const steps = usable(ctx, item) ? [] : acquire(ctx, item);
        if (!steps) continue;
        const o = useItem(ctx, item, spell, { target: rowTarget(ctx) });
        if (o) return { how: 'item-spell', objectives: [...steps, o] };
      }
    }
    const src = ctx.t.SrcItemId;
    for (const spell of data.itemUse.get(src) ?? []) {
      const o = useItem(ctx, src, spell, { notPeople: true });
      if (o) return { how: 'item-spell', objectives: [o] };
    }
    return null;
  }

  const EVENT_METHODS = [byMapEvent, byAreaTrigger, byGossip, byObjectScript, byEvent, byCreatureAI, byQuestStart, byWaypoints, byItemSpell];

  /* Rows: { how, objectives } standing for a row a route cannot do as written, or { fail }. */

  /** A creature whose name the row's text names ("Sickly Deer cured" names the Sickly Deer), with open-world spawns. */
  function namedIn(text) {
    if (!text) return null;
    let best = null;
    for (const c of data.creatures.values()) {
      if (c.name.length < 6 || !c.name.includes(' ') || !new RegExp(`\\b${c.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(text)) continue;
      if (!spawnsOf('n', c.entry).length) continue;
      if (!best || c.name.length > best.name.length) best = c;
    }
    return best?.entry ?? null;
  }

  function forRow(ctx, row) {
    const { slot } = row;
    const named0 = row.kind === 'n' ? creatureName(row.id) : row.kind === 'o' ? objectName(row.id) : row.kind === 'i' ? itemName(row.id) : '';
    if (row.why === 'instance') return { fail: `${named0} is only inside an instance` };
    if (row.kind === 't') return null;
    // Cast a spell on the row's creature or object: the item that casts it.
    if (slot?.spell) {
      const items = [...(data.castBy.get(slot.spell) ?? [])].sort((a, b) => usable(ctx, b) - usable(ctx, a));
      for (const item of items) {
        const steps = usable(ctx, item) ? [] : acquire(ctx, item);
        if (!steps) continue;
        const pts = ctx.pick(spawnsOf(row.kind, row.id));
        if (pts.length)
          return {
            how: 'item-spell',
            objectives: [
              ...steps,
              { kind: 'item', item, ...(row.kind === 'n' ? { npc: row.id } : { object: row.id }), points: pts, text: `Use ${the(itemName(item))} on ${row.kind === 'n' ? someone(row.id, ctx) : the(named0)}` },
            ],
          };
        const stand = row.kind === 'n' ? namedIn(slot.text) : null;
        const o = useItem(ctx, item, slot.spell, { target: stand ? { kind: 'n', id: stand } : undefined });
        if (o) return { how: 'item-spell', objectives: [...steps, o] };
      }
      return { fail: `nothing says where to cast the spell for ${named0}` };
    }
    if (row.kind === 'n') {
      // A creature with no spawn of its own: what calls it up, then the fight (or, for a credit, what earns it there).
      const call = row.why === 'summoned' ? summonedHere(ctx, row.id, killLine(ctx, row.id)) : null;
      if (slot?.text) {
        const credit = creditFor(ctx, row, call);
        if (credit) return credit;
        // Nothing but its coming gives the credit: calling it up with the quest's own item is the objective.
        const trigger = call?.objectives[call.objectives.length - 2];
        if (trigger?.kind === 'item' && usable(ctx, trigger.item)) return { how: 'summon', objectives: call.objectives.slice(0, -1) };
        return { fail: `nothing says how "${slot.text}" is earned` };
      }
      if (call) return call;
      return { fail: `${named0} is summoned by something the quest's items do not do` };
    }
    if (row.kind === 'o') return { fail: `${named0} is not in the open world` };
    if (row.kind === 'i') {
      // Made by a spell of an item the player has for the quest, where that spell needs to be cast.
      const rowItems = fieldsOf(ctx.t, 'ReqItemId', 4);
      for (const spell of data.madeBy.get(row.id) ?? []) {
        for (const item of data.castBy.get(spell) ?? []) {
          // The item to use: held already, or found in the open world (a part the quest names but does not list).
          let steps = [];
          if (!ctx.a.items.has(item)) {
            steps = acquire(ctx, item);
            if (steps === null && !rowItems.includes(item)) continue;
            steps ??= [];
          }
          const s = data.spells.get(spell);
          const parts = [];
          let missing = false;
          for (const r of fieldsOf(s, 'reagent', 8)) {
            if (r === item || ctx.a.items.has(r)) continue;
            const got = acquire(ctx, r);
            if (got === null) {
              if (rowItems.includes(r)) continue; // another row of the quest: the route collects it
              missing = true;
            } else parts.push(...got);
          }
          if (missing) continue;
          const o = useItem(ctx, item, spell);
          const before = [...steps, ...parts];
          if (o) return { how: 'item-create', objectives: [...before, { ...o, text: createText(ctx, item, row.id, o) }] };
          // A spell that needs a place or a target nothing in the open world gives: not here.
          if (s.requiresSpellFocus || data.scriptTargets.has(spell) || data.itemTargets.has(item)) continue;
          // Nothing to say where. Parts put together (the spell takes reagents), or an item found in the open world and
          // used where it is found, are made anywhere; an item the quest hands out that nothing says where to use is not.
          if (!fieldsOf(s, 'reagent', 8).length && !steps.length) continue;
          // Made anywhere: where the last of the parts is found.
          const at = before.length ? before[before.length - 1].points : ctx.pick(ctx.ref);
          if (at.length) return { how: 'item-create', objectives: [...before, { kind: 'item', item, points: at, text: `Use ${the(itemName(item))} to make ${the(itemName(row.id))}` }] };
        }
      }
      // Made when a creature dies under the start item's channelled "death item" aura.
      const src = ctx.t.SrcItemId;
      for (const spell of data.itemUse.get(src) ?? []) {
        const s = data.spells.get(spell);
        if (s && [1, 2, 3].some((k) => s[`effectApplyAuraName${k}`] === AURA_CHANNEL_DEATH_ITEM)) {
          const o = useItem(ctx, src, spell, { kill: true });
          if (o) return { how: 'item-spell', objectives: [{ ...o, text: `${o.text} for ${the(named0)}` }] };
        }
      }
      // Dropped by a creature that only appears when something calls it up.
      for (const s0 of an.lootSources(row.id)) {
        if (s0.kind !== 'n' || data.creatureSpawns.has(s0.entry)) continue;
        const o = summonedHere(ctx, s0.entry, `Kill ${theOne(s0.entry, ctx)} for ${the(named0)}`, row.id);
        if (o) return o;
      }
      // Inside another item the player has or finds: open it (with the key the quest asks for, when it is locked).
      const opened = openContainer(ctx, row.id);
      if (opened) return opened;
      // Sold by a vendor.
      const shop = targetsOf(ctx, (data.vendors.get(row.id) ?? []).map((id) => ({ kind: 'n', id })));
      if (shop) return { how: 'vendor', objectives: [{ kind: 'talk', npc: shop.lead.id, item: row.id, points: ctx.pick(spawnsOf('n', shop.lead.id)), text: `Buy ${the(named0)} from ${creatureName(shop.lead.id)}` }] };
      // In a creature's pockets.
      const pocket = targetsOf(ctx, (data.pocketLoot.get(row.id) ?? []).map((id) => ({ kind: 'n', id })));
      if (pocket) return { how: 'pickpocket', objectives: [{ kind: 'kill', npc: pocket.lead.id, item: row.id, points: pocket.points, text: `Pick the pocket of ${someone(pocket.lead.id, ctx)} for ${the(named0)}` }] };
      return { fail: whyNoSource(row.id, named0) };
    }
    return null;
  }

  /**
   * A creature that only gives credit (its row has a text of its own): what earns it. The start item used on it, its
   * own AI answering a spell or emote, a gossip, an item spell; at the creature, or where `call` (summonedHere) calls
   * it up when it has no spawn of its own.
   */
  function creditFor(ctx, row, call) {
    const { slot } = row;
    // The row's own words when they say what to do ("Heal and fortify Sentinel Shaya"), not what is done ("Kodos Tamed").
    const own = slot?.text ?? '';
    const text = /^[A-Z][a-z]+\s/.test(own) && !/(ed|ing)$/.test(own.split(' ')[0]) && !/\w(ed|en)$/.test(own) ? own : null;
    const before = call ? call.objectives.slice(0, -1) : [];
    const where = call ? call.objectives[call.objectives.length - 1].points : null;
    const at = (o) => (o && where && !o.points.length ? { ...o, points: where } : o);
    const done = (how, o) => ({ how: call ? 'summon' : how, objectives: [...before, o] });
    const src = ctx.t.SrcItemId;
    for (const spell of data.itemUse.get(src) ?? []) {
      const targets = [...(data.itemTargets.get(src) ?? []), ...(data.scriptTargets.get(spell) ?? [])].map((x) => x.entry);
      if (targets.includes(row.id)) {
        const o = useItem(ctx, src, spell);
        if (o) return done('item-spell', o);
      }
    }
    for (const s of idx.byKill.get(row.id) ?? []) {
      if (!s.tags.has('')) continue;
      if (s.table === 'creature_ai_scripts') {
        for (const e of data.aiEvents.get(s.id) ?? []) {
          if (s.self && e.creature_id !== row.id) continue;
          const o = at(aiObjective(ctx, e, 'creature_ai', text ?? undefined, where));
          if (o?.points.length) return done('creature_ai', o);
        }
      }
      if (s.table === 'gossip_scripts') {
        // Credit for the creature itself (QUEST_CREDIT): talk to that creature, wherever it is; else to whoever has the menu.
        const owners = gossipOwners(s.id).filter((o) => o.kind === 'n');
        const found = s.self ? null : targetsOf(ctx, owners);
        const npc = found?.lead.id ?? (s.self || owners.some((o) => o.id === row.id) ? row.id : null);
        const own = npc ? ctx.pick(spawnsOf('n', npc)) : [];
        const points = found?.points ?? (own.length ? own : where);
        if (npc && points?.length) return done('gossip', { kind: 'talk', npc, points, text: text ?? `Talk to ${theOne(npc, ctx)}` });
      }
      if (s.table === 'spell') {
        for (const item of (data.castBy.get(s.id) ?? []).filter((i) => usable(ctx, i))) {
          const o = at(useItem(ctx, item, s.id, { target: { kind: 'n', id: row.id } }));
          if (o) return done('item-spell', o);
        }
      }
      if (s.table === 'areatrigger_scripts') {
        const t = data.triggers.get(s.id);
        const pts = t ? ctx.pick([{ map: t.map_id, x: t.x, y: t.y }]) : [];
        if (pts.length) return done('areatrigger', { kind: 'explore', points: pts, text: text ?? firstClause(ctx.t.Objectives) });
      }
    }
    // The start item's only spell, with nothing else to say what it is for: used on the row's creature.
    const uses = data.itemUse.get(src) ?? [];
    if (!call && ctx.a.reasons.includes('item') && uses.length === 1) {
      const s = data.spells.get(uses[0]);
      const plain = s && !s.requiresSpellFocus && [1, 2, 3].some((k) => s[`effect${k}`] === EFFECT.dummy || s[`effect${k}`] === EFFECT.scriptEffect) && !data.scriptTargets.has(uses[0]) && !data.itemTargets.has(src);
      const pts = ctx.pick(spawnsOf('n', row.id));
      if (plain && pts.length) return { how: 'item-spell', objectives: [{ kind: 'item', item: src, npc: row.id, points: pts, text: `Use ${the(itemName(src))} on ${someone(row.id, ctx)}` }] };
    }
    return null;
  }

  /** The line for a fight with a creature a script calls up: the quest's own words when they are about it alone. */
  function killLine(ctx, id) {
    const clause = firstClause(ctx.t.Objectives);
    const kills = (ctx.q.rq ?? []).filter((r) => r[0] === 'n').length;
    const name = creatureName(id).toLowerCase();
    if (kills === 1 && clause.length <= 80 && /^(kill|slay|defeat|destroy)\b/i.test(clause) && clause.toLowerCase().includes(name) && !/\band\b/.test(clause)) return clause;
    return `Defeat ${theOne(id, ctx)}`;
  }

  /** Where scripts put a creature they call up, near the given points (a summon row's own position), else those points. */
  function spotsNear(ctx, creature, near) {
    const spots = [];
    for (const sp of data.summonSpots.get(creature) ?? [])
      for (const p of near) if (Math.hypot(sp.x - p.x, sp.y - p.y) < NEAR) spots.push({ map: p.map, x: sp.x, y: sp.y });
    return spots.length ? ctx.pick(spots) : near;
  }

  /**
   * A creature with no spawn of its own: the step that calls it up (an item used at its place or on its target, an
   * object used, a creature killed, a gossip, or nothing when accepting the quest does it), then the kill, at the same
   * place: { how: 'summon', objectives }.
   */
  function summonedHere(ctx, creature, killText, item, depth = 0) {
    const kill = (points) => ({ kind: 'kill', npc: creature, ...(item ? { item } : {}), points: spotsNear(ctx, creature, points), text: killText });
    const result = (steps, trigger) => ({ how: 'summon', objectives: [...steps, ...(trigger ? [trigger] : []), kill(trigger ? trigger.points : steps[steps.length - 1].points)] });
    // Creatures that turn into it, or call it up, when hit by the spell of a quest item (the Aspect of Neptulon on the
    // plagued elementals): all of them are places to do it.
    const hits = [];
    for (const s of idx.bySummon.get(creature) ?? []) {
      if (s.table !== 'creature_ai_scripts') continue;
      for (const e of data.aiEvents.get(s.id) ?? [])
        if (e.event_type === AI.spellHit && e.creature_id !== creature)
          for (const it of data.castBy.get(e.event_param1) ?? []) if (usable(ctx, it)) hits.push({ kind: 'n', id: e.creature_id, item: it });
    }
    if (hits.length) {
      const it = hits[0].item;
      const found = targetsOf(ctx, hits.filter((h) => h.item === it));
      if (found) return result([], { kind: 'item', item: it, npc: found.lead.id, points: found.points, text: `Use ${the(itemName(it))} on ${someone(found.lead.id, ctx)}` });
    }
    for (const s of idx.bySummon.get(creature) ?? []) {
      // A quest item whose spell, or the event it sends, calls it up.
      const spells = s.table === 'spell' ? [s.id] : s.table === 'event_scripts' ? data.eventSpells.get(s.id) ?? [] : [];
      for (const spell of spells) {
        for (const it of [...(data.castBy.get(spell) ?? [])].sort((a, b) => usable(ctx, b) - usable(ctx, a))) {
          let steps = [];
          if (!usable(ctx, it)) {
            steps = acquire(ctx, it);
            if (!steps) continue;
          }
          const o = useItem(ctx, it, spell);
          if (o) return result(steps, o);
        }
      }
      // An object that calls it up when used (its event, or its own script).
      if (s.table === 'event_scripts') {
        const objects = targetsOf(ctx, (data.eventObjects.get(s.id) ?? []).map((id) => ({ kind: 'o', id })));
        if (objects) return result([], { kind: 'use', object: objects.lead.id, points: objects.points, text: `Use ${the(objectName(objects.lead.id))}` });
      }
      if (s.table === 'gameobject_scripts') {
        const g = data.objectByGuid.get(s.id);
        if (g && OPEN_MAPS.has(g.map)) return result([], { kind: 'use', object: g.id, points: ctx.pick([{ map: g.map, x: g.x, y: g.y }]), text: `Use ${the(objectName(g.id))}` });
      }
      // A creature whose death calls it up; one that is called up itself first (Lunaclaw, whose spirit comes when she falls).
      if (s.table === 'creature_ai_scripts') {
        for (const e of data.aiEvents.get(s.id) ?? []) {
          if (e.event_type !== AI.death || e.creature_id === creature) continue;
          const pts = ctx.pick(spawnsOf('n', e.creature_id));
          if (pts.length) return result([], { kind: 'kill', npc: e.creature_id, points: pts, text: `Kill ${someone(e.creature_id, ctx)} until ${theOne(creature, ctx)} appears` });
          if (depth < 2 && !an.anySpawns('n', e.creature_id).length) {
            const sub = summonedHere(ctx, e.creature_id, `Defeat ${theOne(e.creature_id, ctx)}`, undefined, depth + 1);
            if (sub) return { how: 'summon', objectives: [...sub.objectives, kill(sub.objectives[sub.objectives.length - 1].points)] };
          }
        }
      }
      // A quest taken while this one is on, whose turn-in calls it up (Digging Through the Dirt raises Eliza).
      if (s.table === 'quest_end_scripts') {
        for (const child of data.children.get(ctx.q.i) ?? []) {
          const c = data.quests.get(child);
          if (c?.CompleteScript !== s.id) continue;
          const found = targetsOf(ctx, (rawEnders.get(child) ?? []).map(([k, id]) => ({ kind: k, id })));
          if (!found) continue;
          const { lead } = found;
          const where = lead.kind === 'o' ? the(objectName(lead.id)) : theOne(lead.id, ctx);
          return result([], { kind: lead.kind === 'o' ? 'use' : 'talk', ...(lead.kind === 'o' ? { object: lead.id } : { npc: lead.id }), points: found.points, text: `Complete "${c.Title}" at ${where}` });
        }
      }
      // A gossip option that calls it up.
      if (s.table === 'gossip_scripts') {
        const found = targetsOf(ctx, gossipOwners(s.id).filter((o) => o.kind === 'n'));
        if (found) return result([], { kind: 'talk', npc: found.lead.id, points: found.points, text: `Talk to ${creatureName(found.lead.id)}` });
      }
      // The quest giver's own start script, or the path the giver walks after it: it comes when the quest is taken.
      if ((s.table === 'quest_start_scripts' && s.id === ctx.t.StartScript) || s.table === 'creature_movement_scripts') {
        const wps = s.table === 'creature_movement_scripts' ? data.movementByScript.get(s.id) ?? [] : [];
        const map = ctx.ref[0]?.map;
        // The giver's own start script puts it where its row says (on the giver's map), else by the giver.
        const placed = s.table === 'quest_start_scripts' ? (data.summonSpots.get(creature) ?? []).filter((sp) => sp.table === s.table && sp.id === s.id) : [];
        const at = wps.length
          ? ctx.pick(wps.map((w) => ({ map: w.map ?? map, x: w.x, y: w.y })))
          : placed.length && map !== undefined
            ? ctx.pick(placed.map((sp) => ({ map, x: sp.x, y: sp.y })))
            : ctx.giver
              ? ctx.pick(spawnsOf(ctx.giver[0], ctx.giver[1]))
              : [];
        // Walked by the quest's giver or ender, or on a path named for the quest or for them, or next to the giver.
        const ours = (w) =>
          w.creature ? ctx.people.has(w.creature) : w.path === ctx.q.i || ctx.people.has(w.path) || ctx.ref.some((r) => Math.hypot(r.x - w.x, r.y - w.y) < NEAR);
        if (at.length && (s.table === 'quest_start_scripts' || wps.some(ours))) return { how: 'summon', objectives: [kill(at)] };
      }
    }
    return null;
  }

  /** The map a script runs on: where its object, creature, waypoint or quest giver is. */
  function scriptMap(table, id, depth = 0) {
    const anyMap = (kind, entry) => (kind === 'n' ? data.creatureSpawns : data.objectSpawns).get(entry)?.[0]?.map;
    if (table === 'gameobject_scripts') return data.objectByGuid.get(id)?.map;
    if (table === 'creature_ai_scripts') for (const e of data.aiEvents.get(id) ?? []) if (anyMap('n', e.creature_id) !== undefined) return anyMap('n', e.creature_id);
    if (table === 'creature_movement_scripts') for (const w of data.movementByScript.get(id) ?? []) if (w.map !== null || anyMap('n', w.creature) !== undefined) return w.map ?? anyMap('n', w.creature);
    if (table === 'quest_start_scripts')
      for (const qid of data.startScriptOf.get(id) ?? [])
        for (const [k, e] of [...(rawGivers.get(qid) ?? [])]) if (anyMap(k, e) !== undefined) return anyMap(k, e);
    if (table === 'generic_scripts' && depth < 4) for (const st of data.genericStarters.get(id) ?? []) {
      const m = scriptMap(st.table, st.id, depth + 1);
      if (m !== undefined) return m;
    }
    return undefined;
  }

  /** Where a quest giver or ender with no spawn of its own appears: the position a script calls it up at. */
  function appearsAt(ctx, kind, id) {
    if (kind !== 'n' || spawnsOf('n', id).length) return null;
    const spots = (data.summonSpots.get(id) ?? []).map((sp) => ({ map: scriptMap(sp.table, sp.id), x: sp.x, y: sp.y }));
    const points = ctx.pick(spots.filter((p) => p.map !== undefined));
    return points.length ? { npc: id, points } : null;
  }

  /**
   * An item that comes in another item (item_loot_template): the container the player holds (the quest's item, an
   * earlier quest's reward) or finds in the open world, opened with the key the quest asks for when it is locked.
   */
  function openContainer(ctx, item) {
    for (const box of data.containers.get(item) ?? []) {
      let steps = [];
      if (!ctx.a.items.has(box)) {
        steps = acquire(ctx, box);
        if (!steps) continue;
      }
      let key = null;
      if (data.items.get(box)?.lock_id) {
        const opens = (k) => (data.itemUse.get(k) ?? []).some((s) => [1, 2, 3].some((n) => data.spells.get(s)?.[`effect${n}`] === EFFECT.openLock));
        key = [...fieldsOf(ctx.t, 'ReqSourceId', 4), ...fieldsOf(ctx.t, 'ReqItemId', 4)].find(opens);
        if (!key) continue;
        if (!ctx.a.items.has(key)) {
          const got = acquire(ctx, key);
          if (!got) continue;
          steps = [...got, ...steps];
        }
      }
      const at = steps.length ? steps[steps.length - 1].points : ctx.pick(ctx.ref);
      if (!at.length) continue;
      const text = key ? `Use ${the(itemName(key))} to open ${the(itemName(box))}` : `Open ${the(itemName(box))} for ${the(itemName(item))}`;
      return { how: 'container', objectives: [...steps, { kind: 'item', item: key ?? box, points: at, text }] };
    }
    return null;
  }

  /** Why nothing in the open world gives an item: what the database does say about where it comes from. */
  function whyNoSource(item, name) {
    if ((data.madeBy.get(item) ?? []).length) return `${name} is made with a profession (or a spell no quest item casts)`;
    if (data.fished.has(item)) return `${name} is fished`;
    if (data.skinned.has(item)) return `${name} is skinned`;
    if (data.containers.has(item)) return `${name} comes in another item (${(data.containers.get(item) ?? []).slice(0, 3).map(itemName).join(', ')})`;
    if (data.rewardedBy.has(item)) return `${name} is handed out by another quest (${(data.rewardedBy.get(item) ?? []).slice(0, 4).join(', ')})`;
    const inside = an.lootSources(item).filter((s) => an.anySpawns(s.kind, s.entry).length);
    if (inside.length) return `${name} only drops inside an instance`;
    if (an.lootSources(item).length) return `${name} drops from creatures or objects nothing places`;
    return `${name} comes from nothing in VMaNGOS`;
  }

  /** The line for making an item: the quest's own words when they say it in one step, else "Use X at Y". */
  function createText(ctx, item, made, o) {
    const clause = firstClause(ctx.t.Objectives);
    const verb = /^(fill|draw|collect a sample|use|energize|take a sample)\b/i.test(clause);
    const says = verb && (clause.includes(itemName(item)) || clause.includes(itemName(made)) || /\b(sample|water)\b/i.test(clause));
    if (says && clause.length <= 90 && !/\b(kill|slay|bring|return|deliver|and find)\b/i.test(clause)) {
      if (o.place && !/\s(at|in|from|near|by|to)\s/.test(clause)) return `${clause} at ${the(o.place)}`;
      return clause;
    }
    return o.text;
  }

  return { context, EVENT_METHODS, forRow, spawnsOf, creatureName, objectName, itemName, acquire, the, appearsAt };
}

/* ── The hand-written table ───────────────────────────────────────────── */

/**
 * static/quest-events.json:
 *   quests: { id: { objectives: [{ kind, npc?, object?, item?, text, rq?, at?, points? }], giver?, ender?, source } }
 *           at: where the objective is done when it is not where its npc or object stands (a creature summoned there):
 *               { npc | object | areatrigger: id or [ids], waypoint: [creature, point] }
 *           points: explicit places ({ map, x, y }), for a spot only a script or the core knows
 *           giver, ender: { npc | object, at? | points? } where to meet a giver or ender that has no spawn of its own, or
 *               that only offers the quest at one spot of its walk
 *   skip:   { id: reason } quests no objective can be given for (left out, even if a method would resolve them)
 *   text:   { id: [text, ...] } better lines for what a method resolves, by objective (null keeps the method's)
 */
function tablePoints(ctx, id, o, data, R, problems) {
  const list = (v) => (v === undefined ? [] : Array.isArray(v) ? v : [v]);
  for (const [k, map] of [
    ['npc', data.creatures],
    ['object', data.objects],
    ['item', data.items],
  ])
    if (o[k] !== undefined && !map.has(o[k])) problems.push(`quest-events.json ${id}: ${k} ${o[k]} is not in VMaNGOS`);
  let raw = [];
  if (o.points) raw = o.points;
  else if (o.at) {
    for (const n of list(o.at.npc)) {
      if (!data.creatures.has(n)) problems.push(`quest-events.json ${id}: at npc ${n} is not in VMaNGOS`);
      raw.push(...R.spawnsOf('n', n));
    }
    for (const g of list(o.at.object)) {
      if (!data.objects.has(g)) problems.push(`quest-events.json ${id}: at object ${g} is not in VMaNGOS`);
      raw.push(...R.spawnsOf('o', g));
    }
    for (const a of list(o.at.areatrigger)) {
      const t = data.triggers.get(a);
      if (t) raw.push({ map: t.map_id, x: t.x, y: t.y });
      else problems.push(`quest-events.json ${id}: area trigger ${a} is not in VMaNGOS`);
    }
    if (o.at.waypoint) {
      const [entry, point] = o.at.waypoint;
      const wp = (data.waypoints.get(entry) ?? []).find((w) => w.pointid === point);
      const map = data.creatureSpawns.get(entry)?.[0]?.map ?? ctx.ref[0]?.map;
      if (wp && map !== undefined) raw.push({ map, x: wp.x, y: wp.y });
      else problems.push(`quest-events.json ${id}: waypoint ${entry}/${point} is not in VMaNGOS`);
    }
  } else if (o.npc) raw = R.spawnsOf('n', o.npc);
  else if (o.object) raw = R.spawnsOf('o', o.object);
  const points = ctx.pick(raw);
  if (!points.length) problems.push(`quest-events.json ${id}: "${o.text ?? 'a place'}" has no open-world point`);
  return points;
}

function tableObjectives(ctx, entry, data, R, problems) {
  return (entry.objectives ?? []).map((o) => ({
    kind: o.kind,
    ...(o.npc ? { npc: o.npc } : {}),
    ...(o.object ? { object: o.object } : {}),
    ...(o.item ? { item: o.item } : {}),
    points: tablePoints(ctx, ctx.q.i, o, data, R, problems),
    text: o.text,
    ...(o.rq !== undefined ? { rq: o.rq } : {}),
  }));
}

/** A hand-written giver or ender placement: { npc | object, points }. */
function tablePlace(ctx, p, data, R, problems) {
  const points = tablePoints(ctx, ctx.q.i, p, data, R, problems);
  return points.length ? { ...(p.npc ? { npc: p.npc } : { object: p.object }), points } : null;
}

/* ── All quests ───────────────────────────────────────────────────────── */

/** Steps to get several items from the same creature or chest become one step; a step said twice is said once. */
function mergeSteps(objectives, R) {
  const out = [];
  for (const o of objectives) {
    if (o.rq === undefined && out.some((p) => p.kind === o.kind && p.npc === o.npc && p.object === o.object && p.item === o.item && p.text === o.text)) continue;
    const same = o.rq === undefined && o.item && (o.kind === 'kill' || o.kind === 'use') && out.find((p) => p.rq === undefined && p.items && p.kind === o.kind && p.npc === o.npc && p.object === o.object);
    if (same) {
      same.items.push(o.item);
      const names = same.items.map((i) => R.the(R.itemName(i)));
      const list = names.length > 3 ? `${names[0]} and ${names.length - 1} more` : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
      same.text = same.kind === 'use' ? same.text.replace(/^Take .* from /, `Take ${list} from `) : same.text.replace(/ for .*$/, ` for ${list}`);
      continue;
    }
    out.push(o.rq === undefined && o.item && (o.kind === 'kill' || o.kind === 'use') ? { ...o, items: [o.item] } : o);
  }
  return out.map(({ items, ...o }) => o);
}

/**
 * Resolves every quest of the leveling set that needs it. Returns { events, unresolved, notNeeded, scope, held,
 * problems }: events as questEvents returns it; unresolved and notNeeded as Map(id -> reason); scope as Map(id -> why
 * the quest was looked at: event, text, item, class, no-source, summoned, giver, ender, table); held as Map(id -> items
 * a row asks for that the player already has: handed out by an earlier quest of the chain or one taken alongside, in
 * an unlocked container they have, or required to be carried by the quest's RequiredCondition); problems as lines
 * (hand-written entries that do not fit VMaNGOS).
 */
export function resolveQuestEvents({ db, quests, table }) {
  const data = load(db);
  const graph = scriptGraph(data);
  const idx = completionIndex(data, graph);
  const an = analyser(data);
  const rawGivers = new Map();
  const rawEnders = new Map();
  for (const q of quests) {
    rawGivers.set(q.i, (q.st ?? []).filter(([k]) => k === 'n' || k === 'o'));
    rawEnders.set(q.i, (q.en ?? []).filter(([k]) => k === 'n' || k === 'o'));
  }
  const R = resolver(data, idx, an, rawGivers, rawEnders);
  const fixed = table ?? JSON.parse(readFileSync(SOURCE_TABLE, 'utf8'));
  const events = new Map();
  const unresolved = new Map();
  const notNeeded = new Map();
  const scope = new Map();
  const held = new Map();
  const problems = [];

  for (const q of quests) {
    if (!leveling(q)) continue;
    const t = data.quests.get(q.i);
    if (!t) continue;
    const a = an.analyse(q, t);
    if (a.held.length) held.set(q.i, a.held.map((h) => h.id));
    const ctx = R.context(q, t, a);
    // A giver or ender with no spawn of its own (a spirit a script calls up): where it appears.
    const place = {};
    for (const [field, list] of [
      ['giver', q.st],
      ['ender', q.en],
    ]) {
      const refs = (list ?? []).filter(([k]) => k === 'n' || k === 'o');
      if (!refs.length || refs.some(([k, id]) => R.spawnsOf(k, id).length)) continue;
      for (const [k, id] of refs) {
        const at = R.appearsAt(ctx, k, id);
        if (at) {
          place[field] = at;
          break;
        }
      }
    }
    for (const f of Object.keys(place)) a.reasons.push(f);
    if (!a.reasons.length && (fixed.quests?.[q.i] || fixed.skip?.[q.i])) a.reasons.push('table');
    if (!a.reasons.length) continue;
    scope.set(q.i, a.reasons);

    if (fixed.skip?.[q.i]) {
      unresolved.set(q.i, fixed.skip[q.i]);
      continue;
    }
    if (fixed.quests?.[q.i]) {
      const entry = fixed.quests[q.i];
      const objectives = tableObjectives(ctx, entry, data, R, problems);
      for (const field of ['giver', 'ender']) {
        const at = entry[field] && tablePlace(ctx, entry[field], data, R, problems);
        if (at) place[field] = at;
      }
      if (objectives.every((o) => o.points.length) && (objectives.length || Object.keys(place).length)) events.set(q.i, { how: 'static', objectives, ...place });
      else unresolved.set(q.i, 'the hand-written entry has no open-world point');
      continue;
    }

    const needEvent = a.reasons.includes('event');
    const rows = a.open.filter((o) => o.kind !== 't');
    const textRows = a.open.filter((o) => o.kind === 't');
    // The start item used on a creature the quest also asks to kill (Morbent's Bane on Morbent Fel).
    const hints = [];
    if (a.reasons.includes('item')) {
      const src = t.SrcItemId;
      for (const spell of data.itemUse.get(src) ?? []) {
        const targets = [...(data.itemTargets.get(src) ?? []), ...(data.scriptTargets.get(spell) ?? [])].filter((x) => x.type === 1).map((x) => x.entry);
        (q.rq ?? []).forEach((r, index) => {
          if (r[0] !== 'n' || !targets.includes(r[1]) || rows.some((o) => o.index === index) || hints.some((h) => h.rq === index)) return;
          const pts = ctx.pick(R.spawnsOf('n', r[1]));
          if (pts.length) hints.push({ kind: 'item', item: src, npc: r[1], points: pts, text: `Use ${R.the(R.itemName(src))} on ${R.creatureName(r[1])}, then kill it`, rq: index });
        });
      }
    }
    if (!needEvent && !rows.length && !textRows.length && !hints.length) {
      if (Object.keys(place).length) events.set(q.i, { how: 'summon', objectives: [], ...place });
      else notNeeded.set(q.i, a.reasons.includes('item') ? 'the item it hands out is only delivered' : 'its rows can be done as written');
      continue;
    }
    if (a.instanceOnly && !needEvent && rows.every((r) => r.why === 'instance')) {
      unresolved.set(q.i, 'what it asks for is only inside an instance');
      continue;
    }

    let eventObjectives = null;
    const hows = [];
    let failure = null;
    if (needEvent) {
      const fails = [];
      for (const m of R.EVENT_METHODS) {
        const r = m(ctx);
        if (!r) continue;
        if (r.fail) {
          fails.push(r.fail);
          continue;
        }
        if (!r.objectives.length || r.objectives.some((o) => !o.points.length)) continue;
        eventObjectives = r.objectives;
        hows.push(r.how);
        break;
      }
      if (!eventObjectives) failure = fails[0] ?? 'nothing in VMaNGOS says what completes it';
    }
    const rowObjectives = [];
    if (!failure) {
      for (const row of rows) {
        const covering = eventObjectives?.find((o) => (row.kind === 'n' && o.npc === row.id) || (row.kind === 'o' && o.object === row.id));
        if (covering) {
          if (covering.rq === undefined) covering.rq = row.index;
          continue;
        }
        const r = R.forRow(ctx, row);
        if (!r || r.fail) {
          failure = r?.fail ?? `row ${row.index} cannot be done as written`;
          break;
        }
        const objs = r.objectives;
        objs[objs.length - 1].rq = row.index;
        rowObjectives.push(...objs);
        if (!hows.includes(r.how)) hows.push(r.how);
      }
    }
    if (!failure) {
      for (const tr of textRows) {
        const twin = rows.find((r) => r.slot?.text && r.slot.text === tr.text);
        if (!eventObjectives && !twin) failure = `nothing says how "${tr.text}" is done`;
      }
    }
    if (failure) {
      unresolved.set(q.i, failure);
      continue;
    }
    if (hints.length && !hows.includes('item-spell')) hows.unshift('item-spell');
    // The quest's other parts (ReqSource items) the route would not know to collect.
    const parts = [];
    for (const item of fieldsOf(t, 'ReqSourceId', 4)) {
      if (ctx.acquired.has(item) || a.items.has(item)) continue;
      const steps = R.acquire(ctx, item);
      if (steps) parts.push(...steps);
    }
    const objectives = mergeSteps([...parts, ...hints, ...rowObjectives, ...(eventObjectives ?? [])].map(({ place, ...o }) => o), R);
    const better = fixed.text?.[q.i];
    if (better) better.forEach((line, k) => line && objectives[k] && (objectives[k].text = line));
    events.set(q.i, { how: hows.join('+'), objectives, ...place });
  }
  return { events, unresolved, notNeeded, scope, held, problems };
}

/**
 * Map(questId -> { how, objectives, giver?, ender? }) for the quests of the leveling set that need a scripted objective
 * (or a placement for a giver or ender) and have one. The quests that need one and have none are left out
 * (resolveQuestEvents lists them, with the reason): the route should leave them out. The map's `held` property is
 * resolveQuestEvents's held: the items a quest's rows ask for that the player already has. `table` replaces
 * static/quest-events.json (for tests).
 */
export function questEvents({ db, quests, log = () => {}, table }) {
  const r = resolveQuestEvents({ db, quests, table });
  const methods = {};
  for (const e of r.events.values()) methods[e.how] = (methods[e.how] ?? 0) + 1;
  log(
    `events: ${r.scope.size} quests looked at, ${r.events.size} given objectives (${Object.entries(methods)
      .sort((a, b) => b[1] - a[1])
      .map(([k, v]) => `${k} ${v}`)
      .join(', ')}), ${r.notNeeded.size} need none, ${r.unresolved.size} left out`,
  );
  for (const p of r.problems) log(`events: ${p}`);
  // Items a quest's rows ask for that the player has already, for the quests that need nothing else (Map(id -> items)).
  r.events.held = r.held;
  return r.events;
}
