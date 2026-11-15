// Grimoire's builds as pages of their own (/builds and /builds/<class>/<build>): the address, the name people search for,
// and the order the points go in, level by level. The builds themselves are data/builds.json.
import { buildGroup, KIND_WORD } from './build-groups';
import { getBarsFor, getBuilds, getBuildsFor, getClass, getTalents } from './data';
import { CODE_VERSION, decodeBuild, decodeOrder, ranksFromOrder, requiredLevel, sortedTalents } from './talents';
import type { BarSlot, Build, ClassInfo, ClassTalents, Talent, TalentTree } from './types';

/** A build's part of its address: its id without the class in front (mage-fire-leveling is /builds/mage/fire-leveling). */
export const buildSlug = (b: Pick<Build, 'id' | 'cls'>) => (b.id.startsWith(`${b.cls}-`) ? b.id.slice(b.cls.length + 1) : b.id);
export const buildHref = (b: Pick<Build, 'id' | 'cls'>) => `/builds/${b.cls}/${buildSlug(b)}`;
export const findBuild = (cls: string, slug: string) => getBuilds().find((b) => b.cls === cls && buildSlug(b) === slug);

/** The build in the calculator, its points in order. */
export const calculatorHref = (b: Pick<Build, 'cls' | 'code' | 'order'>) => `/talents/${b.cls}?b=${b.code}&o=${b.order}&v=${CODE_VERSION}`;

export const kindWord = (kind: Build['kind']) => KIND_WORD[kind];
/** The same, as a label: "Leveling", "Raid", "Healing", "PvP". */
export const kindLabel = (kind: Build['kind']) => KIND_WORD[kind][0].toUpperCase() + KIND_WORD[kind].slice(1);

/** "Fire Mage leveling build", "Feral bear Druid tank build", "Holy Priest healing build". */
export function buildTitle(b: Build, c?: Pick<ClassInfo, 'name'>) {
  const cls = c?.name ?? getClass(b.cls)?.name ?? b.cls;
  // a name that already ends in the role ("Protection tank") drops it there: the kind word says it
  const name = b.name.replace(/\s+(tank|healer|heal)$/i, '');
  return `${name} ${cls} ${KIND_WORD[b.kind]} build`;
}

/** One run of points in the same talent: levels from and to, the talent, and the ranks it reaches. */
export interface OrderStep {
  from: number;
  to: number;
  talent: Talent;
  tree: TalentTree;
  rankFrom: number;
  rankTo: number;
}

/** The build's points in the order it spends them, each run of the same talent as one step, with the levels; a run stops at the respec level. */
export function orderSteps(t: ClassTalents, b: Build): OrderStep[] {
  const byId = new Map<number, { talent: Talent; tree: TalentTree }>();
  for (const tree of t.trees) for (const talent of tree.talents) byId.set(talent.id, { talent, tree });
  const { order } = ranksFromOrder(t.trees, decodeOrder(t.trees, b.order));
  const steps: OrderStep[] = [];
  const rank = new Map<number, number>();
  order.forEach((id, i) => {
    const found = byId.get(id);
    if (!found) return;
    const r = (rank.get(id) ?? 0) + 1;
    rank.set(id, r);
    const level = requiredLevel(i + 1);
    const last = steps[steps.length - 1];
    if (last && last.talent.id === id && last.to === level - 1 && level !== b.next?.at) {
      last.to = level;
      last.rankTo = r;
    } else steps.push({ from: level, to: level, talent: found.talent, tree: found.tree, rankFrom: r, rankTo: r });
  });
  return steps;
}

/** Everything a build's page shows, read once on the server. */
export function buildPage(cls: string, slug: string) {
  const b = findBuild(cls, slug);
  const c = getClass(cls);
  const t = getTalents(cls);
  if (!b || !c || !t) return null;
  const ranks = decodeBuild(t.trees, b.code);
  const bar: BarSlot[] | undefined = getBarsFor(cls)[b.id];
  // the class's other builds, in the order the class page lists them
  const others = getBuildsFor(cls).filter((x) => x.id !== b.id);
  // the build its players respec into, and at which level
  const into = b.next && getBuilds().find((x) => x.id === b.next!.id);
  const respec = into ? { at: b.next!.at, into } : undefined;
  return { b, c, t, ranks, bar, steps: orderSteps(t, b), others, respec, title: buildTitle(b, c) };
}

/** The build's key talents: the one-point talents it takes (the spells and capstones), top to bottom, tree by tree. */
export function keyTalents(t: ClassTalents, ranks: Record<number, number>) {
  return t.trees.flatMap((tree) => sortedTalents(tree).filter((x) => x.max === 1 && (ranks[x.id] ?? 0) > 0)) as Talent[];
}

/** Every build with its class, grouped the way the index lists them: class, then Leveling, PvE and PvP. */
export function buildIndex() {
  const builds = getBuilds();
  const classes = [...new Set(builds.map((b) => b.cls))];
  return classes.map((cls) => {
    const list = getBuildsFor(cls);
    return {
      cls,
      c: getClass(cls)!,
      groups: (['leveling', 'pve', 'pvp'] as const).map((g) => ({ key: g, builds: list.filter((b) => buildGroup(b.kind) === g) })).filter((g) => g.builds.length),
    };
  });
}
