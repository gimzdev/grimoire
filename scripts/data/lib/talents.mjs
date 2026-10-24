// Classes, races, talents and trainer abilities, from the talentsforever.com data export
// (CC BY 4.0, https://talentsforever.com). Each spellbook names its spells' icons as Forever's client shows them; a spell
// it leaves out takes the icon of the talent or racial of the same name, or else its talent tree's icon.

const CLASS_ORDER = ['warrior', 'paladin', 'hunter', 'rogue', 'priest', 'shaman', 'mage', 'warlock', 'druid'];
const slugify = (s) => s.toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/** Talent ids are ours and stable: class, tree, row and column. Rank spells get ids far above the game's. */
const talentId = (classIndex, treeIndex, row, col) => (classIndex + 1) * 10000 + treeIndex * 1000 + row * 10 + col;
const talentSpell = (id, rank) => 90_000_000 + id * 10 + rank;

function treeRows(tree) {
  return [...tree.talents].sort((a, b) => a.row - b.row || a.col - b.col);
}

export function buildTalents(tf, staticClasses) {
  const out = {};
  CLASS_ORDER.forEach((cls, ci) => {
    const src = tf.talents[cls[0].toUpperCase() + cls.slice(1)];
    if (!src) throw new Error(`talentsforever has no ${cls} talents`);
    const info = staticClasses.find((c) => c.slug === cls);
    const stats = { new: 0, changed: 0, same: 0, removed: 0, moved: 0, total: 0 };
    const removed = [];
    const trees = src.trees.map((tree, ti) => {
      const byName = new Map();
      const talents = treeRows(tree).map((t) => {
        const row = t.row - 1;
        const col = t.col - 1;
        const id = talentId(ci, ti, row, col);
        byName.set(t.name, { id, max: t.max });
        const c = t.classic ?? {};
        const status = c.status === 'new' ? 'new' : c.status === 'same' ? 'same' : 'changed';
        if (c.status === 'moved') stats.moved++;
        stats[status]++;
        const was =
          status === 'new'
            ? undefined
            : Object.fromEntries(
                Object.entries({
                  max: c.max && c.max !== t.max ? c.max : undefined,
                  desc: status === 'changed' && c.text ? c.text : undefined,
                  tree: c.tree && c.tree !== tree.name ? c.tree : undefined,
                  row: c.status === 'moved' && c.row ? c.row - 1 : undefined,
                  col: c.status === 'moved' && c.col ? c.col - 1 : undefined,
                }).filter(([, v]) => v !== undefined),
              );
        return {
          id,
          name: t.name,
          icon: t.icon,
          row,
          col,
          max: t.max,
          spells: Array.from({ length: t.max }, (_, r) => talentSpell(id, r + 1)),
          desc: t.desc,
          ...(t.req ? { reqName: t.req } : {}),
          status,
          ...(was && Object.keys(was).length ? { was } : {}),
        };
      });
      for (const t of talents) {
        if (!t.reqName) continue;
        const req = byName.get(t.reqName);
        if (!req) throw new Error(`${cls} ${t.name}: prerequisite ${t.reqName} is not in its tree`);
        t.req = { id: req.id, qty: req.max };
        delete t.reqName;
      }
      for (const r of tree.removed ?? []) {
        removed.push({ id: talentId(ci, ti, 9, removed.length % 10) + 100000, name: r.name, icon: tree.icon, tree: tree.name, max: r.max, desc: r.text });
      }
      return { id: tree.bg, slug: slugify(tree.name), name: tree.name, icon: tree.icon, role: info.roles[tree.name] ?? 'melee', talents };
    });
    stats.removed = removed.length;
    stats.total = stats.new + stats.changed + stats.same;
    out[cls] = { cls, trees, removed, stats };
  });
  return out;
}

/** Every talent, racial and class-ability icon in the export, by spell name. */
function iconsByName(tf) {
  const icons = new Map();
  for (const v of Object.values(tf.talents)) for (const tree of v.trees) for (const t of tree.talents) if (!icons.has(t.name)) icons.set(t.name, t.icon);
  for (const list of Object.values(tf.class_abilities ?? {})) for (const a of list) if (a[2] && !icons.has(a[0])) icons.set(a[0], a[2]);
  for (const side of Object.values(tf.racials)) for (const r of side) for (const a of r.abilities) if (!icons.has(a[0])) icons.set(a[0], a[2]);
  return icons;
}

/**
 * Trainer abilities to 60, every rank, from the class spellbooks. `classicLevels` maps a spell id to the level the
 * Classic trainer taught it (VMaNGOS), so a rank that moved can be marked.
 */
export const skippedText = [];

