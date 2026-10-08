import type { Metadata } from 'next';
import Link from 'next/link';
import { Backdrop } from '@/components/backdrop';
import { ItemLink } from '@/components/links';
import { Badge, Container } from '@/components/ui';
import { getClasses, getItemMap, getSets } from '@/lib/data';
import { CLASS_IDS, QUALITY_COLOR, classesFromMask, CLASS_NAMES } from '@/lib/wow';

export const metadata: Metadata = {
  title: 'Item sets',
  description: 'Every item set in World of Warcraft: Forever with its pieces and set bonuses, new sets marked.',
  alternates: { canonical: '/sets' },
};

export default async function SetsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const items = getItemMap();
  const cls = sp.class;
  const showAll = sp.all === '1';
  const onlyNew = sp.new === '1';
  const PER = 24;
  const all = getSets()
    .filter((s) => showAll || !s.era)
    .filter((s) => !onlyNew || s.ch === 'n')
    .filter((s) => {
      if (!cls) return true;
      const mask = s.cls ?? s.pieces.map((p) => items.get(p)?.cls ?? 0).find(Boolean);
      return !mask || Boolean(mask & (1 << (CLASS_IDS[cls] - 1)));
    })
    .sort((x, y) => (y.hi ?? 0) - (x.hi ?? 0) || x.n.localeCompare(y.n));
  const focus = Number(sp.set) || 0;
  const focusIdx = focus ? all.findIndex((s) => s.id === focus) : -1;
  const pages = Math.max(1, Math.ceil(all.length / PER));
  const page = focusIdx >= 0 ? Math.floor(focusIdx / PER) + 1 : Math.min(pages, Math.max(1, Number(sp.p) || 1));
  const sets = all.slice((page - 1) * PER, page * PER);
  const qs = (patch: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    const next = { class: cls, all: showAll ? '1' : undefined, new: onlyNew ? '1' : undefined, p: undefined, ...patch };
    for (const [k, v] of Object.entries(next)) if (v) p.set(k, v);
    return `/sets${p.size ? `?${p}` : ''}`;
  };
  return (
    <div className="relative isolate">
      <Backdrop art="untoldStories" />
      <Container className="pt-10">
        <h1 className="text-[2.4rem] text-vellum sm:text-[2.8rem]">Item sets</h1>
        <p className="mt-1 max-w-2xl text-[17px] text-mist">Every set with its pieces and bonuses. Hover any piece for its tooltip.</p>
        <div className="mt-6 flex flex-wrap items-center gap-1.5">
          <Link href={qs({ class: undefined })} className={`rounded-full border px-3 py-1.5 text-[14.5px] ${!cls ? 'border-gilt/60 text-gilt-bright' : 'border-iron text-mist hover:text-vellum'}`}>
            All classes
          </Link>
          {getClasses().map((c) => (
            <Link key={c.slug} href={qs({ class: c.slug })} className={`rounded-full border px-3 py-1.5 text-[14.5px] ${cls === c.slug ? 'border-gilt/60' : 'border-iron hover:border-ash'}`} style={{ color: c.color }}>
              {c.name}
            </Link>
          ))}
          <span className="mx-2 h-5 w-px bg-iron" />
          <Link href={qs({ new: onlyNew ? undefined : '1' })} className={`rounded-full border px-3 py-1.5 text-[14.5px] ${onlyNew ? 'border-leaf/60 text-leaf-bright' : 'border-iron text-mist hover:text-vellum'}`}>
            New sets only
          </Link>
          <Link href={qs({ all: showAll ? undefined : '1' })} className={`rounded-full border px-3 py-1.5 text-[14.5px] ${showAll ? 'border-gilt/60 text-gilt-bright' : 'border-iron text-mist hover:text-vellum'}`}>
            Include era sets
          </Link>
        </div>
        <p className="mt-4 text-[15px] text-mist">
          <span className="num font-bold text-vellum">{all.length}</span> sets{pages > 1 ? `, page ${page} of ${pages}` : ''}
        </p>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          {sets.map((s) => {
            const classes = classesFromMask(s.cls ?? s.pieces.map((p) => items.get(p)?.cls ?? 0).find(Boolean));
            return (
              <article key={s.id} id={`set-${s.id}`} className={`frame scroll-mt-6 p-5 ${s.id === focus ? 'gilt' : ''}`}>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-display text-[1.3rem]" style={{ color: QUALITY_COLOR[s.q ?? 3] }}>
                    {s.n}
                  </h2>
                  {s.ch === 'n' && <Badge tone="new">New</Badge>}
                  {Array.isArray(s.ch) && <Badge tone="changed">Changed</Badge>}
                  {s.era ? <Badge tone="removed">Era set</Badge> : null}
                </div>
                <div className="mt-0.5 text-[14px] text-fog">
                  {s.lo && s.hi ? `Item level ${s.lo} to ${s.hi}` : ''}
                  {classes.length ? `, ${classes.map((c) => CLASS_NAMES[c]).join(', ')}` : ''}
                </div>
                <ul className="mt-3 grid gap-1.5 sm:grid-cols-2">
                  {s.pieces.map((p) => {
                    const x = items.get(p);
                    return x ? (
                      <li key={p} className="min-w-0">
                        <ItemLink item={x} size={24} className="text-[14.5px]" />
                      </li>
                    ) : null;
                  })}
                </ul>
                {s.bonus && s.bonus.length > 0 && (
                  <ul className="mt-3 space-y-1 border-t border-iron/70 pt-3 text-[14.5px]">
                    {s.bonus.map(([n, t], i) => (
                      <li key={i} className="text-tt-green">
                        <span className="text-gilt-bright">({n})</span> {t}
                      </li>
                    ))}
                  </ul>
                )}
              </article>
            );
          })}
        </div>
        {pages > 1 && (
          <nav aria-label="Pages" className="mt-8 flex flex-wrap items-center gap-1.5">
            {Array.from({ length: pages }, (_, i) => i + 1).map((n) => (
              <Link key={n} href={qs({ p: n === 1 ? undefined : String(n) })} aria-current={n === page ? 'page' : undefined} className={`num grid h-9 min-w-9 place-items-center rounded-full border px-2 text-[15px] ${n === page ? 'border-gilt/60 bg-gilt/15 text-gilt-bright' : 'border-iron text-parch hover:border-ash'}`}>
                {n}
              </Link>
            ))}
          </nav>
        )}
      </Container>
    </div>
  );
}
