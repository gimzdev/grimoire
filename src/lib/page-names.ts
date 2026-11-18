// Pages of one kind that share a name. 588 quest names are shared by 1,978 quests (the 32 turn-ins of "An Earnest
// Proposition", every step of "The Missing Diplomat"), 135 item names by 432 items (the five ranks of a ring), 66
// creature names by 138 creatures. Each of them carries what tells it apart in its title, and its number in its
// description when the description would be another page's too, so that no two pages of the site answer a search
// with the same line (scripts/site/crawl.mjs checks that over the whole sitemap).
import { getItems, getMinorItems, getNpcs, getQuests } from './data';
import { statLine } from './item-format';
import { categoryName } from './quests';
import type { Item, MinorItem, Npc, Quest } from './types';
import { QUALITY, SLOT } from './wow';

type Tell<T> = (x: T) => string | undefined;

/** For each entry whose name another one has: the first label that tells every entry of that name apart, else its number. */
function apart<T>(all: T[], name: (x: T) => string, id: (x: T) => number, tells: Tell<T>[], number: (id: number) => string): Map<number, string> {
  const groups = new Map<string, T[]>();
  for (const x of all) {
    const g = groups.get(name(x));
    if (g) g.push(x);
    else groups.set(name(x), [x]);
  }
  const out = new Map<number, string>();
  for (const g of groups.values()) {
    if (g.length < 2) continue;
    const tell = tells.find((t) => {
      const v = g.map(t);
      return v.every(Boolean) && new Set(v).size === v.length;
    });
    for (const x of g) out.set(id(x), tell?.(x) ?? number(id(x)));
  }
  return out;
}

/** The lines more than one entry would have. */
function shared<T>(all: T[], line: (x: T) => string): Set<string> {
  const seen = new Set<string>();
  const twice = new Set<string>();
  for (const x of all) {
    const l = line(x);
    if (seen.has(l)) twice.add(l);
    else seen.add(l);
  }
  return twice;
}

const cache = new Map<string, unknown>();
function once<T>(key: string, build: () => T): T {
  if (!cache.has(key)) cache.set(key, build());
  return cache.get(key) as T;
}

/** A real zone's name: a quest category ("Shaman") or a place without a name tells nothing apart. */
const place = (z: number) => {
  if (z <= 0) return undefined;
  const n = categoryName(z);
  return n === 'Unknown' ? undefined : n;
};

// Quests

const questLabels = () =>
  once('quests', () =>
    apart<Quest>(
      getQuests(),
      (q) => q.n,
      (q) => q.i,
      [
        (q) => (place(q.z) ? `quest in ${place(q.z)}` : undefined),
        (q) => ((q.fs ?? q.s) === 1 ? 'Alliance quest' : (q.fs ?? q.s) === 2 ? 'Horde quest' : undefined),
        (q) => (q.l > 0 ? `level ${q.l} quest` : undefined),
      ],
      (id) => `quest ${id}`,
    ),
  );

export const questTitle = (q: Quest) => `${q.n} (${questLabels().get(q.i) ?? 'quest'})`;

/** Where a line says something is: nothing for a place the data has no name for. */
const inPlace = (z: number) => {
  const n = categoryName(z);
  return n === 'Unknown' ? '' : ` in ${n}`;
};

const questLine = (q: Quest, name = q.n) => {
  // A zone is where a quest is; a category is the kind of quest it is, a class's, a profession's or an event's ("a level
  // 23 Shaman quest", not "a quest in Shaman"). Quests filed nowhere (category 0) are quests and no more.
  const category = q.z < 0 ? categoryName(q.z) : 'Unknown';
  const kind = category === 'Unknown' ? 'quest' : `${category} quest`;
  const what = q.l > 0 ? `a level ${q.l} ${kind}` : `${/^[AEIOU]/.test(kind) ? 'an' : 'a'} ${kind}`;
  return `${name}: ${what}${q.z > 0 ? inPlace(q.z) : ''}${q.r ? `, requires level ${q.r}` : ''}. ${q.o ?? ''}`.trim().slice(0, 160);
};

export function questDescription(q: Quest): string {
  const line = questLine(q);
  return once('questLines', () => shared(getQuests(), (x) => questLine(x))).has(line) ? questLine(q, `${q.n} (quest ${q.i})`) : line;
}

// Items: the gear database and the items outside it (quest items, trade goods) are one set of pages

interface Named {
  i: number;
  n: string;
  l: number;
}

const itemLabels = () =>
  once('items', () =>
    apart<Named>(
      [...getItems().map((it) => ({ i: it.i, n: it.n, l: it.l })), ...Object.entries(getMinorItems()).map(([id, m]) => ({ i: Number(id), n: m[0], l: m[5] }))],
      (x) => x.n,
      (x) => x.i,
      [(x) => (x.l > 0 ? `item level ${x.l}` : undefined)],
      (id) => `item ${id}`,
    ),
  );

export function itemTitle(id: number, name: string): string {
  const label = itemLabels().get(id);
  return label ? `${name} (${label})` : name;
}

const itemLine = (it: Item, name = it.n) => {
  const stats = statLine(it, 6).join(', ');
  return `${name}: item level ${it.l} ${QUALITY[it.q].toLowerCase()} ${SLOT[it.s]?.toLowerCase() ?? 'item'} in World of Warcraft: Forever${stats ? ` (${stats})` : ''}.`;
};

export function itemDescription(it: Item): string {
  const line = itemLine(it);
  return once('itemLines', () => shared(getItems(), (x) => itemLine(x))).has(line) ? itemLine(it, `${it.n} (item ${it.i})`) : line;
}

/** An item outside the gear database: its number is in the line when another item has its name. */
export const minorItemDescription = (id: number, m: MinorItem, sources: number | undefined) =>
  `${m[0]}${itemLabels().has(id) ? ` (item ${id})` : ''}: where it drops in World of Warcraft: Forever${sources ? `, from ${sources} sources with drop chances` : ''}, and the quests that use it.`;

// Creatures and people

type Entry = [id: number, npc: Npc];

const npcLabels = () =>
  once('npcs', () =>
    apart<Entry>(
      Object.entries(getNpcs()).map(([id, n]) => [Number(id), n]),
      (x) => x[1][0],
      (x) => x[0],
      [
        (x) => (place(x[1][6]) ? `NPC in ${place(x[1][6])}` : undefined),
        (x) => (x[1][2] > 0 ? (x[1][2] === x[1][3] ? `level ${x[1][2]} NPC` : `level ${x[1][2]} to ${x[1][3]} NPC`) : undefined),
      ],
      (id) => `NPC ${id}`,
    ),
  );

export const npcTitle = (id: number, n: Npc) => `${n[0]} (${npcLabels().get(id) ?? 'NPC'})`;

const npcLine = (n: Npc, name = n[0]) => {
  const lv = n[2] <= 0 ? 'new in Forever' : n[2] === n[3] ? `level ${n[2]}` : `levels ${n[2]} to ${n[3]}`;
  return `${name}${n[1] ? `, ${n[1]}` : ''}, ${lv}${n[6] ? inPlace(n[6]) : ''}: quests, drops with drop chances, and what it sells.`;
};

export function npcDescription(id: number, n: Npc): string {
  const line = npcLine(n);
  return once('npcLines', () => shared(Object.values(getNpcs()), (x) => npcLine(x))).has(line) ? npcLine(n, `${n[0]} (NPC ${id})`) : line;
}
