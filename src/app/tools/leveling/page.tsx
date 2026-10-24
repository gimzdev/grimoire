import type { Metadata } from 'next';
import Link from 'next/link';
import { Backdrop } from '@/components/backdrop';
import { WowIcon } from '@/components/icon';
import { LevelingRoute } from '@/components/leveling-route';
import { Container } from '@/components/ui';
import { getClasses, getRaces } from '@/lib/data';
import { routeHref, routesOfRace } from '@/lib/guide';
import { ADDON } from '@/lib/site';
import { CLASS_COLOR } from '@/lib/wow';

export const metadata: Metadata = {
  title: 'Leveling route',
  description:
    'A step-by-step leveling route to 60 for every race and class in World of Warcraft: Forever, with the class’s own quests, and where to quest, which dungeons to run, trainer spells, talent points and gear upgrades at every level.',
  alternates: { canonical: '/tools/leveling' },
};

const SIDE = { alliance: { name: 'Alliance', color: '#a9c8f5' }, horde: { name: 'Horde', color: '#f5a196' } } as const;

export default function LevelingPage() {
  const classes = getClasses();
  const byClass = new Map(classes.map((c) => [c.slug, c]));
  // Per faction, the races that have routes (the Skyborne's Zephras Isle has none yet), each with its classes.
  const sides = (['alliance', 'horde'] as const).map((side) => ({
    side,
    races: getRaces()
      .filter((r) => r.faction === side)
      .map((race) => ({ race, routes: routesOfRace(race.slug) }))
      .filter((x) => x.routes.length),
  }));
  return (
    <div className="relative isolate">
      <Backdrop art="barrens" strength={0.42} />
      <Container className="pb-8 pt-10">
        <h1 className="text-[2.4rem] leading-tight text-vellum sm:text-[2.9rem]">Leveling route</h1>
        <p className="mt-2 max-w-3xl text-[17.5px] leading-relaxed text-parch">
          A step-by-step route to 60 for every race and class, and for any level, where to quest, which dungeons are in range, what your trainer teaches next and which
          upgrades just unlocked. The{' '}
          <Link href="/guides/leveling" className="text-gilt-bright underline decoration-gilt/40 underline-offset-2 hover:decoration-gilt">
            leveling guide
          </Link>{' '}
          explains the road in full.
        </p>

        <section className="mt-10" aria-labelledby="routes">
          <h2 id="routes" className="text-[1.6rem] leading-tight text-vellum">
            Step by step, 1 to 60
          </h2>
          <p className="mt-2 max-w-3xl text-[15.5px] leading-relaxed text-mist">
            Pick your race, then your class. Every route takes in the class’s own quests (druid forms, hunter pets, warlock demons, shaman totems, warrior stances…) and
            <a href={ADDON.url} target="_blank" rel="noopener noreferrer" className="text-gilt-bright underline decoration-gilt/40 underline-offset-2 transition-colors hover:text-gilt hover:decoration-gilt">Grimoire’s add-on</a> follows the same routes in game.
          </p>
          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            {sides.map(({ side, races }) => (
              <section key={side} aria-labelledby={`side-${side}`} className="frame px-4 py-3 sm:px-5">
                <h3 id={`side-${side}`} className="pt-1 text-[14px] font-[640] tracking-[0.01em]" style={{ color: SIDE[side].color }}>
                  {SIDE[side].name}
                </h3>
                <ul className="divide-y divide-white/[0.06]">
                  {races.map(({ race, routes }) => (
                    <li key={race.slug} id={race.slug} className="scroll-mt-28 py-3.5">
                      <div className="flex items-center gap-3">
                        <WowIcon icon={race.icon} size={32} name={race.name} />
                        <span className="font-display text-[1.15rem] leading-tight text-vellum">{race.name}</span>
                        <span className="ml-auto text-right text-[13.5px] leading-tight text-mist">{routes[0].start}</span>
                      </div>
                      <ul className="mt-2.5 flex flex-wrap gap-1.5" aria-label={`${race.name} routes`}>
                        {routes.map((r) => (
                          <li key={r.id}>
                            <Link
                              href={routeHref(r.id)}
                              prefetch={false}
                              title={`${r.name}: ${r.quests} quests, about ${Math.round(r.hours)} hours`}
                              className="inline-flex h-8 items-center rounded-full bg-white/[0.04] px-3 text-[13.5px] font-[580] ring-1 ring-inset ring-white/[0.07] transition-colors hover:bg-white/[0.09] hover:ring-white/[0.16]"
                              style={{ color: CLASS_COLOR[r.class] }}
                            >
                              {byClass.get(r.class)?.name ?? r.class}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
          <p className="mt-3 max-w-3xl text-[14px] leading-relaxed text-fog">
            The Skyborne start on Zephras Isle, which has no route yet: from 12, follow your class’s route on your side.
          </p>
        </section>

        <section id="by-level" className="mt-14 scroll-mt-24" aria-labelledby="by-level-title">
          <h2 id="by-level-title" className="text-[1.6rem] leading-tight text-vellum">
            At your level
          </h2>
          <p className="mb-5 mt-2 max-w-3xl text-[15.5px] leading-relaxed text-mist">
            Where to quest, the quests to pick up, the dungeons in range, what your trainer teaches next and the upgrades that just unlocked.
          </p>
          <LevelingRoute classes={classes.map((c) => ({ slug: c.slug, name: c.name, color: c.color, icon: c.icon }))} />
        </section>
      </Container>
    </div>
  );
}
