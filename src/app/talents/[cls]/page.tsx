import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { AddonStrip } from '@/components/addon-button';
import { TalentCalculator } from '@/components/talents/calculator';
import { WowIcon } from '@/components/icon';
import { GameText } from '@/components/game-text';
import { Container, Badge } from '@/components/ui';
import { Backdrop } from '@/components/backdrop';
import { CLASS_ART } from '@/lib/art';
import { getBarsFor, getBuildsFor, getClass, getClasses, getTalents } from '@/lib/data';
import { BUILD_GROUPS, buildGroup } from '@/lib/build-groups';
import { buildHref, buildTitle } from '@/lib/build-pages';
import { SITE } from '@/lib/site';

export function generateStaticParams() {
  return getClasses().map((c) => ({ cls: c.slug }));
}

export async function generateMetadata({ params, searchParams }: { params: Promise<{ cls: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }): Promise<Metadata> {
  const { cls } = await params;
  const c = getClass(cls);
  if (!c) return {};
  // A shared build's link shows that build's trees (opengraph-image-build/route.tsx reads the same query)
  const sp = await searchParams;
  const q = new URLSearchParams();
  for (const k of ['b', 'o', 'v']) {
    const v = sp[k];
    const one = Array.isArray(v) ? v[0] : v;
    if (one && /^[0-9a-zA-Z-]{1,80}$/.test(one)) q.set(k, one);
  }
  const image = { url: `/talents/${c.slug}/opengraph-image-build${q.size ? `?${q}` : ''}`, width: 1200, height: 630, alt: `${c.name} talent trees` };
  return {
    openGraph: { images: [image], siteName: SITE.name, type: 'website' },
    twitter: { card: 'summary_large_image', images: [image] },
    title: `${c.name} talent calculator`,
    description: `Plan a ${c.name} build for World of Warcraft: Forever with the new talent trees: ${c.talentStats.new} new talents and ${c.talentStats.changed} reworked ones, point order, presets and share links.`,
    alternates: { canonical: `/talents/${c.slug}` },
  };
}

export default async function TalentPage({ params, searchParams }: { params: Promise<{ cls: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { cls } = await params;
  const sp = await searchParams;
  const c = getClass(cls);
  const data = getTalents(cls);
  if (!c || !data) notFound();
  const classes = getClasses().map((x) => ({ slug: x.slug, name: x.name, color: x.color, icon: x.icon }));
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const focus = Number(one(sp.focus));
  const builds = getBuildsFor(cls);
  return (
    <div className="relative isolate">
      <Backdrop art={CLASS_ART[c.slug] ?? 'expanses'} strength={0.5} height={640} />
      <Container className="relative pt-10">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-[2.3rem] leading-tight text-vellum sm:text-[2.8rem]">
              <span style={{ color: c.color }}>{c.name}</span> talents
            </h1>
            <p className="mt-1 max-w-2xl text-[17px] text-mist">
              51 points across Forever’s rebuilt trees. {c.talentStats.new} talents are new, {c.talentStats.changed} were reworked and {c.talentStats.removed} Classic
              talents are gone.
            </p>
          </div>
        </div>
        <TalentCalculator
          cls={{ slug: c.slug, name: c.name, color: c.color, icon: c.icon }}
          classes={classes}
          data={data}
          builds={builds}
          bars={getBarsFor(cls)}
          initial={{ code: one(sp.b), order: one(sp.o), v: one(sp.v), talented: one(sp.t) === '1', focus: Number.isFinite(focus) && focus > 0 ? focus : undefined }}
        />
        <AddonStrip from="talents" className="mt-6">
          In game, the add-on shows a build point by point as you level and checks it against the talents you spent.
        </AddonStrip>
        {builds.length > 0 && (
          <section className="mt-12" aria-labelledby="builds">
            <h2 id="builds" className="text-[1.7rem] text-vellum">
              {c.name} builds
            </h2>
            <p className="mt-1 max-w-3xl text-mist">Each with its points in order, its action bar and why each talent is there.</p>
            <div className="mt-5 grid gap-5 lg:grid-cols-3">
              {BUILD_GROUPS.map((g) => {
                const list = builds.filter((b) => buildGroup(b.kind) === g.key);
                return list.length ? (
                  <div key={g.key}>
                    <h3 className="mb-2 text-[15px] font-semibold text-mist">{g.label}</h3>
                    <ul className="space-y-1.5">
                      {list.map((b) => (
                        <li key={b.id}>
                          <Link href={buildHref(b)} className="text-[15.5px] text-gilt hover:text-gilt-bright">
                            {buildTitle(b, c)}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null;
              })}
            </div>
          </section>
        )}
        {data.removed.length > 0 && (
          <section className="mt-12">
            <h2 className="text-[1.7rem] text-vellum">Gone from the {c.name} trees</h2>
            <p className="mt-1 max-w-3xl text-mist">
              Classic talents with no counterpart in Forever. Some became trainer spells or baseline effects; check the{' '}
              <a href={`/classes/${c.slug}#abilities`} className="text-gilt hover:text-gilt-bright">
                {c.name} abilities
              </a>
              .
            </p>
            <ul className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {data.removed.map((r) => (
                <li key={r.id} className="frame flex gap-3 p-3.5">
                  <WowIcon icon={r.icon} size={38} name={r.name} />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-vellum line-through decoration-blood/70">{r.name}</span>
                      <Badge tone="removed">{r.tree}</Badge>
                    </div>
                    <GameText text={r.desc} className="mt-1 block text-[14.5px] leading-snug text-mist" />
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}
      </Container>
    </div>
  );
}
