import type { Build } from './types';

/**
 * Builds the way players sort them: for leveling, for PvE at 60 (raids and dungeons, as DPS, tank or healer) and for PvP.
 * A build's kind in the data stays finer (raid, tank, heal, dungeon are all PvE); these are the groups the site shows.
 */
export type BuildGroupKey = 'leveling' | 'pve' | 'pvp';

export const BUILD_GROUPS: { key: BuildGroupKey; label: string }[] = [
  { key: 'leveling', label: 'Leveling' },
  { key: 'pve', label: 'PvE' },
  { key: 'pvp', label: 'PvP' },
];

export const buildGroup = (kind: Build['kind']): BuildGroupKey => (kind === 'leveling' ? 'leveling' : kind === 'pvp' ? 'pvp' : 'pve');

/** What a build is for, as people search it: "leveling", "raid", "dungeon", "tank", "healing", "PvP". */
export const KIND_WORD: Record<Build['kind'], string> = { leveling: 'leveling', raid: 'raid', dungeon: 'dungeon', tank: 'tank', heal: 'healing', pvp: 'PvP' };

/** The role a PvE build plays; empty for leveling and PvP builds, whose group says it all. */
export const BUILD_ROLE: Record<Build['kind'], string> = { leveling: '', pvp: '', raid: 'DPS', dungeon: 'Dungeons', tank: 'Tank', heal: 'Healer' };

/** The role to show next to a PvE build's name, unless the name already says it ("Holy healer", "Protection tank"). */
export function roleTag(b: Pick<Build, 'kind' | 'name'>) {
  const role = BUILD_ROLE[b.kind];
  return role && !b.name.toLowerCase().includes(role.toLowerCase()) ? role : '';
}

/** A build's kind in words, for a card: "Leveling", "PvE tank", "PvP". */
export function buildKindLabel(kind: Build['kind']) {
  const g = BUILD_GROUPS.find((x) => x.key === buildGroup(kind))!.label;
  const role = BUILD_ROLE[kind];
  return role ? `${g} ${role === 'DPS' ? role : role.toLowerCase()}` : g;
}

export interface BuildGroup {
  key: BuildGroupKey;
  label: string;
  /** The build to show first: the one marked pick in the data, else the first listed. */
  top: Build;
  /** The rest of the group, in the data's order. */
  rest: Build[];
}

/** A class's builds in their three groups, Leveling, PvE and PvP, leaving out a group with no build. */
export function groupBuilds(builds: Build[]): BuildGroup[] {
  const out: BuildGroup[] = [];
  for (const g of BUILD_GROUPS) {
    const list = builds.filter((b) => buildGroup(b.kind) === g.key);
    if (!list.length) continue;
    const top = list.find((b) => b.pick) ?? list[0];
    out.push({ ...g, top, rest: list.filter((b) => b !== top) });
  }
  return out;
}
