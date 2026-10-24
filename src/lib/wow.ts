/** Game conventions shared by server and client: names, colors and conversions. */

export const QUALITY = ['Poor', 'Common', 'Uncommon', 'Rare', 'Epic', 'Legendary', 'Artifact'] as const;
export const QUALITY_COLOR = ['#9d9d9d', '#ffffff', '#1eff00', '#2b8cff', '#b45cf7', '#ff8a1f', '#e6cc80'];

export const CLASS_COLOR: Record<string, string> = {
  warrior: '#C69B6D',
  paladin: '#F48CBA',
  hunter: '#AAD372',
  rogue: '#FFF468',
  priest: '#FFFFFF',
  shaman: '#2B8CFF',
  mage: '#3FC7EB',
  warlock: '#8788EE',
  druid: '#FF7C0A',
};

export const CLASS_IDS: Record<string, number> = { warrior: 1, paladin: 2, hunter: 3, rogue: 4, priest: 5, shaman: 7, mage: 8, warlock: 9, druid: 11 };
export const CLASS_BY_ID: Record<number, string> = Object.fromEntries(Object.entries(CLASS_IDS).map(([k, v]) => [v, k]));
export const CLASS_NAMES: Record<string, string> = {
  warrior: 'Warrior',
  paladin: 'Paladin',
  hunter: 'Hunter',
  rogue: 'Rogue',
  priest: 'Priest',
  shaman: 'Shaman',
  mage: 'Mage',
  warlock: 'Warlock',
  druid: 'Druid',
};
export const CLASS_ORDER = ['warrior', 'paladin', 'hunter', 'rogue', 'priest', 'shaman', 'mage', 'warlock', 'druid'];

/** Class restriction masks on items use bit (classId - 1). */
export function classesFromMask(mask: number | undefined): string[] {
  if (!mask) return [];
  return CLASS_ORDER.filter((c) => mask & (1 << (CLASS_IDS[c] - 1)));
}

export const SLOT: Record<number, string> = {
  0: 'Non-equippable',
  1: 'Head',
  2: 'Neck',
  3: 'Shoulder',
  4: 'Shirt',
  5: 'Chest',
  6: 'Waist',
  7: 'Legs',
  8: 'Feet',
  9: 'Wrist',
  10: 'Hands',
  11: 'Finger',
  12: 'Trinket',
  13: 'One-Hand',
  14: 'Off Hand',
  15: 'Ranged',
  16: 'Back',
  17: 'Two-Hand',
  18: 'Bag',
  19: 'Tabard',
  20: 'Chest',
  21: 'Main Hand',
  22: 'Off Hand',
  23: 'Held In Off-hand',
  24: 'Ammo',
  25: 'Thrown',
  26: 'Ranged',
  28: 'Relic',
};

/** Slot filters in the item database, in paper-doll order. */
export const SLOT_FILTERS: { key: string; label: string; slots: number[] }[] = [
  { key: 'head', label: 'Head', slots: [1] },
  { key: 'neck', label: 'Neck', slots: [2] },
  { key: 'shoulder', label: 'Shoulder', slots: [3] },
  { key: 'back', label: 'Back', slots: [16] },
  { key: 'chest', label: 'Chest', slots: [5, 20] },
  { key: 'wrist', label: 'Wrist', slots: [9] },
  { key: 'hands', label: 'Hands', slots: [10] },
  { key: 'waist', label: 'Waist', slots: [6] },
  { key: 'legs', label: 'Legs', slots: [7] },
  { key: 'feet', label: 'Feet', slots: [8] },
  { key: 'finger', label: 'Finger', slots: [11] },
  { key: 'trinket', label: 'Trinket', slots: [12] },
  { key: 'one-hand', label: 'One-Hand', slots: [13, 21] },
  { key: 'two-hand', label: 'Two-Hand', slots: [17] },
  { key: 'off-hand', label: 'Off Hand', slots: [14, 22, 23] },
  { key: 'ranged', label: 'Ranged', slots: [15, 25, 26, 28] },
];

export const ARMOR_SUBCLASS: Record<number, string> = {
  [-2]: 'Jewelry',
  0: 'Miscellaneous',
  1: 'Cloth',
  2: 'Leather',
  3: 'Mail',
  4: 'Plate',
  6: 'Shield',
  7: 'Libram',
  8: 'Idol',
  9: 'Totem',
};

