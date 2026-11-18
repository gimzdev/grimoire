/**
 * The step-by-step leveling routes (data/guide.json, worked out by scripts/data/lib/guide.mjs): one route for every race
 * and class from level 1 to 60, the class's own quests included, every step with its place on the zone map. The
 * Grimoire add-on follows the same routes in game. Each route also holds a few notes and some optional dungeons as steps
 * without a place, and the Skyborne's routes continue another race's from level 10.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { getNpc, getZoneMap } from './data';
import { CLASS_ORDER, classesFromMask } from './wow';

/**
 * A step is a short array, its first entry the kind (see guideData in scripts/data/lib/guide.mjs):
 *   ["A", quest, giver, area, x, y, level]        accept a quest (giver: creature id, or minus an object id)
 *   ["T", quest, ender, area, x, y, level]        turn it in
 *   ["C", quest, [objective indexes], area, x, y, level, target]   do objectives here (target as a giver, 0 for a place)
 *   ["Z", zone, area, x, y, level, via?]          go to a zone; via: the zones crossed on foot on the way, in order,
 *                                                 each with the point where it is entered ([zone, x, y])
 *   ["F", from node, to node, area, x, y, level]  fly (at the flight master of the first node)
 *   ["B", transport, area, x, y, level]           take a boat, zeppelin or the tram
 *   ["P", node, area, x, y, level]                learn a flight path
 *   ["R", trainer, area, x, y, level]             train with your class trainer (its creature id)
 *   ["L", level, mob or 0, area, x, y, level, share, offer?]   kill things here to that level (share: the part of
 *                                                 the level still to go when the step starts, in percent; offer: a
 *                                                 dungeon to run instead, [dungeon, percent of the level its quests give,
 *                                                 [quest ids]])
 *   ["N", innkeeper, area, x, y, level]           bind your Hearthstone at this inn
 *   ["H", 0, area, x, y, level]                   use your Hearthstone (to this place)
 *   ["S", spell, area, x, y, level]               cast a class teleport (to this place)
 *   ["I", note, area, 0, 0, level]                a note (guide.info[note]): plain text to read, not something to do
 *   ["D", dungeon, area, 0, 0, level, [quest ids]]   an optional dungeon (guide.dun[dungeon]), to run once with its quests: the
 *                                                  ids are the quests to take first (none when no open data has them)
 * where level is the character's level at the step, and area, x, y a point on a zone map in percent.
 *
 * A note ("I") and a dungeon ("D") have no place to walk to: x and y are 0 and area is only the zone they are filed under.
 * They are never a stop, a map pin, an arrow or the start of a zone visit (see hasPlace).
 */
export type NoteStep = ['I', number, number, number, number, number];
export type DungeonStep = ['D', number, number, number, number, number, number[]];
export type GuideStep =
  | ['A' | 'T', number, number, number, number, number, number]
  | ['C', number, number[], number, number, number, number, number]
  | ['Z', number, number, number, number, number]
  | ['Z', number, number, number, number, number, [number, number, number][]]
  | ['F', number, number, number, number, number, number]
  | ['B', string, number, number, number, number]
  | ['P', number, number, number, number, number]
  | ['R', number, number, number, number, number]
  | ['L', number, number, number, number, number, number]
  | ['L', number, number, number, number, number, number, number]
  | ['L', number, number, number, number, number, number, number, [number, number, number[]]]
  | ['S', number, number, number, number, number]
  | ['H' | 'N', number, number, number, number, number]
  | NoteStep
  | DungeonStep;

export type StepKind = GuideStep[0];

/** Whether a step is something to do at a place on the map. Notes and dungeons are not: they have no coordinates. */
export const hasPlace = (step: GuideStep): boolean => step[0] !== 'I' && step[0] !== 'D';

/**
 * An objective: n kill, o use an object, i collect an item (sources: the creatures and minus the objects that drop it),
 * x explore, t talk to someone (id: the creature), e escort someone (id: the creature), u use an item (id: the item;
 * sources: the creatures and minus the objects to use it on or at). Event objectives carry their own short text.
 */
export type ObjectiveKind = 'n' | 'o' | 'i' | 'x' | 't' | 'e' | 'u';
export type Objective = [kind: ObjectiveKind, id: number, count: number, text?: string | null, sources?: number[]];

