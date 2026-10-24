// Saved builds, server side: the builds each person saved, what each one shows, and the account's lifecycle (export,
// deletion, the daily clean-up). Every build is checked and described from the game data here, never from what the
// browser says about it.
import 'server-only';
import { randomBytes } from 'node:crypto';
import { BUILD_KINDS, BUILD_LIMIT, buildPath, cleanName, type BuildKind, type Tile, type TileClass } from './accounts';
import { getClass, getClasses, getItem, getLegacy, getTalents } from './data';
import { hashKey, mailbox, q, tx } from './db';
import { DOLL, PRESETS, decodeWeights, encodeWeights } from './gear';
import { ICON } from './icons';
import { decodePlan, encodePlan, normalizeDone, ranksFromOrder as legacyReplay, treeSpent } from './legacy';
import { RAID_SPECS, decodeRoster, encodeRoster } from './raid';
import { siteUrl } from './site';
import { decodeBuild, decodeOrder, defaultOrder, encodeBuild, encodeOrder, ranksFromOrder, requiredLevel, treePoints } from './talents';
import type { ClassInfo, Item } from './types';

export const INACTIVE_MONTHS = 24;

export class BuildError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export interface Row {
  id: string;
  kind: BuildKind;
  name: string;
  path: string;
  created_at: Date;
  updated_at: Date;
}
const COLUMNS = 'id, kind, name, path, created_at, updated_at';

// ── Reading ──

export const listBuilds = (userId: string) => q<Row>(`select ${COLUMNS} from gr_build where user_id = $1 order by updated_at desc`, [userId]);

/** The links someone saved, so a planner can tell "Saved" from "Save". */
export const savedPaths = async (userId: string) => (await q<{ path: string }>('select path from gr_build where user_id = $1', [userId])).map((r) => r.path);

// ── Changing ──

/** Saves a planner link (the same link again only moves it to the top and keeps its name). */
export async function saveBuild(userId: string, kind: unknown, rawPath: unknown, rawName: unknown): Promise<{ build: Tile; created: boolean }> {
  const k = BUILD_KINDS.find((x) => x === kind);
  const link = k && typeof rawPath === 'string' ? buildPath(k, rawPath) : null;
  const path = k && link ? canonical(k, link) : null;
  if (!k || !path) throw new BuildError(400, 'That is not a build from one of the planners.');
  const tile = describe({ id: '', kind: k, name: '', path, created_at: new Date(), updated_at: new Date() });
  if ((k === 'talents' || k === 'gear') && !tile.cls) throw new BuildError(400, 'That build is for a class Grimoire does not know.');
  const name = cleanName(rawName) || defaultName(tile);
  const [row] = await q<Row & { created: boolean }>(
    `insert into gr_build (id, user_id, kind, name, path)
     select $1, $2, $3, $4, $5
     where (select count(*) from gr_build where user_id = $2) < $6 or exists (select 1 from gr_build where user_id = $2 and path = $5)
     on conflict (user_id, path) do update set updated_at = now()
     returning ${COLUMNS}, created_at = updated_at as created`,
    [randomBytes(9).toString('base64url'), userId, k, name, path, BUILD_LIMIT],
  );
  if (!row) throw new BuildError(409, `You have saved ${BUILD_LIMIT} builds, the most an account keeps. Delete a few to save more.`);
  return { build: describe(row), created: row.created };
}

export async function renameBuild(userId: string, id: string, rawName: unknown): Promise<Tile | null> {
  const name = cleanName(rawName);
  if (!name) throw new BuildError(400, 'A build needs a name.');
  const [row] = await q<Row>(`update gr_build set name = $3, updated_at = now() where user_id = $1 and id = $2 returning ${COLUMNS}`, [userId, id, name]);
  return row ? describe(row) : null;
}

export async function deleteBuild(userId: string, id: string): Promise<boolean> {
  return (await q('delete from gr_build where user_id = $1 and id = $2 returning 1', [userId, id])).length > 0;
}

/**
 * A planner link exactly as the planner itself writes it once it has opened the link, so a saved build and the open planner
 * agree on "Saved" and the same build is never kept twice. Null when the link shows nothing (no points, no items, no players).
 */
