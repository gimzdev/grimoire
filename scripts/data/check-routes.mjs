#!/usr/bin/env node
// Holds every leveling route in data/guide.json to the bar of plan B3 (scripts/data/lib/route-bar.mjs counts each line):
//   at most 50 "Go to" zone steps and 10 changes of continent; no visit that hands in fewer than three quests (class
//   quests and trainers aside); at most 6 "kill to the next level" steps, none longer than a third of a level; a step in
//   one of Forever's zones on every route that passes its levels, where the data places the zone; no more hours than the
//   route took before the QuestieDB rebuild (static/route-hours.json); every step resolves. And against 1.0.6 as first
//   built (static/route-release.json): no more hours, grind steps or levels ground, no longer run of levels ground for
//   more than half, and no more travel than the bar there allows a route that grinds less (visits, short visits, changes
//   of continent, short stays on a continent).
// A route that cannot meet a line is listed in WAIVED with the reason; the check fails on any other miss, and on a waiver a
// route no longer needs (so the table stays true). The leveling guide's counts of Forever's zones and of Forever's quests on
// the routes must be the data's.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { zoneFacts } from './lib/forever.mjs';
import { routeNumbers } from './lib/route-bar.mjs';
import { ROUTE_SHARE } from './lib/questiedb.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '..', '..');
const json = (f) => JSON.parse(readFileSync(path.join(root, f), 'utf8'));
const guide = json('data/guide.json');
const hoursBefore = json('scripts/data/static/route-hours.json').hours;
const { routes: released, bar } = json('scripts/data/static/route-release.json');
// the most a route may have of a count its rules may add to: the released count (the released median for a route that was
// under it) plus the bar's allowance
const most = (r, k) => (released[r.id] ? Math.max(released[r.id][k], bar.median[k]) + bar[k === 'sails' ? 'continents' : k] : Infinity);
const ground = (r) => (r.grind ?? []).reduce((a, x) => a + x, 0) / 100;

/* The lines, each a test on a route's numbers. */
const LINES = {
  zoneSteps: { say: 'at most 50 "Go to" zone steps', ok: (n) => n.zoneSteps <= 50 },
  visits: { say: 'at most 50 visits (a "Go to" and the work there)', ok: (n) => n.visits <= 50 },
  continents: { say: 'at most 10 changes of continent', ok: (n) => n.continents <= 10 },
  thin: { say: 'no visit that hands in fewer than three quests', ok: (n) => n.thin.length === 0 },
  grind: { say: 'at most 6 "kill to the next level" steps', ok: (n) => n.grind <= 6 },
  grindMax: { say: 'no "kill to the next level" step longer than a third of a level', ok: (n) => n.grindMax <= 33 },
  newZones: { say: 'a step in one of Forever’s zones', ok: (n) => n.newZones.length > 0 },
  hours: { say: 'no more hours than before the QuestieDB rebuild', ok: (n, r) => n.hours <= (hoursBefore[r.id] ?? Infinity) },
  // Against the routes of 1.0.6 as first built (static/route-release.json), which lib/guide.mjs's rules are held to: a
  // route is never slower, never has more grind steps, more levels ground or a longer run of levels ground for more than
  // half; and the travel its rules may add to grind less has these limits (each counted from the released median for a
  // route that was under it: `most`).
  hoursReleased: { say: 'no more hours than in 1.0.6 as first built (static/route-release.json)', ok: (n, r) => n.hours <= (released[r.id]?.hours ?? Infinity) },
  grindReleased: { say: 'no more "kill to the next level" steps than in 1.0.6 as first built', ok: (n, r) => n.grind <= (released[r.id]?.grind ?? Infinity) },
  groundReleased: { say: 'no more levels ground than in 1.0.6 as first built', ok: (n, r) => ground(r) <= (released[r.id]?.ground ?? Infinity) + 0.005 },
  runReleased: { say: 'no longer run of levels ground for more than half than in 1.0.6 as first built', ok: (n, r) => n.grindRun <= (released[r.id]?.run ?? Infinity) },
  visitsReleased: { say: `at most ${bar.visits} more visits than in 1.0.6 as first built`, ok: (n, r) => n.visits <= most(r, 'visits') },
  thinReleased: { say: `at most ${bar.thin} more visits that hand in fewer than three quests than in 1.0.6 as first built`, ok: (n, r) => n.thin.length <= most(r, 'thin') },
  continentsReleased: { say: `at most ${bar.continents} more changes of continent than in 1.0.6 as first built, and never over ${bar.continentsMost} (the class's own teleports aside)`, ok: (n, r) => n.sails <= Math.min(most(r, 'sails'), bar.continentsMost) },
  hopsReleased: { say: `at most ${bar.hops} more stays on a continent that hand in fewer than three quests than in 1.0.6 as first built`, ok: (n, r) => n.hops <= most(r, 'hops') },
  unresolved: { say: 'every step resolves', ok: (n) => n.unresolved.length === 0 },
};

