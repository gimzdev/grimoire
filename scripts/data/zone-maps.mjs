#!/usr/bin/env node
// Zone maps, and where every creature and object stands on them, drawn by Grimoire from open data. No game art: a zone's
// land is the ground its creatures, patrol points and objects stand on (the way scripts/data/maps.mjs draws a dungeon's
// floor), its places are the named places of VMaNGOS, and a point is where the game's own map shows it.
//
//   node scripts/data/zone-maps.mjs --questiedb path/to/QuestieDB [--vmangos mangos.sqlite] [--data data] [--svg dir]
//
// QuestieDB (GPLv3) places every creature and object on Forever's zone maps, in percent of the map from its top left
// corner: Classic's from its base data, Forever's own from what Questie's players met. VMaNGOS (GPL-2.0-or-later) adds,
// for the zones Classic had (QuestieDB's conversion.json gives their rectangles in world yards): the patrol points and
// spawns around the zone, so the land beside it is drawn too, the named places (its teleport list, spelled the way its
// area table spells them) and the capitals' points of interest. Without --vmangos the maps hold QuestieDB's points only.
//
// Writes
//   data/spawns.json     { n: { [creature]: { [zone]: [x, y, x, y, ...] } }, o: { [object]: the same } }
//                        x and y in tenths of a percent. Points closer together than a pin is wide are one point, and
//                        a creature seen all over a zone keeps at most MAX_POINTS of them.
//   data/zone-maps.json  { [zone]: { land, out, places } } on a map 1500 wide and 1000 high (the game's 3:2):
//                        land    an SVG path (even-odd, curves) around the ground of the zone itself
//                        out     the same around the ground beside it that the map's rectangle also holds, or ""
//                        places  [x, y, name, kind, id?][]: "a" a named place, "p" a point of interest of a capital,
//                                "d" the way into a dungeon or raid (id: its area)
//                        go      1 when the add-on's arrow knows the zone (data/guide.json), so /grim go can lead there
// --svg <dir> also writes each map as a picture, to look at.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { area, contours, simplify, smooth } from './lib/outline.mjs';
import { readQuestieDB, spawnList } from './lib/questiedb.mjs';
import { inPatch, openVmangos } from './lib/world.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const arg = (k, d) => {
  const i = process.argv.indexOf(k);
  return i > 0 ? process.argv[i + 1] : d;
};
const DATA = path.resolve(arg('--data', path.join(here, '..', '..', 'data')));
const QDB = arg('--questiedb');
if (!QDB) throw new Error('Missing --questiedb <checkout>. See scripts/data/README.md.');
const SVG = arg('--svg');
const json = (f) => JSON.parse(readFileSync(path.join(DATA, f), 'utf8'));

export const MAP_W = 1500;
export const MAP_H = 1000;
/** The most points one creature or object keeps on one map. */
const MAX_POINTS = 260;
/** A zone needs this many points before its land is worth drawing. */
const MIN_POINTS = 25;

const qdb = readQuestieDB(QDB);
const db = arg('--vmangos') ? openVmangos(path.resolve(arg('--vmangos'))) : null;
const npcs = json('npcs.json');
const objects = json('objects.json');
const zoneNames = json('zone-names.json');
const zones = json('zones.json');
// the zones the add-on's arrow knows (its leveling guide's): a point on their maps can be sent to it, /grim go
const arrowZones = new Set(Object.keys(json('guide.json').zones ?? {}));

/* ── Every point QuestieDB places, zone by zone ── */

const own = new Map(); // zone -> [x, y][] in percent
const add = (zone, x, y) => {
  if (!own.has(zone)) own.set(zone, []);
  own.get(zone).push([x, y]);
};
const folk = new Map(); // zone -> where the people who serve players stand (a quest, a shop, a flight, an inn)
for (const records of [qdb.npcs, qdb.objects])
  for (const rec of records.values())
    for (const p of spawnList(rec.get('spawns'))) {
      if (p.x > 100 || p.y > 100) continue;
      add(p.area, p.x, p.y);
      if (records === qdb.npcs && Number(rec.get('npcFlags')) > 1) {
        if (!folk.has(p.area)) folk.set(p.area, []);
        folk.get(p.area).push([p.x, p.y]);
      }
    }
const people = new Set(Object.values(npcs).map((n) => n[0]));

