#!/usr/bin/env node
// The table of content/guides/fishing.md: every open-world zone with a fishing level in VMaNGOS
// (skill_fishing_base_level, keyed by zone or subzone), grouped by that level, with what fishing there gives most
// (fishing_loot_template for the same zone or subzone, rolled the way the 1.12 server rolls a loot group: explicit
// chances first, rows without one sharing what is left). VMaNGOS's server (GameObject.cpp, the fishing bobber) catches
// nothing below the level, which is why the page groups zones by it.
//
//   node scripts/guides/fishing.mjs --vmangos mangos.sqlite [--data data]
import { isMain, itemLink, main, table, zoneLink } from './lib.mjs';

export const guide = 'content/guides/fishing.md';

const PATCH = 10;
const pct = (p) => (p >= 10 ? String(Math.round(p)) : String(Math.round(p * 10) / 10));

/** Each loot entry's items and their chance in percent, for every player (quest-only and conditional rows left out). */
function fishingLoot(db) {
  const byEntry = new Map();
  for (const r of db.prepare('SELECT * FROM fishing_loot_template WHERE patch_min <= ? AND patch_max >= ?').all(PATCH, PATCH)) {
    if (r.ChanceOrQuestChance < 0 || r.condition_id || r.mincountOrRef < 0) continue;
    if (!byEntry.has(r.entry)) byEntry.set(r.entry, []);
    byEntry.get(r.entry).push(r);
  }
  const out = new Map();
  for (const [entry, rows] of byEntry) {
    const items = new Map();
    const groups = new Map();
    for (const r of rows) {
      if (!r.groupid) items.set(r.item, r.ChanceOrQuestChance);
      else {
        if (!groups.has(r.groupid)) groups.set(r.groupid, []);
        groups.get(r.groupid).push(r);
      }
    }
    for (const g of groups.values()) {
      const equal = g.filter((r) => !r.ChanceOrQuestChance);
      const left = Math.max(0, 100 - g.reduce((n, r) => n + r.ChanceOrQuestChance, 0));
      for (const r of g) items.set(r.item, r.ChanceOrQuestChance || left / equal.length);
    }
    out.set(entry, items);
  }
  return out;
}

export function blocks({ db, data }) {
  const zones = new Map(data('zones.json').map((z) => [z.id, z]));
  const areas = new Map(db.prepare('SELECT entry, zone_id, name FROM area_template').all().map((a) => [a.entry, a]));
  const loot = fishingLoot(db);
  const byLevel = new Map();
  for (const { entry, skill } of db.prepare('SELECT entry, skill FROM skill_fishing_base_level').all()) {
    const area = areas.get(entry);
    const zone = area?.zone_id || entry;
    const name = zones.get(zone)?.n ?? data('zone-names.json')[zone];
    if (zones.get(zone)?.inst || !name) continue; // instances, and places the data does not name
    const where = area?.zone_id ? `${area.name}, ${zoneLink(data, zone)}` : zoneLink(data, zone);
    const fish = [...(loot.get(entry) ?? new Map()).entries()]
      .filter(([, p]) => p >= 1)
      .sort((a, b) => b[1] - a[1] || a[0] - b[0])
      .slice(0, 4)
      .map(([id, p]) => `${itemLink(id)} ${pct(p)}%`)
      .join(', ');
    if (!byLevel.has(skill)) byLevel.set(skill, []);
    byLevel.get(skill).push([area?.zone_id ? `${area.name} ${name}` : name, [where, fish]]);
  }
  const sections = [...byLevel.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([skill, list]) => {
      const rows = list.sort((a, b) => a[0].localeCompare(b[0])).map(([, row]) => row);
      return `### Fishing level ${skill < 0 ? `−${-skill}` : skill}\n\n${table(['Where', 'What you fish up most (chance per catch)'], rows)}`;
    });
  return { 'fishing-zones': sections.join('\n\n') };
}

if (isMain(import.meta.url)) main({ guide, blocks });
