import type { Metadata } from 'next';
import Link from 'next/link';
import { ArtCard } from '@/components/art-card';
import { WowIcon } from '@/components/icon';
import { Container, SectionTitle } from '@/components/ui';
import { Vista } from '@/components/vista';
import { CLASS_ART } from '@/lib/art';
import { getClasses, getGuides } from '@/lib/data';

export const metadata: Metadata = {
  title: 'Guides',
  description: 'World of Warcraft: Forever guides: getting started, leveling 1 to 60, the Legacy system, rulesets, the Skyborne, dungeons, raids and a guide for every class.',
  alternates: { canonical: '/guides' },
};

export default function GuidesPage() {
  const guides = getGuides();
  const classes = getClasses();
  const classGuides = guides.filter((g) => g.category === 'Classes');
  const featured = guides.filter((g) => g.category !== 'Classes').slice(0, 3);
  const rest = guides.filter((g) => g.category !== 'Classes').slice(3);
  return (
    <>
      <Vista art="paintedVista" title="Guides" kicker={`${guides.length} guides for World of Warcraft: Forever`} />
      <Container className="space-y-16">
        <section className="grid gap-5 lg:grid-cols-3">
          {featured.map((g) => (
            <ArtCard key={g.slug} art={g.art ?? 'paintedVista'} href={`/guides/${g.slug}`} tag={g.category} minH="min-h-[320px]">
              <h2 className="text-[1.6rem] leading-tight text-vellum">{g.title}</h2>
              <p className="mt-2 text-[15.5px] leading-relaxed text-parch">{g.description}</p>
            </ArtCard>
          ))}
        </section>

        <section>
          <SectionTitle title="Class guides">Specs, builds, stat priorities and leveling advice for each class.</SectionTitle>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {classGuides.map((g) => {
              const c = classes.find((x) => x.slug === g.cls);
              return (
                <ArtCard key={g.slug} art={g.art ?? CLASS_ART[g.cls ?? ''] ?? 'keyArt'} href={`/guides/${g.slug}`} minH="min-h-[200px]">
                  <div className="flex items-center gap-3">
                    {c && <WowIcon icon={c.icon} size={40} name={c.name} />}
                    <div>
                      <h3 className="text-[1.45rem] leading-tight" style={{ color: c?.color }}>
                        {c?.name ?? g.title}
                      </h3>
                      <div className="text-[14px] text-mist">{g.readMinutes} min read</div>
                    </div>
                  </div>
                </ArtCard>
              );
            })}
          </div>
        </section>

        {rest.length > 0 && (
          <section>
            <SectionTitle title="More guides" />
            <div className="grid gap-3 md:grid-cols-2">
              {rest.map((g) => (
                <Link key={g.slug} href={`/guides/${g.slug}`} className="frame flex items-start gap-4 p-5 hover:border-gilt/50">
                  {g.icon && <WowIcon icon={g.icon} size={40} name={g.title} />}
                  <div>
                    <div className="text-[13.5px] text-gilt">{g.category}</div>
                    <div className="font-display text-[1.3rem] leading-tight text-vellum">{g.title}</div>
                    <p className="mt-1 text-[15px] text-mist">{g.description}</p>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}
      </Container>
    </>
  );
}
