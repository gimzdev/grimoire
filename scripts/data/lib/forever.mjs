// What Forever adds to the leveling routes, on top of what guide.mjs works out from the open data:
//
//   notes      "I" steps for Forever's own systems and zones (the boosters, Legacy, riding, Riverglades, ...).
//   dungeons   "D" steps: a dungeon to run once, with its quests, where the route passes it. Forever pays a dungeon's
//              experience through its quests, mostly on the first run, and Blizzard keeps repeats below questing, so a route
//              suggests a dungeon once, and never more than one every few levels. A new dungeon comes with the quests
//              QuestieDB files under it (five of the nine have some); the others with their name and levels only.
//   Skyborne   the routes of the two new races: Zephras Isle's note, then the route of the race that joins their side.
//
// Two kinds of step are added, neither with a place to walk to (x and y are 0):
//   ["D", dungeon (index in guide.dun), area, 0, 0, level, [ids of the quests to take first]]
//   ["I", note (index in guide.info), area, 0, 0, level]
//
// It all comes from the guide itself, the open data in data/ (the notes on Forever's zones count QuestieDB's quests in
// data/quests.json) and the notes below; running it twice gives the same guide (it takes out what it added before). Nothing
// here needs the VMaNGOS database.

import { questXp } from './guide.mjs';
import { ROUTE_SHARE } from './questiedb.mjs';

const levelOfStep = (s) => (s[0] === 'A' || s[0] === 'T' || s[0] === 'C' || s[0] === 'F' || s[0] === 'L' ? s[6] : s[5]);
const posIndex = (s) => (s[0] === 'A' || s[0] === 'T' || s[0] === 'C' || s[0] === 'F' || s[0] === 'L' ? 3 : 2);

/* ── The dungeons: the zone a visit to one is near, which side may go, and how many quests a run takes in at most ── */
// side a: Alliance, h: Horde, b: both.
const DUNGEONS = {
  'hall-of-thanes': { area: 1, side: 'a', cap: 4 },
  'ruins-of-lordaeron': { area: 85, side: 'b', cap: 6 },
  'whelgars-excavation': { area: 11, side: 'a', cap: 6 },
  'city-of-dalaran': { area: 36, side: 'b', cap: 6 },
  'drowned-city': { area: 33, side: 'b', cap: 6 },
  'kroldok-stronghold': { area: 16591, side: 'b', cap: 6 },
  'alcaz-prison': { area: 15, side: 'b', cap: 6 },
  'blackmaw-hold': { area: 16, side: 'b', cap: 10 },
  'shapers-terrace': { area: 490, side: 'b', cap: 6 },
  'ragefire-chasm': { area: 1637, side: 'h', cap: 6 },
  'the-deadmines': { area: 40, side: 'a', cap: 7 },
  'wailing-caverns': { area: 17, side: 'b', cap: 9 },
  'shadowfang-keep': { area: 130, side: 'b', cap: 5 },
  'blackfathom-deeps': { area: 331, side: 'b', cap: 8 },
  'the-stockade': { area: 1519, side: 'a', cap: 6 },
  gnomeregan: { area: 1, side: 'a', cap: 10 },
  'razorfen-kraul': { area: 17, side: 'b', cap: 8 },
  'scarlet-monastery': { area: 85, side: 'b', cap: 7 },
  'razorfen-downs': { area: 17, side: 'b', cap: 7 },
  uldaman: { area: 3, side: 'b', cap: 9 },
  zulfarrak: { area: 440, side: 'b', cap: 9 },
  maraudon: { area: 405, side: 'b', cap: 9 },
  'the-temple-of-atalhakkar': { area: 8, side: 'b', cap: 10 },
  'blackrock-depths': { area: 51, side: 'b', cap: 12 },
  'blackrock-spire': { area: 46, side: 'b', cap: 12 },
  'dire-maul': { area: 357, side: 'b', cap: 9 },
  scholomance: { area: 28, side: 'b', cap: 10 },
  stratholme: { area: 139, side: 'b', cap: 12 },
};
// The continent of the zones a dungeon stands in, for those the guide's zone list may not hold.
const CONTINENT = { 1: 0, 3: 0, 8: 0, 11: 0, 28: 0, 33: 0, 36: 0, 40: 0, 46: 0, 51: 0, 85: 0, 130: 0, 139: 0, 1519: 0, 16591: 0, 15: 1, 16: 1, 17: 1, 331: 1, 357: 1, 405: 1, 440: 1, 490: 1, 1637: 1 };
// A route suggests at most one dungeon in each of these stretches of levels, about one every eight: the one with the most to hand
// in. Forever's new dungeons up to level 33 come first (the four with quests in QuestieDB); above that a new one is suggested
// only where no Classic dungeon fits.
const STRETCHES = [[13, 19], [20, 27], [28, 35], [36, 43], [44, 52], [53, 60]];
const NEW_FIRST_UP_TO = 33;
const CLASS_BIT = { warrior: 1, paladin: 2, hunter: 3, rogue: 4, priest: 5, shaman: 7, mage: 8, warlock: 9, druid: 11 };

