/**
 * Everything the zone page works out from the datasets: what kind of place a zone is, the dungeons in it,
 * its named enemies, the items found there, who trains and sells, and which zones come before and after.
 * Server only (it reads the datasets).
 */
import { ART, ZONE_ART, type ArtKey } from './art';
import { getClasses, getDungeonQuests, getDungeons, getFactions, getGuides, getItemMap, getItems, getMinorItem, getNpcs, getNpcVendorIndex, getQuestsByZone, getZoneMap, getZonePages, getZones } from './data';
import { itemTypeLabel, slotLabel } from './items';
import { norm, type ZoneQuest } from './quest-bands';
import { entityRef, typeLabel } from './quests';
import type { DungeonInfo, Item, Npc, Quest, Zone } from './types';
import { CAPITALS, CONTINENT, isLadderZone, ZONE_NOTES, zoneLevels } from './world';
import { ARMOR_SUBCLASS, CLASS_COLOR, WEAPON_SUBCLASS } from './wow';

/* ── What kind of place ─────────────────────────────────────────────────── */

export type ZoneKind = 'zone' | 'city' | 'dungeon' | 'raid' | 'battleground';

export const KIND_LABEL: Record<ZoneKind, string> = { zone: 'Zone', city: 'Capital city', dungeon: 'Dungeon', raid: 'Raid', battleground: 'Battleground' };

function instanceKind(z: Zone): Exclude<ZoneKind, 'zone' | 'city'> | null {
  if (z.inst === 3 || z.cat === 3) return 'raid';
  if (z.inst === 4 || z.cat === 6) return 'battleground';
  if (z.inst === 2 || z.cat === 2) return 'dungeon';
  return null;
}

/** An outdoor zone: the kind that has a ladder row, quests and a continent. */
const isOutdoor = (z: Zone) => z.inst === 0 && [0, 1, -1].includes(z.cat);

export function zoneKind(z: Zone, primary: DungeonInfo | null): ZoneKind {
  if (primary) return primary.kind;
  return instanceKind(z) ?? (CAPITALS.has(z.id) ? 'city' : 'zone');
}

/* ── Datasets by zone, built once ───────────────────────────────────────── */

let npcIndex: Map<number, [number, Npc][]> | null = null;
/** Every creature record by zone id. */
export function npcsByZone() {
  if (npcIndex) return npcIndex;
  const map = new Map<number, [number, Npc][]>();
  for (const [id, n] of Object.entries(getNpcs())) {
    if (!n[6]) continue;
    const list = map.get(n[6]);
    if (list) list.push([Number(id), n]);
    else map.set(n[6], [[Number(id), n]]);
  }
  npcIndex = map;
  return map;
}

type SourceMark = NonNullable<Item['sm']>[number];
let itemIndex: Map<number, { item: Item; mark: SourceMark }[]> | null = null;
/** Items by the zone their source marks name. */
function itemsByZone() {
  if (itemIndex) return itemIndex;
  const map = new Map<number, { item: Item; mark: SourceMark }[]>();
  for (const item of getItems()) {
    for (const mark of item.sm ?? []) {
      if (!mark.z) continue;
      const list = map.get(mark.z);
      if (list) list.push({ item, mark });
      else map.set(mark.z, [{ item, mark }]);
    }
  }
  itemIndex = map;
  return map;
}

/** How much the datasets know about a zone: tells a real zone from a hollow copy that shares its name. */
function dataScore(z: Zone) {
  const page = getZonePages()[String(z.id)];
  return (getQuestsByZone().get(z.id)?.length ?? 0) + (npcsByZone().get(z.id)?.length ?? 0) + (page?.elites.length ?? 0) + (ZONE_NOTES[z.id] ? 5 : 0);
}

/* ── Dungeons, raids and battlegrounds ──────────────────────────────────── */

