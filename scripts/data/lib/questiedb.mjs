// Reads QuestieDB (GPLv3, https://github.com/Questie/QuestieDB), the database behind Questie's Forever support, from a
// checkout: Forever's quests, creatures, objects and items as Questie composes them, its quest experience and its dungeon
// entrances.
//
// QuestieDB layers its Forever data (docs/forever.md): the raw base (Classic's data on Forever's maps) -> generated
// delta-base (src/corrections/Forever/generated) -> traces of real play (src/corrections/Forever/traces) -> quest relations
// from the same traces -> authored fixes (src/corrections/Forever/forever*Fixes.lua, their static Load() only). Each later
// layer replaces a field, or adds to and removes from it (`field_add`, `field_remove`). The inherited Classic corrections
// (src/corrections/legacy) are not read: Grimoire keeps VMaNGOS for Classic's quests and takes from QuestieDB what Forever
// adds. Its own docs say what is incomplete: the delta-base has no complete objectives, rewards or chains, and the traces
// only hold what players met (docs/forever-delta-base.md); quest experience comes from the traces alone
// (support/Forever/QuestXP/xpDB-traces.lua).
//
// Places stay as QuestieDB stores them: a zone (area id) and x, y in percent of Forever's map of that zone. Forever's map
// rectangles in world yards are in data/Forever/conversion.json (`target_bounds`), for the zones that existed in Classic.

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { luaList, readLua } from './lua.mjs';

/* ── Named constants the Lua files use (src/corrections/enum) ── */
const categoryNames = new Map();
function constants(dir) {
  const read = (file, table) => {
    const f = path.join(dir, 'src', 'corrections', 'enum', file);
    if (!existsSync(f)) return new Map();
    const text = readFileSync(f, 'utf8');
    const at = text.indexOf(`${table} = {`);
    if (at < 0) return new Map();
    const raceMask = new Map([[1, 1], [2, 2], [3, 4], [4, 8], [5, 16], [6, 32], [7, 64], [8, 128], [9, 256], [95, 4294967296], [96, 8589934592]]);
    return readLua(text, at + table.length + 3, (p) => {
      const m = /^raceMaskById\[(\d+)\]$/.exec(p);
      return m ? raceMask.get(Number(m[1])) : undefined;
    }).value;
  };
  const zoneIDs = read('zones.lua', 'constants.zoneIDs');
  const sortKeys = read('quests.lua', 'constants.sortKeys');
  // Forever's race keys (expansions.lua); its class keys fall back to Classic's (docs/forever.md). NONE (0) is every race:
  // an authored fix that sets it widens a quest the generated base gave to one side.
  const races = { NONE: 0, HUMAN: 1, ORC: 2, DWARF: 4, NIGHT_ELF: 8, UNDEAD: 16, TAUREN: 32, GNOME: 64, TROLL: 128, GOBLIN: 256, SKYBORNE_ALLIANCE: 4294967296, SKYBORNE_HORDE: 8589934592 };
  races.ALL_ALLIANCE = races.HUMAN + races.DWARF + races.NIGHT_ELF + races.GNOME + races.SKYBORNE_ALLIANCE;
  races.ALL_HORDE = races.ORC + races.UNDEAD + races.TAUREN + races.TROLL + races.SKYBORNE_HORDE;
  const classes = { NONE: 0, WARRIOR: 1, PALADIN: 2, HUNTER: 4, ROGUE: 8, PRIEST: 16, SHAMAN: 64, MAGE: 128, WARLOCK: 256, DRUID: 1024, ALL_CLASSES: 1503 };
  // the names of the categories, for the coverage table (CAMPING, CRAFTING, RIVERGLADES...)
  categoryNames.clear();
  for (const t of [zoneIDs, sortKeys]) for (const [k, v] of t) if (Number.isFinite(v) && !categoryNames.has(v)) categoryNames.set(v, k);
  return (p) => {
    const [head, key] = p.split('.');
    if (/^(questKeys|npcKeys|objectKeys|itemKeys)$/.test(head)) return key;
    if (head === 'raceIDs' || head === 'raceKeys') return races[key];
    if (head === 'classIDs' || head === 'classKeys') return classes[key];
    if (head === 'zoneIDs') return zoneIDs.get(key);
    if (head === 'sortKeys') return sortKeys.get(key);
    return undefined;
  };
}

/* ── Reading the layers ── */

/** The rows of a raw entity file (`QuestieDB.questData = [[return { [id] = {...}, ... }]]`), each a Map of field name to value. */
function rawRows(file, keyName, name) {
  const text = readFileSync(file, 'utf8');
  const keysAt = text.indexOf(`QuestieDB.${keyName} = {`);
  const keys = new Map();
  // (the commented lines under a key name its parts: they are not keys)
  for (const m of text.slice(keysAt, text.indexOf('\n}', keysAt)).matchAll(/^\s*\['(\w+)'\] = (\d+)/gm)) keys.set(Number(m[2]), m[1]);
  const open = text.indexOf('[[return {');
  const body = text.slice(open + 2, text.indexOf(']]', open + 10));
  const table = readLua(body, body.indexOf('{'), name).value;
  const out = new Map();
  for (const [id, row] of table) {
    const rec = new Map();
    luaList(row).forEach((v, i) => {
      if (v !== undefined) rec.set(keys.get(i + 1), v);
    });
    out.set(id, rec);
  }
  return out;
}

