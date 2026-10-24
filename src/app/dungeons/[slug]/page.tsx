import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { BossIndex, BossSection, runPlaces, TrashDrops } from '@/components/encounters';
import { ItemRefLink, QuestLink, SideMark } from '@/components/world-links';
import { Badge, Container, Panel, SectionTitle } from '@/components/ui';
import { Vista } from '@/components/vista';
import { ZoneNav } from '@/components/zone-parts';
import { getDungeon, getDungeonQuests, getDungeons, getEncounters, getItem, getMinorItem } from '@/lib/data';
import { ADDON } from '@/lib/site';
import type { Quest } from '@/lib/types';

export function generateStaticParams() {
  return getDungeons().map((d) => ({ slug: d.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const d = getDungeon(slug);
  if (!d) return {};
  const enc = getEncounters(slug);
  const what = enc ? `its ${enc.bosses} bosses in order with their abilities and loot, notable drops of its regular mobs, and its quests` : d.summary || 'its quests';
  return { title: d.name, description: `${d.name} in World of Warcraft: Forever${d.levels ? `, levels ${d.levels[0]}–${d.levels[1]}` : ''}: ${what}.`, alternates: { canonical: `/dungeons/${d.slug}` } };
}

type Extra = { quests?: { id: number; n: string; l?: number; r?: number; side?: number }[]; rewards?: number[] };

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
  const bossTotal = enc?.bosses ?? d.bossCount ?? d.bosses?.length;
  const nav = [
    d.kind !== 'battleground' ? { id: 'bosses', label: 'Bosses', count: enc?.bosses } : null,
    enc?.trash.length ? { id: 'trash', label: 'Trash drops', count: enc.trash.length } : null,
    zoneQuests.length ? { id: 'quests', label: 'Quests', count: questRows.length } : null,
    rewards.length ? { id: 'rewards', label: 'Quest rewards', count: rewards.length } : null,
  ].filter((x): x is { id: string; label: string; count: number | undefined } => Boolean(x));

  return (
    <>
      <Vista
        art={d.art ?? 'paintedValley'}
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
            <div>
              <dt className="text-[13px] text-fog">Status</dt>
              <dd className="text-[1.05rem] leading-snug text-vellum">{d.status}</dd>
            </div>
          </dl>
          {d.levelSource === 'announced' && d.kind === 'dungeon' && <p className="mt-4 text-[14.5px] text-mist">{d.status === 'Previewed' ? 'Playable in the beta, not yet open on live realms. Levels as Blizzard announced them.' : 'Announced but not yet open. Levels as announced.'}</p>}
          {d.levelSource === 'creatures' && (
            <p className="mt-4 text-[14.5px] text-mist">Levels worked out from the creatures inside: from just under most of them to three over the last boss.</p>
          )}
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

          {d.kind !== 'battleground' && (
            <section id="bosses" className="scroll-mt-28">
              <SectionTitle title="Bosses">
                {enc
                  ? `${bosses.length > 1 ? `${enc.bosses} ${enc.bosses === 1 ? 'boss' : 'bosses'}${enc.rares ? ` and ${enc.rares} rare ${enc.rares === 1 ? 'spawn' : 'spawns'}` : ''} in the order of a normal run${enc.runs ? ', each wing a run of its own' : ''}. ` : ''}Abilities, loot and chances are Classic’s (patch 1.12, from VMaNGOS); Forever may have changed them.`
                  : `No open database has the bosses of this ${d.kind === 'raid' ? 'raid' : 'dungeon'} yet.`}
              </SectionTitle>
              {enc && bosses.length > 1 ? (
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

          {bosses.length > 0 && (
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
              <SectionTitle title="Quests for this dungeon">
                Given in town or inside, in level order.{' '}
                <a href={ADDON.url} target="_blank" rel="noopener noreferrer" className="text-gilt-bright underline decoration-gilt/40 underline-offset-2 transition-colors hover:text-gilt hover:decoration-gilt">
                  Grimoire’s add-on
                </a>{' '}
                lists yours in game, with the way to each giver.
              </SectionTitle>
              <ul className="divide-y divide-iron/50 border-y border-iron/50">
                {questRows.map(({ q, versions }) => (
                  <li key={q.i} className="flex items-center justify-between gap-4 py-2.5">
                    <span className="min-w-0">
                      <QuestLink quest={q} level />
                      {versions.length > 1 ? (
                        <span className="mt-0.5 block truncate text-[13.5px] text-fog">{versionsLine(versions)}</span>
                      ) : (
                        (nameCount.get(q.n) ?? 0) > 1 && q.o && <span className="mt-0.5 block truncate text-[13.5px] text-fog">{q.o}</span>
                      )}
                    </span>
                    {versions.length === 1 && q.s !== 0 && <SideMark side={q.s} className="shrink-0 text-[14px]" />}
                  </li>
                ))}
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
