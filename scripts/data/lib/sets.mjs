// Item sets, built from the items themselves: VMaNGOS gives every set piece its set's id (item_template.set_id), so the
// pieces of a set are known, and with them its quality, levels, classes and where each piece drops. A set's name and its
// bonuses are not in VMaNGOS (they live in the game client), so Grimoire names a set after what its pieces share
// ("Cenarion", "Might", "Warlord's Plate") and leaves the bonuses to the game's own tooltip.

const ALLIANCE = ['Private', 'Corporal', 'Sergeant', 'Master Sergeant', 'Sergeant Major', 'Knight', 'Knight-Lieutenant', 'Knight-Captain', 'Knight-Champion', 'Lieutenant Commander', 'Commander', 'Marshal', 'Field Marshal', 'Grand Marshal'];
const HORDE = ['Scout', 'Grunt', 'Sergeant', 'Senior Sergeant', 'First Sergeant', 'Stone Guard', 'Blood Guard', 'Legionnaire', 'Centurion', 'Champion', 'Lieutenant General', 'General', 'Warlord', 'High Warlord'];
const RANK = new Map([...ALLIANCE.map((t, i) => [t, i]), ...HORDE.map((t, i) => [t, i])]);
const GENERIC = new Set(['of', 'the', 'and', 'plate', 'mail', 'chain', 'leather', 'cloth', 'silk', 'scale', 'dragonhide', 'lamellar']);
// slot order for a set's pieces: head to feet, then the rest
const SLOT_ORDER = [1, 3, 5, 20, 9, 10, 6, 7, 8, 2, 11, 12, 16, 13, 21, 17, 22, 14, 23, 15, 25, 26, 28];

const words = (n) => n.split(/\s+/);

/** The longest run of words found, in order and next to each other, in every name. */
function commonRun(names) {
  const first = words(names[0]);
  let best = [];
  for (let a = 0; a < first.length; a++) {
    for (let b = first.length; b > a + best.length; b--) {
      const run = first.slice(a, b).join(' ');
      if (names.every((n) => ` ${n} `.includes(` ${run} `))) {
        best = first.slice(a, b);
        break;
      }
    }
  }
  return best;
}

/** A name for a set, from its pieces' names. */
export function setName(names) {
  // PvP sets: every piece starts with a rank title ("Warlord's Plate Armor"); the highest rank names the set
  const titled = names.map((n) => /^(.+?)'s (.+)$/.exec(n));
  if (titled.every((m) => m && RANK.has(m[1]))) {
    const top = titled.reduce((a, b) => (RANK.get(b[1]) > RANK.get(a[1]) ? b : a));
    // the material is the word most pieces share after the title ("Silk" in Silk Footwraps, Silk Gloves, Coronet)
    const count = new Map();
    for (const m of titled) for (const w of new Set(words(m[2]))) count.set(w, (count.get(w) ?? 0) + 1);
    const material = [...count].filter(([, n]) => n > 1).sort((a, b) => b[1] - a[1])[0]?.[0] ?? words(top[2])[0];
    return `${top[1]}'s ${material}`;
  }
  let run = commonRun(names);
  // "Belt of Might", "Boots of Might": the words after "of" name the set
  while (run.length && (run[0] === 'of' || run[0] === 'the')) run = run.slice(1);
  while (run.length && (run[run.length - 1] === 'of' || run[run.length - 1] === 'the')) run = run.slice(0, -1);
  if (run.length && !run.every((w) => GENERIC.has(w.toLowerCase()))) return run.join(' ').replace(/'s$/, '');
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return words(names[0]).slice(0, -1).join(' ') || names[0];
}

/** Every set in the items: [{ id, n, q, lo, hi, pieces, cls }], each with its pieces head to feet. */
export function itemSets(items) {
  const bySet = new Map();
  for (const it of items) {
    if (!it.set) continue;
    if (!bySet.has(it.set)) bySet.set(it.set, []);
    bySet.get(it.set).push(it);
  }
  const rank = (s) => {
    const i = SLOT_ORDER.indexOf(s);
    return i < 0 ? 99 : i;
  };
  const sets = [];
  for (const [id, pieces] of bySet) {
    pieces.sort((a, b) => rank(a.s) - rank(b.s) || a.n.localeCompare(b.n));
    const qs = pieces.map((p) => p.q);
    const q = qs.sort((a, b) => qs.filter((x) => x === b).length - qs.filter((x) => x === a).length)[0];
    const levels = pieces.map((p) => p.r || 0).filter((r) => r > 0);
    const cls = pieces.find((p) => p.cls)?.cls;
    sets.push({
      id,
      n: setName(pieces.map((p) => p.n)),
      q,
      lo: levels.length ? Math.min(...levels) : undefined,
      hi: levels.length ? Math.max(...levels) : undefined,
      pieces: pieces.map((p) => p.i),
      ...(cls ? { cls } : {}),
    });
  }
  // two sets with the same name: tell them apart by their armour, then by their pieces' level
  const ARMOR = { 1: 'Cloth', 2: 'Leather', 3: 'Mail', 4: 'Plate' };
  const byId = new Map(items.map((it) => [it.i, it]));
  const armorOf = (s) => ARMOR[s.pieces.map((p) => byId.get(p)).find((p) => p.c === 4 && ARMOR[p.sc])?.sc];
  const groups = new Map();
  for (const s of sets) {
    if (!groups.has(s.n)) groups.set(s.n, []);
    groups.get(s.n).push(s);
  }
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    const distinct = (f) => new Set(group.map(f)).size === group.length && group.every((s) => f(s));
    const label = distinct((s) => s.hi) ? (s) => `level ${s.hi}` : distinct(armorOf) ? armorOf : (s) => [armorOf(s), s.hi && `level ${s.hi}`].filter(Boolean).join(', ');
    for (const s of group) s.n = `${s.n} (${label(s)})`;
  }
  const il = (s) => Math.max(...s.pieces.map((p) => byId.get(p)?.l ?? 0));
  return sets.sort((a, b) => il(b) - il(a) || b.q - a.q || a.n.localeCompare(b.n));
}