/* The lines routes cannot meet, and why (November 15, 2026; the numbers are the medians of the 56 routes, those before the QuestieDB rebuild in
 * brackets). A route listed here and meeting the line fails the check: take it out. Every route has a step in one of
 * Forever's zones: that line has no waiver. */
const WAIVED = {
  zoneSteps: {
    routes: ['human-warrior', 'human-paladin', 'human-hunter', 'human-rogue', 'human-priest', 'human-mage', 'human-warlock', 'dwarf-warrior', 'dwarf-paladin', 'dwarf-hunter', 'dwarf-rogue', 'dwarf-priest', 'dwarf-shaman', 'gnome-warrior', 'gnome-rogue', 'gnome-priest', 'gnome-mage', 'gnome-warlock', 'night-elf-warrior', 'night-elf-hunter', 'night-elf-rogue', 'night-elf-priest', 'night-elf-druid', 'orc-warrior', 'orc-hunter', 'orc-rogue', 'orc-shaman', 'orc-mage', 'orc-warlock', 'troll-warrior', 'troll-hunter', 'troll-rogue', 'troll-priest', 'troll-shaman', 'troll-mage', 'troll-warlock', 'tauren-warrior', 'tauren-hunter', 'tauren-shaman', 'tauren-druid', 'undead-warrior', 'undead-rogue', 'undead-priest', 'undead-mage', 'undead-warlock', 'high-order-skyborne-warrior', 'high-order-skyborne-hunter', 'high-order-skyborne-rogue', 'high-order-skyborne-mage', 'high-order-skyborne-druid', 'windshaper-skyborne-warrior', 'windshaper-skyborne-hunter', 'windshaper-skyborne-rogue', 'windshaper-skyborne-shaman', 'windshaper-skyborne-druid'],
    why: 'a level band’s quests are spread over several zones and both continents; zones crossed on foot are part of the "Go to" that leads through them, so each step is a trip to work somewhere, or a flight, boat or Hearthstone to a turn-in; and since November 15, 2026 a route goes to the quests of its level rather than kill its way through it, inside the bar of static/route-release.json. Median 64 (59 in 1.0.6 as first built, 97.5 before the QuestieDB rebuild)',
  },
  visits: {
    routes: ['human-warrior', 'human-paladin', 'human-hunter', 'human-rogue', 'human-priest', 'human-mage', 'human-warlock', 'dwarf-warrior', 'dwarf-paladin', 'dwarf-hunter', 'dwarf-rogue', 'dwarf-priest', 'dwarf-shaman', 'gnome-warrior', 'gnome-rogue', 'gnome-priest', 'gnome-mage', 'gnome-warlock', 'night-elf-warrior', 'night-elf-hunter', 'night-elf-rogue', 'night-elf-priest', 'night-elf-druid', 'orc-warrior', 'orc-hunter', 'orc-shaman', 'orc-mage', 'orc-warlock', 'troll-warrior', 'troll-hunter', 'troll-priest', 'troll-shaman', 'troll-mage', 'troll-warlock', 'tauren-warrior', 'tauren-hunter', 'tauren-shaman', 'tauren-druid', 'undead-warrior', 'undead-rogue', 'undead-priest', 'undead-mage', 'undead-warlock', 'high-order-skyborne-warrior', 'high-order-skyborne-hunter', 'high-order-skyborne-rogue', 'high-order-skyborne-mage', 'high-order-skyborne-druid', 'windshaper-skyborne-warrior', 'windshaper-skyborne-hunter', 'windshaper-skyborne-shaman', 'windshaper-skyborne-druid'],
    why: 'the quests a level needs stand in several zones at once (a route works in 26 to 35 zones), so the routes go back to a zone when its next quests open; and since November 15, 2026 grinding less wins over travelling less: a route may make up to 14 more visits than in 1.0.6 as first built where that cuts its grinding (visitsReleased above). Median 62 (56.5 as first built)',
  },
  continents: {
    routes: ['human-warrior', 'human-paladin', 'human-hunter', 'human-mage', 'human-warlock', 'dwarf-warrior', 'dwarf-paladin', 'dwarf-priest', 'dwarf-shaman', 'gnome-warrior', 'gnome-priest', 'gnome-mage', 'gnome-warlock', 'night-elf-warrior', 'night-elf-hunter', 'night-elf-rogue', 'night-elf-priest', 'night-elf-druid', 'orc-shaman', 'orc-mage', 'orc-warlock', 'troll-shaman', 'troll-mage', 'troll-warlock', 'tauren-shaman', 'tauren-druid', 'undead-rogue', 'undead-priest', 'undead-mage', 'undead-warlock', 'high-order-skyborne-warrior', 'high-order-skyborne-mage', 'high-order-skyborne-druid', 'windshaper-skyborne-rogue', 'windshaper-skyborne-shaman', 'windshaper-skyborne-druid'],
    why: 'the zones of a level band lie on both continents (the plan’s, and where the quests are); since November 15, 2026 a route crosses to the quests of its level rather than kill its way through it: up to 8 more changes of continent than in 1.0.6 as first built and never over 20, the class’s own teleports aside (continentsReleased above); a mage’s teleports to the capitals are changes of continent too. Median 12 (9 as first built, 16 before the QuestieDB rebuild)',
  },
  thin: {
    routes: '*',
    why: 'short visits remain where a route goes to another zone for something else than the zone’s quests (a camp to kill at, a class quest, a turn-in on the way such as a delivery or the end of a chain), and on the routes that take the looser rules because the stricter make them slower than before the QuestieDB rebuild; a rule that grinds less may add three at most (thinReleased above). Median 7 (6 as first built, 23 before the QuestieDB rebuild)',
  },
  grind: {
    routes: '*',
    why: 'a route kills its way to the next level where no zone’s quests pass its travel rules, and it takes the rules that grind less only inside the bar on the travel they add (static/route-release.json): of the 46 routes worked out, 21 take the second look rather than a long grind, 11 the quests four levels above, 4 the corrected plan alone and 10 keep their steps. The quests are in the data: without the bar the second look cuts the levels ground by a third and adds about 11 visits and 6 changes of continent a route (scripts/data/README.md, "Grinding less"). Riverglades and Mount Hyjal give the routes only their complete quests (QuestieDB lacks a giver, a turn-in or a place for 21% to 25% of them at their levels), and from 56 Classic’s quests are mostly elite and dungeon work. Median 17 (19 as first built, 19.5 before the QuestieDB rebuild)',
  },
  grindMax: {
    routes: '*',
    why: 'where the quests run out a route kills its way through most of a level or all of it (86% to 100%): the longest grinds come at 29 to 40 (15 routes), 46 to 53 (24) and 56 to 59 (17)',
  },
};

