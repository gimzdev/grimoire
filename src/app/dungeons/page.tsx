import type { Metadata } from 'next';
import Link from 'next/link';
import { ArtCard } from '@/components/art-card';
import { Badge, Container, SectionTitle } from '@/components/ui';
import { Vista } from '@/components/vista';
import { getDungeons, getEncounterData, getEncounters, getZoneMap } from '@/lib/data';

export const metadata: Metadata = {
  title: 'Dungeons and raids',
  description: 'The nine new World of Warcraft: Forever dungeons with their levels, the three raids that open on December 9, battlegrounds, and every Classic dungeon and raid with its bosses, abilities and loot.',
  alternates: { canonical: '/dungeons' },
};

export default function DungeonsPage() {
  const all = getDungeons();
  const raids = all.filter((d) => d.kind === 'raid');
  const fresh = all.filter((d) => d.kind === 'dungeon' && d.isNew);
  const classic = all.filter((d) => d.kind === 'dungeon' && !d.isNew).sort((a, b) => (a.levels?.[0] ?? 0) - (b.levels?.[0] ?? 0));
  const bgs = all.filter((d) => d.kind === 'battleground');
  // Classic's other raids have no page of their own: their zone pages hold their bosses.
  const classicRaids = Object.keys(getEncounterData().dungeons)
    .filter((key) => key.startsWith('zone-'))
    .map((key) => ({ zone: getZoneMap().get(Number(key.slice(5))), enc: getEncounters(key)! }))
    .filter((r) => r.zone);
  return (
    <>
      <Vista art="paintedValley" title="Dungeons and raids" kicker="Nine new dungeons, three raids on December 9">
        Forever adds a dungeon for every stretch of the road to 60 and opens its first raid tier five weeks after launch.
      </Vista>
      <Container className="space-y-20">
        <section>
          <SectionTitle title="The first raid tier">All three open on December 9, 2026. Tier pieces drop across all of them, and Hyjal Summit holds Forever’s first legendary weapon.</SectionTitle>
          <div className="grid gap-5 lg:grid-cols-3">
            {raids.map((r) => (
              <ArtCard key={r.slug} art={r.art ?? 'paintedValley'} href={`/dungeons/${r.slug}`} minH="min-h-[340px]">
                <div className="flex flex-wrap gap-2">
                  <Badge tone="gilt">{r.size} players</Badge>
                  {r.bossCount && <Badge tone="neutral">{r.bossCount} {r.bossCount === 1 ? 'boss' : 'bosses'}</Badge>}
                  {r.isNew && <Badge tone="new">New</Badge>}
                </div>
                <h3 className="mt-3 text-[2rem] leading-tight text-vellum">{r.name}</h3>
                <p className="mt-2 text-[15.5px] leading-relaxed text-parch">{r.summary}</p>
              </ArtCard>
            ))}
          </div>
          <ol className="mt-6 grid gap-3 md:grid-cols-3">
            {[
              ['December 9, 2026', 'Barrow Deeps, Hyjal Summit and Onyxia’s Lair open.'],
              ['Spring 2027', 'Two new raids, one for 10 players and one for 20, with new dungeons and quests.'],
              ['Summer 2027', 'A revamped iconic raid and another new raid.'],
            ].map(([when, what], i) => (
              <li key={when} className="frame flex gap-4 p-4">
                <span className="font-display text-[1.6rem] leading-none text-gilt">{i + 1}</span>
                <span>
                  <span className="block font-medium text-vellum">{when}</span>
                  <span className="text-[15px] text-mist">{what}</span>
                </span>
              </li>
            ))}
          </ol>
        </section>

        <section>
          <SectionTitle title="Nine new dungeons">Four have been previewed in full; the other five are announced with their levels.</SectionTitle>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {fresh.map((d) => (
              <ArtCard key={d.slug} art={d.art ?? 'paintedValley'} href={`/dungeons/${d.slug}`} minH="min-h-[230px]">
                <div className="flex flex-wrap gap-2">
                  <Badge tone={d.status === 'Previewed' ? 'new' : 'neutral'}>{d.status}</Badge>
                  {d.levels && (
                    <Badge tone="gilt">
                      Levels {d.levels[0]} to {d.levels[1]}
                    </Badge>
                  )}
                </div>
                <h3 className="mt-2.5 text-[1.55rem] leading-tight text-vellum">{d.name}</h3>
                <p className="mt-1 text-[14.5px] text-mist">{d.location}</p>
              </ArtCard>
            ))}
          </div>
        </section>

        <section>
          <SectionTitle title="Battlegrounds" />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {bgs.map((b) => (
              <Link key={b.slug} href={`/dungeons/${b.slug}`} className={`frame p-4 hover:border-gilt/50 ${b.isNew ? 'gilt' : ''}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className={`font-display text-[1.2rem] ${b.isNew ? 'text-leaf-bright' : 'text-vellum'}`}>{b.name}</span>
                  <span className="num text-[14px] text-gilt">
                    {b.size}v{b.size}
                  </span>
                </div>
                <p className="mt-1.5 text-[14.5px] leading-snug text-mist">{b.summary}</p>
              </Link>
            ))}
          </div>
        </section>

        <section>
          <SectionTitle title="Classic dungeons">Still part of the road to 60. Each page lists the bosses in order with their abilities and loot, and the notable drops of the regular mobs.</SectionTitle>
          <div className="frame divide-y divide-iron/60">
            {classic.map((d) => (
              <Link key={d.slug} href={`/dungeons/${d.slug}`} className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-white/[0.03]">
                <span className="text-vellum">{d.name}</span>
                <span className="flex items-center gap-4 text-[14.5px]">
                  <span className="hidden text-fog sm:inline">{d.location}</span>
                  {getEncounters(d.slug) && <span className="num hidden text-mist md:inline">{getEncounters(d.slug)!.bosses} bosses</span>}
                  {d.levels && (
                    <span className="num text-gilt">
                      {d.levels[0]}–{d.levels[1]}
                    </span>
                  )}
                </span>
              </Link>
            ))}
          </div>
        </section>

        {classicRaids.length > 0 && (
          <section>
            <SectionTitle title="Classic raids">Not among Forever’s launch raids. Each page lists the bosses in order with their abilities and loot, and the notable drops of the regular mobs.</SectionTitle>
            <div className="frame divide-y divide-iron/60">
              {classicRaids.map(({ zone, enc }) => (
                <Link key={zone!.id} href={`/world/${zone!.id}#bosses`} className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-white/[0.03]">
                  <span className="text-vellum">{zone!.n}</span>
                  <span className="flex items-center gap-4 text-[14.5px]">
                    {zone!.np ? <span className="num hidden text-fog sm:inline">{zone!.np} players</span> : null}
                    <span className="num text-mist">{enc.bosses} bosses</span>
                  </span>
                </Link>
              ))}
            </div>
          </section>
        )}
      </Container>
    </>
  );
}
