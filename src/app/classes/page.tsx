import type { Metadata } from 'next';
import Link from 'next/link';
import { WowIcon } from '@/components/icon';
import { Badge, Container } from '@/components/ui';
import { Vista } from '@/components/vista';
import { getClasses, getRaces } from '@/lib/data';
import { CLASS_COPY } from '@/lib/copy';
import { ROLE_LABEL } from '@/lib/wow';

export const metadata: Metadata = {
  title: 'Classes',
  description: 'All nine classes in World of Warcraft: Forever: roles, races, new race combinations and what changed in their talents and abilities.',
  alternates: { canonical: '/classes' },
};

export default function ClassesPage() {
  const classes = getClasses();
  const races = new Map(getRaces().map((r) => [r.slug, r]));
  return (
    <>
      <Vista art="newPower" title="Classes">
        Nine classes, six new race combinations, and every talent tree rebuilt.
      </Vista>
      <Container>
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {classes.map((c) => (
            <article
              key={c.slug}
              className="frame group relative flex flex-col overflow-hidden p-6"
              style={{ backgroundImage: `radial-gradient(90% 70% at 100% 0%, ${c.color}1c, transparent 60%), linear-gradient(180deg, rgb(18 20 24 / .94), rgb(10 11 14 / .96))` }}
            >
              <div className="flex items-start gap-4">
                <WowIcon icon={c.icon} size={58} name={c.name} />
                <div className="min-w-0">
                  <h2 className="text-[1.9rem] leading-none" style={{ color: c.color }}>
                    <Link href={`/classes/${c.slug}`} className="after:absolute after:inset-0">
                      {c.name}
                    </Link>
                  </h2>
                  <div className="mt-2 text-[14.5px] text-mist">
                    {c.resource}, {c.armor.filter((a) => a !== 'Shield').at(-1)?.toLowerCase()} armor
                  </div>
                </div>
              </div>
              <p className="mt-4 text-[16px] leading-relaxed text-parch">{CLASS_COPY[c.slug]?.blurb}</p>
              <ul className="mt-5 space-y-2">
                {c.specs.map((s) => (
                  <li key={s.slug} className="flex items-center gap-2.5 text-[15.5px]">
                    <WowIcon icon={s.icon} size={24} name={s.name} />
                    <span className="text-vellum">{s.name}</span>
                    <span className="text-fog">{ROLE_LABEL[s.role]}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-5 flex flex-wrap items-center gap-1.5">
                {c.races.map((slug) => {
                  const r = races.get(slug);
                  if (!r) return null;
                  const fresh = c.newRaces.includes(slug);
                  return (
                    <span key={slug} title={`${r.name}${fresh ? ' (new in Forever)' : ''}`} className={`rounded-xl ${fresh ? 'ring-1 ring-leaf ring-offset-1 ring-offset-night' : ''}`}>
                      <WowIcon icon={r.icon} size={26} name={r.name} />
                    </span>
                  );
                })}
              </div>
              <div className="mt-auto flex flex-wrap gap-2 pt-6">
                <Badge tone="new">{c.talentStats.new} new talents</Badge>
                <Badge tone="changed">{c.talentStats.changed} reworked</Badge>
                {c.newRaces.length > 0 && <Badge tone="gilt">{c.newRaces.length} new race{c.newRaces.length > 1 ? 's' : ''}</Badge>}
              </div>
            </article>
          ))}
        </div>
      </Container>
    </>
  );
}