let bad = 0;
const waivedSeen = new Map();
for (const r of guide.routes) {
  const n = routeNumbers(guide, r, {});
  for (const [key, line] of Object.entries(LINES)) {
    const w = WAIVED[key];
    const listed = w && (w.routes === '*' || w.routes.includes(r.id));
    const ok = line.ok(n, r);
    if (ok && listed && w.routes !== '*') {
      console.log(`${r.id}: meets "${line.say}" now; take it out of WAIVED.${key}`);
      bad++;
    } else if (!ok && !listed) {
      console.log(`${r.id}: misses "${line.say}"`);
      bad++;
    } else if (!ok) waivedSeen.set(key, (waivedSeen.get(key) ?? 0) + 1);
  }
}
for (const [key, count] of waivedSeen) console.log(`waived: "${LINES[key].say}" on ${count} routes: ${WAIVED[key].why}`);


/* A zone placed on its own map (est): every step there stands where QuestieDB traced what it names: its giver or taker, or
 * for objectives one of their creatures or objects, within 120 yards: the 110 a step's objectives are done in, and 10 for
 * the step's map position, rounded to a tenth of a percent (needs the QuestieDB checkout: GRIMOIRE_QUESTIEDB). */
if (process.env.GRIMOIRE_QUESTIEDB) {
  const { readQuestieDB, spawnList } = await import('./lib/questiedb.mjs');
  const qdb = readQuestieDB(process.env.GRIMOIRE_QUESTIEDB);
  const POS = { A: 3, T: 3, C: 3, L: 3 };
  const named = (s) => {
    if (s[0] !== 'C') return s[2] ? [s[2]] : [];
    const o = guide.quests[s[1]]?.o ?? [];
    return [s[7], ...s[2].flatMap((i) => (o[i]?.[0] === 'o' ? [-o[i][1]] : o[i]?.[0] === 'i' ? (o[i][4] ?? []) : [o[i]?.[1]]))].filter(Boolean);
  };
  let steps = 0;
  for (const r of guide.routes)
    for (const s of r.steps) {
      const z = POS[s[0]] && guide.zones[s[3]];
      if (!z?.est) continue;
      const ids = named(s);
      if (!ids.length) continue;
      steps++;
      const [left, right, top, bottom] = z.rect;
      const yards = (p) => Math.hypot(((p.x - s[4]) / 100) * (left - right), ((p.y - s[5]) / 100) * (top - bottom));
      const near = ids.some((e) => spawnList((e > 0 ? qdb.npcs : qdb.objects).get(Math.abs(e))?.get('spawns')).some((p) => p.area === s[3] && yards(p) <= 120));
      if (!near) {
        console.log(`${r.id}: ${s.slice(0, 7).join(',')} stands where QuestieDB traced none of ${ids.join(', ')}`);
        bad++;
      }
    }
  console.log(`${steps} steps in zones placed on their own maps, each where QuestieDB traced what it names`);
} else console.log('skipped: the steps in zones on their own maps (needs GRIMOIRE_QUESTIEDB)');

