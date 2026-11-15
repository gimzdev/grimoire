import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { GameText } from '@/components/game-text';
import { WowIcon } from '@/components/icon';
import { Badge, Container, Panel, SectionTitle } from '@/components/ui';
import { Vista } from '@/components/vista';
import type { ArtKey } from '@/lib/art';
import { resolveArt } from '@/lib/art-server';
import { RACE_COPY } from '@/lib/copy';
import { getClasses, getRace, getRaces } from '@/lib/data';

const RACE_ART: Record<string, ArtKey> = {
  human: 'raceHuman',
  dwarf: 'raceDwarf',
  'night-elf': 'raceNightElf',
  gnome: 'raceGnome',
  'high-order-skyborne': 'raceHighOrder',
  orc: 'raceOrc',
  undead: 'raceUndead',
  tauren: 'raceTauren',
  troll: 'raceTroll',
  'windshaper-skyborne': 'raceWindshaper',
};

export function generateStaticParams() {
  return getRaces().map((r) => ({ race: r.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ race: string }> }): Promise<Metadata> {
  const { race } = await params;
  const r = getRace(race);
  if (!r) return {};
  return { title: `${r.name} racials and classes`, description: `${r.name} in World of Warcraft: Forever: racial abilities, playable classes and starting zone.`, alternates: { canonical: `/races/${r.slug}` } };
}

export default async function RacePage({ params }: { params: Promise<{ race: string }> }) {
  const { race } = await params;
  const r = getRace(race);
  if (!r) notFound();
  const classes = getClasses().filter((c) => r.classes.includes(c.slug));
  const skyborne = r.slug.includes('skyborne');
  return (
    <>
      <Vista
        art={RACE_ART[r.slug] ?? 'expanses'}
        kicker={`${r.faction === 'alliance' ? 'Alliance' : 'Horde'}, starting in ${r.start}`}
        title={r.name}
        aside={<WowIcon icon={r.icon} size={88} name={r.name} eager />}
      >
        {RACE_COPY[r.slug]}
      </Vista>
      <Container className="space-y-16">
        <section>
          <SectionTitle title="Racial abilities">Passive racials are always on.</SectionTitle>
          <div className="grid gap-4 md:grid-cols-2">
            {r.racials.map((x) => (
              <Panel key={x.id} className="flex gap-4 p-5">
                <WowIcon icon={x.icon} size={48} name={x.name} />
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-display text-[1.3rem] text-vellum">{x.name}</span>
                    <Badge tone={x.passive ? 'neutral' : 'gilt'}>{x.passive ? 'Passive' : 'Active'}</Badge>
                  </div>
                  <GameText text={x.desc} className="mt-1.5 block text-[16px] leading-relaxed text-parch" />
                </div>
              </Panel>
            ))}
          </div>
          {r.racialVariants && (
            <div className="mt-6">
              <h3 className="text-[1.25rem] text-vellum">Versions by class</h3>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                {Object.entries(r.racialVariants).map(([cls, list]) => (
                  <Panel key={cls} className="p-4">
                    <div className="text-[14px] capitalize text-gilt">{cls}</div>
                    {list.map((x) => (
                      <div key={x.id} className="mt-1.5">
                        <span className="font-medium text-vellum">{x.name}: </span>
                        <GameText text={x.desc} className="text-[15px] text-parch" />
                      </div>
                    ))}
                  </Panel>
                ))}
              </div>
            </div>
          )}
        </section>

        <section>
          <SectionTitle title="Classes">{r.newClasses.length && !r.isNew ? 'Highlighted classes are new to this race in Forever.' : 'Every class this race can play.'}</SectionTitle>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {classes.map((c) => {
              const fresh = r.newClasses.includes(c.slug) && !r.isNew;
              return (
                <Link key={c.slug} href={`/classes/${c.slug}`} className={`frame flex items-center gap-3 p-4 hover:border-gilt/50 ${fresh ? 'ring-1 ring-leaf/60' : ''}`}>
                  <WowIcon icon={c.icon} size={40} name={c.name} />
                  <div>
                    <div className="font-display text-[1.2rem]" style={{ color: c.color }}>
                      {c.name}
                    </div>
                    {fresh && <div className="text-[13px] text-leaf-bright">New combination</div>}
                  </div>
                </Link>
              );
            })}
          </div>
        </section>

        {skyborne && (
          <section className="grid gap-8 lg:grid-cols-2">
            <div>
              <h2 className="text-[1.9rem] text-vellum">The Skyborne</h2>
              <div className="prose-grim mt-4">
                <p>
                  Thousands of years ago a group of Highborne exiles forged a pact with the wind spirits and built a civilization in Skywall, one of the elemental
                  planes. When you arrive on Zephras Isle, that civilization is in crisis: the air spirits have vanished, ancient structures are failing and the
                  Skyborne are divided over what comes next.
                </p>
                <p>
                  You choose a faction at character creation. Horde-aligned <strong>Windshaper</strong> Skyborne keep the elemental traditions and can become
                  Shamans; Alliance-aligned <strong>High Order</strong> Skyborne pursue their ancestors’ arcane legacy and can become Mages. Both can be Warriors,
                  Hunters, Rogues and Druids, with druid forms made for the race.
                </p>
                <p>
                  Zephras Isle is the level 1 to 12 starting zone. Customization runs deep: ten faces per body type, nine skin colors from sky blue to darker tones,
                  feathers you can weave into the hair, and Zephyr or Wayfinder body tattoos.
                </p>
              </div>
              <Link href="/world/16593" className="mt-4 inline-block text-gilt hover:text-gilt-bright">
                Zephras Isle zone page
              </Link>
            </div>
            <Panel className="overflow-hidden p-0">
              <div className="grid grid-cols-2 gap-px bg-iron">
                {(['zephrasVillage', 'zephrasGrove', 'zephrasShore', 'zephrasDusk'] as const).map((k) => (
                  <ArtTile key={k} k={k} />
                ))}
              </div>
            </Panel>
          </section>
        )}
      </Container>
    </>
  );
}

function ArtTile({ k }: { k: ArtKey }) {
  const a = resolveArt(k);
  return (
    <div className="relative aspect-[16/10] overflow-hidden">
      <Image src={a.src} alt={a.alt} fill sizes="(min-width: 1024px) 330px, 50vw" quality={75} className="object-cover" style={{ objectPosition: a.focus ?? 'center', transform: a.zoom ? `scale(${a.zoom})` : undefined }} />
    </div>
  );
}
