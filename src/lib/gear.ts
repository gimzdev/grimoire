import type { Item } from './types';

/**
 * Gear planner rules shared by the client and the API: paper-doll slots, which item slots fit each one,
 * and starting stat weights for every spec. Weights are relative values (the spec's main stat is 1.0),
 * tuned from how each spec's Forever talents scale. They are a starting point, editable in the planner.
 */

export type Weights = Record<string, number>;

/** Stat weights in a planner link: "str:1,agi:0.5", rounded to two places, zeros (after rounding) left out. */
export function encodeWeights(w: Weights) {
  return Object.entries(w)
    .map(([k, v]) => [k, +v.toFixed(2)] as const)
    .filter(([, v]) => v)
    .map(([k, v]) => `${k}:${v}`)
    .join(',');
}
export function decodeWeights(s: string): Weights | null {
  const out: Weights = {};
  for (const part of s.split(',')) {
    const [k, v] = part.split(':');
    if (k && WEIGHT_KEYS.includes(k) && v !== '' && Number.isFinite(Number(v))) out[k] = Number(v);
  }
  return Object.keys(out).length ? out : null;
}

export interface DollSlot {
  key: string;
  label: string;
}

export const DOLL_LEFT: DollSlot[] = [
  { key: 'head', label: 'Head' },
  { key: 'neck', label: 'Neck' },
  { key: 'shoulder', label: 'Shoulder' },
  { key: 'back', label: 'Back' },
  { key: 'chest', label: 'Chest' },
  { key: 'wrist', label: 'Wrist' },
];
export const DOLL_RIGHT: DollSlot[] = [
  { key: 'hands', label: 'Hands' },
  { key: 'waist', label: 'Waist' },
  { key: 'legs', label: 'Legs' },
  { key: 'feet', label: 'Feet' },
  { key: 'finger1', label: 'Finger' },
  { key: 'finger2', label: 'Finger' },
  { key: 'trinket1', label: 'Trinket' },
  { key: 'trinket2', label: 'Trinket' },
];
export const DOLL_WEAPONS: DollSlot[] = [
  { key: 'mainhand', label: 'Main Hand' },
  { key: 'offhand', label: 'Off Hand' },
  { key: 'ranged', label: 'Ranged' },
];
export const DOLL: DollSlot[] = [...DOLL_LEFT, ...DOLL_RIGHT, ...DOLL_WEAPONS];

const DUAL_WIELD = new Set(['warrior', 'rogue', 'hunter']);
export const canDualWield = (cls: string) => DUAL_WIELD.has(cls);

export function rangedLabel(cls: string) {
  if (cls === 'paladin') return 'Libram';
  if (cls === 'shaman') return 'Totem';
  if (cls === 'druid') return 'Idol';
  if (cls === 'priest' || cls === 'mage' || cls === 'warlock') return 'Wand';
  return 'Ranged';
}

/** Which item inventory slots a paper-doll slot accepts for a class. */
export function slotAccepts(slot: string, cls: string): number[] {
  switch (slot) {
    case 'head':
      return [1];
    case 'neck':
      return [2];
    case 'shoulder':
      return [3];
    case 'back':
      return [16];
    case 'chest':
      return [5, 20];
    case 'wrist':
      return [9];
    case 'hands':
      return [10];
    case 'waist':
      return [6];
    case 'legs':
      return [7];
    case 'feet':
      return [8];
    case 'finger1':
    case 'finger2':
      return [11];
    case 'trinket1':
    case 'trinket2':
      return [12];
    case 'mainhand':
      return [13, 21, 17];
    case 'offhand':
      return canDualWield(cls) ? [13, 22, 14, 23] : [14, 22, 23];
    case 'ranged':
      return rangedLabel(cls) === 'Ranged' || rangedLabel(cls) === 'Wand' ? [15, 25, 26] : [28];
    default:
      return [];
  }
}

/** Extra subclass checks the inventory slot alone cannot express (wands vs. bows, relic types). */
export function fitsSlot(it: Item, slot: string, cls: string): boolean {
  if (!slotAccepts(slot, cls).includes(it.s)) return false;
  if (slot === 'ranged') {
    const kind = rangedLabel(cls);
    if (kind === 'Wand') return it.c === 2 && it.sc === 19;
    if (kind === 'Ranged') return it.c === 2 && it.sc !== 19;
    if (kind === 'Libram') return it.sc === 7;
    if (kind === 'Totem') return it.sc === 9;
    if (kind === 'Idol') return it.sc === 8;
  }
  return true;
}

