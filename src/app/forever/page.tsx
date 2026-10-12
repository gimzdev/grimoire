import type { Metadata } from 'next';
import Link from 'next/link';
import { ArtCard } from '@/components/art-card';
import { WowIcon } from '@/components/icon';
import { Timeline } from '@/components/timeline';
import { Container, Panel, SectionTitle } from '@/components/ui';
import { Vista } from '@/components/vista';
import { CLASS_COPY } from '@/lib/copy';
import { getClasses, getDungeons, getMeta, getRaces } from '@/lib/data';
import { ZONE_NOTES } from '@/lib/world';

export const revalidate = 3600;

export const metadata: Metadata = {
  title: 'What’s new in World of Warcraft: Forever',
  description: 'Everything that changed in World of Warcraft: Forever: the Skyborne, new class and race combinations, four zones, nine dungeons, three raids, rebuilt talents, the Legacy system, rulesets and the 2027 roadmap.',
  alternates: { canonical: '/forever' },
};

const FACTS: [string, string][] = [
  ['Level cap', '60, permanently. Content updates add to the world instead of raising the cap.'],
  ['Realms', 'Replaced by rulesets: Normal, PvP and Roleplaying at launch, Hardcore later.'],
  ['Travel', 'No flying mounts and no level scaling.'],
  ['Transmog', 'Available, and opt-in: you can turn it off to see everyone’s real gear.'],
  ['Graphics', 'Real-time shadows, volumetric fog and new water, with a toggle between the original and updated character models.'],
  ['Controllers', 'Official controller support.'],
  ['Camping', 'Pitch a camp to share profession stations and give your group buffs. Placing camping features has a one-hour cooldown.'],
  ['Price', 'Included with a World of Warcraft subscription or game time. The Skyborne race comes with the Skyborne Heroic Pack and above.'],
];

