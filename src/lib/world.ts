import type { Zone } from './types';

/** Level ranges for new zones whose beta data has none yet (from quest levels and Blizzard's previews). */
export const ZONE_LEVEL_OVERRIDE: Record<number, { lo: number; hi: number; approx: true }> = {
  616: { lo: 55, hi: 60, approx: true },
  16651: { lo: 38, hi: 45, approx: true },
};

export const ZONE_NOTES: Record<number, string> = {
  16593: 'The Skyborne starting zone: a floating island in Skywall whose wind spirits have vanished. Levels 1 to 12, for both factions.',
  16591: 'A sprawling new zone on the eastern coast of the Eastern Kingdoms that shifts from lush hillsides to ruined keeps. More than 150 quests, with humans, orcs, ogres, gnolls, goblins and murlocs, and the outdoor dungeon Krol’dok Stronghold.',
  616: 'Endgame leveling on the slopes of the World Tree, still scarred by the battle against Archimonde. Home to Darkwhisper Gorge, the Hyjal Summit raid and the entrance to the Barrow Deeps.',
  16651: 'A new zone between Mulgore and Desolace with a Highborne and centaur storyline: the Shen’dralar, Prince Tortheldrin and the Gordunni and Magram tribes.',
  16606: 'A new 15 vs 15 battleground on the Echo Isles that mixes Eye of the Storm’s flag with Arathi Basin’s capture points: the Darkspear trolls against the Theramore Expeditionary Force.',
};

export const CONTINENT = (z: Zone) => (z.cat === 0 ? 'Eastern Kingdoms' : z.cat === 1 ? 'Kalimdor' : z.cat === -1 ? 'Skywall' : z.cat === 2 ? 'Dungeons' : z.cat === 3 ? 'Raids' : z.cat === 6 ? 'Battlegrounds' : 'Other');

/**
 * Zones whose beta range is stretched by a handful of outlying quests or creatures. They show the range most
 * players will quest in, and the zone page also prints the full span from the data.
 */
export const TYPICAL_LEVELS: Record<number, [number, number]> = {
  17: [10, 25],
  10: [18, 30],
  400: [25, 35],
  33: [30, 45],
  1: [1, 12],
  15: [35, 45],
  357: [40, 50],
  4: [45, 55],
};

export function zoneLevels(z: Zone): { lo: number; hi: number; approx?: boolean; typical?: boolean } | null {
  const o = ZONE_LEVEL_OVERRIDE[z.id];
  if (o) return o;
  const t = TYPICAL_LEVELS[z.id];
  if (t) return { lo: t[0], hi: t[1], typical: true };
  if (z.lo > 0 && z.hi > 0) return { lo: z.lo, hi: z.hi };
  return null;
}

export const CAPITALS = new Set([1519, 1537, 1657, 1637, 1638, 1497]);

/** Outdoor zones shown on the level ladder (excludes capitals, instances and phased duplicates). */
export function isLadderZone(z: Zone) {
  if (CAPITALS.has(z.id)) return false;
  if (z.inst !== 0) return false;
  if (![0, 1, -1].includes(z.cat)) return false;
  if (z.n === 'Moonglade') return false;
  // Phased copies of Classic zones that the beta files carry (Elwynn Forest, Stormwind City, Burning Steppes, Gilneas …)
  if (z.st === 'new' && z.id > 16000 && !ZONE_NOTES[z.id] && z.id !== 16593) return false;
  return zoneLevels(z) !== null;
}

export const TERRITORY_COLOR = ['#5d8fd8', '#cb4a3d', '#d9b166', '#a9c47f', '#b58ad6'];