export function canonical(kind: BuildKind, link: string): string | null {
  const u = new URL(link, 'https://grimoire.invalid');
  const p = u.searchParams;
  if (kind === 'talents') {
    const slug = u.pathname.split('/')[2] ?? '';
    const data = getTalents(slug);
    if (!data) return null;
    // as the calculator does: the build's ranks, and its point order when that order really makes this build
    const ranks = decodeBuild(data.trees, p.get('b'));
    const replay = ranksFromOrder(data.trees, decodeOrder(data.trees, p.get('o')));
    const same = Object.keys(ranks).length === Object.keys(replay.ranks).length && Object.entries(ranks).every(([id, n]) => replay.ranks[Number(id)] === n);
    const order = same ? replay.order : defaultOrder(data.trees, ranks);
    const b = encodeBuild(data.trees, ranks);
    if (!b) return null;
    return `/talents/${slug}?b=${b}${order.length ? `&o=${encodeOrder(data.trees, order)}` : ''}${p.get('t') === '1' ? '&t=1' : ''}`;
  }
  if (kind === 'raid') {
    const size = [10, 20, 40].includes(Number(p.get('size'))) ? Number(p.get('size')) : 10;
    const roster = decodeRoster(p.get('r') ?? '', size);
    return roster.some((x) => x !== null) ? `/tools/raid?size=${size}&r=${encodeRoster(roster)}` : null;
  }
  if (kind === 'legacy') {
    // as the planner does: the plan replayed point by point, the points that are not open at their turn left out
    const L = getLegacy();
    const code = encodePlan(L.trees, legacyReplay(L.trees, decodePlan(L.trees, p.get('p')), L.points).order);
    return code ? `/tools/legacy?tab=perks&p=${code}` : null;
  }
  // gear, as the planner writes it: defaults left out, one item id per paper-doll slot (0 when empty)
  const cls = p.get('class') ?? '';
  const presets = Object.hasOwn(PRESETS, cls) ? PRESETS[cls] : undefined;
  if (!presets) return null;
  const ids = (p.get('g') ?? '').split('.').map((x) => Number(x) || 0);
  const g = DOLL.map((_, i) => (ids[i] && getItem(ids[i]) ? ids[i] : 0));
  // as the planner writes it: a two-handed weapon leaves the off-hand empty
  const main = DOLL.findIndex((d) => d.key === 'mainhand'), off = DOLL.findIndex((d) => d.key === 'offhand');
  if (getItem(g[main])?.s === 17) g[off] = 0;
  if (!g.some(Boolean)) return null;
  const level = Math.min(60, Math.max(1, Number(p.get('lvl')) || 60));
  const src = p.get('src');
  const weights = p.get('w') ? decodeWeights(p.get('w')!) : null;
  const out = new URLSearchParams();
  out.set('class', cls);
  out.set('spec', (presets.find((x) => x.key === p.get('spec')) ?? presets[0]).key);
  if (level !== 60) out.set('lvl', String(level));
  if (src === 'launch' || src === 'all') out.set('src', src);
  if (p.get('side') === 'horde') out.set('side', 'horde');
  out.set('g', g.join('.'));
  if (weights) out.set('w', encodeWeights(weights));
  const path = `/tools/gear?${out.toString()}`;
  return path.length <= 1200 ? path : null; // the database keeps links up to 1200 characters
}

// ── What a build shows ──

const lite = (c: ClassInfo): TileClass => ({ slug: c.slug, name: c.name, color: c.color, icon: c.icon });
const count = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export function defaultName(t: Tile) {
  if (t.kind === 'raid') return `${t.roster?.length ?? 10}-player raid`;
  // as the planner suggests it: Grimoire's build by its name, else the tree it leans into
  if (t.kind === 'legacy') return t.ours ?? (t.spec ? `${t.spec} Legacy build` : 'Legacy build');
  return [t.spec, t.cls?.name].filter(Boolean).join(' ') || 'My build';
}

