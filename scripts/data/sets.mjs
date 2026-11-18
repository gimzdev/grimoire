#!/usr/bin/env node
// Writes data/sets.json from the finished data/items.json (scripts/data/lib/sets.mjs). build.mjs does the same when it
// builds the items; this runs on data/ alone.
//
//   node scripts/data/sets.mjs [--data data]
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { itemSets } from './lib/sets.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const i = process.argv.indexOf('--data');
const data = path.resolve(i > 0 ? process.argv[i + 1] : path.join(here, '..', '..', 'data'));
const items = JSON.parse(readFileSync(path.join(data, 'items.json'), 'utf8'));
const sets = itemSets(items);
writeFileSync(path.join(data, 'sets.json'), JSON.stringify(sets));
console.log(`sets: ${sets.length}, ${sets.reduce((n, s) => n + s.pieces.length, 0)} pieces`);