export interface Preset {
  key: string;
  label: string;
  role: 'tank' | 'healer' | 'melee' | 'ranged';
  weights: Weights;
}

const caster = (school: Partial<Weights>, extra: Weights = {}): Weights => ({ splpwr: 1, spldmg: 1, hitrtng: 1.3, critstrkrtng: 0.85, hastertng: 0.8, int: 0.35, spi: 0.1, sta: 0.1, splpen: 0.15, ...school, ...extra });
const healer = (extra: Weights = {}): Weights => ({ splheal: 1, splpwr: 0.9, int: 0.8, manargn: 1.3, critstrkrtng: 0.6, hastertng: 0.65, spi: 0.3, sta: 0.1, ...extra });
const physical = (extra: Weights = {}): Weights => ({ str: 1, agi: 0.7, atkpwr: 0.5, critstrkrtng: 1, hitrtng: 1.6, exprtng: 1.3, hastertng: 0.9, armorpenrtng: 0.4, sta: 0.1, dps: 5, ...extra });
const tank = (extra: Weights = {}): Weights => ({ sta: 1, defrtng: 1.2, dodgertng: 1, parryrtng: 0.85, blockrtng: 0.6, blockamount: 0.5, armorbonus: 0.08, armor: 0.06, agi: 0.6, str: 0.35, hitrtng: 0.55, exprtng: 0.5, atkpwr: 0.12, dps: 0.8, ...extra });

export const PRESETS: Record<string, Preset[]> = {
  warrior: [
    { key: 'arms', label: 'Arms', role: 'melee', weights: physical({ dps: 6 }) },
    { key: 'fury', label: 'Fury', role: 'melee', weights: physical({ critstrkrtng: 1.1, hitrtng: 1.8, exprtng: 1.4, hastertng: 1 }) },
    { key: 'protection', label: 'Protection', role: 'tank', weights: tank() },
  ],
  paladin: [
    { key: 'holy', label: 'Holy', role: 'healer', weights: healer({ critstrkrtng: 0.75, int: 1, holsplpwr: 0.4 }) },
    { key: 'protection', label: 'Protection', role: 'tank', weights: tank({ splpwr: 0.4, holsplpwr: 0.4, spldmg: 0.35, int: 0.3, parryrtng: 0.8, blockrtng: 0.75, blockamount: 0.6, dps: 0.5 }) },
    { key: 'retribution', label: 'Retribution', role: 'melee', weights: physical({ int: 0.35, splpwr: 0.4, holsplpwr: 0.4, spldmg: 0.3, hitrtng: 1.5, exprtng: 1.2, hastertng: 0.8 }) },
  ],
  hunter: [
    { key: 'beast-mastery', label: 'Beast Mastery', role: 'ranged', weights: { agi: 1, atkpwr: 0.45, rgdatkpwr: 0.45, int: 0.45, critstrkrtng: 0.9, hitrtng: 1.4, hastertng: 0.85, armorpenrtng: 0.3, sta: 0.1, rdps: 3, dps: 0.2 } },
    { key: 'marksmanship', label: 'Marksmanship', role: 'ranged', weights: { agi: 1, atkpwr: 0.45, rgdatkpwr: 0.45, int: 0.45, critstrkrtng: 1, hitrtng: 1.5, hastertng: 0.8, armorpenrtng: 0.35, sta: 0.1, rdps: 3.2, dps: 0.2 } },
    { key: 'survival', label: 'Survival', role: 'melee', weights: { agi: 1, str: 0.45, atkpwr: 0.45, int: 0.45, critstrkrtng: 1, hitrtng: 1.6, exprtng: 1.3, hastertng: 0.8, armorpenrtng: 0.35, sta: 0.1, dps: 5, rdps: 0.4 } },
  ],
  rogue: [
    { key: 'assassination', label: 'Assassination', role: 'melee', weights: physical({ agi: 1, str: 0.5, critstrkrtng: 1.05, dps: 4 }) },
    { key: 'combat', label: 'Combat', role: 'melee', weights: physical({ agi: 1, str: 0.5, exprtng: 1.4, hastertng: 1, dps: 4.5 }) },
    { key: 'subtlety', label: 'Subtlety', role: 'melee', weights: physical({ agi: 1, str: 0.5, critstrkrtng: 1, armorpenrtng: 0.5, dps: 4 }) },
  ],
  priest: [
    { key: 'discipline', label: 'Discipline', role: 'healer', weights: healer({ int: 1, critstrkrtng: 0.8, spi: 0.4, manargn: 1.4 }) },
    { key: 'holy', label: 'Holy', role: 'healer', weights: healer({ spi: 0.8 }) },
    { key: 'shadow', label: 'Shadow', role: 'ranged', weights: caster({ shasplpwr: 1 }) },
  ],
  shaman: [
    { key: 'elemental', label: 'Elemental', role: 'ranged', weights: caster({ natsplpwr: 0.8, firsplpwr: 0.35 }, { critstrkrtng: 0.95, int: 0.4, manargn: 0.8 }) },
    { key: 'enhancement', label: 'Enhancement', role: 'melee', weights: physical({ int: 0.55, splpwr: 0.3, dps: 6 }) },
    { key: 'restoration', label: 'Restoration', role: 'healer', weights: healer({ int: 0.85, manargn: 1.4 }) },
  ],
  mage: [
    { key: 'arcane', label: 'Arcane', role: 'ranged', weights: caster({ arcsplpwr: 1 }, { int: 0.5, spi: 0.3, manargn: 0.6 }) },
    { key: 'fire', label: 'Fire', role: 'ranged', weights: caster({ firsplpwr: 1 }, { critstrkrtng: 1 }) },
    { key: 'frost', label: 'Frost', role: 'ranged', weights: caster({ frosplpwr: 1 }, { critstrkrtng: 0.9 }) },
  ],
  warlock: [
    { key: 'affliction', label: 'Affliction', role: 'ranged', weights: caster({ shasplpwr: 1 }, { critstrkrtng: 0.75, sta: 0.2 }) },
    { key: 'demonology', label: 'Demonology', role: 'ranged', weights: caster({ shasplpwr: 1, firsplpwr: 0.3 }, { critstrkrtng: 0.7, sta: 0.3 }) },
    { key: 'destruction', label: 'Destruction', role: 'ranged', weights: caster({ shasplpwr: 0.7, firsplpwr: 0.7 }, { critstrkrtng: 0.95, sta: 0.15 }) },
  ],
  druid: [
    { key: 'balance', label: 'Balance', role: 'ranged', weights: caster({ arcsplpwr: 0.6, natsplpwr: 0.6 }, { int: 0.4, spi: 0.2 }) },
    { key: 'feral', label: 'Feral cat', role: 'melee', weights: { agi: 1, str: 0.9, atkpwr: 0.45, feratkpwr: 0.45, critstrkrtng: 1, hitrtng: 1.6, exprtng: 1.3, hastertng: 0.6, armorpenrtng: 0.4, sta: 0.1 } },
    { key: 'bear', label: 'Feral bear', role: 'tank', weights: { sta: 1, agi: 0.9, armor: 0.1, armorbonus: 0.1, defrtng: 0.8, dodgertng: 1, str: 0.4, hitrtng: 0.5, exprtng: 0.5, feratkpwr: 0.15, atkpwr: 0.15 } },
    { key: 'restoration', label: 'Restoration', role: 'healer', weights: healer({ spi: 0.7, int: 0.7, hastertng: 0.7, critstrkrtng: 0.5 }) },
  ],
};