/** A saved build as the profile shows it: the class, the spec it leans into and a few facts, worked out from its link. */
export function describe(row: Row): Tile {
  const base: Tile = { id: row.id, kind: row.kind, name: row.name, href: row.path, savedAt: row.created_at.toISOString(), updatedAt: row.updated_at.toISOString(), icon: ICON.unknown, facts: [] };
  const u = new URL(row.path, 'https://grimoire.invalid');
  const p = u.searchParams;

  if (row.kind === 'talents') {
    const slug = u.pathname.split('/')[2] ?? '';
    const c = getClass(slug);
    const data = c && getTalents(slug);
    if (!c || !data) return { ...base, facts: ['This class is not in the game data any more'] };
    const ranks = decodeBuild(data.trees, p.get('b'));
    const points = data.trees.map((tree) => treePoints(tree, ranks));
    const total = points.reduce((a, b) => a + b, 0);
    const top = total ? points.indexOf(Math.max(...points)) : -1;
    const talented = p.get('t') === '1';
    const tree = top >= 0 ? data.trees[top] : undefined;
    return {
      ...base,
      cls: lite(c),
      icon: tree ? (c.specs.find((s) => s.name === tree.name)?.icon ?? tree.icon) : c.icon,
      spec: tree?.name,
      trees: data.trees.map((t, i) => ({ name: t.name, icon: t.icon, points: points[i] })),
      facts: [total ? `Level ${requiredLevel(total, talented)}` : 'No points yet', ...(talented ? ['Talented perk'] : [])],
    };
  }

  if (row.kind === 'gear') {
    const c = getClass(p.get('class') ?? '');
    if (!c) return { ...base, facts: ['This class is not in the game data any more'] };
    const key = p.get('spec') ?? '';
    const presets = Object.hasOwn(PRESETS, c.slug) ? PRESETS[c.slug] : undefined;
    const preset = presets?.find((x) => x.key === key) ?? presets?.[0];
    const spec = c.specs.find((s) => s.slug === (key === 'bear' ? 'feral' : key));
    const items = (p.get('g') ?? '')
      .split('.')
      .map(Number)
      .filter((n) => n > 0)
      .map((id) => getItem(id))
      .filter((x): x is Item => !!x);
    const ilvl = items.length ? Math.round(items.reduce((s, it) => s + it.l, 0) / items.length) : 0;
    return {
      ...base,
      cls: lite(c),
      icon: spec?.icon ?? c.icon,
      spec: preset?.label ?? spec?.name,
      // the best pieces first: quality, then item level
      items: [...items].sort((a, b) => b.q - a.q || b.l - a.l).map((it) => ({ icon: it.ic ?? ICON.unknown, q: it.q, name: it.n })),
      facts: [`Level ${Number(p.get('lvl')) || 60}`, count(items.length, 'item'), ...(ilvl ? [`item level ${ilvl}`] : [])],
    };
  }

  if (row.kind === 'legacy') {
    const L = getLegacy();
    const { ranks, order } = legacyReplay(L.trees, decodePlan(L.trees, p.get('p')), L.points);
    const points = L.trees.map((t) => treeSpent(t, ranks));
    const top = order.length ? points.indexOf(Math.max(...points)) : -1;
    const ours = L.builds.find((b) => b.code === encodePlan(L.trees, order));
    return {
      ...base,
      icon: top >= 0 ? L.trees[top].icon : ICON.unknown,
      // the tree it leans into, and Grimoire's own build when it is one
      spec: top >= 0 ? L.trees[top].name : undefined,
      ours: ours?.name,
      trees: L.trees.map((t, i) => ({ name: t.name, icon: t.icon, points: points[i] })),
      perks: L.trees.flatMap((t) => t.perks.filter((x) => (ranks[x.id] ?? 0) > 0).map((x) => ({ icon: x.icon, name: x.name, rank: ranks[x.id], max: x.max }))),
      facts: [`${order.length} of ${L.points} points`, ...(ours ? ['a Grimoire build'] : [])],
    };
  }

  const size = Number(p.get('size')) || 10;
  const roster = decodeRoster(p.get('r') ?? '', size);
  const filled = roster.flatMap((i) => (i === null ? [] : [RAID_SPECS[i]]));
  const colors = new Map(getClasses().map((c) => [c.slug, c.color]));
  const role = (r: string) => filled.filter((s) => s.role === r).length;
  return {
    ...base,
    icon: ICON.raid,
    roster: roster.map((i) => (i === null ? '' : (colors.get(RAID_SPECS[i].cls) ?? '#777777'))),
    facts: [`${filled.length} of ${size}`, count(role('tank'), 'tank'), count(role('healer'), 'healer'), `${role('melee') + role('ranged')} DPS`],
  };
}

