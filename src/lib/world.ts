import { getNpcs, getQuestsByZone } from './data';
import type { Zone } from './types';

/** Level ranges of Forever's new zones, the ones the front page and the leveling guide already gave: Zephras Isle runs
 * from 1 to 12; Blizzard calls Riverglades a zone for the mid 30s to mid 40s; Mount Hyjal is the endgame leveling zone.
 * Blizzard gives no level for Shen'dralas: its range is the one its quests have (content/guides/leveling.md). The three
 * that are not exact figures are marked estimated. */
export const ZONE_LEVEL_OVERRIDE: Record<number, { lo: number; hi: number; approx?: true }> = {
  16593: { lo: 1, hi: 12 },
  16591: { lo: 35, hi: 45, approx: true },
  16651: { lo: 40, hi: 43, approx: true },
  616: { lo: 55, hi: 60, approx: true },
};

export const ZONE_NOTES: Record<number, string> = {
  16593: 'The Skyborne starting zone: a floating island in Skywall whose wind spirits have vanished. Levels 1 to 12, for both factions.',
  16591: 'A sprawling new zone on the eastern coast of the Eastern Kingdoms that shifts from lush hillsides to ruined keeps. Humans, orcs, ogres, gnolls, goblins and murlocs live there, and Krol’dok Stronghold, a five-player dungeon, stands on a hill north of Sunnyglade.',
  616: 'Endgame leveling on the slopes of the World Tree, still scarred by the battle against Archimonde. Home to Darkwhisper Gorge, the Hyjal Summit raid and the entrance to the Barrow Deeps.',
  16651: 'A new zone between Mulgore and Desolace with a Highborne and centaur storyline: the Shen’dralar, Prince Tortheldrin and the Gordunni and Magram tribes.',
  16606: 'A new 15 vs 15 battleground off the coast of Dustwallow Marsh, for levels 30 to 60, that mixes Eye of the Storm’s flag with Arathi Basin’s capture points: the Darkspear Raiders against the Theramore Expeditionary Force.',
};

export const CONTINENT = (z: Zone) => (z.cat === 0 ? 'Eastern Kingdoms' : z.cat === 1 ? 'Kalimdor' : z.cat === -1 ? 'Skywall' : z.cat === 2 ? 'Dungeons' : z.cat === 3 ? 'Raids' : z.cat === 6 ? 'Battlegrounds' : 'Other');

/**
 * Zones whose range is stretched by a handful of outlying quests or creatures. They show the range most
 * players will quest in, and the zone page also prints the full span from the data. Mulgore's later pocket is
 * Forever's: quests of level 29 and 30 and creatures of 28 to 40 beside a zone whose other creatures stop at 14.
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
  215: [1, 10],
};

/** Zones whose first levels are filed under their starting area (Deathknell in Tirisfal Glades, Red Cloud Mesa and Camp
 * Narache in Mulgore, Shadowglen in Teldrassil): a new character starts there at level 1, so the zone does. */
const STARTS_AT_ONE = new Set([85, 215, 141]);

const at = (sorted: number[], p: number) => sorted[Math.min(sorted.length - 1, Math.max(0, Math.floor(p * (sorted.length - 1))))];

/** The levels of each zone's ordinary creatures that both sides fight (not elites, critters or a side's own guards), sorted. */
let mobLevels: Map<number, number[]> | undefined;
function creatureLevels(zone: number): number[] {
  if (!mobLevels) {
    mobLevels = new Map();
    for (const n of Object.values(getNpcs())) {
      if (!n[6] || n[4] !== 0 || n[8] === 8 || n[5] !== 'hh' || n[2] < 1 || n[3] > 63) continue;
      const list = mobLevels.get(n[6]) ?? [];
      list.push(n[2], n[3]);
      mobLevels.set(n[6], list);
    }
    for (const list of mobLevels.values()) list.sort((a, b) => a - b);
  }
  return mobLevels.get(zone) ?? [];
}

const spans = new Map<number, { lo: number; hi: number } | null>();
/**
 * A zone's levels from what is asked and what stands there: from the lower of where its quests and its creatures begin
 * (the 10th percentile of the quests' levels, the 8th of the creatures') to the lower of where they end (the 85th and
 * the 92nd). One measure alone misleads: 61 of Felwood's 84 quests are level 55 though its creatures start at 47, and
 * 43 of Tanaris's quests are level 60 hub quests though its creatures stop at 50. A zone with three quests of level 5
 * or less and one of 1 or 2 is a starting zone and begins at 1.
 */
export function zoneSpan(z: Zone): { lo: number; hi: number } | null {
  if (spans.has(z.id)) return spans.get(z.id)!;
  const quests = (getQuestsByZone().get(z.id) ?? []).filter((q) => q.l > 0 && !q.ev).map((q) => q.l);
  const mobs = creatureLevels(z.id);
  let span: { lo: number; hi: number } | null = null;
  const starts = quests.length > 0 && quests[0] <= 2 && quests.filter((l) => l <= 5).length >= 3;
  if (quests.length >= 5 && mobs.length >= 6) span = { lo: Math.min(at(quests, 0.1), at(mobs, 0.08)), hi: Math.min(at(quests, 0.85), at(mobs, 0.92)) };
  else if (quests.length >= 5) span = { lo: at(quests, 0.1), hi: at(quests, 0.85) };
  else if (mobs.length >= 6) span = { lo: at(mobs, 0.08), hi: at(mobs, 0.92) };
  else if (z.lo > 0 && z.hi > 0) span = { lo: z.lo, hi: z.hi };
  if (span && (starts || STARTS_AT_ONE.has(z.id))) span.lo = 1;
  spans.set(z.id, span);
  return span;
}

export function zoneLevels(z: Zone): { lo: number; hi: number; approx?: boolean; typical?: boolean } | null {
  const o = ZONE_LEVEL_OVERRIDE[z.id];
  if (o) return o;
  const t = TYPICAL_LEVELS[z.id];
  if (t) return { lo: t[0], hi: t[1], typical: true };
  // an instance keeps the range the data build gave it, from the creatures inside
  if (z.inst !== 0) return z.lo > 0 && z.hi > 0 ? { lo: z.lo, hi: z.hi } : null;
  return zoneSpan(z);
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
