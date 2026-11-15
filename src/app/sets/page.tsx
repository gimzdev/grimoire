import type { Metadata } from 'next';
import Link from 'next/link';
import { Backdrop } from '@/components/backdrop';
import { WowIcon } from '@/components/icon';
import { Container, Empty } from '@/components/ui';
import { getItemMap, getSets } from '@/lib/data';
import { itemStats } from '@/lib/gear';
import { itemSources } from '@/lib/item-source';
import { statsLine } from '@/lib/item-format';
import type { Item, ItemSet } from '@/lib/types';
import { CLASS_COLOR, CLASS_NAMES, CLASS_ORDER, classesFromMask, QUALITY_COLOR } from '@/lib/wow';

export const metadata: Metadata = {
  title: 'Item sets',
  description: 'Every item set in World of Warcraft: Forever: its pieces with Forever’s stat rules applied, what they add up to, who wears them and where each piece drops.',
  alternates: { canonical: '/sets' },
};

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

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

function inBand(s: ItemSet, band: string | undefined) {
  if (!band) return true;
  const hi = s.hi ?? 0;
  if (band === '60') return hi >= 60;
  if (band === '50') return hi >= 50 && hi < 60;
  return hi > 0 && hi < 50;
}

function FilterPill({ href, on, children, color }: { href: string; on: boolean; children: React.ReactNode; color?: string }) {
  return (
    <Link
      href={href}
      scroll={false}
      className={`inline-flex h-9 items-center rounded-full px-3.5 text-[14px] font-[560] ring-1 ring-inset transition-colors ${on ? 'bg-gilt/[0.14] text-gilt-bright ring-gilt/35' : 'bg-white/[0.04] text-mist ring-white/[0.08] hover:bg-white/[0.07] hover:text-parch'}`}
      style={
        on && color
          ? {
              color,
              boxShadow: `inset 0 0 0 1px ${color}55`,
              background: `${color}14`,
            }
          : undefined
      }
    >
      {children}
    </Link>
  );
}

export default async function SetsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const cls = one(sp.class);
  const band = one(sp.level);
  const focus = Number(one(sp.set)) || undefined;
  const items = getItemMap();
  const all = getSets();
  const href = (patch: Record<string, string | undefined>) => {
    const q = new URLSearchParams();
    const next = { class: cls, level: band, ...patch };
    for (const [k, v] of Object.entries(next)) if (v) q.set(k, v);
    const s = q.toString();
    return s ? `/sets?${s}` : '/sets';
  };
  const shown = all.filter((s) => {
    if (focus && s.id === focus) return true;
    if (cls && !(s.cls ? classesFromMask(s.cls).includes(cls) : true)) return false;
    return inBand(s, band);
  });

  return (
    <div className="relative isolate">
      <Backdrop art="camp" strength={0.4} />
      <Container className="pb-16 pt-10">
        <h1 className="text-[2.4rem] text-vellum sm:text-[2.8rem]">Item sets</h1>
        <p className="mt-3 max-w-3xl text-[16.5px] leading-relaxed text-mist">
          All {all.length} sets: their pieces with Forever’s stat rules applied, what they add up to and where each piece comes from. The set bonuses live in the game, not in the open data Grimoire
          uses, so each piece’s tooltip in the game has them. A set’s name comes from what its pieces share.
        </p>

        <div className="mt-7 flex flex-col gap-3">
          <div className="flex flex-wrap gap-1.5">
            <FilterPill href={href({ class: undefined })} on={!cls}>
              Every class
            </FilterPill>
            {CLASS_ORDER.map((c) => (
              <FilterPill key={c} href={href({ class: c })} on={cls === c} color={CLASS_COLOR[c]}>
                {CLASS_NAMES[c]}
              </FilterPill>
            ))}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {BANDS.map(([v, label]) => (
              <FilterPill key={v} href={href({ level: v || undefined })} on={(band ?? '') === v}>
                {label}
              </FilterPill>
            ))}
          </div>
        </div>

        {shown.length === 0 ? (
          <div className="mt-8">
            <Empty title="No set fits those filters" />
          </div>
        ) : (
          <ul className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {shown.map((s) => {
              const pieces = s.pieces.map((p) => items.get(p)).filter((p): p is Item => Boolean(p));
              const total: Record<string, number> = {};
              for (const p of pieces) for (const [k, v] of Object.entries(itemStats(p))) total[k] = (total[k] ?? 0) + v;
              const stats = statsLine(total, 6);
              const classes = classesFromMask(s.cls);
              const places = setPlaces(pieces);
              const level = s.lo && s.hi ? (s.lo === s.hi ? `Level ${s.hi}` : `Levels ${s.lo} to ${s.hi}`) : null;
              return (
                <li key={s.id} id={`set-${s.id}`} className={`frame scroll-mt-28 p-5 ${focus === s.id ? 'ring-1 ring-gilt/50' : ''}`}>
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="text-[1.25rem] leading-tight" style={{ color: QUALITY_COLOR[s.q ?? 1] }}>
                      {s.n}
                    </h2>
                    <span className="num shrink-0 pt-1 text-[13px] text-fog">{pieces.length} pieces</span>
                  </div>
                  <p className="mt-1 text-[13.5px] text-mist">
                    {[classes.length && classes.length < CLASS_ORDER.length ? classes.map((c) => CLASS_NAMES[c]).join(', ') : null, level, places.slice(0, 2).join(', ') || null]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {pieces.map((p) => (
                      <Link key={p.i} href={`/items/${p.i}`} data-tip={`item:${p.i}`} aria-label={p.n} className="rounded-[9px] transition-transform hover:-translate-y-0.5">
                        <WowIcon icon={p.ic} size={36} quality={p.q} name={p.n} />
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
        )}
      </Container>
    </div>
  );
}