export interface GuideQuest {
  n: string;
  l: number;
  /** Elite. */
  e?: 1;
  /** Class mask (bit class id - 1): a class's own quest. */
  c?: number;
  /** Quests that must all be done first. */
  p?: number[];
  /** Quests one of which must be done first. */
  pa?: number[];
  o: Objective[];
}

/**
 * A route. The data also holds the generator's own working figures for it (hours, walk, fly); they are left out of this type
 * on purpose: the site never reads or shows them.
 */
export interface GuideRoute {
  /** "night-elf-druid" */
  id: string;
  /** "Night Elf Druid" */
  name: string;
  /** The starting group in scripts/data/static/route.json: human, dwarf-gnome, night-elf, orc-troll, tauren, undead; skyborne. */
  group: string;
  /** Race and class slugs, as in data/races.json and data/classes.json. */
  race: string;
  class: string;
  faction: 'alliance' | 'horde';
  races: number[];
  /** The starting zone ("Shadowglen"). */
  start: string;
  quests: number;
  /** A Skyborne route: the id of the route whose steps it continues (it has none for Zephras Isle). */
  derived?: string;
  steps: GuideStep[];
}

/** A dungeon a route offers (guide.dun). a: the zone it stands in; side: a Alliance, h Horde, b both; new: one of Forever's own. */
export interface GuideDungeon {
  s: string;
  n: string;
  lo: number;
  hi: number;
  a: number;
  side: 'a' | 'h' | 'b';
  new: 0 | 1;
}

/** A note (guide.info): plain text, paragraph by paragraph. */
export interface GuideNote {
  id: string;
  t: string;
  b: string[];
}

/** A quest a character can start (guide.starts): name, level, required level, side (1 Alliance, 2 Horde, 3 both), giver, area, x, y, item, previous quest, class mask, experience. */
export type GuideStart = [string, number, number, number, number, number, number, number, number, number, number, number];

export interface GuideData {
  zones: Record<string, { n: string; ui: number; map: number; rect: number[] }>;
  quests: Record<string, GuideQuest>;
  npcs: Record<string, string>;
  objects: Record<string, string>;
  items: Record<string, string>;
  camps: Record<string, [number, number, number][]>;
  taxi: Record<string, { n: string; npc: number; side: string; at: number[] }>;
  trainers: Record<string, [number, number, number, number, string][]>;
  transports: Record<string, { kind: string; side: string; a: [number, number, number, string]; b: [number, number, number, string] }>;
  /** Class teleports by spell id: { n: "Teleport: Moonglade", cls: "druid", at: [area, x, y] }. */
  teleports: Record<string, { n: string; cls: string; at: [number, number, number] }>;
  starts: Record<string, GuideStart>;
  routes: GuideRoute[];
  dun: GuideDungeon[];
  info: GuideNote[];
  /** The data's version: 3 has the notes, the optional dungeons and the Skyborne routes as steps, and no pace. */
  v: number;
}

let cached: GuideData | undefined;
export function getGuideData(): GuideData {
  cached ??= JSON.parse(readFileSync(path.join(process.cwd(), 'data', 'guide.json'), 'utf8')) as GuideData;
  return cached;
}

export const getRoutes = () => getGuideData().routes;
export const getRoute = (id: string) => getRoutes().find((r) => r.id === id);
/** The routes of one race, in class order. */
export const routesOfRace = (race: string) => byClass(getRoutes().filter((r) => r.race === race));
/** The routes of one class, in the order of the routes (Alliance races first). */
export const routesOfClass = (cls: string) => getRoutes().filter((r) => r.class === cls);
const byClass = (list: GuideRoute[]) => [...list].sort((a, b) => CLASS_ORDER.indexOf(a.class) - CLASS_ORDER.indexOf(b.class));

/** The classes a quest is for when it is a class's own quest (empty for everyone's). */
export const questClasses = (id: number) => classesFromMask(getGuideData().quests[id]?.c);

/** A part of a step's text: plain words, something to link to, or a small tag. */
export type Part =
  | string
  | { quest: number; text: string }
  | { npc: number; text: string }
  | { zone: number; text: string }
  | { item: number; text: string }
  | { spell: number; text: string }
  | { dungeon: string; text: string }
  | { tag: 'class'; cls: string }
  | { tag: 'elite' };

