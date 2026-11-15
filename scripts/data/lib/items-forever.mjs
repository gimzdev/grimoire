// Forever's version of Classic's items, as far as it is known.
//
// The item data is Classic's (VMaNGOS, patch 1.12). Two layers bring it toward Forever, the surer first:
//
//   1. Shown by Blizzard: static/item-changes.json, each with the source that showed it.
//   2. Blizzard's published rules (WoW Forever Deep Dive, BlizzCon, 13 September 2026):
//      - Hit and Critical Strike are one stat each for spells and attacks: "with spells" leaves those lines.
//      - Bonus healing also gives a third as much bonus damage (Hide of the Wild: 42 healing, 14 damage).
//      - Items with weapon skill give less of it. The new amount is known only for the items Blizzard showed; the others
//        keep Classic's number and say so.
//
// A changed item keeps Classic's values of every field it changed in cl (null: the field was not there), the layers it
// went through in fr (b shown by Blizzard, h hit or crit, g healing, w weapon skill), what changed in words in ch
// (['u', ...] when Blizzard showed it, ['r', ...] for the rules only) and, when shown, where from in chs. Running it again
// starts from Classic's values, so nothing is applied twice.

const SPELL_STAT = /^Equip: Improves your chance to (hit|get a critical strike) with spells by ([\d.]+)%\.$/;
const HEALING = /^Equip: Increases healing done by (?:magical )?spells and effects by up to (\d+)\.$/;
const WEAPON_SKILL = /^Equip: Increased (?:Two-handed )?(?:Daggers|Swords|Axes|Maces|Bows|Guns|Crossbows|Staves|Polearms|Fist Weapons) \+(\d+)\.$/;

/** Forever's healing line: the healing and the third of it Forever adds as damage. */
export const healingLine = (heal) => `Equip: Increases healing done by up to ${heal} and damage done by up to ${Math.round(heal / 3)} for all magical spells and effects.`;

// ── Applying the layers ──

const MARKERS = ['cl', 'fr', 'chs', 'cfx', 'cst', 'cq', 'crq', 'cnr'];

/** Back to Classic's values, from cl (or the separate fields an earlier version of this file kept). */
function restore(it) {
  if (it.cl) for (const [k, v] of Object.entries(it.cl)) (v === null ? delete it[k] : (it[k] = v));
  else {
    if (it.cfx) it.fx = it.cfx;
    if (it.cst) it.st = it.cst;
    if (it.cq) it.q = it.cq;
    if (it.crq !== undefined) it.r = it.crq;
    if (it.cnr) it.nr = it.cnr;
  }
  for (const k of MARKERS) delete it[k];
  if (Array.isArray(it.ch) && (it.ch[0] === 'r' || it.ch[0] === 'u')) delete it.ch;
}

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
/** Sets a field, keeping Classic's value in cl the first time; an undefined value removes the field. */
function put(it, k, v) {
  if (same(it[k], v)) return;
  it.cl ??= {};
  if (!(k in it.cl)) it.cl[k] = k in it ? it[k] : null;
  if (v === undefined) delete it[k];
  else it[k] = v;
}

function applyRules(it, change, report) {
  const classic = it.fx ?? [];
  const flags = new Set();
  const notes = [];
  let skill = false;
  let fx = classic.map((line) => {
    let m = SPELL_STAT.exec(line);
    if (m) {
      flags.add('h');
      if (m[1] === 'hit') report.hit++;
      else report.crit++;
      return `Equip: Improves your chance to ${m[1]} by ${m[2]}%.`;
    }
    m = HEALING.exec(line);
    if (m) {
      flags.add('g');
      report.healing++;
      notes.push(`Its ${m[1]} bonus healing also adds ${Math.round(Number(m[1]) / 3)} spell damage, a third as much: Forever gives every healing item that bonus.`);
      return healingLine(Number(m[1]));
    }
    if (WEAPON_SKILL.test(line)) skill = true;
    return line;
  });
  if (flags.has('h')) {
    const hit = classic.some((l) => /chance to hit with spells/.test(l));
    const crit = classic.some((l) => /critical strike with spells/.test(l));
    notes.unshift(`Its ${hit && crit ? 'hit and crit count' : hit ? 'hit counts' : 'crit counts'} for spells and attacks alike: Forever has one Hit and one Critical Strike stat.`);
  }
  if (change) {
    for (const [from, to] of change.replace ?? []) {
      const i = fx.indexOf(from);
      if (i < 0) throw new Error(`static/item-changes.json: ${it.n} (${it.i}) has no line "${from}"`);
      fx[i] = to;
    }
    if (change.remove?.length) fx = fx.filter((l) => !change.remove.includes(l));
    if (change.add?.length) fx.push(...change.add);
    if (change.st) put(it, 'st', { ...change.st });
    if (change.q) put(it, 'q', change.q);
    if (change.r) {
      put(it, 'r', change.r);
      put(it, 'nr', undefined); // a real requirement now, not the level the item is usually found at
    }
    flags.add('b');
    notes.unshift(change.note);
    it.chs = [change.source.name, change.source.url];
    report.shown++;
  }
  if (skill && !change) {
    flags.add('w');
    report.weaponSkill++;
    notes.push('Forever items give less weapon skill than Classic’s (Edgemaster’s Handguards went from +7 to +1); this item’s new amount isn’t public yet, so its Classic number is shown.');
  }
  if (!flags.size) return false;
  put(it, 'fx', fx.length ? fx : undefined);
  it.fr = [...flags].sort().join('');
  it.ch = [flags.has('b') ? 'u' : 'r', ...notes];
  return true;
}

/** Brings items to what is known of Forever. shown: static/item-changes.json's items. */
export function foreverItems(items, shown = []) {
  const shownById = new Map(shown.map((s) => [s.id, s]));
  const report = { items: 0, hit: 0, crit: 0, healing: 0, weaponSkill: 0, shown: 0, missing: [] };
  const found = new Set();
  for (const it of items) {
    restore(it);
    const change = shownById.get(it.i);
    if (change) found.add(it.i);
    if (applyRules(it, change, report)) report.items++;
  }
  for (const s of shown) if (!found.has(s.id)) report.missing.push(`${s.name} (${s.id})`);
  return report;
}
