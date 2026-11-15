// Checks Grimoire's builds for what made them weak in 1.0.5: no evidence, notes that no longer match the order, words
// about a beta that ended on 23 October, and leveling points spent on utility without a reason. builds.mjs runs it (its
// problems are "Builds to check"), and so do the release checks.
//
// A build in scripts/data/static/builds.json carries its evidence:
//   checked     the day it was checked (YYYY-MM-DD)          build       the client build it was checked on
//   confidence  live (played or measured at those levels by the sources), consensus (two guides make the same main
//               choices and our arithmetic agrees) or theory (our arithmetic, which no guide confirms point for
//               point; every PvP build until there is evidence at 60)
//   sources     [{ name, url, date }] shown as "compare with", never copied
//   for         one line: who should pick it
// and, where it needs them:
//   lateCapstone  why a leveling build takes its tree's last talent after level 40
//   why           { talent: reason } for a talent of its class's "needs a reason" list taken before 40 while leveling
//   next          { id, at }: the respec its players make at level at into another build of the class (lib/builds.mjs).
//                 A leveling build whose note says it is N points from its PvE build, N above 0, respecs into that build
//                 at 60, and the note's N is the distance; one 0 points away has none

export const CONFIDENCE = ['live', 'consensus', 'theory'];

/** Pure utility and PvP picks: a leveling build that takes one before 40 says why (extend as the trees change). */
export const NEEDS_REASON = {
  warlock: ['Amplify Curse', 'Curse of Exhaustion', 'Grim Reach'],
  hunter: ['Improved Concussive Shot', 'Entrapment', 'Improved Wing Clip'],
  paladin: ['Unyielding Faith', 'Stoicism', 'Turn Evil', 'Eye for an Eye'],
  mage: ['Arcane Resilience', 'Magic Absorption', 'Frost Warding', 'Improved Counterspell', 'Arcane Shielding'],
  warrior: ['Iron Will', 'Improved Disarm', 'Improved Shield Bash', 'Improved Intercept'],
  shaman: ['Elemental Warding', 'Guardian Totems'],
  rogue: ['Improved Gouge', 'Master of Deception', 'Dirty Tricks', 'Quick Getaway', 'Improved Kick', 'Improved Kidney Shot'],
  priest: ['Silent Resolve', 'Martyrdom'],
  druid: ['Subtlety'],
};

const BANNED = [/\bbeta\b/i, /follows the trees/i, /not tested/i];
// A sentence that names a talent the build does not take is fine when it speaks of another build or a swap.
const ELSEWHERE = /\b(instead|PvE build|PvP build|leveling build|raid build|tank build|respec|move|moves|becomes|become|skip|skips|skipped|left out|leaves out|stay out|stays out|only helps|not|no|rather than|than|swap|trade|trades|without|other|another|replace|replaces|drop|drops|in place of|can take|could take|unless)\b/i;

const sentences = (text) => text.split(/(?<=[.!?])\s+(?=[A-Z])/);

/** Levels a quote names: "22", "10 to 14", "10-14", "10–14", "13, 14 and 24", "27 to 29, 33 and 34". */
function quotedLevels(q) {
  const out = [];
  for (const part of q.split(/,|\band\b/)) {
    const m = /^\s*(\d{1,2})(?:\s*(?:to|-|–)\s*(\d{1,2}))?\s*$/.exec(part);
    if (!m) return null;
    const a = Number(m[1]);
    const b = m[2] ? Number(m[2]) : a;
    if (a < 10 || b > 60 || b < a) return null;
    for (let l = a; l <= b; l++) out.push(l);
  }
  return out.length ? out : null;
}

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const count = (order) => order.reduce((m, n) => m.set(n, (m.get(n) ?? 0) + 1), new Map());
/** The points a build spends that another does not: what a respec from the first into the second moves. */
function distance(a, b) {
  const theirs = count(b.order);
  let d = 0;
  for (const [n, q] of count(a.order)) d += Math.max(0, q - (theirs.get(n) ?? 0));
  return d;
}