export const RANGED_SLOTS = new Set([15, 25, 26]);

/** Score an item for a set of weights. Weapon damage counts through "dps" (melee) and "rdps" (ranged). */
export function scoreFor(it: Item, w: Weights): number {
  let s = 0;
  if (it.st) for (const [k, v] of Object.entries(it.st)) s += (w[k] ?? 0) * v;
  if (it.ar && w.armor) s += w.armor * it.ar;
  if (it.w) {
    const dpsW = RANGED_SLOTS.has(it.s) && it.sc !== 19 ? (w.rdps ?? w.dps ?? 0) : (w.dps ?? 0);
    s += dpsW * (it.w[3] ?? 0);
  }
  return Math.round(s * 10) / 10;
}

/** Stat keys the planner offers as editable weights, in display order. */
export const WEIGHT_KEYS = ['str', 'agi', 'sta', 'int', 'spi', 'atkpwr', 'rgdatkpwr', 'feratkpwr', 'splpwr', 'spldmg', 'splheal', 'shasplpwr', 'firsplpwr', 'frosplpwr', 'arcsplpwr', 'natsplpwr', 'holsplpwr', 'hitrtng', 'critstrkrtng', 'hastertng', 'exprtng', 'armorpenrtng', 'splpen', 'manargn', 'defrtng', 'dodgertng', 'parryrtng', 'blockrtng', 'blockamount', 'armorbonus', 'armor', 'dps', 'rdps'];
export const EXTRA_WEIGHT_LABEL: Record<string, string> = { armor: 'Armor', dps: 'Weapon DPS', rdps: 'Ranged weapon DPS' };
