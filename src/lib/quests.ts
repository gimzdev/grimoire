import { getMinorItem, getNpc, getObject, getItem, getZoneMap, getZoneNames } from './data';
import type { Item, MinorItem, Npc, Quest } from './types';

/** Quest categories that are not zones (QuestSort), plus the few zones the zone list leaves out. */
const CATEGORY_NAMES: Record<number, string> = {
  0: 'Miscellaneous',
  [-1]: 'Epic',
  [-22]: 'Seasonal',
  [-24]: 'Herbalism',
  [-25]: 'Battlegrounds',
  [-61]: 'Warlock',
  [-81]: 'Warrior',
  [-82]: 'Shaman',
  [-101]: 'Fishing',
  [-121]: 'Blacksmithing',
  [-141]: 'Paladin',
  [-161]: 'Mage',
  [-162]: 'Rogue',
  [-181]: 'Alchemy',
  [-182]: 'Leatherworking',
  [-201]: 'Engineering',
  [-221]: 'Treasure Map',
  [-261]: 'Hunter',
  [-262]: 'Priest',
  [-263]: 'Druid',
  [-264]: 'Tailoring',
  [-284]: 'Special',
  [-304]: 'Cooking',
  [-324]: 'First Aid',
  [-344]: 'Legendary',
  [-364]: 'Darkmoon Faire',
  [-365]: 'Ahn’Qiraj War',
  [-366]: 'Lunar Festival',
  [-367]: 'Reputation',
  [-368]: 'Invasion',
  [-369]: 'Midsummer',
  [-666]: 'Camping',
  [-676]: 'Miscellaneous',
  [-1001]: 'Winter Veil',
  [-1002]: 'Children’s Week',
  [-1003]: 'Hallow’s End',
  [-1004]: 'Love is in the Air',
  [-1005]: 'Harvest Festival',
  [-1006]: 'New Year',
  77: 'Anvilmar',
  131: 'Kharanos',
  146: 'Stonewrought Dam',
  293: 'Thoradin’s Wall',
  390: 'Field of Giants',
  702: 'Rut’theran Village',
  1216: 'Timbermaw Hold',
  2839: 'Alterac Valley',
};

export function categoryName(z: number): string {
  if (CATEGORY_NAMES[z] && (z <= 0 || !getZoneMap().get(z))) return CATEGORY_NAMES[z];
  return getZoneMap().get(z)?.n ?? getZoneNames()[String(z)] ?? CATEGORY_NAMES[z] ?? 'Unknown';
}

/** Category groups used by Wowhead's quest list. */
export const GROUPS: Record<number, string> = {
  0: 'Eastern Kingdoms',
  1: 'Kalimdor',
  2: 'Dungeons',
  3: 'Raids',
  4: 'Classes',
  5: 'Professions',
  6: 'Battlegrounds',
  7: 'Miscellaneous',
  9: 'World events',
  [-2]: 'New in Forever',
};

export function groupName(q: Quest) {
  if (q.c2 === -2) return q.z === -666 ? 'Camping' : 'New in Forever';
  return GROUPS[q.c2] ?? 'Other';
}

export const QUEST_TYPE: Record<number, string> = { 1: 'Group', 21: 'Life', 41: 'PvP', 62: 'Raid', 81: 'Dungeon', 82: 'World event', 83: 'Legendary', 84: 'Escort' };

export function typeLabel(q: Quest): string | null {
  if (q.ty && QUEST_TYPE[q.ty]) return q.ty === 1 && q.gp ? `Group (${q.gp})` : QUEST_TYPE[q.ty];
  if (q.gp) return `Group (${q.gp})`;
  return null;
}

export const SIDE_LABEL: Record<number, string> = { 0: 'Both factions', 1: 'Alliance', 2: 'Horde', 3: 'Both factions' };

export const CHANGE_LABEL: Record<Quest['ch'], string | null> = { n: 'New in Forever', u: 'Changed', x: 'Unconfirmed', c: null };

export const SKILL_NAME: Record<number, string> = {
  129: 'First Aid',
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
  633: 'Lockpicking',
};

export const RANK_LABEL: Record<number, string> = { 1: 'Elite', 2: 'Rare elite', 3: 'Boss', 4: 'Rare' };

/** Item display data for gear and for everything else (quest items, consumables, trade goods). */
export type ItemRef = Pick<Item, 'i' | 'n' | 'q' | 'ic'> & { minor?: MinorItem };

export function itemRef(id: number): ItemRef | null {
  const it = getItem(id);
  if (it) return { i: it.i, n: it.n, q: it.q, ic: it.ic };
  const m = getMinorItem(id);
  if (m) return { i: id, n: m[0], q: m[1], ic: m[2], minor: m };
  return null;
}

export interface EntityRef {
  kind: 'n' | 'o' | 'i';
  id: number;
  name: string;
  zone?: number;
  npc?: Npc;
}

export function entityRef(kind: 'n' | 'o' | 'i', id: number): EntityRef | null {
  if (kind === 'n') {
    const n = getNpc(id);
    return n ? { kind, id, name: n[0], zone: n[6] || undefined, npc: n } : null;
  }
  if (kind === 'o') {
    const o = getObject(id);
    return o ? { kind, id, name: o[0], zone: o[1] || undefined } : null;
  }
  const it = itemRef(id);
  return it ? { kind, id, name: it.n } : null;
}

/** Turn the game's placeholders into something readable. */
export function questText(t: string | undefined) {
  return (t ?? '').replace(/<name>/g, 'adventurer').replace(/<class>/g, 'hero').replace(/<race>/g, 'friend');
}

export function levelRange(q: Quest) {
  return q.r && q.r !== q.l ? `${q.l} (requires ${q.r})` : String(q.l);
}

/** Classes from Wowhead's class mask (same bits as the game's class IDs). */
export function questClasses(mask: number | undefined): string[] {
  if (!mask) return [];
  const names: Record<number, string> = { 1: 'Warrior', 2: 'Paladin', 3: 'Hunter', 4: 'Rogue', 5: 'Priest', 7: 'Shaman', 8: 'Mage', 9: 'Warlock', 11: 'Druid' };
  return Object.entries(names)
    .filter(([id]) => mask & (1 << (Number(id) - 1)))
    .map(([, n]) => n);
}
