#!/usr/bin/env node
// The tables of content/guides/professions-1-to-300.md, all from VMaNGOS (patch 1.12) and the tree's data/:
//   <profession>-path:     a recipe for each stretch of skill from 1 to 300, among the recipes a trainer teaches, the
//                          profession starts with, or a vendor sells the pattern of, and that have no cooldown and need
//                          no specialization. Each stretch is the orange recipe
//                          (learn skill to skill_line_ability.min_value) with the fewest reagents, the longest-lasting
//                          of those, kept until it turns yellow; where none is orange, the one that stays yellow
//                          longest, until a recipe turns orange again.
//   <profession>-patterns: every recipe learned past skill 225 and where it comes from: its trainers (npc_trainer), or
//                          its recipe item's vendors (data/vendors.json, with the reputation item_template asks for),
//                          drops (data/drops.json, the three likeliest) and quest rewards (quest_template).
//   skinning-levels:       what skinnable beasts of each level band give (skinning_loot_template), the zones with the
//                          most of them (data/npcs.json), and the skill the band's top level needs by the rule of
//                          VMaNGOS's server (Spell.cpp, the skinning cast check): (level - 10) x 10 while your skill
//                          is under 100, level x 5 from 100.
// Forever's changes the tree records (content/guides/professions.md) are applied in FOREVER below.
//
//   node scripts/guides/professions.mjs --vmangos mangos.sqlite [--data data]
import { isMain, itemLink, main, npcLink, table, zoneLink } from './lib.mjs';

export const guide = 'content/guides/professions-1-to-300.md';

const BUILD = 5875; // client 1.12.1, the build VMaNGOS's spell and skill tables are keyed by
const PATCH = 10; // 1.12 in the world tables
const CRAFTS = [
  ['leatherworking', 165],
  ['tailoring', 197],
  ['blacksmithing', 164],
  ['engineering', 202],
  ['enchanting', 333],
  ['alchemy', 171],
];
const SPECIALIZATION = {
  ...{ 10656: 'Dragonscale', 10657: 'Dragonscale', 10658: 'Elemental', 10659: 'Elemental', 10660: 'Tribal', 10661: 'Tribal' },
  ...{ 9788: 'Armorsmith', 9787: 'Weaponsmith', 17039: 'Swordsmith', 17042: 'Swordsmith', 17040: 'Hammersmith', 17044: 'Hammersmith', 17041: 'Axesmith', 17043: 'Axesmith' },
  ...{ 20219: 'Gnomish', 20222: 'Goblin' },
};
// A specialization's masters teach its recipes only to crafters who took it; their titles name it.
const SPEC_TRAINER = /\b(Dragonscale|Elemental|Tribal|Armorsmith|Weaponsmith|Swordsmith|Hammersmith|Axesmith|Gnome|Goblin)\b/;
const SPEC_NAME = { Gnome: 'Gnomish' };
// Forever's changes to Classic's recipes, from content/guides/professions.md: recipes the launch client moved or
// removed (by what they make), reagent counts from Blizzard's hotfixes of November 11, and a recipe whose skill-ups
// Forever moved (November 10) and so cannot be placed on a Classic path.
const FOREVER = {
  moved: /^(?:Minor |Lesser |Greater |Superior |Major )?Healing Potion$/, // to First Aid
  removed: ['Elixir of Tongues', 'Elixir of Poison Resistance', 'Cowardly Flight Potion', 'Purification Potion', 'Charged Scale of Onyxia', 'Crystal Throat Lozenge'],
  reagents: { 'Red Mageweave Bag': ['Bolt of Mageweave', 5], 'Green Silk Pack': ['Bolt of Silk Cloth', 5], 'Black Silk Pack': ['Bolt of Silk Cloth', 6], 'Green Woolen Bag': ['Bolt of Woolen Cloth', 5], 'Red Woolen Bag': ['Bolt of Woolen Cloth', 5] },
  offPath: ['Coarse Grinding Stone'],
};
const RANKS = ['Hated', 'Hostile', 'Unfriendly', 'Neutral', 'Friendly', 'Honored', 'Revered', 'Exalted'];
const LEARN_SPELL = 36;
const CREATE_ITEM = 24;

