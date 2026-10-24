// The leveling guide: a step by step quest route from level 1 to 60 for every race and class, for the site and the add-on.
//
// Every step comes from open data and nothing else: which quests exist in Forever, who gives and takes them and what they
// ask for (VMaNGOS, filtered by LibQuestDB's Forever quest list), where every creature and object stands on the zone
// map (LibQuestDB, MIT, which places them with Forever's own map rectangles), what drops each quest item (VMaNGOS loot
// tables), what the quests a script completes ask for (events.mjs, from VMaNGOS's scripts), and the flight masters,
// class trainers, innkeepers, teleports, boats and the tram (VMaNGOS). No route is copied from any other guide: the
// order is worked out here, by simulating a character of that race and class who walks, flies and sails from quest to
// quest, earns each quest's XP and the XP of what it kills, picks up flight paths on the way, trains at its class
// trainer and keeps its quest log in order.
//
// How the character plays:
//   - It takes quests up to three levels above it and fights mobs up to two levels above it (three from level 10);
//     anything harder waits.
//   - At a quest hub it hands in everything finished and takes everything worth taking before it leaves.
//   - In a zone it works through a planned path (tour.mjs): every objective, turn-in, quest giver and flight master
//     there is to see now, in the order that walks least, taking each quest before its objectives and handing it in
//     after them. Quests that open on the way join the path where they fit.
//   - Its class quests that teach a spell come as soon as they open (the druid's bear form, the hunter's pet, the
//     warlock's demons, the shaman's totems, the warrior's stance...), wherever they lead, when a quarter of an hour
//     takes it there; otherwise when the zone's work is done.
//   - It follows a plan of zones by level (route.json), visits the trainer every two levels or so, binds its
//     Hearthstone in the zone it quests in, and kills things only when no quest at its level is left.
//   - On foot it leaves a zone only where the zone meets the next (route.json's gates), and flies, sails or takes the
//     Hearthstone whenever that is quicker.
//
// Coordinates stay as the game shows them: a zone (its area id) and x, y in percent of that zone's map. The world
// position behind each point (for distances) comes from the zone's rectangle, fitted here from the creatures and
// objects that both sources place exactly once.

import { readRows } from './lua.mjs';
import { createTour } from './tour.mjs';

/* ── Tunables ─────────────────────────────────────────────────────────── */

/** How far above the character a quest may be: yellow to orange, as players take them (the mobs decide when its
 * objectives get done). */
const questUp = () => 3;
const tooHigh = (q, level) => q.min > level || q.level > level + questUp(level);
/** How far above the character the mobs it fights may be. */
const mobUp = (level) => (level < 10 ? 2 : 3);
const MAX_BELOW = 7; // a quest this many levels below pays a fifth of its XP or less
const ELITE_OVER = 3; // an elite quest waits until the character is this many levels over it, to do it alone...
const ELITE_OVER_CLASS = 1; // ...or this many, for a class's own (a rogue's tower is made for a rogue alone)
const eliteOver = (q) => (q.classOnly ? ELITE_OVER_CLASS : ELITE_OVER);
const LOG_SIZE = 20; // quest log size
const HUB_RADIUS = 45; // yards: people within this of each other count as one place
const STOP_YARDS = 25; // yards a stop at another place costs on a zone's path, beyond the walk there
const PICKUP_RADIUS = 110; // yards: quest givers and takers this close make a hub, all seen on one visit
const NEARBY = 500; // yards: a turn-in this close counts as in the zone, whatever the zone
const SYNERGY_RADIUS = 110; // yards: objectives this close to where you stand get done on the same visit
const SEA_WORK = 6; // typical quests' XP a zone across the sea must offer to sail (or fly a continent away) for it
const TRIP_WEIGHT = 2; // the way to a zone counts this many times (the way on from it is as long, as often as not)
const MIN_WORK = 3; // typical quests' XP a zone must offer for a visit...
const MIN_WORK_PLAN = 1.5; // ...or one the plan has for this level
const CHAIN_NEAR = 0.7; // what a chain's next quest counts for, given where the last is handed in...
const CHAIN_FAR = 0.25; // ...or given in another zone (another trip)
const GO_MOVE = 0.5; // a zone must pay this much of grinding's rate to go there...
const GO_STAY = 1; // ...or this much when quests open here at the next level
const URGENT = 900; // seconds: a class spell to learn this near (by any way) is gone for at once
const PASS_BY = 250; // yards: a flight master or a turn-in this close to the way you walk is seen to on the way
const WAIT_FAR = 900; // yards: a quest given this far from everything to do now...
const WAIT_NEAR = 350; // ...and this close to the giver of one that opens soon waits for it
const CLUSTER_RADIUS = 75; // yards: spawn points this close form one camp
const MAX_CAMPS = 6; // camps kept per creature or object per zone
const GRIND_CAMP = 4; // spawns a camp needs to be worth grinding on
const PASSES = 4; // times a route is worked out, each without the quests the last one took and never finished
const RUN = 7; // yards per second on foot
const MOUNT_LEVEL = 40; // Classic's riding level, and its first mount's 60%
const MOUNT_SPEED = 1.6;
const FLY_SPEED = 30; // yards per second on a flight path
const FLY_DETOUR = 1.25; // flight paths bend: this much longer than a straight line
const FLY_OVERHEAD = 30; // seconds at the flight masters
const DISCOVER = 60; // yards: a flight master this close is talked to
const FP_NEAR = 300; // yards: a flight master this close is worth the walk in any zone
const HEARTH_CAST = 30; // seconds: the Hearthstone's cast and the loading screen
const HEARTH_COOLDOWN = 3600; // seconds of play between two uses
const TELEPORT_CAST = 25; // seconds: a class teleport's cast and the loading screen
const BIND_REACH = 45; // yards: an innkeeper this close binds your Hearthstone, in a zone you quest in
const TRAIN_EVERY = 2; // levels between visits to the trainer, at the least
const TRAIN_FIRST = 4; // the first visit
const TRAIN_NEAR = 160; // yards: a trainer this close is visited when spells are due
const TRAIN_ERRAND = 4; // levels without training before the character goes out of its way to train
// Seconds an event objective takes once there: a word with someone, an object used, an escort, an item used on a target.
const EVENT_SECONDS = { talk: 20, use: 20, explore: 0, escort: 240, item: 45, kill: 30 };
const CAPITAL_PARENT = { 1519: 12, 1537: 1, 1657: 141, 1637: 14, 1638: [215, 17], 1497: 85 }; // city -> zones its dwellers are filed under
const CAPITALS = { alliance: [1519, 1537, 1657], horde: [1637, 1638, 1497] };
const ISLAND = new Set([141, 1657]); // Teldrassil and Darnassus: off the coast, by boat or flight only
const CAPITAL_LAND = { 1519: 12, 1537: 1, 1637: 14, 1638: 215, 1497: 85 }; // a capital is walked as part of its zone
// A capital's people are part of the zone around it when you quest there (Thunder Bluff's in Mulgore's work, Stormwind's
// in Elwynn's), not the other way round.
const CITY_ZONE = { ...CAPITAL_LAND, 1657: 141 };
const inZone = (area, zone) => area === zone || CITY_ZONE[area] === zone;
// Taxi nodes that are no flight master of the open world: unused, druid-only, tower and transport paths.
const NOT_TAXI = new Set([1, 3, 9, 15, 24, 34, 35, 36, 47, 50, 51, 54, 78, 84, 85, 86, 87]);
// Moonglade's flight masters fly druids home (to Rut'theran or Thunder Bluff): on a druid's route only.
const DRUID_TAXI = new Set([49, 69]);
const CLASS_IDS = { 1: 'warrior', 2: 'paladin', 3: 'hunter', 4: 'rogue', 5: 'priest', 7: 'shaman', 8: 'mage', 9: 'warlock', 11: 'druid' };
const CLASS_ID = Object.fromEntries(Object.entries(CLASS_IDS).map(([id, slug]) => [slug, Number(id)]));
// The shaman's Earth, Fire, Water and Air Totems: quest rewards a shaman cannot do without.
const TOTEMS = new Set([5175, 5176, 5177, 5178]);
// Class teleports: the druid's to Moonglade (taught by the quest that sends it there) and the mage's to the capitals
// (taught by the trainers). Where each lands comes from VMaNGOS's spell_target_position, when it is learned from its
// quest or trainer level.
const TELEPORTS = [
  { spell: 18960, cls: 'druid' },
  { spell: 3561, cls: 'mage', side: 'alliance' },
  { spell: 3562, cls: 'mage', side: 'alliance' },
  { spell: 3565, cls: 'mage', side: 'alliance' },
  { spell: 3567, cls: 'mage', side: 'horde' },
  { spell: 3563, cls: 'mage', side: 'horde' },
  { spell: 3566, cls: 'mage', side: 'horde' },
];

/* ── Small helpers ────────────────────────────────────────────────────── */

const num = (v) => (v === undefined || v === null || v === '' ? 0 : Number(v));
const bits = (n) => {
  let c = 0;
  for (let v = n; v; v &= v - 1) c++;
  return c;
};
const ids = (v) =>
  String(v ?? '')
    .split(',')
    .filter(Boolean)
    .map((s) => Number(s.split(':')[0]));

/** Spawn rows `[id]="areaId:x,y;x,y|areaId:..."` (x, y in hundredths of a percent) as Map(id -> [{ area, x, y }]). */
export function readSpawns(file) {
  const out = new Map();
  for (const [id, [row]] of readRows(file)) {
    const list = [];
    for (const part of String(row).split('|')) {
      const [area, pts] = part.split(':');
      if (!pts) continue;
      for (const p of pts.split(';')) {
        const [x, y] = p.split(',').map(Number);
        if (x < 0 || y < 0) continue; // inside an instance
        list.push({ area: Number(area), x: x / 100, y: y / 100 });
      }
    }
    out.set(id, list);
  }
  return out;
}

/* ── Zone rectangles ──────────────────────────────────────────────────── */

/**
 * Each zone map's rectangle in world yards, fitted from the creatures and objects both sources place exactly once:
 * map x (percent) runs along the world's y axis and map y along its x axis, each a straight line. Points more than
 * half a percent off the fit are dropped and the fit redone. Elwynn Forest comes out within 0.2 yards of the game's
 * own rectangle.
 */
function fitZones(db, lq, areas) {
  const pairsByArea = new Map();
  for (const [spawns, table] of [
    [lq.npcSpawns, 'creature'],
    [lq.objectSpawns, 'gameobject'],
  ]) {
    const world = new Map();
    for (const r of db.prepare(`SELECT id, map, position_x x, position_y y FROM ${table}`).all()) {
      if (!world.has(r.id)) world.set(r.id, []);
      world.get(r.id).push(r);
    }
    for (const [id, pts] of spawns) {
      const w = world.get(id);
      if (pts.length !== 1 || !w || w.length !== 1) continue;
      const a = pts[0].area;
      if (!pairsByArea.has(a)) pairsByArea.set(a, []);
      pairsByArea.get(a).push({ wx: w[0].x, wy: w[0].y, px: pts[0].x, py: pts[0].y, map: w[0].map });
    }
  }
  const line = (xs, ys) => {
    const n = xs.length;
    let sx = 0,
      sy = 0,
      sxx = 0,
      sxy = 0;
    for (let i = 0; i < n; i++) {
      sx += xs[i];
      sy += ys[i];
      sxx += xs[i] * xs[i];
      sxy += xs[i] * ys[i];
    }
    const a = (n * sxy - sx * sy) / (n * sxx - sx * sx);
    return [a, (sy - a * sx) / n];
  };
  const rects = new Map();
  for (const [area, all] of pairsByArea) {
    const zone = areas.get(area);
    if (!zone?.ui) continue;
    let list = all;
    for (let round = 0; round < 5 && list.length >= 3; round++) {
      const [a1, b1] = line(
        list.map((p) => p.wy),
        list.map((p) => p.px),
      );
      const [a2, b2] = line(
        list.map((p) => p.wx),
        list.map((p) => p.py),
      );
      const keep = list.filter((p) => Math.hypot(a1 * p.wy + b1 - p.px, a2 * p.wx + b2 - p.py) < 0.5);
      if (keep.length === list.length || keep.length < 3) break;
      list = keep;
    }
    if (list.length < 3) continue;
    const [a1, b1] = line(
      list.map((p) => p.wy),
      list.map((p) => p.px),
    );
    const [a2, b2] = line(
      list.map((p) => p.wx),
      list.map((p) => p.py),
    );
    rects.set(area, { area, ui: zone.ui, map: list[0].map, left: -b1 / a1, right: (100 - b1) / a1, top: -b2 / a2, bottom: (100 - b2) / a2 });
  }
  return rects;
}

/* ── XP ───────────────────────────────────────────────────────────────── */

/** Classic's experience for a kill: the mob's level against yours, double for an elite. */
export function killXp(player, mob, elite) {
  const base = player * 5 + 45;
  if (mob >= player) return Math.round(base * (1 + 0.05 * Math.min(4, mob - player)) * (elite ? 2 : 1));
  const zd = player <= 7 ? 5 : player <= 9 ? 6 : player <= 11 ? 7 : player <= 15 ? 8 : player <= 19 ? 9 : player <= 29 ? 11 : player <= 39 ? 12 : player <= 44 ? 13 : player <= 49 ? 14 : player <= 54 ? 15 : player <= 59 ? 16 : 17;
  const gray = player <= 5 ? 0 : player <= 39 ? player - Math.floor(player / 10) - 5 : player - Math.floor(player / 5) - 1;
  if (mob <= gray) return 0;
  return Math.max(0, Math.round(base * (1 - (player - mob) / zd) * (elite ? 2 : 1)));
}

/** A quest's XP for a character of a level: full up to five levels over the quest, then 80, 60, 40, 20 and 10%. */
export function questXp(xp, questLevel, player) {
  const over = player - questLevel;
  if (over <= 5) return xp;
  return Math.round(xp * ([0.8, 0.6, 0.4, 0.2][over - 6] ?? 0.1));
}

/* ── The guide ────────────────────────────────────────────────────────── */

/**
 * @param db VMaNGOS (node:sqlite)
 * @param lq { quests, npcSpawns, objectSpawns, zones (Zones.lua sections) } from LibQuestDB
 * @param world { quests, npcs, objects, drops } as written to data/
 * @param plan scripts/data/static/route.json
 * @param races data/races.json's races: { id, slug, name, faction, classes: [class slugs] }
 * @param events what the quests a script completes ask for (events.mjs): Map(quest -> { objectives })
 * @param only { route: id } to work out one route (tools)
 */