export const KIND_LABEL: Record<StepKind, string> = {
  A: 'Accept',
  T: 'Turn in',
  C: 'Quest',
  Z: 'Travel',
  F: 'Fly',
  B: 'Sail',
  P: 'Flight path',
  R: 'Train',
  L: 'Level up',
  H: 'Hearth',
  N: 'Inn',
  S: 'Teleport',
  I: 'Note',
  D: 'Dungeon (optional)',
};

const short = (taxiName: string) => taxiName.split(',')[0];

/** "a", "a or b", "a, b or c": parts joined as a list. */
function list(parts: Part[], last: string): Part[] {
  const out: Part[] = [];
  parts.forEach((p, k) => {
    if (k) out.push(k === parts.length - 1 ? last : ', ');
    out.push(p);
  });
  return out;
}

/** Text with the names it mentions turned into links: "Talk to Great Bear Spirit" links the spirit. */
function linkify(text: string, refs: Part[]): Part[] {
  let out: Part[] = [text];
  for (const ref of refs) {
    if (typeof ref === 'string' || !('text' in ref) || ref.text.length < 3) continue;
    out = out.flatMap((p): Part[] => {
      if (typeof p !== 'string') return [p];
      const at = p.indexOf(ref.text);
      if (at < 0) return [p];
      return [p.slice(0, at), ref, p.slice(at + ref.text.length)].filter((x) => x !== '');
    });
  }
  return out;
}

const refs = () => {
  const d = getGuideData();
  // A creature without a page of its own (a few the scripts make) is named but not linked.
  const npc = (id: number): Part => (getNpc(id) ? { npc: id, text: d.npcs[id] ?? getNpc(id)![0] } : (d.npcs[id] ?? 'someone'));
  return {
    npc,
    /** A giver, ender or target: a creature, or minus an object (plain words: objects have no page). */
    who: (id: number): Part => (id > 0 ? npc(id) : (d.objects[-id] ?? 'an object')),
    whoName: (id: number) => (id > 0 ? d.npcs[id] : d.objects[-id]),
    quest: (id: number): Part => ({ quest: id, text: d.quests[id]?.n ?? `quest ${id}` }),
    zone: (id: number): Part => ({ zone: id, text: d.zones[id]?.n ?? `zone ${id}` }),
    item: (id: number): Part => ({ item: id, text: d.items[id] ?? `item ${id}` }),
  };
};

/** The tags after a quest's name: the class it belongs to, and elite where it matters. */
function tags(quest: number, elite: boolean): Part[] {
  return [...questClasses(quest).map((cls): Part => ({ tag: 'class', cls })), ...(elite && getGuideData().quests[quest]?.e ? [{ tag: 'elite' } as Part] : [])];
}

/** An objective in words. */
export function objectiveLine(o: Objective | undefined): Part[] {
  if (!o) return ['Its objectives'];
  const { npc, who, item } = refs();
  const [kind, id, count, text, sources = []] = o;
  const times = count > 1 ? `${count} ` : '';
  // An objective in the quest log's own words ("Peons Awoken") shows its count after it.
  const counted = (t: string) => (count > 1 ? `${t} (${count})` : t);
  switch (kind) {
    case 'n':
      return text ? linkify(counted(text), [npc(id)]) : ['Kill ', times, npc(id)];
    case 'i': {
      const from = sources.slice(0, 3).map(who);
      return ['Collect ', times, item(id), ...(from.length ? [' from ', ...list(from, ' or ')] : [])];
    }
    case 'o':
      return [text ? counted(text) : `Use ${getGuideData().objects[id] ?? 'the object'}`];
    case 't':
      return text ? linkify(text, [npc(id)]) : ['Talk to ', npc(id)];
    case 'e':
      return text ? linkify(text, [npc(id)]) : ['Escort ', npc(id)];
    case 'u': {
      const on = sources.slice(0, 3).map(who);
      if (text) return linkify(text, [item(id), ...on]);
      return ['Use ', item(id), ...(on.length ? [sources.every((s) => s < 0) ? ' at ' : ' on ', ...list(on, ' or ')] : [])];
    }
    default:
      return [text ?? 'Explore the place the quest sends you to'];
  }
}

/** The most quests a dungeon card lists to take first. */
export const DUNGEON_QUESTS_SHOWN = 8;

/** A note step's text: its title and paragraphs. */
export function noteOf(step: NoteStep): GuideNote {
  return getGuideData().info[step[1]] ?? { id: 'note', t: 'A note', b: [] };
}

