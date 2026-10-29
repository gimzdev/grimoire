import type { Metadata } from 'next';
import Link from 'next/link';
import { WowIcon } from '@/components/icon';
import { SpellLink } from '@/components/links';
import { Badge, Container, Panel } from '@/components/ui';
import { Vista } from '@/components/vista';
import { RACE_COPY } from '@/lib/copy';
import { getClasses, getRaces } from '@/lib/data';
import type { RaceInfo } from '@/lib/types';

export const metadata: Metadata = {
  title: 'Races and racials',
  description: 'Playable races in World of Warcraft: Forever, including the new Skyborne, with every racial ability and the new race and class combinations.',
  alternates: { canonical: '/races' },
};

export default function RacesPage() {
  const races = getRaces();
  const classes = new Map(getClasses().map((c) => [c.slug, c]));
  const col = (faction: 'alliance' | 'horde') => (
    <div className="space-y-4">
      <h2 className="text-[1.9rem]" style={{ color: faction === 'alliance' ? '#a9c8f5' : '#f5a196' }}>
        {faction === 'alliance' ? 'Alliance' : 'Horde'}
      </h2>
      {races
        .filter((r) => r.faction === faction)
        .map((r: RaceInfo) => (
          <Panel key={r.slug} className={`p-5 ${r.isNew ? 'gilt' : ''}`}>
            <div className="flex items-start gap-3.5">
              <WowIcon icon={r.icon} size={46} name={r.name} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Link href={`/races/${r.slug}`} className="font-display text-[1.4rem] leading-tight text-vellum hover:text-gilt-bright">
                    {r.name}
                  </Link>
                  {r.isNew && <Badge tone="new">New race</Badge>}
                </div>
                <div className="text-[14px] text-mist">Starts in {r.start}</div>
              </div>
            </div>
            <p className="mt-3 text-[15.5px] leading-relaxed text-parch">{RACE_COPY[r.slug]}</p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {r.classes.map((c) => {
                const info = classes.get(c);
                const fresh = r.newClasses.includes(c) && !r.isNew;
                return info ? (
                  <Link key={c} href={`/classes/${c}`} title={`${info.name}${fresh ? ' (new combination)' : ''}`} className={`rounded-xl ${fresh ? 'ring-1 ring-leaf ring-offset-1 ring-offset-night' : ''}`}>
                    <WowIcon icon={info.icon} size={28} name={info.name} />
                  </Link>
                ) : null;
              })}
            </div>
            <div className="mt-4 grid gap-x-4 gap-y-1.5 sm:grid-cols-2">
              {r.racials.map((x) => (
                <SpellLink key={x.id} id={x.id} name={x.name} icon={x.icon} size={20} className="text-[14.5px] !text-parch" />
              ))}
            </div>
          </Panel>
        ))}
    </div>
  );
  return (
    <>
      <Vista art="zephrasMeadow" title="Races and racials" kicker="Ten playable races, two of them Skyborne">
        Racials were reworked across the board for Forever, and six races gained a class they could never play before.
      </Vista>
      <Container className="grid gap-10 lg:grid-cols-2">
        {col('alliance')}
        {col('horde')}
      </Container>
    </>
  );
}
