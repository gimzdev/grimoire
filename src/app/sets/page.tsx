import type { Metadata } from 'next';
import Link from 'next/link';
import { Backdrop } from '@/components/backdrop';
import { WowIcon } from '@/components/icon';
import { SetsFilter } from '@/components/sets-filter';
import { Container, Empty } from '@/components/ui';
import { getItemMap, getSets } from '@/lib/data';
import { itemStats } from '@/lib/gear';
import { itemSources } from '@/lib/item-source';
import { statsLine } from '@/lib/item-format';
import type { Item } from '@/lib/types';
import { CLASS_COLOR, CLASS_NAMES, CLASS_ORDER, classesFromMask, QUALITY_COLOR } from '@/lib/wow';

export const metadata: Metadata = {
  title: 'Item sets',
  description: 'Every item set in World of Warcraft: Forever: its pieces with Forever’s stat rules applied, what they add up to, who wears them and where each piece drops.',
  alternates: { canonical: '/sets' },
};

const BANDS = [
  ['', 'Any level'],
  ['60', 'Level 60'],
  ['50', '50 to 59'],
  ['low', 'Below 50'],
] as const;

/** The places a set's pieces come from, most pieces first: "Molten Core", "Stratholme", "Vendor". */
function setPlaces(pieces: Item[]) {
  const count = new Map<string, number>();
  for (const p of pieces) {
    const s = itemSources(p)[0];
    if (!s) continue;
    const where = s.zone || (s.kind === 'Drop' ? s.text : s.kind);
    if (where) count.set(where, (count.get(where) ?? 0) + 1);
  }
  return [...count].sort((a, b) => b[1] - a[1]).map(([w]) => w);
}

export default function SetsPage() {
  const items = getItemMap();
  const all = getSets();

  return (
    <div className="relative isolate">
      <Backdrop art="camp" strength={0.4} />
      <Container className="pb-16 pt-10">
        <h1 className="text-[2.4rem] text-vellum sm:text-[2.8rem]">Item sets</h1>
        <p className="mt-3 max-w-3xl text-[16.5px] leading-relaxed text-mist">
          All {all.length} sets: their pieces with Forever’s stat rules applied, what they add up to and where each piece comes from. The set bonuses live in the game, not in the open data Grimoire
          uses, so each piece’s tooltip in the game has them. A set’s name comes from what its pieces share.
        </p>

        {/* The page is built once with every set; the filters hide cards in the browser (sets-filter.tsx). */}
        <SetsFilter classes={CLASS_ORDER.map((c) => ({ slug: c, name: CLASS_NAMES[c], color: CLASS_COLOR[c] }))} bands={BANDS} />

        <div id="sets-none" hidden className="mt-8">
          <Empty title="No set fits those filters" />
        </div>
        <ul id="sets" className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {all.map((s) => {
            const pieces = s.pieces.map((p) => items.get(p)).filter((p): p is Item => Boolean(p));
            const total: Record<string, number> = {};
            for (const p of pieces) for (const [k, v] of Object.entries(itemStats(p))) total[k] = (total[k] ?? 0) + v;
            const stats = statsLine(total, 6);
            const classes = classesFromMask(s.cls);
            const places = setPlaces(pieces);
            const level = s.lo && s.hi ? (s.lo === s.hi ? `Level ${s.hi}` : `Levels ${s.lo} to ${s.hi}`) : null;
            return (
              <li key={s.id} id={`set-${s.id}`} data-cls={s.cls ? classes.join(' ') : undefined} data-hi={s.hi ?? 0} className="frame cv scroll-mt-28 p-5 [contain-intrinsic-size:auto_230px] target:ring-1 target:ring-gilt/50">
                <div className="flex items-start justify-between gap-3">
                  <h2 className="text-[1.25rem] leading-tight" style={{ color: QUALITY_COLOR[s.q ?? 1] }}>
                    {s.n}
                  </h2>
                  <span className="num shrink-0 pt-1 text-[13px] text-fog">{pieces.length} pieces</span>
                </div>
                <p className="mt-1 text-[13.5px] text-mist">
                  {[classes.length && classes.length < CLASS_ORDER.length ? classes.map((c) => CLASS_NAMES[c]).join(', ') : null, level, places.slice(0, 2).join(', ') || null].filter(Boolean).join(' · ')}
                </p>
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {pieces.map((p) => (
                    <Link key={p.i} href={`/items/${p.i}`} prefetch={false} data-tip={`item:${p.i}`} aria-label={p.n} className="sp">
                      <WowIcon icon={p.ic} size={36} quality={p.q} name={p.n} decorative />
                    </Link>
                  ))}
                </div>
                {stats.length > 0 && (
                  <p className="mt-4 border-t border-white/[0.06] pt-3 text-[14px] leading-relaxed text-parch">
                    <span className="text-fog">Together </span>
                    {stats.join(' · ')}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      </Container>
    </div>
  );
}