// ── Legacy Challenges, kept with the account ──

export interface LegacyProgress {
  /** Challenge keys, in the planner's order. */
  done: string[];
  updatedAt: string;
}

/** The Legacy Challenges as they are kept: keys the game data knows, every ladder filled in below its highest step. */
function cleanDone(raw: string[]) {
  const L = getLegacy();
  const at = new Map(L.challenges.map((c, i) => [c.key, i]));
  return [...normalizeDone(L.challenges, raw)].sort((a, b) => at.get(a)! - at.get(b)!);
}

export async function getLegacyProgress(userId: string): Promise<LegacyProgress | null> {
  const [row] = await q<{ done: string[]; updated_at: Date }>('select done, updated_at from gr_legacy where user_id = $1', [userId]);
  return row ? { done: cleanDone(row.done), updatedAt: row.updated_at.toISOString() } : null;
}

const keyList = (raw: unknown) => (Array.isArray(raw) && raw.length <= 200 && raw.every((k) => typeof k === 'string' && k.length <= 60) ? (raw as string[]) : null);

/**
 * Keeps the account's ticks. With `base`, the list this browser last had from the account, only what changed since then
 * is applied, onto what the account holds now, so a change made on another device in between stays. Without it, the list
 * replaces the account's copy.
 */
export async function putLegacyProgress(userId: string, rawDone: unknown, rawBase?: unknown): Promise<LegacyProgress> {
  const doneList = keyList(rawDone);
  const baseList = rawBase == null ? null : keyList(rawBase);
  if (!doneList || (rawBase != null && !baseList)) throw new BuildError(400, 'That is not a list of Legacy Challenges.');
  const done = cleanDone(doneList);
  if (!baseList) {
    const [row] = await q<{ updated_at: Date }>(
      'insert into gr_legacy (user_id, done) values ($1, $2) on conflict (user_id) do update set done = excluded.done, updated_at = now() returning updated_at',
      [userId, done],
    );
    return { done, updatedAt: row.updated_at.toISOString() };
  }
  const base = new Set(cleanDone(baseList));
  const now = new Set(done);
  const added = done.filter((k) => !base.has(k));
  const removed = [...base].filter((k) => !now.has(k));
  if (!added.length && !removed.length) return (await getLegacyProgress(userId)) ?? { done: [], updatedAt: new Date().toISOString() };
  return tx(async (c) => {
    // One statement takes the stored list, drops what was unticked and adds what was ticked; the row stays locked until
    // the cleaned list is written back
    const {
      rows: [row],
    } = await c.query<{ done: string[]; updated_at: Date }>(
      `insert into gr_legacy as g (user_id, done) values ($1, $2::text[])
       on conflict (user_id) do update set done = array(select k from unnest(g.done) k where k <> all($3::text[]) union select unnest($2::text[])), updated_at = now()
       returning done, updated_at`,
      [userId, added, removed],
    );
    const merged = cleanDone(row.done);
    const stored = new Set(row.done);
    if (merged.length !== stored.size || merged.some((k) => !stored.has(k))) await c.query('update gr_legacy set done = $2 where user_id = $1', [userId, merged]);
    return { done: merged, updatedAt: row.updated_at.toISOString() };
  });
}

/** What the profile shows of it: points earned, and how far each group of challenges is. */
export function legacySummary(progress: LegacyProgress | null) {
  if (!progress) return null;
  const L = getLegacy();
  const done = new Set(progress.done);
  return {
    earned: L.challenges.reduce((n, c) => n + (done.has(c.key) ? c.points : 0), 0),
    total: L.total,
    groups: L.groups.map((g) => ({ name: g.name, done: L.challenges.filter((c) => c.group === g.id && done.has(c.key)).length, count: g.count })),
    updatedAt: progress.updatedAt,
  };
}
export type LegacySummary = NonNullable<ReturnType<typeof legacySummary>>;

