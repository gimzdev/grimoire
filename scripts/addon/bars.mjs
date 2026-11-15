// The builds' suggested action bars for the add-on: data/bars.json (written by scripts/data/bars.mjs from
// scripts/data/static/bars.json) as Data/Bars.lua's ns.bars, { [build id] = { 12 entries } }, one per key from 1 to =,
// an ability name or false for a key left free. scripts/addon/build.mjs calls it.
//
// The bars are checked as scripts/data/bars.mjs checks them (scripts/data/lib/bars.mjs). A name that no longer resolves,
// after the builds or the spells changed, is left out of the add-on with a warning rather than stopping the build: the
// add-on only places spells the player knows, so a missing one costs a key, a wrong one would not.
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { barIssues, BAR_KEYS } from '../data/lib/bars.mjs';

export function addonBars(root, data) {
  const file = path.join(root, 'data', 'bars.json');
  if (!existsSync(file)) {
    console.warn('  bars: data/bars.json is missing (node scripts/data/bars.mjs writes it); the add-on gets no suggested bars');
    return {};
  }
  const bars = JSON.parse(readFileSync(file, 'utf8'));
  const issues = barIssues(bars, data);
  const dropped = new Set(issues.filter((p) => p.index !== undefined).map((p) => `${p.id}:${p.index}`));
  for (const p of issues) console.warn(`  bars: ${p.id}${p.index === undefined ? '' : ` key ${BAR_KEYS[p.index]}`}: ${p.text}${p.index === undefined ? '' : ' (left out)'}`);
  const out = {};
  for (const b of data.builds) {
    const bar = bars[b.id];
    if (!Array.isArray(bar)) continue;
    out[b.id] = Array.from({ length: 12 }, (_, i) => (typeof bar[i] === 'string' && !dropped.has(`${b.id}:${i}`) ? bar[i] : false));
  }
  return out;
}
