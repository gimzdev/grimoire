import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ClassChanges } from '@/components/class-changes';
import { ClassTrail } from '@/components/class-trail';
import { TocSpy } from '@/components/toc-spy';
import { Container } from '@/components/ui';
import { Vista } from '@/components/vista';
import { CLASS_ART } from '@/lib/art';
import { getClass, getGuide, getGuides } from '@/lib/data';
import { SITE, siteUrl } from '@/lib/site';
import { Markdown, tableOfContents } from '@/lib/markdown';
import { classChanges } from '@/lib/news';
import { SupportLink, SupportNote } from '@/components/support';

export function generateStaticParams() {
  return getGuides().map((g) => ({ slug: g.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const g = getGuide(slug);
  if (!g) return {};
  // The link picture is the guide's own card (opengraph-image.tsx beside this page)
  return { title: g.title, description: g.description, alternates: { canonical: `/guides/${g.slug}` }, openGraph: { title: g.title, description: g.description, type: 'article', modifiedTime: g.updated, siteName: SITE.name } };
}

export default async function GuidePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const g = getGuide(slug);
  if (!g) notFound();
  const c = g.cls ? getClass(g.cls) : undefined;
  // a class guide ends with the class's hotfixes and its other pages: both are on the page's list of sections
  const toc = [
    ...tableOfContents(g.body),
    ...(c && classChanges(c.slug).length ? [{ id: 'class-changes', text: 'What Blizzard changed' }] : []),
    ...(c ? [{ id: 'class-trail', text: `Also for ${c.name}s` }] : []),
  ];
  const others = getGuides().filter((x) => x.slug !== g.slug && (x.category === g.category || x.category === 'Getting started')).slice(0, 4);
  const updated = new Date(g.updated).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
  const base = siteUrl();
  const article = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: g.title,
    description: g.description,
    dateModified: g.updated,
    url: `${base}/guides/${g.slug}`,
    image: `${base}/guides/${g.slug}/opengraph-image`,
    about: { '@type': 'VideoGame', name: 'World of Warcraft: Forever', publisher: 'Blizzard Entertainment' },
    author: { '@type': 'Organization', name: 'Grimoire', url: base },
    publisher: { '@type': 'Organization', name: 'Grimoire', url: base },
  };
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(article) }} />
      <Vista art={g.art ?? (g.cls ? CLASS_ART[g.cls] : 'expanses') ?? 'expanses'} tint={c?.color} kicker={`${g.category}, updated ${updated}, ${g.readMinutes} min read`} title={g.title}>
        {g.description}
      </Vista>
      <Container className="grid gap-10 lg:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="hidden lg:block">
          {toc.length > 1 && (
            <nav aria-label="On this page" className="sticky top-[92px]">
              <div className="font-display text-[1.05rem] text-gilt">On this page</div>
              <ol className="mt-3 space-y-2 border-l border-iron pl-4 text-[14.5px]">
                {toc.map((t) => (
                  <li key={t.id}>
                    <a
                      href={`#${t.id}`}
                      className="relative block text-mist before:absolute before:top-0 before:-left-[17px] before:h-full before:w-[2px] before:bg-gilt before:opacity-0 hover:text-vellum aria-[current=location]:text-vellum aria-[current=location]:before:opacity-100"
                    >
                      {t.text}
                    </a>
                  </li>
                ))}
              </ol>
              <TocSpy ids={toc.map((t) => t.id)} />
              {c && (
                <div className="mt-8 space-y-2 text-[14.5px]">
                  <Link href={`/talents/${c.slug}`} className="block text-gilt hover:text-gilt-bright">
                    {c.name} talent calculator
                  </Link>
                  <Link href={`/classes/${c.slug}`} className="block text-gilt hover:text-gilt-bright">
                    {c.name} class page
                  </Link>
                </div>
              )}
              <SupportLink className="mt-8" />
            </nav>
          )}
        </aside>
        <article className="min-w-0 max-w-[760px]">
          <Markdown source={g.body} />
          {c && <ClassChanges cls={c.slug} className="mt-14" />}
          {c && <ClassTrail cls={c.slug} here="guide" className="mt-14" />}
          <SupportNote className="mt-12">Grimoire is free, with no ads and no paywall. Did this guide save you some time?</SupportNote>
          {others.length > 0 && (
            <div className="mt-16 border-t border-iron pt-8">
              <div className="font-display text-[1.3rem] text-vellum">Keep reading</div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {others.map((o) => (
                  <Link key={o.slug} href={`/guides/${o.slug}`} className="frame p-4 hover:border-gilt/50">
                    <div className="text-[13px] text-gilt">{o.category}</div>
                    <div className="font-display text-[1.15rem] text-vellum">{o.title}</div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </article>
      </Container>
    </>
  );
}