/* ── Notes (the "I" steps): Forever's own content and the systems that change the climb ── */
const BASE_NOTES = {
  boosters: {
    t: 'Before you start: the experience boosters',
    b: [
      'Rest is the biggest boost you have. Log out in an inn or a capital city and rested experience builds up: your kills then give double experience until it runs out.',
      'Eat cooked food before a long stretch of fighting (Well Fed: +5% experience from kills), and sleep on a Cozy Sleeping Bag for up to +3% more.',
      'If you will play more than one character, the Legacy perks pay back first: Well Rested (more rest), Talented (talent points five levels early) and Frequent Flier (quicker flights).',
    ],
  },
  dungeons: {
    t: 'Dungeons: once each, with their quests',
    b: ['Forever pays most of a dungeon’s experience through its quests, and most of that on the first run. Since Blizzard’s hotfixes of November 9 every kill inside pays 50% more, and since those of November 13 a kill pays no one when the enemy is trivial to anyone in the group, so a high-level friend can no longer pull you through for experience. Take all of its quests before you go in, run it once, then carry on questing. The dungeons in this route are all optional, and a group makes them easy; skip any you cannot fill.'],
  },
  legacy: {
    t: 'Your first Legacy point',
    b: ['A character that reaches level 25 earns your account’s first Legacy point and opens the perk trees. If you will make more characters, Well Rested is the usual first pick; the Legacy planner has Grimoire’s four perk builds.'],
  },
  riding: {
    t: 'Riding, at 40',
    b: ['Apprentice Riding opens at level 40, and a mount comes with it: about a hundred gold for +60% speed on the ground. Keep the money from the 30s. Skyborne buy theirs at the Fairweather Stables on Zephras Isle; everyone else at their riding trainer.'],
  },
  endgame: {
    t: 'The last levels',
    b: ['From the mid 50s Classic’s quests are mostly elite and dungeon work, so this route has you kill your way through part of these levels. Group up if you can: Stratholme, Scholomance, Blackrock Depths and Spire, Dire Maul and Forever’s Blackmaw Hold and Shaper’s Terrace all pay well through their quests, and a first run’s turn-ins matter more than its kills. Blizzard says Shaper’s Terrace uses power crystals from Un’Goro at consoles inside, so collect some on the way.'],
  },
  ships: {
    t: 'New ships for the Alliance',
    b: ['Forever adds ships these routes do not use: Stormwind Harbor to Auberdine, and a stop at Hillsbrad (Southshore) on the Menethil to Auberdine line. QuestieDB places dock workers at Stormwind Harbor, but no one it traces can be tied to a new dock in Auberdine or Southshore, and no open data gives the crossing times. If one saves you a walk, such as the run through Dun Algaz to the Wetlands, take it and rejoin the route where it fits.'],
  },
};

