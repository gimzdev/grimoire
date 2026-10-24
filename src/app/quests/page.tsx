import type { Metadata } from 'next';
import Link from 'next/link';
import { AutoForm } from '@/components/auto-form';
import { Backdrop } from '@/components/backdrop';
import { WowIcon } from '@/components/icon';
import { Badge, Container, Empty } from '@/components/ui';
import { SideMark } from '@/components/world-links';
import { getQuests, getQuestsByZone, getZoneMap } from '@/lib/data';
import { normalize } from '@/lib/items';
import { categoryName, CHANGE_LABEL, groupName, itemRef, typeLabel } from '@/lib/quests';
import type { Quest } from '@/lib/types';
import { CLASS_IDS, CLASS_NAMES, CLASS_ORDER } from '@/lib/wow';

export const metadata: Metadata = {
  title: 'Quests',
  description: 'World of Warcraft: Forever quests by zone and level: the Classic quests with their objectives, givers and rewards, and the quests new in Forever.',
  alternates: { canonical: '/quests' },
};

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

const KINDS: { key: string; label: string; test: (q: Quest) => boolean }[] = [
  { key: 'dungeon', label: 'Dungeon', test: (q) => q.ty === 81 || q.c2 === 2 },
  { key: 'raid', label: 'Raid', test: (q) => q.ty === 62 || q.c2 === 3 },
  { key: 'group', label: 'Group or elite', test: (q) => q.ty === 1 || Boolean(q.gp) },
  { key: 'class', label: 'Class', test: (q) => q.c2 === 4 || Boolean(q.rc) },
  { key: 'profession', label: 'Profession', test: (q) => q.c2 === 5 || Boolean(q.sk) },
  { key: 'pvp', label: 'PvP', test: (q) => q.ty === 41 || q.c2 === 6 },
  { key: 'event', label: 'World event', test: (q) => q.c2 === 9 || Boolean(q.ev) },
  { key: 'repeatable', label: 'Repeatable', test: (q) => Boolean(q.rep) },
];

const SORTS = [
  ['', 'Level'],
  ['name', 'Name'],
  ['xp', 'Experience'],
] as const;

