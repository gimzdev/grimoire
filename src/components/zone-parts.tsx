import Link from 'next/link';
import type { ReactNode } from 'react';
import type { DungeonInfo } from '@/lib/types';
import { dungeonArt, CREATURE_ICON, CREATURE_TYPE, KIND_LABEL, type Enemy, type NextCard, type ServiceNpc, type Services, type ZoneItem } from '@/lib/zone';
import { RANK_LABEL } from '@/lib/quests';
import { levelTitle } from '@/lib/quest-bands';
import { QUALITY_COLOR } from '@/lib/wow';
import { ArtCard } from './art-card';
import { WowIcon } from './icon';
import { TocSpy } from './toc-spy';
import { Badge, ButtonLink } from './ui';

/* ── Section nav ────────────────────────────────────────────────────────── */

/** The sticky row of jump links under the facts. TocSpy marks the section being read. */
export function ZoneNav({ items }: { items: { id: string; label: string; count?: number }[] }) {
  return (
    <div className="sticky top-[84px] z-40 mb-12 mt-6">
      <nav aria-label="On this page" className="w-fit max-w-full rounded-full border border-white/[0.09] bg-[rgb(12_13_17/0.88)] p-1.5 shadow-[inset_0_1px_0_rgb(255_255_255/0.07),0_18px_44px_-20px_rgb(0_0_0/0.8)] backdrop-blur-xl backdrop-saturate-150">
        <ul className="no-scrollbar flex gap-1 overflow-x-auto">
          {items.map((it) => (
            <li key={it.id} className="shrink-0">
              <a
                href={`#${it.id}`}
                className="inline-flex h-9 items-center gap-2 rounded-full px-3.5 text-[14.5px] font-[560] text-parch/90 transition-colors hover:bg-white/[0.06] hover:text-vellum aria-[current=location]:bg-white/[0.1] aria-[current=location]:text-vellum"
              >
                {it.label}
                {it.count !== undefined && <span className="num text-[12.5px] text-fog">{it.count}</span>}
              </a>
            </li>
          ))}
        </ul>
      </nav>
      <TocSpy ids={items.map((i) => i.id)} />
    </div>
  );
}

/* ── Facts ──────────────────────────────────────────────────────────────── */

/** The zone's level range on a 1 to 60 ruler, in the colors of the zones page. */
export function LevelTile({ lo, hi, color, isNew, approx, note }: { lo: number; hi: number; color: string; isNew: boolean; approx?: boolean; note?: string }) {
  const pct = (lv: number) => Math.min(100, Math.max(0, ((lv - 1) / 60) * 100));
  const start = pct(lo);
  const width = Math.max(3, Math.min(100 - start, pct(hi + 1) - start));
  // A single level is drawn as a small pill; at level 60 it must not run past the end of the track.
  const left = Math.min(start, 100 - width);
  return (
    <div className="frame h-full px-4 py-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
        <div className="num text-[1.9rem] font-bold leading-none text-vellum">{lo === hi ? lo : `${lo} to ${hi}`}</div>
        <div className="text-[13.5px] text-mist">{approx ? 'Levels, estimated' : lo === hi ? 'Level' : 'Levels'}</div>
      </div>
      <div className="relative mt-3 h-3 rounded-full bg-white/[0.06]" role="img" aria-label={`${levelTitle(lo, hi)} on a scale of 1 to 60`}>
        {[10, 20, 30, 40, 50].map((l) => (
          <span key={l} aria-hidden className="absolute inset-y-0 w-px bg-iron/80" style={{ left: `${pct(l)}%` }} />
        ))}
        <span
          aria-hidden
          className={`absolute inset-y-0 rounded-full ${approx ? 'border border-dashed' : ''}`}
          style={{
            left: `${left}%`,
            width: `${width}%`,
            background: isNew ? 'var(--color-leaf)' : color,
            boxShadow: isNew ? '0 0 12px rgb(169 196 127 / .4)' : undefined,
            borderColor: approx ? 'rgb(242 233 216 / .75)' : undefined,
          }}
        />
      </div>
      <div aria-hidden className="num relative mt-1 h-4 text-[11.5px] text-fog">
        <span className="absolute left-0">1</span>
        {[10, 20, 30, 40, 50].map((l) => (
          <span key={l} className="absolute -translate-x-1/2" style={{ left: `${pct(l)}%` }}>
            {l}
          </span>
        ))}
        <span className="absolute right-0">60</span>
      </div>
      {note && <p className="mt-1.5 text-[13px] leading-snug text-mist">{note}</p>}
    </div>
  );
}

