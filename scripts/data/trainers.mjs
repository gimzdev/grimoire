#!/usr/bin/env node
// Puts Classic's training price on every ability in the finished data/abilities.json (scripts/data/lib/trainers.mjs).
// build.mjs does the same when it builds the abilities; this runs on data/ alone.
//
//   node scripts/data/trainers.mjs --vmangos mangos.sqlite [--data data]
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { addCosts, trainerCosts } from './lib/trainers.mjs';

const arg = (k, d) => {
  const i = process.argv.indexOf(k);
  return i > 0 ? process.argv[i + 1] : d;
};
const here = path.dirname(fileURLToPath(import.meta.url));
const data = path.resolve(arg('--data', path.join(here, '..', '..', 'data')));
const db = new DatabaseSync(path.resolve(arg('--vmangos', 'mangos.sqlite')), { readOnly: true });
const file = path.join(data, 'abilities.json');
const abilities = JSON.parse(readFileSync(file, 'utf8'));
const n = addCosts(abilities, trainerCosts(db));
writeFileSync(file, JSON.stringify(abilities));
console.log(`trainers: ${n} abilities priced`);
