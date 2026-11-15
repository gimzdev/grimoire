// Each build's suggested action bar (scripts/data/static/bars.json, copied to data/bars.json by scripts/data/bars.mjs),
// and the check that every name on it is a spell its class can put on a bar.
//
// The file is { "<build id>": [12 entries] }, one entry per key: 1 to 9, 0, - and =. An entry is an ability name or null
// for a key left free. Keys 1 to 6 hold the rotation and fillers (a healer's heals), 7 to 0 cooldowns and defensives,
// - and = utility: movement, interrupts, buffs. The add-on places the bar (Bars.lua) and the site shows it.
//
// A name resolves when it is spelled as in data/abilities.json for the build's class, or as a talent in data/talents.json
// that the build takes (Mortal Strike on an Arms bar, never on a Fury one). Names that are on no bar of anyone's, or not
// on every character's, are refused: passives, a hunter's pet and a warlock's demon abilities, one race's priest spells,
// one faction's teleports and portals.

const ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
export const BAR_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-', '='];

/** The talent names a build takes, from its point order: letters into the class's talents, tree by tree, each by
 *  (row, col), as the site and the add-on read it. A build still written with names (static/builds.json) is read as is. */
function buildTalents(build, talents) {
  if (Array.isArray(build.order)) return new Set(build.order);
  const trees = talents[build.cls]?.trees ?? [];
  const all = trees.flatMap((t) => [...t.talents].sort((a, b) => a.row - b.row || a.col - b.col));
  const names = new Set();
  for (const ch of String(build.order ?? '')) {
    const t = all[ALPHABET.indexOf(ch)];
    if (t) names.add(t.name);
  }
  return names;
}

/** Why a trainer spell can go on no bar, or not on every bar of its class: a short reason, or null when it can. */
function refused(cls, spell, raceOnly) {
  const first = String(spell.desc ?? '').split('\n')[0];
  // A spell you cast says how: instant, a cast time, channeled or on the next swing. Passives say none of it (Safe Fall,
  // Feline Grace, Reincarnation, which the game offers on death).
  if (/^Passive\b/i.test(first) || !/(Instant|\bcast\b|Channeled|Next melee)/i.test(first)) return 'a passive';
  if (/\bPet:/.test(first) || /\bFocus\b/.test(first)) return "a pet's ability";
  if (/\bDemon:/.test(first)) return "a demon's ability";
  if (raceOnly.has(spell.name)) return 'one race only';
  if (/^(Teleport|Portal): /.test(spell.name)) return 'one faction only';
  return null;
}

/**
 * What is wrong with the bars, as { id, index, text }: index is the key (0 for 1, 11 for =) for a problem with one name,
 * undefined for one with a whole bar. None means every build has a bar of 12 keys and every name resolves for its class.
 */
export function barIssues(bars, { builds, abilities, talents, races }) {
  const issues = [];
  if (!bars || typeof bars !== 'object' || Array.isArray(bars)) return [{ id: 'bars', text: 'not an object of build ids' }];
  const byId = new Map(builds.map((b) => [b.id, b]));
  for (const id of Object.keys(bars)) if (!byId.has(id)) issues.push({ id, text: 'no such build in data/builds.json' });
  for (const b of builds) {
    const bar = bars[b.id];
    if (!Array.isArray(bar)) {
      issues.push({ id: b.id, text: 'no bar' });
      continue;
    }
    if (bar.length !== 12) issues.push({ id: b.id, text: `${bar.length} keys, not 12` });
    const spells = new Map();
    for (const a of abilities[b.cls] ?? []) if (!spells.has(a.name)) spells.set(a.name, a);
    const classTalents = new Set((talents[b.cls]?.trees ?? []).flatMap((t) => t.talents.map((x) => x.name)));
    const taken = buildTalents(b, talents);
    const raceOnly = new Set((races ?? []).flatMap((r) => (r.racialVariants?.[b.cls] ?? []).map((v) => v.name)));
    const seen = new Set();
    bar.forEach((name, index) => {
      const say = (text) => issues.push({ id: b.id, index, text });
      if (name === null) return;
      if (typeof name !== 'string' || name.trim() !== name || name === '') return say(`${JSON.stringify(name)} is not a name or null`);
      if (seen.has(name)) return say(`${name} is on the bar twice`);
      seen.add(name);
      if (classTalents.has(name)) {
        // A talent's spell: the build has to take the talent.
        if (!taken.has(name)) return say(`${name} is a talent this build does not take`);
        if (!spells.has(name)) return say(`${name} is a talent with no spell of its own`);
        return;
      }
      const spell = spells.get(name);
      if (!spell) return say(`${name} is not a ${b.cls} ability or talent`);
      const why = refused(b.cls, spell, raceOnly);
      if (why) say(`${name} is ${why}`);
    });
  }
  return issues;
}

/** The problems with the bars, one line each (see barIssues). */
export function checkBars(bars, data) {
  return barIssues(bars, data).map((p) => `${p.id}${p.index === undefined ? '' : ` key ${BAR_KEYS[p.index] ?? p.index + 1}`}: ${p.text}`);
}

/** The bars as they are written to data/bars.json and read by the add-on: the builds' order, 12 keys each. */
export function orderBars(bars, builds) {
  const out = {};
  for (const b of builds) if (Array.isArray(bars[b.id])) out[b.id] = bars[b.id].slice(0, 12);
  return out;
}
