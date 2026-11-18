import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Backdrop } from '@/components/backdrop';
import { Container, Panel } from '@/components/ui';
import { buildHref, buildTitle } from '@/lib/build-pages';
import { getClass } from '@/lib/data';
import { Markdown } from '@/lib/markdown';
import { getNews, getNewsEntry, newsDay } from '@/lib/news';
import { SITE, siteUrl } from '@/lib/site';

export const dynamicParams = false;

export function generateStaticParams() {
  return getNews().map((n) => ({ date: n.date }));
}

export async function generateMetadata({ params }: { params: Promise<{ date: string }> }): Promise<Metadata> {
  const { date } = await params;
  const n = getNewsEntry(date);
  if (!n) return {};
  const title = `WoW Forever hotfixes, ${newsDay(n.date)}`;
  // The link picture is the day's own card (opengraph-image.tsx beside this page)
  return { title, description: n.description, alternates: { canonical: `/news/${n.date}` }, openGraph: { title, description: n.description, type: 'article', publishedTime: n.date, siteName: SITE.name } };
}

export default async function NewsEntryPage({ params }: { params: Promise<{ date: string }> }) {
  const { date } = await params;
  const n = getNewsEntry(date);
  if (!n) notFound();
  const all = getNews();
  const i = all.findIndex((x) => x.date === n.date);
  const newer = all[i - 1];
  const older = all[i + 1];
  const base = siteUrl();
  const article = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: `WoW Forever hotfixes, ${newsDay(n.date)}`,
    description: n.description,
    datePublished: n.date,
    dateModified: n.date,
    url: `${base}/news/${n.date}`,
    about: { '@type': 'VideoGame', name: 'World of Warcraft: Forever', publisher: 'Blizzard Entertainment' },
    author: { '@type': 'Organization', name: 'Grimoire', url: base },
    publisher: { '@type': 'Organization', name: 'Grimoire', url: base },
  };
  return (
    <div className="relative isolate">
      <Backdrop art="expanses" strength={0.32} height={420} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(article) }} />
      <Container className="relative pt-10">
        <nav aria-label="Breadcrumb" className="text-[14px] text-mist">
          <Link href="/news" className="hover:text-vellum">
            Hotfixes
          </Link>
        </nav>
        <div className="mt-4 grid gap-10 lg:grid-cols-[minmax(0,1fr)_320px]">
          <article className="max-w-3xl">
            <time dateTime={n.date} className="text-[15px] text-mist">
              {newsDay(n.date)}
            </time>
            <h1 className="mt-1 text-[2.3rem] leading-[1.05] text-vellum sm:text-[2.8rem]">{n.title}</h1>
            <p className="mt-4 text-[17.5px] leading-relaxed text-parch">{n.description}</p>
            <div className="prose-grim mt-8">
              <Markdown source={n.body} />
            </div>
            {n.source && (
              <p className="mt-8 text-[14.5px] text-mist">
                Written from{' '}
                <a href={n.source} target="_blank" rel="noopener noreferrer" className="text-gilt underline decoration-gilt/40 underline-offset-2 hover:text-gilt-bright">
                  Blizzard’s hotfix notes
                </a>
                , where every fix is listed.
              </p>
            )}
            <nav aria-label="Other days" className="mt-10 flex flex-wrap justify-between gap-4 text-[15px]">
              {older ? (
                <Link href={`/news/${older.date}`} className="text-gilt hover:text-gilt-bright">
                  ← {newsDay(older.date)}
                </Link>
              ) : (
                <span />
              )}
              {newer && (
                <Link href={`/news/${newer.date}`} className="text-gilt hover:text-gilt-bright">
                  {newsDay(newer.date)} →
                </Link>
              )}
            </nav>
          </article>
          {(n.builds.length > 0 || n.classes.length > 0) && (
            <aside className="space-y-4">
              {n.builds.length > 0 && (
                <Panel className="p-5">
                  <h2 className="text-[1.2rem] text-vellum">Builds this touches</h2>
                  <ul className="mt-3 space-y-1.5 text-[15px]">
                    {n.builds.map((b) => (
                      <li key={b.id}>
                        <Link href={buildHref(b)} className="text-gilt hover:text-gilt-bright">
                          {buildTitle(b)}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </Panel>
              )}
              {n.classes.length > 0 && (
                <Panel className="p-5">
                  <h2 className="text-[1.2rem] text-vellum">Talent calculators</h2>
                  <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-[15px]">
                    {n.classes.map((cls) => (
                      <li key={cls}>
                        <Link href={`/talents/${cls}`} style={{ color: getClass(cls)?.color }} className="hover:underline">
                          {getClass(cls)?.name ?? cls}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </Panel>
              )}
            </aside>
          )}
        </div>
      </Container>
    </div>
  );
}