/** The dungeon, raid or battleground page that stands for this very zone. */
export function primaryDungeon(z: Zone): DungeonInfo | null {
  const all = getDungeons();
  const byId = all.find((d) => d.zoneId === z.id);
  if (byId) return byId;
  const zn = norm(z.n);
  const byName = all.find((d) => norm(d.name) === zn);
  if (byName) return byName;
  const ik = instanceKind(z);
  if (ik) {
    const byPlace = all.find((d) => d.kind === ik && norm(d.location) === zn);
    if (byPlace) return byPlace;
  }
  // "Whelgar's Excavation Site" is the zone entry for the dungeon "Whelgar's Excavation".
  return all.find((d) => norm(d.name).length >= 8 && zn.startsWith(norm(d.name))) ?? null;
}

/** Other dungeons and raids that sit in this zone, by the place their location names. */
export function relatedDungeons(z: Zone, primary: DungeonInfo | null): DungeonInfo[] {
  const zn = norm(z.n);
  return getDungeons().filter((d) => {
    if (d === primary || d.zoneId === z.id) return false;
    if (zn && norm(d.location).includes(zn)) return true;
    // "Alterac, inside the fallen barrier" belongs to Alterac Mountains.
    const first = norm(d.location.split(',')[0]);
    return first.length >= 6 && zn.startsWith(first) && isOutdoor(z);
  });
}

/** The zone with the data for a place name, if there is one. */
function canonicalZone(name: string, exclude?: number): Zone | null {
  const n = norm(name);
  const hits = getZones().filter((z) => z.id !== exclude && norm(z.n) === n);
  if (!hits.length) return null;
  return hits.map((z) => ({ z, s: dataScore(z) * 2 + (isOutdoor(z) ? 1 : 0) })).sort((a, b) => b.s - a.s || a.z.id - b.z.id)[0].z;
}

/** Outdoor zones that hold a dungeon, named in its location. */
export function hostZones(d: DungeonInfo): Zone[] {
  const loc = norm(d.location);
  const first = norm(d.location.split(',')[0]);
  const seen = new Set<string>();
  const out: Zone[] = [];
  for (const z of getZones()) {
    if (!isOutdoor(z)) continue;
    const zn = norm(z.n);
    if (!(loc.includes(zn) || (first.length >= 6 && zn.startsWith(first)))) continue;
    if (canonicalZone(z.n)?.id !== z.id || seen.has(zn)) continue;
    seen.add(zn);
    out.push(z);
  }
  return out.sort((a, b) => b.n.length - a.n.length);
}

/* ── Pictures ───────────────────────────────────────────────────────────── */

const FALLBACK_ART: Record<ZoneKind, ArtKey[]> = {
  zone: ['worldMap'],
  city: ['worldMap'],
  dungeon: ['worldMap'],
  raid: ['worldMap'],
  battleground: ['worldMap'],
};

const isArt = (k: string | undefined): k is ArtKey => Boolean(k) && (k as string) in ART;

/** The picture for a zone: your own public/art/zone<id>.* first, else the official picture that fits it best. */
export function zoneArt(z: Zone, kind: ZoneKind, primary: DungeonInfo | null, hosts: Zone[] = []): string {
  return `zone${z.id}|${officialZoneArt(z, kind, primary, hosts)}`;
}

/** The official picture for a zone: its own, else its dungeon's, else its host zone's, else the world map. */
function officialZoneArt(z: Zone, kind: ZoneKind, primary: DungeonInfo | null, hosts: Zone[]): ArtKey {
  if (ZONE_ART[z.id]) return ZONE_ART[z.id];
  if (isArt(primary?.art)) return primary.art;
  if (primary?.zoneId && ZONE_ART[primary.zoneId]) return ZONE_ART[primary.zoneId];
  for (const h of hosts) if (ZONE_ART[h.id]) return ZONE_ART[h.id];
  const twin = canonicalZone(z.n, z.id);
  if (twin && ZONE_ART[twin.id]) return ZONE_ART[twin.id];
  const list = FALLBACK_ART[kind];
  return list[z.id % list.length];
}

export function dungeonArt(d: DungeonInfo): string {
  return d.zoneId ? `zone${d.zoneId}|${officialDungeonArt(d)}` : officialDungeonArt(d);
}