/* ── What VMaNGOS adds: the ground around, and the names ── */

/** A world position on a zone's map, in percent (x east, y south). */
const onMap = (b, wx, wy) => [((b.left - wy) / (b.left - b.right)) * 100, ((b.top - wx) / (b.top - b.bottom)) * 100];

const world = new Map(); // continent map -> [wx, wy][] of every creature, patrol point and object
const tele = []; // named places
const poi = []; // the capitals' points of interest
const areas = new Map();
if (db) {
  const push = (map, x, y) => {
    if (!world.has(map)) world.set(map, []);
    world.get(map).push([x, y]);
  };
  for (const r of db.prepare('SELECT map, position_x x, position_y y, patch_min, patch_max FROM creature WHERE map IN (0, 1)').all()) if (inPatch(r)) push(r.map, r.x, r.y);
  for (const r of db.prepare('SELECT map, position_x x, position_y y, patch_min, patch_max FROM gameobject WHERE map IN (0, 1)').all()) if (inPatch(r)) push(r.map, r.x, r.y);
  for (const r of db.prepare('SELECT c.map map, m.position_x x, m.position_y y, c.patch_min, c.patch_max FROM creature_movement m JOIN creature c ON c.guid = m.id WHERE c.map IN (0, 1)').all())
    if (inPatch(r)) push(r.map, r.x, r.y);
  for (const r of db.prepare('SELECT * FROM area_template').all()) areas.set(r.entry, r);
  for (const r of db.prepare('SELECT name, map, position_x x, position_y y FROM game_tele WHERE map IN (0, 1) ORDER BY id').all()) tele.push(r);
  for (const r of db.prepare('SELECT entry, x, y, icon_name name FROM points_of_interest ORDER BY entry').all()) poi.push(r);
}
const topZone = (id) => {
  let a = areas.get(id);
  for (let guard = 0; a && a.zone_id && guard < 5; guard++) a = areas.get(a.zone_id) ?? a;
  return a ? a.entry : id;
};
const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9]/g, '');
const areasByName = new Map();
for (const a of areas.values()) {
  const k = norm(a.name);
  if (!areasByName.has(k)) areasByName.set(k, []);
  areasByName.get(k).push(a);
}

/* ── Drawing ── */

const CELL = 5;
const NX = MAP_W / CELL + 8;
const NY = MAP_H / CELL + 8;
const T = 0.3;

/** A closed loop as a curve through the middle of each side, each corner its control point: smooth however close you
 * look. A corner on the map's edge stays a corner, so the land still ends squarely there. */
function curve(l) {
  const mid = (a, b) => `${Math.round((a[0] + b[0]) / 2)} ${Math.round((a[1] + b[1]) / 2)}`;
  const edge = (p) => p[0] <= 0 || p[1] <= 0 || p[0] >= MAP_W || p[1] >= MAP_H;
  let d = `M${mid(l[l.length - 1], l[0])}`;
  for (let i = 0; i < l.length; i++) {
    const p = l[i], next = l[(i + 1) % l.length];
    d += edge(p) ? `L${p[0]} ${p[1]}L${mid(p, next)}` : `Q${p[0]} ${p[1]} ${mid(p, next)}`;
  }
  return d + 'Z';
}

/** The outline around a set of points on the map (view units), each a disc of ground r wide, cut at the map's edge. */
function outline(pts, r) {
  const g = new Float32Array(NX * NY);
  const rc = r / CELL;
  for (const [x, y] of pts) {
    const ci = x / CELL + 4, cj = y / CELL + 4;
    for (let j = Math.max(0, Math.floor(cj - rc)); j <= Math.min(NY - 1, Math.ceil(cj + rc)); j++)
      for (let i = Math.max(0, Math.floor(ci - rc)); i <= Math.min(NX - 1, Math.ceil(ci + rc)); i++) {
        const d2 = ((i - ci) ** 2 + (j - cj) ** 2) / (rc * rc);
        if (d2 < 1 && 1 - d2 > g[j * NX + i]) g[j * NX + i] = 1 - d2;
      }
  }
  // nothing is drawn past the map's edge: the outline runs along it
  for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) if (i < 4 || j < 4 || i > NX - 5 || j > NY - 5) g[j * NX + i] = 0;
  const clamp = (v, hi) => Math.min(hi, Math.max(0, Math.round(v)));
  return contours(g, NX, NY, T)
    .map((l) => l.map(([i, j]) => [(i - 4) * CELL, (j - 4) * CELL]))
    .filter((l) => Math.abs(area(l)) > 900)
    .map((l) => simplify(smooth(simplify(l, 2.5)), 2.2))
    .filter((l) => l.length >= 3)
    .map((l) => l.map((p) => [clamp(p[0], MAP_W), clamp(p[1], MAP_H)]))
    .map(curve)
    .join('');
}

