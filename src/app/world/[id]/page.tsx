import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ItemLink } from '@/components/links';
import { EntityLink, QuestLink, SideMark } from '@/components/world-links';
import { Badge, Container, Panel, SectionTitle } from '@/components/ui';
import { Vista } from '@/components/vista';
import { ZONE_ART, type ArtKey } from '@/lib/art';
import { getDungeons, getItems, getNpcs, getQuestsByZone, getZoneMap, getZonePages } from '@/lib/data';
import { CONTINENT, ZONE_NOTES, zoneLevels } from '@/lib/world';
import { TERRITORY } from '@/lib/wow';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const z = getZoneMap().get(Number(id));
  if (!z) return {};
  const lv = zoneLevels(z);
  return { title: z.n, description: `${z.n} in World of Warcraft: Forever${lv ? `, levels ${lv.lo} to ${lv.hi}` : ''}: quests, named enemies and the items found there.`, alternates: { canonical: `/world/${z.id}` } };
}

export default async function ZonePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const z = getZoneMap().get(Number(id));
  if (!z) notFound();
  const lv = zoneLevels(z);
  const page = getZonePages()[String(z.id)];
  const loot = getItems()
    .filter((it) => it.sm?.some((s) => s.z === z.id) && it.q >= 2)
    .sort((a, b) => b.q - a.q || b.l - a.l)
    .slice(0, 36);
  const rewards = page?.rewards.map((i) => getItems().find((x) => x.i === i)).filter(Boolean) ?? [];
  const quests = getQuestsByZone().get(z.id) ?? [];
  const anyStart = quests.some((q) => q.st?.length);
  const npcByName = new Map<string, number>();
  for (const [nid, n] of Object.entries(getNpcs())) if (n[6] === z.id && !npcByName.has(n[0])) npcByName.set(n[0], Number(nid));
  const dungeons = getDungeons().filter((d) => d.zoneId === z.id || (d.location && d.location.includes(z.n)));
  const art: ArtKey = ZONE_ART[z.id] ?? (z.cat === 1 ? 'barrens' : z.cat === 2 ? 'dustwallow' : z.cat === 3 ? 'paintedValley' : 'paintedVista');
  const kind = z.inst === 2 ? 'Dungeon' : z.inst === 3 ? 'Raid' : z.inst === 4 ? 'Battleground' : 'Zone';
  return (
    <>
      <Vista
        art={art}
        size="compact"
        kicker={
          <span className="flex flex-wrap items-center gap-2">
            {kind}, {CONTINENT(z)}
            {z.st === 'new' && <Badge tone="new">New in Forever</Badge>}
            {z.st === 'updated' && <Badge tone="changed">Changed</Badge>}
          </span>
        }
        title={z.n}
      >
        {ZONE_NOTES[z.id] ?? (lv ? `Levels ${lv.lo} to ${lv.hi}${lv.approx ? ' (estimated from quest levels)' : ''}.` : null)}
      </Vista>
      <Container className="space-y-12">
        <Panel className="p-5">
          <dl className="grid grid-cols-2 gap-x-8 gap-y-3 sm:grid-cols-4">
            <div>
              <dt className="text-[13px] text-fog">Levels</dt>
              <dd className="num text-[1.2rem] text-vellum">{lv ? `${lv.lo} to ${lv.hi}${lv.approx ? ', estimated' : ''}` : 'Unknown'}</dd>
              {lv?.typical && (
                <dd className="text-[13px] text-mist">
                  Most quests. Quests and creatures span {z.lo} to {z.hi}.
                </dd>
              )}
            </div>
            <div>
              <dt className="text-[13px] text-fog">Territory</dt>
              <dd className="text-[1.2rem] text-vellum">{TERRITORY[z.t] ?? 'Unknown'}</dd>
            </div>
            {z.np > 0 && (
              <div>
                <dt className="text-[13px] text-fog">Players</dt>
                <dd className="num text-[1.2rem] text-vellum">{z.np}</dd>
              </div>
            )}
            {quests.length > 0 && (
              <div>
                <dt className="text-[13px] text-fog">Quests</dt>
                <dd className="num text-[1.2rem] text-vellum">
                  {quests.length}
                  {quests.some((q) => q.ch === 'n') && <span className="ml-2 text-[14px] text-leaf-bright">{quests.filter((q) => q.ch === 'n').length} new</span>}
                </dd>
              </div>
            )}
          </dl>
          {z.lines && z.lines.length > 0 && (
            <p className="mt-4 text-[15px] text-gilt-bright">
              Changed in Forever: <span className="text-parch">{z.lines.join('; ')}</span>
            </p>
          )}
        </Panel>

        {dungeons.length > 0 && (
          <section>
            <SectionTitle title="Dungeons here" />
            <div className="grid gap-3 sm:grid-cols-2">
              {dungeons.map((d) => (
                <Link key={d.slug} href={`/dungeons/${d.slug}`} className="frame flex items-center justify-between p-4 hover:border-gilt/40">
                  <span className={d.isNew ? 'text-leaf-bright' : 'text-vellum'}>{d.name}</span>
                  {d.levels && <span className="num text-gilt">{d.levels[0]} to {d.levels[1]}</span>}
                </Link>
              ))}
            </div>
          </section>
        )}

        {quests.length > 0 && (
          <section>
            {/* Quest givers for brand-new zones are often not on record yet; the column only shows when some are. */}
            <SectionTitle title="Quests" href={`/quests?zone=${z.id}`} linkLabel="Filter these quests" />
            <div className="frame overflow-x-auto scroll-thin">
              <table className="w-full min-w-[640px] text-left text-[15px]">
                <thead>
                  <tr className="border-b border-iron/70 text-[13.5px] text-fog">
                    <th className="w-16 px-4 py-2.5 text-right font-medium">Level</th>
                    <th className="px-3 py-2.5 font-medium">Quest</th>
                    {anyStart && <th className="px-3 py-2.5 font-medium">Starts with</th>}
                    <th className="px-4 py-2.5 font-medium">Side</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-iron/45">
                  {quests.map((q) => (
                    <tr key={q.i} className="hover:bg-dusk/40">
                      <td className="num px-4 py-2 text-right text-vellum">{q.l > 0 ? q.l : ''}</td>
                      <td className="px-3 py-2">
                        <QuestLink quest={q} />
                        {q.ch === 'n' && (
                          <Badge tone="new" className="ml-2">
                            New
                          </Badge>
                        )}
                        {q.ch === 'u' && (
                          <Badge tone="changed" className="ml-2">
                            Changed
                          </Badge>
                        )}
                      </td>
                      {anyStart && <td className="px-3 py-2 text-[14.5px]">{q.st?.[0] ? <EntityLink kind={q.st[0][0]} id={q.st[0][1]} /> : null}</td>}
                      <td className="px-4 py-2 text-[14px]">
                        <SideMark side={q.s} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {page && page.elites.length > 0 && (
          <section>
            <SectionTitle title="Named and elite enemies" />
            <div className="flex flex-wrap gap-2">
              {page.elites.map((n) =>
                npcByName.has(n) ? (
                  <Link key={n} href={`/npcs/${npcByName.get(n)}`} data-tip={`npc:${npcByName.get(n)}`} className="rounded-full bg-slate/80 px-3 py-1 text-[14.5px] text-parch ring-1 ring-iron/60 hover:text-vellum">
                    {n}
                  </Link>
                ) : (
                  <span key={n} className="rounded-full bg-slate/60 px-3 py-1 text-[14.5px] text-mist ring-1 ring-iron/50">
                    {n}
                  </span>
                ),
              )}
            </div>
          </section>
        )}

        {(rewards.length > 0 || loot.length > 0) && (
          <section>
            <SectionTitle title="Items from this zone">Quest rewards and drops recorded here, best first.</SectionTitle>
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
      </Container>
    </>
  );
}
