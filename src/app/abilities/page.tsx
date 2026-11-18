import type { Metadata } from 'next';
import Link from 'next/link';
import { GameText } from '@/components/game-text';
import { WowIcon } from '@/components/icon';
import { Badge, Container } from '@/components/ui';
import { Backdrop } from '@/components/backdrop';
import { getAbilities, getClass, getClasses } from '@/lib/data';
import { slugify } from '@/lib/search';

/** Where the price of training comes from: Blizzard's development notes for Forever, as updated on November 2, 2026. */
const TRAINING_NOTES = 'https://us.forums.blizzard.com/en/wow/t/2360696';

/** A class's list has its own name and address: /abilities?class=mage is "Mage trainer abilities". */
export async function generateMetadata({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }): Promise<Metadata> {
  const c = getClass((await searchParams).class ?? '');
  return {
    title: c ? `${c.name} trainer abilities` : 'Trainer abilities',
    description: c
      ? `Every ${c.name} ability and rank the trainer teaches in World of Warcraft: Forever, by level, with new spells and level changes marked.`
      : 'Every class ability and rank in World of Warcraft: Forever by level, with new spells and level changes marked.',
    alternates: { canonical: c ? `/abilities?class=${c.slug}` : '/abilities' },
  };
}

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
  // what the trainer has at each level, for the By level view: every rank
  const byLevel = new Map<number, typeof list>();
  for (const a of [...list].sort((x, y) => x.level - y.level || x.name.localeCompare(y.name))) byLevel.set(a.level, [...(byLevel.get(a.level) ?? []), a]);
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
            ['level', 'By level'],
          ].map(([v, label]) => (
            <Link key={label} href={`/abilities?class=${cls.slug}${v ? `&show=${v}` : ''}`} className={`rounded-full border px-3 py-1 ${filter === v ? 'border-gilt/60 text-gilt-bright' : 'border-iron text-mist hover:text-vellum'}`}>
              {label}
            </Link>
          ))}
        </div>
        {/* The price is Blizzard's own figure. The open data has Classic's price for each rank, which Forever no longer charges, so no rank is priced here. */}
        <p className="mt-5 max-w-3xl text-[15px] leading-relaxed text-mist">
          Training every {cls.name} ability from 1 to 60 costs <span className="text-vellum">between 206 and 207 gold</span>, the same for every class
          {cls.slug === 'warlock' ? ': a Warlock pays less than that at the trainer, by what the Grimoires for the demons are expected to cost' : ''}.{' '}
          <span className="text-fog">
            Most abilities learned at the same level cost the same{cls.slug === 'priest' ? ', but for the Priest’s race-specific abilities' : ''}. From{' '}
            <a href={TRAINING_NOTES} target="_blank" rel="noopener noreferrer" className="underline decoration-white/25 underline-offset-2 hover:text-parch">
              Blizzard’s development notes of November 2
            </a>
            , which give the total and not each rank’s price.
          </span>
        </p>
        {filter === 'level' ? (
          <div className="frame mt-6 divide-y divide-white/[0.06]">
            {[...byLevel].map(([level, spells]) => {
              return (
                <div key={level} className="grid grid-cols-[56px_1fr] gap-4 px-4 py-3 sm:grid-cols-[64px_1fr]">
                  <div className="num pt-0.5 text-[1.1rem] text-vellum">{level}</div>
                  <ul className="flex flex-wrap gap-x-4 gap-y-2">
                    {spells.map((a) => (
                      <li key={a.id} className="flex items-center gap-2" data-tip={`spell:${a.id}`}>
                        <WowIcon icon={a.icon} size={24} name={a.name} />
                        <span className="text-[14.5px] text-parch">
                          {a.name}
                          {a.rank && <span className="text-fog"> {a.rank.replace('Rank ', '')}</span>}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        ) : (
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
        )}
      </Container>
    </div>
  );
}
