import { getAllAbilities, getAllTalents, getClasses, getDungeons, getGuides, getItems, getNpcs, getQuests, getRaces, getSets, getZones } from './data';
import { getRoutes } from './guide';
import { categoryName, RANK_LABEL } from './quests';
import { ICON, PAGE_ICON, creatureIcon, dungeonIcon, questIcon, setIcon } from './icons';
import { normalize } from './items';
import { NAV } from './site';
import { CLASS_COLOR, CLASS_NAMES, QUALITY_COLOR, SLOT } from './wow';

export interface Entry {
  type: 'page' | 'class' | 'race' | 'talent' | 'ability' | 'item' | 'zone' | 'dungeon' | 'guide' | 'set' | 'quest' | 'npc';
  id: string;
  name: string;
  norm: string;
  href: string;
  icon?: string;
  sub?: string;
  color?: string;
  tip?: string;
  weight: number;
}

const TITLES: Record<Entry['type'], string> = {
  page: 'Pages',
  class: 'Classes',
  race: 'Races',
  talent: 'Talents',
  ability: 'Abilities',
  item: 'Items',
  zone: 'Zones',
  dungeon: 'Dungeons and raids',
  guide: 'Guides',
  set: 'Item sets',
  quest: 'Quests',
  npc: 'NPCs',
};
const ORDER: Entry['type'][] = ['page', 'class', 'race', 'guide', 'dungeon', 'talent', 'ability', 'item', 'quest', 'npc', 'set', 'zone'];

export const slugify = (s: string) => normalize(s).replace(/ /g, '-');

let index: Entry[] | null = null;

function build(): Entry[] {
  const out: Entry[] = [];
  const add = (e: Omit<Entry, 'norm'>) => out.push({ ...e, norm: normalize(e.name) });
  for (const n of NAV) {
    add({ type: 'page', id: n.href, name: n.label, href: n.href, icon: PAGE_ICON[n.key] ?? ICON.unknown, sub: n.description, weight: 3 });
    for (const c of n.children ?? []) add({ type: 'page', id: `${c.href}-${c.label}`, name: c.label, href: c.href, icon: c.icon, sub: c.description, weight: 3 });
  }
  for (const c of getClasses()) {
    add({ type: 'class', id: c.slug, name: c.name, href: `/classes/${c.slug}`, icon: c.icon, sub: c.specs.map((s) => s.name).join(', '), color: c.color, weight: 10 });
    add({ type: 'page', id: `talents-${c.slug}`, name: `${c.name} talent calculator`, href: `/talents/${c.slug}`, icon: c.icon, sub: 'Talents', weight: 6 });
  }
  for (const r of getRaces()) add({ type: 'race', id: r.slug, name: r.name, href: `/races/${r.slug}`, icon: r.icon, sub: r.faction === 'alliance' ? 'Alliance' : 'Horde', weight: 8 });
  const classIcon = new Map(getClasses().map((c) => [c.slug, c.icon]));
  for (const r of getRoutes()) {
    add({ type: 'page', id: `route-${r.id}`, name: `${r.name} leveling route`, href: `/tools/leveling/${r.id}`, icon: classIcon.get(r.class), sub: `From ${r.start} to 60, ${r.quests} quests`, color: CLASS_COLOR[r.class], weight: 4 });
  }
  for (const [cls, data] of Object.entries(getAllTalents())) {
    for (const tree of data.trees) {
      for (const t of tree.talents) {
        add({ type: 'talent', id: `${cls}-${t.id}`, name: t.name, href: `/talents/${cls}?focus=${t.id}`, icon: t.icon, sub: `${CLASS_NAMES[cls]} talent, ${tree.name}`, color: CLASS_COLOR[cls], tip: `spell:${t.spells[t.max - 1]}`, weight: 7 });
      }
    }
  }
  for (const [cls, list] of Object.entries(getAllAbilities())) {
    const best = new Map<string, (typeof list)[number]>();
    for (const a of list) {
      const prev = best.get(a.name);
      if (!prev || a.level > prev.level) best.set(a.name, a);
    }
    for (const a of best.values()) {
      add({ type: 'ability', id: `${cls}-${a.id}`, name: a.name, href: `/abilities?class=${cls}#${slugify(a.name)}`, icon: a.icon, sub: `${CLASS_NAMES[cls]} ability, learned at ${a.level}`, color: CLASS_COLOR[cls], tip: `spell:${a.id}`, weight: 5 });
    }
  }
  for (const g of getGuides()) add({ type: 'guide', id: g.slug, name: g.title, href: `/guides/${g.slug}`, icon: g.icon, sub: g.category, weight: 7 });
  for (const d of getDungeons()) add({ type: 'dungeon', id: d.slug, name: d.name, href: `/dungeons/${d.slug}`, icon: dungeonIcon(d), sub: `${d.kind === 'raid' ? 'Raid' : d.kind === 'battleground' ? 'Battleground' : 'Dungeon'}${d.levels ? `, levels ${d.levels[0]} to ${d.levels[1]}` : ''}`, weight: d.isNew ? 9 : 6 });
  for (const z of getZones()) {
    if (z.inst === 2 || z.inst === 3) continue;
    add({ type: 'zone', id: String(z.id), name: z.n, href: `/world/${z.id}`, icon: ICON.zone, sub: z.lo ? `Levels ${z.lo} to ${z.hi}` : 'Zone', weight: z.st === 'new' ? 5 : 3 });
  }
  for (const s of getSets()) {
    if (s.era) continue;
    add({ type: 'set', id: String(s.id), name: s.n, href: `/sets?set=${s.id}#set-${s.id}`, icon: setIcon(s), sub: `${s.pieces.length} pieces`, color: QUALITY_COLOR[s.q ?? 3], weight: 3 });
  }
  for (const it of getItems()) {
    if (it.av === 'e') continue;
    add({ type: 'item', id: String(it.i), name: it.n, href: `/items/${it.i}`, icon: it.ic ?? ICON.unknown, sub: `${SLOT[it.s] ?? 'Item'}, item level ${it.l}`, color: QUALITY_COLOR[it.q], tip: `item:${it.i}`, weight: 2 + Math.min(3, Math.log10((it.pop ?? 0) + 1)) });
  }
  for (const q of getQuests()) {
    add({ type: 'quest', id: String(q.i), name: q.n, href: `/quests/${q.i}`, icon: questIcon(q), sub: `${q.l > 0 ? `Level ${q.l} quest` : 'Quest'}, ${categoryName(q.z)}${q.ch === 'n' ? ', new in Forever' : ''}`, color: '#f4da9b', tip: `quest:${q.i}`, weight: 2 + Math.min(3, Math.log10((q.pop ?? 0) + 1)) + (q.ch === 'n' ? 0.5 : 0) });
  }
  for (const [id, n] of Object.entries(getNpcs())) {
    const rank = RANK_LABEL[n[4]];
    add({ type: 'npc', id, name: n[0], href: `/npcs/${id}`, icon: creatureIcon(n[8]), sub: capFirst([n[1], n[2] > 0 ? `level ${n[2] === n[3] ? n[2] : `${n[2]} to ${n[3]}`}${rank ? ` ${rank.toLowerCase()}` : ''}` : rank, n[6] ? categoryName(n[6]) : null].filter(Boolean).join(', ')), tip: `npc:${id}`, weight: rank ? 3 : 1.5 });
  }
  return out;
}