const lastBy = (rows, key) => {
  const m = new Map();
  for (const r of rows) m.set(r[key], r);
  return m;
};

function recipeBook(db, data, skill) {
  const spell = db.prepare('SELECT * FROM spell_template WHERE entry = ? AND build <= ? ORDER BY build DESC LIMIT 1');
  const taught = (id) => {
    const s = spell.get(id, BUILD);
    return s && s.effect1 === LEARN_SPELL ? s.effectTriggerSpell1 : 0;
  };
  const gear = new Map(data('items.json').map((it) => [it.i, it.n]));
  const itemName = (id) => data('minor-items.json')[id]?.[0] ?? gear.get(id);
  const lines = lastBy(db.prepare('SELECT * FROM skill_line_ability WHERE skill_id = ? AND build <= ? ORDER BY id, build').all(skill, BUILD), 'id');
  const recipes = new Map();
  for (const l of lines.values()) {
    if (!l.max_value) continue; // the profession's rank spells
    const s = spell.get(l.spell_id, BUILD);
    if (!s) continue;
    const made = (s.effect1 === CREATE_ITEM && itemName(s.effectItemType1)) || s.name;
    if (FOREVER.moved.test(made) || FOREVER.removed.includes(made)) continue;
    const change = FOREVER.reagents[s.name];
    const reagents = [];
    for (let i = 1; i <= 8; i++) {
      const id = s[`reagent${i}`];
      if (id) reagents.push([id, change && itemName(id) === change[0] ? change[1] : s[`reagentCount${i}`]]);
    }
    recipes.set(l.spell_id, {
      spell: l.spell_id,
      name: s.name,
      yellow: l.min_value,
      grey: l.max_value,
      start: l.learn_on_get_skill ? 1 : 0,
      creates: s.effect1 === CREATE_ITEM ? s.effectItemType1 : 0,
      cooldown: s.recoveryTime > 0 || s.categoryRecoveryTime > 0,
      reagents,
      trainers: new Map(),
      items: [],
    });
  }
  // Trainers: their own lists and the shared lists creatures point to.
  const trainerRows = [
    ...db.prepare('SELECT entry AS npc, spell, reqskillvalue AS req FROM npc_trainer WHERE reqskill = ? AND build_min <= ? AND build_max >= ?').all(skill, BUILD, BUILD),
    ...db
      .prepare(
        `SELECT c.entry AS npc, t.spell, t.reqskillvalue AS req FROM npc_trainer_template t
         JOIN (SELECT DISTINCT entry, trainer_id FROM creature_template WHERE trainer_id > 0 AND patch <= ?) c ON c.trainer_id = t.entry
         WHERE t.reqskill = ? AND t.build_min <= ? AND t.build_max >= ?`,
      )
      .all(PATCH, skill, BUILD, BUILD),
  ];
  const npcs = data('npcs.json');
  for (const t of trainerRows) {
    const r = recipes.get(taught(t.spell));
    if (r && npcs[t.npc]) r.trainers.set(t.npc, t.req);
  }
  // Recipe items, and where each comes from.
  const rewards = new Map();
  const quests = new Set(data('quests.json').map((q) => q.i));
  const cols = [1, 2, 3, 4].map((i) => `RewItemId${i}`).concat([1, 2, 3, 4, 5, 6].map((i) => `RewChoiceItemId${i}`));
  for (const q of lastBy(db.prepare('SELECT * FROM quest_template WHERE patch <= ? ORDER BY entry, patch').all(PATCH), 'entry').values())
    for (const c of cols)
      if (q[c] && quests.has(q.entry)) {
        if (!rewards.has(q[c])) rewards.set(q[c], []);
        rewards.get(q[c]).push(q.entry);
      }
  const items = lastBy(db.prepare('SELECT * FROM item_template WHERE required_skill = ? AND patch <= ? ORDER BY entry, patch').all(skill, PATCH), 'entry');
  for (const it of items.values()) {
    const r = recipes.get(taught(it.spellid_1));
    if (!r) continue;
    r.items.push({
      id: it.entry,
      req: it.required_skill_rank,
      spec: SPECIALIZATION[it.required_spell],
      rep: it.required_reputation_faction ? `${RANKS[it.required_reputation_rank]} with ${data('factions.json')[it.required_reputation_faction]?.n ?? 'a faction'}` : '',
      vendors: (data('vendors.json')[it.entry] ?? []).filter((id) => npcs[id]),
      drops: data('drops.json')[it.entry] ?? { t: 0, s: [] },
      quests: rewards.get(it.entry) ?? [],
    });
  }
  for (const r of recipes.values()) {
    const fromTrainer = r.trainers.size ? Math.min(...r.trainers.values()) : 0;
    const specs = [...r.trainers.keys()].map((id) => SPEC_TRAINER.exec(npcs[id][1])?.[1]).map((x) => SPEC_NAME[x] ?? x);
    r.spec = (specs.length && specs.every(Boolean) ? specs[0] : undefined) ?? r.items.find((i) => i.spec)?.spec;
    r.learn = r.start ? 1 : fromTrainer;
    r.req = r.learn || Math.min(...r.items.map((i) => i.req).filter(Boolean), Infinity);
    // A pattern any vendor sells without a reputation also counts for the path.
    r.bought = r.learn ? undefined : r.items.find((i) => i.vendors.length && !i.rep && !i.spec);
  }
  return [...recipes.values()];
}

