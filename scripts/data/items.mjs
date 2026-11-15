#!/usr/bin/env node
// Applies what is known of Forever's items (scripts/data/lib/items-forever.mjs): the items Blizzard has shown
// (static/item-changes.json) and Blizzard's published item rules, to the finished data/items.json. build.mjs does the
// same when it builds the items; this runs on data/ alone and does nothing a second time.
//
//   node scripts/data/items.mjs [--data data] [--dry]
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { foreverItems } from './lib/items-forever.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const i = process.argv.indexOf('--data');
const data = path.resolve(i > 0 ? process.argv[i + 1] : path.join(here, '..', '..', 'data'));
const file = path.join(data, 'items.json');
const items = JSON.parse(readFileSync(file, 'utf8'));
const shown = JSON.parse(readFileSync(path.join(here, 'static', 'item-changes.json'), 'utf8')).items;
const r = foreverItems(items, shown);
console.log(`items: ${r.items} changed (shown by Blizzard ${r.shown}; by the rules: hit ${r.hit}, crit ${r.crit}, healing ${r.healing}, weapon skill still Classic's ${r.weaponSkill})`);
if (r.missing.length) console.log(`not in the item data: ${r.missing.join(', ')}`);
const metaFile = path.join(data, 'meta.json');
const meta = JSON.parse(readFileSync(metaFile, 'utf8'));
meta.counts.itemsUpdated = items.filter((it) => it.fr).length;
if (!process.argv.includes('--dry')) {
  writeFileSync(file, JSON.stringify(items));
  writeFileSync(metaFile, JSON.stringify(meta));
}
