import type { Item } from './types';
import { ARMOR_SUBCLASS, CLASS_IDS, SLOT, SLOT_FILTERS, WEAPON_PROFICIENCY, WEAPON_SUBCLASS } from './wow';

export const ARMOR_TYPES = [
  { key: 'cloth', label: 'Cloth', sc: [1] },
  { key: 'leather', label: 'Leather', sc: [2] },
  { key: 'mail', label: 'Mail', sc: [3] },
  { key: 'plate', label: 'Plate', sc: [4] },
  { key: 'shield', label: 'Shields', sc: [6] },
  { key: 'jewelry', label: 'Jewelry and cloaks', sc: [-2, 0] },
  { key: 'relic', label: 'Relics', sc: [7, 8, 9] },
];
export const WEAPON_TYPES = [
  { key: 'axe', label: 'Axes', sc: [0, 1] },
  { key: 'mace', label: 'Maces', sc: [4, 5] },
  { key: 'sword', label: 'Swords', sc: [7, 8] },
  { key: 'dagger', label: 'Daggers', sc: [15] },
  { key: 'fist', label: 'Fist weapons', sc: [13] },
  { key: 'polearm', label: 'Polearms', sc: [6] },
  { key: 'staff', label: 'Staves', sc: [10] },
  { key: 'bow', label: 'Bows', sc: [2] },
  { key: 'gun', label: 'Guns', sc: [3] },
  { key: 'crossbow', label: 'Crossbows', sc: [18] },
  { key: 'wand', label: 'Wands', sc: [19] },
  { key: 'thrown', label: 'Thrown', sc: [16] },
];

export function itemTypeLabel(it: Item): string {
  if (it.c === 2) return WEAPON_SUBCLASS[it.sc] ?? 'Weapon';
  if (it.c === 4) {
    if (it.s === 16) return 'Cloak';
    if (it.s === 2) return 'Amulet';
    if (it.s === 11) return 'Ring';
    if (it.s === 12) return 'Trinket';
    if (it.s === 23) return 'Off-hand';
    return ARMOR_SUBCLASS[it.sc] ?? 'Armor';
  }
  return 'Item';
}

export function slotLabel(it: Item) {
  return SLOT[it.s] ?? '';
}

const ARMOR_BY_CLASS: Record<string, number[]> = {
  warrior: [1, 2, 3, 4, 6],
  paladin: [1, 2, 3, 4, 6, 7],
  hunter: [1, 2, 3],
  rogue: [1, 2],
  priest: [1],
  shaman: [1, 2, 3, 6, 9],
  mage: [1],
  warlock: [1],
  druid: [1, 2, 8],
};

/**
 * Whether a class can wear or wield an item (armor type, weapon proficiency, class restriction).
 * Plate and mail open at level 40 for the classes that learn them, as in the game.
 */
export function usableBy(it: Item, cls: string, weapons: string[]): boolean {
  if (it.cls && !(it.cls & (1 << (CLASS_IDS[cls] - 1)))) return false;
  if (it.c === 4) {
    if (it.s === 2 || it.s === 11 || it.s === 12 || it.s === 16 || it.s === 23 || it.s === 4 || it.s === 19) return true;
    if (it.sc === 0 || it.sc === -2) return true;
    return (ARMOR_BY_CLASS[cls] ?? []).includes(it.sc);
  }
  if (it.c === 2) {
    const prof = WEAPON_PROFICIENCY[it.sc];
    if (!prof) return it.sc === 14;
    return weapons.includes(prof);
  }
  return true;
}

export type Weights = Record<string, number>;

/** Equip lines that only restate a stat the item already carries in st. */
const STAT_LINE = new RegExp(
  '^Equip: (' +
    [
      'Increases damage and healing done by magical spells and effects by up to \\d+\\.',
      'Increases healing done by (magical )?spells and effects by up to \\d+\\.',
      'Increases damage done by (magical|Shadow|Fire|Frost|Arcane|Holy|Nature) spells and effects by up to \\d+\\.',
      'Increases healing done by up to \\d+ and damage done by up to \\d+ for all magical spells and effects\\.',
      'Improves your chance to (hit|get a critical strike)( with spells)? by [\\d.]+%\\.',
      'Increases your attack speed and casting speed by [\\d.]+%\\.',
      'Reduces chance to be Dodged or Parried by [\\d.]+%\\.',
      'Increases your chance to (Dodge|Parry) an attack by [\\d.]+%\\.',
      'Increases your chance to Block attacks with a shield by [\\d.]+%\\.',
      'Increases the block value of your shield by \\d+\\.',
      '\\+\\d+ (ranged )?Attack Power( in Cat, Bear, and Dire Bear forms only)?\\.',
      'Increased Defense \\+\\d+\\.',
      'Restores \\d+ (mana|health) per 5 sec\\.',
      'Decreases the magical resistances of your spell targets by \\d+\\.',
    ].join('|') +
    ')$',
);

