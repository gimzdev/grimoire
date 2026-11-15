// Classes, races, talents and trainer abilities, from the talentsforever.com data export
// (CC BY 4.0, https://talentsforever.com). Each spellbook names its spells' icons as Forever's client shows them; a spell
// it leaves out takes the icon of the talent or racial of the same name, or else its talent tree's icon.

const CLASS_ORDER = ['warrior', 'paladin', 'hunter', 'rogue', 'priest', 'shaman', 'mage', 'warlock', 'druid'];
const slugify = (s) => s.toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/**
 * Talent ids are ours and stable. A talent keeps the id static/talent-ids.json gives it (by class and name), wherever the trees
 * move it: the add-on keeps players' own builds as talent ids. A talent not listed there gets one from its class, tree, row and
 * column, or past 900 in its tree if another talent holds that one, and is added to `fresh` for the list. Rank spells get ids
 * far above the game's.
 */
const talentId = (classIndex, treeIndex, row, col) => (classIndex + 1) * 10000 + treeIndex * 1000 + row * 10 + col;
const talentSpell = (id, rank) => 90_000_000 + id * 10 + rank;

function treeRows(tree) {
  return [...tree.talents].sort((a, b) => a.row - b.row || a.col - b.col);
}

/**
 * @param ids static/talent-ids.json's ids: { class: { talent name: id } }
 * @param fresh filled with { cls, name, id } for each talent the list did not have
 */
export function buildTalents(tf, staticClasses, ids = {}, fresh = []) {
  const out = {};
  CLASS_ORDER.forEach((cls, ci) => {
    const src = tf.talents[cls[0].toUpperCase() + cls.slice(1)];
    if (!src) throw new Error(`talentsforever has no ${cls} talents`);
    const info = staticClasses.find((c) => c.slug === cls);
    const stats = { new: 0, changed: 0, same: 0, removed: 0, moved: 0, total: 0 };
    const removed = [];
    const known = ids[cls] ?? {};
    // The listed ids of this class are taken first, by every talent that has one, so a new talent never lands on one.
    const taken = new Set(Object.values(known));
    const nextFree = (ti) => {
      for (let n = 900; n < 1000; n++) if (!taken.has((ci + 1) * 10000 + ti * 1000 + n)) return (ci + 1) * 10000 + ti * 1000 + n;
      throw new Error(`${cls}: no free talent id in tree ${ti}`);
    };
    const trees = src.trees.map((tree, ti) => {
      const byName = new Map();
      const talents = treeRows(tree).map((t) => {
        const row = t.row - 1;
        const col = t.col - 1;
        let id = known[t.name];
        if (id === undefined) {
          id = talentId(ci, ti, row, col);
          if (taken.has(id)) id = nextFree(ti);
          taken.add(id);
          fresh.push({ cls, name: t.name, id });
        }
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

/**
 * The code orders older links were written in (static/talent-layouts.json), put on each class whose trees moved since:
 * layouts = { version: [tree 1's talent names in code order, tree 2's, tree 3's] }. A name today's trees lack is a talent
 * that left them; its points are dropped when an old link is read. Returns what it put on, by class.
 */
export function addLayouts(talents, file) {
  const done = {};
  for (const [v, byClass] of Object.entries(file.versions ?? {})) {
    for (const [cls, trees] of Object.entries(byClass)) {
      const c = talents[cls];
      if (!c) throw new Error(`talent-layouts: no class ${cls}`);
      if (trees.length !== c.trees.length) throw new Error(`talent-layouts: version ${v} gives ${cls} ${trees.length} trees, not ${c.trees.length}`);
      (c.layouts ??= {})[v] = trees;
      (done[cls] ??= []).push(v);
    }
  }
  return done;
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
        // "In Classic this was an Arms talent", "Baseline now": the trainer teaches what was a talent. A rank of a talent that is
        // still one ("A talent in Classic and in Forever") is not.
        const stillTalent = /talent in Classic and in Forever/i.test(note);
        if (/was an? [A-Za-z ]*talent/i.test(note) || (classTalentNames.has(name) && /talent/i.test(note) && !stillTalent)) change = 'nowTrainable';
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

/**
 * A spell a talent teaches (Divine Favor, Swiftmend) is listed at the first level its talent can be taken: ten, plus five for each row
 * above the first, wherever the spellbook puts it. Later ranks are trainer levels and stay where they are. Returns what it moved.
 */
export function relevelTalentSpells(abilities, talents) {
  const done = [];
  for (const [cls, list] of Object.entries(abilities)) {
    const rows = new Map();
    for (const tree of talents[cls].trees) for (const t of tree.talents) rows.set(t.name, t.row);
    for (const a of list) {
      if (a.rank && a.rank !== 'Rank 1') continue;
      if (!rows.has(a.name)) continue;
      const level = 10 + rows.get(a.name) * 5;
      if (a.level === level) continue;
      done.push(`${cls}/${a.name} ${a.level} -> ${level}`);
      a.level = level;
    }
    list.sort((x, y) => x.level - y.level || x.name.localeCompare(y.name) || x.rank.localeCompare(y.rank, 'en', { numeric: true }));
  }
  return done;
}

const RACE_KEY = (s) => s.toLowerCase();

const RACE_SLUG = { 1: 'human', 2: 'orc', 3: 'dwarf', 4: 'night-elf', 5: 'undead', 6: 'tauren', 7: 'gnome', 8: 'troll' };
const CLASS_SLUG = { 1: 'warrior', 2: 'paladin', 3: 'hunter', 4: 'rogue', 5: 'priest', 7: 'shaman', 8: 'mage', 9: 'warlock', 11: 'druid' };

/** The classes each race could be in Classic (VMaNGOS's playercreateinfo): race slug -> Set of class slugs. */
export function classicCombos(db) {
  const combos = new Map();
  for (const r of db.prepare('SELECT DISTINCT race, class FROM playercreateinfo').all()) {
    const race = RACE_SLUG[r.race];
    const cls = CLASS_SLUG[r.class];
    if (!race || !cls) continue;
    if (!combos.has(race)) combos.set(race, new Set());
    combos.get(race).add(cls);
  }
  return combos;
}

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
