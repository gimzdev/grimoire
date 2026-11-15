import { itemStats, PCT_STATS } from './gear';
import type { Item } from './types';
import { STAT_SHORT } from './wow';

const ORDER = ['str', 'agi', 'sta', 'int', 'spi', 'atkpwr', 'rgdatkpwr', 'feratkpwr', 'splpwr', 'spldmg', 'splheal', 'shasplpwr', 'firsplpwr', 'frosplpwr', 'arcsplpwr', 'natsplpwr', 'holsplpwr', 'critstrkrtng', 'hitrtng', 'hastertng', 'exprtng', 'armorpenrtng', 'defrtng', 'dodgertng', 'parryrtng', 'blockrtng', 'blockamount', 'manargn', 'healthrgn', 'splpen', 'armorbonus', 'firres', 'frores', 'natres', 'shares', 'arcres', 'holres'];

/** Compact stat line for tables: "+18 Str, +10 Sta, 2% Crit", equip lines included. */
export function statLine(it: Item, max = 5): string[] {
  return statsLine(itemStats(it), max);
}

/** The same line for any stats, such as a whole set's added up. */
export function statsLine(st: Record<string, number>, max = 5): string[] {
  const out: string[] = [];
  for (const k of ORDER) {
    const v = st[k];
    if (!v) continue;
    const n = Math.round(v * 10) / 10;
    out.push(PCT_STATS.has(k) ? `${n}% ${STAT_SHORT[k] ?? k}` : `${n > 0 ? '+' : ''}${n} ${STAT_SHORT[k] ?? k}`);
  }
  return out.slice(0, max);
}
