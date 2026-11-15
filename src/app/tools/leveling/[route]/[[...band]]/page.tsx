import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { CSSProperties, ReactNode } from 'react';
import { Backdrop } from '@/components/backdrop';
import { WowIcon } from '@/components/icon';
import { RouteTools } from '@/components/route-tools';
import { SupportNote } from '@/components/support';
import { TocSpy } from '@/components/toc-spy';
import { Container } from '@/components/ui';
import { buildHref } from '@/lib/build-pages';
import { getBuildsFor, getClass, getGuide, getRace } from '@/lib/data';
import {
  bandsOf,
  describe,
  dungeonOf,
  firstBand,
  getGuideData,
  getRoute,
  getRoutes,
  hasPlace,
  levelOf,
  noteOf,
  onePerson,
  placeOf,
  routeHref,
  routesOfClass,
  routesOfRace,
  stopsOf,
  stopTitle,
  type DungeonStep,
  type GuideRoute,
  type GuideStep,
  type NoteStep,
  type Numbered,
  type Part,
} from '@/lib/guide';
import { AddonLink } from '@/components/addon-button';
import { itemRef } from '@/lib/quests';
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
  'high-order-skyborne': 'raceHighOrder',
  'windshaper-skyborne': 'raceWindshaper',
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
  // The route's own address is its first page: the band of its first step with a place.
  const k = band?.length ? all.findIndex((b) => b.slug === band[0]) : firstBand(r);
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
      // an item with no page of its own (a vial a quest hands you) is plain text
      return itemRef(p.item) ? (
        <a key={i} href={`/items/${p.item}`} data-tip={`item:${p.item}`}>
          {p.text}
        </a>
      ) : (
        <span key={i}>{p.text}</span>
      );
    if ('spell' in p)
      return (
        <span key={i} data-tip={`spell:${p.spell}`} tabIndex={0} className="sp">
          {p.text}
        </span>
      );
    if ('dungeon' in p)
      return (
        <a key={i} href={`/dungeons/${p.dungeon}`}>
          {p.text}
        </a>
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
  // A note or a dungeon has no place on the map.
  if (!hasPlace(step)) return null;
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

/** The box to tick a step off (route-tools.tsx keeps the ticks; without it the box still works until you leave the page). */
function Tick({ n }: { n: number }) {
  return <input type="checkbox" className="tk" data-n={n} aria-labelledby={`t${n}`} autoComplete="off" />;
}

/** A note, as a slim card that opens: the first one in a route (the experience boosters) starts open. */
function Note({ n, step }: { n: number; step: NoteStep }) {
  const note = noteOf(step);
  return (
    <li id={`s${n}`} className="rn">
      <details open={n === 1}>
        <summary>
          <svg viewBox="0 0 12 12" className="size-3 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="m4.5 2.5 3.5 3.5-3.5 3.5" />
          </svg>
          {note.t}
        </summary>
        <div className="rn-b">
          {note.b.map((text, k) => (
            <p key={k}>{text}</p>
          ))}
        </div>
      </details>
    </li>
  );
}

/**
 * An optional dungeon: a calm card of its own, always shown. Run it once, with its quests: Forever pays a dungeon's
 * experience through them, mostly on the first run.
 */
function Dungeon({ n, step }: { n: number; step: DungeonStep }) {
  const { dungeon, zone, quests, more } = dungeonOf(step);
  return (
    <li id={`s${n}`} className="dg">
      <p className="dg-t">
        <b>Dungeon (optional)</b>: {dungeon?.n ?? 'a dungeon'}
        {dungeon && (
          <span>
            {' '}
            (levels {dungeon.lo} to {dungeon.hi}
            {zone && `, in ${zone}`})
          </span>
        )}
      </p>
      {quests.length > 0 ? (
        <p>
          Take its quests first:{' '}
          {quests.map((q, k) => (
            <span key={q.id}>
              {k > 0 && (k === quests.length - 1 && more === 0 ? ' and ' : ', ')}
              <a href={`/quests/${q.id}`} data-tip={`quest:${q.id}`}>
                {q.name}
              </a>
            </span>
          ))}
          {more > 0 && ` and ${more} more`}. Run it once with a group.
        </p>
      ) : (
        <p>{dungeon?.new ? 'New in Forever. Take its quests before you go in.' : 'Run it once with a group.'}</p>
      )}
      {dungeon && (
        <p className="dg-f">
          <a href={`/dungeons/${dungeon.s}`}>{dungeon.n} dungeon page</a>
        </p>
      )}
    </li>
  );
}

/** One stop: a step of its own, or the steps done with one person or at one camp, as a checklist under who or where. */
function Stop({ stop, zone }: { stop: Numbered[]; zone: number }) {
  const first = stop[0].step;
  const n = stop[0].n;
  if (first[0] === 'I') return <Note n={n} step={first} />;
  if (first[0] === 'D') return <Dungeon n={n} step={first} />;
  if (stop.length === 1)
    return (
      <li id={`s${n}`} className="rs">
        <span className="l">{levelOf(first)}</span>
        <span className="st">
          <Tick n={n} />
          <span className="tx" id={`t${n}`}>
            <Said step={first} />
          </span>
        </span>
        <Coords step={first} zone={zone} />
      </li>
    );
  const steps = stop.map((s) => s.step);
  const bare = onePerson(steps);
  return (
    <li id={`s${n}`} className="rs">
      <span className="l">{levelOf(first)}</span>
      <span className="h">{render(stopTitle(steps))}</span>
      <Coords step={first} zone={zone} />
      <ul className="ck">
        {stop.map(({ n: k, step }, j) => (
          <li key={k} id={j ? `s${k}` : undefined}>
            <Tick n={k} />
            <span className="tx" id={`t${k}`}>
              <Said step={step} bare={bare} />
            </span>
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
  // The steps there is something to do at (not the notes and dungeons), and where each level's first step is: its page and number.
  const doing = r.steps.map((step, i) => ({ n: i + 1, step })).filter((s) => hasPlace(s.step));
  const pageOf = new Map<number, number>();
  for (const b of all) for (const v of b.visits) for (const s of v.steps) pageOf.set(s.n, b.k);
  const first = levelOf(doing[0].step);
  const jump: { level: number; n: number; href: string }[] = [];
  for (let level = first, k = 0; level <= 60; level++) {
    while (k < doing.length - 1 && levelOf(doing[k].step) < level) k++;
    jump.push({ level, n: doing[k].n, href: routeHref(r.id, pageOf.get(doing[k].n) ?? 0) });
  }
  return (
    // data-route-page marks the container route-tools.tsx works in: it holds every step's box.
    <div className="relative isolate" data-route-page>
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
              From {r.start} to 60
              {classQuests > 0 && (
                <>
                  , with the <span className="whitespace-nowrap text-parch">{classQuests} {className.toLowerCase()} {classQuests === 1 ? 'quest' : 'quests'}</span> along the way
                </>
              )}
              .
              {classQuests === 0 && race?.newClasses.includes(r.class) && ` ${raceName} ${className.toLowerCase()}s are new in Forever, so their class quests are not in the route yet.`}
            </p>
          </div>
        </header>

        <p className="mt-5 max-w-3xl text-[16.5px] leading-relaxed text-parch">
          Every step in order, with map coordinates: who gives each quest, where to do it and who takes it back, and the flight paths, boats, Hearthstone and trainer
          visits on the way. <AddonLink from="route" className="text-gilt-bright underline decoration-gilt/40 underline-offset-2 transition-colors hover:text-gilt hover:decoration-gilt">Grimoire’s add-on</AddonLink> follows this route in game, with an arrow to every place.
        </p>

        <nav className="mt-6 space-y-2" aria-label="Other routes">
          <Switch label={raceName} items={routesOfRace(r.race).map((o) => ({ id: o.id, href: sameBand(o), text: CLASS_NAMES[o.class] ?? o.class, color: CLASS_COLOR[o.class], current: o.id === r.id }))} />
          <Switch label={`${className}s`} items={routesOfClass(r.class).map((o) => ({ id: o.id, href: sameBand(o), text: getRace(o.race)?.name ?? o.race, current: o.id === r.id }))} />
        </nav>
        {/* The talents to spend on the way, and how the class plays. */}
        <nav className="mt-2" aria-label={`${className} leveling builds and guide`}>
          <Switch
            label="Leveling builds"
            items={[
              ...getBuildsFor(r.class)
                .filter((b) => b.kind === 'leveling')
                .map((b) => ({ id: b.id, href: buildHref(b), text: b.name, current: false })),
              ...(getGuide(r.class) ? [{ id: 'guide', href: `/guides/${r.class}`, text: `${className} guide`, color, current: false }] : []),
            ]}
          />
        </nav>

        <RouteTools key={`${r.id}/${part.slug}`} route={r.id} levels={jump} />

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
                  <div className="num text-[14px] text-mist">
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
            <SupportNote>Grimoire works out every route itself and keeps them all free, with no ads. Did this stretch get you a few levels faster?</SupportNote>
          </div>
        </div>
      </Container>
    </div>
  );
}