export const WEAPON_SUBCLASS: Record<number, string> = {
  0: 'Axe',
  1: 'Axe',
  2: 'Bow',
  3: 'Gun',
  4: 'Mace',
  5: 'Mace',
  6: 'Polearm',
  7: 'Sword',
  8: 'Sword',
  10: 'Staff',
  13: 'Fist Weapon',
  14: 'Miscellaneous',
  15: 'Dagger',
  16: 'Thrown',
  18: 'Crossbow',
  19: 'Wand',
  20: 'Fishing Pole',
};

/** Proficiency names as they appear in the class data, per weapon subclass. */
export const WEAPON_PROFICIENCY: Record<number, string> = {
  0: 'One-Handed Axes',
  1: 'Two-Handed Axes',
  2: 'Bows',
  3: 'Guns',
  4: 'One-Handed Maces',
  5: 'Two-Handed Maces',
  6: 'Polearms',
  7: 'One-Handed Swords',
  8: 'Two-Handed Swords',
  10: 'Staves',
  13: 'Fist Weapons',
  15: 'Daggers',
  16: 'Thrown',
  18: 'Crossbows',
  19: 'Wands',
};

export const DAMAGE_TYPE = ['Physical', 'Holy', 'Fire', 'Nature', 'Frost', 'Shadow', 'Arcane'];

export const SOURCE: Record<number, string> = {
  1: 'Crafted',
  2: 'Drop',
  3: 'PvP',
  4: 'Quest',
  5: 'Vendor',
  6: 'Trainer',
  7: 'Discovery',
  8: 'Redemption',
  9: 'Talent',
  10: 'Starter',
  11: 'Event',
  12: 'Achievement',
};

export const PROFESSION: Record<number, string> = {
  164: 'Blacksmithing',
  165: 'Leatherworking',
  171: 'Alchemy',
  182: 'Herbalism',
  185: 'Cooking',
  186: 'Mining',
  197: 'Tailoring',
  202: 'Engineering',
  333: 'Enchanting',
  356: 'Fishing',
  393: 'Skinning',
  129: 'First Aid',
  755: 'Jewelcrafting',
};

export const REP_LEVEL = ['Hated', 'Hostile', 'Unfriendly', 'Neutral', 'Friendly', 'Honored', 'Revered', 'Exalted'];

export const TERRITORY = ['Alliance', 'Horde', 'Contested', 'Sanctuary', 'PvP'];