export default function ForeverPage() {
  const meta = getMeta();
  const classes = getClasses();
  const races = getRaces();
  const raceName = new Map(races.map((r) => [r.slug, r.name]));
  const dungeons = getDungeons().filter((d) => (d.isNew && d.kind === 'dungeon') || d.kind === 'raid');
  const zones = [
    { id: 16593, name: 'Zephras Isle', art: 'zephras', levels: '1 to 12' },
    { id: 16591, name: 'Riverglades', art: 'paintedVista', levels: 'about 36 to 44' },
    { id: 16651, name: 'Shen’dralas', art: 'untoldStories', levels: 'about 38 to 45' },
    { id: 616, name: 'Mount Hyjal', art: 'paintedValley', levels: '55 to 60' },
  ];
  const combos = classes.flatMap((c) => c.newRaces.filter((r) => !r.includes('skyborne')).map((r) => ({ cls: c, race: r })));

  return (
    <>
      <Vista art="zephras" title="What’s new in Forever">
        The original Azeroth at level 60 for good, with a new race, new zones and dungeons, reworked classes and account-wide progression.
      </Vista>
      <Container className="space-y-20 pb-8">
        <Timeline id="timeline" title="Launch timeline" />

        <section>
          <SectionTitle title="The ground rules" />
          <dl className="grid gap-x-10 gap-y-5 sm:grid-cols-2">
            {FACTS.map(([k, v]) => (
              <div key={k} className="border-t border-iron pt-3">
                <dt className="font-display text-[1.2rem] text-gilt-bright">{k}</dt>
                <dd className="mt-1 text-[16px] leading-relaxed text-parch">{v}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="grid items-center gap-8 lg:grid-cols-[1.1fr_1fr]">
          <ArtCard art="skyborne" href="/guides/skyborne" tag="New race" minH="min-h-[380px]" sizes="(min-width: 1024px) 55vw, 100vw">
            <h2 className="text-[2.2rem] leading-none text-vellum">The Skyborne</h2>
          </ArtCard>
          <div>
            <p className="text-[18px] leading-relaxed text-parch">
              Highborne exiles who made a pact with the wind spirits and built a civilization inside Skywall. Their story begins on Zephras Isle, and you choose their side at character creation: the Horde’s{' '}
              <Link href="/races/windshaper-skyborne" className="text-horde hover:underline">
                Windshapers
              </Link>{' '}
              can be Shamans, the Alliance’s{' '}
              <Link href="/races/high-order-skyborne" className="text-alliance hover:underline">
                High Order
              </Link>{' '}
              can be Mages, and both can be Druids, Hunters, Rogues and Warriors.
            </p>
            <h3 className="mt-8 text-[1.4rem] text-vellum">Six new class combinations</h3>
            <ul className="mt-3 grid gap-2 sm:grid-cols-2">
              {combos.map(({ cls, race }) => (
                <li key={cls.slug + race}>
                  <Link href={`/races/${race}`} className="flex items-center gap-2.5 rounded-xl border border-iron bg-night/60 px-2.5 py-2 hover:border-ash">
                    <WowIcon icon={cls.icon} size={26} name={cls.name} />
                    <span className="text-[15.5px] text-parch">
                      {raceName.get(race)} <span style={{ color: cls.color }}>{cls.name}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section>
          <SectionTitle title="Four new zones" href="/world" linkLabel="All zones by level" />
          <div className="grid gap-4 md:grid-cols-2">
            {zones.map((z) => (
              <ArtCard key={z.id} art={z.art} href={`/world/${z.id}`} tag={`Levels ${z.levels}`} minH="min-h-[300px]" sizes="(min-width: 768px) 50vw, 100vw">
                <h3 className="text-[1.7rem] leading-tight text-vellum">{z.name}</h3>
                <p className="mt-1.5 max-w-xl text-[15.5px] leading-relaxed text-parch">{ZONE_NOTES[z.id]}</p>
              </ArtCard>
            ))}
          </div>
        </section>

        <section>
          <SectionTitle title="Nine dungeons and three raids" href="/dungeons" linkLabel="Dungeons and raids">
            New dungeons fill every level band from 13 to 60. The first raids open on December 9.
          </SectionTitle>
          <div className="grid gap-x-8 md:grid-cols-2">
            {dungeons.map((d) => (
              <Link key={d.slug} href={`/dungeons/${d.slug}`} className="flex items-baseline justify-between gap-4 border-b border-iron/70 py-3 hover:border-ash">
                <span className="font-display text-[1.2rem] text-vellum">{d.name}</span>
                <span className="num shrink-0 text-[14.5px] text-mist">
                  {d.kind === 'raid' ? `Raid, ${d.size} players` : d.levels ? `Levels ${d.levels[0]} to ${d.levels[1]}` : ''}
                </span>
              </Link>
            ))}
          </div>
        </section>

        <section>
          <SectionTitle title="Every class was rebuilt" href="/talents" linkLabel="Open the talent calculator">
            {meta.counts.talentsNew} new talents, {meta.counts.talentsChanged} reworked and {meta.counts.talentsRemoved} removed across 27 trees, plus {meta.counts.abilitiesIntroduced} new trainer ranks.
          </SectionTitle>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {classes.map((c) => (
              <Panel key={c.slug} className="flex flex-col p-5">
                <div className="flex items-center gap-3">
                  <WowIcon icon={c.icon} size={40} name={c.name} />
                  <h3 className="text-[1.45rem]" style={{ color: c.color }}>
                    {c.name}
                  </h3>
                </div>
                <p className="mt-3 flex-1 text-[15.5px] leading-relaxed text-parch">{CLASS_COPY[c.slug]?.forever}</p>
                <div className="mt-4 flex gap-4 text-[15px]">
                  <Link href={`/guides/${c.slug}`} className="text-gilt hover:text-gilt-bright">
                    Guide
                  </Link>
                  <Link href={`/talents/${c.slug}`} className="text-gilt hover:text-gilt-bright">
                    Talents
                  </Link>
                  <Link href={`/classes/${c.slug}`} className="text-gilt hover:text-gilt-bright">
                    Class page
                  </Link>
                </div>
              </Panel>
            ))}
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-3">
          <ArtCard art="legacy" href="/guides/legacy-system" minH="min-h-[300px]">
            <h3 className="text-[1.6rem] leading-tight text-vellum">The Legacy system</h3>
            <p className="mt-1.5 text-[15px] leading-relaxed text-parch">Sixty-five account-wide challenges. Each one earns a point to spend on perks, up to 16 per character at launch, plus mounts, pets and toys along the way.</p>
          </ArtCard>
          <ArtCard art="rulesets" href="/guides/rulesets" minH="min-h-[300px]">
            <h3 className="text-[1.6rem] leading-tight text-vellum">Rulesets, not realms</h3>
            <p className="mt-1.5 text-[15px] leading-relaxed text-parch">Pick how you want to play, not a server. Group with anyone on your ruleset; battlegrounds mix them, except Hardcore.</p>
          </ArtCard>
          <ArtCard art="unknownPaths" href="/guides/pvp" minH="min-h-[300px]">
            <h3 className="text-[1.6rem] leading-tight text-vellum">Darkspear Islands</h3>
            <p className="mt-1.5 text-[15px] leading-relaxed text-parch">A new fifteen-player battleground on the Echo Isles that mixes a central flag with capture points.</p>
          </ArtCard>
        </section>

        <section>
          <SectionTitle title="What comes after launch">Blizzard’s roadmap for 2027. The level cap stays at 60, so each update adds to the world instead of replacing it.</SectionTitle>
          <div className="grid gap-4 md:grid-cols-2">
            <Panel as="article" className="p-6">
              <div className="text-[14px] text-gilt">Spring 2027</div>
              <h3 className="mt-1 text-[1.4rem] text-vellum">New raids, dungeons and quests</h3>
              <p className="mt-2 text-[16px] leading-relaxed text-parch">A new ten-player raid and a new twenty-player raid, with new dungeons and quests alongside them.</p>
            </Panel>
            <Panel as="article" className="p-6">
              <div className="text-[14px] text-gilt">Summer 2027</div>
              <h3 className="mt-1 text-[1.4rem] text-vellum">An iconic raid returns</h3>
              <p className="mt-2 text-[16px] leading-relaxed text-parch">A revamped version of an iconic raid, plus another new raid.</p>
            </Panel>
          </div>
        </section>

        <section className="border-t border-iron pt-8 text-[15px] text-mist">
          <h2 className="font-display text-[1.3rem] text-vellum">Sources</h2>
          <ul className="mt-3 space-y-1.5">
            <li>
              <a className="text-gilt hover:text-gilt-bright" href="https://worldofwarcraft.blizzard.com/en-us/news" target="_blank" rel="noreferrer">
                Blizzard’s World of Warcraft news
              </a>
              : the Skyborne, rulesets, Legacy and pre-purchase announcements, September 2026.
            </li>
            <li>Game data: read from build {meta.build} on {new Date(meta.extracted).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}.</li>
          </ul>
        </section>
      </Container>
    </>
  );
}
