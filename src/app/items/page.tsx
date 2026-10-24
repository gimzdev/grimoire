import type { Metadata } from 'next';
import Link from 'next/link';
import { AutoForm } from '@/components/auto-form';
import { Backdrop } from '@/components/backdrop';
import { ItemLink } from '@/components/links';
import { Badge, Container, Empty } from '@/components/ui';
import { getClass, getClasses, getItems, getMeta } from '@/lib/data';
import { mainSourceChance, sourceSummary } from '@/lib/item-source';
import { ARMOR_TYPES, changeLabel, filterItems, itemTypeLabel, sortItems, WEAPON_TYPES } from '@/lib/items';
import { QUALITY, QUALITY_COLOR, SLOT, SLOT_FILTERS, SOURCE, STATS } from '@/lib/wow';

export const metadata: Metadata = {
  title: 'Items',
  description: 'Search and filter equippable World of Warcraft items by slot, type, level, class, source and stat, with their Classic stats and drop chances.',
  alternates: { canonical: '/items' },
};

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const many = (v: string | string[] | undefined) => (Array.isArray(v) ? v : v ? [v] : []);

/** Only the stats some item actually carries: the rest live in Equip effects, which the tooltips show. */
const PRESENT = new Set(getItems().flatMap((it) => Object.keys(it.st ?? {})));
const STAT_CHOICES = STATS.filter((s) => PRESENT.has(s.key));
const SORTS: (readonly [string, string])[] = [
  ['', 'Item level'],
  ['req', 'Required level'],
  ['name', 'Name'],
  ...STAT_CHOICES.filter((s) => s.kind !== 'resist').map((s) => [`stat:${s.key}`, s.label] as const),
  ['stat:dps', 'Weapon DPS'],
  ['stat:armor', 'Armor'],
];

