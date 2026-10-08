import type { Metadata } from 'next';
import Link from 'next/link';
import { Backdrop } from '@/components/backdrop';
import { WowIcon } from '@/components/icon';
import { Container, Empty } from '@/components/ui';
import { search } from '@/lib/search';

export async function generateMetadata({ searchParams }: { searchParams: Promise<{ q?: string }> }): Promise<Metadata> {
  const { q } = await searchParams;
  return { title: q ? `Search: ${q.slice(0, 60)}` : 'Search', robots: { index: false } };
}

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q: raw } = await searchParams;
  const q = (raw ?? '').slice(0, 80).trim();
  const groups = q ? search(q, 40) : [];
  const total = groups.reduce((n, g) => n + g.total, 0);
  return (
    <div className="relative isolate">
      <Backdrop art="darkshore" strength={0.38} />
      <Container className="pb-8 pt-10">
        <h1 className="text-[2.4rem] leading-tight text-vellum">Search</h1>
        <form action="/search" className="mt-5 flex max-w-2xl gap-2" role="search">
          <label htmlFor="q" className="sr-only">
            Search Grimoire
          </label>
          <input id="q" name="q" defaultValue={q} placeholder="Talents, items, zones, guides" className="field !h-12 flex-1 !rounded-full !px-5 !text-[17px]" />
          <button type="submit" className="h-12 rounded-full bg-gilt shadow-[inset_0_1px_0_rgb(255_255_255/0.45)] hover:bg-gilt-bright px-5 font-semibold text-[#1a1204]">
            Search
          </button>
        </form>
        {q && <p className="mt-4 text-[15px] text-mist">{total ? `${total.toLocaleString('en-US')} ${total === 1 ? 'result' : 'results'} for “${q}”` : ''}</p>}
        <div className="mt-6 space-y-8">
          {q && groups.length === 0 && (
            <Empty title={`Nothing matches “${q}”`}>Check the spelling, or try part of the name: “mortal” finds Mortal Strike and Mortal Shots.</Empty>
          )}
          {!q && <Empty title="Search the whole database">Type a talent, ability, item, zone, dungeon or guide. Press Ctrl+K on any page to search without leaving it.</Empty>}
          {groups.map((g) => (
            <section key={g.type}>
              <h2 className="font-display text-[1.4rem] text-vellum">
                {g.title} <span className="num text-[15px] text-fog">{g.total > g.hits.length ? `${g.hits.length} of ${g.total}` : g.total}</span>
              </h2>
              <ul className="mt-3 grid gap-x-6 gap-y-1 md:grid-cols-2">
                {g.hits.map((h) => (
                  <li key={h.id}>
                    <Link href={h.href} data-tip={h.tip} className="flex items-center gap-3 rounded-xl px-2 py-1.5 hover:bg-dusk">
                      {h.icon ? <WowIcon icon={h.icon} size={30} name={h.name} /> : <span className="size-[30px] shrink-0" />}
                      <span className="min-w-0">
                        <span className="block truncate text-[16px]" style={{ color: h.color ?? 'var(--color-vellum)' }}>
                          {h.name}
                        </span>
                        {h.sub && <span className="block truncate text-[13.5px] text-mist">{h.sub}</span>}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </Container>
    </div>
  );
}
