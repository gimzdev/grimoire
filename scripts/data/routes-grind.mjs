#!/usr/bin/env node
// What the leveling routes still kill their way through, and why (Markdown, to stdout):
//
//   node scripts/data/routes-grind.mjs [--guide data/guide.json] [--before other/guide.json] [--reasons grind.json] [--log build.log]
//
// Without --reasons: the totals (grind steps, levels ground, hours, visits, changes of continent), and for every route
// the stretches it kills its way through a level or more in a row (lib/guide.mjs grindRows: grind steps at levels that
// follow each other, each longer than a third of its level, adding up to a level or more). With --before, the same of
// another guide beside it (the routes as released, say), route by route.
// --reasons <file>: the file `routes.mjs --grind <file>` wrote when it worked the routes out: every grind step of every
// route with the reason the engine had for it (what its looks at the zones found), and the reasons counted by kind.
// --log <file>: the output of that routes.mjs run, for the rule each route was worked out by.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { NEW_ZONES, routeNumbers } from './lib/route-bar.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const args = Object.fromEntries(
  process.argv
    .slice(2)
    .join(' ')
    .split(/\s*--/)
    .filter(Boolean)
    .map((a) => {
      const [k, ...v] = a.split(/\s+/);
      return [k, v.join(' ') || true];
    }),
);
const read = (f) => JSON.parse(readFileSync(path.resolve(f), 'utf8'));
const guide = read(args.guide || path.join(here, '..', '..', 'data', 'guide.json'));
const before = args.before ? read(args.before) : null;
const reasons = args.reasons ? read(args.reasons) : null;
const rule = new Map();
if (args.log) for (const l of readFileSync(path.resolve(args.log), 'utf8').split('\n')) {
  const m = /^guide: ([a-z-]+) (?:\(looser rules\) )?\[([a-zA-Z0-9+]+)\]/.exec(l);
  if (m) rule.set(m[1], m[2]);
}
// (a Skyborne's route is its island, then another race's route: that route's rule)
if (rule.size) for (const r of guide.routes) if (r.derived) rule.set(r.id, `as ${r.derived}`);

const numbers = (g) =>
  new Map(
    g.routes.map((r) => {
      const n = routeNumbers(g, r, {});
      return [r.id, { grind: n.grind, ground: Math.round((r.grind ?? []).reduce((a, x) => a + x, 0)) / 100, hours: r.hours, visits: n.visits, continents: n.continents, sails: n.sails, thin: n.thin.length, row: n.row, stretches: n.stretches, long: (r.grind ?? []).filter((x) => x > 33).length, quests: r.quests }];
    }),
  );
const now = numbers(guide);
const was = before ? numbers(before) : null;
const median = (v) => {
  const a = [...v].sort((x, y) => x - y);
  return a.length % 2 ? a[(a.length - 1) / 2] : (a[a.length / 2 - 1] + a[a.length / 2]) / 2;
};
const r1 = (v) => Math.round(v * 10) / 10;
const r2 = (v) => Math.round(v * 100) / 100;
const KEYS = [
  ['grind', '"kill to the next level" steps'],
  ['long', '...of them longer than a third of a level'],
  ['ground', 'levels ground'],
  ['row', 'levels ground in stretches of a level or more in a row'],
  ['hours', 'hours'],
  ['visits', 'visits'],
  ['continents', 'changes of continent'],
  ['sails', '...the class’s own teleports aside'],
  ['thin', 'short visits (fewer than three quests handed in)'],
  ['quests', 'quests handed in'],
];
const out = [];
const ids = guide.routes.map((r) => r.id);

/* The totals */
{
  const col = (m, k, f) => f(ids.map((id) => m.get(id)?.[k] ?? 0));
  const sum = (v) => v.reduce((a, x) => a + x, 0);
  out.push(`### The ${ids.length} routes together`, '');
  out.push(was ? '| | before: median | now: median | before: all routes | now: all routes |' : '| | median | all routes |', was ? '|---|---|---|---|---|' : '|---|---|---|');
  for (const [k, say] of KEYS) {
    const cells = was ? [r2(col(was, k, median)), r2(col(now, k, median)), r1(col(was, k, sum)), r1(col(now, k, sum))] : [r2(col(now, k, median)), r1(col(now, k, sum))];
    out.push(`| ${say} | ${cells.join(' | ')} |`);
  }
  if (was) {
    const better = ids.filter((id) => was.has(id) && now.get(id).ground < was.get(id).ground - 0.005).length;
    const same = ids.filter((id) => was.has(id) && Math.abs(now.get(id).ground - was.get(id).ground) <= 0.005).length;
    const worse = ids.filter((id) => was.has(id) && now.get(id).ground > was.get(id).ground + 0.005);
    const slower = ids.filter((id) => was.has(id) && now.get(id).hours > was.get(id).hours);
    out.push('', `${better} routes grind fewer levels than before, ${same} as many, ${worse.length} more${worse.length ? ` (${worse.join(', ')})` : ''}; ${slower.length} take more hours${slower.length ? ` (${slower.join(', ')})` : ''}.`);
  }
  out.push('');
}

/* Route by route */
{
  out.push('### Route by route', '');
  const head = ['route', ...(rule.size ? ['rule'] : []), 'grind steps', 'levels ground', 'in a row', 'hours', 'visits', 'changes of continent'];
  out.push(`| ${head.join(' | ')} |`, `|${head.map(() => '---').join('|')}|`);
  const cell = (id, k) => (was?.has(id) && was.get(id)[k] !== now.get(id)[k] ? `${was.get(id)[k]} → ${now.get(id)[k]}` : `${now.get(id)[k]}`);
  for (const id of ids) out.push(`| ${id} | ${rule.size ? `${rule.get(id) ?? ''} | ` : ''}${['grind', 'ground', 'row', 'hours', 'visits', 'continents'].map((k) => cell(id, k)).join(' | ')} |`);
  out.push('');
}