/** An optional dungeon in plain data: the dungeon, the zone it stands in, and the quests to take first (the first few, and how many more). */
export interface DungeonCard {
  dungeon: GuideDungeon | undefined;
  /** The zone the dungeon stands in, when it is known. */
  zone: string | undefined;
  quests: { id: number; name: string }[];
  more: number;
}

export function dungeonOf(step: DungeonStep): DungeonCard {
  const d = getGuideData();
  const dungeon = d.dun[step[1]];
  const ids = step[6];
  // The first few are named; a single quest over the limit is named too, since "and 1 more" says less than its name does.
  const shown = ids.length > DUNGEON_QUESTS_SHOWN + 1 ? DUNGEON_QUESTS_SHOWN : ids.length;
  return {
    dungeon,
    // A few of Forever's new zones (Riverglades) are not in the guide's own zone list: the site's list names them.
    zone: dungeon ? (d.zones[dungeon.a]?.n ?? getZoneMap().get(dungeon.a)?.n) : undefined,
    quests: ids.slice(0, shown).map((id) => ({ id, name: d.starts[id]?.[0] ?? d.quests[id]?.n ?? `quest ${id}` })),
    more: ids.length - shown,
  };
}

/** A step in words: the verb it starts with (coloured by kind), the rest, and the objective lines of a "do" step. */
export interface Said {
  verb: string | null;
  parts: Part[];
  lines?: Part[][];
}

/** A step in words. bare leaves out who you talk to, for steps listed under that person's name (a stop). */
export function describe(step: GuideStep, { bare = false }: { bare?: boolean } = {}): Said {
  const d = getGuideData();
  const { npc, who, whoName, quest, zone } = refs();
  switch (step[0]) {
    case 'A':
    case 'T': {
      // A wanted poster, or a quest named after the one who gives it, carries the quest's own name: saying it twice tells
      // nothing.
      const same = bare || whoName(step[2]) === d.quests[step[1]]?.n;
      const how = step[2] < 0 ? ' at ' : step[0] === 'A' ? ' from ' : ' to ';
      return { verb: step[0] === 'A' ? 'Accept' : 'Turn in', parts: [' ', quest(step[1]), ...tags(step[1], step[0] === 'A'), ...(same ? [] : [how, who(step[2])])] };
    }
    case 'C': {
      const q = d.quests[step[1]];
      return { verb: null, parts: [quest(step[1]), ...tags(step[1], true)], lines: step[2].map((i) => objectiveLine(q?.o[i])) };
    }
    case 'Z': {
      // "Go to the Badlands, through Hillsbrad Foothills, Arathi Highlands, the Wetlands and Loch Modan"
      const via = step.length > 6 ? (step[6] as [number, number, number][]) : [];
      const through: Part[] = [];
      via.forEach(([z], k) => through.push(k === 0 ? ', through ' : k === via.length - 1 ? ' and ' : ', ', zone(z)));
      return { verb: 'Go to', parts: [' ', zone(step[1]), ...through] };
    }
    case 'F': {
      const from = d.taxi[step[1]];
      return { verb: 'Fly to', parts: [` ${short(d.taxi[step[2]]?.n ?? 'the next flight master')}`, ...(from ? [' (talk to ', npc(from.npc), ')'] : [])] };
    }
    case 'B': {
      const t = d.transports[step[1]];
      if (!t) return { verb: 'Take the boat', parts: [] };
      const [a, x, y] = [step[2], step[3], step[4]];
      const atA = t.a[0] === a && Math.abs(t.a[1] - x) + Math.abs(t.a[2] - y) < 1;
      const how = t.kind === 'zeppelin' ? 'the zeppelin' : t.kind === 'tram' ? 'the Deeprun Tram' : t.kind === 'portal' ? 'the portal' : 'the boat';
      return { verb: `Take ${how}`, parts: [` to ${atA ? t.b[3] : t.a[3]}`] };
    }
    case 'P': {
      const t = d.taxi[step[1]];
      return { verb: 'Get the flight path', parts: [` at ${short(t?.n ?? 'the flight master')}`, ...(t ? [' (', npc(t.npc), ')'] : [])] };
    }
    case 'R':
      return { verb: 'Train', parts: [' with ', npc(step[1])] };
    case 'L': {
      // The mob's level, as the add-on shows it: what you kill to get there.
      const mob = step[2] ? getNpc(step[2]) : undefined;
      const at = mob ? ` (level ${Math.round((mob[2] + mob[3]) / 2)})` : '';
      const share = step.length > 7 ? (step[7] as number) : undefined;
      const left = share ? [`: about ${share}% of the level to go`] : [];
      // the offer: a dungeon whose quests give part of the level instead
      const offer = step.length > 8 ? (step[8] as [number, number, number[]]) : undefined;
      const dun = offer ? d.dun[offer[0]] : undefined;
      const lines: Part[][] = [];
      if (offer && dun) {
        const qs: Part[] = [];
        offer[2].forEach((id, k) => qs.push(...(k ? [', '] : []), quest(id)));
        lines.push([`Or run ${dun.n} with a group: its ${offer[2].length} quests give about ${offer[1]}% of this level (their experience alone; kills inside come on top). Take its quests first: `, ...qs]);
      }
      return { verb: 'Level up', parts: [` to ${step[1]}`, ...(step[2] ? [' on ', npc(step[2]), at] : [' on the mobs around']), ...left], ...(lines.length ? { lines } : {}) };
    }
    case 'H':
      return { verb: 'Use your Hearthstone', parts: [' to ', zone(step[2])] };
    case 'N':
      return { verb: 'Make this inn your home', parts: [': talk to ', npc(step[1])] };
    case 'S': {
      const name = d.teleports[step[1]]?.n ?? 'your teleport';
      // "Teleport: Moonglade" already says where it takes you.
      const where = d.zones[step[2]]?.n;
      const named = where !== undefined && name.toLowerCase().includes(where.split(' ')[0].toLowerCase());
      return { verb: 'Cast', parts: [' ', { spell: step[1], text: name }, ...(named ? [] : [' to ', zone(step[2])])] };
    }
    case 'I':
      return { verb: null, parts: [noteOf(step).t] };
    case 'D': {
      // "Dungeon (optional): The Stockade (levels 23 to 32)", then the quests to take first.
      const card = dungeonOf(step);
      const quests: Part[] = card.quests.map((q) => ({ quest: q.id, text: q.name }));
      if (card.more > 0) quests.push(`${card.more} more`);
      return {
        verb: 'Dungeon (optional)',
        parts: [': ', card.dungeon ? { dungeon: card.dungeon.s, text: card.dungeon.n } : 'a dungeon', ...(card.dungeon ? [` (levels ${card.dungeon.lo} to ${card.dungeon.hi})`] : [])],
        lines: quests.length ? [['Take its quests first: ', ...list(quests, ' and ')]] : undefined,
      };
    }
  }
}