export function buildGuide({ db, lq, world, plan, races = [], events = new Map(), only = null, log = () => {} }) {
  /* Areas: id -> { parent, ui, map }; explore triggers: id -> { area, x, y } */
  const areas = new Map();
  const triggers = new Map();
  for (const [id, row] of lq.zones.get('LoadAreas') ?? []) areas.set(id, { parent: num(row[0]), ui: num(row[1]), map: num(row[2]) });
  for (const [id, row] of lq.zones.get('LoadAreaTriggers') ?? []) {
    const m = /^(\d+):(\d+),(\d+)$/.exec(String(row[0]));
    if (m) triggers.set(id, { area: Number(m[1]), x: Number(m[2]) / 100, y: Number(m[3]) / 100 });
  }
  const rects = fitZones(db, lq, areas);
  log(`guide: ${rects.size} zone maps placed in the world`);

  const round1 = (v) => Math.round(v * 10) / 10;
  const toWorld = (p) => {
    const r = rects.get(p.area);
    if (!r) return null;
    return { map: r.map, wx: r.top - (p.y / 100) * (r.top - r.bottom), wy: r.left - (p.x / 100) * (r.left - r.right) };
  };
  const inRect = (r, w) => w.map === r.map && w.wy <= r.left && w.wy >= r.right && w.wx <= r.top && w.wx >= r.bottom;
  const onMap = (r, w) => ({ area: r.area, x: round1(((r.left - w.wy) / (r.left - r.right)) * 100), y: round1(((r.top - w.wx) / (r.top - r.bottom)) * 100) });
  // LibQuestDB files many city dwellers under the zone around the city (Stormwind's under Elwynn Forest, Thunder
  // Bluff's flight master under the Barrens); they are moved onto the city's own map, where the game shows them. A
  // creature hostile to the city is outside it, whatever the map's edges hold (the harpies below Thunder Bluff).
  const cityOf = new Map();
  for (const [city, parents] of Object.entries(CAPITAL_PARENT)) for (const parent of [parents].flat()) if (rects.has(Number(city))) cityOf.set(parent, rects.get(Number(city)));
  /** A point on a zone map with its world position, on the city's map when it stands in a capital (`react`: the
   * creature's reaction to each side, "fh"). */
  const placed = (p, react = null) => {
    const w = toWorld(p);
    if (!w) return null;
    const city = cityOf.get(p.area);
    if (city && inRect(city, w) && react?.[CAPITALS.alliance.includes(city.area) ? 0 : 1] !== 'h') return { ...onMap(city, w), ...w };
    return { area: p.area, x: p.x, y: p.y, ...w };
  };
  // Zones by size, smallest first: a world position goes on the most detailed map that holds it.
  const bySize = [...rects.values()].sort((a, b) => (a.left - a.right) * (a.top - a.bottom) - (b.left - b.right) * (b.top - b.bottom));
  /** A world position (map, x, y) as a point on the map of the zone that holds it, preferring the given zone. */
  // Zone maps overlap at their edges, so a world position alone does not say which zone it is in: the zone of the
  // nearest spawn LibQuestDB places (within 300 yards) does. A grid of every spawn point finds it.
  const GRID = 250;
  let grid = null;
  const cell = (map, wx, wy) => `${map}:${Math.floor(wx / GRID)}:${Math.floor(wy / GRID)}`;
  function zoneNear(map, wx, wy) {
    if (!grid) {
      grid = new Map();
      for (const spawns of [lq.npcSpawns, lq.objectSpawns])
        for (const list of spawns.values())
          for (const sp of list) {
            const w = toWorld(sp);
            if (!w) continue;
            const k = cell(w.map, w.wx, w.wy);
            if (!grid.has(k)) grid.set(k, []);
            grid.get(k).push({ ...w, area: sp.area });
          }
    }
    let best = null;
    let bestD = 300;
    const cx = Math.floor(wx / GRID);
    const cy = Math.floor(wy / GRID);
    for (let dx = -1; dx <= 1; dx++)
      for (let dy = -1; dy <= 1; dy++)
        for (const p of grid.get(`${map}:${cx + dx}:${cy + dy}`) ?? []) {
          const d = Math.hypot(p.wx - wx, p.wy - wy);
          if (d < bestD) {
            best = p.area;
            bestD = d;
          }
        }
    return best;
  }
  const fromWorld = (map, wx, wy, prefer) => {
    const w = { map, wx, wy };
    const near = rects.get(prefer) ?? rects.get(zoneNear(map, wx, wy));
    const r = near && inRect(near, w) ? near : bySize.find((x) => inRect(x, w));
    if (!r) return null;
    // On the city's own map when it stands in a capital, as placed() does for spawns.
    const city = cityOf.get(r.area);
    if (city && inRect(city, w)) return { ...onMap(city, w), ...w };
    return { ...onMap(r, w), ...w };
  };
  const dist = (a, b) => (a.map === b.map ? Math.hypot(a.wx - b.wx, a.wy - b.wy) : Infinity);

  /* Entities: n<id> creatures, o<id> objects, each with its camps (clusters of spawn points) per zone. */
  const campCache = new Map();
  function camps(kind, id) {
    const key = kind + id;
    if (campCache.has(key)) return campCache.get(key);
    const raw = (kind === 'n' ? lq.npcSpawns : lq.objectSpawns).get(id) ?? [];
    const react = kind === 'n' ? (world.npcs[id]?.[5] ?? null) : null;
    const pts = raw.map((p) => placed(p, react)).filter(Boolean);
    // Single-linkage clusters within CLUSTER_RADIUS, per zone.
    const out = [];
    const used = new Array(pts.length).fill(false);
    for (let i = 0; i < pts.length; i++) {
      if (used[i]) continue;
      const group = [pts[i]];
      used[i] = true;
      for (let k = 0; k < group.length; k++) {
        for (let j = 0; j < pts.length; j++) {
          if (!used[j] && pts[j].area === group[k].area && dist(group[k], pts[j]) <= CLUSTER_RADIUS) {
            used[j] = true;
            group.push(pts[j]);
          }
        }
      }
      // The camp's point is its member nearest the middle, so it stands on a real spawn.
      const mx = group.reduce((s, p) => s + p.wx, 0) / group.length;
      const my = group.reduce((s, p) => s + p.wy, 0) / group.length;
      let best = group[0];
      for (const p of group) if (Math.hypot(p.wx - mx, p.wy - my) < Math.hypot(best.wx - mx, best.wy - my)) best = p;
      out.push({ ...best, n: group.length });
    }
    // Biggest camps first; few per zone.
    out.sort((a, b) => b.n - a.n);
    const perZone = new Map();
    const kept = out.filter((c) => {
      const k = perZone.get(c.area) ?? 0;
      perZone.set(c.area, k + 1);
      return k < MAX_CAMPS;
    });
    campCache.set(key, kept);
    return kept;
  }

  const npcs = world.npcs;
  const drops = world.drops;
  const friendlyTo = (id, faction) => {
    const n = npcs[id];
    return Boolean(n) && n[5][faction === 'alliance' ? 0 : 1] !== 'h';
  };

  /* Flight masters: the taxi nodes of patch 1.12, each on the flight master who stands at it. */
  const taxi = [];
  {
    const nodes = db
      .prepare(
        `SELECT t.id, t.map_id map, t.x, t.y, t.name, t.mount_creature_id1 h, t.mount_creature_id2 a FROM taxi_nodes t
         JOIN (SELECT id, MAX(build) b FROM taxi_nodes WHERE build <= 5875 GROUP BY id) m ON m.id = t.id AND m.b = t.build`,
      )
      .all();
    const masters = db
      .prepare(
        `SELECT DISTINCT c.id, c.map, c.position_x x, c.position_y y FROM creature c
         WHERE c.id IN (SELECT entry FROM creature_template WHERE (npc_flags & 8) != 0)`,
      )
      .all();
    for (const n of nodes) {
      if (NOT_TAXI.has(n.id) || (!n.a && !n.h)) continue;
      let fm = null;
      for (const m of masters) {
        if (m.map !== n.map) continue;
        const d = Math.hypot(m.x - n.x, m.y - n.y);
        if (d < 60 && (!fm || d < fm.d)) fm = { ...m, d };
      }
      if (!fm) continue;
      // The flight master's own spot on the zone map, the spawn nearest the node.
      let p = null;
      for (const c of camps('n', fm.id)) if (c.map === n.map && (!p || Math.hypot(c.wx - n.x, c.wy - n.y) < Math.hypot(p.wx - n.x, p.wy - n.y))) p = c;
      if (!p || Math.hypot(p.wx - n.x, p.wy - n.y) > 80) p = fromWorld(n.map, fm.x, fm.y);
      if (!p) continue;
      const side = n.a && n.h ? 'both' : n.a ? 'alliance' : 'horde';
      taxi.push({ id: n.id, name: n.name, npc: fm.id, side, p, druid: DRUID_TAXI.has(n.id) });
    }
  }
  const taxiById = new Map(taxi.map((t) => [t.id, t]));
  log(`guide: ${taxi.length} flight masters`);

  /* Class trainers, each where it stands. */
  const trainers = [];
  for (const r of db.prepare('SELECT DISTINCT entry, trainer_class c FROM creature_template WHERE trainer_type = 0 AND trainer_class > 0').all()) {
    const cls = CLASS_IDS[r.c];
    if (!cls || !npcs[r.entry]) continue;
    for (const c of camps('n', r.entry)) trainers.push({ npc: r.entry, cls, p: c });
  }
  /* Innkeepers: where a Hearthstone is bound. */
  const innkeepers = [];
  for (const r of db.prepare('SELECT DISTINCT entry FROM creature_template WHERE (npc_flags & 128) != 0').all()) {
    if (!npcs[r.entry]) continue;
    for (const c of camps('n', r.entry)) innkeepers.push({ npc: r.entry, p: c });
  }

  /* Class teleports: where each lands, and the quest or trainer level that teaches it. */
  const teleports = [];
  {
    const target = new Map(db.prepare('SELECT id, target_map map, target_position_x x, target_position_y y FROM spell_target_position').all().map((r) => [r.id, r]));
    // The teaching spells (effect 36, learn spell) for each teleport, then who uses them: a trainer, or a quest's start.
    const teaches = new Map();
    for (const r of db.prepare('SELECT DISTINCT entry, effectTriggerSpell1 s FROM spell_template WHERE effect1 = 36').all()) {
      if (!teaches.has(r.s)) teaches.set(r.s, new Set());
      teaches.get(r.s).add(r.entry);
    }
    const trainerLevel = new Map();
    for (const table of ['npc_trainer', 'npc_trainer_template'])
      for (const r of db.prepare(`SELECT spell, reqlevel FROM ${table}`).all()) if (r.reqlevel && (!trainerLevel.has(r.spell) || trainerLevel.get(r.spell) > r.reqlevel)) trainerLevel.set(r.spell, r.reqlevel);
    const questStart = new Map();
    for (const r of db.prepare('SELECT DISTINCT entry, SrcSpell FROM quest_template WHERE SrcSpell > 0').all()) {
      if (!questStart.has(r.SrcSpell)) questStart.set(r.SrcSpell, new Set());
      questStart.get(r.SrcSpell).add(r.entry);
    }
    for (const t of TELEPORTS) {
      const to = target.get(t.spell);
      const at = to && fromWorld(to.map, to.x, to.y);
      if (!at) continue;
      const via = [...(teaches.get(t.spell) ?? [])];
      const level = Math.min(...via.map((s) => trainerLevel.get(s) ?? Infinity));
      const quests = via.flatMap((s) => [...(questStart.get(s) ?? [])]);
      if (!Number.isFinite(level) && !quests.length) continue;
      const name = db.prepare('SELECT name FROM spell_template WHERE entry = ? AND build <= 5875 ORDER BY build DESC LIMIT 1').get(t.spell)?.name ?? `Teleport ${t.spell}`;
      teleports.push({ ...t, name, at, level: Number.isFinite(level) ? level : 0, quests });
    }
    log(`guide: ${teleports.length} class teleports`);
  }

  /* Quests */
  const lqq = lq.quests; // LibQuestDB structure rows
  const F = { races: 3, explore: 17, preSingle: 18, preGroup: 20, exclusiveTo: 21, hidden: 28 };
  const catalog = new Map(); // id -> resolved quest

  const npcLevel = (id) => {
    const n = npcs[id];
    return n ? Math.round((n[2] + n[3]) / 2) : 1;
  };
  const npcElite = (id) => {
    const n = npcs[id];
    return n ? n[4] === 1 || n[4] === 2 : false;
  };

  /** Where a quest item comes from: creatures and objects that drop it, the likeliest first. */
  function itemSources(itemId, questLevel) {
    const d = drops[itemId];
    if (!d) return [];
    let src = d.s.filter((s) => s[0] === 'n' || s[0] === 'o');
    // A creature far above the quest is not where the quest means it to come from (an item shared with a later
    // quest, a slip in the loot tables): it is left out while any other source is left.
    const fit = src.filter((s) => s[0] === 'o' || npcLevel(s[1]) <= questLevel + 8);
    if (fit.length) src = fit;
    if (!src.length) return [];
    const best = Math.max(...src.map((s) => s[2]));
    // Sources at a tenth of the best chance or better; quest-only drops always count.
    return src.filter((s) => s[3] === 1 || s[2] >= best / 10).map((s) => ({ kind: s[0], id: s[1], pct: s[2], fight: s[0] === 'n' }));
  }

  // Quests behind a reputation (the Argent Dawn's armor quests, a faction's own errands): not for a leveling route.
  const gated = new Set(
    db
      .prepare(`SELECT DISTINCT entry FROM quest_template WHERE (RequiredMinRepFaction > 0 AND RequiredMinRepValue > 0) OR RequiredMaxRepFaction > 0`)
      .all()
      .map((r) => r.entry),
  );
  // A server condition (VMaNGOS's conditions table) is kept when it speaks only of other quests: those it needs handed
  // in, and those that close it once taken or handed in (a trainer's errand to a stance quest, offered while that quest
  // is not started). Any other condition (an aura, an area, an event, a skill) keeps the quest out.
  const conditionRows = new Map(db.prepare('SELECT * FROM conditions').all().map((r) => [r.condition_entry, r]));
  const questCondition = new Map(); // quest -> { need, closedBy, closedByDone }, or null: left out
  for (const r of db.prepare('SELECT entry, patch, RequiredCondition c FROM quest_template').all()) {
    if (questCondition.has(r.entry) && questCondition.get(r.entry).patch >= r.patch) continue;
    questCondition.set(r.entry, { patch: r.patch, c: r.c });
  }
  for (const [entry, { c }] of questCondition) {
    if (!(c > 0)) {
      questCondition.delete(entry);
      continue;
    }
    const out = { need: [], closedBy: [], closedByDone: [] };
    // Only a condition that reads as "all of these": AND, or NOT(OR) of literals, each about a quest.
    const walk = (id, neg) => {
      const k = conditionRows.get(id);
      if (!k) return false;
      const n = neg !== Boolean(k.flags & 1);
      const kids = [k.value1, k.value2, k.value3, k.value4].filter(Boolean);
      if (k.type === -1 || k.type === -2) {
        if (kids.length > 1 && (k.type === -1) === n) return false; // an OR, at bottom
        return kids.every((v) => walk(v, n));
      }
      if (k.type === 8) (n ? out.closedByDone : out.need).push(k.value1); // handed in
      else if (k.type === 22 && !n) out.closedBy.push(k.value1); // neither taken nor handed in
      else return false;
      return true;
    };
    questCondition.set(entry, walk(c, false) ? out : null);
  }
  // Quests a script completes (VMaNGOS's SpecialFlags 2): routed only when events.mjs knows what they ask for.
  const special = new Map();
  for (const r of db.prepare('SELECT entry, patch, SpecialFlags f FROM quest_template').all()) if (!special.has(r.entry) || special.get(r.entry).patch < r.patch) special.set(r.entry, r);
  // Goods handed in by the score (cloth for a capital's reputation, bars and food for the war effort): not leveling.
  const itemClass = db.prepare('SELECT class FROM item_template WHERE entry = ? ORDER BY patch DESC LIMIT 1');
  const goods = (r) => r[0] === 'i' && r[3] >= 20 && (itemClass.get(r[1])?.class ?? 12) !== 12;
  // Items a quest hands out that start another (the Tome of Divinity Duthorian Rall gives): that quest is taken where
  // the item is had, from the quest that gives it.
  const startItems = new Set(world.quests.flatMap((q) => (q.st ?? []).filter((x) => x[0] === 'i').map((x) => x[1])));
  const handedOutBy = new Map(); // item -> quests that reward it
  for (const q of world.quests) for (const [item] of q.ir ?? []) if (startItems.has(item)) (handedOutBy.get(item) ?? handedOutBy.set(item, []).get(item)).push(q);
  // VMaNGOS's NextQuestId: a quest that names the next one is one more way to it, beside the next one's own previous
  // quest (the felhunter's Binding follows either side's Tome of the Cabal).
  const namedBefore = new Map(); // quest -> quests that name it as their next
  {
    const latest = new Map();
    for (const r of db.prepare('SELECT entry, patch, NextQuestId n FROM quest_template').all()) if (!latest.has(r.entry) || latest.get(r.entry).patch < r.patch) latest.set(r.entry, r);
    for (const r of latest.values()) if (r.n > 0) (namedBefore.get(r.n) ?? namedBefore.set(r.n, []).get(r.n)).push(r.entry);
  }
  let leftOut = 0;
  const extraNames = new Map(); // creature id, or minus an object id -> name
  const extraItems = new Set();
  for (const q of world.quests) {
    const row = lqq.get(q.i);
    if (!row || gated.has(q.i) || questCondition.get(q.i) === null) continue;
    const cond = questCondition.get(q.i);
    // Not for the route: professions, repeatables, events, group content, reputation work.
    if (q.c2 !== 0 && q.c2 !== 1 && q.c2 !== 4) continue;
    // A repeatable quest stays when what it hands out starts a quest (the paladin's Tome of Divinity, given again if lost).
    const handsOutStart = (q.ir ?? []).some(([item]) => handedOutBy.has(item));
    if (q.sk || (q.rep && !handsOutStart) || q.ev || q.gp > 2 || (q.ty && q.ty !== 1)) continue; // elite quests (type 1) stay, for later
    if ((q.rq ?? []).some((r) => r[0] === 'r' || goods(r))) continue;
    if (row[F.hidden]) continue;
    // What events.mjs says of the quest: objectives a script asks for (each standing for one of the quest's rows, `rq`,
    // or a step of its own), and where to meet a giver or taker that has no spawn of its own.
    const ev = events.get(q.i);
    let givers = (q.st ?? []).filter((s) => s[0] === 'n' || s[0] === 'o');
    // Started by an item a quest hands out: taken at that quest's taker, once it is handed in.
    const startItem = (q.st ?? []).find((x) => x[0] === 'i')?.[1];
    const fromQuests = !givers.length && !ev?.giver && startItem ? (handedOutBy.get(startItem) ?? []).filter((g) => g.i !== q.i && (g.en ?? []).length) : [];
    if (fromQuests.length) givers = [...new Map(fromQuests.flatMap((g) => g.en).filter((e) => e[0] === 'n' || e[0] === 'o').map((e) => [e.join(), e])).values()];
    const enders = q.en ?? [];
    const level = q.l > 0 ? q.l : q.r;
    // A quest started by an item that drops (Sharptalon's Claw, a letter in a chest): taken where the item comes from,
    // when it comes often enough to count on.
    let drop = null;
    if (!givers.length && !ev?.giver) {
      const item = (q.st ?? []).find((x) => x[0] === 'i')?.[1];
      const src = item ? itemSources(item, level).filter((t) => camps(t.kind, t.id).length) : [];
      const best = src.sort((a, b) => b.pct - a.pct)[0];
      if (best && best.pct >= 20) drop = { ref: [best.kind, best.id], item, pct: best.pct, fight: best.kind === 'n' };
    }
    if ((!givers.length && !ev?.giver && !drop) || (!enders.length && !ev?.ender)) continue;
    const evObjectives = ev?.objectives ?? [];
    const replaced = new Set(evObjectives.filter((o) => Number.isInteger(o.rq)).map((o) => o.rq));
    // Items a row asks for that the player has already: handed out by an earlier quest of the chain, or in a container.
    const held = new Set(events.held?.get(q.i) ?? []);
    const objectives = [];
    let made = false; // an item nothing drops, or a creature nowhere to be found, and no event that says where
    (q.rq ?? []).forEach((r, index) => {
      if (replaced.has(index) || r[0] === 't') return; // the event's objective stands for it (a script fills a text line)
      if (r[0] === 'n') {
        if (!camps('n', r[1]).length) made = true;
        else objectives.push({ kind: 'kill', id: r[1], count: r[3], index, targets: [{ kind: 'n', id: r[1], fight: true }] });
      } else if (r[0] === 'o') objectives.push({ kind: 'object', id: r[1], count: r[3], index, targets: [{ kind: 'o', id: r[1] }] });
      else if (r[0] === 'i') {
        // The quest's own starting item is handed over, not collected; an item in hand already is not looked for.
        if ((q.pi && r[1] === q.pi) || held.has(r[1])) return;
        const src = itemSources(r[1], level).filter((t) => camps(t.kind, t.id).length);
        if (!src.length) {
          made = true;
          return;
        }
        objectives.push({ kind: 'item', id: r[1], count: r[3], index, targets: src });
      }
    });
    // Where the quest sends you: its area triggers, unless the events say it better (with the steps on the way there).
    const explore = evObjectives.some((o) => o.kind === 'explore') ? [] : ids(row[F.explore]);
    let ok = true;
    for (const t of explore) {
      const p = triggers.get(t);
      const at = p && placed(p);
      if (!at) {
        ok = false;
        break;
      }
      objectives.push({ kind: 'explore', id: t, count: 1, index: -1, point: at });
    }
    if (!ok) continue;
    // A script's part: from events.mjs, or the quest is left out (a route that cannot say what to do is no route).
    const scripted = (special.get(q.i)?.f ?? 0) & 2 || (q.rq ?? []).some((r) => r[0] === 't') || made;
    if (scripted && !explore.length && !evObjectives.length) {
      leftOut++;
      continue;
    }
    const nameOf = (o) => {
      // Names for what the events point at, when the site's data does not have them (an object only a script uses).
      if (o.npc && !npcs[o.npc]) extraNames.set(o.npc, db.prepare('SELECT name FROM creature_template WHERE entry = ? ORDER BY patch DESC LIMIT 1').get(o.npc)?.name);
      if (o.object && !world.objects[o.object]) extraNames.set(-o.object, db.prepare('SELECT name FROM gameobject_template WHERE entry = ? ORDER BY patch DESC LIMIT 1').get(o.object)?.name);
    };
    for (const o of evObjectives) {
      nameOf(o);
      if (o.item) extraItems.add(o.item);
      const targets = [];
      if (o.npc) targets.push({ kind: 'n', id: o.npc, fight: o.kind === 'kill' && !o.item });
      if (o.object) targets.push({ kind: 'o', id: o.object });
      const points = (o.points ?? []).map((w) => fromWorld(w.map, w.x, w.y)).filter(Boolean);
      // An objective for one of the quest's rows counts as that row does in the quest log (five peons woken).
      const row = Number.isInteger(o.rq) ? q.rq?.[o.rq] : null;
      // An escort is met where its creature stands and ends where the script's path does: you walk there with it.
      const end = o.kind === 'escort' && points.length ? points[points.length - 1] : null;
      objectives.push({ kind: 'event', sub: o.kind, id: o.npc ?? o.object ?? o.item ?? 0, item: o.item ?? 0, count: row?.[3] ?? 1, index: row ? o.rq : -1, text: o.text, targets, points: end ? [] : points, end });
    }
    // A giver or taker met where a script calls it up, or at one stop of its walk.
    const meet = (m) => {
      if (!m) return null;
      nameOf(m);
      const pts = (m.points ?? []).map((w) => fromWorld(w.map, w.x, w.y)).filter(Boolean);
      return pts.length ? { ref: m.npc ? ['n', m.npc] : ['o', m.object], pts } : null;
    };
    // Any one of its previous quests opens it: its own, those LibQuestDB names, those that name it as their next.
    const singles = ids(row[F.preSingle]);
    const widened = (q.pv > 0 || singles.length) && (namedBefore.get(q.i) ?? []).some((b) => b !== q.pv && !singles.includes(b));
    const preAny = [...new Set([...singles, ...(widened ? [...(q.pv > 0 ? [q.pv] : []), ...namedBefore.get(q.i)] : []), ...fromQuests.map((g) => g.i)])];
    catalog.set(q.i, {
      id: q.i,
      name: q.n,
      level,
      min: q.r || 1,
      side: q.s,
      races: num(row[F.races]),
      classes: q.rc ?? 0,
      // A class's own quest (one or two classes): "all but the warlock" is an ordinary quest the warlock does differently.
      classOnly: Boolean(q.rc) && bits(q.rc) <= 2,
      xp: q.xp ?? 0,
      givers,
      enders,
      meetGiver: meet(ev?.giver),
      meetEnder: meet(ev?.ender),
      drop,
      objectives,
      pre: q.pv > 0 && !widened ? q.pv : 0,
      preActive: q.pv < 0 ? -q.pv : 0,
      preGroup: [...new Set([...ids(row[F.preGroup]), ...(cond?.need ?? [])])],
      preAny,
      exclusive: q.ex > 0 ? q.ex : 0,
      exclusiveTo: ids(row[F.exclusiveTo]), // LibQuestDB's: one of these taken, the others are not offered
      // The server's condition: these taken or handed in (or handed in, for `closedByDone`), it is not offered.
      closedBy: cond?.closedBy ?? [],
      closedByDone: cond?.closedByDone ?? [],
      zone: q.z,
      elite: q.ty === 1,
      // A spell for its reward (a druid's form, a warlock's demon, a stance) or a totem: what makes a class quest one
      // the class must do.
      rewardsSpell: Boolean(q.sp) || (q.ir ?? []).some(([item]) => TOTEMS.has(item)),
      // What it teaches, to know when a class quest is done with: the spell, or the totem it gives.
      teaches: q.sp ? `s${q.sp}` : (q.ir ?? []).filter(([item]) => TOTEMS.has(item)).map(([item]) => `i${item}`)[0] ?? null,
    });
  }
  log(`guide: ${catalog.size} quests can be routed (${leftOut} a script completes left out: what they ask for is not known)`);
  const exclusiveGroups = new Map();
  for (const q of catalog.values()) if (q.exclusive) (exclusiveGroups.get(q.exclusive) ?? exclusiveGroups.set(q.exclusive, []).get(q.exclusive)).push(q.id);
  // Quests that open others are worth taking even when they pay little themselves.
  const opens = new Map();
  const followUps = new Map(); // quest -> the quests it opens
  for (const q of catalog.values())
    for (const p of new Set([q.pre, ...q.preGroup, ...q.preAny])) {
      if (!p) continue;
      opens.set(p, (opens.get(p) ?? 0) + 1);
      if (!followUps.has(p)) followUps.set(p, []);
      followUps.get(p).push(q);
    }
  // A class's essential quests: those that teach a spell or give a totem, and every quest of a chain that leads to one.
  // The others (armor and weapons of the class) are ordinary quests, taken when they pay like any other.
  const essentialMemo = new Map();
  const essential = (q, seen = new Set()) => {
    if (!q.classOnly) return false;
    if (essentialMemo.has(q.id)) return essentialMemo.get(q.id);
    if (seen.has(q.id)) return false;
    seen.add(q.id);
    const yes = q.rewardsSpell || (followUps.get(q.id) ?? []).some((f) => f.classOnly && essential(f, seen));
    essentialMemo.set(q.id, yes);
    return yes;
  };
  for (const q of catalog.values()) q.essential = essential(q);
  // The spells (and totems) an essential quest leads to: its own, or those of the class quests it opens.
  const goalMemo = new Map();
  const goals = (q, seen = new Set()) => {
    if (goalMemo.has(q.id)) return goalMemo.get(q.id);
    if (seen.has(q.id)) return new Set();
    seen.add(q.id);
    const out = new Set(q.teaches ? [q.teaches] : []);
    for (const f of followUps.get(q.id) ?? []) if (f.classOnly && f.essential) for (const k of goals(f, seen)) out.add(k);
    goalMemo.set(q.id, out);
    return out;
  };
  for (const q of catalog.values()) if (q.essential) q.goals = goals(q);

  function entityPoint(ref, area) {
    const cs = camps(ref[0], ref[1]);
    return cs.find((c) => !area || c.area === area) ?? cs[0] ?? null;
  }

  const startSpots = [];
  const xpTable = new Map(db.prepare('SELECT lvl, xp_for_next_level xp FROM player_xp_for_level').all().map((r) => [r.lvl, r.xp]));
  // What an ordinary quest pays at a level: the median of the quests within a level of it.
  const typical = new Map();
  function typicalXp(level) {
    if (!typical.has(level)) {
      const xs = [...catalog.values()].filter((q) => !q.classOnly && Math.abs(q.level - level) <= 1 && q.xp > 0).map((q) => questXp(q.xp, q.level, level)).sort((a, b) => a - b);
      typical.set(level, xs.length ? xs[Math.floor(xs.length / 2)] : level * 100);
    }
    return typical.get(level);
  }

  // The biggest camp of ordinary hostile mobs a level can kill well, per zone: where to grind when the quests run out.
  const grindCache = new Map();
  function grindSpot(zone, level, reactIndex) {
    const key = `${zone}:${level}:${reactIndex}`;
    if (grindCache.has(key)) return grindCache.get(key);
    let best = null;
    for (const [id, n] of Object.entries(npcs)) {
      if (n[6] !== zone || n[4] !== 0 || n[5][reactIndex] !== 'h') continue;
      // Monsters only: not the other faction's people (a Horde character does not grind in Theramore), and no one with
      // a title or a service to offer.
      if (n[5][1 - reactIndex] === 'f' || n[1] || n[7]) continue;
      const mob = (n[2] + n[3]) / 2;
      if (mob < level - 1 || mob > level + 1) continue;
      for (const c of camps('n', Number(id))) {
        if (c.area !== zone || c.n < GRIND_CAMP) continue;
        if (!best || c.n > best.n) best = { ...c, ref: { kind: 'n', id: Number(id) } };
      }
    }
    grindCache.set(key, best);
    return best;
  }

  /* ── Simulating a character ── */

  function simulate(route) {
    if (route.debug) route.debug.length = 0; // the last working-out's
    const faction = route.faction;
    const raceMask = route.races.reduce((m, r) => m | r, 0);
    const classBit = route.classBit;
    const side = faction === 'alliance' ? 1 : 2;
    const reactIndex = side === 1 ? 0 : 1;
    const friendly = (ref) => ref[0] !== 'n' || friendlyTo(ref[1], faction);
    const zoneSet = new Set(route.zones);
    const capitals = CAPITALS[faction].map((c) => rects.get(c)).filter(Boolean);
    const inCapital = (p) => capitals.some((r) => r.area === p.area);
    const myTrainers = trainers.filter((t) => t.cls === route.cls && friendlyTo(t.npc, faction));
    const myTeleports = teleports.filter((t) => t.cls === route.cls && (!t.side || t.side === faction));
    const forMe = (q) => (q.side === 3 || q.side === side) && (!q.races || q.races & raceMask) && (!q.classes || q.classes & classBit);
    // The zones of this class's quests join the route's (Moonglade for a druid, the warlock's quarters...).
    const classQuests = [...catalog.values()].filter((q) => q.essential && forMe(q));
    const hostile = new Set(CAPITALS[faction === 'alliance' ? 'horde' : 'alliance']);
    const usable = (c) => rects.has(c.area) && !hostile.has(c.area);
    for (const q of classQuests) {
      // Givers and takers where they stand; an objective only where it can be done, and only when the faction's zones
      // have no place for it already.
      for (const r of [...q.givers, ...q.enders]) {
        const cs = camps(r[0], r[1]).filter(usable);
        if (cs.length && !cs.some((c) => zoneSet.has(c.area))) zoneSet.add(cs[0].area);
      }
      for (const m of [q.meetGiver, q.meetEnder]) {
        const cs = (m?.pts ?? []).filter(usable);
        if (cs.length && !cs.some((c) => zoneSet.has(c.area))) zoneSet.add(cs[0].area);
      }
      for (const o of q.objectives) {
        const cs = (o.targets ?? []).flatMap((t) => camps(t.kind, t.id)).filter(usable).concat((o.points ?? []).filter(Boolean));
        if (cs.length && !cs.some((c) => zoneSet.has(c.area))) for (const c of cs) zoneSet.add(c.area);
      }
    }
    const steps = [];
    const st = {
      level: route.startLevel ?? 1,
      xp: 0,
      done: new Set(),
      active: new Map(),
      dropped: new Set(),
      pos: null,
      zone: 0,
      travelled: 0,
      flown: 0,
      seconds: 0,
      time: { walk: 0, travel: 0, kill: 0, grind: 0 }, // where the seconds go (tools)
      known: new Set(route.taxi ?? []),
      lastTrain: TRAIN_FIRST - TRAIN_EVERY,
      errands: new Set(),
      bind: null, // where the Hearthstone takes you
      hearthAt: 0, // when it is ready again, in seconds of play
      bindWanted: 0, // a zone whose inn the Hearthstone is to be bound at, on the way
      boundIn: new Set(), // zones whose inn it was bound at
      spells: new Set(), // what class quests have taught: s<spell> and i<totem>
    };
    st.pos = entityPoint(route.start.ref);
    st.zone = st.pos.area;
    st.bind = st.pos; // a new character's Hearthstone takes it to its starting area
    const inns = innkeepers.filter((k) => friendlyTo(k.npc, faction));
    const speed = () => (st.level >= MOUNT_LEVEL ? RUN * MOUNT_SPEED : RUN);

    /* The ways to travel: walking, flight paths between flight masters you know, and boats, zeppelins and the tram. */
    // On foot, a zone is crossed in a straight line, and left only where it meets the next (route.json's gates: a road,
    // a pass, a bridge, a tunnel): Loch Modan does not touch Redridge, nor the Badlands Arathi. A capital walks as part
    // of the zone around it. Teldrassil's tree top and Darnassus are one land; Rut'theran Village, at the foot of the
    // tree, another: the portal, the boat and the flight master connect it, no road does.
    const land = (p) => (ISLAND.has(p.area) ? (p.area === 141 && p.y >= 84 ? `${p.map}r` : `${p.map}i`) : `${p.map}:${CAPITAL_LAND[p.area] ?? p.area}`);
    const portals = [];
    for (const gate of plan.gates ?? []) {
      const a = placed(gate.a);
      const b = placed(gate.b);
      if (!a || !b) throw new Error(`gate ${gate.name}: a side is off the map`);
      portals.push({ kind: 'gate', p: a, gate, pair: portals.length + 1 }, { kind: 'gate', p: b, gate, pair: portals.length });
    }
    for (const t of plan.transports ?? []) {
      if (t.side !== 'both' && t.side !== faction) continue;
      const a = placed(t.a);
      const b = placed(t.b);
      if (!a || !b) throw new Error(`transport ${t.id}: a dock is off the map`);
      portals.push({ kind: 'dock', p: a, t, pair: portals.length + 1 }, { kind: 'dock', p: b, t, pair: portals.length });
    }
    const myTaxi = (n) => (n.side === 'both' || n.side === faction) && (!n.druid || route.cls === 'druid');
    for (const n of taxi) if (myTaxi(n)) portals.push({ kind: 'taxi', p: n.p, node: n });
    const N = portals.length;
    const WALK = 0,
      FLY = 1,
      RIDE = 2;
    let D = null;
    let NEXT = null;
    let EDGE = null;
    let graphKey = '';
    function graph() {
      const key = `${st.known.size}:${speed()}`;
      if (key === graphKey) return;
      graphKey = key;
      D = new Float64Array(N * N).fill(Infinity);
      NEXT = new Int16Array(N * N).fill(-1);
      EDGE = new Int8Array(N * N);
      const v = speed();
      for (let i = 0; i < N; i++)
        for (let j = 0; j < N; j++) {
          const a = portals[i];
          const b = portals[j];
          let c = i === j ? 0 : Infinity;
          let e = WALK;
          if (i !== j && land(a.p) === land(b.p)) c = dist(a.p, b.p) / v;
          if (a.kind === 'taxi' && b.kind === 'taxi' && i !== j && st.known.has(a.node.id) && st.known.has(b.node.id) && a.p.map === b.p.map) {
            const f = (FLY_DETOUR * dist(a.p, b.p)) / FLY_SPEED + FLY_OVERHEAD;
            if (f < c) [c, e] = [f, FLY];
          }
          if (a.kind === 'dock' && a.pair === j && a.t.time < c) [c, e] = [a.t.time, RIDE];
          if (a.kind === 'gate' && a.pair === j) c = Math.min(c, (a.gate.yards ?? dist(a.p, b.p)) / v);
          D[i * N + j] = c;
          EDGE[i * N + j] = e;
          if (c < Infinity) NEXT[i * N + j] = j;
        }
      for (let k = 0; k < N; k++)
        for (let i = 0; i < N; i++) {
          const ik = D[i * N + k];
          if (ik === Infinity) continue;
          for (let j = 0; j < N; j++) {
            const c = ik + D[k * N + j];
            if (c < D[i * N + j]) {
              D[i * N + j] = c;
              NEXT[i * N + j] = NEXT[i * N + k];
            }
          }
        }
    }
    // The few portals nearest a point on its own land, with the walk to each.
    function nearPortals(p) {
      const v = speed();
      const out = [];
      const l = land(p);
      for (let i = 0; i < N; i++) if (land(portals[i].p) === l && portals[i].p.map === p.map) out.push([i, dist(p, portals[i].p) / v]);
      out.sort((a, b) => a[1] - b[1]);
      return out.slice(0, 10);
    }
    /** The quickest way between two points: { cost in seconds, i, j } with i, j the first and last portal, or -1. */
    function travelBy(from, to) {
      graph();
      let best = { cost: land(from) === land(to) ? dist(from, to) / speed() : Infinity, i: -1, j: -1 };
      for (const [i, wi] of nearPortals(from))
        for (const [j, wj] of nearPortals(to)) {
          if (i === j) continue;
          const c = wi + D[i * N + j] + wj;
          if (c < best.cost - 1) best = { cost: c, i, j };
        }
      return best;
    }
    const knowsTeleport = (t) => (t.quests.length ? t.quests.some((q) => st.done.has(q) || st.active.has(q)) : st.level >= t.level);
    /** As travelBy, or by Hearthstone or a class teleport first when that is quicker: { cost, hearth | teleport, then }. */
    function travel(from, to) {
      let best = travelBy(from, to);
      if (from !== st.pos) return best;
      if (st.bind && st.seconds >= st.hearthAt) {
        const then = travelBy(st.bind, to);
        const c = HEARTH_CAST + then.cost;
        // Only when it saves real time: a short walk is not worth the cooldown.
        if (c < best.cost - 180) best = { cost: c, hearth: true, then, i: -1, j: -1 };
      }
      for (const t of myTeleports) {
        if (!knowsTeleport(t)) continue;
        const then = travelBy(t.at, to);
        const c = TELEPORT_CAST + then.cost;
        if (c < best.cost - 120) best = { cost: c, teleport: t, then, i: -1, j: -1 };
      }
      return best;
    }

    const xpFrom = { quests: 0, kills: 0, grinding: 0 };
    const gain = (xp, from) => {
      xpFrom[from] += xp;
      st.xp += xp;
      while (st.level < 60 && st.xp >= xpTable.get(st.level)) {
        st.xp -= xpTable.get(st.level);
        st.level++;
      }
    };
    const emit = (step) => {
      steps.push({ ...step, lv: st.level });
    };
    // On foot through a zone you quest in, the mobs in the way get killed: one every 200 yards, 300 mounted.
    let walked = 0;
    const walkTo = (p) => {
      if (st.pos && p.map === st.pos.map) {
        const d = dist(st.pos, p);
        st.travelled += d;
        st.seconds += d / speed();
        st.time.walk += d / speed();
        if (st.level >= 6 && !inCapital(p) && p.area === st.zone) {
          walked += d;
          const every = st.level >= MOUNT_LEVEL ? 300 : 200;
          while (walked >= every) {
            walked -= every;
            gain(Math.round(killXp(st.level, st.level, false) * 0.8), 'kills');
            st.seconds += 12;
            st.time.kill += 12;
          }
        }
      }
      st.pos = p;
    };
    /**
     * On the way: a flight master not known yet, or a quest ready to hand in, close to the way you walk (or where you
     * change from a boat to a flight) is seen to in passing: Menethil's flight master on the way to the boat, the
     * delivery to Stormwind when the tram goes through it.
     */
    function passBy(to) {
      const from = st.pos;
      if (!from || from.map !== to.map || land(from) !== land(to)) return;
      const dx = to.wx - from.wx;
      const dy = to.wy - from.wy;
      const L2 = dx * dx + dy * dy;
      const near = (q) => {
        const t = L2 ? Math.max(0, Math.min(1, ((q.wx - from.wx) * dx + (q.wy - from.wy) * dy) / L2)) : 0;
        return { t, d: Math.hypot(from.wx + t * dx - q.wx, from.wy + t * dy - q.wy) };
      };
      const along = [];
      for (const n of usableTaxi) {
        if (knownTaxi(n) || n.p.map !== from.map || land(n.p) !== land(from)) continue;
        const k = near(n.p);
        if (k.d <= PASS_BY) along.push({ t: k.t, n });
      }
      for (const [id, a] of st.active) {
        if (a.left.size) continue;
        const e = enderAt(a.q, from);
        if (e.map !== from.map || land(e) !== land(from)) continue;
        const k = near(e);
        if (k.d <= PASS_BY) along.push({ t: k.t, id, p: e });
      }
      along.sort((a, b) => a.t - b.t);
      for (const x of along) {
        if (x.n) {
          walkTo(x.n.p);
          emit({ t: 'P', node: x.n.id, e: ['n', x.n.npc], at: x.n.p });
          st.known.add(x.n.id);
          st.seconds += 10;
        } else if (st.active.has(x.id)) {
          walkTo(x.p);
          turnIn(x.id);
        }
      }
    }

    /** Goes to a point the quickest way, with a step for every flight, boat, teleport and zone on the way. */
    function goTo(p, zone) {
      let trip = travel(st.pos, p);
      if (trip.hearth) {
        emit({ t: 'H', at: st.bind, from: st.pos });
        st.seconds += HEARTH_CAST;
        st.time.travel += HEARTH_CAST;
        st.hearthAt = st.seconds + HEARTH_COOLDOWN;
        st.pos = st.bind;
        trip = trip.then;
      } else if (trip.teleport) {
        emit({ t: 'S', spell: trip.teleport.spell, at: trip.teleport.at, from: st.pos });
        st.seconds += TELEPORT_CAST;
        st.time.travel += TELEPORT_CAST;
        st.pos = trip.teleport.at;
        trip = trip.then;
      }
      if (trip.i >= 0) {
        passBy(portals[trip.i].p);
        walkTo(portals[trip.i].p);
        for (let i = trip.i; i !== trip.j; ) {
          const j = NEXT[i * N + trip.j];
          const edge = EDGE[i * N + j];
          const a = portals[i];
          const b = portals[j];
          if (edge === FLY) {
            emit({ t: 'F', node: a.node.id, to: b.node.id, e: ['n', a.node.npc], at: a.p });
            st.seconds += D[i * N + j];
            st.time.travel += D[i * N + j];
            st.flown += dist(a.p, b.p);
            st.pos = b.p;
          } else if (edge === RIDE) {
            emit({ t: 'B', tr: a.t.id, at: a.p, to: b.p });
            st.seconds += a.t.time;
            st.time.travel += a.t.time;
            st.pos = b.p;
          } else {
            passBy(b.p);
            walkTo(b.p);
            // Through a gate into a zone on the way: a step for it, so the way is shown zone by zone (over Thandol Span
            // into the Wetlands, through Dun Algaz into Loch Modan...).
            if (a.kind === 'gate' && a.pair === j && b.p.area !== st.zone) {
              emit({ t: 'Z', z: b.p.area, at: b.p });
              st.zone = b.p.area;
            }
          }
          i = j;
        }
      }
      passBy(p);
      if (zone !== st.zone) emit({ t: 'Z', z: zone, at: p });
      walkTo(p);
      st.zone = zone;
    }

    const closedByExclusive = (q) =>
      (q.exclusive && (exclusiveGroups.get(q.exclusive) ?? []).some((id) => id !== q.id && (st.done.has(id) || st.active.has(id)))) ||
      q.exclusiveTo.some((id) => st.done.has(id) || st.active.has(id)) ||
      q.closedBy.some((id) => st.done.has(id) || st.active.has(id)) ||
      q.closedByDone.some((id) => st.done.has(id));
    // A class quest is essential while what it leads to is still to learn: another race's imp quest, the spell known
    // already, is an ordinary quest.
    // And only while it can be finished on this route: every quest on the way to the spell placed somewhere it goes.
    const reachMemo = new Map();
    function reachable(q, depth = 0) {
      if (reachMemo.has(q.id)) return reachMemo.get(q.id);
      reachMemo.set(q.id, false);
      let ok = Boolean(placeOf(q));
      if (ok && !q.teaches) ok = depth < 12 && (followUps.get(q.id) ?? []).some((f) => f.classOnly && f.essential && forMe(f) && reachable(f, depth + 1));
      reachMemo.set(q.id, ok);
      return ok;
    }
    // One quest at a time toward a spell: with one in the log (the race's own imp quest), another race's copy waits.
    function essentialNow(q) {
      if (!q.essential) return false;
      const open = [...q.goals].filter((k) => !st.spells.has(k));
      if (!open.length || !reachable(q)) return false;
      if (st.active.has(q.id)) return true;
      return open.some((k) => ![...st.active.values()].some((a) => a.q.essential && a.q.goals.has(k)));
    }
    // Prerequisites this character can ever have: a quest of the other side or another class named as one (a slip in
    // the data) does not hold it back.
    const preMemo = new Map();
    function prereqs(q) {
      let r = preMemo.get(q.id);
      if (r) return r;
      const can = (p) => !catalog.has(p) || forMe(catalog.get(p));
      r = { group: q.preGroup.filter(can), any: q.preAny.filter(can) };
      preMemo.set(q.id, r);
      return r;
    }
    // Is a quest one this character can take now, at its level? (`after`: as if that quest were handed in.)
    function available(q, after = 0) {
      if (st.done.has(q.id) || st.active.has(q.id) || st.dropped.has(q.id) || route.banned?.has(q.id)) return false;
      if (!forMe(q)) return false;
      if (tooHigh(q, st.level)) return false;
      if (q.level < st.level - MAX_BELOW && !essentialNow(q)) return false;
      if (q.elite && st.level < q.level + eliteOver(q)) return false;
      if (q.drop?.fight && !canFight({ fight: true, id: q.drop.ref[1] })) return false;
      const done = (p) => p === after || st.done.has(p);
      if (q.pre && !done(q.pre)) return false;
      if (q.preActive && (q.preActive === after || !st.active.has(q.preActive))) return false;
      const pr = prereqs(q);
      if (pr.group.length && !pr.group.every(done)) return false;
      if (pr.any.length && !pr.any.some(done)) return false;
      if (closedByExclusive(q)) return false;
      return true;
    }
    // Where a quest is given, finished and done, when all of it lies in zones this route visits.
    const placeCache = new Map();
    function placeOf(q) {
      if (placeCache.has(q.id)) return placeCache.get(q.id);
      let res = null;
      // A giver or taker that stands in a few places of its zone (an object that starts a quest, spawned here and
      // there) can be met at any of them: `pts`, `p` the first.
      // One that is hostile is no one to talk to, unless no other is there: then a script turns it (Taskmaster Fizzule
      // takes your report once you salute him).
      const pick = (list) =>
        (list.some(friendly) ? list.filter(friendly) : list)
          .map((g) => {
            const cs = camps(g[0], g[1]).filter((c) => zoneSet.has(c.area));
            return cs.length ? { ref: g, p: cs[0], pts: cs.filter((c) => c.area === cs[0].area) } : null;
          })
          .find(Boolean);
      // Where events.mjs places a giver or taker (called up by a script, or met at one stop of its walk) comes first.
      const meet = (m) => {
        const pts = m ? m.pts.filter((p) => zoneSet.has(p.area)) : [];
        return pts.length ? { ref: m.ref, p: pts[0], pts: pts.filter((p) => p.area === pts[0].area) } : null;
      };
      const fromDrop = (d) => {
        if (!d) return null;
        const cs = camps(d.ref[0], d.ref[1]).filter((c) => zoneSet.has(c.area));
        return cs.length ? { ref: d.ref, p: cs[0], pts: cs.filter((c) => c.area === cs[0].area) } : null;
      };
      const giver = meet(q.meetGiver) ?? fromDrop(q.drop) ?? pick(q.givers);
      const ender = meet(q.meetEnder) ?? pick(q.enders);
      if (giver && ender) {
        const objs = q.objectives.map((o) => {
          if (o.kind === 'explore') return o.point && zoneSet.has(o.point.area) ? [{ ...o.point, ref: { kind: 'x', id: o.id } }] : [];
          if (o.end) {
            // An escort: met where its creature stands (by the giver when a script calls it up there).
            if (!zoneSet.has(o.end.area)) return [];
            const start = (o.targets ?? []).flatMap((t) => camps(t.kind, t.id).filter((c) => zoneSet.has(c.area)).map((c) => ({ ...c, ref: t })));
            return start.length ? start : [{ ...giver.p, ref: o.targets?.[0] ?? { kind: 'x', id: 0 } }];
          }
          const pts = [];
          for (const t of o.targets ?? []) for (const c of camps(t.kind, t.id)) if (zoneSet.has(c.area)) pts.push({ ...c, ref: t });
          for (const p of o.points ?? []) if (zoneSet.has(p.area)) pts.push({ ...p, ref: { kind: 'x', id: 0 } });
          return pts;
        });
        if (objs.every((p) => p.length)) res = { giver, ender, objs };
      }
      placeCache.set(q.id, res);
      return res;
    }

    /** The nearest of the places a quest is given at (or handed in at) to a point. */
    const nearestOf = (pts, to) => {
      let best = pts[0];
      for (const p of pts) if (dist(p, to) < dist(best, to)) best = p;
      return best;
    };
    const giverAt = (q, to) => nearestOf(placeOf(q).giver.pts, to);
    const enderAt = (q, to) => nearestOf(placeOf(q).ender.pts, to);

    /** Can the character fight at this spot now? Mobs a level or two above at most, elites only below it. */
    const canFight = (ref) => !ref?.fight || (npcElite(ref.id) ? npcLevel(ref.id) < st.level : npcLevel(ref.id) <= st.level + mobUp(st.level));
    const ownSide = (id) => npcs[id]?.[5]?.[faction === 'alliance' ? 0 : 1] === 'f';
    /** The places in a zone where an objective can be done now (a creature of your own side is no one to kill for its
     * drop: the flagon Malgin Barleybrew sells is not looted from him). */
    const doable = (pl, i, zone) =>
      pl.objs[i].filter((p) => (zone === undefined || inZone(p.area, zone)) && canFight(p.ref) && !(p.ref?.fight && p.ref.kind === 'n' && ownSide(p.ref.id)));

    const killSeconds = (n) => n * 16; // a kill with the walk to it and the rest after, at Classic's pace
    // An escort walks at about half your pace, and stops to fight: never less than its usual few minutes.
    const escortSeconds = (from, to) => Math.max(EVENT_SECONDS.escort / 2, (from.map === to.map ? dist(from, to) : 0) / (RUN / 2));
    // XP a second, killing what stands around, as the route weighs it: slower than a quest's kills (mobs to find, others
    // to share them with, no reward at the end), so a quest is taken over grinding whenever it is anywhere near as good.
    // The time it takes, for the hours a route shows, is a kill every 30 seconds.
    const GRIND_KILL = 40;
    const GRIND_KILL_TIME = 30;
    const grindRate = () => killXp(st.level, st.level, false) / GRIND_KILL;
    /**
     * What a quest is worth: its XP a second, the walk and the kills counted, against killing what stands around; null
     * when it is not worth it. Class quests and quests that open others are always worth it.
     */
    // A quest's XP (its own and its kills') and the seconds it takes, from its giver to its end: per quest and level.
    const estimates = new Map();
    function estimate(q, pl) {
      const key = q.id * 100 + st.level;
      let e = estimates.get(key);
      if (e) return e;
      let at = pl.giver.p;
      let seconds = 20;
      let xp = questXp(q.xp, q.level, st.level);
      // The kills, at the level of what is killed: a quest for gray mobs' drops pays nothing for them.
      const kill = (n, id) => {
        const elite = npcElite(id);
        seconds += killSeconds(n * (elite ? 3 : 1));
        xp += n * killXp(st.level, npcLevel(id), elite) * 0.8;
      };
      q.objectives.forEach((o, i) => {
        let near = pl.objs[i][0];
        for (const p of pl.objs[i]) if (dist(at, p) < dist(at, near)) near = p;
        seconds += Math.min(dist(at, near), 3000) / speed();
        at = near;
        if (o.kind === 'kill') kill(o.count, o.id);
        if (o.kind === 'item' && near.ref?.kind === 'n') kill(Math.min(o.count * 8, Math.ceil(o.count / Math.max(0.05, (near.ref.pct ?? 100) / 100))), near.ref.id);
        if (o.end) {
          // An escort: the walk to its end at its pace.
          seconds += escortSeconds(near, o.end);
          at = o.end;
        } else if (o.kind === 'event') seconds += EVENT_SECONDS[o.sub] ?? 30;
      });
      seconds += Math.min(dist(at, pl.ender.p), 3000) / speed();
      e = { xp, seconds };
      estimates.set(key, e);
      return e;
    }
    /**
     * What a quest is worth: its XP a second, the walk and the kills counted, against killing what stands around; null
     * when it is not worth it. A class's essential quests and quests that open others are always worth it.
     */
    function worth(q, pl) {
      const e = estimate(q, pl);
      const rate = e.xp / e.seconds / grindRate();
      if (essentialNow(q) || (opens.get(q.id) && !q.classOnly)) return Math.max(rate, 1);
      return rate >= 0.3 ? rate : null;
    }
    const want = (q, after = 0) => {
      if (!available(q, after)) return null;
      const pl = placeOf(q);
      return pl ? worth(q, pl) : null;
    };
    /** Why a quest of this zone is not taken (tools: route.why). */
    function whyNot(q, zone) {
      const pl = placeOf(q);
      if (!forMe(q) || !pl || pl.giver.p.area !== zone) return route.why.get(q.id);
      if (st.done.has(q.id)) return 'done';
      if (st.dropped.has(q.id)) return `dropped@${st.level}`;
      if (route.banned?.has(q.id)) return 'banned';
      if (tooHigh(q, st.level)) return `high@${st.level}`;
      if (q.level < st.level - MAX_BELOW && !essentialNow(q)) return `low@${st.level}`;
      if (q.elite && st.level < q.level + eliteOver(q)) return `elite@${st.level}`;
      if ((q.pre && !st.done.has(q.pre)) || (q.preGroup.length && !q.preGroup.every((p) => st.done.has(p))) || (q.preAny.length && !q.preAny.some((p) => st.done.has(p)))) return `pre@${st.level}`;
      if (q.preActive && !st.active.has(q.preActive)) return `preActive@${st.level}`;
      if (closedByExclusive(q)) return 'exclusive';
      return `worth@${st.level}`;
    }

    // The kills an objective takes, the XP they give and the time it all takes.
    function objectiveWork(o, at) {
      if (o.kind === 'kill') return { n: o.count * (npcElite(o.id) ? 3 : 1), xp: o.count * killXp(st.level, npcLevel(o.id), npcElite(o.id)), s: 0 };
      if (o.kind === 'item' && at?.ref?.kind === 'n') {
        const n = Math.min(o.count * 8, Math.ceil(o.count / Math.max(0.05, (at.ref.pct ?? 100) / 100)));
        return { n: n * (npcElite(at.ref.id) ? 3 : 1), xp: n * killXp(st.level, npcLevel(at.ref.id), npcElite(at.ref.id)), s: 0 };
      }
      if (o.kind === 'event') {
        if (o.sub === 'kill' && at?.ref?.kind === 'n') return { n: npcElite(at.ref.id) ? 3 : 1, xp: killXp(st.level, npcLevel(at.ref.id), npcElite(at.ref.id)), s: EVENT_SECONDS.kill };
        return { n: o.sub === 'escort' ? 3 : o.sub === 'item' ? 1 : 0, xp: o.sub === 'escort' ? 3 * killXp(st.level, st.level, false) : 0, s: o.end && at ? escortSeconds(at, o.end) : (EVENT_SECONDS[o.sub] ?? 30) };
      }
      if (o.kind === 'object') return { n: 0, xp: 0, s: 10 * o.count };
      return { n: 0, xp: 0, s: 0 };
    }

    const knownTaxi = (n) => st.known.has(n.id);
    const usableTaxi = taxi.filter(myTaxi);

    /* ── The work at hand: the hub you stand in ── */

    function turnIn(id) {
      const a = st.active.get(id);
      const pl = placeOf(a.q);
      emit({ t: 'T', q: id, e: pl.ender.ref, at: enderAt(a.q, st.pos) });
      st.active.delete(id);
      st.done.add(id);
      if (a.q.teaches) st.spells.add(a.q.teaches);
      gain(questXp(a.q.xp, a.q.level, st.level), 'quests');
      st.seconds += 10;
    }
    function accept(q) {
      const pl = placeOf(q);
      if (q.drop?.fight) {
        // The item that starts it, from what drops it.
        const n = Math.min(3, Math.ceil(100 / q.drop.pct));
        gain(n * killXp(st.level, npcLevel(q.drop.ref[1]), npcElite(q.drop.ref[1])), 'kills');
        st.seconds += killSeconds(n);
        st.time.kill += killSeconds(n);
      }
      emit({ t: 'A', q: q.id, e: pl.giver.ref, at: giverAt(q, st.pos) });
      st.active.set(q.id, { q, left: new Set(q.objectives.map((_, i) => i)) });
      st.seconds += 10;
    }
    /** Something to do for a hub within reach: the nearest turn-in, or else the nearest quest to take; or null. */
    function hubWork(radius) {
      let best = null;
      const consider = (p) => {
        const d = dist(st.pos, p);
        if (d <= radius && (!best || d < best.d)) best = { p, d };
      };
      // A turn-in first: what it opens is often given right there.
      for (const [, a] of st.active) if (!a.left.size) consider(enderAt(a.q, st.pos));
      if (best) return best;
      if (st.active.size < LOG_SIZE) {
        const inPlay = candidates().includes(st.zone);
        for (const q of giversNear(st.pos, radius)) {
          if (!inPlay && q.level < st.level - 3 && !essentialNow(q)) continue;
          if (want(q) === null) continue;
          consider(giverAt(q, st.pos));
        }
      }
      return best;
    }
    function atHand() {
      let acted = false;
      // A zone with a good deal of work: the Hearthstone is bound at its inn, so it brings you back from errands.
      if (st.bindWanted && st.bindWanted === st.zone) {
        const inn = inns.find((k) => k.p.area === st.zone && dist(k.p, st.pos) <= BIND_REACH);
        if (inn) {
          walkTo(inn.p);
          emit({ t: 'N', e: ['n', inn.npc], at: inn.p });
          st.bind = inn.p;
          st.boundIn.add(st.zone);
          st.bindWanted = 0;
          st.seconds += 15;
          acted = true;
        }
      }
      for (const n of usableTaxi)
        if (!knownTaxi(n) && dist(st.pos, n.p) <= DISCOVER) {
          walkTo(n.p);
          emit({ t: 'P', node: n.id, e: ['n', n.npc], at: n.p });
          st.known.add(n.id);
          st.seconds += 10;
          acted = true;
        }
      // The trainer, when spells are due and one stands close.
      if (st.level >= st.lastTrain + TRAIN_EVERY && st.level >= TRAIN_FIRST) {
        let t = null;
        for (const x of myTrainers) if ((dist(x.p, st.pos) <= TRAIN_NEAR || (inCapital(st.pos) && x.p.area === st.pos.area)) && (!t || dist(x.p, st.pos) < dist(t.p, st.pos))) t = x;
        if (t) {
          walkTo(t.p);
          // What the trainer takes back first (the class letter), then the training.
          for (const [id, a] of [...st.active]) if (!a.left.size && dist(t.p, enderAt(a.q, t.p)) <= 10) turnIn(id);
          emit({ t: 'R', npc: t.npc, at: t.p });
          st.lastTrain = st.level;
          st.seconds += 60;
          acted = true;
        }
      }
      // The hub: hand in everything finished and take everything worth taking, here and at the givers close by, one
      // person at a time: the turn-ins first (they open quests here), the nearest first, then the quests to take, the
      // nearest first (the one you stand at), by quest id.
      // In a zone the route is not questing in (come for a trainer or a class quest), its low quests stay, as in the
      // zone's planned path.
      const inPlay = candidates().includes(st.zone);
      const lowHere = (q) => !inPlay && q.level < st.level - 3 && !essentialNow(q);
      for (let guard = 0; guard < 400; guard++) {
        const todo = [];
        for (const [id, a] of st.active) if (!a.left.size) todo.push({ p: enderAt(a.q, st.pos), id, take: false });
        if (st.active.size < LOG_SIZE) for (const q of giversNear(st.pos, HUB_RADIUS)) if (!lowHere(q)) todo.push({ p: giverAt(q, st.pos), id: q.id, take: q });
        const near = todo
          .map((t) => ({ ...t, d: dist(st.pos, t.p) }))
          .filter((t) => t.d <= HUB_RADIUS && (!t.take || want(t.take) !== null))
          .sort((a, b) => Number(Boolean(a.take)) - Number(Boolean(b.take)) || Math.round(a.d / 5) - Math.round(b.d / 5) || a.id - b.id);
        if (near.length) {
          const t = near[0];
          walkTo(t.p);
          if (t.take) accept(t.take);
          else turnIn(t.id);
          acted = true;
          continue; // a follow-up may open right here
        }
        const next = hubWork(PICKUP_RADIUS);
        if (!next || next.d < 1) break;
        walkTo(next.p);
        acted = true;
      }
      return acted;
    }

    /* ── The zone's work: a planned path through it ── */

    // Each move to another place costs a few yards more than the way there (the talk, the turn): what one person gives
    // and takes is done in one visit, not split around a step to someone standing beside them.
    const tour = createTour((a, b) => (a.map !== b.map ? 1e7 : dist(a, b) + (dist(a, b) > 2 ? STOP_YARDS : 0)));
    let tourZone = -1;
    const blocked = new Set(); // tasks that turned out not to be doable, until the next level
    let blockedAt = 0;
    function tasks() {
      if (blockedAt !== st.level) {
        blocked.clear();
        blockedAt = st.level;
      }
      const list = new Map();
      const zone = st.zone;
      const add = (key, task) => {
        if (!blocked.has(key)) list.set(key, task);
      };
      for (const [id, a] of st.active) {
        const pl = placeOf(a.q);
        let complete = true;
        const objs = [];
        for (const i of a.left) {
          const pts = doable(pl, i, zone);
          if (pts.length) {
            add(`O${id}.${i}`, { kind: 'O', id, i, pts, pre: [], group: id });
            objs.push(`O${id}.${i}`);
          } else complete = false;
        }
        if (complete && (inZone(pl.ender.p.area, zone) || dist(st.pos, pl.ender.p) <= NEARBY)) add(`T${id}`, { kind: 'T', id, pts: pl.ender.pts, pre: objs, group: id });
      }
      // A quest to take, with its objectives and its turn-in when they are all here; `after`: the turn-in it waits for.
      const plan = (q, pl, after) => {
        const id = q.id;
        add(`A${id}`, { kind: 'A', id, pts: pl.giver.pts, pre: after ? [`T${after}`] : [], group: id });
        let complete = true;
        const objs = [];
        q.objectives.forEach((_, i) => {
          const pts = doable(pl, i, zone);
          if (pts.length) {
            add(`O${id}.${i}`, { kind: 'O', id, i, pts, pre: [`A${id}`], group: id });
            objs.push(`O${id}.${i}`);
          } else complete = false;
        });
        if (complete && (inZone(pl.ender.p.area, zone) || dist(pl.giver.p, pl.ender.p) <= NEARBY)) add(`T${id}`, { kind: 'T', id, pts: pl.ender.pts, pre: [`A${id}`, ...objs], group: id });
      };
      const room = LOG_SIZE - st.active.size;
      const offered = [];
      if (room > 0) {
        const offers = [];
        // A quest far from everything there is to do now, but close to quests that open here in the next levels, waits
        // for them: one trip there later, not two.
        const nowPts = [st.pos];
        for (const t of list.values()) nowPts.push(...t.pts);
        const later = laterHere(zone);
        const inPlay = candidates().includes(zone);
        for (const q of catalog.values()) {
          const value = want(q);
          if (route.why && value === null) route.why.set(q.id, whyNot(q, zone));
          if (value === null) continue;
          const pl = placeOf(q);
          if (!inZone(pl.giver.p.area, zone)) continue;
          // A zone the route is not questing in (passed through for a trainer or a class quest): its low quests stay.
          if (!inPlay && q.level < st.level - 3 && !essentialNow(q)) continue;
          if (!essentialNow(q) && later.length) {
            const g = pl.giver.p;
            if (nowPts.every((p) => dist(p, g) > WAIT_FAR) && later.some((p) => dist(p, g) <= WAIT_NEAR)) continue;
          }
          offers.push({ q, pl, value: essentialNow(q) ? Infinity : value });
        }
        offers.sort((a, b) => b.value - a.value);
        for (const { q, pl } of offers.slice(0, room)) {
          plan(q, pl);
          offered.push(q.id);
        }
      }
      // What a turn-in here opens is planned with it, and what that one opens, three steps of a chain deep: the next
      // quest is often given by the one who takes the last, with its objectives near the last's. The path then hands the
      // first in before it goes where both lead, and goes to a camp once for the quests of a chain that all need it.
      const chain = [...st.active.keys(), ...offered].map((id) => [id, 0]);
      for (let k = 0; k < chain.length; k++) {
        const [p, depth] = chain[k];
        if (!list.has(`T${p}`)) continue;
        for (const q of followUps.get(p) ?? []) {
          if (list.has(`A${q.id}`) || want(q, p) === null) continue;
          const pl = placeOf(q);
          if (!inZone(pl.giver.p.area, zone) && dist(pl.giver.p, st.pos) > NEARBY) continue;
          plan(q, pl, p);
          if (depth < 2) chain.push([q.id, depth + 1]);
        }
      }
      for (const n of usableTaxi) if (!knownTaxi(n) && (n.p.area === zone || dist(st.pos, n.p) <= FP_NEAR)) add(`P${n.id}`, { kind: 'P', id: n.id, pts: [n.p], pre: [] });
      // Much to do here, and the Hearthstone bound far away: it is bound at this zone's inn on the way (once a zone).
      if (!st.bindWanted && list.size >= 8 && !inCapital(st.pos) && !st.boundIn.has(zone) && (st.bind.area !== zone || dist(st.bind, st.pos) > 800) && inns.some((k) => k.p.area === zone)) st.bindWanted = zone;
      // The inn of a zone with a good deal of work, to bind the Hearthstone at.
      if (st.bindWanted === zone) {
        let inn = null;
        for (const k of inns) if (k.p.area === zone && (!inn || dist(k.p, st.pos) < dist(inn.p, st.pos))) inn = k;
        if (inn) add('N', { kind: 'N', pts: [inn.p], pre: [] });
        else st.bindWanted = 0;
      }
      return list;
    }
    /**
     * Where the zone's work goes on after the tasks there are now: the middle of the givers of its quests that open in
     * the next levels (or the ones the log has no room for yet). The zone's path ends drawn toward it, so a far errand
     * is run while it is on the way, not left for last. Null when nothing more is to come here.
     */
    function workAhead(list) {
      let x = 0;
      let y = 0;
      let n = 0;
      const level = st.level + 3;
      for (const q of byGiverZone.get(st.zone) ?? []) {
        if (list.has(`A${q.id}`) || st.done.has(q.id) || st.active.has(q.id) || st.dropped.has(q.id) || route.banned?.has(q.id)) continue;
        if (tooHigh(q, level) || q.level < st.level - 2 || closedByExclusive(q)) continue;
        if (q.elite && level < q.level + eliteOver(q)) continue;
        if (available(q) && want(q) === null) continue; // open now and not worth it: no work to come
        const p = placeOf(q).giver.p;
        if (p.map !== st.pos.map || inCapital(p)) continue;
        x += p.wx;
        y += p.wy;
        n++;
      }
      return n >= 3 ? { map: st.pos.map, wx: x / n, wy: y / n } : null;
    }

    /** The givers of the quests of a zone that open in the next two levels (or right after a quest in the log). */
    function laterHere(zone) {
      const out = [];
      const level = st.level + 2;
      for (const q of giversIn(zone)) {
        if (st.done.has(q.id) || st.active.has(q.id) || st.dropped.has(q.id) || route.banned?.has(q.id) || closedByExclusive(q)) continue;
        if (tooHigh(q, level) || q.level < st.level - MAX_BELOW) continue;
        if (q.elite && level < q.level + eliteOver(q)) continue;
        if (available(q)) continue;
        const pres = [q.pre, ...q.preGroup].filter(Boolean);
        if (!pres.every((p) => st.done.has(p) || st.active.has(p))) continue;
        out.push(placeOf(q).giver.p);
      }
      return out;
    }

    /** Does the objectives with a place within reach of a spot: every quest's, all at once. */
    function workAt(p) {
      const doneHere = new Map();
      let after = null; // where an escort leaves you
      for (const [id, a] of st.active) {
        const pl = placeOf(a.q);
        for (const i of [...a.left]) {
          const near = doable(pl, i).find((x) => dist(x, p) <= SYNERGY_RADIUS);
          if (!near) continue;
          if (!doneHere.has(id)) doneHere.set(id, { list: [], ref: near.ref });
          doneHere.get(id).list.push(i);
          a.left.delete(i);
          const w = objectiveWork(a.q.objectives[i], near);
          gain(w.xp, 'kills');
          st.seconds += killSeconds(w.n) + w.s;
          st.time.kill += killSeconds(w.n) + w.s;
          if (a.q.objectives[i].end) after = a.q.objectives[i].end;
        }
      }
      for (const [id, d] of doneHere) emit({ t: 'C', q: id, o: d.list, at: p, e: d.ref && d.ref.kind !== 'x' ? [d.ref.kind, d.ref.id] : null });
      if (after && after.map === st.pos.map) {
        // Walked there with the escort (its time is counted with it).
        st.travelled += dist(st.pos, after);
        st.pos = after;
      }
      return doneHere.size > 0;
    }

    /* ── Between zones ── */

    /* The quest log between zones: quests gone gray go, and a crowded log keeps what pays best for the way to it. */
    function prune() {
      const drop = (id, why) => {
        route.debug?.push(`L${st.level}: drop ${id} ${catalog.get(id)?.name} (${why})`);
        st.active.delete(id);
        st.dropped.add(id);
      };
      for (const [id, a] of [...st.active]) if (!essentialNow(a.q) && a.left.size && a.q.level < st.level - MAX_BELOW) drop(id, 'gray');
      if (st.active.size > LOG_SIZE - 4) {
        const scored = [...st.active]
          .filter(([, a]) => !essentialNow(a.q))
          .map(([id, a]) => {
            const pl = placeOf(a.q);
            const p = a.left.size ? ([...a.left].flatMap((i) => doable(pl, i))[0] ?? pl.ender.p) : pl.ender.p;
            return { id, score: (questXp(a.q.xp, a.q.level, st.level) + chainRest(a.q)) / (travel(st.pos, p).cost + 300) };
          })
          .sort((a, b) => a.score - b.score);
        while (st.active.size > LOG_SIZE - 6 && scored.length) drop(scored.shift().id, 'log full');
      }
    }

    function pathCrossesSea(trip) {
      // By Hearthstone or teleport: across the sea when where it lands is, or when the way on from there is.
      if (trip.hearth) return land(st.bind) !== land(st.pos) || pathCrossesSea(trip.then);
      if (trip.teleport) return land(trip.teleport.at) !== land(st.pos) || pathCrossesSea(trip.then);
      for (let i = trip.i; i >= 0 && i !== trip.j; ) {
        const j = NEXT[i * N + trip.j];
        if (EDGE[i * N + j] === RIDE) return true;
        i = j;
      }
      return false;
    }

    // The quests this character may ever take, by the zone their giver stands in.
    const byGiverZone = new Map();
    for (const q of catalog.values()) {
      if (!forMe(q)) continue;
      const pl = placeOf(q);
      if (!pl) continue;
      const z = pl.giver.p.area;
      if (!byGiverZone.has(z)) byGiverZone.set(z, []);
      byGiverZone.get(z).push(q);
    }

    // A zone's quests with those of the capital in it (Mulgore's with Thunder Bluff's).
    const zoneGivers = new Map();
    const giversIn = (zone) => {
      if (!zoneGivers.has(zone)) {
        const cities = Object.keys(CITY_ZONE).map(Number).filter((c) => CITY_ZONE[c] === zone);
        zoneGivers.set(zone, [...(byGiverZone.get(zone) ?? []), ...cities.flatMap((c) => byGiverZone.get(c) ?? [])]);
      }
      return zoneGivers.get(zone);
    };

    // Their givers on a grid of 100 yards, to find the ones a few steps away quickly (by quest id, as the catalog runs).
    const GIVER_CELL = 100;
    const giverGrid = new Map();
    for (const list of byGiverZone.values())
      for (const q of list)
        for (const p of placeOf(q).giver.pts) {
          const k = `${p.map}:${Math.floor(p.wx / GIVER_CELL)}:${Math.floor(p.wy / GIVER_CELL)}`;
          if (!giverGrid.has(k)) giverGrid.set(k, []);
          if (!giverGrid.get(k).includes(q)) giverGrid.get(k).push(q);
        }
    function giversNear(p, radius) {
      const out = new Set();
      const r = Math.ceil(radius / GIVER_CELL);
      const cx = Math.floor(p.wx / GIVER_CELL);
      const cy = Math.floor(p.wy / GIVER_CELL);
      for (let dx = -r; dx <= r; dx++) for (let dy = -r; dy <= r; dy++) for (const q of giverGrid.get(`${p.map}:${cx + dx}:${cy + dy}`) ?? []) out.add(q);
      return [...out].sort((a, b) => a.id - b.id);
    }

    // What the rest of a chain pays: a quest's follow-ups for this character, and theirs, a little less each step away,
    // and much less when the next is given in another zone (one more trip). A turn-in that opens a long chain is worth
    // more than its own XP, and a trip for it pays when the quest alone would not.
    const chainMemo = new Map();
    function chainRest(q, depth = 0) {
      if (depth > 12) return 0;
      if (chainMemo.has(q.id)) return chainMemo.get(q.id);
      chainMemo.set(q.id, 0); // a cycle in the data counts nothing
      let xp = 0;
      for (const f of followUps.get(q.id) ?? []) {
        if (!forMe(f) || route.banned?.has(f.id) || !placeOf(f)) continue;
        const pq = placeOf(q);
        const here = !pq || placeOf(f).giver.p.area === pq.ender.p.area || dist(placeOf(f).giver.p, pq.ender.p) <= NEARBY;
        xp += (here ? CHAIN_NEAR : CHAIN_FAR) * (questXp(f.xp, f.level, f.level) + chainRest(f, depth + 1));
      }
      chainMemo.set(q.id, xp);
      return xp;
    }

    /** A zone's work now: its quests to take, the objectives and turn-ins of quests in the log, what they pay (with what
     * their chains go on to pay) and the time they take there, and the place to start. */
    function zoneWork(zone) {
      let xp = 0;
      let seconds = 0;
      let n = 0;
      let first = null;
      let firstD = Infinity;
      const detail = route.debug ? [] : null;
      const near = (p) => {
        const d = dist(st.pos, p);
        if (!first || d < firstD) {
          first = p;
          firstD = d;
        }
      };
      for (const [, a] of st.active) {
        const pl = placeOf(a.q);
        if (!a.left.size) {
          if (inZone(pl.ender.p.area, zone)) {
            xp += questXp(a.q.xp, a.q.level, st.level) + chainRest(a.q) / 2;
            detail?.push(`T${a.q.id}`);
            seconds += 20;
            n++;
            near(enderAt(a.q, st.pos));
          }
          continue;
        }
        const pts = [...a.left].flatMap((i) => doable(pl, i, zone));
        if (pts.length) {
          const e = estimate(a.q, pl);
          xp += e.xp / 2 + chainRest(a.q) / 4;
          detail?.push(`O${a.q.id}`);
          seconds += e.seconds / 2;
          n++;
          near(pts[0]);
        }
      }
      let room = LOG_SIZE - st.active.size;
      for (const q of giversIn(zone)) {
        if (room <= 0) break;
        if (want(q) === null) continue;
        const pl = placeOf(q);
        const e = estimate(q, pl);
        xp += e.xp;
        detail?.push(`A${q.id}`);
        seconds += e.seconds;
        n++;
        room--;
        near(giverAt(q, st.pos));
      }
      return { zone, xp, seconds, n, first, detail };
    }

    /** What opens in a zone in the next levels: the XP of its quests one or two levels up would make available. */
    function zoneSoon(zone, levels = 1) {
      let xp = 0;
      const level = st.level + levels;
      for (const q of giversIn(zone)) {
        if (st.done.has(q.id) || st.active.has(q.id) || st.dropped.has(q.id) || route.banned?.has(q.id) || closedByExclusive(q)) continue;
        if (tooHigh(q, level) || q.level < level - MAX_BELOW || (q.elite && level < q.level + eliteOver(q))) continue;
        // The prerequisites done, or in the zone's own reach (a chain opens on the visit).
        const pres = [q.pre, ...q.preGroup].filter(Boolean);
        if (!pres.every((p) => st.done.has(p) || st.active.has(p) || (catalog.get(p) && inZone(placeOf(catalog.get(p))?.giver.p.area, zone)))) continue;
        if (q.preAny.length && !q.preAny.some((p) => st.done.has(p) || st.active.has(p))) continue;
        if (available(q)) continue; // open now: not what the levels bring
        xp += questXp(q.xp, q.level, level);
      }
      return xp;
    }

    // The zones the route may go to: the plan's, once the plan has come near them (no other race's starting zone, no
    // crossing to the far continent before the plan does), the capitals, and the zones of the class's own quests.
    const planStart = new Map();
    route.plan.forEach(([zone], k) => {
      const from = k > 0 ? route.plan[k - 1][1] - 2 : 1;
      if (!planStart.has(zone)) planStart.set(zone, from);
    });
    const classZones = new Set([...zoneSet].filter((z) => !route.zones.includes(z)));
    function candidates() {
      const out = [];
      for (const zone of zoneSet) {
        const from = planStart.get(zone);
        if ((from !== undefined && st.level >= from) || CAPITALS[faction].includes(zone) || classZones.has(zone)) out.push(zone);
      }
      return out;
    }

    /**
     * The zone to go to next: the one whose work pays best for the time it takes, the way there counted, with the plan's
     * zones for this level (route.json) a little ahead of the rest and a sea crossing a little behind. Null when no zone
     * pays like killing things where you stand.
     */
    function nextZone() {
      const window = new Set();
      route.plan.forEach(([zone, until], k) => {
        const from = k > 0 ? route.plan[k - 1][1] - 2 : 1;
        if (st.level >= from && st.level < until + 1) window.add(zone);
      });
      const typ = typicalXp(st.level);
      let best = null;
      const looked = [];
      for (const zone of candidates()) {
        if (zone === st.zone) continue;
        const w = zoneWork(zone);
        // A visit has to be worth the trip: a few quests' worth, or less in the plan's zone for this level; across the
        // sea, a good deal of work.
        if (!w.first || w.xp < typ * (window.has(zone) ? MIN_WORK_PLAN : MIN_WORK)) continue;
        const trip = travel(st.pos, w.first);
        if (!Number.isFinite(trip.cost)) continue;
        const sea = pathCrossesSea(trip);
        if (sea && w.xp < typ * SEA_WORK) continue;
        // The way there counts twice (the way on from there is as long, as often as not), and what opens there in the
        // next two levels counts half: a zone to stay in a while beats a zone to pass through. Half, as far as the work
        // there now takes you toward the next level: a turn-in alone is a visit, not a stay.
        const cover = Math.min(1, w.xp / Math.max(1, xpTable.get(st.level) - st.xp));
        let rate = (w.xp + (zoneSoon(zone, 2) / 2) * cover) / (TRIP_WEIGHT * trip.cost + w.seconds + 120) / grindRate();
        if (window.has(zone)) rate *= 2;
        else if (!route.plan.some(([z]) => z === zone)) rate *= 0.8;
        if (sea) rate *= 0.6;
        if (route.debug) looked.push(`${zone}:${rate.toFixed(2)}`);
        if (!best || rate > best.rate) best = { ...w, rate };
      }
      // Quests opening here by the next level keep you here, killing things, unless another zone pays clearly better.
      const stay = zoneSoon(st.zone) >= typ * 3;
      const go = best && best.rate >= (stay ? GO_STAY : GO_MOVE);
      route.debug?.push(`L${st.level} in ${st.zone}${stay ? ' (stay)' : ''}: ${looked.join(' ')} -> ${go ? `${best.zone} [${best.detail.join(' ')}] xp ${Math.round(best.xp)}` : 'grind'}`);
      return go ? best : null;
    }

    /* Where to kill things when no zone's quests pay: where the most opens by the next level, near; else the nearest
     * camp at the character's level. */
    function grindZone() {
      let best = null;
      for (const zone of new Set([st.zone, ...candidates()])) {
        const p = grindSpot(zone, st.level, reactIndex);
        if (!p) continue;
        const soon = zoneSoon(zone);
        const cost = zone === st.zone ? dist(st.pos, p) / speed() : 2 * travel(st.pos, p).cost;
        if (!Number.isFinite(cost)) continue;
        const score = (soon + typicalXp(st.level)) / (cost + 600);
        if (!best || score > best.score) best = { zone, p, score };
      }
      return best;
    }

    /**
     * A class quest that teaches a spell, ready to hand in, or the next of a class chain open to take: gone for at once
     * when it is a quarter of an hour away or less (Hearthstone and teleport counted), not when the zone runs dry: bear
     * form, a totem, a demon are the biggest steps up a class takes.
     */
    const urgentTried = new Set();
    function classUrgent() {
      let best = null;
      const consider = (key, p) => {
        if (urgentTried.has(`${key}@${st.level}`)) return;
        if (p.area === st.zone && dist(st.pos, p) < HUB_RADIUS) return;
        const c = travel(st.pos, p).cost;
        if (c <= URGENT && (!best || c < best.cost)) best = { key, p, cost: c };
      };
      for (const [id, a] of st.active) if (!a.left.size && a.q.teaches && essentialNow(a.q)) consider(`T${id}`, enderAt(a.q, st.pos));
      if (st.active.size < LOG_SIZE) for (const q of classQuests) if (essentialNow(q) && want(q) !== null) consider(`A${q.id}`, giverAt(q, st.pos));
      if (best) urgentTried.add(`${best.key}@${st.level}`);
      return best;
    }

    /** The class's quests: the nearest place, anywhere, where one can be taken, done or handed in now. */
    function classWork() {
      let best = null;
      const consider = (p) => {
        if (p.area === st.zone && dist(st.pos, p) < 1) return;
        const c = travel(st.pos, p).cost;
        if (Number.isFinite(c) && (!best || c < best.cost)) best = { p, cost: c };
      };
      for (const [, a] of st.active) {
        if (!essentialNow(a.q)) continue;
        const pl = placeOf(a.q);
        if (!a.left.size) consider(enderAt(a.q, st.pos));
        else for (const i of a.left) for (const p of doable(pl, i)) consider(p);
      }
      if (st.active.size < LOG_SIZE) for (const q of classQuests) if (want(q) !== null) consider(giverAt(q, st.pos));
      return best;
    }

    /* The trainer, out of the way, when spells have waited long enough: the nearest one, when the detour is no more than
     * the levels waited allow. */
    function trainErrand() {
      const due = st.level - st.lastTrain;
      if (due < TRAIN_ERRAND || st.level < TRAIN_FIRST) return false;
      // The way there and back: a teleport takes you out quickly, but back is by flight, boat or the Hearthstone.
      const hearthBack = st.bind && st.seconds >= st.hearthAt;
      let best = null;
      for (const t of myTrainers) {
        if (st.level >= 12 && startSpots.some((sp) => sp.map === t.p.map && dist(sp, t.p) < 800)) continue;
        const out = travel(st.pos, t.p).cost;
        let back = travelBy(t.p, st.pos).cost;
        if (hearthBack && st.bind.area === st.zone) back = Math.min(back, HEARTH_CAST + travelBy(st.bind, st.pos).cost);
        const c = out + back;
        if (Number.isFinite(c) && (!best || c < best.cost)) best = { t, cost: c };
      }
      if (!best || best.cost > 150 * (due - TRAIN_ERRAND + 1) + 120) return false;
      route.debug?.push(`L${st.level}: to train at ${best.t.p.area}`);
      goTo(best.t.p, best.t.p.area);
      return true;
    }

    let guard = 0;
    let last = '';
    while (st.level < 60 && guard++ < 60000) {
      // 1. The hub you stand in: flight master, trainer, turn-ins and quests here and close by.
      if (atHand()) continue;

      // 1b. A class spell to learn, near enough: now.
      const urgent = classUrgent();
      if (urgent) {
        route.debug?.push(`L${st.level} in ${st.zone}: class quest now (${urgent.key}) at ${urgent.p.area}`);
        goTo(urgent.p, urgent.p.area);
        continue;
      }

      // 2. The zone's work, in the order of the planned path.
      const list = tasks();
      if (list.size) {
        const fresh = tourZone !== st.zone;
        tourZone = st.zone;
        const order = tour.sync(st.pos, list, { fresh, end: workAhead(list) });
        if (route.debug && route.debugTour && steps.length >= route.debugTour[0] && steps.length <= route.debugTour[1])
          route.debug.push(`tour@${steps.length}: ${order.map((o, k) => `${o.key}(${Math.round(dist(k ? order[k - 1].p : st.pos, o.p))})`).join(' ')}`);
        const { key, p } = order[0];
        const task = list.get(key);
        // A task that does nothing where it stands (its quest not offered after all, a place out of reach) is set aside.
        const here = `${key}@${Math.round(st.pos.wx)},${Math.round(st.pos.wy)}:${st.active.size}:${st.done.size}`;
        if (here === last) {
          blocked.add(key);
          continue;
        }
        last = here;
        // A long way across the zone goes by flight path or Hearthstone when that is quicker (Booty Bay to the
        // Nesingwary camp); a short one on foot.
        if (dist(st.pos, p) > 1200) goTo(p, st.zone);
        else walkTo(p);
        if (task.kind === 'O') workAt(p);
        continue;
      }

      // 3. Nothing left here: the class's quests first, then the log tidied, the trainer when it is time, and the zone
      // whose work pays best now.
      const cw = classWork();
      if (cw) {
        route.debug?.push(`L${st.level} in ${st.zone}: class quest at ${cw.p.area}`);
        goTo(cw.p, cw.p.area);
        continue;
      }
      prune();
      if (trainErrand()) continue;
      const next = nextZone();
      if (next) {
        // A zone with a good deal of work: the Hearthstone is bound at its inn on the visit.
        if (next.xp >= typicalXp(st.level) * 5 && inns.some((k) => k.p.area === next.zone) && st.bind?.area !== next.zone && !st.boundIn.has(next.zone)) st.bindWanted = next.zone;
        goTo(next.first, next.zone);
        continue;
      }
      // 4. No quest pays: kill things to the next level where quests open first.
      if (guard > 59000) break;
      const spot = grindZone();
      if (spot?.p && (spot.zone !== st.zone || dist(st.pos, spot.p) > 50)) goTo(spot.p, spot.zone);
      const need = xpTable.get(st.level) - st.xp;
      const mob = spot?.p?.ref?.kind === 'n' ? spot.p.ref.id : null;
      emit({ t: 'L', level: st.level + 1, at: st.pos, e: mob ? ['n', mob] : null });
      st.seconds += (need / Math.max(1, killXp(st.level, st.level, false))) * GRIND_KILL_TIME;
      st.time.grind += (need / Math.max(1, killXp(st.level, st.level, false))) * GRIND_KILL_TIME;
      gain(need, 'grinding');
    }

    // Quests taken and never finished come out of the route: it only has you take what you complete. Those the log let
    // go are left out of the next working-out too (their trip was for nothing); those still in the log at 60 only lost
    // the race against the last levels, and their chains stay.
    const finished = new Set(steps.filter((s) => s.t === 'T').map((s) => s.q));
    const unfinished = new Set(steps.filter((s) => s.t === 'A' && !finished.has(s.q) && st.dropped.has(s.q)).map((s) => s.q));
    const kept = steps.filter((s) => !s.q || finished.has(s.q));
    return {
      unfinished,
      steps: kept,
      level: st.level,
      travelled: Math.round(st.travelled),
      flown: Math.round(st.flown),
      hours: Math.round(st.seconds / 360) / 10,
      dropped: steps.length - kept.length,
      xpFrom,
      time: st.time,
    };
  }

  // The starting valleys: their trainers serve the first levels there, not a trip from a zone away (the straight line to
  // a valley runs through the mountains around it).
  for (const group of plan.routes) {
    const sq = world.quests.find((q) => q.i === group.startQuest);
    const g = sq?.st?.find((x) => x[0] === 'n');
    const p = g && entityPoint(['n', g[1]]);
    if (p) startSpots.push(p);
  }

  /* ── Routes: one for every race and class, on its starting zone's plan ── */
  const routes = [];
  const raceByBit = new Map(races.map((r) => [1 << (r.id - 1), r]));
  for (const group of plan.routes) {
    const startQ = world.quests.find((q) => q.i === group.startQuest);
    const giver = startQ?.st?.find((s) => s[0] === 'n');
    if (!giver) throw new Error(`route ${group.id}: start quest ${group.startQuest} has no giver`);
    const steps = (group.plan ?? []).flatMap((p) => (typeof p === 'string' ? plan.plans[p] : [p]));
    for (const n of group.taxi ?? []) if (!taxiById.has(n)) throw new Error(`route ${group.id}: no flight master at taxi node ${n}`);
    for (const bit of group.races) {
      const race = raceByBit.get(bit);
      if (!race) throw new Error(`route ${group.id}: no race with mask ${bit}`);
      for (const cls of race.classes ?? []) {
        const id = `${race.slug}-${cls}`;
        if (only && only.route !== id) continue;
        const r = {
          id,
          name: `${race.name} ${cls[0].toUpperCase()}${cls.slice(1)}`,
          group: group.id,
          race: race.slug,
          cls,
          classBit: 1 << (CLASS_ID[cls] - 1),
          faction: group.faction,
          races: [bit],
          startZone: group.startZone,
          start: { ref: giver },
          zones: plan[group.faction],
          plan: steps,
          taxi: group.taxi,
          banned: new Set(),
          debug: only?.debug ? [] : undefined,
          debugTour: only?.tour,
          why: only?.why ? new Map() : undefined,
        };
        // A quest the character takes and never finishes costs the trip to take it: the route is worked out again
        // without such quests, until none is left (or a few times).
        let res = simulate(r);
        for (let pass = 1; pass < PASSES && res.unfinished.size; pass++) {
          for (const q of res.unfinished) r.banned.add(q);
          res = simulate(r);
        }
        log(`guide: ${r.id}: ${res.steps.length} steps (${res.dropped} unfinished dropped), reaches level ${res.level}, walks ${Math.round(res.travelled / 1000)} km and flies ${Math.round(res.flown / 1000)} km, about ${res.hours} h; XP from quests ${Math.round(res.xpFrom.quests / 1000)}k, kills ${Math.round(res.xpFrom.kills / 1000)}k, grinding ${Math.round(res.xpFrom.grinding / 1000)}k`);
        routes.push({ ...r, ...res });
      }
    }
  }
  const itemName = (id) => db.prepare('SELECT name FROM item_template WHERE entry = ? ORDER BY patch DESC LIMIT 1').get(id)?.name;
  for (const id of extraItems) extraNames.set(`i${id}`, itemName(id));
  return { routes, catalog, camps, rects, areas, taxi, trainers, teleports, placed, extraNames };
}

