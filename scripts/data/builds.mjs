#!/usr/bin/env node
// Rewrites data/builds.json from scripts/data/static/builds.json and data/talents.json (what build.mjs does for the builds, without the
// other sources).   node scripts/data/builds.mjs [--data data]
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildBuilds } from './lib/builds.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const i = process.argv.indexOf('--data');
const data = path.resolve(i > 0 ? process.argv[i + 1] : path.join(here, '..', '..', 'data'));
const json = (f) => JSON.parse(readFileSync(f, 'utf8'));
const { builds, problems } = buildBuilds(json(path.join(here, 'static', 'builds.json')), json(path.join(data, 'talents.json')));
writeFileSync(path.join(data, 'builds.json'), JSON.stringify(builds));
console.log(`${builds.length} builds written to ${path.join(data, 'builds.json')}`);
if (problems.length) {
  console.log(`Builds to check:\n  ${problems.join('\n  ')}`);
  process.exitCode = 1;
}