// Forever's zones: no open data places their maps in the world (QuestieDB lists them as maps added in Forever, without their
// rectangles, and no creature or object of VMaNGOS stands in them). Where route.json routes one on its own map (`est` in the
// guide's zones, steps there) its note says the steps follow QuestieDB's places and the minutes are estimates; elsewhere,
// why the route has no steps there. Both give what QuestieDB has of their quests.
const ZONES = { riverglades: 16591, shendralas: 16651, hyjal: 616, zephras: 16593 };
const NO_MAP = 'No open data places the zone’s map in the world, so this route has no steps there.';
const OWN_MAP = 'Its steps follow the places QuestieDB traced on the zone’s own map; their distances and minutes are estimates, because no open data gives the size of that map.';

/** QuestieDB's quests of each of Forever's zones (filed under it, or given there): how many, and the levels of most of them
 * (the tenth to the ninetieth in a hundred). */
export function zoneFacts(quests = [], npcs = {}) {
  const levels = new Map(Object.values(ZONES).map((z) => [z, []]));
  for (const q of quests) {
    if (!q.qd) continue;
    const giver = (q.st ?? []).find(([k]) => k === 'n' || k === 'o');
    const zone = q.z > 0 ? q.z : giver?.[0] === 'n' ? npcs[giver[1]]?.[6] : 0;
    if (levels.has(zone)) levels.get(zone).push(q.l);
  }
  const out = {};
  for (const [zone, list] of levels) {
    const lv = list.filter(Boolean).sort((a, b) => a - b);
    const at = (f) => lv[Math.floor(f * (lv.length - 1))];
    out[zone] = { n: list.length, lo: at(0.1), hi: at(0.9) };
  }
  return out;
}

/** A routed zone's quests at its routed levels that one side can take: how many, how many each of the side's routes takes,
 * and why the others are on none (QuestieDB's traces lack a giver, a turn-in or an objective's place; they follow such a
 * quest; or the routes leave them). `take`: { coverage, incomplete, routes, quests, npcs }. */
function zoneTake(zone, side, { coverage = {}, incomplete = {}, routes = [], quests = [], npcs = {} }) {
  // the routed bands that hold the zone's quests (ten or more), as the coverage table counts them
  const levels = new Set();
  for (const [lo, hi, n, ok] of coverage[zone] ?? []) if (n >= 10 && Math.round((100 * ok) / n) >= ROUTE_SHARE) for (let l = lo; l <= hi; l++) levels.add(l);
  const bit = side === 'alliance' ? 1 : 2;
  const byId = new Map(quests.map((q) => [q.i, q]));
  const zoneOf = (q) => {
    const giver = (q.st ?? []).find(([k]) => k === 'n' || k === 'o');
    return q.z > 0 ? q.z : giver?.[0] === 'n' ? npcs[giver[1]]?.[6] : 0;
  };
  const mine = quests.filter((q) => q.qd && zoneOf(q) === zone && levels.has(q.l) && (q.s === 3 || q.s === bit));
  const missing = incomplete[zone] ?? {};
  const follows = (q) => {
    for (let p = q.pv, n = 0; p > 0 && n < 20; p = byId.get(p)?.pv, n++) if (missing[p]) return true;
    return false;
  };
  const sideRoutes = routes.filter((r) => r.faction === side);
  const taken = sideRoutes.map((r) => new Set(r.steps.filter((s) => s[0] === 'T').map((s) => s[1])));
  const counts = taken.map((set) => mine.filter((q) => set.has(q.i)).length);
  const any = mine.filter((q) => taken.some((set) => set.has(q.i)));
  const none = mine.filter((q) => !taken.some((set) => set.has(q.i)));
  const why = (w) => none.filter((q) => missing[q.i] === w).length;
  const after = none.filter((q) => !missing[q.i] && follows(q)).length;
  const group = none.filter((q) => !missing[q.i] && !follows(q) && q.gp > 1).length;
  return {
    lo: Math.min(...levels),
    hi: Math.max(...levels),
    n: mine.length,
    least: Math.min(...counts),
    most: Math.max(...counts),
    any: any.length,
    giver: why('giver'),
    taker: why('taker'),
    place: why('place'),
    after,
    group,
    left: none.length - why('giver') - why('taker') - why('place') - after - group,
  };
}

