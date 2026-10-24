import type { Item } from './types';
import { STAT_SHORT } from './wow';

const ORDER = ['str', 'agi', 'sta', 'int', 'spi', 'atkpwr', 'rgdatkpwr', 'feratkpwr', 'splpwr', 'spldmg', 'splheal', 'shasplpwr', 'firsplpwr', 'frosplpwr', 'arcsplpwr', 'natsplpwr', 'holsplpwr', 'critstrkrtng', 'hitrtng', 'hastertng', 'exprtng', 'armorpenrtng', 'defrtng', 'dodgertng', 'parryrtng', 'blockrtng', 'blockamount', 'manargn', 'healthrgn', 'splpen', 'armorbonus', 'firres', 'frores', 'natres', 'shares', 'arcres', 'holres'];

/** Compact stat line for tables: "+18 Str, +10 Sta, 28 Crit". */
export function statLine(it: Item, max = 5): string[] {
  const out: string[] = [];
  const st = it.st ?? {};
  for (const k of ORDER) {
    if (st[k]) out.push(`${st[k] > 0 ? '+' : ''}${st[k]} ${STAT_SHORT[k] ?? k}`);
  }
  return out.slice(0, max);
}
