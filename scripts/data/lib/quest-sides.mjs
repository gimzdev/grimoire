/* The side a quest is for, as players meet it.
 *
 * Classic opens most quests to every race (side 3), but whoever gives one is often hostile to the other faction: the
 * quests of Ragefire Chasm are given in Orgrimmar. So a quest open to both counts for one side when whoever gives it is
 * friendly to that side only; else whoever takes it (a quest that starts at a corpse and ends in Thunder Bluff); else
 * the quest before it. A quest whose people are friendly to both stays both. The routes keep the game's own side
 * (q.s); pages and the add-on show this one (q.fs, set only where it says more than q.s).
 */

/** quest id -> 1 (Alliance) or 2 (Horde), for the quests open to both whose people are one side's. */
export function questSides(world) {
  const byId = new Map(world.quests.map((q) => [q.i, q]));
  const npcSide = (id) => {
    const react = id > 0 ? world.npcs[id]?.[5] : null;
    if (!react) return 3;
    const a = react[0] !== 'h';
    const h = react[1] !== 'h';
    return a && h ? 3 : a ? 1 : h ? 2 : 3;
  };
  const npcOf = (list) => (list ?? []).find(([k]) => k === 'n')?.[1] ?? 0;
  const memo = new Map();
  const sideOf = (q, depth = 0) => {
    if (q.s === 1 || q.s === 2) return q.s;
    if (memo.has(q.i)) return memo.get(q.i);
    let side = npcSide(npcOf(q.st));
    if (side === 3) side = npcSide(npcOf(q.en));
    if (side === 3 && q.pv && depth < 5) {
      const before = byId.get(Math.abs(q.pv));
      if (before) side = sideOf(before, depth + 1);
    }
    memo.set(q.i, side);
    return side;
  };
  const out = new Map();
  for (const q of world.quests) {
    if (q.s === 1 || q.s === 2) continue;
    const side = sideOf(q);
    if (side === 1 || side === 2) out.set(q.i, side);
  }
  return out;
}
