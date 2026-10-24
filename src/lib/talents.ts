/**
 * Talent rules shared by the calculator, the build pages and the data checks.
 * Ranks are kept as { talentId: rank }. Builds encode as one digit per talent, tree by tree in (row, col)
 * order, trailing zeros trimmed, trees joined with "-": the same shape the classic calculators used.
 */

export interface RuleTalent {
  id: number;
  row: number;
  col: number;
  max: number;
  req?: { id: number; qty: number };
}
export interface RuleTree {
  id: number;
  talents: RuleTalent[];
}
export type Ranks = Record<number, number>;

export const MAX_POINTS = 51;
const ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';

export function sortedTalents(tree: RuleTree) {
  return [...tree.talents].sort((a, b) => a.row - b.row || a.col - b.col);
}

export function treePoints(tree: RuleTree, ranks: Ranks) {
  let n = 0;
  for (const t of tree.talents) n += ranks[t.id] ?? 0;
  return n;
}

export function totalPoints(trees: RuleTree[], ranks: Ranks) {
  return trees.reduce((n, t) => n + treePoints(t, ranks), 0);
}

/** Points spent in rows above (lower index than) `row` of this tree. */
export function pointsBelowRow(tree: RuleTree, ranks: Ranks, row: number) {
  let n = 0;
  for (const t of tree.talents) if (t.row < row) n += ranks[t.id] ?? 0;
  return n;
}

export function findTalent(trees: RuleTree[], id: number): { tree: RuleTree; talent: RuleTalent } | null {
  for (const tree of trees) {
    const talent = tree.talents.find((t) => t.id === id);
    if (talent) return { tree, talent };
  }
  return null;
}

export type BlockReason = 'max' | 'points' | 'tier' | 'prereq' | null;

/** Why a point cannot be added right now (null when it can). */
export function addBlock(trees: RuleTree[], ranks: Ranks, id: number, maxPoints = MAX_POINTS): BlockReason {
  const found = findTalent(trees, id);
  if (!found) return 'max';
  const { tree, talent } = found;
  const rank = ranks[id] ?? 0;
  if (rank >= talent.max) return 'max';
  if (totalPoints(trees, ranks) >= maxPoints) return 'points';
  if (pointsBelowRow(tree, ranks, talent.row) < talent.row * 5) return 'tier';
  if (talent.req && (ranks[talent.req.id] ?? 0) < talent.req.qty) return 'prereq';
  return null;
}

/** A talent is "reachable" when its tier is open and its prerequisite is met (ignores the point cap). */
export function isReachable(trees: RuleTree[], ranks: Ranks, id: number) {
  const block = addBlock(trees, ranks, id, Number.POSITIVE_INFINITY);
  return block === null || block === 'max';
}

export function canRemove(trees: RuleTree[], ranks: Ranks, id: number): boolean {
  const found = findTalent(trees, id);
  if (!found) return false;
  const { tree, talent } = found;
  const rank = ranks[id] ?? 0;
  if (rank <= 0) return false;
  const next = { ...ranks, [id]: rank - 1 };
  // Dependants keep their prerequisite.
  for (const t of tree.talents) {
    if ((next[t.id] ?? 0) > 0 && t.req && t.req.id === id && (next[id] ?? 0) < t.req.qty) return false;
  }
  // Every row that still has points keeps its tier requirement.
  for (const t of tree.talents) {
    if ((next[t.id] ?? 0) > 0 && t.row > 0 && pointsBelowRow(tree, next, t.row) < t.row * 5) return false;
  }
  void talent;
  return true;
}

export function encodeBuild(trees: RuleTree[], ranks: Ranks): string {
  return trees
    .map((tree) => {
      const s = sortedTalents(tree)
        .map((t) => String(Math.min(9, ranks[t.id] ?? 0)))
        .join('');
      return s.replace(/0+$/, '');
    })
    .join('-')
    .replace(/-+$/, '');
}

/** Decodes a build string; invalid ranks are clamped and the result is replayed through the rules. */
export function decodeBuild(trees: RuleTree[], code: string | null | undefined): Ranks {
  const ranks: Ranks = {};
  if (!code) return ranks;
  const parts = code.replace(/[^0-9-]/g, '').split('-');
  trees.forEach((tree, i) => {
    const digits = parts[i] ?? '';
    sortedTalents(tree).forEach((t, j) => {
      const v = Number(digits[j] ?? 0);
      if (v > 0) ranks[t.id] = Math.min(v, t.max);
    });
  });
  return legalize(trees, ranks);
}