/* ── The guide as data ────────────────────────────────────────────────── */

/**
 * Routes with their steps, and every name and place the steps use, for data/guide.json (the site) and the add-on.
 *
 * A step is a short array, its first entry the kind:
 *   ["A", quest, giver, area, x, y, level]        accept a quest (giver: creature id, or minus an object id)
 *   ["T", quest, ender, area, x, y, level]        turn it in
 *   ["C", quest, [objective indexes], area, x, y, level, target]   do objectives here (target as for a giver, 0 for a place)
 *   ["Z", zone, area, x, y, level]               go to a zone
 *   ["F", from node, to node, area, x, y, level]  fly (at the flight master of the first node)
 *   ["B", transport, area, x, y, level]           take a boat, zeppelin or the tram
 *   ["P", node, area, x, y, level]                learn a flight path
 *   ["R", trainer, area, x, y, level]             train at your class trainer (its creature id)
 *   ["L", level, mob or 0, area, x, y, level]     kill things here to that level
 *   ["N", innkeeper, area, x, y, level]           bind your Hearthstone at this inn
 *   ["H", 0, area, x, y, level]                   use your Hearthstone (to this place)
 *   ["S", spell, area, x, y, level]               cast a class teleport (to this place)
 * where level is the character's level at the step, and area, x, y a point on a zone map in percent. A quest's
 * objectives are [kind, id, count, text or null, sources]: kind n (kill), o (use an object), i (collect an item, with
 * the creatures and minus the objects that drop it as sources), x (explore), t (talk to someone), e (escort someone)
 * or u (use an item, with what to use it on as sources).
 */
