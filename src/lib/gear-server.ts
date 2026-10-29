import { getClass, getFactions, getItems, getSetMap } from './data';
import { DOLL, fitsSlot, scoreFor, type Weights } from './gear';
import { usableBy } from './items';
import type { Item, ItemSet } from './types';

export type Avail = 'forever' | 'launch' | 'all';
export type Side = 'alliance' | 'horde';

/** Battleground reputations carry no faction in the data; these are the sides they belong to. */
const FACTION_SIDE: Record<number, 1 | 2> = { 890: 1, 509: 1, 730: 1, 2799: 1, 889: 2, 510: 2, 729: 2, 2798: 2 };

function repSide(id: number): number {
  return FACTION_SIDE[id] ?? getFactions()[String(id)]?.side ?? 0;
}

/**
 * The level an item is really usable from. A few items carry no level requirement despite a high item level
 * (special rewards, some test items); treat them as available five levels below their item level.
 */
export const effectiveLevel = (it: Item) => (it.r > 1 ? it.r : Math.max(1, it.l - 5));

/**
 * Items a class can use at a level, from the chosen pool:
 * forever = Classic world items plus new items with a known source; launch = every new item too; all = everything.
 */
export function gearPool(cls: string, max: number, avail: Avail, side: Side = 'alliance'): Item[] {
  const info = getClass(cls);
  if (!info) return [];
  const mine = side === 'horde' ? 2 : 1;
  return getItems().filter((it) => {
    if (it.s === 0 || it.s === 4 || it.s === 18 || it.s === 19 || it.s === 24) return false;
    if (effectiveLevel(it) > max) return false;
    if (avail === 'forever' && !(it.av === 'c' || (it.av === 'n' && (it.src?.length || it.sm?.length)))) return false;
    if (avail === 'launch' && !(it.av === 'c' || it.av === 'n')) return false;
    if (it.side && it.side !== 3 && it.side !== mine) return false;
    if (it.rep) {
      const rs = repSide(it.rep[0]);
      if (rs && rs !== mine) return false;
    }
    // Plate and mail are learned at 40 by the classes that wear them.
    if (it.c === 4 && it.sc === 4 && info.plateAt && max < info.plateAt) return false;
    if (it.c === 4 && it.sc === 3 && info.mailAt && max < info.mailAt) return false;
    return usableBy(it, cls, info.weapons);
  });
}

export function slotOptions(pool: Item[], slot: string, cls: string, w: Weights, q?: string, limit = 60) {
  const words = q ? q.toLowerCase().split(/\s+/).filter(Boolean) : [];
  return pool
    .filter((it) => fitsSlot(it, slot, cls) && (!words.length || words.every((x) => it.n.toLowerCase().includes(x))))
    .map((it) => ({ it, s: scoreFor(it, w) }))
    .sort((a, b) => b.s - a.s || b.it.l - a.it.l || b.it.q - a.it.q)
    .slice(0, limit);
}

/** The best item for every paper-doll slot, with distinct rings and trinkets and the better of two-hander or one-hand plus off-hand. */
export function bestInSlot(cls: string, w: Weights, max: number, avail: Avail, side: Side = 'alliance'): Record<string, Item | null> {
  const pool = gearPool(cls, max, avail, side);
  const out: Record<string, Item | null> = {};
  const top = (slot: string, exclude: Set<number> = new Set()) => slotOptions(pool, slot, cls, w, undefined, 40).find((x) => !exclude.has(x.it.i));
  for (const d of DOLL) {
    if (['finger1', 'finger2', 'trinket1', 'trinket2', 'mainhand', 'offhand'].includes(d.key)) continue;
    out[d.key] = top(d.key)?.it ?? null;
  }
  for (const pair of [['finger1', 'finger2'], ['trinket1', 'trinket2']]) {
    const a = top(pair[0]);
    const b = top(pair[1], new Set(a ? [a.it.i] : []));
    out[pair[0]] = a?.it ?? null;
    out[pair[1]] = b?.it ?? null;
  }
  const mh = slotOptions(pool, 'mainhand', cls, w, undefined, 80);
  const twoHand = mh.find((x) => x.it.s === 17);
  const oneHand = mh.find((x) => x.it.s !== 17);
  const off = oneHand ? top('offhand', new Set([oneHand.it.i])) : top('offhand');
  const pairScore = (oneHand?.s ?? 0) + (off?.s ?? 0);
  if (twoHand && twoHand.s >= pairScore) {
    out.mainhand = twoHand.it;
    out.offhand = null;
  } else {
    out.mainhand = oneHand?.it ?? null;
    out.offhand = off?.it ?? null;
  }
  return out;
}

export function setsFor(items: (Item | null | undefined)[]): Record<number, Pick<ItemSet, 'id' | 'n' | 'pieces' | 'bonus'>> {
  const map = getSetMap();
  const out: Record<number, Pick<ItemSet, 'id' | 'n' | 'pieces' | 'bonus'>> = {};
  for (const it of items) {
    if (!it?.set || out[it.set]) continue;
    const s = map.get(it.set);
    if (s) out[s.id] = { id: s.id, n: s.n, pieces: s.pieces, bonus: s.bonus };
  }
  return out;
}

export function parseWeights(raw: string | null): Weights {
  if (!raw) return {};
  try {
    const v = JSON.parse(raw);
    if (!v || typeof v !== 'object') return {};
    const out: Weights = {};
    for (const [k, n] of Object.entries(v)) if (typeof n === 'number' && Number.isFinite(n) && /^[a-z]{2,16}$/.test(k)) out[k] = Math.max(-10, Math.min(50, n));
    return out;
  } catch {
    return {};
  }
}