/** What a routed zone's note says of its quests, for one side. */
function takeText(k, side) {
  const who = side === 'alliance' ? 'the Alliance' : 'the Horde';
  const each = k.least === k.most ? `${k.most}` : `${k.least} to ${k.most}`;
  const parts = [
    k.giver && `${k.giver} because QuestieDB’s traces give no giver`,
    k.taker && `${k.taker} no turn-in`,
    k.place && `${k.place} no place for an objective`,
    k.after && `${k.after} because they follow one of those`,
    k.group && `${k.group} are group quests`,
  ].filter(Boolean);
  const out = parts.length ? ` ${k.n - k.any} are on none: ${parts.join(', ')}${k.left ? `, and the routes pass over the other ${k.left}` : ''}.` : k.left ? ` The routes pass over the other ${k.left}.` : '';
  return `Of the ${k.n} quests here at ${k.lo} to ${k.hi} that ${who} can take, each route takes ${each}.${out}`;
}

/** The notes on Forever's zones, with their counts; `routed`: the zones the routes have steps in; `take`: what zoneTake
 * reads (guide.coverage: area -> the zone's bands [lo, hi, quests, placed], from lib/questiedb.mjs's routableLevels;
 * guide.incomplete: area -> quest -> what QuestieDB's traces lack). Riverglades and Mount Hyjal have a note for each side. */
function zoneNotes(f, routed, take = {}) {
  const coverage = take.coverage ?? {};
  // Not routed: where the bands say why (fewer than ROUTE_SHARE percent of a band's quests placed), that; else that no map places it.
  const short = (zone) =>
    (coverage[zone] ?? [])
      .filter(([, , n, ok]) => n >= 10 && Math.round((100 * ok) / n) < ROUTE_SHARE)
      .map(([lo, hi, n, ok]) => `${Math.round((100 * ok) / n)}% of its quests at ${lo} to ${hi}`);
  const map = (zone, side) =>
    routed.has(zone)
      ? `${OWN_MAP} ${takeText(zoneTake(zone, side, take), side)}`
      : short(zone).length
        ? `QuestieDB places a giver, a taker and every objective for ${short(zone).join(' and ')}, below the ${ROUTE_SHARE}% a route needs, so this route has no steps there.`
        : NO_MAP;
  const rg = f[ZONES.riverglades];
  const sd = f[ZONES.shendralas];
  const hy = f[ZONES.hyjal];
  const zi = f[ZONES.zephras];
  const riverglades = (side) => ({
    t: `Riverglades, a Forever zone for ${rg.lo} to ${rg.hi}`,
    b: [
      'Riverglades is new: the east coast of the Eastern Kingdoms, between Redridge Mountains, the Burning Steppes and the Swamp of Sorrows, with the dungeon Krol’dok Stronghold, entered through a cave on a hill north of Sunnyglade. Alliance quests start at Farhold Keep, the Horde’s at Rog’mar. You get there by the road north of Redridge, or by the ship from Tanaris to Powderfuse Port.',
      routed.has(ZONES.riverglades)
        ? `QuestieDB has ${rg.n} of its quests, most of them for levels ${rg.lo} to ${rg.hi}. ${map(ZONES.riverglades, side)}`
        : `QuestieDB has ${rg.n} of its quests, most of them for levels ${rg.lo} to ${rg.hi}. ${map(ZONES.riverglades, side)} If you go, spend those levels there instead of the Badlands, the Swamp of Sorrows and Dustwallow Marsh, and rejoin the route at ${rg.hi + 1}.`,
    ],
  });
  const hyjal = (side) => ({
    t: 'Mount Hyjal, the endgame zone',
    b: [`Mount Hyjal is Forever’s endgame zone, on the slopes of the World Tree above Winterspring and Felwood, with Hyjal Summit (20 players) and Barrow Deeps (10); the raids open on December 9. QuestieDB has ${hy.n} of its quests, most of them for levels ${hy.lo} to ${hy.hi}. ${map(ZONES.hyjal, side)}`],
  });
  return {
    riverglades: riverglades('alliance'),
    'riverglades-horde': riverglades('horde'),
    shendralas: {
      t: `Shen’dralas, a Forever zone for ${sd.lo} to ${sd.hi}`,
      b: [`Shen’dralas lies in central Kalimdor between Mulgore, Desolace and Feralas; the Valley of Bones quests of southern Desolace send you there. QuestieDB has ${sd.n} of its quests, most of them for levels ${sd.lo} to ${sd.hi}: its story continues the centaur quests of Desolace and sends you on into Maraudon and Razorfen Downs. ${routed.has(ZONES.shendralas) ? OWN_MAP : 'Valley of Bones follows Desolace’s centaur reputation quests (Ongeku asks for 3000 reputation with the Gelkis; Broken Tears, before A Conqueror’s Crown, 3000 with the Magram), which this route leaves out with the rest of the reputation work, so it has no steps there.'}`],
    },
    hyjal: hyjal('alliance'),
    'hyjal-horde': hyjal('horde'),
    zephras: {
      t: 'Zephras Isle, levels 1 to 12',
      b: [
        routed.has(ZONES.zephras)
          ? `Every Skyborne starts on Zephras Isle, a floating island in the plane of Skywall, and plays its story up to level 12 before joining the Horde or the Alliance. QuestieDB has the island’s ${zi.n} quests; the steps below take you through them to 12. ${OWN_MAP} At 12 the island sends you on and the route picks up in your faction’s lands.`
          : `Every Skyborne starts on Zephras Isle, a floating island in the plane of Skywall, and plays its story up to level 12 before joining the Horde or the Alliance. QuestieDB has the island’s ${zi.n} quests, but no open data places the island’s map, so this part has no steps here: follow the island’s story, take every quest you find, and pick the route up below when the island sends you on.`,
        'Your class trainer’s first quests and training still come on the way: see your trainer every couple of levels.',
      ],
    },
  };
}