/** The table a correction file's static `Load()` returns: id -> Map of field (with _add/_remove) to value. */
function correctionRows(file, module, name) {
  if (!existsSync(file)) return new Map();
  const text = readFileSync(file, 'utf8');
  const fn = text.indexOf(`function ${module}:Load()`);
  if (fn < 0) throw new Error(`questiedb: ${path.basename(file)} has no ${module}:Load()`);
  const ret = text.indexOf('return {', fn);
  return readLua(text, ret + 'return '.length, name).value;
}

/** The header line a generated file names its date in ("Generated at: 2026-11-13T16:53:39.310Z"). */
function generatedAt(file) {
  const m = existsSync(file) ? /Generated at: (\d{4}-\d\d-\d\d)/.exec(readFileSync(file, 'utf8').slice(0, 2000)) : null;
  return m?.[1] ?? null;
}

// A list field's operand (`{nil,{424005}}` for an object starter) as a JS array of its slots.
const slots = (v) => (v instanceof Map ? luaList(v) : v);
const asList = (v) => (v instanceof Map ? luaList(v).filter((x) => x !== undefined) : []);

/** Applies a correction layer to a set of records. A plain field replaces; `_add` and `_remove` change a list (or a list
 * of lists, slot by slot: a quest's starters by creature, object and item). */
function apply(records, layer) {
  for (const [id, fields] of layer) {
    if (!(fields instanceof Map)) continue;
    let rec = records.get(id);
    if (!rec) records.set(id, (rec = new Map()));
    for (const [k, v] of fields) {
      const op = /^(.*)_(add|remove)$/.exec(k);
      if (!op) {
        rec.set(k, v);
        continue;
      }
      const [, field, how] = op;
      const cur = rec.get(field);
      const nested = v instanceof Map && [...v.values()].some((x) => x instanceof Map);
      if (nested) {
        // slot by slot: {creatures}, {objects}, {items}
        const have = slots(cur) ?? [];
        const change = slots(v);
        const out = new Map();
        const n = Math.max(have.length, change.length);
        for (let i = 0; i < n; i++) {
          const a = asList(have[i]);
          const b = asList(change[i]);
          const merged = how === 'add' ? [...a, ...b.filter((x) => !a.includes(x))] : a.filter((x) => !b.includes(x));
          if (merged.length) out.set(i + 1, new Map(merged.map((x, j) => [j + 1, x])));
        }
        rec.set(field, out);
      } else {
        const a = asList(cur);
        const b = asList(v);
        const merged = how === 'add' ? [...a, ...b.filter((x) => !a.includes(x))] : a.filter((x) => !b.includes(x));
        rec.set(field, new Map(merged.map((x, j) => [j + 1, x])));
      }
    }
  }
}

/** Spawns as stored ({[zone] = {{x, y}, ...}}) as a list of { area, x, y }; an instance's sentinel (-1, -1) is left out. */
export function spawnList(v) {
  const out = [];
  if (!(v instanceof Map)) return out;
  for (const [area, pts] of v)
    for (const p of asList(pts)) {
      const [x, y] = luaList(p);
      if (Number.isFinite(x) && Number.isFinite(y) && x >= 0 && y >= 0) out.push({ area: Number(area), x, y });
    }
  return out;
}

/**
 * Reads a QuestieDB checkout.
 * @returns { version, commit, date, quests, npcs, objects, items, xp, dungeons, bounds, layers, touched, base }
 *   quests/npcs/objects/items: Map(id -> Map(field -> value)), composed through the layers;
 *   xp: Map(quest -> [level, experience]) from the traces; dungeons: Map(area -> { name, alt, parent, entrances });
 *   bounds: Map(area -> { left, right, top, bottom, map, ui }) from conversion.json; layers: what each layer held;
 *   touched: kind -> Map(id -> the layers that changed it); base: kind -> the ids of the raw base (Classic's).
 */