/**
 * Where a step happens: zone area, x, y. A note or a dungeon has no place (0, 0 after the zone it is filed under): check
 * hasPlace before showing or using the coordinates.
 */
export function placeOf(step: GuideStep): [number, number, number] {
  switch (step[0]) {
    case 'A':
    case 'T':
    case 'C':
    case 'F':
    case 'L':
      return [step[3], step[4], step[5]];
    default:
      return [step[2], step[3], step[4]];
  }
}

export const levelOf = (step: GuideStep): number => (step[0] === 'C' || step[0] === 'A' || step[0] === 'T' || step[0] === 'F' || step[0] === 'L' ? step[6] : step[5]);

/** A step and its number in the route (from 1). */
export interface Numbered {
  n: number;
  step: GuideStep;
}

export interface Visit {
  id: string;
  zone: number;
  name: string;
  from: number;
  to: number;
  quests: number;
  steps: Numbered[];
}

/**
 * The route as zone visits: a new one wherever a step sends you to another zone. A note or a dungeon never starts a visit and
 * never changes its levels: it stands in the visit of the step before it (at the very start of a route, in the first visit).
 */
export function visitsOf(route: GuideRoute): Visit[] {
  const d = getGuideData();
  const out: Visit[] = [];
  let cur: Visit | undefined;
  let waiting: Numbered[] = [];
  route.steps.forEach((step, i) => {
    const item = { n: i + 1, step };
    if (!hasPlace(step)) {
      if (cur) cur.steps.push(item);
      else waiting.push(item);
      return;
    }
    if (!cur || step[0] === 'Z') {
      const zone = step[0] === 'Z' ? step[1] : placeOf(step)[0];
      cur = { id: `visit-${out.length + 1}`, zone, name: d.zones[zone]?.n ?? `Zone ${zone}`, from: levelOf(step), to: levelOf(step), quests: 0, steps: waiting };
      waiting = [];
      out.push(cur);
    }
    // A "level up" step ends at the level it takes you to.
    cur.to = Math.max(cur.to, step[0] === 'L' ? step[1] : levelOf(step));
    if (step[0] === 'T') cur.quests++;
    cur.steps.push(item);
  });
  return out;
}