export function CountTile({ n, label, sub, href }: { n: number | string; label: string; sub?: string; href?: string }) {
  const body = (
    <>
      <div className="num text-[1.9rem] font-bold leading-none text-vellum">{n}</div>
      <div className="mt-1 text-[13.5px] text-mist">{label}</div>
      {sub && <div className="mt-0.5 text-[13px] font-medium text-leaf-bright">{sub}</div>}
    </>
  );
  return href ? (
    <a href={href} className="frame block h-full px-4 py-3 transition-colors hover:border-gilt/40">
      {body}
    </a>
  ) : (
    <div className="frame h-full px-4 py-3">{body}</div>
  );
}

/* ── Small pieces ───────────────────────────────────────────────────────── */

const MORE = 'inline-flex h-9 cursor-pointer list-none items-center rounded-full bg-white/[0.06] px-4 text-[14px] font-[560] text-parch ring-1 ring-inset ring-white/[0.08] transition-colors marker:hidden hover:bg-white/[0.1] hover:text-vellum [&::-webkit-details-marker]:hidden';

/**
 * A grid whose first rows show and the rest sit behind a "Show more" that needs no script. A list only a few
 * past the cap shows in full, so the button never offers "1 more".
 */
function Folded({ cap, children, grid, noun }: { cap: number; children: ReactNode[]; grid: string; noun: string }) {
  const split = children.length > cap + 4 ? cap : children.length;
  const head = children.slice(0, split);
  const tail = children.slice(split);
  return (
    <>
      <ul className={grid}>{head}</ul>
      {tail.length > 0 && (
        <details className="group mt-3">
          <summary className={MORE}>
            <span className="group-open:hidden">
              Show {tail.length} more {noun}
            </span>
            <span className="hidden group-open:inline">Show fewer</span>
          </summary>
          <ul className={`${grid} mt-3`}>{tail}</ul>
        </details>
      )}
    </>
  );
}

const ITEM_GRID = 'grid gap-2 sm:grid-cols-2 lg:grid-cols-3';

export function ItemGroup({ title, note, items, cap = 12 }: { title: string; note?: string; items: ZoneItem[]; cap?: number }) {
  if (!items.length) return null;
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h3 className="text-[1.3rem] text-vellum">{title}</h3>
        <span className="num text-[14px] text-fog">{items.length}</span>
        {note && <p className="w-full text-[14.5px] text-mist sm:w-auto">{note}</p>}
      </div>
      <Folded cap={cap} grid={ITEM_GRID} noun="items">
        {items.map((it) => (
          <li key={it.id} className="min-w-0">
            <Link href={`/items/${it.id}`} data-tip={`item:${it.id}`} className="well flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-white/[0.08]">
              <WowIcon icon={it.icon} size={40} quality={it.q} name={it.name} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15.5px] font-medium leading-snug" style={{ color: QUALITY_COLOR[it.q] }}>
                  {it.name}
                </span>
                {it.meta && <span className="block truncate text-[13px] leading-snug text-mist first-letter:uppercase">{it.meta}</span>}
                {it.source && <span className="block truncate text-[13px] leading-snug text-fog">{it.source}</span>}
              </span>
            </Link>
          </li>
        ))}
      </Folded>
    </div>
  );
}

/* ── Enemies ────────────────────────────────────────────────────────────── */

function enemyMeta(e: Enemy) {
  const level = e.lo > 0 ? (e.lo === e.hi ? `Level ${e.lo}` : `Levels ${e.lo} to ${e.hi}`) : '';
  const type = e.type && e.type !== 10 ? CREATURE_TYPE[e.type]?.toLowerCase() : '';
  return { level, type };
}