export function searchIndex() {
  return (index ??= build());
}

function score(e: Entry, q: string, words: string[]) {
  if (e.norm === q) return 100 + e.weight;
  if (e.norm.startsWith(q)) return 70 + e.weight;
  if (words.every((w) => e.norm.split(' ').some((p) => p.startsWith(w)))) return 50 + e.weight;
  if (words.every((w) => e.norm.includes(w))) return 25 + e.weight;
  return 0;
}

const capFirst = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

export function search(raw: string, perGroup = 6, types?: Entry['type'][]) {
  const q = normalize(raw);
  if (q.length < 2) return [];
  const words = q.split(' ').filter(Boolean);
  const hits: { e: Entry; s: number }[] = [];
  for (const e of searchIndex()) {
    if (types && !types.includes(e.type)) continue;
    const s = score(e, q, words);
    if (s > 0) hits.push({ e, s });
  }
  hits.sort((a, b) => b.s - a.s || a.e.name.length - b.e.name.length);
  const groups = new Map<Entry['type'], Entry[]>();
  for (const h of hits) {
    const g = groups.get(h.e.type) ?? [];
    if (g.length < perGroup) g.push(h.e);
    groups.set(h.e.type, g);
  }
  const best = hits[0]?.e.type;
  return ORDER.filter((t) => groups.has(t))
    .sort((a, b) => (a === best ? -1 : b === best ? 1 : 0))
    .map((t) => ({
      type: t,
      title: TITLES[t],
      total: hits.filter((h) => h.e.type === t).length,
      hits: (groups.get(t) ?? []).map(({ norm, weight, ...rest }) => {
        void norm;
        void weight;
        return rest;
      }),
    }));
}
