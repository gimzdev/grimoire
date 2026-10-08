import { readFileSync, readdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import type {
  Ability,
  Build,
  ClassInfo,
  ClassTalents,
  DungeonInfo,
  Faction2,
  Drops,
  Item,
  ItemSet,
  MinorItem,
  Npc,
  Quest,
  RaceInfo,
  SpellRecord,
  WorldObject,
  Zone,
  ZonePage,
} from './types';

/** Datasets live in ./data next to the app; each file is parsed once per server process. */
const DATA_DIR = path.join(process.cwd(), 'data');

const store = globalThis as unknown as { __grimoire?: Map<string, unknown> };
const cache = (store.__grimoire ??= new Map());

function memo<T>(key: string, build: () => T): T {
  if (cache.has(key)) return cache.get(key) as T;
  const value = build();
  cache.set(key, value);
  return value;
}

function readJson<T>(file: string): T {
  return memo(`json:${file}`, () => JSON.parse(readFileSync(path.join(DATA_DIR, file), 'utf8')) as T);
}

export interface Meta {
  build: string;
  extracted: string;
  launch: string;
  raidsOpen: string;
  betaEnds: string;
  nameReservation: [string, string];
  counts: Record<string, number>;
}

export const getMeta = () => readJson<Meta>('meta.json');

export const getClasses = () => readJson<ClassInfo[]>('classes.json');
export const getClass = (slug: string) => getClasses().find((c) => c.slug === slug);

export const getRaces = () => readJson<RaceInfo[]>('races.json');
export const getRace = (slug: string) => getRaces().find((r) => r.slug === slug);

export const getAllTalents = () => readJson<Record<string, ClassTalents>>('talents.json');
export const getTalents = (cls: string) => getAllTalents()[cls];

export const getAllAbilities = () => readJson<Record<string, Ability[]>>('abilities.json');
export const getAbilities = (cls: string) => getAllAbilities()[cls] ?? [];

export const getBuilds = () => readJson<Build[]>('builds.json');
export const getBuildsFor = (cls: string) => getBuilds().filter((b) => b.cls === cls);

export const getItems = () => readJson<Item[]>('items.json');
export const getItemMap = () => memo('itemMap', () => new Map(getItems().map((i) => [i.i, i])));
export const getItem = (id: number) => getItemMap().get(id);

export const getSets = () => readJson<ItemSet[]>('sets.json');
export const getSetMap = () => memo('setMap', () => new Map(getSets().map((s) => [s.id, s])));

export const getZones = () => readJson<Zone[]>('zones.json');
export const getZoneMap = () => memo('zoneMap', () => new Map(getZones().map((z) => [z.id, z])));
export const getZonePages = () => readJson<Record<string, ZonePage>>('zone-pages.json');

export const getFactions = () => readJson<Record<string, Faction2>>('factions.json');
export const getZoneNames = () => readJson<Record<string, string>>('zone-names.json');

export const getDungeons = () => readJson<DungeonInfo[]>('dungeons.json');

/** Where a zone ID leads: its zone page, else the dungeon or raid page for it, else nowhere. */
export function placeHref(z: number | undefined): string | undefined {
  if (!z || z <= 0) return undefined;
  if (getZoneMap().has(z)) return `/world/${z}`;
  const d = getDungeons().find((x) => x.zoneId === z);
  return d ? `/dungeons/${d.slug}` : undefined;
}

/* ── Quests, NPCs, objects and loot ─────────────────────────────────────── */

export const getQuests = () => readJson<Quest[]>('quests.json');
export const getQuestMap = () => memo('questMap', () => new Map(getQuests().map((q) => [q.i, q])));
export const getQuest = (id: number) => getQuestMap().get(id);

export const getNpcs = () => readJson<Record<string, Npc>>('npcs.json');
export const getNpc = (id: number): Npc | undefined => getNpcs()[String(id)];
export const getObjects = () => readJson<Record<string, WorldObject>>('objects.json');
export const getObject = (id: number): WorldObject | undefined => getObjects()[String(id)];
export const getMinorItems = () => readJson<Record<string, MinorItem>>('minor-items.json');
export const getMinorItem = (id: number): MinorItem | undefined => getMinorItems()[String(id)];
export const getAllDrops = () => readJson<Record<string, Drops>>('drops.json');
export const getDrops = (itemId: number): Drops | undefined => getAllDrops()[String(itemId)];
/** An NPC's loot: item, chance, quest-only, and 1 when the chance was observed in the Forever beta. */
export type NpcLootRow = [item: number, pct: number, quest: 0 | 1, observed?: 1];
export const getNpcLoot = (npcId: number): NpcLootRow[] => readJson<Record<string, NpcLootRow[]>>('npc-loot.json')[String(npcId)] ?? [];
export const getVendors = (itemId: number): number[] => readJson<Record<string, number[]>>('vendors.json')[String(itemId)] ?? [];

/** Quests by zone or category, in level order. */
export const getQuestsByZone = () =>
  memo('questsByZone', () => {
    const map = new Map<number, Quest[]>();
    for (const q of getQuests()) {
      const list = map.get(q.z);
      if (list) list.push(q);
      else map.set(q.z, [q]);
    }
    // Quests without a level (a few new ones) go last.
    for (const list of map.values()) list.sort((a, b) => (a.l || 99) - (b.l || 99) || a.r - b.r || a.n.localeCompare(b.n));
    return map;
  });

/** Which quests reward, ask for, provide or start with an item. */
export const getItemQuestIndex = () =>
  memo('itemQuestIndex', () => {
    const map = new Map<number, { reward: number[]; choice: number[]; objective: number[]; provided: number[]; starts: number[] }>();
    const at = (id: number) => {
      let v = map.get(id);
      if (!v) map.set(id, (v = { reward: [], choice: [], objective: [], provided: [], starts: [] }));
      return v;
    };
    for (const q of getQuests()) {
      for (const [id] of q.ir ?? []) at(id).reward.push(q.i);
      for (const [id] of q.ic ?? []) at(id).choice.push(q.i);
      for (const r of q.rq ?? []) if (r[0] === 'i' && r[1]) at(r[1]).objective.push(q.i);
      if (q.pi) at(q.pi).provided.push(q.i);
      for (const [k, id] of q.st ?? []) if (k === 'i') at(id).starts.push(q.i);
    }
    return map;
  });

/** Which quests an NPC or object starts, ends or asks you to deal with. */
export const getEntityQuestIndex = () =>
  memo('entityQuestIndex', () => {
    const map = new Map<string, { starts: number[]; ends: number[]; objective: number[] }>();
    const at = (k: string, id: number) => {
      const key = `${k}${id}`;
      let v = map.get(key);
      if (!v) map.set(key, (v = { starts: [], ends: [], objective: [] }));
      return v;
    };
    for (const q of getQuests()) {
      for (const [k, id] of q.st ?? []) if (k !== 'i') at(k, id).starts.push(q.i);
      for (const [k, id] of q.en ?? []) at(k, id).ends.push(q.i);
      for (const r of q.rq ?? []) if ((r[0] === 'n' || r[0] === 'o') && r[1]) at(r[0], r[1]).objective.push(q.i);
    }
    return map;
  });

/** Items an NPC sells. */
export const getNpcVendorIndex = () =>
  memo('npcVendorIndex', () => {
    const map = new Map<number, number[]>();
    for (const [item, npcs] of Object.entries(readJson<Record<string, number[]>>('vendors.json'))) {
      for (const n of npcs) {
        const list = map.get(n);
        if (list) list.push(Number(item));
        else map.set(n, [Number(item)]);
      }
    }
    return map;
  });

/** The chain a quest belongs to, oldest first: the quests that lead to it and the ones offered after it. */
export function getQuestChain(id: number): Quest[] {
  return memo(`chain:${id}`, () => {
    const map = getQuestMap();
    const prevOf = memo('questPrevIndex', () => {
      const m = new Map<number, number>();
      for (const q of getQuests()) if (q.nx && !m.has(q.nx)) m.set(q.nx, q.i);
      return m;
    });
    const start = map.get(id);
    if (!start) return [];
    const chain: Quest[] = [start];
    const seen = new Set([id]);
    for (let cur = start, i = 0; i < 40; i++) {
      // Walk back through "offered next" links first; a plain prerequisite counts when it does not lead elsewhere.
      let back = prevOf.get(cur.i);
      if (back === undefined && cur.pv && cur.pv > 0) {
        const p = map.get(cur.pv);
        if (p && (!p.nx || p.nx === cur.i)) back = p.i;
      }
      const q = back !== undefined ? map.get(back) : undefined;
      if (!q || seen.has(q.i)) break;
      chain.unshift(q);
      seen.add(q.i);
      cur = q;
    }
    // Forward: the quest offered next, or the only quest that needs this one done first.
    const dependents = memo('questDependents', () => {
      const m = new Map<number, number[]>();
      for (const q of getQuests()) {
        if (q.pv && q.pv > 0) {
          const list = m.get(q.pv);
          if (list) list.push(q.i);
          else m.set(q.pv, [q.i]);
        }
      }
      return m;
    });
    for (let cur = start, i = 0; i < 40; i++) {
      const only = dependents.get(cur.i);
      const nextId = cur.nx ?? (only && only.length === 1 ? only[0] : undefined);
      const q = nextId ? map.get(nextId) : undefined;
      if (!q || seen.has(q.i)) break;
      chain.push(q);
      seen.add(q.i);
      cur = q;
    }
    return chain;
  });
}

export const getDungeon = (slug: string) => getDungeons().find((d) => d.slug === slug);

/** Every spell the site can show a tooltip for: talent ranks, trainer abilities and racials. */
export const getSpellIndex = () =>
  memo('spellIndex', () => {
    const map = new Map<number, SpellRecord>();
    for (const [cls, data] of Object.entries(getAllTalents())) {
      for (const tree of data.trees) {
        for (const t of tree.talents) {
          t.spells.forEach((sid, i) => {
            map.set(sid, { id: sid, name: t.name, icon: t.icon, rank: t.max > 1 ? `Rank ${i + 1}` : undefined, desc: t.desc[i] ?? '', kind: 'talent', cls, talentId: t.id });
          });
        }
      }
    }
    for (const [cls, list] of Object.entries(getAllAbilities())) {
      for (const a of list) {
        if (!map.has(a.id)) map.set(a.id, { id: a.id, name: a.name, icon: a.icon, rank: a.rank || undefined, desc: a.desc, kind: 'ability', cls, level: a.level });
      }
    }
    for (const r of getRaces()) {
      for (const rc of [...r.racials, ...Object.values(r.racialVariants ?? {}).flat()]) {
        if (!map.has(rc.id)) map.set(rc.id, { id: rc.id, name: rc.name, icon: rc.icon, rank: rc.passive ? 'Racial Passive' : 'Racial', desc: rc.desc, kind: 'racial' });
      }
    }
    return map;
  });

export interface GuideFile {
  slug: string;
  title: string;
  description: string;
  category: string;
  cls?: string;
  art?: string;
  icon?: string;
  updated: string;
  order: number;
  readMinutes: number;
  body: string;
}

const GUIDE_DIR = path.join(process.cwd(), 'content', 'guides');

function parseFrontmatter(raw: string): { data: Record<string, string>; body: string } {
  const m = /^---\n([\s\S]*?)\n---\n?/.exec(raw);
  if (!m) return { data: {}, body: raw };
  const data: Record<string, string> = {};
  for (const line of m[1].split('\n')) {
    const i = line.indexOf(':');
    if (i > 0) data[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^"(.*)"$/, '$1');
  }
  return { data, body: raw.slice(m[0].length) };
}

export const getGuides = () =>
  memo('guides', () => {
    if (!existsSync(GUIDE_DIR)) return [] as GuideFile[];
    return readdirSync(GUIDE_DIR)
      .filter((f) => f.endsWith('.md'))
      .map((f) => {
        const { data, body } = parseFrontmatter(readFileSync(path.join(GUIDE_DIR, f), 'utf8'));
        const words = body.split(/\s+/).length;
        return {
          slug: f.replace(/\.md$/, ''),
          title: data.title ?? f,
          description: data.description ?? '',
          category: data.category ?? 'General',
          cls: data.class || undefined,
          art: data.art || undefined,
          icon: data.icon || undefined,
          updated: data.updated ?? '2026-10-07',
          order: Number(data.order ?? 50),
          readMinutes: Math.max(2, Math.round(words / 230)),
          body,
        } satisfies GuideFile;
      })
      .sort((a, b) => a.order - b.order || a.title.localeCompare(b.title));
  });

export const getGuide = (slug: string) => getGuides().find((g) => g.slug === slug);

/** First quest and NPC with a given name, for linking names that the source data stores as text. */
export const getQuestNameIndex = () =>
  memo('questNames', () => {
    const m = new Map<string, number>();
    for (const q of getQuests()) if (!m.has(q.n)) m.set(q.n, q.i);
    return m;
  });
export const getNpcNameIndex = () =>
  memo('npcNames', () => {
    const m = new Map<string, number>();
    for (const [id, n] of Object.entries(getNpcs())) if (!m.has(n[0])) m.set(n[0], Number(id));
    return m;
  });