function officialDungeonArt(d: DungeonInfo): ArtKey {
  if (isArt(d.art)) return d.art;
  if (d.zoneId && ZONE_ART[d.zoneId]) return ZONE_ART[d.zoneId];
  for (const h of hostZones(d)) if (ZONE_ART[h.id]) return ZONE_ART[h.id];
  return 'worldMap';
}

/* ── Quests ─────────────────────────────────────────────────────────────── */

/** The slim quest records the quest list on the page needs. */
export function zoneQuestRows(quests: Quest[]): ZoneQuest[] {
  // A type that most of the zone shares (every quest in a dungeon is a dungeon quest) says nothing on each row.
  const kinds = new Map<string, number>();
  for (const q of quests) {
    const t = typeLabel(q);
    if (t) kinds.set(t, (kinds.get(t) ?? 0) + 1);
  }
  return quests.map((q) => {
    const row: ZoneQuest = { i: q.i, n: q.n, l: q.l > 0 ? q.l : 0, s: q.s === 1 || q.s === 2 ? q.s : 3, ch: q.ch };
    const t = typeLabel(q);
    if (t && (kinds.get(t) ?? 0) <= quests.length / 2) row.t = t;
    const start = q.st?.[0];
    const name = start ? entityRef(start[0], start[1])?.name : undefined;
    if (start && name) row.by = [start[0], start[1], name];
    if (q.ch === 'u' && q.cl?.length) row.cl = [q.cl[0], q.cl.length - 1];
    return row;
  });
}

/** Factions that quests here give reputation with, by how many quests do. */
export function zoneReputation(quests: Quest[]) {
  const factions = getFactions();
  const counts = new Map<number, number>();
  for (const q of quests) {
    const seen = new Set<number>();
    for (const [f, amount] of q.rp ?? []) {
      if (amount <= 0 || seen.has(f)) continue;
      seen.add(f);
      counts.set(f, (counts.get(f) ?? 0) + 1);
    }
  }
  const out: { id: number; quests: number; name: string }[] = [];
  for (const [id, n] of counts) {
    const name = factions[String(id)]?.n;
    if (name) out.push({ id, quests: n, name });
  }
  return out.sort((a, b) => b.quests - a.quests || a.name.localeCompare(b.name)).slice(0, 6);
}

/* ── Named and elite enemies ────────────────────────────────────────────── */

/** Creature types as the NPC pages print them, and a picture for each (the game's portraits are 3D models). */
export const CREATURE_TYPE = ['', 'Beast', 'Dragonkin', 'Demon', 'Elemental', 'Giant', 'Undead', 'Humanoid', 'Critter', 'Mechanical', 'Not specified', 'Totem'];
export const CREATURE_ICON = [
  'inv_misc_questionmark',
  'ability_hunter_beasttaming',
  'inv_misc_head_dragon_01',
  'spell_shadow_summonfelhunter',
  'spell_frost_summonwaterelemental',
  'ability_warrior_charge',
  'spell_shadow_raisedead',
  'inv_misc_head_human_01',
  'spell_nature_polymorph',
  'inv_gizmo_02',
  'inv_misc_questionmark',
  'spell_nature_stoneskintotem',
];

export interface Enemy {
  /** The creature's page, when it has a record in this zone. */
  id?: number;
  name: string;
  title?: string;
  lo: number;
  hi: number;
  /** 1 elite, 2 rare elite, 3 boss, 4 rare, 0 named without a rank */
  rank: number;
  type: number;
}

const RANK_ORDER: Record<number, number> = { 3: 0, 2: 1, 4: 2, 1: 3, 0: 4 };

/**
 * Elite, rare and boss creatures that are hostile to everyone, from the creature records, plus the names the
 * zone-page data lists for zones the creature records do not cover yet. Friendly leaders and officers are not enemies.
 */