/* The stretches */
{
  const say = (list) => (list.length ? list.map((s) => (s.from === s.to ? `${s.from} (${s.levels})` : `${s.from} to ${s.to} (${s.levels})`)).join(', ') : 'none');
  out.push('### Every stretch of a level or more ground in a row', '', 'Levels in a row whose grind step is longer than a third of the level, adding up to a level or more; in brackets the levels ground in the stretch.', '');
  out.push(was ? '| route | before | now |' : '| route | stretches |', was ? '|---|---|---|' : '|---|---|');
  let nb = 0;
  let na = 0;
  let lb = 0;
  let la = 0;
  for (const id of ids) {
    const a = now.get(id).stretches;
    const b = was?.get(id)?.stretches ?? [];
    na += a.length;
    nb += b.length;
    la += now.get(id).row;
    lb += was?.get(id)?.row ?? 0;
    out.push(was ? `| ${id} | ${say(b)} | ${say(a)} |` : `| ${id} | ${say(a)} |`);
  }
  out.push('', was ? `${nb} stretches (${r2(lb)} levels) before, ${na} (${r2(la)} levels) now; routes with none: ${ids.filter((id) => !(was.get(id)?.stretches ?? []).length).length} before, ${ids.filter((id) => !now.get(id).stretches.length).length} now.` : `${na} stretches, ${r2(la)} levels.`, '');
}

/* Every grind step and the engine's reason for it */
if (reasons) {
  const KIND = {
    held: 'a third of the level or less is left and quests open in this zone at the next level: the route stays',
    short: 'a third of the level or less is left, which the first look at the zones goes nowhere for',
    one: 'more than a third is left, and the route keeps a rule of 1.0.6 as released that looks at the zones once (no stay rule passed the gate for it): that look found no zone with a visit’s work',
    half: 'between a third and a half of the level is left, on a route whose rule looks again and across the sea only rather than grind more than half a level (of the rules that pass the gate, the one that route grinds least by): the first look at the zones goes nowhere for it',
    island: 'on Zephras Isle, the Skyborne’s island to level 12, which has no other zone to go to (as in 1.0.6)',
    none: 'no quest of the catalog is open to this character in any zone it can reach, on either continent',
    rate: 'the second look found a zone with a visit’s work, but the way there and back costs more than the grinding it saves',
    thin: 'quests are open elsewhere, but the second look found no zone with a visit’s work (three quests to hand in and a few typical quests’ experience), nor, where the route’s rule looks at it, the far continent worth a stay',
  };
  const zone = (a) => guide.zones[a]?.n ?? `zone ${a}`;
  // a route's grind steps as the guide has them, each with the reason the engine recorded (a Skyborne's route: its
  // island's, then its base route's)
  const reasonsOf = (r) => {
    const pool = [...(reasons[r.id] ?? []), ...(r.derived ? (reasons[r.derived] ?? []) : [])];
    return r.steps
      .filter((s) => s[0] === 'L')
      .map((s) => {
        const level = s[1] - 1;
        const hit = pool.find((x) => x.level === level && x.zone === s[3] && x.share === s[7]) ?? pool.find((x) => x.level === level);
        const first = hit?.k === 'held' || hit?.k === 'short'; // (only the first look was made)
        const careful = /stayHalf/.test(rule.get(r.derived ?? r.id) ?? '');
        const k = NEW_ZONES[s[3]] === 'Zephras Isle' ? 'island' : first && s[7] > 33 ? (careful && s[7] <= 50 ? 'half' : 'one') : (hit?.k ?? null);
        return { level, share: s[7], zone: s[3], k, why: hit?.why ?? null };
      });
  };
  const tally = new Map();
  const levels = new Map();
  for (const r of guide.routes) for (const s of reasonsOf(r)) {
    tally.set(s.k, (tally.get(s.k) ?? 0) + 1);
    levels.set(s.k, (levels.get(s.k) ?? 0) + s.share / 100);
  }
  out.push('### Why each remaining grind step is there', '', 'The engine’s reason for every "kill to the next level" step, as it worked the route out: what its looks at the zones found at that point.', '', '| reason | grind steps | levels ground |', '|---|---|---|');
  // (a kind no step has is left out, but for `none`: that no step is there for want of quests is worth a line)
  for (const [k, say] of Object.entries(KIND)) if (tally.get(k) || k === 'none') out.push(`| ${say} | ${tally.get(k) ?? 0} | ${r1(levels.get(k) ?? 0)} |`);
  const other = [...tally.keys()].filter((k) => !KIND[k]);
  if (other.length) out.push(`| (no reason recorded) | ${other.reduce((a, k) => a + tally.get(k), 0)} | ${r1(other.reduce((a, k) => a + levels.get(k), 0))} |`);
  out.push('');
  for (const r of guide.routes) {
    const list = reasonsOf(r);
    out.push(`**${r.id}**${rule.get(r.id) ? ` (${rule.get(r.id)})` : ''}: ${list.length} grind steps, ${r2(list.reduce((a, s) => a + s.share / 100, 0))} levels`, '');
    for (const s of list) out.push(`- ${s.level}, ${s.share}% in ${zone(s.zone)}: ${s.k === 'short' || s.k === 'held' ? 'a third of the level or less left; the first look found ' : s.k === 'one' ? 'one look (a rule of 1.0.6 as released): ' : s.k === 'half' ? 'half the level or less left; the first look found ' : s.k === 'island' ? 'the island has no other zone: ' : ''}${s.why || 'no reason recorded'}`);
    out.push('');
  }
}
console.log(out.join('\n'));
