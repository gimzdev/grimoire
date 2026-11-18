// Grimoire's builds: written by name in scripts/data/static/builds.json (the talents in the order the points go in),
// encoded here against the current trees. A point that is not legal yet waits and is tried again after every point placed, so each
// lands at the first level it can; anything that no longer fits, or had to be reordered, is reported.
//
// A build is { id, cls, spec, name, kind, summary, notes, order, next?, pick?, checked, build, confidence, sources, for,
// lateCapstone?, why? }: kind leveling | raid | tank | heal | pvp | dungeon, which the site shows in three groups, Leveling, PvE (raid,
// tank, heal and dungeon) and PvP. pick 1 marks the build listed first in a group for its class (always one for leveling);
// nothing labels it, it only sets the order. checked, build, confidence, sources and for are its evidence (lib/builds-lint.mjs
// says what each means). next { id, at } is a respec: at level at, players of this build respec into the build id, whose first
// at - 9 points are then spent at once and the rest one a level. lateCapstone and why are for the lint only and are not
// written out. The result adds code (one digit per talent, tree by tree), order (the point order as letters of the class's
// talents) and points (per tree).

const ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
import { lintBuilds } from './builds-lint.mjs';

const KINDS = new Set(['leveling', 'raid', 'tank', 'heal', 'pvp', 'dungeon']);
const sortedTalents = (tree) => [...tree.talents].sort((a, b) => a.row - b.row || a.col - b.col);
// The group the site shows a kind in (src/lib/build-groups.ts).
export const GROUP = (kind) => (kind === 'leveling' ? 'leveling' : kind === 'pvp' ? 'PvP' : 'PvE');

function addBlock(ranks, talent, tree) {
  const rank = ranks[talent.id] ?? 0;
  if (rank >= talent.max) return 'max';
  const total = Object.values(ranks).reduce((n, v) => n + v, 0);
  if (total >= 51) return 'points';
  let below = 0;
  for (const t of tree.talents) if (t.row < talent.row) below += ranks[t.id] ?? 0;
  if (below < talent.row * 5) return 'tier';
  if (talent.req && (ranks[talent.req.id] ?? 0) < talent.req.qty) return 'prereq';
  return null;
}

/**
 * @param staticBuilds scripts/data/static/builds.json
 * @param talents data/talents.json (class -> { trees })
 * @returns { builds, problems }
 */
export function buildBuilds(staticBuilds, talents) {
  const problems = [];
  const ids = new Set();
  const builds = staticBuilds.map((b) => {
    if (ids.has(b.id)) problems.push(`${b.id}: listed twice`);
    ids.add(b.id);
    if (!KINDS.has(b.kind)) problems.push(`${b.id}: kind ${b.kind} is none of ${[...KINDS].join(', ')}`);
    if (!b.notes?.length) problems.push(`${b.id}: no notes`);
    const trees = talents[b.cls].trees;
    if (!trees.some((t) => t.slug === b.spec)) problems.push(`${b.id}: ${b.spec} is not a tree of ${b.cls}`);
    const byName = new Map();
    trees.forEach((tree) => tree.talents.forEach((t) => byName.set(t.name, { t, tree })));
    const all0 = new Map(trees.flatMap((tree) => tree.talents.map((t) => [t.id, t.name])));
    const ranks = {};
    const kept = [];
    const missing = new Set();
    const waiting = [];
    const place = (name) => {
      const hit = byName.get(name);
      if (addBlock(ranks, hit.t, hit.tree) !== null) return false;
      ranks[hit.t.id] = (ranks[hit.t.id] ?? 0) + 1;
      kept.push(hit.t.id);
      return true;
    };
    const drain = () => {
      for (let i = 0; i < waiting.length; ) {
        if (place(waiting[i])) {
          waiting.splice(i, 1);
          i = 0;
        } else i++;
      }
    };
    for (const name of b.order) {
      if (!byName.has(name)) {
        missing.add(name);
        continue;
      }
      if (place(name)) drain();
      else waiting.push(name);
    }
    drain();
    const pending = waiting;
    const spent = kept.length;
    const replayed = kept.map((id) => all0.get(id));
    const reordered = !missing.size && !pending.length && replayed.some((n, i) => n !== b.order[i]);
    if (missing.size || spent !== b.order.length || spent !== 51 || reordered)
      problems.push(
        `${b.id}: ${spent}/${b.order.length} points${missing.size ? `, not in the trees: ${[...missing].join(', ')}` : ''}${pending.length ? `, could not place: ${[...new Set(pending)].join(', ')}` : ''}${reordered ? ', placed in a different order than written (a point was not legal yet)' : ''}`,
      );
    const all = trees.flatMap(sortedTalents);
    const index = new Map(all.map((t, i) => [t.id, i]));
    const code = trees
      .map((tree) => sortedTalents(tree).map((t) => String(Math.min(9, ranks[t.id] ?? 0))).join('').replace(/0+$/, ''))
      .join('-')
      .replace(/-+$/, '');
    const { order, why, lateCapstone, ...rest } = b;
    void order, why, lateCapstone;
    return {
      ...rest,
      code,
      order: kept.map((id) => ALPHABET[index.get(id)]).join(''),
      points: trees.map((tree) => tree.talents.reduce((n, t) => n + (ranks[t.id] ?? 0), 0)),
    };
  });
  // one build listed first per class in each group at most: Leveling, PvE (raid, tank, heal, dungeon) and PvP
  const picks = new Map();
  for (const b of builds) {
    if (!b.pick) continue;
    const k = `${b.cls} ${GROUP(b.kind)}`;
    picks.set(k, (picks.get(k) ?? 0) + 1);
  }
  for (const [k, n] of picks) if (n > 1) problems.push(`${k.split(' ')[0]}: ${n} ${k.split(' ')[1]} builds are marked as the pick`);
  problems.push(...lintBuilds(staticBuilds, talents));
  return { builds, problems };
}
