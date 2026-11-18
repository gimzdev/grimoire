import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CheckCount, CheckRow } from '@/components/check-list';
import { DungeonMap } from '@/components/dungeon-map';
import { BossIndex, BossSection, runPlaces, TrashDrops } from '@/components/encounters';
import { EntityLink, ItemRefLink, QuestLink, SideMark } from '@/components/world-links';
import { Badge, Container, Panel, SectionTitle } from '@/components/ui';
import { Vista } from '@/components/vista';
import { ZoneNav } from '@/components/zone-parts';
import { getDungeon, getDungeonQuests, getDungeons, getEncounters, getItem, getMap, getMeta, getMinorItem, getQuest, getZoneNames, placeHref } from '@/lib/data';
import { mapBosses } from '@/lib/map-bosses';
import { AddonLink, AddonStrip } from '@/components/addon-button';
import { dungeonArt } from '@/lib/zone';
import type { Quest } from '@/lib/types';

export function generateStaticParams() {
  return getDungeons().map((d) => ({ slug: d.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const d = getDungeon(slug);
  if (!d) return {};
  const enc = getEncounters(slug);
  const what = enc?.src ? `the ${enc.bosses === 1 ? 'boss' : 'bosses'} ${enc.src === 'sites' ? 'Blizzard or two guide sites name' : 'QuestieDB’s traces name'}, and its quests` : enc ? `its ${enc.bosses} bosses in order with their abilities and loot, notable drops of its regular mobs, and its quests` : d.summary || 'its quests';
  return { title: d.name, description: `${d.name} in World of Warcraft: Forever${d.levels ? `, levels ${d.levels[0]}–${d.levels[1]}` : ''}: ${what}.`, alternates: { canonical: `/dungeons/${d.slug}` } };
}

type Extra = { quests?: { id: number; n: string; l?: number; r?: number; side?: number }[]; rewards?: number[] };

/** "Wowhead and Warcraft Tavern", "A, B and C". */
const andList = (xs: string[]) => (xs.length > 1 ? `${xs.slice(0, -1).join(', ')} and ${xs.at(-1)}` : (xs[0] ?? ''));

/** "November 13" for 2026-11-13. */
const day = (date: string) => new Date(`${date}T12:00:00Z`).toLocaleDateString('en-US', { month: 'long', day: 'numeric', timeZone: 'UTC' });

/** Items the dungeon's quests give (rewards and choices), Uncommon or better, best first, each with its first quest. */
function questRewards(quests: Quest[]) {
  const out = new Map<number, Quest>();
  for (const q of quests) for (const [id] of [...(q.ir ?? []), ...(q.ic ?? [])]) if (!out.has(id)) out.set(id, q);
  const quality = (id: number) => getItem(id)?.q ?? getMinorItem(id)?.[1] ?? 0;
  const level = (id: number) => getItem(id)?.l ?? getMinorItem(id)?.[5] ?? 0;
  return [...out]
    .filter(([id]) => quality(id) >= 2)
    .sort(([a], [b]) => quality(b) - quality(a) || level(b) - level(a) || a - b)
    .map(([id, q]) => ({ id, q }));
}

export default async function DungeonPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const d = getDungeon(slug) as (ReturnType<typeof getDungeon> & Extra) | undefined;
  if (!d) notFound();
  const enc = d.kind === 'battleground' ? undefined : getEncounters(d.slug);
  // a new dungeon's bosses as QuestieDB's traces rank them: names and levels only
  const traced = enc?.src === 'questiedb';
  // or as Blizzard or two independent sites name them: names and order only
  const named = enc?.src === 'sites';
  const namedBy = named ? [...new Map(enc.sources!.map((x) => [x.name, x])).values()] : [];
  const traces = getMeta().sources.questiedb?.date;
  const bosses = enc ? enc.wings.flatMap((w) => w.bosses) : [];
  const places = enc ? runPlaces(enc) : new Map<string, number>();
  const kind = d.kind === 'raid' ? 'Raid' : d.kind === 'battleground' ? 'Battleground' : 'Dungeon';
  const zoneQuests = getDungeonQuests(d);
  const nameCount = new Map<string, number>();
  for (const q of zoneQuests) nameCount.set(q.n, (nameCount.get(q.n) ?? 0) + 1);
  // A quest that comes in many versions (one for each class, or each side: the dungeon set's) is one row.
  const questRows: { q: Quest; versions: Quest[] }[] = [];
  {
    const seen = new Map<string, { q: Quest; versions: Quest[] }>();
    for (const q of zoneQuests) {
      const row = (nameCount.get(q.n) ?? 0) >= 3 ? seen.get(q.n) : undefined;
      if (row) row.versions.push(q);
      else {
        const r = { q, versions: [q] };
        if ((nameCount.get(q.n) ?? 0) >= 3) seen.set(q.n, r);
        questRows.push(r);
      }
    }
  }
  const versionsLine = (v: Quest[]) => {
    const sides = new Set(v.map((q) => q.s));
    const both = sides.has(1) && sides.has(2) ? ', Alliance and Horde' : '';
    return v.every((q) => q.rc) ? `One for each class${both}` : `${v.length} versions${both}`;
  };
  const rewards = [...(d.rewards ?? []).map((id) => ({ id, q: undefined as Quest | undefined })), ...questRewards(zoneQuests).filter((r) => !d.rewards?.includes(r.id))];
  // what QuestieDB's traces rank is not the dungeon's count of bosses
  const bossTotal = traced || named ? d.bossCount : (enc?.bosses ?? d.bossCount ?? d.bosses?.length);
  const map = enc ? getMap(d.slug) : undefined;
  const nav = [
    map ? { id: 'map', label: 'Map', count: undefined } : null,
    d.kind !== 'battleground' ? { id: 'bosses', label: 'Bosses', count: enc?.bosses } : null,
    enc?.trash.length ? { id: 'trash', label: 'Trash drops', count: enc.trash.length } : null,
    zoneQuests.length ? { id: 'quests', label: 'Before you go', count: questRows.length } : null,
    rewards.length ? { id: 'rewards', label: 'Quest rewards', count: rewards.length } : null,
  ].filter((x): x is { id: string; label: string; count: number | undefined } => Boolean(x));

  return (
    <>
      <Vista
        art={dungeonArt(d)}
        kicker={
          <span className="flex flex-wrap items-center gap-2">
            {kind}, {d.location}
            {d.isNew && <Badge tone="new">New in Forever</Badge>}
          </span>
        }
        title={d.name}
      >
        {d.summary}
      </Vista>
      <Container>
        <Panel className="p-5">
          <dl className="grid grid-cols-2 gap-x-8 gap-y-3 sm:grid-cols-3 lg:grid-cols-5">
            <div>
              <dt className="text-[13px] text-fog">Levels</dt>
              <dd className="num text-[1.2rem] text-vellum">{d.levels ? `${d.levels[0]} to ${d.levels[1]}` : 'Unknown'}</dd>
            </div>
            <div>
              <dt className="text-[13px] text-fog">Group size</dt>
              <dd className="num text-[1.2rem] text-vellum">{d.kind === 'battleground' ? `${d.size} vs ${d.size}` : `${d.size} players`}</dd>
            </div>
            {bossTotal ? (
              <div>
                <dt className="text-[13px] text-fog">Bosses</dt>
                <dd className="num text-[1.2rem] text-vellum">
                  {bossTotal}
                  {enc?.rares ? <span className="text-[14px] text-mist"> and {enc.rares} rare {enc.rares === 1 ? 'spawn' : 'spawns'}</span> : null}
                </dd>
              </div>
            ) : null}
            <div>
              <dt className="text-[13px] text-fog">Location</dt>
              <dd className="text-[1.05rem] leading-snug text-vellum">{d.location}</dd>
            </div>
            {!d.entrances?.length && d.way ? (
              <div>
                <dt className="text-[13px] text-fog">Entrance</dt>
                <dd className="text-[1.05rem] leading-snug text-vellum">{d.way}</dd>
              </div>
            ) : null}
            {d.entrances?.length ? (
              <div>
                <dt className="text-[13px] text-fog">Entrance</dt>
                <dd className="text-[1.05rem] leading-snug text-vellum">
                  {d.entrances.map((e) => {
                    const href = placeHref(e.zone);
                    const name = getZoneNames()[e.zone] ?? `Zone ${e.zone}`;
                    return (
                      <span key={`${e.zone}:${e.x}:${e.y}`} className="block">
                        {href ? (
                          <Link href={href} className="text-gilt hover:text-gilt-bright">
                            {name}
                          </Link>
                        ) : (
                          name
                        )}{' '}
                        <span className="num">
                          {e.x.toFixed(1)}, {e.y.toFixed(1)}
                        </span>
                      </span>
                    );
                  })}
                </dd>
              </div>
            ) : null}
            <div>
              <dt className="text-[13px] text-fog">Status</dt>
              <dd className="text-[1.05rem] leading-snug text-vellum">{d.status}</dd>
            </div>
          </dl>
          {d.levelSource === 'announced' && d.kind === 'dungeon' && <p className="mt-4 text-[14.5px] text-mist">{d.status === 'Open' ? 'Levels as Blizzard announced them.' : 'Announced but not yet open. Levels as announced.'}</p>}
          {d.levelSource === 'creatures' && (
            <p className="mt-4 text-[14.5px] text-mist">Levels worked out from the creatures inside: from just under most of them to three over the last boss.</p>
          )}
          {d.entrances?.length ? <p className="mt-1 text-[14.5px] text-mist">The entrance as QuestieDB places it on Forever’s map of the zone.</p> : null}
          {!d.entrances?.length && d.way && d.waySources?.length ? <p className="mt-1 text-[14.5px] text-mist">The entrance as {andList(d.waySources)} describe it.</p> : null}
        </Panel>
        {nav.length >= 2 ? <ZoneNav items={nav} /> : <div className="h-12" />}

        <div className="space-y-12">
          {d.notes && d.notes.length > 0 && (
            <section className="prose-grim max-w-3xl">
              {d.notes.map((n, i) => (
                <p key={i}>{n}</p>
              ))}
            </section>
          )}

          {map && (
            <section id="map" className="scroll-mt-28">
              <SectionTitle title="Map">
                Drawn by Grimoire from where VMaNGOS places every creature and object{map.views.length > 1 ? ', one map for each wing' : ''}. Hover a boss for its abilities and best loot, click
                it for the rest.
              </SectionTitle>
              <DungeonMap views={map.views} bosses={mapBosses(enc!)} />
              <AddonStrip from="dungeon" className="mt-4">
                In game, the add-on has this map, with each boss’s abilities and loot.
              </AddonStrip>
            </section>
          )}

          {d.kind !== 'battleground' && (
            <section id="bosses" className="scroll-mt-28">
              <SectionTitle title="Bosses">
                {named ? (
                  <>
                    Named by{' '}
                    {namedBy.map((x, i) => (
                      <span key={x.url}>
                        {i > 0 ? (i === namedBy.length - 1 ? ' and ' : ', ') : ''}
                        <a href={x.url} target="_blank" rel="noopener noreferrer" className="text-gilt hover:text-gilt-bright">
                          {x.name}
                        </a>
                      </span>
                    ))}
                    {enc.ordered ? ', in the order they agree on' : ', in no order two of them agree on'}, checked {day(enc.checked!)}
                    {d.opens ? `. The raid opens on ${day(d.opens)}, so the names come from previews` : ''}. Grimoire prints a name only when Blizzard gives it or two sites agree; their abilities and loot are in no open database.
                  </>
                ) : traced
                  ? `The creatures QuestieDB’s players met inside and its traces of ${day(enc.date!)} rank as bosses, with their levels: not a complete boss guide. No open database has their abilities or loot.`
                  : enc
                    ? `${bosses.length > 1 ? `${enc.bosses} ${enc.bosses === 1 ? 'boss' : 'bosses'}${enc.rares ? ` and ${enc.rares} rare ${enc.rares === 1 ? 'spawn' : 'spawns'}` : ''} in the order of a normal run${enc.runs ? ', each wing a run of its own' : ''}. ` : ''}Abilities, loot and chances are Classic’s (patch 1.12, from VMaNGOS); Forever may have changed them.`
                    : `No open database names the bosses of this ${d.kind === 'raid' ? 'raid' : 'dungeon'}.${d.isNew && d.kind === 'dungeon' && traces ? ` QuestieDB’s traces of ${day(traces)} rank no creature inside it as a boss.` : ''}`}
              </SectionTitle>
              {named ? (
                <>
                  <ol className={`grid gap-2 sm:grid-cols-2 lg:grid-cols-3 ${enc.ordered ? 'list-decimal' : 'list-disc'} pl-6`}>
                    {bosses.map((b) => (
                      <li key={b.key} className="text-[1.05rem] text-vellum">
                        {b.n}
                        {b.f?.includes('rare') ? <span className="text-[14px] text-mist"> · rare spawn</span> : null}
                        <span className="block text-[13px] text-fog">{andList(b.src ?? [])}</span>
                      </li>
                    ))}
                  </ol>
                  {enc.note ? <p className="mt-3 max-w-3xl text-[14.5px] text-mist">{enc.note}</p> : null}
                </>
              ) : enc && (bosses.length > 1 || traced) ? (
                <BossIndex data={enc} />
              ) : d.bosses?.length ? (
                <div className="flex flex-wrap gap-2">
                  {d.bosses.map((b) => (
                    <span key={b} className="rounded-full bg-gilt/10 px-3.5 py-1.5 text-[1.05rem] text-gilt-bright ring-1 ring-gilt/30">
                      {b}
                    </span>
                  ))}
                </div>
              ) : null}
            </section>
          )}

          {bosses.length > 0 && !traced && !named && (
            <div className="space-y-6">
              {bosses.map((b) => (
                <BossSection key={b.key} boss={b} place={places.get(b.key)} />
              ))}
            </div>
          )}

          {enc && enc.trash.length > 0 && (
            <section id="trash" className="scroll-mt-28">
              <SectionTitle title="Notable drops from regular mobs">Uncommon or better items that drop mainly in this {d.kind === 'raid' ? 'raid' : 'dungeon'}, from its regular mobs: best quality first, with the best chance per kill and the mobs that drop them.</SectionTitle>
              <TrashDrops data={enc} />
            </section>
          )}

          {zoneQuests.length === 0 && d.quests && d.quests.length > 0 && (
            <section id="quests" className="scroll-mt-28">
              <SectionTitle title="Quests" />
              <div className="frame divide-y divide-iron/60">
                {d.quests.map((q) => (
                  <div key={q.id} className="flex items-center justify-between gap-4 px-4 py-2.5">
                    <span className="text-vellum">{q.n}</span>
                    <span className="flex items-center gap-2">
                      {q.side === 1 && <Badge tone="alliance">Alliance</Badge>}
                      {q.side === 2 && <Badge tone="horde">Horde</Badge>}
                      {q.l ? <span className="num text-[14px] text-mist">Level {q.l}</span> : null}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {zoneQuests.length > 0 && (
            <section id="quests" className="scroll-mt-28">
              <SectionTitle title="Before you go">
                The quests for this {d.kind === 'raid' ? 'raid' : 'dungeon'} in level order, with who gives them and what comes first. Tick them as you pick them up;{' '}
                <AddonLink from="dungeon" className="text-gilt-bright underline decoration-gilt/40 underline-offset-2 transition-colors hover:text-gilt hover:decoration-gilt">
                  Grimoire’s add-on
                </AddonLink>{' '}
                ticks yours from your quest log, with the way to each giver.
              </SectionTitle>
              <div className="mb-2 flex min-h-6 justify-end">
                <CheckCount list={`dungeon:${d.slug}`} ids={questRows.map(({ q }) => q.i)} />
              </div>
              <ul className="divide-y divide-iron/50 border-y border-iron/50">
                {questRows.map(({ q, versions }) => {
                  const giver = q.st?.find((x) => x[0] === 'n') ?? q.st?.[0];
                  const before = q.pv ? getQuest(q.pv) : undefined;
                  return (
                    <CheckRow key={q.i} list={`dungeon:${d.slug}`} id={q.i}>
                      <div className="flex items-start justify-between gap-4">
                        <span className="min-w-0">
                          <QuestLink quest={q} level />
                          {versions.length > 1 ? (
                            <span className="mt-0.5 block truncate text-[13.5px] text-fog">{versionsLine(versions)}</span>
                          ) : (
                            (nameCount.get(q.n) ?? 0) > 1 && q.o && <span className="mt-0.5 block truncate text-[13.5px] text-fog">{q.o}</span>
                          )}
                          {(giver || before) && (
                            <span className="mt-0.5 block text-[13.5px] text-fog">
                              {giver && (
                                <>
                                  From <EntityLink kind={giver[0]} id={giver[1]} zone rank={false} />
                                </>
                              )}
                              {giver && before && ' · '}
                              {before &&
                                (before.n === q.n ? (
                                  'after its first part'
                                ) : (
                                  <>
                                    after <QuestLink quest={before} className="text-mist" />
                                  </>
                                ))}
                            </span>
                          )}
                        </span>
                        {versions.length === 1 && q.s !== 0 && <SideMark side={q.s} className="shrink-0 text-[14px]" />}
                      </div>
                    </CheckRow>
                  );
                })}
              </ul>
            </section>
          )}

          {rewards.length > 0 && (
            <section id="rewards" className="scroll-mt-28">
              <SectionTitle title="Quest rewards">Items the quests for this {d.kind === 'raid' ? 'raid' : 'dungeon'} give, best quality first.</SectionTitle>
              <ul className="grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
                {rewards.map(({ id, q }) => (
                  <li key={id} className="min-w-0">
                    <ItemRefLink id={id} size={28} className="text-[15px]" />
                    {q && (
                      <span className="mt-0.5 block truncate pl-[36px] text-[13.5px] text-fog">
                        <QuestLink quest={q} className="text-mist" />
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <div>
            <Link href="/dungeons" className="text-gilt hover:text-gilt-bright">
              All dungeons and raids
            </Link>
          </div>
        </div>
      </Container>
    </>
  );
}
