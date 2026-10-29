import type { Metadata } from 'next';
import Link from 'next/link';
import { GameText } from '@/components/game-text';
import { WowIcon } from '@/components/icon';
import { Badge, Container } from '@/components/ui';
import { Backdrop } from '@/components/backdrop';
import { getAbilities, getClass, getClasses } from '@/lib/data';
import { slugify } from '@/lib/search';

export const metadata: Metadata = {
  title: 'Trainer abilities',
  description: 'Every class ability and rank in World of Warcraft: Forever by level, with new spells and level changes marked.',
  alternates: { canonical: '/abilities' },
};

const CHANGE = { introduced: ['new', 'New in Forever'], nowTrainable: ['gilt', 'Was a talent'], changedLevels: ['changed', 'Level changed'] } as const;

export default async function AbilitiesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const classes = getClasses();
  const cls = getClass(sp.class ?? '') ?? classes[0];
  const list = getAbilities(cls.slug);
  const groups = new Map<string, typeof list>();
  for (const a of list) groups.set(a.name, [...(groups.get(a.name) ?? []), a]);
  const names = [...groups.keys()].sort((a, b) => groups.get(a)![0].level - groups.get(b)![0].level || a.localeCompare(b));
  const filter = sp.show;
  return (
    <div className="relative isolate">
      <Backdrop art="dustwallow" />
      <Container className="pt-10">
        <h1 className="text-[2.4rem] text-vellum sm:text-[2.8rem]">Trainer abilities</h1>
        <p className="mt-1 max-w-2xl text-[17px] text-mist">Every spell and rank your class trainer teaches in Forever, with what changed since Classic.</p>
        <nav aria-label="Classes" className="scroll-thin mt-6 flex gap-1.5 overflow-x-auto pb-1">
          {classes.map((c) => (
            <Link
              key={c.slug}
              href={`/abilities?class=${c.slug}`}
              aria-current={c.slug === cls.slug ? 'page' : undefined}
              className={`flex shrink-0 items-center gap-2 rounded-full border px-2.5 py-1.5 text-[15px] ${c.slug === cls.slug ? 'border-gilt/60 bg-dusk' : 'border-iron bg-night/70 text-mist hover:text-vellum'}`}
            >
              <WowIcon icon={c.icon} size={22} name={c.name} />
              <span style={{ color: c.slug === cls.slug ? c.color : undefined }}>{c.name}</span>
            </Link>
          ))}
        </nav>
        <div className="mt-4 flex flex-wrap gap-2 text-[14.5px]">
          {[
            [undefined, 'All'],
            ['changes', 'Only changes'],
          ].map(([v, label]) => (
            <Link key={label} href={`/abilities?class=${cls.slug}${v ? `&show=${v}` : ''}`} className={`rounded-full border px-3 py-1 ${filter === v ? 'border-gilt/60 text-gilt-bright' : 'border-iron text-mist hover:text-vellum'}`}>
              {label}
            </Link>
          ))}
        </div>
        <div className="mt-6 grid gap-3 lg:grid-cols-2">
          {names
            .filter((n) => filter !== 'changes' || groups.get(n)!.some((a) => a.change))
            .map((n) => {
              const ranks = groups.get(n)!;
              const top = ranks[ranks.length - 1];
              const change = ranks.find((a) => a.change)?.change;
              return (
                <article key={n} id={slugify(n)} className="frame scroll-mt-6 p-4">
                  <div className="flex items-start gap-3">
                    <WowIcon icon={top.icon} size={40} name={n} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="font-display text-[1.2rem] leading-tight text-vellum">{n}</h2>
                        {change && <Badge tone={CHANGE[change][0]}>{CHANGE[change][1]}</Badge>}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-1">
                        <span className="mr-1 text-[12.5px] text-fog">{ranks.length > 1 ? 'Ranks at level' : 'Learned at level'}</span>
                        {ranks.map((a) => (
                          <span key={a.id} data-tip={`spell:${a.id}`} tabIndex={0} title={a.rank || undefined} className="num cursor-help rounded-lg border border-iron bg-abyss/60 px-1.5 text-[12.5px] text-parch hover:border-gilt/60">
                            {a.level}
                          </span>
                        ))}
                      </div>
                      <GameText text={top.desc} className="mt-2 block text-[15px] leading-snug text-mist" />
                    </div>
                  </div>
                </article>
              );
            })}
        </div>
      </Container>
    </div>
  );
}