/** A grid over a map's points that says whether one of them is within d percent of a place. */
function nearness(pts, d) {
  const grid = new Set();
  // a map is half again as wide as it is high: a percent across is 1.5 times a percent down
  for (const [x, y] of pts) grid.add(`${Math.floor((x * 1.5) / d)},${Math.floor(y / d)}`);
  return (x, y) => {
    const i = Math.floor((x * 1.5) / d), j = Math.floor(y / d);
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) if (grid.has(`${i + a},${j + b}`)) return true;
    return false;
  };
}

const view = ([x, y]) => [x * (MAP_W / 100), y * (MAP_H / 100)];
const tenths = (v) => Math.min(1000, Math.max(0, Math.round(v * 10)));
/** "TheMarrisStead" as the area table spells it, when it has a place of that name in this zone. */
const placeName = (name, zone) => (areasByName.get(norm(name)) ?? []).find((a) => topZone(a.entry) === zone && a.entry !== zone)?.name ?? null;

const CAPITALS = new Set([1519, 1537, 1657, 1637, 1638, 1497]);
const dungeonZones = new Map(zones.filter((z) => z.inst !== 0).map((z) => [z.id, z]));
const maps = {};
const report = [];
for (const [zone, pts] of [...own.entries()].sort((a, b) => a[0] - b[0])) {
  if (!zoneNames[zone] || dungeonZones.has(zone) || pts.length < MIN_POINTS) continue;
  const b = qdb.bounds.get(zone);
  const mine = pts.slice();
  const beside = [];
  if (b && world.has(b.map)) {
    const near = nearness(pts, 2.4);
    for (const [wx, wy] of world.get(b.map)) {
      const p = onMap(b, wx, wy);
      if (p[0] < -3 || p[0] > 103 || p[1] < -3 || p[1] > 103) continue;
      (near(p[0], p[1]) ? mine : beside).push(p);
    }
  }
  const land = outline(mine.map(view), 27);
  if (!land) continue;
  const out = beside.length ? outline(beside.map(view), 27) : '';
  let places = [];
  const seen = new Set();
  const inside = nearness(mine, 3);
  // how many people serve players within a short walk of a place: a town counts for more than a mine
  const busy = (x, y) => (folk.get(zone) ?? []).reduce((n, q) => n + (Math.hypot((q[0] - x / 10) * 1.5, q[1] - y / 10) < 3 ? 1 : 0), 0);
  if (b) {
    for (const t of tele) {
      if (t.map !== b.map) continue;
      const [x, y] = onMap(b, t.x, t.y);
      if (x < 2 || x > 98 || y < 3 || y > 97) continue;
      const name = placeName(t.name, zone);
      if (!name || seen.has(name)) continue;
      seen.add(name);
      places.push([tenths(x), tenths(y), name, 'a']);
    }
    if (CAPITALS.has(zone)) {
      for (const p of poi) {
        const [x, y] = onMap(b, p.x, p.y);
        // a guard's directions name places and people: the people have pages of their own
        if (x < 2 || x > 98 || y < 3 || y > 97 || !inside(x, y) || !p.name || seen.has(p.name) || people.has(p.name)) continue;
        seen.add(p.name);
        places.push([tenths(x), tenths(y), p.name, 'p']);
      }
    }
  }
  for (const [id, d] of qdb.dungeons) {
    const known = [id, ...d.alt].find((a) => dungeonZones.has(a));
    if (!known) continue;
    for (const e of d.entrances) if (e.area === zone && e.x >= 0 && e.y >= 0) places.push([tenths(e.x), tenths(e.y), dungeonZones.get(known).n, 'd', known]);
  }
  // the ways into dungeons first, then the busiest places: a small screen shows the first that fit
  const rank = new Map(places.map((p) => [p, p[3] === 'd' ? 1e6 : busy(p[0], p[1])]));
  places = places.sort((a, c) => rank.get(c) - rank.get(a) || a[2].localeCompare(c[2])).slice(0, 40);
  maps[zone] = { land, out, places, ...(arrowZones.has(String(zone)) ? { go: 1 } : {}) };
  report.push(`${zoneNames[zone]} (${zone}): ${pts.length} points${beside.length ? `, ${beside.length} beside` : ''}, ${places.length} places, ${Math.round((land.length + out.length) / 1024)} KB`);
}