/** Rebuilds a rank map point by point in tier order so the result always obeys the rules. */
export function legalize(trees: RuleTree[], wanted: Ranks, maxPoints = MAX_POINTS): Ranks {
  const out: Ranks = {};
  for (const tree of trees) {
    let progress = true;
    while (progress) {
      progress = false;
      for (const t of sortedTalents(tree)) {
        while ((out[t.id] ?? 0) < (wanted[t.id] ?? 0) && addBlock(trees, out, t.id, maxPoints) === null) {
          out[t.id] = (out[t.id] ?? 0) + 1;
          progress = true;
        }
      }
    }
  }
  return out;
}

export function allTalents(trees: RuleTree[]) {
  return trees.flatMap((t) => sortedTalents(t));
}

export function encodeOrder(trees: RuleTree[], order: number[]): string {
  const list = allTalents(trees);
  const index = new Map(list.map((t, i) => [t.id, i]));
  return order.map((id) => ALPHABET[index.get(id) ?? 0]).join('');
}

export function decodeOrder(trees: RuleTree[], code: string | null | undefined): number[] {
  if (!code) return [];
  const list = allTalents(trees);
  const out: number[] = [];
  for (const ch of code) {
    const i = ALPHABET.indexOf(ch);
    if (i >= 0 && i < list.length) out.push(list[i].id);
  }
  return out;
}

/** Replays a point order; returns the ranks it produces (illegal steps are skipped). */
export function ranksFromOrder(trees: RuleTree[], order: number[]): { ranks: Ranks; order: number[] } {
  const ranks: Ranks = {};
  const kept: number[] = [];
  for (const id of order) {
    if (addBlock(trees, ranks, id) === null) {
      ranks[id] = (ranks[id] ?? 0) + 1;
      kept.push(id);
    }
  }
  return { ranks, order: kept };
}

/**
 * The point order without the point at `index`, replayed. A later point that loses its footing on the way (a deeper talent
 * that needed it, say) is put back at the end as soon as it is legal again, so the ranks and the order always tell the same build.
 */
export function orderWithout(trees: RuleTree[], order: number[], index: number): { ranks: Ranks; order: number[] } {
  const rest = [...order.slice(0, index), ...order.slice(index + 1)];
  const { ranks, order: kept } = ranksFromOrder(trees, rest);
  const left = new Map<number, number>();
  for (const id of kept) left.set(id, (left.get(id) ?? 0) + 1);
  const skipped: number[] = [];
  for (const id of rest) {
    const n = left.get(id) ?? 0;
    if (n > 0) left.set(id, n - 1);
    else skipped.push(id);
  }
  for (let again = true; again && skipped.length; ) {
    again = false;
    const i = skipped.findIndex((id) => addBlock(trees, ranks, id) === null);
    if (i >= 0) {
      const [id] = skipped.splice(i, 1);
      ranks[id] = (ranks[id] ?? 0) + 1;
      kept.push(id);
      again = true;
    }
  }
  return { ranks, order: kept };
}

/** A legal order for a rank map (tree by tree, top to bottom) when none was recorded. */
export function defaultOrder(trees: RuleTree[], ranks: Ranks): number[] {
  const order: number[] = [];
  const cur: Ranks = {};
  let progress = true;
  while (progress) {
    progress = false;
    for (const tree of trees) {
      for (const t of sortedTalents(tree)) {
        if ((cur[t.id] ?? 0) < (ranks[t.id] ?? 0) && addBlock(trees, cur, t.id) === null) {
          cur[t.id] = (cur[t.id] ?? 0) + 1;
          order.push(t.id);
          progress = true;
        }
      }
    }
  }
  return order;
}

export function requiredLevel(points: number, talented = false) {
  if (points <= 0) return talented ? 5 : 10;
  return Math.max(talented ? 5 : 10, points + 9 - (talented ? 5 : 0));
}

export function splitSummary(trees: RuleTree[], ranks: Ranks): [number, number, number] {
  const p = trees.map((t) => treePoints(t, ranks));
  return [p[0] ?? 0, p[1] ?? 0, p[2] ?? 0];
}