/** The numbers of a build's "N points from the PvE build" sentences, each with the same-tree PvE builds it names. */
function pointsFromNotes(b, pve) {
  const out = [];
  for (const s of (b.notes ?? []).flatMap(sentences)) {
    const named = pve.filter((x) => new RegExp(`${escape(x.name)} (?:tank |raid |healing )?build\\b`).test(s));
    if (!/\b(PvE|tank|raid|healing) build\b/.test(s) && !named.length) continue;
    for (const m of s.matchAll(/\b(\d+) points? (?:from|away)\b/g)) out.push({ n: Number(m[1]), named });
  }
  return out;
}

/**
 * @param staticBuilds scripts/data/static/builds.json
 * @param talents data/talents.json
 * @returns problems, one line each
 */
export function lintBuilds(staticBuilds, talents) {
  const problems = [];
  for (const b of staticBuilds) {
    const p = (msg) => problems.push(`${b.id}: ${msg}`);
    const trees = talents[b.cls]?.trees;
    if (!trees) continue;
    const all = trees.flatMap((tree) => tree.talents.map((t) => ({ ...t, tree })));
    const byName = new Map(all.map((t) => [t.name, t]));
    // the level each point is spent at: the first point at 10, one a level
    const levels = new Map();
    b.order.forEach((name, i) => {
      if (!levels.has(name)) levels.set(name, []);
      levels.get(name).push(10 + i);
    });

    // evidence
    if (!b.checked || !/^\d{4}-\d{2}-\d{2}$/.test(b.checked)) p('no checked date');
    if (!b.build) p('no client build');
    if (!CONFIDENCE.includes(b.confidence)) p(`confidence ${b.confidence ?? 'missing'} is none of ${CONFIDENCE.join(', ')}`);
    if (!b.for || typeof b.for !== 'string') p('no "for" line');
    if (b.kind === 'pvp' && b.confidence && b.confidence !== 'theory') p('a PvP build is theory until there is evidence at 60');
    if (b.confidence && b.confidence !== 'theory' && !(b.sources?.length >= 1)) p(`confidence ${b.confidence} with no sources`);
    if (b.confidence === 'consensus' && (b.sources ?? []).filter((s) => !/blizzard\.com/.test(s.url ?? '')).length < 2) p('confidence consensus needs two guides among its sources');
    for (const s of b.sources ?? []) if (!s.name || !/^https:\/\//.test(s.url ?? '') || (s.date && !/^\d{4}-\d{2}-\d{2}$/.test(s.date))) p(`source ${JSON.stringify(s)} needs a name, an https link and a YYYY-MM-DD date`);

    // words about what is unknown
    const texts = [b.summary, b.for, ...(b.notes ?? []), b.lateCapstone, ...Object.values(b.why ?? {})].filter(Boolean);
    for (const t of texts) for (const re of BANNED) if (re.test(t)) p(`says "${re.source.replace(/\\b/g, '')}": ${t.slice(0, 90)}…`);

    if (b.kind === 'leveling') {
      // the capstone by 40, or a reason
      // the tree's last row (Feral has two: Primal Bite for bears, Shifting Power for cats); the first one taken counts
      const spec = trees.find((tree) => tree.slug === b.spec);
      const last = spec?.talents.filter((t) => t.row === 6) ?? [];
      const taken = last.filter((t) => levels.has(t.name)).map((t) => [t.name, levels.get(t.name)[0]]).sort((x, y) => x[1] - y[1]);
      if (last.length && taken.length && taken[0][1] > 40 && !b.lateCapstone) p(`${taken[0][0]} comes at ${taken[0][1]}, after 40, with no lateCapstone reason`);
      if (last.length && !taken.length && !b.lateCapstone) p(`never takes ${last.map((t) => t.name).join(' or ')}, with no lateCapstone reason`);
      // utility before 40
      for (const name of NEEDS_REASON[b.cls] ?? []) {
        const at = levels.get(name)?.[0];
        if (at && at < 40 && !b.why?.[name]) p(`takes ${name} at ${at} while leveling, with no "why" for it`);
      }
    }
    for (const name of Object.keys(b.why ?? {})) if (!levels.has(name)) p(`has a "why" for ${name}, which it does not take`);

    // "N points from the PvE build": the number a note gives is the number of points the two orders differ by
    const pve = staticBuilds.filter((x) => x.cls === b.cls && x.spec === b.spec && x.kind !== 'leveling' && x.kind !== 'pvp');
    const said = b.kind === 'leveling' ? pointsFromNotes(b, pve) : [];
    const far = pve.map((x) => distance(b, x));
    for (const { n } of said) if (far.length && !far.includes(n)) p(`a note says ${n} points from the PvE build, the two orders differ by ${far.join(' or ')}`);

    // the respec: a build of the same class at a level from 11 to 60; one at 60 goes to the PvE build the note measures
    if (b.next !== undefined) {
      const { id, at } = b.next ?? {};
      const to = staticBuilds.find((x) => x.id === id);
      if (!to) p(`next ${id} is not a build`);
      else if (to === b || to.cls !== b.cls) p(`next ${id} must be another build of the ${b.cls}`);
      if (!Number.isInteger(at) || at < 11 || at > 60) p(`next at ${at} is not a level from 11 to 60`);
      if (to && at === 60) {
        const d = distance(b, to);
        const hits = said.filter((x) => x.named.includes(to) || !x.named.length).map((x) => x.n);
        if (d === 0) p(`next ${id} at 60 is 0 points away: there is nothing to respec`);
        else if (!hits.length) p(`next ${id} at 60, and no note says how many points it is from that build`);
        else if (!hits.includes(d)) p(`next ${id} at 60 is ${d} points away, the note says ${hits.join(' or ')}`);
      }
      // no cycle: following the respecs from here never comes back to a build already passed
      const seen = new Set([b.id]);
      for (let x = to; x; x = x.next && staticBuilds.find((y) => y.id === x.next.id)) {
        if (seen.has(x.id)) {
          p(`next goes round in a circle: ${[...seen, x.id].join(' -> ')}`);
          break;
        }
        seen.add(x.id);
      }
    } else if (said.some((x) => x.n > 0)) p(`a note says it is ${said.find((x) => x.n > 0).n} points from its PvE build, and it has no next: at 60 it respecs into that build`);

    // notes against the order
    for (const note of [b.summary, ...(b.notes ?? [])]) {
      for (const s of sentences(note)) {
        for (const t of all) {
          // a longer talent name that holds this one ("Improved Mind Flay" holds "Mind Flay") is that talent, not this one
          let s2 = s;
          for (const u of all) if (u !== t && u.name.includes(t.name)) s2 = s2.split(u.name).join('§');
          // the name as a name of its own: "Bane" is not the talent in "Bane of Agony"
          if (!new RegExp(`(^|[^\\w])${escape(t.name)}(?! of\\b)(?![\\w-])`).test(s2)) continue;
          const lv = levels.get(t.name);
          if (!lv) {
            if (!ELSEWHERE.test(s2)) p(`a note names ${t.name}, which the build does not take: "${s.slice(0, 100)}"`);
            continue;
          }
          const re = new RegExp(`${escape(t.name)}(?:’s|'s)?\\s*(?:\\((?:levels?\\s+)?([0-9][0-9 ,to\\-–and]*?)(?:[,;][^)]*)?\\)|(?:lands |comes |arrives |is taken )?at (\\d{2})\\b)`, 'g');
          for (const m of s2.matchAll(re)) {
            const quoted = quotedLevels(m[1] ?? m[2]);
            if (!quoted) continue;
            const wrong = quoted.filter((l) => !lv.includes(l));
            if (wrong.length) p(`a note puts ${t.name} at ${m[1] ?? m[2]}, the order at ${lv.join(', ')}`);
          }
        }
      }
    }
  }
  return problems;
}