/**
 * Steps that are one stop, as the add-on shows them: quests taken and handed in with one person (or people standing
 * together, within 0.6 map units), or objectives of several quests done at one camp.
 */
export function sameStop(a: GuideStep, b: GuideStep): boolean {
  if (!hasPlace(a) || !hasPlace(b)) return false;
  const [pa, pb] = [placeOf(a), placeOf(b)];
  if (pa[0] !== pb[0]) return false;
  const quest = (s: GuideStep) => s[0] === 'A' || s[0] === 'T';
  if (quest(a) && quest(b)) return a[2] === b[2] || Math.abs(pa[1] - pb[1]) + Math.abs(pa[2] - pb[2]) <= 0.6;
  if (a[0] === 'C' && b[0] === 'C') return pa[1] === pb[1] && pa[2] === pb[2];
  return false;
}

/** At most this many steps make one stop. */
export const STOP_MAX = 6;

/** Consecutive steps that are one stop, together (a step of its own is a stop of one). */
export function stopsOf(steps: Numbered[]): Numbered[][] {
  const out: Numbered[][] = [];
  for (const s of steps) {
    const cur = out[out.length - 1];
    if (cur && cur.length < STOP_MAX && sameStop(cur[cur.length - 1].step, s.step)) cur.push(s);
    else out.push([s]);
  }
  return out;
}

/** Who you see at a stop of several steps: the people who give and take its quests, or what its objectives are on. */
export function stopTitle(stop: GuideStep[]): Part[] {
  const { who } = refs();
  const ids = [...new Set(stop.map((s) => (s[0] === 'C' ? s[7] : s[0] === 'A' || s[0] === 'T' ? s[2] : 0)).filter((id) => id !== 0))];
  if (!ids.length) {
    const area = placeOf(stop[0])[0];
    return [getGuideData().zones[area]?.n ?? 'Here'];
  }
  return list(ids.map(who), ' and ');
}

/** Whether every quest step of a stop is with one person, so its lines need not name them again. */
export const onePerson = (stop: GuideStep[]) => stop.every((s) => (s[0] === 'A' || s[0] === 'T') && s[2] === stop[0][2]);

/** A route in six pages, by the level each zone visit starts at: 1 to 9, the 10s, the 20s and so on. */
export const BANDS = ['1', '10', '20', '30', '40', '50'];
const bandOfLevel = (level: number) => Math.min(BANDS.length - 1, Math.floor(level / 10));
const bandOf = (v: Visit) => bandOfLevel(v.from);

export interface Band {
  slug: string;
  k: number;
  visits: Visit[];
  from: number;
  to: number;
  steps: number;
}

export function bandsOf(route: GuideRoute): Band[] {
  const visits = visitsOf(route);
  const bands = BANDS.map((slug, k) => {
    const list = visits.filter((v) => bandOf(v) === k);
    const from = list.length ? Math.min(...list.map((v) => v.from)) : Math.max(1, k * 10);
    const to = list.length ? Math.max(...list.map((v) => v.to)) : k * 10 + 9;
    return { slug, k, visits: list, from, to, steps: list.reduce((n, v) => n + v.steps.length, 0) };
  });
  // A level belongs to one page: a page runs to the level before the next page starts (its last visit takes you into
  // that level), and the last page to 60, where every route ends (by its last hand-in when no step stands at 60).
  bands.forEach((b, k) => {
    const next = bands[k + 1];
    b.to = next ? Math.max(b.from, next.from - 1) : Math.max(b.to, 60);
  });
  return bands;
}

/** The band a route's first page is: the band of its first step with a place. */
export function firstBand(route: GuideRoute): number {
  const first = route.steps.find(hasPlace);
  return first ? bandOfLevel(levelOf(first)) : 0;
}

/** A route's page for a band. The route's own address is its first page, whichever band that is. */
export function routeHref(id: string, k = 0): string {
  const route = getRoute(id);
  return `/tools/leveling/${id}${k > (route ? firstBand(route) : 0) ? `/${BANDS[k]}` : ''}`;
}