export function readQuestieDB(dir) {
  if (!existsSync(path.join(dir, 'data', 'Forever', 'foreverQuestDB.lua'))) throw new Error(`questiedb: ${dir} is not a QuestieDB checkout with its Forever data`);
  const name = constants(dir);
  const F = (...p) => path.join(dir, ...p);
  const C = (...p) => F('src', 'corrections', 'Forever', ...p);

  const quests = rawRows(F('data', 'Forever', 'foreverQuestDB.lua'), 'questKeys', name);
  const npcs = rawRows(F('data', 'Forever', 'foreverNpcDB.lua'), 'npcKeys', name);
  const objects = rawRows(F('data', 'Forever', 'foreverObjectDB.lua'), 'objectKeys', name);
  const items = rawRows(F('data', 'Forever', 'foreverItemDB.lua'), 'itemKeys', name);
  const layers = { raw: { quests: quests.size, npcs: npcs.size, objects: objects.size, items: items.size } };
  // What the raw base holds is Classic's; anything a later layer adds is Forever's own.
  const base = { quests: new Set(quests.keys()), npcs: new Set(npcs.keys()), objects: new Set(objects.keys()), items: new Set(items.keys()) };
  const steps = [
    ['legacy', 'quests', quests, C('legacy', 'classicQuestFixes.lua'), 'QuestieQuestFixes'],
    ['legacy', 'npcs', npcs, C('legacy', 'classicNPCFixes.lua'), 'QuestieNPCFixes'],
    ['legacy', 'objects', objects, C('legacy', 'classicObjectFixes.lua'), 'QuestieObjectFixes'],
    ['legacy', 'items', items, C('legacy', 'classicItemFixes.lua'), 'QuestieItemFixes'],
    ['generated', 'quests', quests, C('generated', 'foreverBaseQuest.lua'), 'ForeverBaseQuest'],
    ['generated', 'npcs', npcs, C('generated', 'foreverBaseNpc.lua'), 'ForeverBaseNpc'],
    ['generated', 'objects', objects, C('generated', 'foreverBaseObject.lua'), 'ForeverBaseObject'],
    ['generated', 'items', items, C('generated', 'foreverBaseItem.lua'), 'ForeverBaseItem'],
    ['traces', 'quests', quests, C('traces', 'foreverQuestTraces.lua'), 'ForeverQuestTraces'],
    ['traces', 'npcs', npcs, C('traces', 'foreverNpcTraces.lua'), 'ForeverNpcTraces'],
    ['traces', 'objects', objects, C('traces', 'foreverObjectTraces.lua'), 'ForeverObjectTraces'],
    ['traces', 'items', items, C('traces', 'foreverItemTraces.lua'), 'ForeverItemTraces'],
    ['relations', 'quests', quests, C('traces', 'foreverQuestRelationTraces.lua'), 'ForeverQuestRelationTraces'],
    ['fixes', 'quests', quests, C('foreverQuestFixes.lua'), 'ForeverQuestFixes'],
    ['fixes', 'npcs', npcs, C('foreverNPCFixes.lua'), 'ForeverNpcFixes'],
    ['fixes', 'objects', objects, C('foreverObjectFixes.lua'), 'ForeverObjectFixes'],
    ['fixes', 'items', items, C('foreverItemFixes.lua'), 'ForeverItemFixes'],
  ];
  const touched = { quests: new Map(), npcs: new Map(), objects: new Map(), items: new Map() };
  for (const [layer, kind, records, file, module] of steps) {
    const rows = correctionRows(file, module, name);
    apply(records, rows);
    (layers[layer] ??= {})[kind] = rows.size;
    for (const id of rows.keys()) {
      if (!touched[kind].has(id)) touched[kind].set(id, new Set());
      touched[kind].get(id).add(layer);
    }
  }

  // Quest experience: QuestXP.db[id] = {level, experience}, from the traces (xpDB-traces.lua).
  const xp = new Map();
  const xpFile = F('support', 'Forever', 'QuestXP', 'xpDB-traces.lua');
  for (const m of readFileSync(xpFile, 'utf8').matchAll(/^QuestXP\.db\[(\d+)\] = \{(\d+), (\d+)\}/gm)) xp.set(Number(m[1]), [Number(m[2]), Number(m[3])]);

  // Dungeon entrances: dungeons[area] = {name, {alternative areas}, parent zone, {{zone, x, y}, ...}}.
  const dungeons = new Map();
  {
    const text = readFileSync(F('support', 'Forever', 'Zones', 'dungeons.lua'), 'utf8');
    const at = text.indexOf('local dungeons = {');
    for (const [area, row] of readLua(text, at + 'local dungeons = '.length, name).value) {
      const [n, alt, parent, entrances] = luaList(row);
      dungeons.set(area, { name: n, alt: asList(alt), parent, entrances: asList(entrances).map((e) => luaList(e)).map(([a, x, y]) => ({ area: a, x, y })) });
    }
  }

  // Forever's map rectangles in world yards (conversion.json's target bounds), for the zones Classic had.
  const bounds = new Map();
  const conv = JSON.parse(readFileSync(F('data', 'Forever', 'conversion.json'), 'utf8'));
  for (const t of conv.geometry.transforms) if (t.area_transform_supported) bounds.set(t.area_id, { ...t.target_bounds, map: t.map_id, ui: t.ui_map_id });

  // Version (the .toc), commit (the checkout's HEAD) and the day the traces were generated.
  const version = /## Version:\s*(\S+)/.exec(readFileSync(F('QuestieDB.toc'), 'utf8'))?.[1] ?? 'unknown';
  let commit = 'unknown';
  try {
    const head = readFileSync(F('.git', 'HEAD'), 'utf8').trim();
    const ref = head.startsWith('ref: ') ? head.slice(5) : null;
    if (!ref) commit = head;
    else if (existsSync(F('.git', ref))) commit = readFileSync(F('.git', ref), 'utf8').trim();
    else commit = new RegExp(`^([0-9a-f]{40}) ${ref}$`, 'm').exec(readFileSync(F('.git', 'packed-refs'), 'utf8'))?.[1] ?? 'unknown';
  } catch {
    commit = 'unknown';
  }
  const date = [C('traces', 'foreverQuestTraces.lua'), C('traces', 'foreverNpcTraces.lua'), xpFile].map(generatedAt).filter(Boolean).sort().pop() ?? null;
  return { version, commit, date, quests, npcs, objects, items, xp, dungeons, bounds, layers, touched, base };
}

