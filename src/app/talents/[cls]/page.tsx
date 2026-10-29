import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { TalentCalculator } from '@/components/talents/calculator';
import { WowIcon } from '@/components/icon';
import { GameText } from '@/components/game-text';
import { Container, Badge } from '@/components/ui';
import { Backdrop } from '@/components/backdrop';
import { CLASS_ART } from '@/lib/art';
import { getBuildsFor, getClass, getClasses, getTalents } from '@/lib/data';

export function generateStaticParams() {
  return getClasses().map((c) => ({ cls: c.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ cls: string }> }): Promise<Metadata> {
  const { cls } = await params;
  const c = getClass(cls);
  if (!c) return {};
  return {
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
          builds={getBuildsFor(cls)}
          initial={{ code: one(sp.b), order: one(sp.o), talented: one(sp.t) === '1', focus: Number.isFinite(focus) && focus > 0 ? focus : undefined }}
        />
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
