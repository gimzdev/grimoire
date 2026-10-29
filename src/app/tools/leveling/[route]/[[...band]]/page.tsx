import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { CSSProperties, ReactNode } from 'react';
import { Backdrop } from '@/components/backdrop';
import { WowIcon } from '@/components/icon';
import { TocSpy } from '@/components/toc-spy';
import { Container } from '@/components/ui';
import { getClass, getRace } from '@/lib/data';
import {
  bandsOf,
  describe,
  getGuideData,
  getRoute,
  getRoutes,
  levelOf,
  onePerson,
  placeOf,
  routeHref,
  routesOfClass,
  routesOfRace,
  stopsOf,
  stopTitle,
  type GuideRoute,
  type GuideStep,
  type Numbered,
  type Part,
} from '@/lib/guide';
import { ADDON } from '@/lib/site';
import { CLASS_COLOR, CLASS_NAMES } from '@/lib/wow';

const ART: Record<string, string> = {
  human: 'raceHuman',
  dwarf: 'raceDwarf',
  gnome: 'raceGnome',
  'night-elf': 'raceNightElf',
  orc: 'raceOrc',
  troll: 'raceTroll',
  tauren: 'raceTauren',
  undead: 'raceUndead',
};

export const revalidate = false;
export const dynamicParams = true;

export function generateStaticParams() {
  // Each route's first page is built ahead of time; its later levels render on first request and are kept (46 routes
  // of six pages would add a quarter of a gigabyte to the build).
  return getRoutes().map((r) => ({ route: r.id, band: [] }));
}

function pick(route: string, band?: string[]) {
  const r = getRoute(route);
  if (!r || (band && band.length > 1)) return undefined;
  const all = bandsOf(r);
  const k = band?.length ? all.findIndex((b) => b.slug === band[0]) : 0;
  if (k < 0 || !all[k].visits.length) return undefined;
  return { r, all, part: all[k] };
}

export async function generateMetadata({ params }: { params: Promise<{ route: string; band?: string[] }> }): Promise<Metadata> {
  const { route, band } = await params;
  const p = pick(route, band);
  if (!p) return {};
  const { r, part } = p;
  const levels = `levels ${part.from} to ${part.to}`;
  return {
    title: `${r.name} leveling route, ${levels}`,
    description: `The ${r.name} leveling route in World of Warcraft: Forever, ${levels}, step by step: every quest in order with the map coordinates of who gives it, where to do it and who takes it back, the ${CLASS_NAMES[r.class]?.toLowerCase() ?? 'class'} quests, flights, boats and trainer visits.`,
    alternates: { canonical: routeHref(r.id, part.k) },
  };
}

function render(parts: Part[]): ReactNode[] {
  return parts.map((p, i) => {
    if (typeof p === 'string') return p;
    if ('tag' in p)
      return p.tag === 'class' ? (
        <span key={i} className="cb" style={{ '--cc': CLASS_COLOR[p.cls] } as CSSProperties} title={`A ${CLASS_NAMES[p.cls]?.toLowerCase()} quest`}>
          {CLASS_NAMES[p.cls]}
        </span>
      ) : (
        <span key={i} className="eb" title="Elite: the route takes it when you are three levels over it">
          Elite
        </span>
      );
    if ('quest' in p)
      return (
        <a key={i} href={`/quests/${p.quest}`} data-tip={`quest:${p.quest}`} className="q">
          {p.text}
        </a>
      );
    if ('npc' in p)
      return (
        <a key={i} href={`/npcs/${p.npc}`} data-tip={`npc:${p.npc}`}>
          {p.text}
        </a>
      );
    if ('item' in p)
      return (
        <a key={i} href={`/items/${p.item}`} data-tip={`item:${p.item}`}>
          {p.text}
        </a>
      );
    if ('spell' in p)
      return (
        <span key={i} data-tip={`spell:${p.spell}`} tabIndex={0} className="sp">
          {p.text}
        </span>
      );
    return (
      <a key={i} href={`/world/${p.zone}`}>
        {p.text}
      </a>
    );
  });
}

/** A step in words: its verb in the kind's colour, the rest, and the objectives of a "do" step. */
function Said({ step, bare }: { step: GuideStep; bare?: boolean }) {
  const { verb, parts, lines } = describe(step, { bare });
  return (
    <>
      {verb && <b className={`v v${step[0]}`}>{verb}</b>}
      {render(parts)}
      {lines?.map((l, k) => (
        <span key={k} className="o">
          {render(l)}
        </span>
      ))}
    </>
  );
}

/** Where on the map: the coordinates, and the zone too when the place is not in the zone the section is about. */
function Coords({ step, zone }: { step: GuideStep; zone: number }) {
  const [area, x, y] = placeOf(step);
  // Travel steps already name where they take you.
  const elsewhere = area !== zone && step[0] !== 'Z' && step[0] !== 'H' && step[0] !== 'S' ? getGuideData().zones[area]?.n : undefined;
  return (
    <span className="c">
      {elsewhere && <span className="cz">{elsewhere}</span>}
      {x.toFixed(1)}, {y.toFixed(1)}
    </span>
  );
}