export function zoneEnemies(z: Zone): Enemy[] {
  const byName = new Map<string, [number, Npc]>();
  for (const r of npcsByZone().get(z.id) ?? []) {
    const have = byName.get(r[1][0]);
    if (!have || r[1][4] > have[1][4]) byName.set(r[1][0], r);
  }
  const out = new Map<string, Enemy>();
  const take = ([id, n]: [number, Npc]) => out.set(n[0], { id, name: n[0], title: n[1] || undefined, lo: n[2], hi: n[3], rank: n[4], type: n[8] });
  for (const r of byName.values()) {
    const n = r[1];
    if (n[4] > 0 && (n[5] === 'hh' || (n[5] === 'nn' && !n[7]))) take(r);
  }
  for (const name of getZonePages()[String(z.id)]?.elites ?? []) {
    if (out.has(name)) continue;
    const rec = byName.get(name);
    if (rec) take(rec);
    else out.set(name, { name, lo: 0, hi: 0, rank: 0, type: 0 });
  }
  return [...out.values()].sort((a, b) => RANK_ORDER[a.rank] - RANK_ORDER[b.rank] || b.hi - a.hi || a.name.localeCompare(b.name));
}

/* ── Items ──────────────────────────────────────────────────────────────── */

export interface ZoneItem {
  id: number;
  name: string;
  q: number;
  icon?: string;
  meta: string;
  source?: string;
  /** For sorting: item level. */
  lvl: number;
}

function gearLabel(it: Item) {
  const type = itemTypeLabel(it);
  const slot = slotLabel(it);
  if (it.c === 2) return slot && !/^(Ranged|Thrown|Non-equippable)$/.test(slot) ? `${slot} ${type}` : type;
  if (it.c === 4) {
    if (['Cloak', 'Amulet', 'Ring', 'Trinket', 'Off-hand'].includes(type) || [6, 7, 8, 9].includes(it.sc)) return type;
    if (type === 'Miscellaneous') return slot;
    return slot ? `${type} ${slot}` : type;
  }
  return type;
}

function describe(id: number): Omit<ZoneItem, 'source'> | null {
  const it = getItemMap().get(id);
  if (it) {
    return { id, name: it.n, q: it.q, icon: it.ic, meta: [gearLabel(it), it.r > 0 ? `requires level ${it.r}` : ''].filter(Boolean).join(', '), lvl: it.l };
  }
  const m = getMinorItem(id);
  if (m) {
    // Weapons and armor that only the quest data knows: name the type from its class and subclass.
    const type = m[3] === 2 ? WEAPON_SUBCLASS[m[4]] : m[3] === 4 ? ARMOR_SUBCLASS[m[4]] : '';
    const label = type && type !== 'Miscellaneous' ? type : '';
    return { id, name: m[0], q: m[1], icon: m[2], meta: [label, m[6] > 0 ? `requires level ${m[6]}` : '', m[9] ? 'starts a quest' : ''].filter(Boolean).join(', '), lvl: m[5] };
  }
  return null;
}

const bestFirst = (a: ZoneItem, b: ZoneItem) => b.q - a.q || b.lvl - a.lvl || a.name.localeCompare(b.name);

export interface ZoneItems {
  rewards: ZoneItem[];
  drops: ZoneItem[];
  sold: ZoneItem[];
  total: number;
}

function sourceText(names: string[], label: string) {
  const unique = [...new Set(names)];
  return unique.length ? `${label}: ${unique[0]}${unique.length > 1 ? ` and ${unique.length - 1} more` : ''}` : undefined;
}

/**
 * Quest rewards (from the quests in the zone), drops and chest loot (from item sources), and what vendors in
 * the zone sell. Uncommon and better only; each item appears once, in the first group that has it.
 */