/* A zone on a map of its own is a destination, never a way between two other places: no "Go to" it followed at once by
 * another "Go to"; every visit there hands in at least three quests; no other zone's dungeon card inside a visit there; no
 * entry below the lowest level its quests need (at the levels it is routed: guide.coverage's bands, ROUTE_SHARE). */
{
  const quests = json('data/quests.json');
  const npcs = json('data/npcs.json');
  const zoneOf = (q) => {
    const g = (q.st ?? []).find(([k]) => k === 'n' || k === 'o');
    return q.z > 0 ? q.z : g?.[0] === 'n' ? npcs[g[1]]?.[6] : 0;
  };
  const est = new Set(Object.entries(guide.zones).filter(([, z]) => z.est).map(([a]) => Number(a)));
  const lowest = new Map();
  for (const zone of est) {
    const levels = new Set();
    for (const [lo, hi, n, ok] of guide.coverage?.[zone] ?? []) if (n >= 10 && Math.round((100 * ok) / n) >= ROUTE_SHARE) for (let l = lo; l <= hi; l++) levels.add(l);
    const need = quests.filter((q) => q.qd && q.r > 0 && levels.has(q.l) && zoneOf(q) === zone).map((q) => q.r);
    if (need.length) lowest.set(zone, Math.min(...need));
  }
  const placedStep = (s) => s[0] !== 'I' && s[0] !== 'D';
  const areaOf = (s) => s[s[0] === 'A' || s[0] === 'T' || s[0] === 'C' || s[0] === 'F' || s[0] === 'L' ? 3 : 2];
  let visits = 0;
  for (const r of guide.routes) {
    const steps = r.steps;
    // a visit: the steps from the first one in such a zone to the first one elsewhere (a "Go to", a Hearthstone, a flight)
    let zone = 0;
    let at = -1;
    let hands = 0;
    const close = (end) => {
      if (at < 0) return;
      visits++;
      if (hands < 3) {
        console.log(`${r.id}: the visit to ${guide.zones[zone].n} at step ${at} hands in ${hands} of its quests (fewer than three)`);
        bad++;
      }
      for (let k = at; k < end; k++) {
        const s = steps[k];
        if (s[0] === 'D' && guide.dun[s[1]]?.a !== zone) {
          console.log(`${r.id}: step ${k}, the ${guide.dun[s[1]]?.n} card, inside a visit to ${guide.zones[zone].n}`);
          bad++;
        }
      }
      at = -1;
    };
    steps.forEach((s, k) => {
      if (!placedStep(s)) return;
      // a "Go to" that names one of these zones as on the way passes through it
      for (const [z] of s[0] === 'Z' ? (s[6] ?? []) : [])
        if (est.has(z)) {
          console.log(`${r.id}: step ${k} goes through ${guide.zones[z].n} on the way to ${guide.zones[s[1]]?.n ?? s[1]}`);
          bad++;
        }
      const area = areaOf(s);
      if (at >= 0 && area !== zone) close(k);
      if (at < 0 && est.has(area)) {
        zone = area;
        at = k;
        hands = 0;
        if (s[0] === 'Z') {
          const next = steps.slice(k + 1).find(placedStep);
          if (next?.[0] === 'Z') {
            console.log(`${r.id}: step ${k} goes to ${guide.zones[zone].n} and on at once to ${guide.zones[next[1]]?.n ?? next[1]}`);
            bad++;
          }
          if (lowest.has(zone) && s[5] < lowest.get(zone)) {
            console.log(`${r.id}: step ${k} goes to ${guide.zones[zone].n} at level ${s[5]}, below the ${lowest.get(zone)} its quests need`);
            bad++;
          }
        }
      }
      if (at >= 0 && s[0] === 'T' && s[3] === zone) hands++;
    });
    close(steps.length);
  }
  console.log(`${visits} visits to zones on their own maps, each a destination with three or more quests handed in`);
}

