#!/usr/bin/env node
// Checks the numbers and levels in content/guides against data/ (scripts/data/lib/guides-lint.mjs says how). Exits 1 and
// lists every line to fix.   node scripts/data/guides-lint.mjs [--data data]
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { lintGuides } from './lib/guides-lint.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '..', '..');
const i = process.argv.indexOf('--data');
const data = path.resolve(i > 0 ? process.argv[i + 1] : path.join(root, 'data'));
const json = (f) => JSON.parse(readFileSync(path.join(data, f), 'utf8'));
const talents = json('talents.json');
const abilities = json('abilities.json');
const statics = JSON.parse(readFileSync(path.join(here, 'static', 'builds.json'), 'utf8'));

// the levels each class's leveling builds take each talent at (the first point at 10, one a level; from: after a respec)
const levels = new Map();
for (const b of statics) {
  if (b.kind !== 'leveling') continue;
  b.order.forEach((name, n) => {
    const k = `${b.cls}:${name}`;
    if (!levels.has(k)) levels.set(k, new Set());
    levels.get(k).add(b.from ? Math.max(b.from, 10 + n) : 10 + n);
  });
}
const dir = path.join(root, 'content', 'guides');
const guides = readdirSync(dir)
  .filter((f) => f.endsWith('.md'))
  .sort()
  .map((f) => ({ file: `content/guides/${f}`, text: readFileSync(path.join(dir, f), 'utf8') }));
const problems = lintGuides(guides, { talents, abilities }, (cls, name) => levels.get(`${cls}:${name}`) ?? new Set());
console.log(`guides: ${guides.length} guides checked against the talents and abilities of ${path.relative(root, data) || 'data'}`);
if (problems.length) {
  console.log(`Lines to fix:\n  ${problems.join('\n  ')}`);
  process.exitCode = 1;
}