export function zoneItems(z: Zone, quests: Quest[]): ZoneItems {
  const used = new Set<number>();

  // Quest rewards, lowest level quest first so the source names the earliest one.
  const rewardQuests = new Map<number, string[]>();
  for (const q of [...quests].sort((a, b) => (a.l || 99) - (b.l || 99))) {
    for (const [id] of [...(q.ir ?? []), ...(q.ic ?? [])]) {
      const list = rewardQuests.get(id);
      if (list) list.push(q.n);
      else rewardQuests.set(id, [q.n]);
    }
  }
  const rewards: ZoneItem[] = [];
  for (const [id, names] of rewardQuests) {
    const d = describe(id);
    if (!d || d.q < 2) continue;
    used.add(id);
    rewards.push({ ...d, source: sourceText(names, 'Quest') });
  }

  // Drops and chests, and the vendors the item sources name.
  const dropNames = new Map<number, string[]>();
  const vendorNames = new Map<number, string[]>();
  const push = (map: Map<number, string[]>, id: number, name: string) => {
    const list = map.get(id);
    if (list) list.push(name);
    else map.set(id, [name]);
  };
  for (const { item, mark } of itemsByZone().get(z.id) ?? []) {
    if (item.av === 'e' || item.q < 2) continue;
    const src = item.src ?? [];
    const vendor = src.includes(5) && !src.includes(2);
    if (mark.t === 1 && vendor) push(vendorNames, item.i, mark.n ?? 'a vendor');
    else if (mark.t === 1 || mark.t === 2 || (mark.t === undefined && src.includes(2))) push(dropNames, item.i, mark.n ?? z.n);
  }
  const drops: ZoneItem[] = [];
  for (const [id, names] of dropNames) {
    if (used.has(id)) continue;
    const d = describe(id);
    if (!d) continue;
    used.add(id);
    drops.push({ ...d, source: sourceText(names, 'Drop') });
  }

  // Vendors standing in the zone.
  const sells = getNpcVendorIndex();
  for (const [npcId, n] of npcsByZone().get(z.id) ?? []) {
    if (n[7] & 4) for (const id of sells.get(npcId) ?? []) push(vendorNames, id, n[0]);
  }
  const sold: ZoneItem[] = [];
  for (const [id, names] of vendorNames) {
    if (used.has(id)) continue;
    const d = describe(id);
    if (!d || d.q < 2 || getItemMap().get(id)?.av === 'e') continue;
    used.add(id);
    sold.push({ ...d, source: sourceText(names, 'Sold by') });
  }

  rewards.sort(bestFirst);
  drops.sort(bestFirst);
  sold.sort(bestFirst);
  return { rewards, drops, sold, total: rewards.length + drops.length + sold.length };
}

/* ── Trainers, vendors and other services ───────────────────────────────── */

export interface ServiceNpc {
  id: number;
  name: string;
  title: string;
}

export interface Services {
  classTrainers: { slug: string; name: string; color: string; icon: string; npcs: ServiceNpc[] }[];
  trainers: ServiceNpc[];
  vendors: ServiceNpc[];
  other: { label: string; npcs: ServiceNpc[] }[];
  trainerCount: number;
  vendorCount: number;
}

const CLASS_TITLE = /^(?:(?:Grand )?Master )?(Warrior|Paladin|Hunter|Rogue|Priest|Shaman|Mage|Warlock|Druid)(?: Trainer)?$/;

/** Service flags on creature records: vendor 4, flight master 8, trainer 16, innkeeper 128, banker 256, battlemaster 2048, stable master 8192. */
export function zoneServices(z: Zone): Services {
  const records = [...(npcsByZone().get(z.id) ?? [])].sort((a, b) => a[1][0].localeCompare(b[1][0]));
  const npc = ([id, n]: [number, Npc]): ServiceNpc => ({ id, name: n[0], title: n[1] });
  const classMap = new Map<string, ServiceNpc[]>();
  const trainers: ServiceNpc[] = [];
  const vendors: ServiceNpc[] = [];
  const groups: [string, number][] = [
    ['Flight masters', 8],
    ['Innkeepers', 128],
    ['Bankers', 256],
    ['Battlemasters', 2048],
    ['Stable masters', 8192],
  ];
  const other = new Map<string, ServiceNpc[]>();
  let trainerCount = 0;
  for (const r of records) {
    const flags = r[1][7];
    if (flags & 16) {
      trainerCount++;
      const m = CLASS_TITLE.exec(r[1][1]);
      if (m) classMap.set(m[1].toLowerCase(), [...(classMap.get(m[1].toLowerCase()) ?? []), npc(r)]);
      else trainers.push(npc(r));
    }
    let served = false;
    for (const [label, bit] of groups) {
      if (flags & bit) {
        other.set(label, [...(other.get(label) ?? []), npc(r)]);
        served = true;
      }
    }
    if (flags & 4 && !served) vendors.push(npc(r));
  }
  const byTitle = (a: ServiceNpc, b: ServiceNpc) => (a.title || '~').localeCompare(b.title || '~') || a.name.localeCompare(b.name);
  return {
    classTrainers: getClasses()
      .filter((c) => classMap.has(c.slug))
      .map((c) => ({ slug: c.slug, name: c.name, color: CLASS_COLOR[c.slug] ?? '#f4f1ea', icon: c.icon, npcs: classMap.get(c.slug)! })),
    trainers: trainers.sort(byTitle),
    vendors: vendors.sort(byTitle),
    other: groups.map(([label]) => ({ label, npcs: other.get(label) ?? [] })).filter((g) => g.npcs.length),
    trainerCount,
    vendorCount: vendors.length,
  };
}

