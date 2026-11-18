import type { Metadata } from 'next';
import Link from 'next/link';
import { AddonStrip } from '@/components/addon-button';
import { Backdrop } from '@/components/backdrop';
import { WowIcon } from '@/components/icon';
import { Container } from '@/components/ui';
import { BUILD_GROUPS, roleTag } from '@/lib/build-groups';
import { buildHref, buildIndex, kindLabel } from '@/lib/build-pages';
import { getBuilds } from '@/lib/data';

export const metadata: Metadata = {
  title: 'WoW Forever builds for every class: leveling, raid and PvP',
  description: `${getBuilds().length} talent builds for World of Warcraft: Forever, for leveling, raids, dungeons and PvP, with every point in order, the action bar and why each talent is there.`,
  alternates: { canonical: '/builds' },
};

export default function BuildsPage() {
  const index = buildIndex();
  return (
    <div className="relative isolate">
      <Backdrop art="expanses" strength={0.35} height={480} />
      <Container className="relative pt-10">
        <header className="max-w-3xl">
          <h1 className="text-[2.4rem] leading-[1.05] text-vellum sm:text-[3rem]">Builds for every class</h1>
          <p className="mt-4 text-[17.5px] leading-relaxed text-parch">
            {getBuilds().length} builds on Forever’s rebuilt talent trees: for leveling, for raids, dungeons, tanking and healing at 60, and for PvP. Each has its points in order, its
            action bar and why each talent is there, and opens in the calculator.
          </p>
        </header>
        <nav aria-label="Classes" className="mt-6 flex flex-wrap gap-2">
          {index.map(({ cls, c }) => (
            <a key={cls} href={`#${cls}`} className="glass inline-flex items-center gap-2 rounded-full py-1 pl-1 pr-3.5 text-[14.5px] font-medium hover:border-white/25" style={{ color: c.color }}>
              <WowIcon icon={c.icon} size={26} name={c.name} rounded />
              {c.name}
            </a>
          ))}
        </nav>

        <div className="mt-12 space-y-14">
          {index.map(({ cls, c, groups }) => (
            <section key={cls} id={cls} className="scroll-mt-28" aria-labelledby={`h-${cls}`}>
              <div className="flex flex-wrap items-end justify-between gap-4">
                <h2 id={`h-${cls}`} className="flex items-center gap-3 text-[2rem] leading-tight" style={{ color: c.color }}>
                  <WowIcon icon={c.icon} size={40} name={c.name} />
                  {c.name}
                </h2>
                <div className="flex gap-4 text-[15px]">
                  <Link href={`/talents/${cls}`} className="text-gilt hover:text-gilt-bright">
                    Calculator
                  </Link>
                  <Link href={`/classes/${cls}`} className="text-gilt hover:text-gilt-bright">
                    Class
                  </Link>
                </div>
              </div>
              <div className="mt-5 grid gap-5 lg:grid-cols-3">
                {groups.map((g) => (
                  <div key={g.key}>
                    <h3 className="mb-2.5 text-[15px] font-semibold text-mist">{BUILD_GROUPS.find((x) => x.key === g.key)!.label}</h3>
                    <ul className="space-y-2">
                      {g.builds.map((b) => {
                        const role = roleTag(b);
                        return (
                          <li key={b.id}>
                            <Link href={buildHref(b)} className="frame flex items-center justify-between gap-3 px-4 py-2.5 transition-colors hover:border-white/[0.16]">
                              <span className="min-w-0">
                                <span className="block truncate text-[16px] font-medium text-vellum">
                                  {b.name}
                                  {role && <span className="ml-2 text-[12.5px] font-semibold text-mist">{role}</span>}
                                </span>
                                <span className="text-[13px] text-fog">{kindLabel(b.kind)}</span>
                              </span>
                              <span className="num shrink-0 text-[14px] font-bold text-gilt-bright">{b.points.join(' / ')}</span>
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>

        <AddonStrip from="builds" className="mt-16">
          In game, the add-on has every one of these builds: follow one and it shows each point as you level.
        </AddonStrip>
      </Container>
    </div>
  );
}
