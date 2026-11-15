#!/usr/bin/env node
// Each build's suggested action bar: checks scripts/data/static/bars.json against data/ and copies it to data/bars.json,
// which the site and the add-on build (scripts/addon/build.mjs, through scripts/addon/bars.mjs) read.
//
//   node scripts/data/bars.mjs            check, then write data/bars.json
//   node scripts/data/bars.mjs --check    check only (the checker: exits 1 and lists every problem)
//   [--data data]                         another data folder
//
// static/bars.json is { "<build id>": [12 entries] }: an ability name or null for each key, 1 to 9, 0, - and =, in that
// order. Keys 1 to 6 hold the rotation and fillers (a healer's heals), 7 to 0 cooldowns and defensives, - and = utility
// (movement, interrupts, buffs). Leveling bars lean on what is learned early and PvP bars on control and defensives; a key
// is left null rather than filled with a spell nobody presses. The checker (scripts/data/lib/bars.mjs) wants a bar of 12
// keys for every build in data/builds.json and nothing else, and every name spelled as in data/abilities.json for the
// build's class or as a talent in data/talents.json the build takes; it refuses passives, pet and demon abilities, one
// race's spells and one faction's teleports. Run it after the builds, abilities or talents change.
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkBars, orderBars } from './lib/bars.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const i = process.argv.indexOf('--data');
const data = path.resolve(i > 0 ? process.argv[i + 1] : path.join(here, '..', '..', 'data'));
const json = (f) => JSON.parse(readFileSync(f, 'utf8'));
const builds = json(path.join(data, 'builds.json'));
const bars = json(path.join(here, 'static', 'bars.json'));
const problems = checkBars(bars, {
  builds,
  abilities: json(path.join(data, 'abilities.json')),
  talents: json(path.join(data, 'talents.json')),
  races: json(path.join(data, 'races.json')),
});
const placed = Object.values(bars).reduce((n, bar) => n + (Array.isArray(bar) ? bar.filter(Boolean).length : 0), 0);
if (problems.length) {
  console.log(`bars: ${problems.length} problem${problems.length === 1 ? '' : 's'}:\n  ${problems.join('\n  ')}`);
  process.exitCode = 1;
} else {
  console.log(`bars: ${Object.keys(bars).length} builds, ${placed} spells, every name resolves for its class`);
}
if (!process.argv.includes('--check') && !problems.length) {
  const ordered = orderBars(bars, builds);
  // One build to a line, so a change to a bar reads as a change to one line.
  const text = `{\n${Object.entries(ordered).map(([id, bar]) => `  ${JSON.stringify(id)}: ${JSON.stringify(bar)}`).join(',\n')}\n}\n`;
  writeFileSync(path.join(data, 'bars.json'), text);
  console.log(`bars written to ${path.join(data, 'bars.json')}`);
}