export const hasServices = (s: Services) => s.classTrainers.length + s.trainers.length + s.vendors.length + s.other.length > 0;

/* ── Guides ─────────────────────────────────────────────────────────────── */

/** Guides that link to this zone or to a dungeon in it. */
export function zoneGuides(z: Zone, dungeons: DungeonInfo[]) {
  const links = [new RegExp(`/world/${z.id}(?![0-9])`), ...dungeons.map((d) => new RegExp(`/dungeons/${d.slug}(?![a-z0-9-])`))];
  return getGuides()
    .filter((g) => links.some((re) => re.test(g.body)))
    .slice(0, 3)
    .map((g) => ({ slug: g.slug, title: g.title, description: g.description, minutes: g.readMinutes }));
}

/* ── Where to go next ───────────────────────────────────────────────────── */

export interface NextCard {
  key: string;
  tag: string;
  href: string;
  title: string;
  art: string;
  /** "Levels 9 to 18" */
  levels?: string;
  /** Territory name when it is Alliance or Horde. */
  side?: 'Alliance' | 'Horde';
  isNew?: boolean;
  kind: ZoneKind;
  note?: string;
}

const rangeText = (lo: number, hi: number) => (lo === hi ? `Level ${lo}` : `Levels ${lo} to ${hi}`);

function zoneCard(z: Zone, tag: string): NextCard {
  const lv = zoneLevels(z);
  const primary = primaryDungeon(z);
  const kind = zoneKind(z, primary);
  return {
    key: `z${z.id}`,
    tag,
    href: `/world/${z.id}`,
    title: z.n,
    art: zoneArt(z, kind, primary),
    levels: lv ? rangeText(lv.lo, lv.hi) : undefined,
    side: z.t === 0 ? 'Alliance' : z.t === 1 ? 'Horde' : undefined,
    isNew: z.st === 'new',
    kind,
  };
}

function dungeonCard(d: DungeonInfo, tag: string): NextCard {
  return {
    key: `d${d.slug}`,
    tag,
    href: `/dungeons/${d.slug}`,
    title: d.name,
    art: dungeonArt(d),
    levels: d.levels ? rangeText(d.levels[0], d.levels[1]) : undefined,
    isNew: d.isNew,
    kind: d.kind,
    note: d.location,
  };
}

type Lane = 'alliance' | 'horde';

/** The ladder in the order the zones page draws it: by level range, lowest first. */
const ladderOrder = () =>
  getZones()
    .filter(isLadderZone)
    .sort((a, b) => zoneLevels(a)!.lo - zoneLevels(b)!.lo || zoneLevels(a)!.hi - zoneLevels(b)!.hi || a.id - b.id);