/* ── Fields as plain values ── */

/** A quest's givers and takers: { st: [['n', id] | ['o', id] | ['i', id]], en: [['n', id] | ['o', id]] }. */
export function questEnds(rec) {
  const by = (v, kinds) => (slots(v) ?? []).flatMap((ids, i) => asList(ids).map((id) => [kinds[i], id])).filter((x) => x[0]);
  return { st: by(rec.get('startedBy'), ['n', 'o', 'i']), en: by(rec.get('finishedBy'), ['n', 'o']) };
}

/** A quest's objectives as [kind, id, text]: n (kill), o (use an object), i (collect an item), k (kill credit, its first creature). */
export function questObjectives(rec) {
  const o = slots(rec.get('objectives')) ?? [];
  const out = [];
  for (const [i, kind] of [
    [0, 'n'],
    [1, 'o'],
    [2, 'i'],
  ])
    for (const e of asList(o[i])) {
      const [id, text] = luaList(e);
      if (Number.isFinite(id)) out.push([kind, id, typeof text === 'string' ? text : null]);
    }
  for (const e of asList(o[4])) {
    const [list, base, text] = luaList(e);
    const id = base ?? asList(list)[0];
    if (Number.isFinite(id)) out.push(['k', id, typeof text === 'string' ? text : null, asList(list)]);
  }
  return out;
}

/** The side a race mask allows: 1 Alliance, 2 Horde, 3 both (0 or a mask of both sides). */
export function sideOf(mask) {
  const a = 1 + 4 + 8 + 64 + 4294967296;
  const h = 2 + 16 + 32 + 128 + 8589934592;
  if (!mask) return 3;
  // the masks pass 32 bits (the Skyborne): test with arithmetic, not bit operators
  const has = (m) => [1, 2, 4, 8, 16, 32, 64, 128, 4294967296, 8589934592].some((b) => m % (b * 2) >= b && (mask % (b * 2) >= b));
  const ally = has(a);
  const horde = has(h);
  return ally && !horde ? 1 : horde && !ally ? 2 : 3;
}

/* ── Merging into Grimoire's data ── */

// Grimoire's quest groups (c2) for a QuestieDB category: a zone's continent, or the class, profession and event sorts.
const CLASS_SORTS = new Set([-61, -81, -82, -141, -161, -162, -261, -262, -263]);
const PROF_SORTS = new Set([-24, -101, -121, -181, -182, -201, -264, -304, -324]);
const EVENT_SORTS = new Set([-22, -364, -366, -369, -1001, -1002, -1003, -1004, -1005, -1006, -365, -368]);

/** The entity's reaction to each side as Grimoire writes it ("fh": friendly to the Alliance, hostile to the Horde). */
function reactionOf(rec, sides) {
  const f = rec.get('friendlyToFaction');
  if (typeof f === 'string') return `${f.includes('A') ? 'f' : 'h'}${f.includes('H') ? 'f' : 'h'}`;
  // No faction in the data: a quest giver is friendly to the sides of its quests.
  if (sides.size) return `${sides.has(1) || sides.has(3) ? 'f' : 'h'}${sides.has(2) || sides.has(3) ? 'f' : 'h'}`;
  return 'hh';
}

/**
 * Merges QuestieDB into a finished data/ (or into build.mjs's world before it is written): Classic's quests keep
 * VMaNGOS's text and gain the givers and takers that are new in Forever; Forever's own quests take everything from
 * QuestieDB (name, levels, side, zone, experience, objectives, givers, takers, chain); the creatures, objects and items
 * they name are added where data/ has none. Running it twice gives the same data.
 * @param data { quests: data/quests.json, npcs: data/npcs.json, objects: data/objects.json, minor: data/minor-items.json, zones: data/zones.json }
 * @param qdb readQuestieDB()
 * @returns { forever, added, updated, classicGained, npcsAdded, objectsAdded, itemsAdded }
 */
