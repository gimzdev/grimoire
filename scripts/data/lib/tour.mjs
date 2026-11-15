// The order of the work in a zone: a short path through tasks that come with an order of their own.
//
// A task is something to do at one of a few places (a quest giver, the camps where an objective can be done, the one
// who takes the quest back) and some tasks have to come after others (take a quest, do its objectives, hand it in).
// The path starts where the character stands and ends wherever its last task is, drawn a little toward where the work
// goes on afterwards (the `end` point, when there is one: half its distance counts), so that a far task is not left
// for last only to walk back from it. It is built by cheapest insertion, then improved by moving runs of one to three
// tasks to a better place on the path, by taking out all the tasks of one quest and putting them back where they fit
// best (a quest taken on the way out and handed in at the far end of it), and by choosing, for each task, the place
// that suits its neighbours, until none helps. New tasks (a quest that opens on the way) are inserted into the path
// there is, so the order stays steady from one decision to the next.

const END_WEIGHT = 0.5;

/**
 * @param {(a, b) => number} cost the cost of going from one point to another
 */
export function createTour(cost) {
  /** @type {string[]} */
  let order = [];
  /** @type {Map<string, { pts: object[], pre: Set<string>, post: Set<string>, group: string }>} */
  const tasks = new Map();
  /** @type {Map<string, number>} the place chosen for each task */
  const choice = new Map();
  let start = null;
  let end = null;

  const at = (key) => tasks.get(key).pts[choice.get(key) ?? 0];
  // A leg to `null` is the path's end: free, or half the way on to the end point.
  const leg = (a, b) => (a && b ? cost(a, b) : a && end ? END_WEIGHT * cost(a, end) : 0);
  const pointBefore = (k) => (k > 0 ? at(order[k - 1]) : start);

  /** The cheapest place on the path for a task (and its point): { k, p, delta } with k the index it goes in at. */
  function bestSpot(key, lo, hi) {
    const t = tasks.get(key);
    let best = null;
    for (let k = lo; k <= hi; k++) {
      const a = pointBefore(k);
      const b = k < order.length ? at(order[k]) : null;
      const base = leg(a, b);
      for (let p = 0; p < t.pts.length; p++) {
        const delta = leg(a, t.pts[p]) + leg(t.pts[p], b) - base;
        if (!best || delta < best.delta - 1e-9) best = { k, p, delta };
      }
    }
    return best;
  }

  /** The range of indexes a task may be inserted at, given the tasks already on the path. */
  function window(key) {
    const t = tasks.get(key);
    let lo = 0;
    let hi = order.length;
    order.forEach((other, i) => {
      if (t.pre.has(other)) lo = Math.max(lo, i + 1);
      if (t.post.has(other)) hi = Math.min(hi, i);
    });
    return lo <= hi ? [lo, hi] : null;
  }

  function insertAll(keys) {
    const waiting = new Set(keys);
    while (waiting.size) {
      let best = null;
      for (const key of waiting) {
        const t = tasks.get(key);
        // A task goes in once everything it waits for is on the path (or is not a task at all).
        if ([...t.pre].some((p) => waiting.has(p))) continue;
        const w = window(key);
        if (!w) continue;
        const spot = bestSpot(key, w[0], w[1]);
        if (spot && (!best || spot.delta < best.delta)) best = { key, ...spot };
      }
      if (!best) {
        // Orders that cannot be met (a cycle in the data): what is left goes at the end, in any order.
        for (const key of waiting) {
          order.push(key);
          choice.set(key, 0);
        }
        break;
      }
      order.splice(best.k, 0, best.key);
      choice.set(best.key, best.p);
      waiting.delete(best.key);
    }
  }

  /** Total cost of the path. */
  function total() {
    let c = 0;
    let prev = start;
    for (const key of order) {
      const p = at(key);
      c += leg(prev, p);
      prev = p;
    }
    return c + leg(prev, null);
  }

  /** Is every task after all it waits for? */
  function valid() {
    const pos = new Map(order.map((k, i) => [k, i]));
    return order.every((k, i) => [...tasks.get(k).pre].every((p) => !pos.has(p) || pos.get(p) < i));
  }

  /** Takes out all the tasks of one group (a quest's) and puts them back where they fit best; true when better. */
  function reinsertGroups() {
    const groups = new Map();
    for (const key of order) {
      const g = tasks.get(key).group;
      if (!groups.has(g)) groups.set(g, []);
      groups.get(g).push(key);
    }
    let better = false;
    for (const keys of groups.values()) {
      if (keys.length < 2) continue;
      const before = total();
      const saved = order;
      const savedChoice = new Map(choice);
      const out = new Set(keys);
      order = order.filter((k) => !out.has(k));
      insertAll(keys);
      if (total() < before - 1e-6 && valid()) better = true;
      else {
        order = saved;
        choice.clear();
        for (const [k, v] of savedChoice) choice.set(k, v);
      }
    }
    return better;
  }

  /** Moves a run of tasks elsewhere when that shortens the path; true when something moved. */
  function orOpt() {
    const pos = new Map(order.map((k, i) => [k, i]));
    for (let len = 1; len <= 3; len++) {
      for (let i = 0; i + len <= order.length; i++) {
        const run = order.slice(i, i + len);
        const inRun = new Set(run);
        // Where the run may go: after everything its tasks wait for, before everything that waits for them.
        let lo = 0;
        let hi = order.length;
        for (const key of run) {
          const t = tasks.get(key);
          for (const p of t.pre) if (!inRun.has(p) && pos.has(p)) lo = Math.max(lo, pos.get(p) + 1);
          for (const s of t.post) if (!inRun.has(s) && pos.has(s)) hi = Math.min(hi, pos.get(s));
        }
        const first = at(run[0]);
        const last = at(run[len - 1]);
        const before = pointBefore(i);
        const after = i + len < order.length ? at(order[i + len]) : null;
        const gain = leg(before, first) + leg(last, after) - leg(before, after);
        if (gain <= 1e-6) continue;
        let best = null;
        // j: the index in the path without the run that the run goes in front of.
        for (let j = 0; j <= order.length - len; j++) {
          if (j === i) continue;
          // Back in the full path's indexes, to check the order window.
          const full = j < i ? j : j + len;
          if (full < lo || full > hi) continue;
          const a = j === 0 ? start : at(order[j - 1 < i ? j - 1 : j - 1 + len]);
          const bIndex = j < i ? j : j + len;
          const b = bIndex < order.length ? at(order[bIndex]) : null;
          const add = leg(a, first) + leg(last, b) - leg(a, b);
          if (add < gain - 1e-6 && (!best || add < best.add)) best = { j, add };
        }
        if (best) {
          const rest = order.slice(0, i).concat(order.slice(i + len));
          rest.splice(best.j, 0, ...run);
          order = rest;
          return true;
        }
      }
    }
    return false;
  }

  /** Picks, for each task with several places, the one that suits its neighbours; true when one changed. */
  function choosePlaces() {
    let changed = false;
    for (let k = 0; k < order.length; k++) {
      const key = order[k];
      const t = tasks.get(key);
      if (t.pts.length < 2) continue;
      const a = pointBefore(k);
      const b = k + 1 < order.length ? at(order[k + 1]) : null;
      let best = choice.get(key) ?? 0;
      let bestCost = leg(a, t.pts[best]) + leg(t.pts[best], b);
      for (let p = 0; p < t.pts.length; p++) {
        const c = leg(a, t.pts[p]) + leg(t.pts[p], b);
        if (c < bestCost - 1e-6) {
          best = p;
          bestCost = c;
        }
      }
      if (best !== (choice.get(key) ?? 0)) {
        choice.set(key, best);
        changed = true;
      }
    }
    return changed;
  }

  function improve(limit = 200) {
    for (let round = 0; round < limit; round++) {
      const moved = orOpt();
      const placed = choosePlaces();
      if (moved || placed) continue;
      if (!reinsertGroups()) break;
    }
  }

  return {
    /**
     * Brings the path up to date with the tasks there are now, from where the character stands: tasks that are gone
     * leave it, new ones are inserted, and the path is improved. `list` maps a key to { pts, pre: [keys], group }
     * (tasks of one group move together in the improving); `end`: where the work goes on after the path, or null.
     */
    sync(from, list, { fresh = false, end: endPoint = null } = {}) {
      start = from;
      end = endPoint;
      const keys = new Set(list.keys());
      if (fresh) order = [];
      order = order.filter((k) => keys.has(k));
      // A task whose places changed is taken out and inserted again.
      for (const [key, t] of list) {
        const old = tasks.get(key);
        if (old && (old.pts.length !== t.pts.length || old.pts.some((p, i) => p !== t.pts[i]))) order = order.filter((k) => k !== key);
      }
      tasks.clear();
      for (const [key, t] of list) tasks.set(key, { pts: t.pts, pre: new Set(t.pre.filter((p) => keys.has(p))), post: new Set(), group: t.group ?? key });
      for (const [key, t] of tasks) for (const p of t.pre) tasks.get(p).post.add(key);
      for (const key of [...choice.keys()]) if (!keys.has(key)) choice.delete(key);
      const on = new Set(order);
      // Tasks already on the path keep their order only where it still holds; a broken order is rebuilt.
      const pos = new Map(order.map((k, i) => [k, i]));
      const broken = order.some((k) => [...tasks.get(k).pre].some((p) => pos.has(p) && pos.get(p) > pos.get(k)));
      if (broken) {
        order = [];
        on.clear();
      }
      const fresh2 = [...keys].filter((k) => !on.has(k));
      if (fresh2.length) insertAll(fresh2);
      improve();
      return order.map((key) => ({ key, p: at(key) }));
    },
    total,
    get order() {
      return order.map((key) => ({ key, p: at(key) }));
    },
  };
}
