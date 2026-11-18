import type { Metadata } from 'next';
import Link from 'next/link';
import { Badge, Container, SectionTitle } from '@/components/ui';
import { Vista } from '@/components/vista';
import { getDungeons, getZones } from '@/lib/data';
import { CAPITALS, CONTINENT, isLadderZone, TERRITORY_COLOR, zoneLevels } from '@/lib/world';
import { TERRITORY } from '@/lib/wow';

export const metadata: Metadata = {
  title: 'Zones by level',
  description: 'Every zone in World of Warcraft: Forever on one level ladder, from Zephras Isle to Mount Hyjal, with the new zones and dungeons marked.',
  alternates: { canonical: '/world' },
};

export default function WorldPage() {
  const zones = getZones();
  const ladder = zones.filter(isLadderZone);
  const groups = ['Skywall', 'Eastern Kingdoms', 'Kalimdor'].map((name) => ({
    name,
    zones: ladder.filter((z) => CONTINENT(z) === name).sort((a, b) => zoneLevels(a)!.lo - zoneLevels(b)!.lo || zoneLevels(a)!.hi - zoneLevels(b)!.hi),
  }));
  const capitals = zones.filter((z) => CAPITALS.has(z.id));
  const dungeons = getDungeons().filter((d) => d.kind === 'dungeon' && d.levels).sort((a, b) => a.levels![0] - b.levels![0]);
  const pct = (lv: number) => ((lv - 1) / 60) * 100;
  return (
    <>
      <Vista art="ashenvale" title="The world, level by level" kicker={`${ladder.length} leveling zones, ${dungeons.length} dungeons`}>
        Every zone by level. Forever’s new zones are in green.
      </Vista>
      <Container className="space-y-16">
        <section aria-label="Level ladder" className="frame p-4 sm:p-6">
          <div className="mb-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-[14px] text-mist">
            {[0, 1, 2].map((t) => (
              <span key={t} className="inline-flex items-center gap-2">
                <span className="h-2.5 w-6 rounded-sm" style={{ background: TERRITORY_COLOR[t] }} />
                {TERRITORY[t]}
              </span>
            ))}
            <span className="inline-flex items-center gap-2">
              <span className="h-2.5 w-6 rounded-sm bg-leaf shadow-[0_0_10px_var(--color-leaf)]" />
              New in Forever
            </span>
            <span className="inline-flex items-center gap-2">
              <span className="h-2.5 w-6 rounded-sm border border-dashed border-mist" />
              Range estimated from quests
            </span>
          </div>
          <div className="relative">
            <div className="ml-[150px] grid grid-cols-6 border-b border-iron pb-1 text-[12.5px] text-fog sm:ml-[200px]">
              {[1, 10, 20, 30, 40, 50].map((l) => (
                <span key={l} className="num">
                  {l}
                </span>
              ))}
            </div>
            {groups.map((g) =>
              g.zones.length ? (
                <div key={g.name} className="mt-4">
                  <div className="mb-1.5 font-display text-[1.05rem] text-gilt">{g.name}</div>
                  <ul className="space-y-1">
                    {g.zones.map((z) => {
                      const lv = zoneLevels(z)!;
                      const isNew = z.st === 'new';
                      return (
                        <li key={z.id} className="group grid grid-cols-[150px_minmax(0,1fr)] items-center gap-0 sm:grid-cols-[200px_minmax(0,1fr)]">
                          <Link href={`/world/${z.id}`} className={`truncate pr-3 text-[14.5px] hover:text-gilt-bright ${isNew ? 'text-leaf-bright' : 'text-parch'}`}>
                            {z.n}
                          </Link>
                          <div className="relative h-6 rounded-lg bg-[repeating-linear-gradient(90deg,transparent_0,transparent_calc(16.666%-1px),rgb(58_48_39/0.7)_calc(16.666%-1px),rgb(58_48_39/0.7)_16.666%)]">
                            <Link
                              href={`/world/${z.id}`}
                              title={`${z.n}: levels ${lv.lo} to ${lv.hi}`}
                              className={`num absolute inset-y-[3px] flex items-center justify-end rounded-lg px-1.5 text-[11.5px] font-bold text-abyss transition-[filter] group-hover:brightness-125 ${lv.approx ? 'border border-dashed' : ''}`}
                              style={{
                                left: `${pct(lv.lo)}%`,
                                width: `${Math.max(4, pct(lv.hi + 1) - pct(lv.lo))}%`,
                                background: isNew ? 'var(--color-leaf)' : `${TERRITORY_COLOR[z.t] ?? '#888'}`,
                                boxShadow: isNew ? '0 0 12px rgb(169 196 127 / .4)' : undefined,
                                borderColor: lv.approx ? 'rgb(242 233 216 / .75)' : undefined,
                              }}
                            >
                              {lv.lo}–{lv.hi}
                            </Link>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ) : null,
            )}
          </div>
        </section>

        <section>
          <SectionTitle title="Dungeons on the way" href="/dungeons" linkLabel="All dungeons and raids">
            Five-player dungeons by level. The nine new ones are marked.
          </SectionTitle>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {dungeons.map((d) => (
              <Link key={d.slug} href={`/dungeons/${d.slug}`} className="frame flex items-center justify-between gap-3 px-4 py-3 hover:border-gilt/50">
                <span className="min-w-0">
                  <span className={`block truncate font-medium ${d.isNew ? 'text-leaf-bright' : 'text-vellum'}`}>{d.name}</span>
                  <span className="block truncate text-[13.5px] text-fog">{d.location}</span>
                </span>
                <span className="num shrink-0 text-[14.5px] text-gilt">
                  {d.levels![0]} to {d.levels![1]}
                </span>
              </Link>
            ))}
          </div>
        </section>

        <section>
          <SectionTitle title="Capitals" />
          <div className="flex flex-wrap gap-2">
            {capitals.map((z) => (
              <Link key={z.id} href={`/world/${z.id}`} className="frame px-4 py-2.5 hover:border-gilt/50">
                <span className="text-vellum">{z.n}</span>
                <Badge tone={z.t === 0 ? 'alliance' : 'horde'} className="ml-2">
                  {TERRITORY[z.t]}
                </Badge>
              </Link>
            ))}
          </div>
        </section>
      </Container>
    </>
  );
}