/** The zone just before and just after `z` in one list of zones that is already in ladder order. */
function neighborsIn(z: Zone, lane: Zone[]): { prev?: Zone; next?: Zone } {
  const here = zoneLevels(z)!;
  const i = lane.findIndex((o) => o.id === z.id);
  if (i < 0) return {};
  const lv = (o: Zone) => zoneLevels(o)!;
  const sibling = (o: Zone) => lv(o).lo === here.lo && lv(o).hi === here.hi;
  const starter = here.lo <= 2;
  const best = (group: Zone[], metric: (o: Zone) => number) => [...group].sort((a, b) => Number(a.cat !== z.cat) - Number(b.cat !== z.cat) || metric(a) - metric(b) || a.id - b.id)[0];

  let prev: Zone | undefined;
  if (!starter) {
    const before = lane.slice(0, i).filter((o) => !sibling(o));
    const edge = before[before.length - 1];
    if (edge) prev = best(before.filter((o) => lv(o).lo === lv(edge).lo), (o) => Math.abs(lv(o).hi - here.lo));
  }
  const after = lane.slice(i + 1).filter((o) => !sibling(o) && !(starter && lv(o).lo <= 2));
  const edge = after[0];
  const next = edge ? best(after.filter((o) => lv(o).lo === lv(edge).lo), (o) => lv(o).hi) : undefined;
  return { prev, next };
}

/**
 * The zones before and after this one on the level ladder, the way the zones page builds it: zones sorted by
 * level range, one continent at a time, for one side. An Alliance zone looks along Alliance and contested zones,
 * a Horde zone along Horde and contested ones, and a contested zone looks along both, so it can have two of
 * each. Zones with the same range are siblings and are skipped, starting zones skip each other, and a zone with
 * nothing further on its own continent (Zephras Isle, or the top of a continent) looks across the whole ladder.
 */
export function ladderNeighbors(z: Zone): { prev: Zone[]; next: Zone[] } {
  const none = { prev: [], next: [] };
  if (!zoneLevels(z) || !isLadderZone(z)) return none;
  const everyone = ladderOrder();
  const sides: Lane[] = z.t === 0 ? ['alliance'] : z.t === 1 ? ['horde'] : ['alliance', 'horde'];
  const prev = new Map<number, Zone>();
  const next = new Map<number, Zone>();
  for (const side of sides) {
    const lane = everyone.filter((o) => (side === 'alliance' ? o.t !== 1 : o.t !== 0));
    const local = neighborsIn(z, lane.filter((o) => o.cat === z.cat));
    const far = neighborsIn(z, lane);
    const p = local.prev ?? far.prev;
    const n = local.next ?? far.next;
    if (p) prev.set(p.id, p);
    if (n) next.set(n.id, n);
  }
  return { prev: [...prev.values()], next: [...next.values()] };
}

/** The cards for "Where to go next", by what kind of place this is. */
export function nextCards(z: Zone, kind: ZoneKind, primary: DungeonInfo | null): NextCard[] {
  const cards: NextCard[] = [];
  const add = (c: NextCard) => {
    if (c.href !== `/world/${z.id}` && !cards.some((x) => x.key === c.key)) cards.push(c);
  };

  // A hollow copy points at the entry that has the data.
  const twin = canonicalZone(z.n, z.id);
  if (twin && dataScore(twin) > dataScore(z)) add(zoneCard(twin, 'Main entry'));

  if (kind === 'zone' || kind === 'city') {
    const { prev, next } = ladderNeighbors(z);
    for (const p of prev) add(zoneCard(p, 'Previous zone'));
    for (const n of next) add(zoneCard(n, 'Next zone'));
    return cards.slice(0, 4);
  }

  // Instances: the zone they are in, then the dungeons just below and above in level.
  if (primary) {
    for (const h of hostZones(primary).slice(0, 2)) add(zoneCard(h, 'Located in'));
    if (primary.kind === 'dungeon' && primary.levels) {
      const ladder = getDungeons()
        .filter((d) => d.kind === 'dungeon' && d.levels)
        .sort((a, b) => a.levels![0] - b.levels![0] || a.levels![1] - b.levels![1] || a.name.localeCompare(b.name));
      const i = ladder.findIndex((d) => d.slug === primary.slug);
      if (i > 0) add(dungeonCard(ladder[i - 1], 'Previous dungeon'));
      if (i >= 0 && i < ladder.length - 1) add(dungeonCard(ladder[i + 1], 'Next dungeon'));
    }
  }
  return cards.slice(0, 4);
}

/* ── The page's overview ────────────────────────────────────────────────── */