/** Item stats: key in the data, label, and how the game prints it. */
export const STATS: { key: string; label: string; short: string; kind: 'primary' | 'secondary' | 'resist' | 'defense' }[] = [
  { key: 'sta', label: 'Stamina', short: 'Sta', kind: 'primary' },
  { key: 'str', label: 'Strength', short: 'Str', kind: 'primary' },
  { key: 'agi', label: 'Agility', short: 'Agi', kind: 'primary' },
  { key: 'int', label: 'Intellect', short: 'Int', kind: 'primary' },
  { key: 'spi', label: 'Spirit', short: 'Spi', kind: 'primary' },
  { key: 'atkpwr', label: 'Attack Power', short: 'AP', kind: 'secondary' },
  { key: 'rgdatkpwr', label: 'Ranged Attack Power', short: 'RAP', kind: 'secondary' },
  { key: 'feratkpwr', label: 'Attack Power in Feral forms', short: 'Feral AP', kind: 'secondary' },
  { key: 'splpwr', label: 'Spell Power', short: 'SP', kind: 'secondary' },
  { key: 'splheal', label: 'Healing', short: 'Heal', kind: 'secondary' },
  { key: 'spldmg', label: 'Spell Damage', short: 'Spell Dmg', kind: 'secondary' },
  { key: 'shasplpwr', label: 'Shadow Spell Power', short: 'Shadow SP', kind: 'secondary' },
  { key: 'firsplpwr', label: 'Fire Spell Power', short: 'Fire SP', kind: 'secondary' },
  { key: 'frosplpwr', label: 'Frost Spell Power', short: 'Frost SP', kind: 'secondary' },
  { key: 'arcsplpwr', label: 'Arcane Spell Power', short: 'Arcane SP', kind: 'secondary' },
  { key: 'holsplpwr', label: 'Holy Spell Power', short: 'Holy SP', kind: 'secondary' },
  { key: 'natsplpwr', label: 'Nature Spell Power', short: 'Nature SP', kind: 'secondary' },
  { key: 'critstrkrtng', label: 'Critical Strike Rating', short: 'Crit', kind: 'secondary' },
  { key: 'hitrtng', label: 'Hit Rating', short: 'Hit', kind: 'secondary' },
  { key: 'hastertng', label: 'Haste Rating', short: 'Haste', kind: 'secondary' },
  { key: 'exprtng', label: 'Expertise Rating', short: 'Exp', kind: 'secondary' },
  { key: 'armorpenrtng', label: 'Armor Penetration Rating', short: 'ArP', kind: 'secondary' },
  { key: 'splpen', label: 'Spell Penetration', short: 'Pen', kind: 'secondary' },
  { key: 'splcritstrkpct', label: 'Spell Critical Strike %', short: 'Spell Crit %', kind: 'secondary' },
  { key: 'manargn', label: 'Mana per 5 sec', short: 'MP5', kind: 'secondary' },
  { key: 'healthrgn', label: 'Health per 5 sec', short: 'HP5', kind: 'secondary' },
  { key: 'defrtng', label: 'Defense Rating', short: 'Def', kind: 'defense' },
  { key: 'dodgertng', label: 'Dodge Rating', short: 'Dodge', kind: 'defense' },
  { key: 'parryrtng', label: 'Parry Rating', short: 'Parry', kind: 'defense' },
  { key: 'blockrtng', label: 'Block Rating', short: 'Block', kind: 'defense' },
  { key: 'blockamount', label: 'Block Value', short: 'Block Val', kind: 'defense' },
  { key: 'armorbonus', label: 'Bonus Armor', short: 'Armor+', kind: 'defense' },
  { key: 'resipct', label: 'Resilience %', short: 'Resil', kind: 'defense' },
  { key: 'arcres', label: 'Arcane Resistance', short: 'Arc Res', kind: 'resist' },
  { key: 'firres', label: 'Fire Resistance', short: 'Fire Res', kind: 'resist' },
  { key: 'frores', label: 'Frost Resistance', short: 'Frost Res', kind: 'resist' },
  { key: 'natres', label: 'Nature Resistance', short: 'Nat Res', kind: 'resist' },
  { key: 'shares', label: 'Shadow Resistance', short: 'Shadow Res', kind: 'resist' },
  { key: 'holres', label: 'Holy Resistance', short: 'Holy Res', kind: 'resist' },
];
export const STAT_LABEL: Record<string, string> = Object.fromEntries(STATS.map((s) => [s.key, s.label]));
export const STAT_SHORT: Record<string, string> = Object.fromEntries(STATS.map((s) => [s.key, s.short]));

/** Primary stats print as "+18 Strength" in white; the rest are green "Equip:" lines in the game. */
export const WHITE_STATS = new Set(['sta', 'str', 'agi', 'int', 'spi', 'arcres', 'firres', 'frores', 'natres', 'shares', 'holres']);

export function formatMoney(copper: number): { g: number; s: number; c: number } {
  const g = Math.floor(copper / 10000);
  const s = Math.floor((copper % 10000) / 100);
  const c = copper % 100;
  return { g, s, c };
}

export const ROLE_LABEL: Record<string, string> = { tank: 'Tank', healer: 'Healer', melee: 'Melee damage', ranged: 'Ranged damage' };

/** Game icons come from Blizzard's own icon server, at 18, 36 or 56 pixels. */
export const ICON_BASE = 'https://render.worldofwarcraft.com/us/icons';
const ICON_PX = { small: 18, medium: 36, large: 56 } as const;
export function iconUrl(name: string | undefined | null, size: 'small' | 'medium' | 'large' = 'large') {
  return `${ICON_BASE}/${ICON_PX[size]}/${(name || 'inv_misc_questionmark').toLowerCase()}.jpg`;
}

/** Level 60 talent points: one per level from 10. */
export const MAX_TALENT_POINTS = 51;
export const FIRST_TALENT_LEVEL = 10;