const makes = (r) => (r.creates ? itemLink(r.creates) : r.name);
const reagentList = (r) => r.reagents.map(([id, n]) => `${n} ${itemLink(id)}`).join(', ');

const learned = (r) => (r.start ? 'known from the start' : r.learn ? `trainer, from ${r.learn}` : `${itemLink(r.bought.id)} from a vendor, from ${r.bought.req}`);

/** The stretches from 1 to 300, as rows: skill, recipe, reagents, learned. */
function pathRows(recipes) {
  const known = recipes
    .filter((r) => (r.learn || r.bought) && r.yellow > 0 && r.reagents.length && !r.cooldown && !r.spec && !FOREVER.offPath.includes(r.name))
    .map((r) => Object.assign(r, { from: r.learn || r.bought.req }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const cost = (r) => r.reagents.reduce((n, [, c]) => n + c, 0);
  const better = (a, b, key) => b[key] - a[key] || cost(a) - cost(b);
  const rows = [];
  let s = 1;
  while (s < 300) {
    const open = known.filter((r) => r.from <= s && r.grey > s);
    const orange = open.filter((r) => r.yellow > s).sort((a, b) => cost(a) - cost(b) || b.yellow - a.yellow);
    let r = orange[0];
    let end;
    let color = 'orange';
    if (r) end = r.yellow;
    else {
      r = open.sort((a, b) => better(a, b, 'grey'))[0];
      if (!r) break;
      const next = known.filter((x) => x.from > s).map((x) => x.from);
      end = Math.min(r.grey, ...next);
      color = 'yellow';
    }
    end = Math.min(end, 300);
    rows.push([`${s} to ${end}`, makes(r), reagentList(r), learned(r), color]);
    s = end;
  }
  return rows;
}

function sourceOf(r, data) {
  const parts = [];
  if (r.trainers.size) parts.push(`Trainer: ${[...r.trainers.keys()].sort((a, b) => a - b).map(npcLink).join(', ')}`);
  const objects = data('objects.json');
  for (const it of r.items) {
    if (it.vendors.length) parts.push(`Vendor: ${it.vendors.map(npcLink).join(', ')}${it.rep ? ` (${it.rep})` : ''}`);
    if (it.quests.length) parts.push(`Quest: ${it.quests.map((q) => `[[quest:${q}]]`).join(', ')}`);
    const drops = it.drops.s.filter((d) => d[0] !== 'f').slice(0, 3);
    const name = (d) => ({ n: npcLink(d[1]), p: `${npcLink(d[1])} (pickpocketed)`, s: `${npcLink(d[1])} (skinned)`, i: itemLink(d[1]) })[d[0]] ?? objects[d[1]]?.[0] ?? 'a container';
    if (drops.length) parts.push(`Drop: ${drops.map((d) => `${name(d)} ${d[2]}%`).join(', ')}${it.drops.t > drops.length ? ` and ${it.drops.t - drops.length} more` : ''}`);
  }
  return parts.join('; ');
}

/** The recipes learned past 225 with a source in the data, and how many have none. */
function patterns(recipes, data) {
  const rows = [];
  let unsourced = 0;
  for (const r of recipes.filter((x) => x.req > 225 && x.req !== Infinity).sort((a, b) => a.req - b.req || a.name.localeCompare(b.name))) {
    const source = sourceOf(r, data);
    if (!source) {
      unsourced++;
      continue;
    }
    const it = r.items.find((i) => i.req === r.req) ?? r.items[0];
    rows.push([String(r.req), `${it && !r.learn ? itemLink(it.id) : makes(r)}${r.spec ? ` (${r.spec})` : ''}`, source]);
  }
  const note = unsourced ? `\n\n${unsourced} more recipe ${unsourced === 1 ? 'item has' : 'items have'} no vendor, drop or quest in the data and ${unsourced === 1 ? 'is' : 'are'} not listed.` : '';
  const bands = [226, 251, 276].map((lo) => [lo, lo + 24]);
  return (
    bands
      .map(([lo, hi]) => [lo, hi, rows.filter((r) => Number(r[0]) >= lo && Number(r[0]) <= hi)])
      .filter(([, , list]) => list.length)
      .map(([lo, hi, list]) => `### Patterns, skill ${lo} to ${hi}\n\n${table(['Skill', 'Recipe', 'Where it comes from'], list)}`)
      .join('\n\n') + note
  );
}

function skinningRows(db, data) {
  const npcs = data('npcs.json');
  const zones = new Map(data('zones.json').map((z) => [z.id, z]));
  const loot = new Map();
  for (const l of db.prepare('SELECT * FROM skinning_loot_template WHERE patch_min <= ? AND patch_max >= ?').all(PATCH, PATCH)) {
    if (!loot.has(l.entry)) loot.set(l.entry, []);
    loot.get(l.entry).push(l);
  }
  const bands = [1, 11, 21, 31, 41, 51].map((lo) => ({ lo, hi: lo + 9, beasts: 0, items: new Map(), zones: new Map() }));
  for (const c of lastBy(db.prepare('SELECT entry, skinning_loot_id FROM creature_template WHERE skinning_loot_id > 0 AND patch <= ? ORDER BY entry, patch').all(PATCH), 'entry').values()) {
    const n = npcs[c.entry];
    const rows = loot.get(c.skinning_loot_id);
    if (!n || !rows || !n[6] || zones.get(n[6])?.inst) continue;
    const band = bands.find((b) => n[2] >= b.lo && n[2] <= b.hi);
    if (!band) continue;
    band.beasts++;
    band.zones.set(n[6], (band.zones.get(n[6]) ?? 0) + 1);
    for (const l of rows) if (l.ChanceOrQuestChance >= 10) band.items.set(l.item, (band.items.get(l.item) ?? 0) + 1);
  }
  const top = (m, k) => [...m.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0]).slice(0, k);
  const skill = (level) => (level <= 10 ? 1 : level <= 20 ? (level - 10) * 10 : level * 5);
  return bands.map((b) => [
    `${b.lo} to ${b.hi}`,
    String(skill(b.hi)),
    top(b.items, 4)
      .filter(([, n]) => n * 10 >= b.beasts)
      .map(([id]) => itemLink(id))
      .join(', '),
    top(b.zones, 5)
      .map(([id, n]) => `${zoneLink(data, id)} (${n})`)
      .join(', '),
  ]);
}

export function blocks({ db, data }) {
  const out = {};
  for (const [key, skill] of CRAFTS) {
    const recipes = recipeBook(db, data, skill);
    out[`${key}-path`] = table(['Skill', 'Make', 'Reagents for one', 'Learned', 'Color'], pathRows(recipes));
    out[`${key}-patterns`] = patterns(recipes, data);
  }
  out['skinning-levels'] = table(['Beast level', 'Skill for the top level', 'What they give most', 'Zones with the most (beasts)'], skinningRows(db, data));
  return out;
}

if (isMain(import.meta.url)) main({ guide, blocks });