export default async function QuestsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const q = one(sp.q)?.trim() || undefined;
  const zone = one(sp.zone) ? Number(one(sp.zone)) : undefined;
  const min = Number(one(sp.min)) || undefined;
  const max = Number(one(sp.max)) || undefined;
  const side = one(sp.side);
  const kind = one(sp.kind);
  const cls = one(sp.class);
  const change = one(sp.change);
  const sort = one(sp.sort) || '';
  const page = Math.max(1, Number(one(sp.page)) || 1);

  const all = getQuests();
  let list = all;
  if (q) {
    const words = normalize(q).split(' ').filter(Boolean);
    list = list.filter((x) => {
      const n = normalize(x.n);
      return words.every((w) => n.includes(w));
    });
  }
  if (zone !== undefined && Number.isFinite(zone)) list = list.filter((x) => x.z === zone);
  if (min) list = list.filter((x) => x.l >= min);
  if (max) list = list.filter((x) => x.l <= max);
  if (side === 'alliance') list = list.filter((x) => x.s !== 2);
  if (side === 'horde') list = list.filter((x) => x.s !== 1);
  const k = KINDS.find((x) => x.key === kind);
  if (k) list = list.filter(k.test);
  if (cls && CLASS_IDS[cls]) {
    const bit = 1 << (CLASS_IDS[cls] - 1);
    list = list.filter((x) => x.rc && x.rc & bit);
  }
  if (change === 'new') list = list.filter((x) => x.ch === 'n');
  if (change === 'changed') list = list.filter((x) => x.ch === 'u');
  list = [...list].sort((a, b) => {
    if (sort === 'name') return a.n.localeCompare(b.n);
    if (sort === 'xp') return (b.xp ?? 0) - (a.xp ?? 0);
    return (a.l || 99) - (b.l || 99) || a.r - b.r || a.n.localeCompare(b.n);
  });

  const per = 60;
  const pages = Math.max(1, Math.ceil(list.length / per));
  const cur = Math.min(page, pages);
  const rows = list.slice((cur - 1) * per, cur * per);

  // Zones with quests, grouped the way the game's quest log groups them.
  const zones = getZoneMap();
  const groups = new Map<string, { id: number; name: string; n: number }[]>();
  for (const [id, inZone] of getQuestsByZone()) {
    const n = inZone.length;
    const any = inZone[0];
    const g = id > 0 && zones.get(id)?.inst === 0 ? (zones.get(id)!.cat === 1 ? 'Kalimdor' : zones.get(id)!.cat === -1 ? 'Skywall' : 'Eastern Kingdoms') : groupName(any);
    const list2 = groups.get(g) ?? [];
    list2.push({ id, name: categoryName(id), n });
    groups.set(g, list2);
  }
  const groupOrder = ['Eastern Kingdoms', 'Kalimdor', 'Skywall', 'New in Forever', 'Dungeons', 'Raids', 'Classes', 'Professions', 'Battlegrounds', 'World events', 'Camping', 'Miscellaneous', 'Other'];

  const newCount = all.filter((x) => x.ch === 'n').length;
  const changedCount = all.filter((x) => x.ch === 'u').length;

  const link = (p: number) => {
    const params = new URLSearchParams();
    for (const [key, v] of Object.entries(sp)) {
      const val = one(v);
      if (key !== 'page' && val) params.set(key, val);
    }
    if (p > 1) params.set('page', String(p));
    return `/quests${params.size ? `?${params}` : ''}`;
  };

  return (
    <div className="relative isolate">
      <Backdrop art="untoldStories" />
      <Container className="pt-10">
        <h1 className="text-[2.4rem] text-vellum sm:text-[2.8rem]">Quests</h1>
        <p className="mt-1 max-w-3xl text-[17px] text-mist">
          {all.length.toLocaleString('en-US')} quests in World of Warcraft: Forever. {newCount.toLocaleString('en-US')} are new and {changedCount.toLocaleString('en-US')} changed from Classic, with
          new levels, rewards or text.
        </p>

        <div className="mt-8 grid gap-6 lg:grid-cols-[270px_minmax(0,1fr)]">
          <AutoForm action="/quests" className="frame h-fit space-y-4 p-4 lg:sticky lg:top-[84px]">
            <label className="block">
              <span className="text-[13.5px] text-fog">Name</span>
              <input type="search" name="q" defaultValue={q} placeholder="Hogger, The Defias Brotherhood…" className="field mt-1" />
            </label>
            <label className="block">
              <span className="text-[13.5px] text-fog">Zone or category</span>
              <select name="zone" defaultValue={zone ?? ''} className="field mt-1">
                <option value="">Anywhere</option>
                {groupOrder
                  .filter((g) => groups.has(g))
                  .map((g) => (
                    <optgroup key={g} label={g}>
                      {groups
                        .get(g)!
                        .sort((a, b) => a.name.localeCompare(b.name))
                        .map((z) => (
                          <option key={z.id} value={z.id}>
                            {z.name} ({z.n})
                          </option>
                        ))}
                    </optgroup>
                  ))}
              </select>
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="block">
                <span className="text-[13.5px] text-fog">Min level</span>
                <input type="number" name="min" min={1} max={60} defaultValue={min} className="field mt-1" />
              </label>
              <label className="block">
                <span className="text-[13.5px] text-fog">Max level</span>
                <input type="number" name="max" min={1} max={60} defaultValue={max} className="field mt-1" />
              </label>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <label className="block">
                <span className="text-[13.5px] text-fog">Faction</span>
                <select name="side" defaultValue={side ?? ''} className="field mt-1">
                  <option value="">Either</option>
                  <option value="alliance">Alliance</option>
                  <option value="horde">Horde</option>
                </select>
              </label>
              <label className="block">
                <span className="text-[13.5px] text-fog">Class</span>
                <select name="class" defaultValue={cls ?? ''} className="field mt-1">
                  <option value="">Any</option>
                  {CLASS_ORDER.map((c) => (
                    <option key={c} value={c}>
                      {CLASS_NAMES[c]}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label className="block">
              <span className="text-[13.5px] text-fog">Kind</span>
              <select name="kind" defaultValue={kind ?? ''} className="field mt-1">
                <option value="">All quests</option>
                {KINDS.map((x) => (
                  <option key={x.key} value={x.key}>
                    {x.label}
                  </option>
                ))}
              </select>
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="block">
                <span className="text-[13.5px] text-fog">Forever</span>
                <select name="change" defaultValue={change ?? ''} className="field mt-1">
                  <option value="">All</option>
                  <option value="new">New in Forever</option>
                </select>
              </label>
              <label className="block">
                <span className="text-[13.5px] text-fog">Sort</span>
                <select name="sort" defaultValue={sort} className="field mt-1">
                  {SORTS.map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <noscript>
              <button type="submit" className="h-10 w-full rounded-full bg-gilt font-semibold text-[#21170a]">
                Apply
              </button>
            </noscript>
            {Object.keys(sp).length > 0 && (
              <Link href="/quests" className="block text-center text-[14.5px] text-gilt hover:text-gilt-bright">
                Clear filters
              </Link>
            )}
          </AutoForm>

          <div className="min-w-0">
            <div className="mb-3 flex items-baseline justify-between gap-4 text-[15px] text-mist">
              <span>
                <span className="num text-vellum">{list.length.toLocaleString('en-US')}</span> {list.length === 1 ? 'quest' : 'quests'}
                {zone !== undefined ? ` in ${categoryName(zone)}` : ''}
              </span>
              {pages > 1 && (
                <span className="num">
                  Page {cur} of {pages}
                </span>
              )}
            </div>
            {rows.length === 0 ? (
              <Empty title="No quests match">Try a wider level range or another zone.</Empty>
            ) : (
              <div className="frame overflow-x-auto scroll-thin">
                <table className="w-full min-w-[720px] text-left text-[15.5px]">
                  <thead>
                    <tr className="border-b border-iron/70 text-[13.5px] text-fog">
                      <th className="px-4 py-3 font-medium">Quest</th>
                      <th className="px-2 py-3 text-right font-medium">Level</th>
                      <th className="px-3 py-3 font-medium">Side</th>
                      <th className="px-3 py-3 font-medium">Zone</th>
                      <th className="px-4 py-3 font-medium">Rewards</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-iron/45">
                    {rows.map((x) => {
                      const kindLabel = typeLabel(x);
                      const rewards = [...(x.ic ?? []), ...(x.ir ?? [])].slice(0, 4);
                      return (
                        <tr key={x.i} className="align-middle hover:bg-dusk/40">
                          <td className="px-4 py-2.5">
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                              <Link href={`/quests/${x.i}`} data-tip={`quest:${x.i}`} className="font-medium text-gilt-bright hover:underline hover:underline-offset-2">
                                {x.n}
                              </Link>
                              {CHANGE_LABEL[x.ch] && x.ch !== 'x' && <Badge tone={x.ch === 'n' ? 'new' : 'changed'}>{x.ch === 'n' ? 'New' : 'Changed'}</Badge>}
                              {kindLabel && <span className="text-[13px] text-mist">{kindLabel}</span>}
                            </div>
                          </td>
                          <td className="num px-2 py-2.5 text-right text-vellum">
                            {x.l > 0 ? x.l : ''}
                            {x.r && x.r !== x.l ? <span className="block text-[12.5px] text-fog">req {x.r}</span> : null}
                          </td>
                          <td className="px-3 py-2.5 text-[14.5px]">
                            <SideMark side={x.s} />
                          </td>
                          <td className="px-3 py-2.5 text-[14.5px] text-parch">
                            <Link href={`/quests?zone=${x.z}`} className="hover:text-vellum">
                              {categoryName(x.z)}
                            </Link>
                          </td>
                          <td className="px-4 py-2.5">
                            <div className="flex items-center gap-1.5">
                              {rewards.map(([id]) => {
                                const it = itemRef(id);
                                return it ? (
                                  <Link key={id} href={`/items/${id}`} data-tip={`item:${id}`} aria-label={it.n}>
                                    <WowIcon icon={it.ic} size={26} quality={it.q} name={it.n} />
                                  </Link>
                                ) : null;
                              })}
                              {x.xp ? <span className="num ml-1 text-[13.5px] text-mist">{x.xp.toLocaleString('en-US')} xp</span> : null}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            {pages > 1 && (
              <nav aria-label="Pages" className="mt-5 flex flex-wrap items-center gap-2">
                {cur > 1 && (
                  <Link href={link(cur - 1)} className="rounded-full px-3 py-1.5 text-[15px] text-gilt hover:bg-dusk">
                    Previous
                  </Link>
                )}
                {Array.from({ length: pages }, (_, i) => i + 1)
                  .filter((p) => p === 1 || p === pages || Math.abs(p - cur) <= 2)
                  .map((p, i, arr) => (
                    <span key={p} className="flex items-center gap-2">
                      {i > 0 && arr[i - 1] !== p - 1 && <span className="text-fog">…</span>}
                      <Link href={link(p)} aria-current={p === cur ? 'page' : undefined} className={`num min-w-9 rounded-full px-2.5 py-1.5 text-center text-[15px] ${p === cur ? 'bg-gilt/15 text-gilt-bright' : 'text-parch hover:bg-dusk'}`}>
                        {p}
                      </Link>
                    </span>
                  ))}
                {cur < pages && (
                  <Link href={link(cur + 1)} className="rounded-full px-3 py-1.5 text-[15px] text-gilt hover:bg-dusk">
                    Next
                  </Link>
                )}
              </nav>
            )}
          </div>
        </div>
      </Container>
    </div>
  );
}