export function mergeQuestieDB(data, qdb) {
  const byId = new Map(data.quests.map((q) => [q.i, q]));
  const zoneCat = new Map((data.zones ?? []).map((z) => [z.id, z.cat]));
  const report = { forever: 0, added: 0, updated: 0, classicGained: 0, npcsAdded: 0, objectsAdded: 0, itemsAdded: 0 };
  const wantNpcs = new Map(); // id -> sides of the quests it gives or takes
  const wantObjects = new Set();
  const wantItems = new Set();
  // the zone a quest's giver stands in (QuestieDB's best guess for the creature or object, or its first spawn)
  const giverZone = (st) => {
    const g = st.find(([k]) => k === 'n' || k === 'o');
    const rec = g && (g[0] === 'n' ? qdb.npcs : qdb.objects).get(g[1]);
    return rec ? Number(rec.get('zoneID')) || spawnList(rec.get('spawns'))[0]?.area || 0 : 0;
  };
  const want = (k, id, side) => {
    if (k === 'n') {
      if (!wantNpcs.has(id)) wantNpcs.set(id, new Set());
      if (side) wantNpcs.get(id).add(side);
    } else if (k === 'o') wantObjects.add(id);
    else if (k === 'i') wantItems.add(id);
  };
  for (const [id, rec] of qdb.quests) {
    const name = rec.get('name');
    if (qdb.base.quests.has(id) || typeof name !== 'string' || !name.trim()) continue;
    const old = byId.get(id);
    if (old && old.ch === 'c') continue; // a Classic quest VMaNGOS has: below
    const { st, en } = questEnds(rec);
    const side = sideOf(rec.get('requiredRaces'));
    const z = Number(rec.get('zoneOrSort')) || 0;
    const classes = Number(rec.get('requiredClasses')) || 0;
    const level = Number(rec.get('questLevel')) || 0;
    const xp = qdb.xp.get(id)?.[1];
    const text = asList(rec.get('objectivesText')).join('\n').trim();
    // A creature of the quest's own side is someone to speak to, heal or find, not to kill: its name, without "slain".
    // (QuestieDB gives no objective counts: a count of 1 shows none.)
    const friendly = (id) => {
      const f = qdb.npcs.get(id)?.get('friendlyToFaction');
      return typeof f === 'string' && (side === 3 ? f.length > 0 : f.includes(side === 1 ? 'A' : 'H'));
    };
    const rq = questObjectives(rec).map(([k, oid, t]) =>
      (k === 'n' || k === 'k') && friendly(oid) && !t ? ['t', oid, qdb.npcs.get(oid).get('name'), 1] : [k === 'k' ? 'n' : k, oid, t, 1],
    );
    // the quest before it: the one QuestieDB names when it names one (of several, any one opens it: the routes read them all)
    const single = asList(rec.get('preQuestSingle'));
    const group = asList(rec.get('preQuestGroup'));
    const pre = single.length === 1 ? single : single.length ? [] : group;
    const next = Number(rec.get('nextQuestInChain')) || 0;
    const q = {
      i: id,
      n: name.trim(),
      l: level > 0 ? level : Number(rec.get('requiredLevel')) || 0,
      r: Number(rec.get('requiredLevel')) || 0,
      s: side,
      z,
      // its group: its zone's continent; a quest QuestieDB files under no zone, the continent of the zone its giver stands in
      c2: z > 0 ? (zoneCat.has(z) && zoneCat.get(z) >= 0 ? zoneCat.get(z) : 7) : CLASS_SORTS.has(z) ? 4 : PROF_SORTS.has(z) ? 5 : z === -25 ? 6 : EVENT_SORTS.has(z) ? 9 : z === 0 && zoneCat.get(giverZone(st)) >= 0 ? zoneCat.get(giverZone(st)) : 7,
      ...(classes && (classes & 1503) !== 1503 ? { rc: classes } : {}),
      ...(xp ? { xp } : {}),
      ch: 'n',
      ...(text ? { o: text } : {}),
      ...(rq.length ? { rq } : {}),
      ...(st.length ? { st } : {}),
      ...(en.length ? { en } : {}),
      ...(pre.length ? { pv: pre[0] } : {}),
      ...(next > 0 ? { nx: next } : {}),
      // kept from before: the group size LibQuestDB recorded, and the lines lib/live.mjs writes from Blizzard's hotfixes
      ...(old?.gp ? { gp: old.gp } : {}),
      ...(old?.cl ? { cl: old.cl } : {}),
      qd: 1,
    };
    if (old) Object.keys(old).forEach((k) => delete old[k]);
    if (old) Object.assign(old, q);
    else {
      data.quests.push(q);
      byId.set(id, q);
    }
    report.forever++;
    report[old ? 'updated' : 'added']++;
    for (const [k, eid] of [...st, ...en]) want(k, eid, side);
    for (const [k, oid] of rq) want(k, oid);
  }
  // Classic quests: the givers and takers QuestieDB places that only Forever has (its new creatures and objects).
  for (const q of data.quests) {
    if (q.ch !== 'c') continue;
    const rec = qdb.quests.get(q.i);
    if (!rec) continue;
    const { st, en } = questEnds(rec);
    const isNew = (k, eid) => (k === 'n' ? !qdb.base.npcs.has(eid) : k === 'o' ? !qdb.base.objects.has(eid) : false);
    let gained = false;
    for (const [list, key] of [
      [st, 'st'],
      [en, 'en'],
    ])
      for (const [k, eid] of list) {
        if (!isNew(k, eid) || (q[key] ?? []).some((x) => x[0] === k && x[1] === eid)) continue;
        (q[key] ??= []).push([k, eid]);
        want(k, eid, q.s);
        gained = true;
      }
    if (gained) report.classicGained++;
  }
  data.quests.sort((a, b) => a.i - b.i);

  // The creatures, objects and items they name, where data/ has none: what drops a quest item comes with it.
  for (const id of wantItems) {
    const it = qdb.items.get(id);
    if (!it) continue;
    for (const n of asList(it.get('npcDrops'))) want('n', n);
    for (const o of asList(it.get('objectDrops'))) want('o', o);
    if (!data.minor[id] && typeof it.get('name') === 'string') {
      // [name, quality, icon, class, subclass, item level, required level, price, stack, quest it starts]: QuestieDB has no
      // quality, icon, price or stack size; a quest item is shown as a common one with the default icon.
      data.minor[id] = [it.get('name'), 1, 'inv_misc_questionmark', Number(it.get('class')) || 12, Number(it.get('subClass')) || 0, Number(it.get('itemLevel')) || 0, Number(it.get('requiredLevel')) || 0, 0, 1, Number(it.get('startQuest')) || 0];
      report.itemsAdded++;
    }
  }
  for (const [id, sides] of wantNpcs) {
    const n = qdb.npcs.get(id);
    if (data.npcs[id] || !n || typeof n.get('name') !== 'string') continue;
    const zone = Number(n.get('zoneID')) || spawnList(n.get('spawns'))[0]?.area || 0;
    data.npcs[id] = [n.get('name'), n.get('subName') || '', Number(n.get('minLevel')) || 0, Number(n.get('maxLevel')) || Number(n.get('minLevel')) || 0, Number(n.get('rank')) || 0, reactionOf(n, sides), zone, Number(n.get('npcFlags')) || 0, 0];
    report.npcsAdded++;
  }
  for (const id of wantObjects) {
    const o = qdb.objects.get(id);
    if (data.objects[id] || !o || typeof o.get('name') !== 'string') continue;
    data.objects[id] = [o.get('name'), Number(o.get('zoneID')) || spawnList(o.get('spawns'))[0]?.area || 0, 0];
    report.objectsAdded++;
  }
  return report;
}

