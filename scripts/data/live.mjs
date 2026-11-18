#!/usr/bin/env node
// Brings data/ up to what Blizzard announced since the launch of 4 November 2026 and the talentsforever export does not carry:
// its "WoW: Forever Hotfixes" list (entries of 5 to 13 November) and a few facts of its development notes. Corrected
// wordings, lines on spells, talents and racials, quests, a creature's level and the leveling guide's note on dungeons
// (scripts/data/lib/live.mjs says what). build.mjs and classes.mjs do the same before they write; this runs on the finished
// data/ alone and changes nothing a second time.
//
//   node scripts/data/live.mjs [--data data] [--dry]
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { applyLive, liveMeta } from './lib/live.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const i = process.argv.indexOf('--data');
const data = path.resolve(i > 0 ? process.argv[i + 1] : path.join(here, '..', '..', 'data'));
const dry = process.argv.includes('--dry');
const files = { abilities: 'abilities.json', talents: 'talents.json', races: 'races.json', quests: 'quests.json', npcs: 'npcs.json', guide: 'guide.json', meta: 'meta.json' };
const d = Object.fromEntries(Object.entries(files).map(([k, f]) => [k, JSON.parse(readFileSync(path.join(data, f), 'utf8'))]));
const before = JSON.stringify(d.meta);

const done = applyLive(d);
liveMeta(d.meta);
for (const line of done) console.log(line);
console.log(`live hotfixes: ${done.length} edits${JSON.stringify(d.meta) === before ? '' : ', meta updated'}`);
if (!dry) for (const [k, f] of Object.entries(files)) writeFileSync(path.join(data, f), JSON.stringify(d[k]));
