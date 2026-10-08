import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ItemLink } from '@/components/links';
import { chance, ItemRefLink, QuestLink, SideMark } from '@/components/world-links';
import { Badge, Container, Panel, SectionTitle } from '@/components/ui';
import { Vista } from '@/components/vista';
import { getDungeon, getDungeons, getItemMap, getItems, getNpcLoot, getNpcs, getQuestsByZone, getZoneMap } from '@/lib/data';
import { RANK_LABEL } from '@/lib/quests';

export function generateStaticParams() {
  return getDungeons().map((d) => ({ slug: d.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const d = getDungeon(slug);
  if (!d) return {};
  return { title: d.name, description: `${d.name} in World of Warcraft: Forever${d.levels ? `, levels ${d.levels[0]}–${d.levels[1]}` : ''}: ${d.summary || 'loot, quests and enemies.'}`, alternates: { canonical: `/dungeons/${d.slug}` } };
}

type Extra = { quests?: { id: number; n: string; l?: number; r?: number; side?: number }[]; rewards?: number[]; elites?: string[] };

export default async function DungeonPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const d = getDungeon(slug) as (ReturnType<typeof getDungeon> & Extra) | undefined;
  if (!d) notFound();
  const items = getItemMap();
  const rewards = (d.rewards ?? []).map((i) => items.get(i)).filter(Boolean);
  const loot = d.zoneId
    ? getItems()
        .filter((it) => it.sm?.some((s) => s.z === d.zoneId) && it.q >= 2)
        .sort((a, b) => b.q - a.q || b.l - a.l)
        .slice(0, 48)
    : [];
  const bosses = loot.length ? [...new Set(loot.flatMap((it) => it.sm?.filter((s) => s.z === d.zoneId && s.t === 1 && s.n).map((s) => s.n!) ?? []))] : [];
  const kind = d.kind === 'raid' ? 'Raid' : d.kind === 'battleground' ? 'Battleground' : 'Dungeon';
  // Bosses: NPCs here whose own loot table drops gear at a real rate (trash only carries world drops).
  const bossLoot = d.zoneId
    ? Object.entries(getNpcs())
        .filter(([, n]) => n[6] === d.zoneId)
        .map(([id, n]) => ({ id: Number(id), n, loot: getNpcLoot(Number(id)).filter(([item, pct]) => items.has(item) && pct >= 1.5) }))
        // New Forever NPCs only count as bosses when their drop rates say so.
        .filter((b) => b.loot.length > 0 && (b.n[2] > 0 || b.n[4] > 0))
        .sort((a, b) => a.n[3] - b.n[3] || b.loot.length - a.loot.length)
    : [];
  const zoneQuests = d.zoneId ? getQuestsByZone().get(d.zoneId) ?? [] : [];
  const seenInBeta = bossLoot.some((b) => b.loot.some((row) => row[3]));
  // Boss names link to their NPC page when the NPC is known in this zone.
  const npcByName = new Map<string, number>();
  if (d.zoneId) for (const [id, n] of Object.entries(getNpcs())) if (n[6] === d.zoneId && !npcByName.has(n[0])) npcByName.set(n[0], Number(id));
  const nameCount = new Map<string, number>();
  for (const q of zoneQuests) nameCount.set(q.n, (nameCount.get(q.n) ?? 0) + 1);
  const fromTables = bossLoot.some((b) => b.loot.some((row) => !row[3]));
  return (
    <>
      <Vista
        art={d.art ?? (d.kind === 'raid' ? 'paintedValley' : 'dustwallow')}
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
      <Container className="space-y-12">
        <Panel className="p-5">
          <dl className="grid grid-cols-2 gap-x-8 gap-y-3 sm:grid-cols-4">
            <div>
              <dt className="text-[13px] text-fog">Levels</dt>
              <dd className="num text-[1.2rem] text-vellum">{d.levels ? `${d.levels[0]} to ${d.levels[1]}` : 'Unknown'}</dd>
            </div>
            <div>
              <dt className="text-[13px] text-fog">Group size</dt>
              <dd className="num text-[1.2rem] text-vellum">{d.size} players</dd>
            </div>
            {(d.bossCount || d.bosses?.length) && (
              <div>
                <dt className="text-[13px] text-fog">Bosses</dt>
                <dd className="num text-[1.2rem] text-vellum">{d.bossCount ?? d.bosses?.length}</dd>
              </div>
            )}
            <div>
              <dt className="text-[13px] text-fog">Status</dt>
              <dd className="text-[1.2rem] text-vellum">{d.status}</dd>
            </div>
          </dl>
          {d.levelSource === 'announced' && d.kind === 'dungeon' && <p className="mt-4 text-[14.5px] text-mist">Announced but not yet open. Levels as announced.</p>}
        </Panel>

        {d.notes && d.notes.length > 0 && (
          <section className="prose-grim max-w-3xl">
            {d.notes.map((n, i) => (
              <p key={i}>{n}</p>
            ))}
          </section>
        )}

        {(d.bosses?.length || bosses.length) ? (
          <section>
            <SectionTitle title={d.bosses?.length ? 'Bosses' : 'Bosses with loot'}>{d.bosses?.length ? 'Named encounters.' : 'Enemies with loot of their own.'}</SectionTitle>
            <div className="flex flex-wrap gap-2">
              {(d.bosses?.length ? d.bosses : bosses).map((b) => {
                const id = npcByName.get(b);
                const chip = 'rounded-full bg-gilt/10 px-3.5 py-1.5 font-display text-[1.05rem] text-gilt-bright ring-1 ring-gilt/30';
                return id ? (
                  <Link key={b} href={`/npcs/${id}`} data-tip={`npc:${id}`} className={`${chip} transition-colors hover:bg-gilt/20`}>
                    {b}
                  </Link>
                ) : (
                  <span key={b} className={chip}>
                    {b}
                  </span>
                );
              })}
            </div>
          </section>
        ) : null}

        {zoneQuests.length === 0 && d.quests && d.quests.length > 0 && (
          <section>
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

        {bossLoot.length > 0 && (
          <section>
            <SectionTitle title="Boss loot">
              {seenInBeta && fromTables
                ? 'Chance per kill. Marked bosses use early Forever kills; the rest are Classic rates.'
                : seenInBeta
                  ? 'Chance per kill, from early Forever kills.'
                  : 'Chance per kill for each boss’s gear, at Classic rates.'}
            </SectionTitle>
            <div className="grid gap-4 lg:grid-cols-2">
              {bossLoot.map((b) => (
                <div key={b.id} className="frame p-5">
                  <div className="flex items-baseline justify-between gap-3">
                    <Link href={`/npcs/${b.id}`} data-tip={`npc:${b.id}`} className="font-display text-[1.3rem] text-gilt-bright hover:underline">
                      {b.n[0]}
                    </Link>
                    <span className="num text-[13.5px] text-mist">
                      {[RANK_LABEL[b.n[4]], b.n[2] > 0 ? `level ${b.n[2] === b.n[3] ? b.n[2] : `${b.n[2]} to ${b.n[3]}`}` : null, seenInBeta && fromTables && b.loot.some((row) => row[3]) ? 'early Forever kills' : null].filter(Boolean).join(', ')}
                    </span>
                  </div>
                  <ul className="mt-3 space-y-1.5">
                    {b.loot.slice(0, 12).map(([item, pct]) => (
                      <li key={item} className="flex items-center justify-between gap-3">
                        <ItemRefLink id={item} size={24} className="min-w-0 text-[15px]" />
                        <span className="num shrink-0 text-[14px] text-parch">{chance(pct)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>
        )}

        {zoneQuests.length > 0 && (
          <section>
            <SectionTitle title="Quests for this dungeon" />
            <ul className="divide-y divide-iron/50 border-y border-iron/50">
              {zoneQuests.map((q) => (
                <li key={q.i} className="flex items-center justify-between gap-4 py-2.5">
                  <span className="min-w-0">
                    <QuestLink quest={q} level />
                    {(nameCount.get(q.n) ?? 0) > 1 && q.o && <span className="mt-0.5 block truncate text-[13.5px] text-fog">{q.o}</span>}
                  </span>
                  <SideMark side={q.s} className="shrink-0 text-[14px]" />
                </li>
              ))}
            </ul>
          </section>
        )}

        {(rewards.length > 0 || loot.length > 0) && (
          <section>
            <SectionTitle title="Loot and rewards" href={d.zoneId && getZoneMap().has(d.zoneId) ? `/world/${d.zoneId}` : undefined} linkLabel="Zone page" />
            <div className="grid gap-x-6 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
              {[...rewards, ...loot.filter((x) => !rewards.some((r) => r!.i === x.i))].map((it) =>
                it ? (
                  <div key={it.i} className="min-w-0">
                    <ItemLink item={it} size={28} className="text-[15px]" />
                  </div>
                ) : null,
              )}
            </div>
          </section>
        )}

        {d.elites && d.elites.length > 0 && (
          <section>
            <SectionTitle title="Elite enemies" />
            <p className="text-[15.5px] leading-relaxed text-mist">{d.elites.join(', ')}</p>
          </section>
        )}

        <div>
          <Link href="/dungeons" className="text-gilt hover:text-gilt-bright">
            All dungeons and raids
          </Link>
        </div>
      </Container>
    </>
  );
}
