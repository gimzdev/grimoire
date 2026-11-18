// What the zone maps show: where a creature stands (its page), where a quest sends you (the quest's page) and who serves
// players in a zone (the zone's page). The maps are Grimoire's own drawings (scripts/data/zone-maps.mjs); the points are
// QuestieDB's, on Forever's own zone maps.
import { getDrops, getEntityQuestIndex, getItem, getMinorItem, getNpc, getNpcs, getObject, getSpawnData, getSpawns, getZoneDrawings, placeHref, type SpawnRow } from './data';
import { categoryName, RANK_LABEL } from './quests';
import type { Quest } from './types';

export type MapPlace = [x: number, y: number, name: string, kind: 'a' | 'p' | 'd', href?: string];
/** One creature or object on the map: its points as x, y, x, y, ... in tenths of a percent. */
export interface MapItem {
  n: string;
  href?: string;
  sub?: string;
  pts: number[];
}
export interface MapGroup {
  key: string;
  label: string;
  color: string;
  /** How its points are drawn: a dot, or the quest marks */
  mark: 'dot' | 'start' | 'end';
  /** Shown when the map opens (the zone map's layers) */
  on: boolean;
  items: MapItem[];
}
export interface MapZone {
  id: number;
  name: string;
  href?: string;
  land: string;
  out: string;
  places: MapPlace[];
  groups: MapGroup[];
  /** Points on this map, over every group */
  count: number;
  /** Whether the add-on's arrow can be sent to a point of this map (/grim go) */
  go: boolean;
}

export const MAP_COLORS = { gilt: '#f2b640', leaf: '#9ccc74', sky: '#7cc4f4', rose: '#f08a8a', plum: '#c9a0f5', amber: '#f0a35e', teal: '#6fd3c1', bone: '#e8e2d4' } as const;
const OBJECTIVE_COLORS = [MAP_COLORS.sky, MAP_COLORS.rose, MAP_COLORS.plum, MAP_COLORS.amber, MAP_COLORS.teal];

/** At most `max` of a row's points, taken evenly. */
function sample(pts: number[], max: number): number[] {
  const n = pts.length / 2;
  if (n <= max) return pts;
  const out: number[] = [];
  for (let k = 0; k < max; k++) {
    const i = Math.floor((k * n) / max) * 2;
    out.push(pts[i], pts[i + 1]);
  }
  return out;
}

function drawing(zone: number): Pick<MapZone, 'land' | 'out' | 'places' | 'go'> {
  const d = getZoneDrawings()[String(zone)];
  if (!d) return { land: '', out: '', places: [], go: false };
  return { land: d.land, out: d.out, go: d.go === 1, places: d.places.map(([x, y, name, kind, area]) => (kind === 'd' ? [x, y, name, kind, placeHref(area)] : [x, y, name, kind]) as MapPlace) };
}

/** The maps for a set of groups whose items carry every zone's points: one map per zone, the fullest first. */
function assemble(groups: (Omit<MapGroup, 'items'> & { items: (Omit<MapItem, 'pts'> & { rows: SpawnRow })[] })[], maxZones: number, perItem: number): MapZone[] {
  const totals = new Map<number, number>();
  for (const g of groups) for (const it of g.items) for (const [zone, pts] of Object.entries(it.rows)) totals.set(Number(zone), (totals.get(Number(zone)) ?? 0) + pts.length / 2);
  return [...totals.entries()]
    .sort((a, b) => b[1] - a[1] || a[0] - b[0])
    .slice(0, maxZones)
    .map(([zone]) => {
      const gs: MapGroup[] = groups
        .map((g) => ({
          key: g.key,
          label: g.label,
          color: g.color,
          mark: g.mark,
          on: g.on,
          items: g.items.filter((it) => it.rows[String(zone)]?.length).map(({ rows, ...it }) => ({ ...it, pts: sample(rows[String(zone)], perItem) })),
        }))
        .filter((g) => g.items.length);
      return { id: zone, name: categoryName(zone), href: placeHref(zone), ...drawing(zone), groups: gs, count: gs.reduce((n, g) => n + g.items.reduce((m, it) => m + it.pts.length / 2, 0), 0) };
    });
}

/** Where a creature stands: a map for each zone it is in. */
export function npcMaps(id: number): MapZone[] {
  const n = getNpc(id);
  const rows = getSpawns('n', id);
  if (!n || !rows) return [];
  return assemble([{ key: 'npc', label: n[0], color: MAP_COLORS.gilt, mark: 'dot', on: true, items: [{ n: n[0], rows }] }], 6, 260);
}

/** The points of a map as text, for the list under it: "48.9, 36.4". */
export const pointText = (x: number, y: number) => `${(x / 10).toFixed(1)}, ${(y / 10).toFixed(1)}`;

const entity = (kind: 'n' | 'o', id: number) => {
  const rows = getSpawns(kind, id);
  const name = kind === 'n' ? getNpc(id)?.[0] : getObject(id)?.[0];
  return rows && name ? { n: name, href: kind === 'n' ? `/npcs/${id}` : undefined, rows } : null;
};

/**
 * Where a quest sends you: who gives it, who takes it, and what it asks for (the creatures and objects it names, and
 * for an item the three likeliest creatures or objects that drop it).
 */
