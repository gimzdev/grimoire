import type { Metadata, ResolvingMetadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { TocSpy } from '@/components/toc-spy';
import { Container } from '@/components/ui';
import { Vista } from '@/components/vista';
import { CLASS_ART } from '@/lib/art';
import { getClass, getGuide, getGuides } from '@/lib/data';
import { Markdown, tableOfContents } from '@/lib/markdown';

export function generateStaticParams() {
  return getGuides().map((g) => ({ slug: g.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }, parent: ResolvingMetadata): Promise<Metadata> {
  const { slug } = await params;
  const g = getGuide(slug);
  if (!g) return {};
  // A guide's own card keeps the site's link picture (src/app/opengraph-image.png, when there is one)
  const images = (await parent).openGraph?.images ?? [];
  return { title: g.title, description: g.description, alternates: { canonical: `/guides/${g.slug}` }, openGraph: { title: g.title, description: g.description, type: 'article', images } };
}

export default async function GuidePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const g = getGuide(slug);
  if (!g) notFound();
  const toc = tableOfContents(g.body);
  const c = g.cls ? getClass(g.cls) : undefined;
  const others = getGuides().filter((x) => x.slug !== g.slug && (x.category === g.category || x.category === 'Getting started')).slice(0, 4);
  const updated = new Date(g.updated).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  return (
    <>
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
            </nav>
          )}
        </aside>
        <article className="min-w-0 max-w-[760px]">
          <Markdown source={g.body} />
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