export default async function ItemsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const q = one(sp.q)?.trim() || undefined;
  const slot = one(sp.slot);
  const type = one(sp.type);
  const quality = many(sp.quality).map(Number).filter((n) => n >= 0);
  const min = Number(one(sp.min)) || undefined;
  const max = Number(one(sp.max)) || undefined;
  const cls = one(sp.class);
  const src = one(sp.src);
  const change = one(sp.change);
  const stat = one(sp.stat);
  const sort = one(sp.sort) || undefined;
  const avail = one(sp.avail) ?? 'launch';
  const page = Math.max(1, Number(one(sp.page)) || 1);
  const info = cls ? getClass(cls) : undefined;

  let list = filterItems(getItems(), { q, slot, type, quality, min, max, cls: info?.slug, weapons: info?.weapons, src, change, stat });
  if (avail === 'forever') list = list.filter((it) => it.av !== 'e' && it.av !== 'r');
  else if (avail === 'launch') list = list.filter((it) => it.av !== 'e');
  list = sortItems(list, sort, q);
  const per = 50;
  const pages = Math.max(1, Math.ceil(list.length / per));
  const cur = Math.min(page, pages);
  const rows = list.slice((cur - 1) * per, cur * per);
  const meta = getMeta();

  const link = (p: number) => {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(sp)) for (const x of many(v)) if (k !== 'page') params.append(k, x);
    if (p > 1) params.set('page', String(p));
    return `/items${params.size ? `?${params}` : ''}`;
  };

  const select = 'field !h-10 !px-2.5';
  return (
    <div className="relative isolate">
      <Backdrop art="camp" />
      <Container className="pt-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-[2.4rem] text-vellum sm:text-[2.8rem]">Items</h1>
            <p className="mt-1 max-w-2xl text-[17px] leading-relaxed text-mist">
              {meta.counts.items.toLocaleString('en-US')} equippable items with their Classic 1.12 stats, from the VMaNGOS database.
              <br />
              Forever changed many of them: check in game before you plan around a number.
            </p>
          </div>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[270px_minmax(0,1fr)]">
          <AutoForm action="/items" className="frame h-fit space-y-4 p-4 lg:sticky lg:top-[84px]">
            <label className="block">
              <span className="text-[13.5px] text-fog">Name</span>
              <input type="search" name="q" defaultValue={q} placeholder="Lionheart, Sulfuras…" className={`${select} mt-1`} />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="block">
                <span className="text-[13.5px] text-fog">Slot</span>
                <select name="slot" defaultValue={slot ?? ''} className={`${select} mt-1`}>
                  <option value="">Any</option>
                  {SLOT_FILTERS.map((s) => (
                    <option key={s.key} value={s.key}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-[13.5px] text-fog">Type</span>
                <select name="type" defaultValue={type ?? ''} className={`${select} mt-1`}>
                  <option value="">Any</option>
                  <optgroup label="Armor">
                    {ARMOR_TYPES.map((t) => (
                      <option key={t.key} value={t.key}>
                        {t.label}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Weapons">
                    {WEAPON_TYPES.map((t) => (
                      <option key={t.key} value={t.key}>
                        {t.label}
                      </option>
                    ))}
                  </optgroup>
                </select>
              </label>
            </div>
            <fieldset>
              <legend className="text-[13.5px] text-fog">Quality</legend>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {[2, 3, 4, 5].map((n) => (
                  <label key={n} className="cursor-pointer">
                    <input type="checkbox" name="quality" value={n} defaultChecked={quality.includes(n)} className="peer sr-only" />
                    <span
                      className="inline-block rounded-full border border-iron bg-abyss/60 px-2 py-1 text-[14px] peer-checked:border-current peer-checked:bg-white/5 peer-focus-visible:ring-2 peer-focus-visible:ring-gilt"
                      style={{ color: QUALITY_COLOR[n] }}
                    >
                      {QUALITY[n]}
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
            <div>
              <span className="text-[13.5px] text-fog">Required level</span>
              <div className="mt-1 flex items-center gap-2">
                <input type="number" name="min" min={0} max={60} defaultValue={min} placeholder="1" className={select} aria-label="Minimum required level" />
                <span className="text-fog">to</span>
                <input type="number" name="max" min={0} max={60} defaultValue={max} placeholder="60" className={select} aria-label="Maximum required level" />
              </div>
            </div>
            <label className="block">
              <span className="text-[13.5px] text-fog">Usable by</span>
              <select name="class" defaultValue={cls ?? ''} className={`${select} mt-1`}>
                <option value="">Any class</option>
                {getClasses().map((c) => (
                  <option key={c.slug} value={c.slug}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="block">
                <span className="text-[13.5px] text-fog">Source</span>
                <select name="src" defaultValue={src ?? ''} className={`${select} mt-1`}>
                  <option value="">Any</option>
                  {[2, 4, 5, 1, 3].map((s) => (
                    <option key={s} value={s}>
                      {SOURCE[s]}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label className="block">
              <span className="text-[13.5px] text-fog">Has stat</span>
              <select name="stat" defaultValue={stat ?? ''} className={`${select} mt-1`}>
                <option value="">Any</option>
                {STAT_CHOICES.map((s) => (
                  <option key={s.key} value={s.key}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-[13.5px] text-fog">Sort by</span>
              <select name="sort" defaultValue={sort ?? ''} className={`${select} mt-1`}>
                {SORTS.map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-[13.5px] text-fog">Include</span>
              <select name="avail" defaultValue={avail} className={`${select} mt-1`}>
                <option value="launch">Every item you can get</option>
                <option value="forever">Without Classic raid loot</option>
                <option value="all">Everything, including unused items</option>
              </select>
            </label>
            <div className="flex gap-2 pt-1">
              <button type="submit" className="h-10 flex-1 rounded-full bg-gilt shadow-[inset_0_1px_0_rgb(255_255_255/0.45)] hover:bg-gilt-bright font-semibold text-[#1a1204]">
                Apply
              </button>
              <Link href="/items" className="inline-flex h-10 items-center rounded-full border border-iron px-3 text-[15px] text-mist hover:text-vellum">
                Clear
              </Link>
            </div>
          </AutoForm>

          <section aria-label="Results" className="min-w-0">
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2 text-[15px] text-mist">
              <span>
                <span className="num font-bold text-vellum">{list.length.toLocaleString('en-US')}</span> items
                {pages > 1 && (
                  <>
                    , page {cur} of {pages}
                  </>
                )}
              </span>
              {avail === 'forever' && <span className="text-[13.5px] text-fog">Classic raid loot is hidden. Change “Include” to see it.</span>}
            </div>
            {rows.length === 0 ? (
              <Empty title="No items match these filters">Loosen the level range or clear a filter to see more.</Empty>
            ) : (
              <div className="frame overflow-hidden">
                <table className="w-full text-left text-[15px]">
                  <thead className="hidden border-b border-iron text-[13px] text-fog md:table-header-group">
                    <tr>
                      <th className="px-4 py-2.5 font-medium">Item</th>
                      <th className="px-2 py-2.5 text-right font-medium">iLvl</th>
                      <th className="px-2 py-2.5 text-right font-medium">Req</th>
                      <th className="px-3 py-2.5 font-medium">Source</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((it) => {
                      const ch = changeLabel(it);
                      return (
                        <tr key={it.i} className="border-b border-iron/50 last:border-0 hover:bg-white/[0.025]">
                          <td className="px-4 py-2.5">
                            <div className="flex min-w-0 items-center gap-2">
                              <ItemLink item={it} size={34} className="text-[15.5px]" />
                              {ch.kind === 'new' && <Badge tone="new">New</Badge>}
                              {it.av === 'r' && (
                                <Badge tone="neutral" title="Classic raid loot. These raids are not among Forever’s launch raids.">
                                  Classic raid
                                </Badge>
                              )}
                              {it.av === 'e' && (
                                <Badge tone="neutral" title="No known source in Forever">
                                  No source
                                </Badge>
                              )}
                              {ch.kind === 'updated' && (
                                <Badge tone="changed" title={ch.lines.join('\n')}>
                                  Changed
                                </Badge>
                              )}
                            </div>
                            <div className="mt-0.5 pl-[42px] text-[13.5px] text-fog">
                              {SLOT[it.s]} {it.s && itemTypeLabel(it) !== SLOT[it.s] ? `${itemTypeLabel(it)}` : ''}
                              <span className="md:hidden">
                                , item level {it.l}
                                {it.r > 1 && !it.nr ? `, requires level ${it.r}` : ''}
                              </span>
                            </div>
                          </td>
                          <td className="num hidden px-2 py-2.5 text-right text-parch md:table-cell">{it.l}</td>
                          <td className="num hidden px-2 py-2.5 text-right text-parch md:table-cell">{it.r > 1 && !it.nr ? it.r : ''}</td>
                          <td className="hidden max-w-[340px] px-3 py-2.5 text-[14px] text-fog md:table-cell">
                            <span className="flex items-baseline gap-2">
                              <span className="min-w-0 truncate">{sourceSummary(it, false) ?? ''}</span>
                              {mainSourceChance(it) && <span className="num shrink-0 text-parch">{mainSourceChance(it)}</span>}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            {pages > 1 && (
              <nav aria-label="Pages" className="mt-5 flex flex-wrap items-center justify-center gap-1.5">
                {cur > 1 && (
                  <Link href={link(cur - 1)} className="rounded-full border border-iron px-3 py-1.5 text-mist hover:text-vellum">
                    Previous
                  </Link>
                )}
                {Array.from({ length: pages }, (_, i) => i + 1)
                  .filter((p) => p === 1 || p === pages || Math.abs(p - cur) <= 2)
                  .map((p, i, arr) => (
                    <span key={p} className="flex items-center gap-1.5">
                      {i > 0 && arr[i - 1] !== p - 1 && <span className="text-fog">…</span>}
                      <Link
                        href={link(p)}
                        aria-current={p === cur ? 'page' : undefined}
                        className={`num min-w-9 rounded-full border px-2.5 py-1.5 text-center ${p === cur ? 'border-gilt/60 text-gilt-bright' : 'border-iron text-mist hover:text-vellum'}`}
                      >
                        {p}
                      </Link>
                    </span>
                  ))}
                {cur < pages && (
                  <Link href={link(cur + 1)} className="rounded-full border border-iron px-3 py-1.5 text-mist hover:text-vellum">
                    Next
                  </Link>
                )}
              </nav>
            )}
          </section>
        </div>
      </Container>
    </div>
  );
}
