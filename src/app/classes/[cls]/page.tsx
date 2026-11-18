import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { plainGameText } from '@/components/game-text';
import { ClassChanges } from '@/components/class-changes';
import { ClassTrail } from '@/components/class-trail';
import { WowIcon } from '@/components/icon';
import { SpellLink } from '@/components/links';
import { Badge, ButtonLink, Container, Panel, SectionTitle } from '@/components/ui';
import { Vista } from '@/components/vista';
import { CLASS_ART } from '@/lib/art';
import { CLASS_COPY, SPEC_COPY } from '@/lib/copy';
import { getAbilities, getBarsFor, getBuildsFor, getClass, getClasses, getGuide, getRaces, getTalents } from '@/lib/data';
import { buildGroup, groupBuilds, roleTag, type BuildGroupKey } from '@/lib/build-groups';
import { buildHref } from '@/lib/build-pages';
import { slugify } from '@/lib/search';
import { CODE_VERSION } from '@/lib/talents';
import { ROLE_LABEL } from '@/lib/wow';
import type { BarSlot, Build } from '@/lib/types';

export function generateStaticParams() {
  return getClasses().map((c) => ({ cls: c.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ cls: string }> }): Promise<Metadata> {
  const { cls } = await params;
  const c = getClass(cls);
  if (!c) return {};
  return {
    title: `${c.name}: specs, races and changes`,
    description: `${c.name} in World of Warcraft: Forever: ${c.specs.map((s) => s.name).join(', ')}, playable races, ${c.talentStats.new} new talents and every trainer change.`,
    alternates: { canonical: `/classes/${c.slug}` },
  };
}

const CHANGE_LABEL = { introduced: 'New spell', nowTrainable: 'Was a talent', changedLevels: 'New level' } as const;

export default async function ClassPage({ params }: { params: Promise<{ cls: string }> }) {
  const { cls } = await params;
  const c = getClass(cls);
  const talents = getTalents(cls);
  if (!c || !talents) notFound();
  const abilities = getAbilities(cls);
  const builds = getBuildsFor(cls);
  const bars = getBarsFor(cls);
  const races = getRaces().filter((r) => r.classes.includes(cls));
  const guide = getGuide(cls);
  const copy = CLASS_COPY[cls];

  const byLevel = new Map<number, typeof abilities>();
  for (const a of abilities) byLevel.set(a.level, [...(byLevel.get(a.level) ?? []), a]);
  const levels = [...byLevel.keys()].sort((a, b) => a - b);

  const firstOf = (change: string) => {
    const seen = new Set<string>();
    return abilities.filter((a) => a.change === change && !seen.has(a.name) && seen.add(a.name));
  };
  // Ranks of talent spells (Mutilate, Riptide and so on) show up as new trainer entries; only count real trainer spells.
  const talentNames = new Set(talents.trees.flatMap((t) => t.talents.map((x) => x.name)));
  const introduced = firstOf('introduced').filter((a) => !talentNames.has(a.name));
  const nowTrainable = firstOf('nowTrainable');
  const moved = firstOf('changedLevels');

  return (
    <>
      <Vista
        art={CLASS_ART[cls] ?? 'expanses'}
        tint={c.color}
        kicker={c.specs.map((s) => ROLE_LABEL[s.role]).filter((v, i, a) => a.indexOf(v) === i).join(', ')}
        title={<span style={{ color: c.color }}>{c.name}</span>}
        aside={
          <Panel className="w-full p-5 lg:w-[340px]" gilt>
            <dl className="space-y-3 text-[15px]">
              <div>
                <dt className="text-fog">Resource</dt>
                <dd className="text-vellum">{c.resource}</dd>
              </div>
              <div>
                <dt className="text-fog">Armor</dt>
                <dd className="text-vellum">
                  {c.armor.join(', ')}
                  {c.plateAt ? ` (plate at ${c.plateAt})` : c.mailAt ? ` (mail at ${c.mailAt})` : ''}
                </dd>
              </div>
              <div>
                <dt className="text-fog">Weapons</dt>
                <dd className="text-parch">{c.weapons.join(', ')}</dd>
              </div>
            </dl>
            <div className="mt-5 flex gap-2">
              <ButtonLink href={`/talents/${cls}`} className="flex-1">
                Talents
              </ButtonLink>
              {guide && (
                <ButtonLink href={`/guides/${guide.slug}`} variant="ghost" className="flex-1">
                  Guide
                </ButtonLink>
              )}
            </div>
          </Panel>
        }
      >
        {copy?.blurb}
      </Vista>

      <Container className="space-y-20">
        {copy?.forever && (
          <section className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
            <div>
              <h2 className="text-[1.9rem] text-vellum">What Forever changes</h2>
              <p className="mt-3 text-[17.5px] leading-relaxed text-parch">{copy.forever}</p>
              <dl className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  [c.talentStats.new, 'new talents', 'text-leaf-bright'],
                  [c.talentStats.changed, 'reworked', 'text-gilt-bright'],
                  [c.talentStats.removed, 'removed', 'text-[#ff8f86]'],
                  [introduced.length, 'new trainer spells', 'text-vellum'],
                ].map(([n, label, color]) => (
                  <div key={label as string} className="frame px-3 py-3">
                    <dd className={`num text-[1.9rem] font-bold leading-none ${color}`}>{n}</dd>
                    <dt className="mt-1 text-[13.5px] text-mist">{label}</dt>
                  </div>
                ))}
              </dl>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              {talents.trees.map((tree) => (
                <Panel key={tree.id} className="p-4">
                  <div className="flex items-center gap-2">
                    <WowIcon icon={tree.icon} size={26} name={tree.name} />
                    <span className="font-display text-[1.1rem] text-vellum">{tree.name}</span>
                  </div>
                  <div className="mt-3 text-[13px] text-fog">New talents</div>
                  <ul className="mt-1.5 space-y-1.5">
                    {tree.talents
                      .filter((t) => t.status === 'new')
                      .map((t) => (
                        <li key={t.id}>
                          <SpellLink id={t.spells[t.max - 1]} name={t.name} icon={t.icon} href={`/talents/${cls}?focus=${t.id}`} size={22} className="text-[15px] !text-leaf-bright" />
                        </li>
                      ))}
                  </ul>
                </Panel>
              ))}
            </div>
          </section>
        )}

        <section>
          <SectionTitle title="Specializations">Each tree with its role, its capstone and a build to start from.</SectionTitle>
          <div className="grid gap-5 lg:grid-cols-3">
            {c.specs.map((s) => {
              const tree = talents.trees.find((t) => t.id === s.id)!;
              const cap = tree.talents.filter((t) => t.row === 6)[0];
              // the spec's build in each group: the one listed first when it is this spec's
              const specBuilds = (['leveling', 'pve', 'pvp'] as BuildGroupKey[])
                .map((g) => {
                  const list = builds.filter((b) => b.spec === s.slug && buildGroup(b.kind) === g);
                  return { g, b: list.find((b) => b.pick) ?? list[0] };
                })
                .filter((x): x is { g: BuildGroupKey; b: Build } => Boolean(x.b));
              return (
                <Panel key={s.slug} className="flex flex-col p-5">
                  <div className="flex items-center gap-3">
                    <WowIcon icon={s.icon} size={44} name={s.name} />
                    <div>
                      <h3 className="text-[1.45rem] leading-tight text-vellum">{s.name}</h3>
                      <div className="text-[14px] text-mist">{ROLE_LABEL[s.role]}</div>
                    </div>
                  </div>
                  <p className="mt-4 text-[16px] leading-relaxed text-parch">{SPEC_COPY[`${cls}/${s.slug}`]}</p>
                  {cap && (
                    <div className="mt-4 rounded-xl border border-iron bg-abyss/50 p-3">
                      <div className="text-[13px] text-fog">Capstone</div>
                      <SpellLink id={cap.spells[0]} name={cap.name} icon={cap.icon} href={`/talents/${cls}?focus=${cap.id}`} size={26} className="mt-1 text-[16px]" />
                      <p className="mt-1.5 line-clamp-3 text-[14.5px] leading-snug text-mist">{plainGameText(cap.desc[0])}</p>
                    </div>
                  )}
                  <div className="mt-auto flex flex-wrap gap-2 pt-5">
                    {specBuilds.map(({ g, b }) => (
                      <ButtonLink key={g} href={`/talents/${cls}?b=${b.code}&o=${b.order}&v=${CODE_VERSION}`} className="h-10 px-4 text-[15px]" title={`${b.name}, ${b.points.join('/')}`}>
                        {GROUP_BUTTON[g]}
                      </ButtonLink>
                    ))}
                    {specBuilds.length === 0 && (
                      <ButtonLink href={`/talents/${cls}`} className="h-10 px-4 text-[15px]">
                        Open calculator
                      </ButtonLink>
                    )}
                  </div>
                </Panel>
              );
            })}
          </div>
        </section>

        {(introduced.length > 0 || nowTrainable.length > 0 || moved.length > 0) && (
          <section>
            <SectionTitle title="Trainer changes">Spells the trainer teaches differently in Forever, compared with Classic.</SectionTitle>
            <div className="grid gap-5 lg:grid-cols-3">
              {[
                ['New spells', introduced, 'new'],
                ['Former talents, now trained', nowTrainable, 'gilt'],
                ['Learned at a different level', moved, 'changed'],
              ].map(([title, list, tone]) =>
                (list as typeof abilities).length ? (
                  <Panel key={title as string} className="p-5">
                    <h3 className="text-[1.2rem] text-vellum">{title as string}</h3>
                    <ul className="mt-3 space-y-2">
                      {(list as typeof abilities).map((a) => (
                        <li key={a.id} className="flex items-center justify-between gap-3">
                          <SpellLink id={a.id} name={a.name} icon={a.icon} size={24} className="text-[15.5px]" />
                          <Badge tone={tone as 'new' | 'gilt' | 'changed'}>Level {a.level}</Badge>
                        </li>
                      ))}
                    </ul>
                  </Panel>
                ) : null,
              )}
            </div>
          </section>
        )}

        <section>
          <SectionTitle title="Races" href="/races" linkLabel="All races">
            Who can be a {c.name}. {c.newRaces.length ? 'Marked races are new to the class in Forever.' : ''}
          </SectionTitle>
          <div className="grid gap-4 md:grid-cols-2">
            {races.map((r) => {
              const fresh = c.newRaces.includes(r.slug);
              const variant = new Map((r.racialVariants?.[cls] ?? []).map((v) => [v.name, v]));
              const racials = r.racials.map((x) => variant.get(x.name) ?? x);
              return (
                <Panel key={r.slug} className={`p-4 ${fresh ? 'ring-1 ring-leaf/50' : ''}`}>
                  <div className="flex items-center gap-3">
                    <WowIcon icon={r.icon} size={38} name={r.name} />
                    <div className="min-w-0 flex-1">
                      <Link href={`/races/${r.slug}`} className="font-display text-[1.2rem] text-vellum hover:text-gilt-bright">
                        {r.name}
                      </Link>
                      <div className="text-[13.5px]" style={{ color: r.faction === 'alliance' ? '#a9c8f5' : '#f5a196' }}>
                        {r.faction === 'alliance' ? 'Alliance' : 'Horde'}
                      </div>
                    </div>
                    {fresh && <Badge tone="new">New combination</Badge>}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
                    {racials.map((x) => (
                      <SpellLink key={x.id} id={x.id} name={x.name} icon={x.icon} size={20} className="text-[14.5px] !text-parch" />
                    ))}
                  </div>
                </Panel>
              );
            })}
          </div>
        </section>

        {builds.length > 0 && (
          <section>
            <SectionTitle title="Grimoire builds" href={`/talents/${cls}`} linkLabel="Open the calculator">
              Builds for leveling, for PvE at 60 and for PvP, all on the Forever trees and worked out from their tooltips. Each build loads straight into the calculator. Each one is checked against the trees as they stand after Blizzard’s latest hotfixes.
            </SectionTitle>
            <div className="space-y-8">
              {groupBuilds(builds).map((g) => (
                <div key={g.key}>
                  <h3 className="mb-3 text-[1.2rem] text-vellum">{g.label}</h3>
                  <div className="grid gap-4 lg:grid-cols-2">
                    <BuildPanel b={g.top} cls={cls} bar={bars[g.top.id]} />
                  </div>
                  {g.rest.length > 0 && (
                    <details className="group mt-4">
                      <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 rounded-full border border-iron px-4 py-1.5 text-[15px] font-medium text-gilt hover:border-gilt/50 hover:text-gilt-bright [&::-webkit-details-marker]:hidden">
                        <span className="group-open:hidden">{`${g.rest.length} more ${g.label === 'Leveling' ? 'leveling' : g.label} ${g.rest.length === 1 ? 'build' : 'builds'}`}</span>
                        <span className="hidden group-open:inline">Show less</span>
                        <svg viewBox="0 0 12 12" aria-hidden className="size-3 transition-transform group-open:rotate-180">
                          <path d="M2.5 4.5 6 8l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </summary>
                      <div className="mt-4 grid gap-4 lg:grid-cols-2">
                        {g.rest.map((b) => (
                          <BuildPanel key={b.id} b={b} cls={cls} bar={bars[b.id]} />
                        ))}
                      </div>
                    </details>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        <section id="abilities" className="scroll-mt-6">
          <SectionTitle title="Abilities by level" href={`/abilities?class=${cls}`} linkLabel="Full ability list">
            Every rank the trainer teaches, with what changed in Forever marked.
          </SectionTitle>
          <div className="frame divide-y divide-iron/70">
            {levels.map((lv) => (
              <div key={lv} className="grid grid-cols-[64px_minmax(0,1fr)] gap-3 px-4 py-2.5 sm:grid-cols-[80px_minmax(0,1fr)]">
                <div className="num pt-1 font-bold text-gilt">Level {lv}</div>
                <ul className="flex flex-wrap gap-x-5 gap-y-1.5">
                  {byLevel.get(lv)!.map((a) => (
                    <li key={a.id} id={slugify(a.name)} className="flex items-center gap-2">
                      <SpellLink id={a.id} name={a.name} icon={a.icon} size={22} className="text-[15px] !text-vellum" />
                      {a.rank && <span className="text-[13px] text-fog">{a.rank}</span>}
                      {a.change && <Badge tone={a.change === 'introduced' ? 'new' : 'changed'}>{CHANGE_LABEL[a.change]}</Badge>}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        <ClassChanges cls={cls} className="max-w-4xl" />

        <ClassTrail cls={cls} here="class" />

        {guide && (
          <section className="frame gilt flex flex-wrap items-center justify-between gap-4 p-6">
            <div>
              <div className="font-display text-[1.5rem] text-vellum">{guide.title}</div>
              <p className="mt-1 text-mist">{guide.description}</p>
            </div>
            <ButtonLink href={`/guides/${guide.slug}`}>Read the guide</ButtonLink>
          </section>
        )}
      </Container>
    </>
  );
}

const GROUP_BUTTON: Record<BuildGroupKey, string> = { leveling: 'Leveling', pve: 'PvE', pvp: 'PvP' };

function BuildPanel({ b, cls, bar }: { b: Build; cls: string; bar?: BarSlot[] }) {
  const role = roleTag(b);
  return (
    <Panel className="p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h4 className="text-[1.35rem] leading-tight text-vellum">
          {b.name}
          {role && <span className="ml-2 align-middle text-[12.5px] font-semibold text-mist">{role}</span>}
        </h4>
        <span className="num rounded-full border border-gilt/40 px-2 py-0.5 text-[15px] font-bold text-gilt-bright">{b.points.join(' / ')}</span>
      </div>
      <p className="mt-2 text-[16px] leading-relaxed text-parch">{b.summary}</p>
      {b.notes && b.notes.length > 0 && (
        <ul className="mt-3 space-y-1.5 text-[15px] text-mist">
          {b.notes.map((n, i) => (
            <li key={i} className="flex gap-2">
              <span className="mt-[9px] size-1.5 shrink-0 rotate-45 bg-gilt-deep" />
              {n}
            </li>
          ))}
        </ul>
      )}
      {bar && <BarStrip slots={bar} />}
      <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-[15px] font-medium">
        <Link href={buildHref(b)} className="text-gilt hover:text-gilt-bright">
          The full build
        </Link>
        <Link href={`/talents/${cls}?b=${b.code}&o=${b.order}&v=${CODE_VERSION}`} className="text-gilt hover:text-gilt-bright">
          Load in the calculator
        </Link>
      </div>
    </Panel>
  );
}

const BAR_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-', '='];

/** The build's suggested bar 1, small: the add-on sets it up in game. */
function BarStrip({ slots }: { slots: BarSlot[] }) {
  return (
    <div className="mt-4">
      <div className="text-[13px] text-fog">Action bar</div>
      <div className="mt-1.5 flex flex-wrap gap-1">
        {slots.map((s, i) => (
          <span key={i} className="relative" title={s ? `${BAR_KEYS[i]}: ${s.n}${s.lv && s.lv > 1 ? `, from level ${s.lv}` : ''}` : `${BAR_KEYS[i]}: free`}>
            {s ? <WowIcon icon={s.ic} size={30} name={s.n} /> : <span className="block size-[30px] rounded-[8px] bg-white/[0.03] ring-1 ring-inset ring-white/[0.06]" />}
            <span className="num pointer-events-none absolute left-[3px] top-0 text-[10px] font-semibold text-vellum [text-shadow:0_1px_2px_rgb(0_0_0/0.9)]">{BAR_KEYS[i]}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