/* A grind step's dungeon offer: a dungeon of the guide, open at the step's level, not a dungeon step of the same route,
 * offered once a route, with three or more quests the guide knows. */
{
  let offers = 0;
  for (const r of guide.routes) {
    const cards = new Set(r.steps.filter((s) => s[0] === 'D').map((s) => s[1]));
    const seen = new Set();
    for (const [k, s] of r.steps.entries()) {
      if (s[0] !== 'L' || !Array.isArray(s[8])) continue;
      offers++;
      const [di, pct, ids] = s[8];
      const d = guide.dun[di];
      const level = s[1] - 1;
      const why = !d ? 'no such dungeon' : cards.has(di) ? 'a dungeon step of the route already' : seen.has(di) ? 'offered twice' : level < d.lo || level > d.hi ? `not open at ${level}` : ids.length < 3 ? 'fewer than three quests' : ids.some((id) => !guide.starts[id]) ? 'a quest the guide does not have' : !(pct > 0) ? 'no experience' : null;
      seen.add(di);
      if (why) {
        console.log(`${r.id}: step ${k} offers ${d?.n ?? di}: ${why}`);
        bad++;
      }
    }
  }
  console.log(`${offers} grind steps offer a dungeon instead`);
}

/* The leveling guide quotes QuestieDB's counts of Forever's zones: they must be the data's. */
const facts = zoneFacts(json('data/quests.json'), json('data/npcs.json'));
const text = readFileSync(path.join(root, 'content', 'guides', 'leveling.md'), 'utf8');
for (const [zone, name] of [
  [16591, 'Riverglades'],
  [16651, 'Shen’dralas'],
  [616, 'Mount Hyjal'],
]) {
  const f = facts[zone];
  const want = `QuestieDB has ${f.n} quests in ${name}, most of them for levels ${f.lo} to ${f.hi}`;
  if (!text.includes(want)) {
    console.log(`content/guides/leveling.md: no "${want}"`);
    bad++;
  }
}
/* ...and how many of Forever's quests the routes take. */
{
  const forever = new Set(json('data/quests.json').filter((q) => q.qd).map((q) => q.i));
  const all = new Set();
  const per = guide.routes.map((r) => {
    const s = new Set(r.steps.filter((x) => x[0] === 'T' && forever.has(x[1])).map((x) => x[1]));
    for (const q of s) all.add(q);
    return s.size;
  });
  const want = `${all.size} of them are on at least one route, between ${Math.min(...per)} and ${Math.max(...per)} on each`;
  if (!text.includes(want)) {
    console.log(`content/guides/leveling.md: no "${want}"`);
    bad++;
  }
}
console.log(bad ? `${bad} problems` : `${guide.routes.length} routes meet the bar, waivers aside`);
process.exit(bad ? 1 : 0);