/** One stop: a step of its own, or the steps done with one person or at one camp, as a checklist under who or where. */
function Stop({ stop, zone }: { stop: Numbered[]; zone: number }) {
  const first = stop[0].step;
  if (stop.length === 1)
    return (
      <li className="rs">
        <span className="l">{levelOf(first)}</span>
        <span>
          <Said step={first} />
        </span>
        <Coords step={first} zone={zone} />
      </li>
    );
  const steps = stop.map((s) => s.step);
  const bare = onePerson(steps);
  return (
    <li className="rs">
      <span className="l">{levelOf(first)}</span>
      <span className="h">{render(stopTitle(steps))}</span>
      <Coords step={first} zone={zone} />
      <ul className="ck">
        {stop.map(({ n, step }) => (
          <li key={n}>
            <Said step={step} bare={bare} />
          </li>
        ))}
      </ul>
    </li>
  );
}

const pill = 'inline-flex h-9 items-center rounded-full px-4 text-[14px] font-[560] ring-1 ring-inset transition-colors';
const chip = 'inline-flex h-8 items-center rounded-full px-3 text-[13.5px] font-[560] ring-1 ring-inset transition-colors';

/** A row of the switcher: the routes that share this route's race (or class), the current one marked. */
function Switch({ label, items }: { label: string; items: { id: string; href: string; text: string; color?: string; current: boolean }[] }) {
  if (items.length < 2) return null;
  return (
    <div className="flex items-baseline gap-3">
      <div className="w-[5.5rem] shrink-0 text-[13px] text-fog sm:w-24">{label}</div>
      <ul className="flex min-w-0 flex-wrap gap-1.5">
        {items.map((it) => (
          <li key={it.id}>
            <Link
              href={it.href}
              prefetch={false}
              aria-current={it.current ? 'page' : undefined}
              className={`${chip} ${it.current ? 'bg-white/[0.1] ring-white/25' : 'bg-white/[0.03] ring-white/[0.07] hover:bg-white/[0.08]'} ${it.color ? '' : it.current ? 'text-vellum' : 'text-parch hover:text-vellum'}`}
              style={it.color ? { color: it.color } : undefined}
            >
              {it.text}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default async function RoutePage({ params }: { params: Promise<{ route: string; band?: string[] }> }) {
  const { route, band } = await params;
  const p = pick(route, band);
  if (!p) notFound();
  const { r, all, part } = p;
  const d = getGuideData();
  const race = getRace(r.race);
  const cls = getClass(r.class);
  const raceName = race?.name ?? r.race;
  const className = CLASS_NAMES[r.class] ?? r.class;
  const color = CLASS_COLOR[r.class];
  const classQuests = new Set(r.steps.filter((s) => s[0] === 'T' && d.quests[s[1]]?.c).map((s) => s[1])).size;
  // Another route at the same levels where it has them, else from its start.
  const sameBand = (o: GuideRoute) => routeHref(o.id, bandsOf(o)[part.k]?.visits.length ? part.k : 0);
  const next = all.slice(part.k + 1).find((b) => b.visits.length);
  return (
    <div className="relative isolate">
      <Backdrop art={ART[r.race] ?? 'barrens'} strength={0.4} />
      <Container className="pb-16 pt-10">
        <nav aria-label="Breadcrumb" className="text-[14px] text-mist">
          <Link href="/tools" className="hover:text-vellum">
            Tools
          </Link>
          <span className="px-2 text-fog">/</span>
          <Link href="/tools/leveling" className="hover:text-vellum">
            Leveling route
          </Link>
        </nav>

        <header className="mt-5 flex items-center gap-4 sm:gap-5">
          {cls && <WowIcon icon={cls.icon} size={56} name={className} eager className="hidden sm:inline-grid" />}
          <div className="min-w-0">
            <h1 className="text-[2.2rem] leading-[1.05] text-vellum sm:text-[2.9rem]">
              {raceName} <span style={{ color }}>{className}</span>
            </h1>
            <p className="num mt-2.5 text-[15.5px] leading-snug text-mist">
              From {r.start} to 60 in about <span className="whitespace-nowrap text-parch">{Math.round(r.hours)} hours</span>:{' '}
              <span className="whitespace-nowrap text-parch">{r.quests} quests</span>
              {classQuests > 0 && `, ${classQuests} of them for ${className.toLowerCase()}s`}.
              {classQuests === 0 && race?.newClasses.includes(r.class) && ` ${raceName} ${className.toLowerCase()}s are new in Forever, and no open source has their class quests yet.`}
            </p>
          </div>
        </header>

        <p className="mt-5 max-w-3xl text-[16.5px] leading-relaxed text-parch">
          Every step in order, with map coordinates: who gives each quest, where to do it and who takes it back, and the flight paths, boats, Hearthstone and trainer
          visits on the way. <a href={ADDON.url} target="_blank" rel="noopener noreferrer" className="text-gilt-bright underline decoration-gilt/40 underline-offset-2 transition-colors hover:text-gilt hover:decoration-gilt">Grimoire’s add-on</a> follows this route in game, with an arrow to every place.
        </p>

        <nav className="mt-6 space-y-2" aria-label="Other routes">
          <Switch label={raceName} items={routesOfRace(r.race).map((o) => ({ id: o.id, href: sameBand(o), text: CLASS_NAMES[o.class] ?? o.class, color: CLASS_COLOR[o.class], current: o.id === r.id }))} />
          <Switch label={`${className}s`} items={routesOfClass(r.class).map((o) => ({ id: o.id, href: sameBand(o), text: getRace(o.race)?.name ?? o.race, current: o.id === r.id }))} />
        </nav>

        <details className="group mt-6 max-w-3xl">
          <summary className="inline-flex cursor-pointer list-none items-center gap-2 text-[14.5px] text-mist marker:hidden hover:text-vellum [&::-webkit-details-marker]:hidden">
            <svg viewBox="0 0 12 12" className="size-3 transition-transform group-open:rotate-90" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="m4.5 2.5 3.5 3.5-3.5 3.5" />
            </svg>
            How the route is worked out
          </summary>
          <p className="mt-2 text-[14.5px] leading-relaxed text-mist">
            Grimoire works it out from open data (VMaNGOS and LibQuestDB): a simulated {r.name.toLowerCase()} takes the nearest useful thing, earns each quest’s and each kill’s Classic
            experience, flies where it has the flight path and keeps a 20-quest log, {r.steps.length.toLocaleString('en-US')} steps in all, {r.walk} km on foot and {r.fly} km by
            air. Elite quests wait until you are three levels over them. Forever has changed some quests, so a step can be off: skip it and go on. Forever’s own new quests are not in the
            routes yet: no open source has where their givers stand.
          </p>
        </details>

        <nav aria-label="Levels" className="mt-8 flex flex-wrap gap-2">
          {all.map((b) =>
            b.visits.length ? (
              <Link
                key={b.slug}
                href={routeHref(r.id, b.k)}
                prefetch={false}
                aria-current={b.k === part.k ? 'page' : undefined}
                className={`${pill} ${b.k === part.k ? 'bg-gilt/[0.15] text-gilt-bright ring-gilt/50' : 'bg-white/[0.04] text-parch ring-white/[0.08] hover:bg-white/[0.08] hover:text-vellum'}`}
              >
                {b.from} to {b.to}
              </Link>
            ) : null,
          )}
        </nav>

        <div className="mt-8 grid gap-10 lg:grid-cols-[250px_minmax(0,1fr)]">
          <aside className="hidden lg:block">
            <nav aria-label="On this page" className="sticky top-[92px] max-h-[calc(100vh-120px)] overflow-y-auto pr-2">
              <div className="font-display text-[1.05rem] text-gilt">
                Levels {part.from} to {part.to}
              </div>
              <ol className="mt-3 space-y-1.5 border-l border-iron pl-4 text-[14px]">
                {part.visits.map((v) => (
                  <li key={v.id}>
                    <a
                      href={`#${v.id}`}
                      className="relative flex justify-between gap-3 text-mist before:absolute before:top-0 before:-left-[17px] before:h-full before:w-[2px] before:bg-gilt before:opacity-0 hover:text-vellum aria-[current=location]:text-vellum aria-[current=location]:before:opacity-100"
                    >
                      <span className="truncate">{v.name}</span>
                      <span className="num shrink-0 text-fog">{v.from === v.to ? v.from : `${v.from}–${v.to}`}</span>
                    </a>
                  </li>
                ))}
              </ol>
              <TocSpy ids={part.visits.map((v) => v.id)} />
            </nav>
          </aside>
          <div className="min-w-0 space-y-6">
            {part.visits.map((v) => (
              <section key={v.id} id={v.id} className="frame scroll-mt-28 px-4 py-4 sm:px-6">
                <header className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-b border-iron pb-3">
                  <h2 className="text-[1.5rem] leading-tight text-vellum">
                    <Link href={`/world/${v.zone}`} className="hover:text-gilt-bright">
                      {v.name}
                    </Link>
                  </h2>
                  <div className="text-[14px] text-mist">
                    {v.from === v.to ? `level ${v.from}` : `levels ${v.from} to ${v.to}`}
                    {v.quests > 0 && `, ${v.quests} ${v.quests === 1 ? 'quest' : 'quests'}`}
                  </div>
                </header>
                <ol className="mt-1">
                  {stopsOf(v.steps).map((stop) => (
                    <Stop key={stop[0].n} stop={stop} zone={v.zone} />
                  ))}
                </ol>
              </section>
            ))}
            {next && (
              <Link href={routeHref(r.id, next.k)} className="frame block p-5 hover:border-gilt/50">
                <div className="text-[13px] text-gilt">Next</div>
                <div className="font-display text-[1.3rem] text-vellum">
                  Levels {next.from} to {next.to}
                </div>
              </Link>
            )}
          </div>
        </div>
      </Container>
    </div>
  );
}