export function questMaps(q: Quest): MapZone[] {
  type G = Parameters<typeof assemble>[0][number];
  const groups: G[] = [];
  const list = (pairs: [string, number][] | undefined) => (pairs ?? []).flatMap(([k, id]) => (k === 'n' || k === 'o' ? [entity(k, id)] : [])).filter((x): x is NonNullable<ReturnType<typeof entity>> => Boolean(x));
  const starts = list(q.st);
  const ends = list(q.en);
  if (starts.length) groups.push({ key: 'start', label: 'Start', color: MAP_COLORS.gilt, mark: 'start', on: true, items: starts });
  if (ends.length) groups.push({ key: 'end', label: 'End', color: MAP_COLORS.gilt, mark: 'end', on: true, items: ends });
  let c = 0;
  (q.rq ?? []).forEach((r, i) => {
    const [kind, id, text] = r;
    if (!id) return;
    let items: G['items'] = [];
    let label = text ?? '';
    if (kind === 'n' || kind === 'o') {
      const e = entity(kind, id);
      if (e) items = [e];
      label ||= e?.n ?? '';
    } else if (kind === 'i') {
      label ||= getItem(id)?.n ?? getMinorItem(id)?.[0] ?? '';
      const sources = (getDrops(id)?.s ?? []).filter((s) => s[0] === 'n' || s[0] === 'o').sort((a, b) => b[2] - a[2]);
      items = sources
        .slice(0, 3)
        .map((s) => entity(s[0] as 'n' | 'o', s[1]))
        .filter((x): x is NonNullable<ReturnType<typeof entity>> => Boolean(x))
        .map((e) => ({ ...e, sub: `drops ${label}` }));
    }
    if (!items.length || !label) return;
    groups.push({ key: `rq${i}`, label, color: OBJECTIVE_COLORS[c++ % OBJECTIVE_COLORS.length], mark: 'dot', on: true, items });
  });
  // a quest with nothing to find but its giver in a city says little on a map: it needs a second thing to show
  if (groups.length < 2 && !groups.some((g) => g.key.startsWith('rq'))) return groups.length ? assemble(groups, 2, 60) : [];
  return assemble(groups, 4, 90);
}

const FLAG = { quest: 2, vendor: 4, flight: 8, trainer: 16, inn: 128, bank: 256, auction: 4096, stable: 8192, repair: 16384 };

/**
 * A zone's own map: who serves players there (flight masters, innkeepers, repairs, the rest of the vendors, trainers,
 * the capitals' banks, auction houses and stables), who gives quests, and its rare creatures. Each a layer to turn on.
 */
export function zoneLayers(zone: number): MapZone | null {
  const d = getZoneDrawings()[String(zone)];
  if (!d) return null;
  const key = String(zone);
  const layers: { key: string; label: string; color: string; on: boolean; test: (flags: number, rank: number, id: number) => boolean }[] = [
    { key: 'flight', label: 'Flight masters', color: MAP_COLORS.sky, on: true, test: (f) => (f & FLAG.flight) !== 0 },
    { key: 'inn', label: 'Innkeepers', color: MAP_COLORS.amber, on: true, test: (f) => (f & FLAG.inn) !== 0 },
    { key: 'repair', label: 'Repairs', color: MAP_COLORS.bone, on: true, test: (f) => (f & FLAG.repair) !== 0 },
    { key: 'rare', label: 'Rares', color: MAP_COLORS.plum, on: true, test: (_f, rank) => rank === 2 || rank === 4 },
    { key: 'quest', label: 'Quest givers', color: MAP_COLORS.gilt, on: false, test: (_f, _r, id) => Boolean(getEntityQuestIndex().get(`n${id}`)?.starts.length) },
    { key: 'vendor', label: 'Vendors', color: MAP_COLORS.leaf, on: false, test: (f) => (f & FLAG.vendor) !== 0 && (f & FLAG.repair) === 0 },
    { key: 'trainer', label: 'Trainers', color: MAP_COLORS.teal, on: false, test: (f) => (f & FLAG.trainer) !== 0 },
    { key: 'city', label: 'Bank, auctions, stables', color: MAP_COLORS.rose, on: false, test: (f) => (f & (FLAG.bank | FLAG.auction | FLAG.stable)) !== 0 },
  ];
  const groups: MapGroup[] = layers.map((l) => ({ key: l.key, label: l.label, color: l.color, mark: 'dot', on: l.on, items: [] }));
  const npcs = getNpcs();
  for (const [id, rows] of Object.entries(getSpawnData().n)) {
    const pts = rows[key];
    const n = npcs[id];
    if (!pts || !n) continue;
    layers.forEach((l, i) => {
      if (!l.test(n[7], n[4], Number(id))) return;
      const level = n[2] > 0 ? (n[2] === n[3] ? `Level ${n[2]}` : `Level ${n[2]} to ${n[3]}`) : '';
      groups[i].items.push({ n: n[0], href: `/npcs/${id}`, sub: l.key === 'rare' ? [RANK_LABEL[n[4]], level].filter(Boolean).join(', ') : n[1] || undefined, pts: sample(pts, l.key === 'rare' ? 24 : 6) });
    });
  }
  const shown = groups.filter((g) => g.items.length).map((g) => ({ ...g, items: g.items.sort((a, b) => a.n.localeCompare(b.n)) }));
  if (!shown.length) return null;
  // nothing to show at first (a zone with no flight master, inn, repairs or rare): its first layer opens
  if (!shown.some((g) => g.on)) shown[0].on = true;
  return { id: zone, name: categoryName(zone), href: undefined, ...drawing(zone), groups: shown, count: shown.reduce((n, g) => n + g.items.reduce((m, it) => m + it.pts.length / 2, 0), 0) };
}