/** QuestieDB as data/meta.json names it. */
export function questieMeta(qdb) {
  return { name: 'QuestieDB', url: 'https://github.com/Questie/QuestieDB', license: 'GPLv3', version: qdb.version, commit: qdb.commit, date: qdb.date };
}

// Forever's new dungeons by the area QuestieDB files their quests under (src/corrections/enum/zones.lua).
export const NEW_DUNGEON_AREAS = {
  'hall-of-thanes': [16919],
  'ruins-of-lordaeron': [16611, 16612, 16614, 16615, 16617],
  'whelgars-excavation': [16732, 16876, 16877, 16878, 16879, 16880, 17732],
  'city-of-dalaran': [16544, 16558, 16559],
  'kroldok-stronghold': [17780],
  'shapers-terrace': [16985],
};

/** How complete QuestieDB's Forever quests are, as two tables (by zone, by new dungeon): quests, those with a giver
 * placed, a taker placed, every objective placed (of those that list one), and all three. */
export function asCoverage(d, qdb, { zoneNames = {}, dungeons = [] } = {}) {
  const placedN = (id) => spawnList(qdb.npcs.get(id)?.get('spawns')).length > 0;
  const placedO = (id) => spawnList(qdb.objects.get(id)?.get('spawns')).length > 0;
  const placed = ([k, id]) => (k === 'n' ? placedN(id) : k === 'o' ? placedO(id) : k === 'i');
  const itemPlaced = (id) => {
    const it = qdb.items.get(id);
    return Boolean(it) && (asList(it.get('npcDrops')).some(placedN) || asList(it.get('objectDrops')).some(placedO));
  };
  const rows = new Map();
  const add = (key, q) => {
    if (!rows.has(key)) rows.set(key, { n: 0, giver: 0, taker: 0, objectives: 0, listed: 0, all: 0 });
    const r = rows.get(key);
    const giver = (q.st ?? []).some(placed);
    const taker = (q.en ?? []).some(placed);
    const objs = q.rq ?? [];
    const located = objs.every(([k, id]) => (k === 'n' || k === 't' ? placedN(id) : k === 'o' ? placedO(id) : k === 'i' ? itemPlaced(id) : false));
    r.n++;
    if (giver) r.giver++;
    if (taker) r.taker++;
    if (objs.length) r.listed++;
    if (objs.length && located) r.objectives++;
    if (giver && taker && located) r.all++;
  };
  const areaOf = (q) => {
    if (q.z > 0) return q.z;
    const g = (q.st ?? []).find(([k]) => k === 'n' || k === 'o');
    return g ? spawnList((g[0] === 'n' ? qdb.npcs : qdb.objects).get(g[1])?.get('spawns'))[0]?.area ?? 0 : 0;
  };
  const forever = d.quests.filter((q) => q.qd);
  for (const q of forever) add(q.z < 0 ? `sort ${q.z}` : areaOf(q) || 'no zone', q);
  const line = (c) => `| ${c.join(' | ')} |`;
  const head = ['quests', 'giver placed', 'taker placed', 'objectives placed (of listed)', 'all three (no objective listed counts as placed)'];
  const fmt = (r) => [r.n, r.giver, r.taker, `${r.objectives} of ${r.listed}`, `${r.all} (${Math.round((100 * r.all) / r.n)}%)`];
  const out = [line(['zone', ...head]), line(['---', ...head.map(() => '---')])];
  const label = (k) => (typeof k === 'number' ? `${zoneNames[k] ?? qdb.dungeons.get(k)?.name ?? categoryNames.get(k) ?? 'area'} (${k})` : k.startsWith('sort ') ? `${categoryNames.get(Number(k.slice(5))) ?? 'category'} (${k.slice(5)})` : k);
  for (const [k, r] of [...rows].sort((a, b) => b[1].n - a[1].n)) out.push(line([label(k), ...fmt(r)]));
  out.push('', line(['new dungeon', ...head]), line(['---', ...head.map(() => '---')]));
  for (const dg of dungeons.filter((x) => x.isNew && x.kind === 'dungeon')) {
    const areas = new Set(NEW_DUNGEON_AREAS[dg.slug] ?? []);
    const r = { n: 0, giver: 0, taker: 0, objectives: 0, listed: 0, all: 0 };
    rows.set(dg.slug, r);
    for (const q of forever) if (areas.has(q.z)) add(dg.slug, q);
    const entrance = [...qdb.dungeons].find(([a]) => areas.has(a))?.[1]?.entrances?.[0];
    out.push(line([`${dg.name}${entrance ? ` (entrance ${zoneNames[entrance.area] ?? entrance.area} ${entrance.x}, ${entrance.y})` : ''}`, ...fmt(r).map((v) => (r.n ? v : 0))]));
  }
  return out.join('\n');
}

