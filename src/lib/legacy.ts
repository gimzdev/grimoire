/**
 * Legacy rules shared by the planner and its checks.
 *
 * Perks: one point per rank, up to the per-character cap. A perk with a gate opens once its tree has that many points
 * in perks with a lower gate (the perks before it), and a perk with a prerequisite needs that perk at full rank, the way
 * talent tiers and arrows work. A plan is the order its points were spent in; ranks are replayed from it.
 *
 * Challenges: some come in ladders (a level 60 character reached 25 and 45 first), so ticking a step ticks the steps
 * before it and clearing one clears the steps after it.
 */
import type { LegacyChallenge, LegacyPerk, LegacyTree } from './types';

export type PerkRanks = Record<string, number>;
export type PerkBlock = 'max' | 'points' | 'gate' | 'req' | null;

export function findPerk(trees: LegacyTree[], id: string): { tree: LegacyTree; perk: LegacyPerk } | null {
  for (const tree of trees) {
    const perk = tree.perks.find((p) => p.id === id);
    if (perk) return { tree, perk };
  }
  return null;
}

export function treeSpent(tree: LegacyTree, ranks: PerkRanks) {
  let n = 0;
  for (const p of tree.perks) n += ranks[p.id] ?? 0;
  return n;
}

export function totalSpent(trees: LegacyTree[], ranks: PerkRanks) {
  return trees.reduce((n, t) => n + treeSpent(t, ranks), 0);
}

/** Points in this tree's perks with a lower gate: what opens a perk with `gate`. */
export function pointsBelowGate(tree: LegacyTree, ranks: PerkRanks, gate: number) {
  let n = 0;
  for (const p of tree.perks) if (p.gate < gate) n += ranks[p.id] ?? 0;
  return n;
}

export function gateMet(tree: LegacyTree, ranks: PerkRanks, perk: LegacyPerk) {
  return perk.gate <= 0 || pointsBelowGate(tree, ranks, perk.gate) >= perk.gate;
}

export function reqMet(tree: LegacyTree, ranks: PerkRanks, perk: LegacyPerk) {
  if (!perk.req) return true;
  const req = tree.perks.find((p) => p.id === perk.req);
  return !req || (ranks[req.id] ?? 0) >= req.max;
}

/** Why a point cannot go into this perk right now (null when it can). */
export function perkBlock(trees: LegacyTree[], ranks: PerkRanks, id: string, cap: number): PerkBlock {
  const found = findPerk(trees, id);
  if (!found) return 'max';
  const { tree, perk } = found;
  if ((ranks[id] ?? 0) >= perk.max) return 'max';
  if (totalSpent(trees, ranks) >= cap) return 'points';
  if (!gateMet(tree, ranks, perk)) return 'gate';
  if (!reqMet(tree, ranks, perk)) return 'req';
  return null;
}

/** Open to points: its gate and prerequisite are met (full ranks and the cap aside). */
export function perkOpen(trees: LegacyTree[], ranks: PerkRanks, id: string) {
  const block = perkBlock(trees, ranks, id, Number.POSITIVE_INFINITY);
  return block === null || block === 'max';
}

/** A point can come out of this perk without leaving another perk's gate or prerequisite unmet. */
export function perkCanRemove(trees: LegacyTree[], ranks: PerkRanks, id: string) {
  const found = findPerk(trees, id);
  if (!found || (ranks[id] ?? 0) <= 0) return false;
  const { tree } = found;
  const next = { ...ranks, [id]: (ranks[id] ?? 0) - 1 };
  for (const p of tree.perks) {
    if ((next[p.id] ?? 0) <= 0) continue;
    if (!gateMet(tree, next, p) || !reqMet(tree, next, p)) return false;
  }
  return true;
}

/** Replays a plan point by point; points that are not legal at their turn are left out. */
export function ranksFromOrder(trees: LegacyTree[], order: string[], cap: number): { ranks: PerkRanks; order: string[] } {
  const ranks: PerkRanks = {};
  const kept: string[] = [];
  for (const id of order) {
    if (perkBlock(trees, ranks, id, cap) === null) {
      ranks[id] = (ranks[id] ?? 0) + 1;
      kept.push(id);
    }
  }
  return { ranks, order: kept };
}

/**
 * The plan without its point at `index`. A later point that loses its footing goes back in at the end as soon as it is
 * legal again, so the ranks and the order always describe the same plan.
 */
export function orderWithout(trees: LegacyTree[], order: string[], index: number, cap: number): { ranks: PerkRanks; order: string[] } {
  const rest = [...order.slice(0, index), ...order.slice(index + 1)];
  const { ranks, order: kept } = ranksFromOrder(trees, rest, cap);
  const left = new Map<string, number>();
  for (const id of kept) left.set(id, (left.get(id) ?? 0) + 1);
  const skipped: string[] = [];
  for (const id of rest) {
    const n = left.get(id) ?? 0;
    if (n > 0) left.set(id, n - 1);
    else skipped.push(id);
  }
  for (let again = true; again && skipped.length; ) {
    again = false;
    const i = skipped.findIndex((id) => perkBlock(trees, ranks, id, cap) === null);
    if (i >= 0) {
      const [id] = skipped.splice(i, 1);
      ranks[id] = (ranks[id] ?? 0) + 1;
      kept.push(id);
      again = true;
    }
  }
  return { ranks, order: kept };
}

/** A plan as one character per point, in the order spent. */
export function encodePlan(trees: LegacyTree[], order: string[]) {
  const code = new Map(trees.flatMap((t) => t.perks.map((p) => [p.id, p.code] as const)));
  return order.map((id) => code.get(id) ?? '').join('');
}

export function decodePlan(trees: LegacyTree[], text: string | null | undefined): string[] {
  if (!text) return [];
  const byCode = new Map(trees.flatMap((t) => t.perks.map((p) => [p.code, p.id] as const)));
  const out: string[] = [];
  for (const ch of text.slice(0, 64)) {
    const id = byCode.get(ch);
    if (id) out.push(id);
  }
  return out;
}

/** Ticks or clears one challenge; on a ladder the steps before it come along when ticking, the steps after it when clearing. */
export function toggleChallenge(challenges: LegacyChallenge[], done: ReadonlySet<string>, key: string): Set<string> {
  const next = new Set(done);
  const c = challenges.find((x) => x.key === key);
  if (!c) return next;
  const on = !done.has(key);
  if (!c.ladder) {
    if (on) next.add(key);
    else next.delete(key);
    return next;
  }
  for (const x of challenges) {
    if (x.ladder !== c.ladder) continue;
    if (on && (x.step ?? 0) <= (c.step ?? 0)) next.add(x.key);
    if (!on && (x.step ?? 0) >= (c.step ?? 0)) next.delete(x.key);
  }
  return next;
}

/** Known challenge keys only, with every ladder filled in below its highest step. */
export function normalizeDone(challenges: LegacyChallenge[], keys: Iterable<string>): Set<string> {
  const known = new Map(challenges.map((c) => [c.key, c]));
  const out = new Set<string>();
  const top = new Map<string, number>();
  for (const k of keys) {
    const c = known.get(k);
    if (!c) continue;
    out.add(k);
    if (c.ladder) top.set(c.ladder, Math.max(top.get(c.ladder) ?? -1, c.step ?? 0));
  }
  for (const c of challenges) if (c.ladder && (c.step ?? 0) <= (top.get(c.ladder) ?? -1)) out.add(c.key);
  return out;
}

export function pointsEarned(challenges: LegacyChallenge[], done: ReadonlySet<string>) {
  return challenges.reduce((n, c) => n + (done.has(c.key) ? c.points : 0), 0);
}