export function buildAbilities(tf, talents, classicLevels) {
  const icons = iconsByName(tf);
  const out = {};
  for (const cls of CLASS_ORDER) {
    const Cls = cls[0].toUpperCase() + cls.slice(1);
    const book = tf.spellbooks[Cls];
    const treeIcon = new Map(talents[cls].trees.map((t) => [t.name, t.icon]));
    const classTalentNames = new Set(talents[cls].trees.flatMap((t) => t.talents.map((x) => x.name)));
    const list = [];
    const seen = new Set();
    const tabs = [...book.tabs, { name: 'General', spells: book.general ?? [] }];
    for (const tab of tabs) {
      for (const [name, rank] of tab.spells) {
        const key = `${Cls}|${name}|${rank}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const d = tf.spell_desc[key];
        if (!d || !d.id) continue;
        const rankNo = /^Rank (\d+)$/.exec(rank)?.[1];
        const levels = book.levels?.[name];
        let level = rankNo && levels ? levels[Number(rankNo) - 1] : levels?.[0];
        if (!level) level = Number(/level (\d+)/.exec(d.lv ?? '')?.[1] ?? 0);
        if (!level) continue;
        let change;
        const note = d.cn ?? '';
        if (/was an? [A-Za-z ]*talent/i.test(note) || (classTalentNames.has(name) && /talent/i.test(note))) change = 'nowTrainable';
        else if (d.cs === 'new' && !/new low rank/i.test(note)) change = 'introduced';
        else if (classicLevels.has(d.id) && classicLevels.get(d.id) !== level) change = 'changedLevels';
        // The export marks text it filled in from Wowhead Classic with s=classic: Grimoire never uses that text.
        const borrowed = d.s === 'classic';
        if (borrowed) skippedText.push(key);
        const lines = borrowed ? [] : (d.l ?? []).map((pair) => pair.filter(Boolean).join(', ')).filter(Boolean);
        list.push({
          id: d.id,
          name,
          rank,
          icon: book.icons?.[`${name}|${rank}`] ?? book.icons?.[name] ?? icons.get(name) ?? treeIcon.get(tab.name) ?? `classicon_${cls}`,
          level,
          desc: borrowed ? '' : [lines.join('. '), d.d].filter(Boolean).join(lines.length && d.d ? '\n' : ''),
          ...(change ? { change } : {}),
        });
      }
    }
    list.sort((a, b) => a.level - b.level || a.name.localeCompare(b.name) || a.rank.localeCompare(b.rank, 'en', { numeric: true }));
    out[cls] = list;
  }
  return out;
}

const RACE_KEY = (s) => s.toLowerCase();

/** Races with their classes and racials; Priests' race spells become the race's priest variant. */
export function buildRaces(tf, staticRaces, classicCombos) {
  const tfRaces = new Map();
  for (const side of Object.values(tf.racials)) for (const r of side) tfRaces.set(RACE_KEY(r.race), r);
  let synthetic = 1;
  const priestSpells = tf.class_racials?.Priest?.races ?? {};
  return staticRaces.map((r) => {
    const src = tfRaces.get(RACE_KEY(r.source));
    if (!src) throw new Error(`talentsforever has no race ${r.source}`);
    const classes = CLASS_ORDER.filter((c) => src.classes.some((x) => x.toLowerCase() === c));
    const racial = ([name, desc, icon]) => ({
      id: 80_000_000 + synthetic++,
      name,
      icon,
      passive: !/\bInstant\b|\bcooldown\b|\bcast\b|yd range|Channeled/i.test(desc),
      desc,
    });
    const priestKey = Object.keys(priestSpells).find((k) => RACE_KEY(k) === RACE_KEY(r.source.replace(/^Skyborne \((.*)\)$/, 'Skyborne')));
    const variants = priestKey && classes.includes('priest') ? { priest: priestSpells[priestKey].map(racial) } : undefined;
    const known = classicCombos.get(r.slug);
    return {
      id: r.id,
      slug: r.slug,
      name: r.name,
      faction: r.faction,
      icon: r.icon,
      start: r.start,
      classes,
      newClasses: known ? classes.filter((c) => !known.has(c)) : classes,
      ...(r.isNew ? { isNew: true } : {}),
      racials: src.abilities.map(racial),
      ...(variants ? { racialVariants: variants } : {}),
    };
  });
}

export function buildClasses(staticClasses, talents, abilities, races) {
  return staticClasses.map((c) => {
    const t = talents[c.slug];
    const { roles, ...rest } = c;
    void roles;
    const raceList = races.filter((r) => r.classes.includes(c.slug));
    return {
      ...rest,
      specs: t.trees.map((tree) => ({ id: tree.id, slug: tree.slug, name: tree.name, icon: tree.icon, role: tree.role })),
      races: raceList.map((r) => r.slug),
      newRaces: raceList.filter((r) => r.newClasses.includes(c.slug)).map((r) => r.slug),
      talentStats: t.stats,
      abilityCount: new Set(abilities[c.slug].map((a) => a.name)).size,
    };
  });
}

/** Legacy perk trees and challenges, as the export gives them. */
export function buildLegacy(tf) {
  return tf.legacy;
}
