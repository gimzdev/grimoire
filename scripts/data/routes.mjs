#!/usr/bin/env node
// Works the leveling routes out again on a finished data/ (data/guide.json): the steps of lib/guide.mjs, then what Forever adds
// (lib/forever.mjs) and Blizzard's hotfixes to the route notes (lib/live.mjs), as build.mjs does. The world it routes is the
// one build.mjs wrote to data/ (quests, creatures, objects, drops, items); VMaNGOS gives the rest (flight masters, trainers,
// boats, scripts) and QuestieDB the places of every creature and object, which build.mjs took from LibQuestDB. The same
// data gives the same guide, byte for byte.
//
//   node scripts/data/routes.mjs --vmangos mangos.sqlite --questiedb path/to/QuestieDB [--data data] [--out data/guide.json] [--only human-warrior,orc-shaman] [--dry]
//                                [--rules plan,rather] [--no-gate]
//
// --dry writes nothing and prints, route by route, what would change: steps, quests handed in and hours.
// --rules works the routes out by other rules of lib/guide.mjs (RULES: wide, plan, rather, loose, land, or released for
// 1.0.6's as first built), in the order given: each route keeps the first that leaves it within what it was in
// static/route-release.json, else the released rules. --no-gate keeps the first whatever it gives. Without --rules the
// routes are worked out as data/guide.json's are (ROUTE_RULES). It needs --out or --dry: data/guide.json holds those.
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { questEvents } from './lib/events.mjs';
import { addForever } from './lib/forever.mjs';
import { RULES, buildGuide, guideData } from './lib/guide.mjs';
import { applyLive } from './lib/live.mjs';
import { readQuestieDB, routableLevels, routeInputs } from './lib/questiedb.mjs';
import { openVmangos } from './lib/world.mjs';

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
for (const k of ['vmangos', 'questiedb']) if (!args[k]) throw new Error(`Missing --${k}. See scripts/data/README.md.`);
const data = path.resolve(args.data || path.join(here, '..', '..', 'data'));
const json = (f) => JSON.parse(readFileSync(path.join(data, f), 'utf8'));
const log = (m) => console.log(m);

const db = openVmangos(args.vmangos);
const qdb = readQuestieDB(args.questiedb);
const world = { quests: json('quests.json'), npcs: json('npcs.json'), objects: json('objects.json'), drops: json('drops.json'), items: json('items.json'), minor: json('minor-items.json') };
const plan = JSON.parse(readFileSync(path.join(here, 'static', 'route.json'), 'utf8'));
const routable = routableLevels(world.quests, qdb, [16593, 16591, 16651, 616]);
const trial = args.rules ? String(args.rules).split(',') : [];
for (const k of trial) if (!RULES[k]) throw new Error(`--rules: no rules "${k}" (${Object.keys(RULES).join(', ')})`);
if (trial.length && !args.out && !args.dry) throw new Error('--rules needs --out or --dry: data/guide.json holds the routes worked out without it');
const races = json('races.json');
const dungeons = json('dungeons.json');
const built = buildGuide({
    db,
    lq: routeInputs(qdb, world.quests),
    world: { quests: world.quests, npcs: world.npcs, objects: world.objects, drops: world.drops },
    plan,
    races,
    events: questEvents({ db, quests: world.quests, log }),
    hoursBefore: JSON.parse(readFileSync(path.join(here, 'static', 'route-hours.json'), 'utf8')).hours,
    release: JSON.parse(readFileSync(path.join(here, 'static', 'route-release.json'), 'utf8')),
    ...(trial.length ? { rules: [...trial.map((k) => RULES[k]), ...(args['no-gate'] ? [] : [RULES.released])] } : {}),
    routable,
    only: args.only ? { routes: String(args.only).split(',') } : null,
    log,
  });
// --why <file>: what the catalog left out and why, and where each catalog quest is given (routes-why.mjs)
if (args.why) {
  const area = (g) => (g ? built.camps(g[0], g[1])[0]?.area ?? 0 : 0);
  const catalog = Object.fromEntries([...built.catalog.values()].map((q) => [q.id, { z: area(q.givers?.[0]) || (q.drop ? area(q.drop.ref) : 0), elite: q.elite ? 1 : 0, pre: [...new Set([q.pre, ...q.preGroup].filter(Boolean))], any: q.preAny }]));
  writeFileSync(path.resolve(args.why), JSON.stringify({ excluded: Object.fromEntries(built.excluded), catalog }));
}
const guide = guideData(built,
  { world: { ...world, itemNames: Object.fromEntries(world.items.map((i) => [i.i, i.n])) }, zoneNames: json('zone-names.json'), plan, dungeons },
);
// what QuestieDB places of Forever's zones' quests, band by band, for the routes' notes
guide.coverage = Object.fromEntries([...routable].map(([area, v]) => [area, v.bands]));
guide.incomplete = Object.fromEntries([...routable].map(([area, v]) => [area, Object.fromEntries(v.missing)]));
addForever(guide, { plan, dungeons, quests: world.quests, npcs: world.npcs, log });
// The hotfixes' guide part: the other data in data/ has them already, so only the route notes change.
log(`live hotfixes: ${applyLive({ abilities: json('abilities.json'), talents: json('talents.json'), races, quests: world.quests, npcs: world.npcs, guide }).length} edits`);
const out = path.resolve(args.out || path.join(data, 'guide.json'));
if (args.dry) {
  const before = new Map(JSON.parse(readFileSync(out, 'utf8')).routes.map((r) => [r.id, r]));
  for (const r of guide.routes) {
    const b = before.get(r.id);
    if (!b) console.log(`${r.id}: new route, ${r.steps.length} steps, ${r.quests} quests, ${r.hours} h`);
    else if (JSON.stringify(b.steps) !== JSON.stringify(r.steps)) console.log(`${r.id}: ${b.steps.length} -> ${r.steps.length} steps, ${b.quests} -> ${r.quests} quests, ${b.hours} -> ${r.hours} h`);
  }
  for (const id of before.keys()) if (!guide.routes.some((r) => r.id === id)) console.log(`${id}: gone`);
} else {
  writeFileSync(out, JSON.stringify(guide));
  // data/meta.json names the VMaNGOS migration the routes were worked out on (the rest of data/ keeps build.mjs's).
  if (!args.out) {
    const meta = json('meta.json');
    meta.sources.vmangos.routes = String(db.prepare('SELECT MAX(id) AS id FROM migrations').get()?.id ?? 'unknown');
    writeFileSync(path.join(data, 'meta.json'), JSON.stringify(meta));
  }
}