// ── The account itself ──

export async function exportData(user: { id: string; email: string; since: string }) {
  const [accounts, sessions, builds, [who], legacy] = await Promise.all([
    q<{ providerId: string; accountId: string; createdAt: Date }>('select "providerId", "accountId", "createdAt" from "account" where "userId" = $1 order by "createdAt"', [user.id]),
    q<{ createdAt: Date; updatedAt: Date; expiresAt: Date }>('select "createdAt", "updatedAt", "expiresAt" from "session" where "userId" = $1 order by "createdAt"', [user.id]),
    listBuilds(user.id),
    q<{ updatedAt: Date }>('select "updatedAt" from "user" where "id" = $1', [user.id]),
    getLegacyProgress(user.id),
  ]);
  const challenge = new Map(getLegacy().challenges.map((c) => [c.key, c.name]));
  const providers = accounts.filter((a) => a.providerId !== 'credential');
  const site = siteUrl();
  return {
    about:
      'Everything stored for this account: the email address, when the account was made and last used, the sign-in providers linked to it (with the identifier each gave), the browsers signed in, the builds you saved and the Legacy Challenges you ticked. Nothing else is kept: no name, photo, IP address or device details. A sign-in code is kept, scrambled, until it is used or the daily clean-up removes it, and cannot be read back.',
    exportedAt: new Date().toISOString(),
    account: {
      email: user.email,
      createdAt: user.since,
      lastUsedAt: who?.updatedAt.toISOString() ?? null,
      signInMethods: ['email code', ...new Set(providers.map((a) => a.providerId))],
      linkedProviders: providers.map((a) => ({ provider: a.providerId, providerAccountId: a.accountId, linkedAt: a.createdAt.toISOString() })),
    },
    sessions: sessions.map((s) => ({ signedInAt: s.createdAt.toISOString(), lastUsedAt: s.updatedAt.toISOString(), expiresAt: s.expiresAt.toISOString() })),
    builds: builds.map((b) => ({ name: b.name, kind: b.kind, link: `${site}${b.path}`, savedAt: b.created_at.toISOString(), updatedAt: b.updated_at.toISOString() })),
    legacyChallenges: legacy ? { ticked: legacy.done.map((k) => challenge.get(k) ?? k), updatedAt: legacy.updatedAt } : null,
  };
}

export async function deleteAccount(user: { id: string; email: string }) {
  await tx(async (c) => {
    await c.query('delete from "verification" where "identifier" = any($1::text[])', [['sign-in', 'email-verification', 'forget-password'].map((t) => `${t}-otp-${user.email}`)]);
    await c.query('delete from "user" where "id" = $1', [user.id]); // sessions, linked providers and builds go with it
  });
  await q('delete from gr_throttle where key = any($1::text[])', [[`otp:${mailbox(user.email)}`, `otp-day:${mailbox(user.email)}`].map(hashKey)]).catch(() => {});
}

/** The daily clean-up: nothing personal outlives its purpose. A failing step never stops the others; `failed` counts them. */
export async function prune() {
  const removed = (sql: string, params: unknown[] = []) => async () => (await q<{ n: number }>(`with d as (${sql} returning 1) select count(*)::int as n from d`, params))[0].n;
  const steps = {
    inactiveAccounts: removed(`delete from "user" where "updatedAt" < now() - make_interval(months => $1)`, [INACTIVE_MONTHS]),
    expiredSessions: removed('delete from "session" where "expiresAt" < now()'),
    expiredCodes: removed('delete from "verification" where "expiresAt" < now()'),
    oldCounters: removed(`delete from gr_throttle where started_at < now() - interval '1 day'`),
  };
  const out: Record<string, number | null> = {};
  let failed = 0;
  for (const [name, run] of Object.entries(steps)) {
    try {
      out[name] = await run();
    } catch (e) {
      failed++;
      out[name] = null;
      console.error(`[grimoire] clean-up step ${name} failed:`, e instanceof Error ? e.message : e);
    }
  }
  return { ...out, failed };
}
