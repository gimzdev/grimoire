// The Legacy system: the account's 65 challenges and the three perk trees each character spends its points in.
// Challenges, perks, ranks, point gates and prerequisites come from the talentsforever export (CC BY 4.0, read from
// the Forever beta client); static/legacy.json adds Grimoire's own facts: which challenges form a ladder, the dungeons
// each Spelunker challenge lists, the battleground factions, and Grimoire's recommended builds.

const slug = (s) =>
  s
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

// One character per perk in plan links: its tree (in tree id order) and its place in the 4 by 4 grid.
const ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
const GRID = 4;

const CLASS_TIER = { Novice: 0, Experienced: 1, Master: 2 };
const PROF_TIER = { Journeyman: 0, Expert: 1, Artisan: 2 };

/**
 * @param tf the talentsforever export
 * @param facts static/legacy.json
 * @param classes Grimoire's classes ({ slug, name }), in the site's order
 */
export function buildLegacy(tf, facts, classes) {
  const L = tf.legacy;
  if (!L?.trees?.length || !L?.challenges?.length) throw new Error('The talentsforever export has no Legacy trees or challenges.');

  /* ── Perk trees ── */
  const byId = [...L.trees].map((t) => t.id).sort((a, b) => a - b);
  const trees = L.trees.map((t) => {
    const treeSlot = byId.indexOf(t.id);
    const named = new Map(t.perks.filter((p) => !p.placeholder).map((p) => [p.name, slug(p.name)]));
    const perks = [];
    const slots = [];
    for (const p of t.perks) {
      if (p.row < 1 || p.row > GRID || p.col < 1 || p.col > GRID) throw new Error(`Legacy perk ${p.name} sits outside the ${GRID} by ${GRID} grid.`);
      if (p.placeholder) {
        slots.push({ row: p.row, col: p.col });
        continue;
      }
      if (p.ranks?.length !== p.max) throw new Error(`Legacy perk ${p.name}: ${p.ranks?.length} rank texts for ${p.max} ranks.`);
      if (p.req && !named.has(p.req)) throw new Error(`Legacy perk ${p.name} needs ${p.req}, which is not in ${t.name}.`);
      const perk = {
        id: slug(p.name),
        code: ALPHABET[treeSlot * GRID * GRID + (p.row - 1) * GRID + (p.col - 1)],
        name: p.name,
        max: p.max,
        row: p.row,
        col: p.col,
        icon: p.icon,
        gate: p.gate ?? 0,
        ranks: p.ranks,
      };
      if (p.req) perk.req = named.get(p.req);
      // an ability you cast rather than a passive bonus: "25 sec cast | 23 hour cooldown"
      if (p.passive === false) perk.active = String(p.cost ?? '').split('|').map((s) => s.trim()).filter(Boolean);
      perks.push(perk);
    }
    perks.sort((a, b) => a.row - b.row || a.col - b.col);
    return { id: t.id, name: t.name, slug: slug(t.name), icon: t.icon, perks, slots };
  });
  const codes = new Set();
  for (const t of trees) for (const p of t.perks) {
    if (codes.has(p.code)) throw new Error(`Two Legacy perks share the plan code ${p.code}.`);
    codes.add(p.code);
  }

  /* ── Challenges ── */
  const classByName = new Map(classes.map((c) => [c.name, c.slug]));
  const profByName = new Map(Object.entries(facts.professions));
  const challenges = [];
  const add = (c, extra) => challenges.push({ name: c.name, desc: c.desc, points: c.points ?? 1, ...extra });
  for (const c of L.challenges) {
    let m;
    if (c.group === 'Classes' && (m = /^(Novice|Experienced|Master) (.+)$/.exec(c.name)) && classByName.has(m[2])) {
      const cls = classByName.get(m[2]);
      const step = CLASS_TIER[m[1]];
      add(c, { key: `class-${cls}-${facts.ladders.class[step]}`, group: 'classes', ladder: `class-${cls}`, step, cls, level: facts.ladders.class[step] });
    } else if (c.group === 'Crafting' && (m = /^(Journeyman|Expert|Artisan) /.exec(c.name))) {
      const profName = /skill in (\w+)/.exec(c.desc)?.[1];
      const p = profByName.get(profName);
      if (!p) throw new Error(`Legacy challenge ${c.name}: no tradeskill named in "${c.desc}".`);
      const step = PROF_TIER[m[1]];
      add(c, { key: `prof-${p.key}-${facts.ladders.prof[step]}`, group: 'crafting', ladder: `prof-${p.key}`, step, prof: p.key, profName, icon: p.icon, skillLine: p.skillLine, skill: facts.ladders.prof[step] });
    } else if (c.group === 'PvP' && (m = /^Rank (\d+)$/.exec(c.name))) {
      const step = facts.ladders.rank.indexOf(Number(m[1]));
      if (step < 0) throw new Error(`Legacy challenge ${c.name}: not a rank on the ladder.`);
      add(c, { key: `rank-${m[1]}`, group: 'pvp', ladder: 'rank', step, rank: Number(m[1]) });
    } else if (c.group === 'PvP' && (m = /^Field of Honor: Week (\d+)$/.exec(c.name))) {
      const step = facts.ladders.season.indexOf(Number(m[1]));
      if (step < 0) throw new Error(`Legacy challenge ${c.name}: not a week on the ladder.`);
      add(c, { key: `season-${m[1]}`, group: 'pvp', ladder: 'season', step, week: Number(m[1]) });
    } else if (c.group === 'PvP' && (m = /^Master of (.+)$/.exec(c.name)) && facts.battlegrounds[m[1]]) {
      const bg = facts.battlegrounds[m[1]];
      add(c, { key: `exalted-${m[1]}`, group: 'pvp', bg: bg.slug, bgName: m[1], factions: { alliance: bg.alliance, horde: bg.horde } });
    } else if (c.group === 'Dungeons and raids' && facts.spelunker[c.name]) {
      const s = facts.spelunker[c.name];
      const dungeons = s.dungeons.map((d) => (Array.isArray(d) ? { either: d } : typeof d === 'string' ? { slug: d } : d));
      add(c, { key: s.key, group: 'dungeons', band: s.band, dungeons });
    } else if (c.group === 'Dungeons and raids' && facts.raids[c.name]) {
      const r = facts.raids[c.name];
      add(c, { key: r.key, group: 'dungeons', raid: r.slug });
    } else if (c.group === 'Other' && facts.other[c.name]) {
      const o = facts.other[c.name];
      add(c, { key: o.key, group: 'other', icon: o.icon });
    } else {
      throw new Error(`Legacy challenge "${c.name}" (${c.group}) does not fit any group Grimoire knows: add it to static/legacy.json.`);
    }
  }
  const keys = new Set();
  for (const c of challenges) {
    if (keys.has(c.key)) throw new Error(`Two Legacy challenges share the key ${c.key}.`);
    keys.add(c.key);
  }
  // Every ladder complete: a missing step would leave a gap the planner fills in.
  const ladders = new Map();
  for (const c of challenges) if (c.ladder) ladders.set(c.ladder, [...(ladders.get(c.ladder) ?? []), c.step]);
  for (const [name, steps] of ladders) {
    const want = facts.ladders[name.split('-')[0]].length;
    if (steps.length !== want || new Set(steps).size !== want) throw new Error(`Legacy ladder ${name} has steps ${steps.join(', ')} of ${want}.`);
  }

  // Shown in this order: classes in the site's order, tradeskills A to Z, then PvP, dungeons and raids, the rest.
  const GROUPS = [
    ['classes', 'Classes'],
    ['crafting', 'Crafting'],
    ['pvp', 'PvP'],
    ['dungeons', 'Dungeons and raids'],
    ['other', 'Other'],
  ];
  const classOrder = new Map(classes.map((c, i) => [c.slug, i]));
  const within = (c) => {
    if (c.group === 'classes') return classOrder.get(c.cls) * 10 + c.step;
    if (c.group === 'crafting') return Object.keys(facts.professions).indexOf(c.profName) * 10 + c.step;
    if (c.group === 'pvp') return c.ladder === 'rank' ? c.step : c.ladder === 'season' ? 10 + c.step : 20 + Object.keys(facts.battlegrounds).indexOf(c.bgName);
    if (c.group === 'dungeons') return c.raid ? 10 + Object.values(facts.raids).findIndex((r) => r.slug === c.raid) : Object.values(facts.spelunker).findIndex((s) => s.key === c.key);
    return Object.values(facts.other).findIndex((o) => o.key === c.key);
  };
  const groupIndex = new Map(GROUPS.map(([id], i) => [id, i]));
  challenges.sort((a, b) => groupIndex.get(a.group) - groupIndex.get(b.group) || within(a) - within(b));

  /* ── Grimoire's builds: a full character's points each, every point open at its turn ── */
  const perkByCode = new Map(trees.flatMap((t) => t.perks.map((p) => [p.code, { perk: p, tree: t }])));
  const buildIds = new Set();
  const builds = (facts.builds ?? []).map((b) => {
    if (buildIds.has(b.id)) throw new Error(`Two Legacy builds share the id ${b.id}.`);
    buildIds.add(b.id);
    if (b.code.length !== L.points) throw new Error(`Legacy build ${b.id} spends ${b.code.length} points, not ${L.points}.`);
    const ranks = new Map();
    const below = (tree, gate) => tree.perks.reduce((n, p) => n + (p.gate < gate ? (ranks.get(p.id) ?? 0) : 0), 0);
    [...b.code].forEach((ch, i) => {
      const hit = perkByCode.get(ch);
      if (!hit) throw new Error(`Legacy build ${b.id}: point ${i + 1} ("${ch}") is no perk.`);
      const { perk, tree } = hit;
      const have = ranks.get(perk.id) ?? 0;
      const req = perk.req && tree.perks.find((p) => p.id === perk.req);
      if (have >= perk.max || (perk.gate > 0 && below(tree, perk.gate) < perk.gate) || (req && (ranks.get(req.id) ?? 0) < req.max)) {
        throw new Error(`Legacy build ${b.id}: point ${i + 1} (${perk.name}) is not open at its turn.`);
      }
      ranks.set(perk.id, have + 1);
    });
    return { id: b.id, name: b.name, kind: b.kind, summary: b.summary, code: b.code, points: trees.map((t) => t.perks.reduce((n, p) => n + (ranks.get(p.id) ?? 0), 0)) };
  });

  return {
    points: L.points,
    total: challenges.reduce((n, c) => n + c.points, 0),
    source: L.source,
    trees,
    groups: GROUPS.map(([id, name]) => ({ id, name, count: challenges.filter((c) => c.group === id).length })),
    challenges,
    builds,
  };
}
