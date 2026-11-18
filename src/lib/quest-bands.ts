/**
 * How the zone page groups its quests. Pure functions on plain data: the zone page (server) and the
 * quest list (client) both import this, so nothing here may read files.
 */

/** The few fields the zone's quest list needs from a quest. */
export interface ZoneQuest {
  i: number;
  n: string;
  /** Quest level, 0 when the data has none. */
  l: number;
  /** Side: 1 Alliance, 2 Horde, anything else both. */
  s: number;
  /** n new in Forever, u changed, x unconfirmed, c as in Classic. */
  ch: 'n' | 'u' | 'x' | 'c';
  /** A short type such as "Group (5)" or "Dungeon". */
  t?: string;
  /** The first giver on record: kind, id and name. */
  by?: [kind: 'n' | 'o' | 'i', id: number, name: string];
  /** For a changed quest: the first line of what changed, and how many more lines there are. */
  cl?: [first: string, more: number];
}

export interface QuestGroup {
  key: string;
  title: string;
  quests: ZoneQuest[];
  /** Set when the group is one quest giver. */
  giver?: [kind: 'n' | 'o' | 'i', id: number, name: string];
}

/** Lower case, no accents, no apostrophes: "Hogger’s" and "hoggers" match. */
export function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[’‘`']/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function levelTitle(lo: number, hi: number) {
  return lo === hi ? `Level ${lo}` : `Levels ${lo} to ${hi}`;
}

const byLevel = (a: ZoneQuest, b: ZoneQuest) => (a.l || 99) - (b.l || 99) || a.n.localeCompare(b.n);

/** A list this short reads better as one list. */
export const FLAT_UNDER = 14;

/**
 * Level bands of about five levels, starting at the lowest quest. A new band also starts after a gap of
 * more than three levels, so one stray level 56 quest does not drag a band across the whole zone.
 */
export function bandByLevel(list: ZoneQuest[], width = 5): QuestGroup[] {
  const sorted = [...list].sort(byLevel);
  const known = sorted.filter((q) => q.l > 0);
  const unknown = sorted.filter((q) => q.l <= 0);
  if (!sorted.length) return [];
  const spread = known.length ? known[known.length - 1].l - known[0].l : 0;
  if (sorted.length < FLAT_UNDER || spread < width) return [{ key: 'all', title: '', quests: sorted }];
  const groups: QuestGroup[] = [];
  let cur: ZoneQuest[] = [];
  let start = 0;
  let prev = 0;
  const flush = () => {
    if (!cur.length) return;
    const lo = cur[0].l;
    const hi = cur[cur.length - 1].l;
    groups.push({ key: `l${lo}`, title: levelTitle(lo, hi), quests: cur });
    cur = [];
  };
  for (const q of known) {
    if (cur.length && (q.l - start >= width || q.l - prev > 3)) flush();
    if (!cur.length) start = q.l;
    cur.push(q);
    prev = q.l;
  }
  flush();
  if (unknown.length) groups.push({ key: 'l0', title: 'Level not recorded', quests: unknown });
  return groups;
}

/** Quests grouped by the person or object that starts them. Givers with a single quest share one group. */
export function groupByGiver(list: ZoneQuest[]): QuestGroup[] {
  const map = new Map<string, QuestGroup>();
  const rest: ZoneQuest[] = [];
  for (const q of [...list].sort(byLevel)) {
    if (!q.by) {
      rest.push(q);
      continue;
    }
    const key = `${q.by[0]}${q.by[1]}`;
    const g = map.get(key);
    if (g) g.quests.push(q);
    else map.set(key, { key: `g${key}`, title: q.by[2], giver: q.by, quests: [q] });
  }
  const groups: QuestGroup[] = [];
  const singles: ZoneQuest[] = [];
  for (const g of map.values()) {
    if (g.quests.length >= 2) groups.push(g);
    else singles.push(...g.quests);
  }
  groups.sort((a, b) => (a.quests[0].l || 99) - (b.quests[0].l || 99) || b.quests.length - a.quests.length || a.title.localeCompare(b.title));
  const other = [...singles, ...rest].sort(byLevel);
  if (other.length) groups.push({ key: 'gother', title: groups.length ? 'Other quests' : '', quests: other });
  return groups;
}

/** Whether grouping by giver would give the reader anything: at least two givers with two or more quests. */
export function giverGroupsUseful(list: ZoneQuest[]) {
  const counts = new Map<string, number>();
  for (const q of list) if (q.by) counts.set(`${q.by[0]}${q.by[1]}`, (counts.get(`${q.by[0]}${q.by[1]}`) ?? 0) + 1);
  return [...counts.values()].filter((n) => n >= 2).length >= 2;
}