const note = (key, level, area) => ['I', key, area, 0, 0, level];

/** Notes: placed before the first step at or over a level (for one side only, when a third entry says so); a zone's note two
 * levels before most of its quests. */
const noteAt = (f) => [
  ['ships', 11, 'alliance'],
  ['legacy', 25],
  ['riverglades', f[ZONES.riverglades].lo - 2, 'alliance'],
  ['riverglades-horde', f[ZONES.riverglades].lo - 2, 'horde'],
  ['riding', 40],
  ['shendralas', f[ZONES.shendralas].lo - 2],
  ['hyjal', f[ZONES.hyjal].lo - 2, 'alliance'],
  ['hyjal-horde', f[ZONES.hyjal].lo - 2, 'horde'],
  ['endgame', 56],
];

/* ── Taking a guide back to what guide.mjs wrote ── */
function unforever(guide) {
  guide.routes = guide.routes.filter((r) => !r.derived);
  for (const r of guide.routes) {
    r.steps = r.steps.filter((s) => s[0] !== 'D' && s[0] !== 'I');
    delete r.p; // (the pace of data version 2, which no longer exists)
  }
  delete guide.dun;
  delete guide.info;
  delete guide.v;
}

/** The dungeon of each stretch of levels: the best of those the route reaches in it. */
function perStretch(options) {
  const picked = [];
  for (const [from, to] of STRETCHES) {
    const best = options.filter((o) => o.level >= from && o.level <= to).sort((a, b) => b.score - a.score || a.level - b.level)[0];
    if (best) picked.push(best);
  }
  return picked;
}

/**
 * @param guide data/guide.json's object (changed in place)
 * @param ctx { plan, dungeons, quests, npcs, log }
 *   plan: scripts/data/static/route.json (the zones of each race's route); dungeons: data/dungeons.json; quests and npcs:
 *   data/quests.json and data/npcs.json (for the notes on Forever's zones)
 */
