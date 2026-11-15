// A build's respec (data/builds.json, next: { id, at }): at level at, its players respec into another build of the class,
// whose first at - 9 points are then spent at once and the rest one a level. The prices are the ones
// content/guides/talents-overview.md gives: players report 1 gold for the first reset, then 5, rising to 50 at most;
// Secondary Talents open at 40 for 50 gold.
import { KIND_WORD } from './build-groups';
import type { Build } from './types';

/** The build a respec goes into, as the line names it: "Shadow leveling", "Affliction raid". */
export const respecName = (b: Pick<Build, 'name' | 'kind'>) => `${b.name} ${KIND_WORD[b.kind]}`;

/** What the respec costs, after "At 40, respec into Shadow leveling: ". Secondary Talents only from 40, when they open. */
export const respecCost = (at: number) =>
  `1 gold if it is your first reset, 5 if it is your second, never more than 50.${at >= 40 ? ` Or buy Secondary Talents${at === 40 ? ' at 40' : ''} for 50 gold and keep both.` : ''}`;

/**
 * The build a player who follows b has at a level: b, or the build it respecs into once that level has come, and on through
 * that build's own respec. at is the level of the last respec on the way (none: b itself). The build has its first
 * level - 9 points there, as its own order says.
 */
export function pathAt<T extends Pick<Build, 'id' | 'next'>>(b: T, level: number, builds: T[]): { build: T; at?: number } {
  const n = b.next && level >= b.next.at ? builds.find((x) => x.id === b.next!.id) : undefined;
  if (!n) return { build: b };
  const on = pathAt(n, level, builds);
  return { build: on.build, at: on.at ?? b.next!.at };
}
