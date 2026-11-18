#!/usr/bin/env node
// Every place a quest, a creature or an object is filed under has a name on the site (categoryName in
// src/lib/quests.ts): a zone, a named area, a quest category, or a dungeon's own area. Without one the site printed
// "Unknown" on 400 quest pages, the first quests of every race among them.
//   1. No quest category, creature zone or object zone in data/ is left without a name.
//   2. A new dungeon's area (NEW_DUNGEON_AREAS in src/lib/data.ts) is the one the data build files it under, and every
//      quest filed under that area is one of the dungeon's.
//   3. With GRIMOIRE_VMANGOS: the names given to Classic's areas are VMaNGOS's.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { NEW_DUNGEON_AREAS } from './lib/questiedb.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '..', '..');
const text = (f) => readFileSync(path.join(root, f), 'utf8');
const json = (f) => JSON.parse(text(f));
let bad = 0;
const fail = (line) => {
  console.log(line);
  bad++;
};

/** The entries of an object literal `const NAME ... = { ... };` whose values are plain strings. */
function literal(file, name) {
  const body = text(file).match(new RegExp(`const ${name}\\b[^=]*=\\s*\\{([\\s\\S]*?)\\n\\};`))?.[1];
  if (body === undefined) {
    fail(`${file}: ${name} not found`);
    return new Map();
  }
  return new Map([...body.matchAll(/^\s*\[?(-?\d+)\]?:\s*'([^']*)',/gm)].map((m) => [Number(m[1]), m[2]]));
}

const names = literal('src/lib/quests.ts', 'CATEGORY_NAMES');
const areas = literal('src/lib/data.ts', 'NEW_DUNGEON_AREAS');
const dungeons = json('data/dungeons.json');
const zones = new Set(json('data/zones.json').map((z) => z.id));
const zoneNames = json('data/zone-names.json');
const quests = json('data/quests.json');
const named = (z) =>
  names.has(z) || zones.has(z) || zoneNames[z] !== undefined || dungeons.some((d) => (areas.has(z) ? d.slug === areas.get(z) : d.zoneId === z || d.questSorts?.includes(z)));

/* 1. Nothing is filed under a place with no name. */
const missing = new Map();
const note = (z, what) => {
  if (named(z)) return;
  const m = missing.get(z) ?? missing.set(z, { n: 0, first: what }).get(z);
  m.n++;
};
for (const q of quests) note(q.z, `quest ${q.i} ${q.n}`);
for (const [id, n] of Object.entries(json('data/npcs.json'))) if (n[6]) note(n[6], `creature ${id} ${n[0]}`);
for (const [id, o] of Object.entries(json('data/objects.json'))) if (o[1]) note(o[1], `object ${id} ${o[0]}`);
for (const [z, m] of missing) fail(`place ${z} has no name: ${m.n} filed under it, the first is ${m.first} (name it in CATEGORY_NAMES, src/lib/quests.ts)`);

/* 2. The new dungeons' areas. */
for (const [area, slug] of areas) {
  const d = dungeons.find((x) => x.slug === slug);
  if (!d) {
    fail(`area ${area}: no dungeon ${slug} in data/dungeons.json`);
    continue;
  }
  if (!NEW_DUNGEON_AREAS[slug]?.includes(area)) fail(`area ${area}: the data build does not file ${slug} under it (scripts/data/lib/questiedb.mjs)`);
  for (const q of quests) if (q.z === area && !d.questIds?.includes(q.i)) fail(`area ${area}: quest ${q.i} ${q.n} is filed under it and is not one of ${slug}'s`);
}

/* 3. Classic's areas carry VMaNGOS's names. */
const vm = process.env.GRIMOIRE_VMANGOS;
let compared = 0;
if (vm) {
  const { DatabaseSync } = await import('node:sqlite');
  const db = new DatabaseSync(vm, { readOnly: true });
  const row = db.prepare('SELECT name FROM area_template WHERE entry = ?');
  for (const [z, name] of names) {
    if (z <= 0) continue;
    const r = row.get(z);
    if (!r) continue; // one of Forever's own areas: VMaNGOS has no row for it
    compared++;
    if (r.name !== name.replaceAll('’', "'")) fail(`area ${z}: named ${name}, VMaNGOS calls it ${r.name}`);
  }
}

if (bad) process.exit(1);
console.log(`${quests.length} quests, their creatures and objects: every place has a name. ${areas.size} new dungeon areas match the data build.${vm ? ` ${compared} area names match VMaNGOS.` : ' Area names against VMaNGOS skipped: needs GRIMOIRE_VMANGOS.'}`);