/** An item's real effects: procs, use effects and special equip bonuses, without the lines that restate stats. */
export function effectLines(it: Pick<Item, 'fx'>): string[] {
  return (it.fx ?? []).filter((l) => /^(Equip|Use|Chance on hit):/.test(l) && !STAT_LINE.test(l));
}

/** Score an item for a set of stat weights; weapon dps counts through the "dps" weight. */
export function scoreItem(it: Item, w: Weights): number {
  let s = 0;
  if (it.st) for (const [k, v] of Object.entries(it.st)) s += (w[k] ?? 0) * v;
  if (it.ar && w.armor) s += w.armor * it.ar;
  if (it.w && w.dps) s += w.dps * (it.w[3] ?? 0);
  if (w.effect) s += w.effect * effectLines(it).length;
  return Math.round(s * 10) / 10;
}

export interface ItemQuery {
  q?: string;
  slot?: string;
  type?: string;
  quality?: number[];
  min?: number;
  max?: number;
  cls?: string;
  weapons?: string[];
  src?: string;
  change?: string;
  stat?: string;
  sort?: string;
  page?: number;
  per?: number;
}

export function normalize(s: string) {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function filterItems(all: Item[], query: ItemQuery): Item[] {
  const words = query.q ? normalize(query.q).split(' ').filter(Boolean) : [];
  const slotDef = query.slot ? SLOT_FILTERS.find((s) => s.key === query.slot) : undefined;
  const armorDef = query.type ? ARMOR_TYPES.find((t) => t.key === query.type) : undefined;
  const weaponDef = query.type ? WEAPON_TYPES.find((t) => t.key === query.type) : undefined;
  const srcCode = query.src ? Number(query.src) : 0;
  return all.filter((it) => {
    if (words.length) {
      const name = normalize(it.n);
      if (!words.every((w) => name.includes(w))) return false;
    }
    if (slotDef && !slotDef.slots.includes(it.s)) return false;
    if (armorDef && !(it.c === 4 && armorDef.sc.includes(it.sc))) return false;
    if (weaponDef && !(it.c === 2 && weaponDef.sc.includes(it.sc))) return false;
    if (query.quality?.length && !query.quality.includes(it.q)) return false;
    if (query.min && it.r < query.min) return false;
    if (query.max && it.r > query.max) return false;
    if (query.cls && !usableBy(it, query.cls, query.weapons ?? [])) return false;
    if (srcCode && !(it.src ?? []).includes(srcCode)) return false;
    if (query.change === 'new' && it.ch !== 'n') return false;
    if (query.change === 'updated' && !Array.isArray(it.ch)) return false;
    if (query.change === 'any' && !(it.ch === 'n' || Array.isArray(it.ch))) return false;
    if (query.stat && !(it.st?.[query.stat] || (query.stat === 'dps' && it.w))) return false;
    return true;
  });
}

export function sortItems(list: Item[], sort: string | undefined, q?: string): Item[] {
  const out = [...list];
  const by = sort || (q ? 'relevance' : 'ilvl');
  if (by === 'relevance' && q) {
    const nq = normalize(q);
    out.sort((a, b) => {
      const na = normalize(a.n), nb = normalize(b.n);
      const ra = na === nq ? 0 : na.startsWith(nq) ? 1 : 2;
      const rb = nb === nq ? 0 : nb.startsWith(nq) ? 1 : 2;
      return ra - rb || b.l - a.l || a.n.localeCompare(b.n);
    });
  } else if (by === 'ilvl') out.sort((a, b) => b.l - a.l || b.q - a.q);
  else if (by === 'req') out.sort((a, b) => b.r - a.r || b.l - a.l);
  else if (by === 'name') out.sort((a, b) => a.n.localeCompare(b.n));
  else if (by.startsWith('stat:')) {
    const k = by.slice(5);
    const val = (it: Item) => (k === 'dps' ? (it.w?.[3] ?? 0) : k === 'armor' ? (it.ar ?? 0) : (it.st?.[k] ?? 0));
    out.sort((a, b) => val(b) - val(a) || b.l - a.l);
  } else out.sort((a, b) => b.l - a.l || b.q - a.q);
  return out;
}

export function queryItems(all: Item[], query: ItemQuery) {
  const filtered = sortItems(filterItems(all, query), query.sort, query.q);
  const per = Math.min(100, Math.max(10, query.per ?? 50));
  const pages = Math.max(1, Math.ceil(filtered.length / per));
  const page = Math.min(pages, Math.max(1, query.page ?? 1));
  return { total: filtered.length, page, pages, per, items: filtered.slice((page - 1) * per, page * per) };
}

/** Item-level color band used in tables. */
export function changeLabel(it: Item): { kind: 'new' | 'updated' | 'unconfirmed' | null; lines: string[] } {
  if (it.ch === 'n') return { kind: 'new', lines: [] };
  if (it.ch === 'x') return { kind: 'unconfirmed', lines: [] };
  if (Array.isArray(it.ch)) return { kind: 'updated', lines: it.ch.slice(1).map((l) => l.replace(/^Unique Unique (added|removed)$/, (_, w) => (w === 'added' ? 'Now unique' : 'No longer unique'))) };
  return { kind: null, lines: [] };
}
