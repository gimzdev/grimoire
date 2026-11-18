#!/usr/bin/env node
// Dungeon and raid maps, drawn by Grimoire from VMaNGOS's world positions: every creature, every patrol point and every
// object of an instance marks floor that people walk on, so together they give its floor plan. Bosses stand where
// VMaNGOS spawns them and the entrance is where its teleport puts you. No game art: the outline is Grimoire's own drawing.
//
//   node scripts/data/maps.mjs --vmangos mangos.sqlite [--data data]
//
// Writes data/maps.json: { [dungeon slug]: { views: View[] } }, one view per wing when a dungeon has wings, else one.
//   View: { name, w, h, floors: { name, d }[], bosses: Pin[], doors: [x, y, floor][] }
//   Pin: { key, npc, at: [x, y][] (one place, or every place a pooled boss may appear), f: floor, dis: display ids,
//          pd: the display id whose portrait Blizzard's render server has (see static/no-portrait.json) }
// Coordinates are in the view's own box, w by h (the longer side 1000), north up. d is an SVG path (even-odd fill).
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { area, contours, simplify, smooth } from './lib/outline.mjs';

const arg = (k, d) => {
  const i = process.argv.indexOf(k);
  return i > 0 ? process.argv[i + 1] : d;
};
const here = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.resolve(arg('--data', path.join(here, '..', '..', 'data')));
const db = new DatabaseSync(path.resolve(arg('--vmangos', 'mangos.sqlite')), { readOnly: true });
const PATCH = 10; // 1.12, Forever's base

const creatures = db.prepare('SELECT guid, id, position_x AS x, position_y AS y, position_z AS z FROM creature WHERE map = ? AND patch_min <= ? AND patch_max >= ?');
const walks = db.prepare(
  'SELECT m.position_x AS x, m.position_y AS y, m.position_z AS z FROM creature_movement m JOIN creature c ON c.guid = m.id WHERE c.map = ? AND c.patch_min <= ? AND c.patch_max >= ?',
);
const objects = db.prepare('SELECT position_x AS x, position_y AS y, position_z AS z FROM gameobject WHERE map = ? AND patch_min <= ? AND patch_max >= ?');
const teleports = db.prepare('SELECT id, patch, target_position_x AS x, target_position_y AS y, target_position_z AS z FROM areatrigger_teleport WHERE target_map = ? AND patch <= ? ORDER BY id, patch');
const template = db.prepare('SELECT display_id1 AS a, display_id2 AS b, display_id3 AS c, display_id4 AS d FROM creature_template WHERE entry = ? AND patch <= ? ORDER BY patch DESC');
const pooled = db.prepare('SELECT pool_entry FROM pool_creature WHERE guid = ? AND patch_min <= ? AND patch_max >= ?');

// ── geometry helpers (world: x north, y west; screen: X = -y east, Y = -x south) ──

const screen = (p) => [-p.y, -p.x, p.z];
const d3 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], (a[2] - b[2]) * 2);

/** Points with fewer than two others within 45 yards are strays (a far-off trigger, a mount waiting outside). */
function dropStrays(pts) {
  return pts.filter((p, i) => {
    let n = 0;
    for (let j = 0; j < pts.length && n < 2; j++) if (j !== i && Math.abs(pts[j][0] - p[0]) < 45 && Math.abs(pts[j][1] - p[1]) < 45 && Math.hypot(pts[j][0] - p[0], pts[j][1] - p[1]) < 45) n++;
    return n >= 2;
  });
}

/** z values that split the points into floors lying over one another (at most three splits). */
function floorSplits(pts) {
  const CELL = 12;
  const zs = pts.map((p) => p[2]).sort((a, b) => a - b);
  const occupied = new Set(pts.map((p) => `${Math.floor(p[0] / CELL)},${Math.floor(p[1] / CELL)}`)).size;
  const score = (set, s) => {
    const above = new Set();
    const below = new Set();
    for (const p of set) {
      const k = `${Math.floor(p[0] / CELL)},${Math.floor(p[1] / CELL)}`;
      if (p[2] > s + 5) above.add(k);
      else if (p[2] < s - 5) below.add(k);
    }
    let n = 0;
    for (const k of above) if (below.has(k)) n++;
    return n;
  };
  const splits = [];
  const walk = (set, depth) => {
    if (depth > 2 || set.length < 40) return;
    const z = set.map((p) => p[2]).sort((a, b) => a - b);
    let best = null;
    for (let i = 1; i < z.length; i++) {
      if (z[i] - z[i - 1] < 7) continue;
      const s = (z[i] + z[i - 1]) / 2;
      const lo = set.filter((p) => p[2] < s);
      const hi = set.filter((p) => p[2] >= s);
      if (lo.length < 15 || hi.length < 15) continue;
      const sc = score(set, s);
      if (sc >= Math.max(3, occupied * 0.04) && (!best || sc > best.sc)) best = { s, sc, lo, hi };
    }
    if (!best) return;
    splits.push(best.s);
    walk(best.lo, depth + 1);
    walk(best.hi, depth + 1);
  };
  walk(pts, 0);
  void zs;
  return splits.sort((a, b) => a - b).slice(0, 3);
}

