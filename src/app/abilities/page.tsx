import type { Metadata } from 'next';
import Link from 'next/link';
import { GameText } from '@/components/game-text';
import { WowIcon } from '@/components/icon';
import { Badge, Container } from '@/components/ui';
import { Backdrop } from '@/components/backdrop';
import { Money } from '@/components/tooltips';
import { getAbilities, getClass, getClasses } from '@/lib/data';
import { slugify } from '@/lib/search';
import { formatMoney } from '@/lib/wow';

const moneyText = (copper: number) => {
  const { g, s, c } = formatMoney(copper);
  return [g && `${g}g`, s && `${s}s`, c && `${c}c`].filter(Boolean).join(' ') || '0c';
};

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
  const priced = list.filter((a) => a.cost && a.level <= 60);
  const total = priced.reduce((n, a) => n + (a.cost ?? 0), 0);
  // what the trainer has at each level, for the By level view: every rank, priced
  const byLevel = new Map<number, typeof list>();
  for (const a of [...list].sort((x, y) => x.level - y.level || x.name.localeCompare(y.name))) byLevel.set(a.level, [...(byLevel.get(a.level) ?? []), a]);
  let running = 0;
  return (
    <div className="relative isolate">
      <Backdrop art="dustwallow" />
      <Container className="pt-10">
        <h1 className="text-[2.4rem] text-vellum sm:text-[2.8rem]">Trainer abilities</h1>
        <p className="mt-1 max-w-2xl text-[17px] text-mist">Every spell and rank your class trainer teaches in Forever, with what changed since Classic and what it costs.</p>
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
            ['level', 'By level, with prices'],
          ].map(([v, label]) => (
            <Link key={label} href={`/abilities?class=${cls.slug}${v ? `&show=${v}` : ''}`} className={`rounded-full border px-3 py-1 ${filter === v ? 'border-gilt/60 text-gilt-bright' : 'border-iron text-mist hover:text-vellum'}`}>
              {label}
            </Link>
          ))}
        </div>
        {total > 0 && (
          <p className="mt-5 text-[15px] leading-relaxed text-mist">
            Every rank from the trainer up to 60: <Money copper={total} className="text-[15.5px] text-vellum" />{' '}
            <span className="text-fog">at Classic’s prices, {priced.length} ranks. Talents, quests and Forever’s new spells cost nothing here, and Forever may have changed some prices.</span>
          </p>
        )}
        {filter === 'level' ? (
          <div className="frame mt-6 divide-y divide-white/[0.06]">
            {[...byLevel].map(([level, spells]) => {
              const cost = spells.reduce((n, a) => n + (a.cost ?? 0), 0);
              running += cost;
              return (
                <div key={level} className="grid grid-cols-[56px_1fr] gap-4 px-4 py-3 sm:grid-cols-[64px_1fr_auto]">
                  <div className="num pt-0.5 text-[1.1rem] text-vellum">{level}</div>
                  <ul className="flex flex-wrap gap-x-4 gap-y-2">
                    {spells.map((a) => (
                      <li key={a.id} className="flex items-center gap-2" data-tip={`spell:${a.id}`}>
                        <WowIcon icon={a.icon} size={24} name={a.name} />
                        <span className="text-[14.5px] text-parch">
                          {a.name}
                          {a.rank && <span className="text-fog"> {a.rank.replace('Rank ', '')}</span>}
                        </span>
                        {a.cost ? <Money copper={a.cost} className="text-[13px] text-mist" /> : null}
                      </li>
                    ))}
                  </ul>
                  <div className="col-span-2 text-[13px] text-fog sm:col-span-1 sm:text-right">
                    {cost > 0 && <Money copper={cost} className="text-[14px] text-parch" />}
                    {running > 0 && <div className="mt-0.5">{moneyText(running)} so far</div>}
                  </div>
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
                          <span key={a.id} data-tip={`spell:${a.id}`} tabIndex={0} title={[a.rank, a.cost ? moneyText(a.cost) : ''].filter(Boolean).join(' · ') || undefined} className="num cursor-help rounded-lg border border-iron bg-abyss/60 px-1.5 text-[12.5px] text-parch hover:border-gilt/60">
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