/** The creatures QuestieDB places inside an instance (a spawn or its zone in one of the instance's areas), with their
 * levels and rank (1 elite, 2 rare elite, 3 boss, 4 rare), most spawns first: what the traces saw in a new dungeon. */
export function dungeonCreatures(qdb, areas) {
  const inside = new Set(areas);
  const out = [];
  for (const [id, n] of qdb.npcs) {
    const spawns = n.get('spawns') instanceof Map ? [...n.get('spawns').entries()].filter(([a]) => inside.has(Number(a))) : [];
    const count = spawns.reduce((s, [, pts]) => s + asList(pts).length, 0);
    if (!count && !inside.has(Number(n.get('zoneID')))) continue;
    out.push({ id, name: n.get('name'), level: [Number(n.get('minLevel')) || 0, Number(n.get('maxLevel')) || 0], rank: Number(n.get('rank')) || 0, spawns: count });
  }
  return out.sort((a, b) => b.spawns - a.spawns || a.id - b.id);
}

/* ── What the leveling routes take from it (lib/guide.mjs reads them as it read LibQuestDB's) ── */

// A quest's place to go (triggerEnd) becomes an area trigger of its own: this plus the quest's id.
const TRIGGER_BASE = 1000000;

/**
 * The inputs lib/guide.mjs's buildGuide takes as `lq`, from QuestieDB: each quest's row (races mask at 3, area triggers at
 * 17, previous quests at 18 (any one) and 20 (all), exclusive quests at 21), the spawns of every creature and object, the
 * zones (each area's UiMap and continent, from conversion.json, and the area triggers) and what gives each item.
 * @param quests data/quests.json (every quest the routes may take: one row each)
 */
export function routeInputs(qdb, quests) {
  const rows = new Map();
  const triggers = new Map();
  const list = (v) => asList(v).join(',');
  for (const q of quests) {
    const rec = qdb.quests.get(q.i);
    const row = [];
    if (rec) {
      row[3] = Number(rec.get('requiredRaces')) || 0;
      const te = slots(rec.get('triggerEnd'));
      const where = te?.[1] instanceof Map ? spawnList(te[1])[0] : null;
      if (where) {
        triggers.set(TRIGGER_BASE + q.i, [`${where.area}:${Math.round(where.x * 100)},${Math.round(where.y * 100)}`]);
        row[17] = String(TRIGGER_BASE + q.i);
      }
      row[18] = list(rec.get('preQuestSingle'));
      row[20] = list(rec.get('preQuestGroup'));
      row[21] = list(rec.get('exclusiveTo'));
    }
    rows.set(q.i, row);
  }
  const spawns = (records) => {
    const out = new Map();
    for (const [id, r] of records) {
      const s = spawnList(r.get('spawns'));
      if (s.length) out.set(id, s);
    }
    return out;
  };
  const areas = new Map();
  for (const [area, b] of qdb.bounds) areas.set(area, ['0', String(b.ui), String(b.map)]);
  // what gives each item, for the items VMaNGOS does not have (Forever's own)
  const itemDrops = new Map();
  for (const [id, it] of qdb.items) {
    const from = [...asList(it.get('npcDrops')).map((n) => ['n', n]), ...asList(it.get('objectDrops')).map((o) => ['o', o])];
    if (from.length) itemDrops.set(id, from);
  }
  return { quests: rows, npcSpawns: spawns(qdb.npcs), objectSpawns: spawns(qdb.objects), zones: new Map([['LoadAreas', areas], ['LoadAreaTriggers', triggers]]), itemDrops };
}