const floorOf = (z, splits) => splits.filter((s) => z >= s).length;

/**
 * The floor plan of a set of points: each point marks a disc of floor, near rooms are joined by a corridor (a minimum
 * spanning tree over the gaps up to 60 yards), and the outline is traced around it. Returns an SVG path in view units.
 */
function plan(pts, box, toView) {
  const CELL = Math.max(1.6, Math.max(box.x1 - box.x0, box.y1 - box.y0) / 340);
  const R = 9;
  const nx = Math.ceil((box.x1 - box.x0) / CELL) + 4;
  const ny = Math.ceil((box.y1 - box.y0) / CELL) + 4;
  const g = new Float32Array(nx * ny);
  const stamp = (x, y, r) => {
    const ci = (x - box.x0) / CELL + 2, cj = (y - box.y0) / CELL + 2, rc = r / CELL;
    for (let j = Math.max(0, Math.floor(cj - rc)); j <= Math.min(ny - 1, Math.ceil(cj + rc)); j++) {
      for (let i = Math.max(0, Math.floor(ci - rc)); i <= Math.min(nx - 1, Math.ceil(ci + rc)); i++) {
        const d2 = ((i - ci) ** 2 + (j - cj) ** 2) / (rc * rc);
        if (d2 < 1) {
          const val = 1 - d2;
          if (val > g[j * nx + i]) g[j * nx + i] = val;
        }
      }
    }
  };
  for (const p of pts) stamp(p[0], p[1], R);
  // rooms: connected parts of the floor, then corridors between the nearest ones
  const T = 0.3;
  const comp = new Int32Array(nx * ny).fill(-1);
  let ncomp = 0;
  for (let k = 0; k < g.length; k++) {
    if (g[k] < T || comp[k] >= 0) continue;
    const stack = [k];
    comp[k] = ncomp;
    while (stack.length) {
      const c = stack.pop();
      const i = c % nx, j = (c - i) / nx;
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const ii = i + di, jj = j + dj;
        if (ii < 0 || jj < 0 || ii >= nx || jj >= ny) continue;
        const n = jj * nx + ii;
        if (g[n] >= T && comp[n] < 0) {
          comp[n] = ncomp;
          stack.push(n);
        }
      }
    }
    ncomp++;
  }
  const members = Array.from({ length: ncomp }, () => []);
  for (const p of pts) {
    const i = Math.round((p[0] - box.x0) / CELL + 2), j = Math.round((p[1] - box.y0) / CELL + 2);
    const c = comp[j * nx + i];
    if (c >= 0) members[c].push(p);
  }
  const sample = members.map((m) => (m.length > 160 ? m.filter((_, i) => i % Math.ceil(m.length / 160) === 0) : m));
  const edges = [];
  for (let a = 0; a < ncomp; a++) {
    for (let b = a + 1; b < ncomp; b++) {
      let best = null;
      for (const p of sample[a]) for (const q of sample[b]) {
        const d = Math.hypot(p[0] - q[0], p[1] - q[1]);
        if (!best || d < best.d) best = { d, p, q };
      }
      if (best && best.d < 60) edges.push({ a, b, ...best });
    }
  }
  edges.sort((x, y) => x.d - y.d);
  const parent = Array.from({ length: ncomp }, (_, i) => i);
  const find = (x) => (parent[x] === x ? x : (parent[x] = find(parent[x])));
  for (const e of edges) {
    const ra = find(e.a), rb = find(e.b);
    if (ra === rb) continue;
    parent[ra] = rb;
    const steps = Math.ceil(e.d / (CELL * 0.5));
    for (let s = 0; s <= steps; s++) stamp(e.p[0] + ((e.q[0] - e.p[0]) * s) / steps, e.p[1] + ((e.q[1] - e.p[1]) * s) / steps, 4.2);
  }
  const loops = contours(g, nx, ny, T)
    .map((l) => l.map(([i, j]) => toView(box.x0 + (i - 2) * CELL, box.y0 + (j - 2) * CELL)))
    .filter((l) => Math.abs(area(l)) > 40)
    .map((l) => simplify(smooth(simplify(l, 1.2)), 0.7));
  return loops.map((l) => 'M' + l.map((p) => `${Math.round(p[0])} ${Math.round(p[1])}`).join('L') + 'Z').join('');
}

// ── each dungeon ──