export function EnemyGrid({ enemies, cap = 12 }: { enemies: Enemy[]; cap?: number }) {
  const known = enemies.filter((e) => e.id);
  const names = enemies.filter((e) => !e.id);
  const cards = known.map((e) => {
    const { level, type } = enemyMeta(e);
    const rank = RANK_LABEL[e.rank];
    return (
      <li key={e.name} className="min-w-0">
        <Link href={`/npcs/${e.id}`} data-tip={`npc:${e.id}`} className="well flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-white/[0.08]">
          <WowIcon icon={CREATURE_ICON[e.type] ?? CREATURE_ICON[0]} size={40} name={e.name} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[15.5px] font-medium leading-snug text-vellum">{e.name}</span>
            <span className="block truncate text-[13px] leading-snug text-mist">
              {rank && <span className={e.rank === 3 ? 'font-semibold text-gilt-bright' : 'text-gilt'}>{rank}</span>}
              {rank && (level || type) ? ', ' : ''}
              {[level, type].filter(Boolean).join(', ')}
            </span>
          </span>
        </Link>
      </li>
    );
  });
  return (
    <>
      {cards.length > 0 && (
        <Folded cap={cap} grid={ITEM_GRID} noun="enemies">
          {cards}
        </Folded>
      )}
      {names.length > 0 && (
        <ul className={`flex flex-wrap gap-2 ${cards.length ? 'mt-4' : ''}`}>
          {names.map((e) => (
            <li key={e.name} className="rounded-full bg-slate/60 px-3.5 py-1.5 text-[14.5px] text-parch ring-1 ring-iron/60">
              {e.name}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

/* ── Trainers, vendors and services ─────────────────────────────────────── */

function NpcLink({ n }: { n: ServiceNpc }) {
  return (
    <Link href={`/npcs/${n.id}`} data-tip={`npc:${n.id}`} className="text-vellum underline decoration-white/15 underline-offset-[3px] hover:decoration-gilt/60">
      {n.name}
    </Link>
  );
}

function npcList(list: ServiceNpc[]) {
  return list.map((n, i) => (
    <span key={n.id}>
      {i > 0 && ', '}
      <NpcLink n={n} />
    </span>
  ));
}

function NpcRows({ list, cap, noun }: { list: ServiceNpc[]; cap: number; noun: string }) {
  return (
    <Folded cap={cap} grid="grid gap-x-6 sm:grid-cols-2 lg:grid-cols-3" noun={noun}>
      {list.map((n) => (
        <li key={n.id} className="min-w-0 border-b border-iron/40 py-1.5 text-[15px] leading-snug">
          <NpcLink n={n} />
          {n.title && <span className="block truncate text-[13px] text-mist">{n.title}</span>}
        </li>
      ))}
    </Folded>
  );
}

export function ServicesBlock({ s }: { s: Services }) {
  const tiles = s.classTrainers.length + s.other.length;
  return (
    <div className="space-y-8">
      {tiles > 0 && (
        <div>
          {s.classTrainers.length > 0 && <h3 className="mb-3 text-[1.3rem] text-vellum">Class trainers</h3>}
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {s.classTrainers.map((c) => (
              <li key={c.slug} className="well flex items-center gap-3 px-3 py-2.5">
                <WowIcon icon={c.icon} size={40} name={c.name} />
                <span className="min-w-0 flex-1 text-[14.5px] leading-snug">
                  <span className="block font-medium" style={{ color: c.color }}>
                    {c.name}
                  </span>
                  <span className="block text-parch">{npcList(c.npcs)}</span>
                </span>
              </li>
            ))}
            {s.other.map((g) => (
              <li key={g.label} className="well flex flex-col justify-center px-4 py-2.5 text-[14.5px] leading-snug">
                <span className="block text-[13.5px] text-fog">{g.label}</span>
                <span className="block text-parch">
                  {npcList(g.npcs.slice(0, 5))}
                  {g.npcs.length > 5 ? ` and ${g.npcs.length - 5} more` : ''}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {s.trainers.length > 0 && (
        <div>
          <h3 className="mb-2 text-[1.3rem] text-vellum">Other trainers</h3>
          <NpcRows list={s.trainers} cap={12} noun="trainers" />
        </div>
      )}
      {s.vendors.length > 0 && (
        <div>
          <h3 className="mb-2 text-[1.3rem] text-vellum">
            Vendors <span className="num ml-1 text-[14px] font-normal text-fog">{s.vendors.length}</span>
          </h3>
          <NpcRows list={s.vendors} cap={12} noun="vendors" />
        </div>
      )}
    </div>
  );
}

/* ── Dungeons and where next ────────────────────────────────────────────── */

/** Columns that leave no gap at the end of the row for the usual counts: one card spans the width, two share it. */
function cardCols(n: number) {
  return n <= 1 ? '' : n === 2 ? 'sm:grid-cols-2' : n === 4 ? 'sm:grid-cols-2 lg:grid-cols-4' : 'sm:grid-cols-2 lg:grid-cols-3';
}

export function DungeonCards({ list }: { list: DungeonInfo[] }) {
  return (
    <div className={`grid gap-4 ${cardCols(list.length)}`}>
      {list.map((d) => (
        <ArtCard key={d.slug} art={dungeonArt(d)} href={`/dungeons/${d.slug}`} tag={KIND_LABEL[d.kind]} minH={list.length === 1 ? 'min-h-[230px] sm:min-h-[240px]' : 'min-h-[240px]'} sizes={list.length === 1 ? '100vw' : list.length === 2 ? '(min-width: 640px) 50vw, 100vw' : undefined}>
          <div className="flex flex-wrap gap-2">
            {d.levels && <Badge tone="gilt">{levelTitle(d.levels[0], d.levels[1])}</Badge>}
            <Badge tone="neutral">{d.kind === 'battleground' ? `${d.size}v${d.size}` : `${d.size} players`}</Badge>
            {d.isNew && <Badge tone="new">New</Badge>}
          </div>
          <h3 className="mt-2.5 text-[1.55rem] leading-tight text-vellum">{d.name}</h3>
          <p className="mt-1 text-[14.5px] text-mist">{d.location}</p>
        </ArtCard>
      ))}
    </div>
  );
}

/** The picture cards for where to go from here, and a last tile that leads to the full level ladders. */
export function NextGrid({ cards }: { cards: NextCard[] }) {
  const cells = cards.length + 1;
  const cols = cells === 2 ? 'sm:grid-cols-2' : cells === 4 ? 'sm:grid-cols-2 lg:grid-cols-4' : 'sm:grid-cols-2 lg:grid-cols-3';
  // The tile takes whatever is left of the last row, so the grid has no gap at its end.
  const span = cells % 2 === 0 ? '' : cells === 5 ? 'sm:col-span-2 lg:col-span-2' : 'sm:col-span-2 lg:col-span-1';
  return (
    <div className={`grid gap-4 ${cols}`}>
      {cards.map((c) => (
        <ArtCard key={c.key} art={c.art} href={c.href} tag={c.tag} minH="min-h-[230px]" sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw">
          <div className="flex flex-wrap gap-2">
            {c.levels && <Badge tone="gilt">{c.levels}</Badge>}
            {c.side === 'Alliance' && <Badge tone="alliance">Alliance</Badge>}
            {c.side === 'Horde' && <Badge tone="horde">Horde</Badge>}
            {c.isNew && <Badge tone="new">New</Badge>}
          </div>
          <h3 className="mt-2.5 text-[1.45rem] leading-tight text-vellum">{c.title}</h3>
          {c.note && <p className="mt-1 text-[14.5px] text-mist">{c.note}</p>}
        </ArtCard>
      ))}
      <div className={`frame flex min-h-[230px] flex-col justify-between gap-6 p-6 ${span}`}>
        <div>
          <h3 className="text-[1.45rem] leading-tight text-vellum">Browse by level</h3>
          <p className="mt-2 text-[15px] leading-relaxed text-mist">Every zone on one ladder, and every dungeon and raid with its levels.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ButtonLink href="/world">All zones</ButtonLink>
          <ButtonLink href="/dungeons" variant="ghost">
            Dungeons and raids
          </ButtonLink>
        </div>
      </div>
    </div>
  );
}