export function guideData(g, { world, zoneNames, plan, dungeons = [] }) {
  const r1 = (v) => Math.round(v * 10) / 10;
  const signed = (ref) => (!ref ? 0 : ref[0] === 'o' || ref.kind === 'o' ? -(ref[1] ?? ref.id) : (ref[1] ?? ref.id));
  const usedQuests = new Set();
  const usedNpcs = new Set();
  const usedObjects = new Set();
  const usedItems = new Set();
  const usedAreas = new Set();
  const camps = {};
  const useEntity = (id) => (id > 0 ? usedNpcs.add(id) : id < 0 ? usedObjects.add(-id) : null);
  const at = (p) => {
    usedAreas.add(p.area);
    return [p.area, r1(p.x), r1(p.y)];
  };
  const addCamps = (kind, id, area) => {
    const key = kind + id;
    const list = g.camps(kind, id).filter((c) => c.area === area);
    if (!list.length) return;
    camps[key] = camps[key] ?? [];
    for (const c of list) if (!camps[key].some((x) => x[0] === c.area && x[1] === r1(c.x) && x[2] === r1(c.y))) camps[key].push([c.area, r1(c.x), r1(c.y)]);
    usedAreas.add(area);
  };
  const routes = g.routes.map((r) => {
    const steps = r.steps.map((s) => {
      switch (s.t) {
        case 'A':
        case 'T': {
          usedQuests.add(s.q);
          const e = signed(s.e);
          useEntity(e);
          return [s.t, s.q, e, ...at(s.at), s.lv];
        }
        case 'C': {
          usedQuests.add(s.q);
          const q = g.catalog.get(s.q);
          for (const i of s.o)
            for (const t of q.objectives[i].targets ?? []) {
              useEntity(t.kind === 'o' ? -t.id : t.id);
              addCamps(t.kind, t.id, s.at.area);
            }
          const e = s.e ? signed(s.e) : 0;
          if (e) useEntity(e);
          return ['C', s.q, s.o, ...at(s.at), s.lv, e];
        }
        case 'Z':
          usedAreas.add(s.z);
          return ['Z', s.z, ...at(s.at), s.lv];
        case 'F':
          return ['F', s.node, s.to, ...at(s.at), s.lv];
        case 'B':
          at(s.to);
          return ['B', s.tr, ...at(s.at), s.lv];
        case 'P':
          return ['P', s.node, ...at(s.at), s.lv];
        case 'R':
          usedNpcs.add(s.npc);
          return ['R', s.npc, ...at(s.at), s.lv];
        case 'L': {
          const mob = s.e ? s.e[1] : 0;
          if (mob) usedNpcs.add(mob);
          return ['L', s.level, mob, ...at(s.at), s.lv];
        }
        case 'N': {
          const inn = s.e[1];
          usedNpcs.add(inn);
          return ['N', inn, ...at(s.at), s.lv];
        }
        case 'H':
          return ['H', 0, ...at(s.at), s.lv];
        case 'S':
          return ['S', s.spell, ...at(s.at), s.lv];
        default:
          throw new Error(`guide: unknown step ${s.t}`);
      }
    });
    return {
      id: r.id,
      name: r.name,
      group: r.group,
      race: r.race,
      class: r.cls,
      faction: r.faction,
      races: r.races,
      start: r.startZone,
      quests: r.steps.filter((s) => s.t === 'T').length,
      hours: r.hours,
      walk: Math.round(r.travelled / 1000),
      fly: Math.round(r.flown / 1000),
      steps,
    };
  });
  const quests = {};
  const EVENT_KIND = { talk: 't', escort: 'e', item: 'u', use: 'o', explore: 'x', kill: 'n' };
  for (const id of [...usedQuests].sort((a, b) => a - b)) {
    const q = g.catalog.get(id);
    const src = world.quests.find((x) => x.i === id);
    quests[id] = {
      n: q.name,
      l: q.level,
      // Its experience at full value (five levels over the quest and more give less: questXp).
      ...(src?.xp ? { x: src.xp } : {}),
      ...(q.elite ? { e: 1 } : {}),
      ...(q.classOnly ? { c: q.classes } : {}),
      // What has to be done first: every quest of p, and one of pa (the guide skips a quest whose chain you missed).
      ...(q.pre || q.preGroup.length ? { p: [...new Set([q.pre, ...q.preGroup].filter(Boolean))] } : {}),
      ...(q.preAny.length ? { pa: q.preAny } : {}),
      o: q.objectives.map((o) => {
        if (o.kind === 'event') {
          const kind = EVENT_KIND[o.sub] ?? 'x';
          const from = (o.targets ?? []).map((t) => (t.kind === 'o' ? -t.id : t.id));
          for (const e of from) useEntity(e);
          if (o.item) usedItems.add(o.item);
          const id = kind === 'u' ? o.item : kind === 't' || kind === 'e' || kind === 'n' ? (o.targets.find((t) => t.kind === 'n')?.id ?? 0) : kind === 'o' ? (o.targets.find((t) => t.kind === 'o')?.id ?? 0) : 0;
          if (kind === 'o' && id) usedObjects.add(id);
          if ((kind === 't' || kind === 'e' || kind === 'n') && id) usedNpcs.add(id);
          const row = [kind, id, 1, o.text ?? null];
          if (kind === 'u' && from.length) row.push(from);
          return row;
        }
        if (o.kind === 'item') usedItems.add(o.id);
        if (o.kind === 'kill') usedNpcs.add(o.id);
        if (o.kind === 'object') usedObjects.add(o.id);
        // A place to find says what it is in the quest's own words (its first line), having no row of its own.
        const text = (src?.rq ?? [])[o.index]?.[2] ?? (o.kind === 'explore' ? (src?.o ?? '').split('\n')[0].trim() || null : null);
        // An item objective names what drops it: the creatures (ids) and objects (minus their ids) to look for.
        const from = o.kind === 'item' ? o.targets.map((t) => (t.kind === 'o' ? -t.id : t.id)) : null;
        if (from) for (const id of from) useEntity(id);
        const row = [o.kind === 'kill' ? 'n' : o.kind === 'object' ? 'o' : o.kind === 'item' ? 'i' : 'x', o.kind === 'explore' ? 0 : o.id, o.count, text];
        if (from) row.push(from);
        while (row.length > 3 && row[row.length - 1] === null) row.pop();
        return row;
      }),
    };
  }
  /* Where quests start, for the world map's quests you can take and the dungeons' quests: each is [name, level, required
   * level, side (1 Alliance, 2 Horde, 3 both), giver (an object as minus its id), where the giver stands (area, x, y, or
   * 0, 0, 0), the item that starts it, the quest before it, Classic's class mask, experience]. Every quest a creature or
   * an object gives (not PvP, world event or repeatable ones), and each dungeon's and raid's quests (filed under it or
   * with their work inside it: scripts/data/lib/dungeon-quests.mjs), with the quests that open them. */
  const questById = new Map(world.quests.map((q) => [q.i, q]));
  const dungeonQuests = {};
  const dq = {};
  // A quest's side as players meet it (q.fs: scripts/data/lib/quest-sides.mjs), else its own; else both (Forever's own
  // quests, whose side the data does not say).
  const sideOf = (q) => q.fs || q.s || 3;
  const addDungeonQuest = (q) => {
    if (dq[q.i]) return;
    const start = (q.st ?? []).find(([k]) => k === 'n' || k === 'o');
    const giver = !start ? 0 : start[0] === 'o' ? -start[1] : start[1];
    const item = (q.st ?? []).find(([k]) => k === 'i')?.[1] ?? 0;
    let where = [0, 0, 0];
    if (giver) {
      useEntity(giver);
      const c = g.camps(start[0], start[1])[0];
      if (c) where = at(c);
    }
    if (item) usedItems.add(item);
    dq[q.i] = [q.n, q.l, q.r, sideOf(q), giver, ...where, item, q.pv ? Math.abs(q.pv) : 0, q.rc ?? 0, q.xp ?? 0];
  };
  for (const q of world.quests) {
    if (q.ty === 41 || q.ty === 82 || q.ev || q.rep) continue;
    const start = (q.st ?? []).find(([k]) => k === 'n' || k === 'o');
    if (start && g.camps(start[0], start[1]).length) addDungeonQuest(q);
  }
  for (const d of dungeons) {
    // Each dungeon's quests, worked out in scripts/data/lib/dungeon-quests.mjs (filed under it, or with work inside it).
    const list = (d.questIds ?? []).map((i) => questById.get(i)).filter(Boolean);
    if (!list.length) continue;
    dungeonQuests[d.slug] = list.map((q) => q.i);
    for (const q of list) {
      addDungeonQuest(q);
      let p = q.pv ? Math.abs(q.pv) : 0;
      for (let depth = 0; p && depth < 8 && !dq[p]; depth++) {
        const prev = questById.get(p);
        if (!prev) break;
        addDungeonQuest(prev);
        p = prev.pv ? Math.abs(prev.pv) : 0;
      }
    }
  }

  /* Rare creatures (rare and rare elite): where they stand, as area, x, y, ..., for the rare alert's map pin. */
  const rares = {};
  for (const [key, n] of Object.entries(world.npcs)) {
    if (n[4] !== 2 && n[4] !== 4) continue;
    const pts = g.camps('n', Number(key)).flatMap((c) => at(c));
    if (pts.length) rares[key] = pts;
  }

  // Flight masters and trainers are named too.
  const taxi = {};
  for (const n of g.taxi) {
    taxi[n.id] = { n: n.name, npc: n.npc, side: n.side, at: at(n.p) };
    usedNpcs.add(n.npc);
  }
  const trainers = {};
  for (const t of g.trainers) {
    const n = world.npcs[t.npc];
    if (!n) continue;
    (trainers[t.cls] ??= []).push([t.npc, ...at(t.p), n[5]]);
    usedNpcs.add(t.npc);
  }
  const transports = {};
  for (const t of plan.transports) {
    const a = g.placed(t.a);
    const b = g.placed(t.b);
    transports[t.id] = { kind: t.kind, side: t.side, a: [...at(a), t.a.name], b: [...at(b), t.b.name] };
  }
  const teleports = {};
  for (const t of g.teleports) teleports[t.spell] = { n: t.name, cls: t.cls, at: at(t.at) };
  const npcs = {};
  for (const id of [...usedNpcs].sort((a, b) => a - b)) {
    const name = world.npcs[id]?.[0] ?? g.extraNames?.get(id);
    if (name) npcs[id] = name;
  }
  const objects = {};
  for (const id of [...usedObjects].sort((a, b) => a - b)) {
    const name = world.objects[id]?.[0] ?? g.extraNames?.get(-id);
    if (name) objects[id] = name;
  }
  const items = {};
  for (const id of [...usedItems].sort((a, b) => a - b)) {
    const m = world.minor[id] ?? world.itemNames?.[id] ?? g.extraNames?.get(`i${id}`);
    if (m) items[id] = Array.isArray(m) ? m[0] : m;
  }
  const zones = {};
  for (const area of [...usedAreas].sort((a, b) => a - b)) {
    const rect = g.rects.get(area);
    if (!rect) throw new Error(`guide: area ${area} has no map rectangle`);
    zones[area] = { n: zoneNames[area] ?? `Zone ${area}`, ui: rect.ui, map: rect.map, rect: [rect.left, rect.right, rect.top, rect.bottom].map((v) => Math.round(v * 10) / 10) };
  }
  return { zones, quests, npcs, objects, items, camps, taxi, trainers, transports, teleports, routes, dungeonQuests, starts: dq, rares };
}