export interface Overview {
  zone: Zone;
  kind: ZoneKind;
  primary: DungeonInfo | null;
  related: DungeonInfo[];
  hosts: Zone[];
  quests: Quest[];
  enemies: Enemy[];
  items: ZoneItems;
  services: Services;
  levels: ReturnType<typeof zoneLevels>;
  /** The place line for the kicker: the continent, or where a dungeon is. */
  region: string | null;
  art: string;
  /** Another entry with the same name that holds the data this one lacks. */
  twin: Zone | null;
}

export function overview(id: number): Overview | null {
  const z = getZoneMap().get(id);
  if (!z) return null;
  const primary = primaryDungeon(z);
  const kind = zoneKind(z, primary);
  // A dungeon's zone lists its quests as its page does, those filed under a category of their own included.
  const quests = primary && primary.zoneId === z.id ? getDungeonQuests(primary) : (getQuestsByZone().get(z.id) ?? []);
  const hosts = primary ? hostZones(primary) : [];
  const twin = canonicalZone(z.n, z.id);
  return {
    zone: z,
    kind,
    primary,
    related: relatedDungeons(z, primary),
    hosts,
    quests,
    enemies: zoneEnemies(z),
    items: zoneItems(z, quests),
    services: zoneServices(z),
    levels: zoneLevels(z),
    region: primary ? primary.location : kind === 'zone' || kind === 'city' ? CONTINENT(z) : null,
    art: zoneArt(z, kind, primary, hosts),
    twin: twin && dataScore(twin) > dataScore(z) ? twin : null,
  };
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const levelPhrase = (lv: { lo: number; hi: number } | null) => (lv ? (lv.lo === lv.hi ? `level ${lv.lo}` : `levels ${lv.lo} to ${lv.hi}`) : '');

/** One or two plain sentences for under the title when nobody has written notes for the zone. */
export function zoneBlurb(o: Overview): string {
  const { zone: z, kind, primary, quests, levels, enemies, services } = o;
  if (ZONE_NOTES[z.id]) return ZONE_NOTES[z.id];
  if (primary?.summary) return primary.summary;
  if (!quests.length && !enemies.length && !o.items.total && !hasServices(services)) {
    if (o.twin) return `The main entry for ${z.n} has the quests, creatures and items on record.`;
    return `${z.st === 'new' ? 'New in Forever. ' : ''}No quests, creatures or items are on record for this entry yet.`;
  }
  const parts: string[] = [];
  const fresh = quests.filter((q) => q.ch === 'n').length;
  const lv = levelPhrase(levels);
  const territory = z.t === 0 ? 'Alliance' : z.t === 1 ? 'Horde' : z.t === 2 ? 'Contested' : '';
  if (kind === 'city') {
    parts.push(`${territory === 'Alliance' ? 'An Alliance' : territory === 'Horde' ? 'A Horde' : 'A'} capital with ${plural(services.trainerCount, 'trainer')} and ${plural(services.vendorCount, 'vendor')} on record.`);
  } else if (kind === 'dungeon' || kind === 'raid') {
    const size = primary?.size || z.np;
    parts.push(`A ${size ? `${size}-player ` : ''}${kind}${lv ? ` for ${lv}` : ''}.`);
  } else if (kind === 'battleground') {
    parts.push(`A battleground${lv ? ` for ${lv}` : ''}.`);
  } else if (lv) {
    parts.push(`${territory ? `${territory} territory, ` : ''}${lv}${levels?.approx ? ', estimated' : ''}.`.replace(/^./, (c) => c.toUpperCase()));
  }
  if (quests.length) parts.push(`${plural(quests.length, 'quest')}${fresh ? `, ${fresh} of them new in Forever` : ''}.`);
  else if (enemies.length) parts.push(`${plural(enemies.length, 'named enemy', 'named enemies')} on record.`);
  return parts.join(' ');
}

/** "Level 1 - 56 instead of 1 - 12" reads as "Level 1 to 56 instead of 1 to 12". */
export const changeLine = (s: string) => s.replace(/(\d+) - (\d+)/g, '$1 to $2');
