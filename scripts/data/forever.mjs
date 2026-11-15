#!/usr/bin/env node
// Adds what Forever brings to the leveling routes (notes, dungeons to run once, the Skyborne routes) to data/guide.json:
// scripts/data/lib/forever.mjs says what. build.mjs does the same after it works the routes out; this runs on the finished
// data/ alone, so it needs none of the sources.
//
//   node scripts/data/forever.mjs [--data data] [--out data/guide.json] [--report]
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { addForever } from './lib/forever.mjs';

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
const data = path.resolve(args.data || path.join(here, '..', '..', 'data'));
const json = (f) => JSON.parse(readFileSync(f, 'utf8'));
const guide = json(path.join(data, 'guide.json'));
const { report } = addForever(guide, {
  dungeons: json(path.join(data, 'dungeons.json')),
  quests: json(path.join(data, 'quests.json')),
  npcs: json(path.join(data, 'npcs.json')),
  plan: json(path.join(here, 'static', 'route.json')),
  log: console.log,
});
if (args.report) for (const r of report) console.log(`${r.id.padEnd(26)} ${r.dungeons.join(', ')}`);
writeFileSync(path.resolve(args.out || path.join(data, 'guide.json')), JSON.stringify(guide));