/** Each new dungeon's quest list (data/dungeons.json's questIds): the quests found before, and of QuestieDB's those it files
 * under the dungeon's areas. @returns the number of QuestieDB's quests listed */
export function addDungeonQuests(dungeons, quests) {
  const byId = new Map(quests.map((q) => [q.i, q]));
  let listed = 0;
  for (const d of dungeons) {
    const areas = new Set(NEW_DUNGEON_AREAS[d.slug] ?? []);
    if (!areas.size) continue;
    const ids = (d.questIds ?? []).filter((id) => !byId.get(id)?.qd);
    for (const q of quests)
      if (q.qd && areas.has(q.z)) {
        ids.push(q.i);
        listed++;
      }
    if (ids.length) d.questIds = [...new Set(ids)];
  }
  return listed;
}

/* The share of a five-level band's quests QuestieDB must place (giver, taker and every listed objective) for a zone on a
 * map of its own to be routed at those levels, compared in whole percent as the coverage table shows it. 75% since
 * November 14, in place of the plan's 80% (written before coverage was measured): the rule keeps players out of a zone where
 * most quests cannot be followed, and Riverglades (66 of 86 placed at 36 to 40, 77%; 59 of 79 at 41 to 45, 74.7%, shown as
 * 75%) and Mount Hyjal (103 of 130 at 56 to 60, 79%) are not that: each has over a hundred quests fully placed at the levels
 * where every route grinds. Only the complete quests become steps. */
export const ROUTE_SHARE = 75;

/**
 * The levels at which each of the given zones may be routed: those of the five-level bands (1 to 5, 6 to 10, ...) in which at
 * least ROUTE_SHARE percent of its quests (filed under it, or given there) have a giver, a taker and every listed objective
 * placed; and, of those quests, the complete ones (the only ones a route takes there) and why each other one is not.
 * @returns Map(area -> { levels: Set, bands: [[lo, hi, quests, placed]], complete: Set, missing: Map(id -> 'giver'|'taker'|'place') })
 */
export function routableLevels(quests, qdb, areas) {
  const placedN = (id) => spawnList(qdb.npcs.get(id)?.get('spawns')).length > 0;
  const placedO = (id) => spawnList(qdb.objects.get(id)?.get('spawns')).length > 0;
  const placed = ([k, id]) => (k === 'n' ? placedN(id) : k === 'o' ? placedO(id) : k === 'i');
  const itemPlaced = (id) => {
    const it = qdb.items.get(id);
    return Boolean(it) && (asList(it.get('npcDrops')).some(placedN) || asList(it.get('objectDrops')).some(placedO));
  };
  const zoneOf = (q) => {
    if (q.z > 0) return q.z;
    const g = (q.st ?? []).find(([k]) => k === 'n' || k === 'o');
    return g ? spawnList((g[0] === 'n' ? qdb.npcs : qdb.objects).get(g[1])?.get('spawns'))[0]?.area ?? 0 : 0;
  };
  const out = new Map(areas.map((a) => [a, { levels: new Set(), bands: [], complete: new Set(), missing: new Map() }]));
  const count = new Map();
  for (const q of quests) {
    if (!q.qd || !(q.l > 0)) continue;
    const area = zoneOf(q);
    if (!out.has(area)) continue;
    const band = Math.floor((q.l - 1) / 5);
    const key = `${area}:${band}`;
    if (!count.has(key)) count.set(key, { area, band, n: 0, ok: 0 });
    const c = count.get(key);
    c.n++;
    const located = (q.rq ?? []).every(([k, id]) => (k === 'n' || k === 't' ? placedN(id) : k === 'o' ? placedO(id) : k === 'i' ? itemPlaced(id) : false));
    const why = !(q.st ?? []).some(placed) ? 'giver' : !(q.en ?? []).some(placed) ? 'taker' : !located ? 'place' : null;
    if (why) out.get(area).missing.set(q.i, why);
    else {
      c.ok++;
      out.get(area).complete.add(q.i);
    }
  }
  for (const c of [...count.values()].sort((a, b) => a.area - b.area || a.band - b.band)) {
    const lo = c.band * 5 + 1;
    out.get(c.area).bands.push([lo, lo + 4, c.n, c.ok]);
    if (Math.round((100 * c.ok) / c.n) >= ROUTE_SHARE) for (let l = lo; l <= lo + 4; l++) out.get(c.area).levels.add(l);
  }
  return out;
}