/* ── Where each creature and object stands ── */

/** Points on one map thinned so that no two are closer than a pin, and no more than MAX_POINTS in all. */
function thin(pts) {
  let d = 0.45;
  for (;;) {
    const kept = [];
    const grid = new Map();
    for (const [x, y] of pts) {
      const i = Math.floor((x * 1.5) / d), j = Math.floor(y / d);
      let close = false;
      for (let a = -1; a <= 1 && !close; a++)
        for (let c = -1; c <= 1 && !close; c++) for (const q of grid.get(`${i + a},${j + c}`) ?? []) if (Math.hypot((q[0] - x) * 1.5, q[1] - y) < d) close = true;
      if (close) continue;
      kept.push([x, y]);
      const k = `${i},${j}`;
      if (!grid.has(k)) grid.set(k, []);
      grid.get(k).push([x, y]);
    }
    if (kept.length <= MAX_POINTS) return kept;
    d *= 1.35;
  }
}
const spawns = { n: {}, o: {} };
const count = { n: 0, o: 0, points: 0, raw: 0 };
for (const [kind, known, records] of [
  ['n', npcs, qdb.npcs],
  ['o', objects, qdb.objects],
]) {
  for (const id of Object.keys(known)) {
    const byZone = new Map();
    for (const p of spawnList(records.get(Number(id))?.get('spawns'))) {
      if (!zoneNames[p.area] || dungeonZones.has(p.area) || p.x > 100 || p.y > 100) continue;
      if (!byZone.has(p.area)) byZone.set(p.area, []);
      byZone.get(p.area).push([p.x, p.y]);
    }
    if (!byZone.size) continue;
    const row = {};
    for (const [zone, pts] of [...byZone.entries()].sort((a, b) => b[1].length - a[1].length || a[0] - b[0])) {
      const kept = thin(pts);
      count.raw += pts.length;
      count.points += kept.length;
      row[zone] = kept.flatMap(([x, y]) => [tenths(x), tenths(y)]);
    }
    spawns[kind][id] = row;
    count[kind]++;
  }
}

writeFileSync(path.join(DATA, 'spawns.json'), JSON.stringify(spawns));
writeFileSync(path.join(DATA, 'zone-maps.json'), JSON.stringify(maps));
if (SVG) {
  mkdirSync(SVG, { recursive: true });
  for (const [zone, m] of Object.entries(maps)) {
    const labels = m.places.map(([x, y, name, kind]) => `<circle cx="${x * 1.5}" cy="${y}" r="5" fill="${kind === 'd' ? '#9ccc74' : '#f2b640'}"/><text x="${x * 1.5 + 9}" y="${y + 6}" font-size="19" fill="#ddd">${name.replace(/&/g, '&amp;')}</text>`).join('');
    writeFileSync(
      path.join(SVG, `${zone}.svg`),
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${MAP_W} ${MAP_H}" width="${MAP_W}" height="${MAP_H}" font-family="sans-serif"><rect width="100%" height="100%" fill="#0d0f13"/>` +
        `<path d="${m.out}" fill-rule="evenodd" fill="#f4f1ea" fill-opacity="0.04"/><path d="${m.land}" fill-rule="evenodd" fill="#f4f1ea" fill-opacity="0.08" stroke="#f2b640" stroke-opacity="0.5" stroke-width="2"/>${labels}` +
        `<text x="20" y="40" font-size="30" fill="#fff">${zoneNames[zone]}</text></svg>`,
    );
  }
}
console.log(report.join('\n'));
console.log(
  `zone maps: ${Object.keys(maps).length} zones drawn${db ? '' : ' (QuestieDB only: no ground beside the zones, no place names)'}; ${count.n} of ${Object.keys(npcs).length} creatures and ${count.o} of ${Object.keys(objects).length} objects placed, ${count.points} points (${count.raw} before thinning)`,
);