export function addForever(guide, { plan, dungeons, quests, npcs, log = () => {} }) {
  unforever(guide);
  const facts = zoneFacts(quests, npcs);
  // the zones the routes (or the Skyborne's island) have steps in
  const stepIn = (steps, z) => steps.some((s) => s[0] !== 'I' && s[0] !== 'D' && s[posIndex(s)] === z);
  const routed = new Set(Object.values(ZONES).filter((z) => guide.routes.some((r) => stepIn(r.steps, z)) || Object.values(guide.islands ?? {}).some((i) => stepIn(i.steps, z))));
  const NOTES = { ...BASE_NOTES, ...zoneNotes(facts, routed, { coverage: guide.coverage, incomplete: guide.incomplete, routes: guide.routes, quests, npcs }) };
  const NOTE_AT = noteAt(facts);

  /* The dungeon table (the index in a "D" step) and the notes (the index in an "I" step) */
  const dun = [];
  const dunBySlug = new Map();
  for (const d of dungeons) {
    if (!DUNGEONS[d.slug] || d.kind !== 'dungeon') continue;
    dunBySlug.set(d.slug, dun.length);
    dun.push({ s: d.slug, n: d.name, lo: d.levels[0], hi: d.levels[1], a: DUNGEONS[d.slug].area, side: DUNGEONS[d.slug].side, new: d.isNew ? 1 : 0 });
  }
  guide.dun = dun;
  guide.info = Object.keys(NOTES).map((id) => ({ id, ...NOTES[id] }));
  const infoIndex = new Map(guide.info.map((n, i) => [n.id, i]));
  const zoneMap = (area) => guide.zones[area]?.map ?? CONTINENT[area];

  const report = [];
  for (const route of guide.routes) {
    const base = route.steps;
    const lvl = base.map(levelOfStep);
    const areaAt = (i) => base[i][posIndex(base[i])];
    const side = route.faction === 'alliance' ? 'a' : 'h';
    const classBit = CLASS_BIT[route.class] ?? 0;

    // every dungeon that could be run: the first step in its level window in or near its zone, then anywhere on its continent
    const options = [];
    for (const d of dungeons) {
      const meta = DUNGEONS[d.slug];
      const di = dunBySlug.get(d.slug);
      if (!meta || di === undefined) continue;
      if (meta.side !== 'b' && meta.side !== side) continue;
      const [lo, hi] = d.levels;
      const from = Math.min(60, lo + 1);
      const to = Math.max(from, hi - 1);
      const hostMap = zoneMap(meta.area);
      const near = [];
      const far = [];
      for (let i = 0; i < base.length; i++) {
        if (lvl[i] < from) continue;
        if (lvl[i] > to) break;
        const area = areaAt(i);
        if (area === meta.area || (guide.zones[area]?.n && guide.zones[area]?.n === guide.zones[meta.area]?.n)) near.push(i);
        // (a zone on a map of its own is a destination: no other zone's dungeon is reached from it)
        else if (hostMap !== undefined && zoneMap(area) === hostMap && !guide.zones[area]?.est) far.push(i);
      }
      // a Classic dungeon is suggested where the route passes it; a new one wherever on its continent the route is
      const candidates = d.isNew ? [...near, ...far] : near;
      if (!candidates.length) continue;
      // the quests a group takes in: this side, this class, open at the level
      const questsAt = (level) =>
        (guide.dungeonQuests[d.slug] ?? [])
          .map((id) => ({ id, s: guide.starts[id] }))
          .filter(({ s }) => s && (s[3] === 3 || s[3] === (side === 'a' ? 1 : 2)) && (!s[10] || (s[10] & (1 << (classBit - 1))) !== 0) && s[2] <= level && s[1] <= level + 4)
          .map(({ id, s }) => ({ id, xp: questXp(s[11] || 0, s[1], level) }))
          .sort((a, b) => b.xp - a.xp)
          .slice(0, meta.cap);
      // the first place the quests are open; failing that the first place at all
      const at = candidates.find((i) => questsAt(lvl[i]).length) ?? candidates[0];
      const level = lvl[at];
      const quests = questsAt(level);
      const worth = quests.reduce((a, q) => a + q.xp, 0);
      // A Classic dungeon with nothing to hand in is no suggestion; a new one is, with what QuestieDB has of its quests.
      if (!d.isNew && worth === 0) continue;
      options.push({ at, di, level, quests: quests.map((q) => q.id), score: d.isNew ? (hi <= NEW_FIRST_UP_TO ? 2e9 : 0.5) : worth, slug: d.slug });
    }
    const chosen = perStretch(options).sort((a, b) => a.at - b.at || a.level - b.level);

    // An offer at the grind steps: a dungeon open at the step's level, not already a dungeon step of this route, with at
    // least three quests this side and class can take that the route does not, of known experience. Its worth is their
    // experience alone, as a share of the level (kills inside come on top). A dungeon is offered once, at the step where its
    // quests are worth most, and a step offers one dungeon. The route's own steps, levels and hours do not change.
    const taken = new Set(base.filter((s) => s[0] === 'T').map((s) => s[1]));
    const chosenSlugs = new Set(chosen.map((o) => o.slug));
    const grinds = [];
    base.forEach((s, i) => {
      if (s[0] !== 'L') return;
      s.length = Math.min(s.length, 8); // (an offer of an earlier pass goes)
      grinds.push(i);
    });
    const offers = [];
    for (const i of grinds) {
      const level = base[i][1] - 1;
      const need = guide.levelXp?.[level];
      if (!need) continue;
      for (const d of dungeons) {
        const meta = DUNGEONS[d.slug];
        const di = dunBySlug.get(d.slug);
        if (!meta || di === undefined || chosenSlugs.has(d.slug)) continue;
        if (meta.side !== 'b' && meta.side !== side) continue;
        if (level < d.levels[0] || level > d.levels[1]) continue;
        const quests = (guide.dungeonQuests[d.slug] ?? [])
          .filter((id) => !taken.has(id))
          .map((id) => ({ id, s: guide.starts[id] }))
          .filter(({ s }) => s && s[11] > 0 && (s[3] === 3 || s[3] === (side === 'a' ? 1 : 2)) && (!s[10] || (s[10] & (1 << (classBit - 1))) !== 0) && s[2] <= level && s[1] <= level + 4)
          .map(({ id, s }) => ({ id, xp: questXp(s[11], s[1], level) }))
          .filter((q) => q.xp > 0)
          // as many as one run takes in (the dungeon card's own limit), the best first
          .sort((a, b) => b.xp - a.xp || a.id - b.id)
          .slice(0, meta.cap);
        if (quests.length < 3) continue;
        const pct = Math.round((100 * quests.reduce((a, q) => a + q.xp, 0)) / need);
        offers.push({ i, di, slug: d.slug, pct, ids: quests.map((q) => q.id) });
      }
    }
    const offeredAt = new Set();
    const offeredDun = new Set();
    for (const o of offers.sort((a, b) => b.pct - a.pct || a.i - b.i || a.di - b.di)) {
      if (offeredAt.has(o.i) || offeredDun.has(o.slug)) continue;
      offeredAt.add(o.i);
      offeredDun.add(o.slug);
      const s = base[o.i];
      while (s.length < 8) s.push(0);
      s[8] = [o.di, o.pct, o.ids];
    }

    // the steps: notes, then the dungeons
    const insert = new Map();
    const put = (at, step) => {
      if (!insert.has(at)) insert.set(at, []);
      insert.get(at).push(step);
    };
    for (const [key, level, only] of NOTE_AT) {
      if (only && only !== route.faction) continue;
      // the last levels' note is for a route that kills its way through them
      if (key === 'endgame' && !base.some((s, k) => s[0] === 'L' && lvl[k] >= level)) continue;
      const i = base.findIndex((s, k) => lvl[k] >= level);
      if (i > 0) put(i - 1, note(infoIndex.get(key), lvl[i], areaAt(i - 1)));
    }
    put(-1, note(infoIndex.get('boosters'), 1, areaAt(0)));
    if (chosen.length) put(chosen[0].at, note(infoIndex.get('dungeons'), chosen[0].level, areaAt(chosen[0].at)));
    for (const o of chosen) put(o.at, ['D', o.di, areaAt(o.at), 0, 0, o.level, o.quests]);

    const out = [...(insert.get(-1) ?? [])];
    base.forEach((s, i) => out.push(s, ...(insert.get(i) ?? [])));
    route.steps = out;
    report.push({ id: route.id, dungeons: chosen.map((o) => `${o.slug}@${o.level}`) });
  }

  /* The Skyborne: Zephras Isle, then the route of their side's race from level 11 or so. */
  const SKY = {
    'high-order-skyborne': { faction: 'alliance', name: 'High Order Skyborne', race: 95, from: { warrior: 'dwarf-warrior', hunter: 'dwarf-hunter', rogue: 'dwarf-rogue', mage: 'gnome-mage', druid: 'night-elf-druid' } },
    'windshaper-skyborne': { faction: 'horde', name: 'Windshaper Skyborne', race: 96, from: { warrior: 'orc-warrior', hunter: 'orc-hunter', rogue: 'orc-rogue', shaman: 'orc-shaman', druid: 'tauren-druid' } },
  };
  const byId = new Map(guide.routes.map((r) => [r.id, r]));
  const derived = [];
  for (const [race, def] of Object.entries(SKY)) {
    for (const [cls, baseId] of Object.entries(def.from)) {
      const base = byId.get(baseId);
      if (!base) continue;
      // where the island hands you on: the first step in the second zone of the race's plan (Loch Modan, Darkshore, the Barrens),
      // with the training before it
      const plans = (plan?.routes ?? []).find((r) => r.id === base.group)?.plan ?? [];
      const second = Array.isArray(plans[1]) ? plans[1][0] : null;
      let j = base.steps.findIndex((s) => levelOfStep(s) >= 10 && s[0] !== 'I' && s[0] !== 'D' && (s[0] === 'Z' ? s[1] === second : s[posIndex(s)] === second));
      if (j < 0) continue;
      while (j > 0 && (base.steps[j - 1][0] === 'R' || base.steps[j - 1][0] === 'N' || base.steps[j - 1][0] === 'Z')) j--;
      const first = base.steps[j];
      // the island's own steps to 12 where the guide has them (guide.islands, worked out by guide.mjs), then the race's route
      const island = guide.islands?.[`${race}-${cls}`];
      const area = island ? island.steps[0][posIndex(island.steps[0])] : first[posIndex(first)];
      // the boosters come first (the race's own route has them before the start zone this one skips), then the island
      const steps = [note(infoIndex.get('boosters'), 1, area), note(infoIndex.get('zephras'), 1, area), ...(island?.steps ?? []), ...base.steps.slice(j)];
      derived.push({
        id: `${race}-${cls}`,
        name: `${def.name} ${cls[0].toUpperCase()}${cls.slice(1)}`,
        group: 'skyborne',
        race,
        class: cls,
        faction: def.faction,
        races: [def.race],
        start: 'Zephras Isle',
        quests: steps.filter((s) => s[0] === 'T').length,
        hours: base.hours,
        walk: base.walk,
        fly: base.fly,
        // the grinds of its steps: the island's, then the last of the race's route
        ...(base.grind ? { grind: [...(island?.grind ?? []), ...base.grind.slice(base.grind.length - base.steps.slice(j).filter((s) => s[0] === 'L').length)] } : {}),
        derived: baseId,
        steps,
      });
      report.push({ id: `${race}-${cls}`, dungeons: steps.filter((s) => s[0] === 'D').map((s) => `${dun[s[1]].s}@${s[5]}`) });
    }
  }
  guide.routes.push(...derived);

  guide.v = 3;
  log(`forever: ${guide.routes.length} routes with notes and dungeons (${derived.length} Skyborne)`);
  return { guide, report };
}
