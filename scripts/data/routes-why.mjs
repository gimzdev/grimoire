#!/usr/bin/env node
// Where the quests go: for every "kill to the next level" step of a route, the quests the character could take at that
// level (its side and class, required level reached, at most 3 levels above it and no more than 6 below) that no step of
// the route ever takes, counted by why.
//   node scripts/data/routes.mjs ... --only human-warrior --dry --why /tmp/why.json   (the catalog's reasons; any route)
//   node scripts/data/routes-why.mjs --why /tmp/why.json [--guide data/guide.json] [--routes a,b,c]
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '..', '..');
const args = Object.fromEntries(
  process.argv
    .slice(2)
    .join(' ')
    .split(/\s*--/)
    .filter(Boolean)
    .map((a) => {
      const [k, ...v] = a.split(' ');
      return [k, v.join(' ') || true];
    }),
);
const json = (f) => JSON.parse(readFileSync(path.resolve(root, f), 'utf8'));
const guide = json(args.guide || 'data/guide.json');
const why = JSON.parse(readFileSync(path.resolve(args.why), 'utf8'));
const quests = json('data/quests.json');
const plan = json('scripts/data/static/route.json');
const CLASS_BIT = { warrior: 1, paladin: 2, hunter: 3, rogue: 4, priest: 5, shaman: 7, mage: 8, warlock: 9, druid: 11 };
const ESTIMATED = new Set((plan.estimated?.zones ?? []).map((z) => z.area));

const REASONS = ['not placed in the data', 'behind a quest not routed', 'elite or group', 'dungeon or raid', 'class, profession or event', 'repeatable', 'reputation or goods', 'zone its travel rules exclude', 'trip judged not worth it', 'other'];
const reasonOf = (q, taken, side) => {
  const ex = why.excluded[q.i];
  if (ex) return ex === 'not placed' ? 'not placed in the data' : ex === 'zone not routed at its level' ? 'zone its travel rules exclude' : ex === 'unknown' ? 'other' : ex;
  const c = why.catalog[q.i];
  if (!c) return 'other';
  if (c.elite) return 'elite or group';
  if (c.pre.some((p) => !taken.has(p)) || (c.any.length && !c.any.some((p) => taken.has(p)))) return 'behind a quest not routed';
  if (c.z && !plan[side].includes(c.z) && !ESTIMATED.has(c.z)) return 'zone its travel rules exclude';
  if (c.z === 16651) return 'zone its travel rules exclude';
  return 'trip judged not worth it';
};

const wanted = args.routes ? String(args.routes).split(',') : null;
const total = Object.fromEntries(REASONS.map((r) => [r, { n: 0, xp: 0 }]));
const rows = [];
const steps = { n: 0, routes: 0 };
for (const r of guide.routes) {
  if (wanted && !wanted.includes(r.id)) continue;
  const side = r.faction;
  const bit = side === 'alliance' ? 1 : 2;
  const cls = CLASS_BIT[r.class];
  const taken = new Set(r.steps.filter((s) => s[0] === 'T').map((s) => s[1]));
  const grinds = r.steps.filter((s) => s[0] === 'L').map((s) => s[1] - 1);
  steps.n += grinds.length;
  steps.routes++;
  const seen = new Map();
  for (const lv of grinds)
    for (const q of quests) {
      if (taken.has(q.i) || seen.has(q.i)) continue;
      // the side as players meet it (q.fs: a quest open to every race whose giver is the other side's is not this route's)
      const sideOf = q.fs || q.s;
      if (!(sideOf === 3 || sideOf === bit)) continue;
      if (q.rc && !(q.rc & (1 << (cls - 1)))) continue;
      const l = q.l > 0 ? q.l : q.r;
      if (!l || (q.r || 1) > lv || l > lv + 3 || l < lv - 6) continue;
      seen.set(q.i, { q, why: reasonOf(q, taken, side) });
    }
  const row = Object.fromEntries(REASONS.map((x) => [x, { n: 0, xp: 0 }]));
  for (const { q, why: w } of seen.values()) {
    row[w].n++;
    row[w].xp += q.xp ?? 0;
    total[w].n++;
    total[w].xp += q.xp ?? 0;
  }
  rows.push({ id: r.id, grinds: grinds.length, row });
}
const fmt = (c) => `${c.n} (${Math.round(c.xp / 1000)}k)`;
console.log(`| route | grind steps | ${REASONS.join(' | ')} |`);
console.log(`| --- | --- | ${REASONS.map(() => '---').join(' | ')} |`);
for (const x of rows) console.log(`| ${x.id} | ${x.grinds} | ${REASONS.map((k) => fmt(x.row[k])).join(' | ')} |`);
if (rows.length > 1) console.log(`| all ${steps.routes} (sum) | ${steps.n} | ${REASONS.map((k) => fmt(total[k])).join(' | ')} |`);
console.log('(distinct quests a route never takes, open at one of its grind steps; in brackets their experience in thousands)');