const enc = JSON.parse(readFileSync(path.join(DATA, 'encounters.json'), 'utf8')).dungeons;
// display ids Blizzard's render server has no portrait for (static/no-portrait.json): a boss shows its first other one
const NO_PORTRAIT = new Set(JSON.parse(readFileSync(path.join(here, 'static', 'no-portrait.json'), 'utf8')).ids);
const out = {};
const report = [];
for (const [slug, d] of Object.entries(enc)) {
  const spawns = creatures.all(d.map, PATCH, PATCH);
  const all = dropStrays([
    ...spawns.map(screen),
    ...walks.all(d.map, PATCH, PATCH).map(screen),
    ...objects.all(d.map, PATCH, PATCH).map(screen),
  ]);
  if (all.length < 20) continue;
  // the bosses and where they stand
  const byNpc = new Map();
  for (const s of spawns) {
    if (!byNpc.has(s.id)) byNpc.set(s.id, []);
    byNpc.get(s.id).push(s);
  }
  const wings = d.wings.map((w) => ({
    name: w.name ?? null,
    bosses: w.bosses.map((b) => {
      const places = [];
      for (const n of b.npcs) for (const s of byNpc.get(n.id) ?? []) places.push({ ...s, npc: n.id, pool: pooled.get(s.guid, PATCH, PATCH) });
      return { key: b.key, places };
    }),
  }));
  // which wing each point belongs to: the one with the nearest boss
  const anchors = wings.flatMap((w, wi) => w.bosses.flatMap((b) => b.places.map((p) => ({ wi, at: screen(p) }))));
  const wingOf = (p) => {
    if (wings.length === 1 || !anchors.length) return 0;
    let best = null;
    for (const a of anchors) {
      const dist = d3(p, a.at);
      if (!best || dist < best.d) best = { d: dist, wi: a.wi };
    }
    return best.wi;
  };
  const doorsAll = [];
  const seenDoor = new Map();
  for (const t of teleports.all(d.map, PATCH)) seenDoor.set(t.id, t);
  for (const t of seenDoor.values()) doorsAll.push(screen(t));
  const views = [];
  wings.forEach((w, wi) => {
    const pts = all.filter((p) => wingOf(p) === wi);
    if (pts.length < 20) return;
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
    const pad = 14;
    const box = { x0: Math.min(...xs) - pad, x1: Math.max(...xs) + pad, y0: Math.min(...ys) - pad, y1: Math.max(...ys) + pad };
    const ex = box.x1 - box.x0, ey = box.y1 - box.y0;
    const s = 1000 / Math.max(ex, ey);
    const W = Math.round(ex * s), H = Math.round(ey * s);
    const toView = (x, y) => [(x - box.x0) * s, (y - box.y0) * s];
    const splits = floorSplits(pts);
    const nf = splits.length + 1;
    const names = nf === 1 ? [null] : nf === 2 ? ['Lower level', 'Upper level'] : nf === 3 ? ['Lower level', 'Middle level', 'Upper level'] : ['Level 1', 'Level 2', 'Level 3', 'Level 4'];
    const floors = [];
    // the entrance is floor too: its point joins the plan so the way in is drawn
    const wingDoors = doorsAll.filter((p) => wingOf(p) === wi);
    for (let f = 0; f < nf; f++) {
      const fp = [...pts, ...wingDoors].filter((p) => floorOf(p[2], splits) === f);
      floors.push({ name: names[f], d: plan(fp, box, toView) });
    }
    const bosses = [];
    for (const b of w.bosses) {
      if (!b.places.length) continue;
      const first = b.places[0];
      const places = b.places.some((p) => p.pool) ? b.places : [first];
      const disp = template.get(first.npc, PATCH) ?? {};
      bosses.push({
        key: b.key,
        npc: first.npc,
        at: places.map((p) => toView(-p.y, -p.x).map((v) => Math.round(v))),
        f: floorOf(first.z, splits),
        dis: [disp.a, disp.b, disp.c, disp.d].filter((x) => x > 0),
      });
      const shown = bosses[bosses.length - 1].dis.find((x) => !NO_PORTRAIT.has(x));
      if (shown) bosses[bosses.length - 1].pd = shown;
    }
    const doors = doorsAll
      .filter((p) => wingOf(p) === wi && p[0] >= box.x0 && p[0] <= box.x1 && p[1] >= box.y0 && p[1] <= box.y1)
      .map((p) => [...toView(p[0], p[1]).map((v) => Math.round(v)), floorOf(p[2], splits)]);
    views.push({ name: w.name, w: W, h: H, floors, bosses, doors });
    report.push(`${slug}${w.name ? ` / ${w.name}` : ''}: ${pts.length} points, ${nf} floor${nf > 1 ? 's' : ''}, ${bosses.length}/${w.bosses.length} bosses placed, ${doors.length} door${doors.length === 1 ? '' : 's'}`);
  });
  if (views.length) out[slug] = { views };
}
writeFileSync(path.join(DATA, 'maps.json'), JSON.stringify(out));
console.log(report.join('\n'));
console.log(`maps: ${Object.keys(out).length} dungeons and raids, ${Object.values(out).reduce((n, m) => n + m.views.length, 0)} views`);
