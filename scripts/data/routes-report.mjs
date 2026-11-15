#!/usr/bin/env node
// Prints the leveling routes against the bar of plan B3 (scripts/data/lib/route-bar.mjs says what each column counts):
// a line per route and the median. A route without its own record of how long each grind is gets an estimate from the
// quests before it, which needs VMaNGOS's experience table (--vmangos, or GRIMOIRE_VMANGOS).
//
//   node scripts/data/routes-report.mjs [--guide data/guide.json] [--vmangos mangos.sqlite] [--thin] [--release]
//
// --release writes each route's counts to static/route-release.json (what a route may not get worse than: lib/guide.mjs's
// gate and check-routes.mjs), keeping its `about` and `bar`. Only for a guide that is to be the new reference.
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { routeTable } from './lib/route-bar.mjs';

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
const data = path.join(here, '..', '..', 'data');
const json = (f) => JSON.parse(readFileSync(f, 'utf8'));
const guide = json(path.resolve(args.guide || path.join(data, 'guide.json')));
const vmangos = args.vmangos || process.env.GRIMOIRE_VMANGOS;
let xpTable = null;
if (vmangos) {
  const { openVmangos } = await import('./lib/world.mjs');
  const db = openVmangos(vmangos);
  xpTable = new Map(db.prepare('SELECT lvl, xp_for_next_level xp FROM player_xp_for_level').all().map((r) => [r.lvl, r.xp]));
}
const { rows, text } = routeTable(guide, { npcs: json(path.join(data, 'npcs.json')), xpTable });
console.log(text);
if (args.release) {
  const file = path.join(here, 'static', 'route-release.json');
  const release = json(file);
  release.routes = Object.fromEntries(
    rows.map((r) => [r.id, { hours: r.hours, visits: r.visits, zoneSteps: r.zoneSteps, continents: r.continents, sails: r.sails, thin: r.thin.length, hops: r.hops, grind: r.grind, run: r.grindRun, ground: Math.round((guide.routes.find((x) => x.id === r.id).grind ?? []).reduce((a, x) => a + x, 0)) / 100 }]),
  );
  writeFileSync(file, `${JSON.stringify(release, null, 1)}\n`);
  console.log(`wrote ${rows.length} routes to ${file}`);
}
if (args.thin)
  for (const r of rows) if (r.thin.length) console.log(`${r.id}: ${r.thin.map((t) => `${guide.zones[t.zone]?.n ?? t.zone} at ${t.level} (${t.handed})`).join(', ')}`);
