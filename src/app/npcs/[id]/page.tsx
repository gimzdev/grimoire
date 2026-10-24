import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { DetailHead, type Crumb } from '@/components/detail-head';
import { WowIcon } from '@/components/icon';
import { LootList } from '@/components/loot-list';
import { NpcTooltip } from '@/components/tooltips';
import { Badge, Container } from '@/components/ui';
import { ItemRefLink, QuestLink } from '@/components/world-links';
import { ZONE_ART } from '@/lib/art';
import { artThumb } from '@/lib/art-server';
import { getEntityQuestIndex, getItem, getMinorItem, getNpc, getNpcLoot, getNpcVendorIndex, getQuest, placeHref } from '@/lib/data';
import { categoryName, RANK_LABEL } from '@/lib/quests';
import type { Quest } from '@/lib/types';
import { creatureIcon } from '@/lib/icons';
import { iconUrl } from '@/lib/wow';

export const revalidate = false;
export const dynamicParams = true;

export function generateStaticParams() {
  return [];
}

const TYPE = ['', 'Beast', 'Dragonkin', 'Demon', 'Elemental', 'Giant', 'Undead', 'Humanoid', 'Critter', 'Mechanical', 'Not specified', 'Totem'];


export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const n = getNpc(Number(id));
  if (!n) return {};
  const lv = n[2] <= 0 ? 'new in Forever' : n[2] === n[3] ? `level ${n[2]}` : `levels ${n[2]} to ${n[3]}`;
  return { title: `${n[0]} (NPC)`, description: `${n[0]}${n[1] ? `, ${n[1]}` : ''}, ${lv}${n[6] ? ` in ${categoryName(n[6])}` : ''}: quests, drops with drop chances, and what it sells.`, alternates: { canonical: `/npcs/${id}` } };
}

function reaction(code: string) {
  const a = code[0];
  const h = code[1];
  const word = (c: string) => (c === 'f' ? 'friendly' : c === 'h' ? 'hostile' : 'neutral');
  if (a === h) return { text: `${word(a)[0].toUpperCase()}${word(a).slice(1)} to both factions`, tone: (a === 'h' ? 'removed' : a === 'f' ? 'good' : 'neutral') as 'removed' | 'good' | 'neutral' };
  return { text: `${word(a)[0].toUpperCase()}${word(a).slice(1)} to the Alliance, ${word(h)} to the Horde`, tone: 'neutral' as const };
}

function QuestCard({ title, ids }: { title: string; ids: number[] }) {
  const quests = ids.map((i) => getQuest(i)).filter((q): q is Quest => Boolean(q)).sort((a, b) => a.l - b.l);
  if (!quests.length) return null;
  return (
    <section className="frame p-5">
      <h2 className="text-[1.05rem] font-semibold tracking-[-0.01em] text-vellum">{title}</h2>
      <ul className="mt-3 space-y-2 text-[15px]">
        {quests.map((q) => (
          <li key={q.i} className="flex flex-wrap items-center gap-2">
            <QuestLink quest={q} level />
            {q.ch === 'n' && <Badge tone="new">New</Badge>}
          </li>
        ))}
      </ul>
    </section>
  );
}

export default async function NpcPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: raw } = await params;
  const id = Number(raw);
  const n = getNpc(id);
  if (!n) notFound();
  const [name, title, lo, hi, rank, react, zone, , type] = n;
  const quests = getEntityQuestIndex().get(`n${id}`);
  const loot = getNpcLoot(id);
  const sells = getNpcVendorIndex().get(id) ?? [];
  const r = reaction(react);
  const zoneName = zone ? categoryName(zone) : null;
  const level = lo > 0 ? (lo === hi ? `${lo}` : `${lo} to ${hi}`) : undefined;
  const kind = TYPE[type] && type !== 10 ? TYPE[type].toLowerCase() : '';
  // The wash behind the name: the zone's art when there is one, else the best thing it drops.
  const best = [...loot].sort((a, b) => (getItem(b[0])?.q ?? getMinorItem(b[0])?.[1] ?? 0) - (getItem(a[0])?.q ?? getMinorItem(a[0])?.[1] ?? 0))[0];
  const bestIcon = best ? (getItem(best[0])?.ic ?? getMinorItem(best[0])?.[2]) : undefined;
  const wash = ZONE_ART[zone] ? artThumb(ZONE_ART[zone]) : iconUrl(bestIcon ?? creatureIcon(type), 'large');
  const crumbs: Crumb[] = [['NPCs'], ...(zoneName ? ([[zoneName, placeHref(zone)]] as Crumb[]) : [])];
  const hasQuests = Boolean(quests && (quests.starts.length || quests.ends.length || quests.objective.length));

  return (
    <>
      <DetailHead
        crumbs={crumbs}
        icon={<WowIcon icon={creatureIcon(type)} size={72} name={name} eager />}
        title={name}
        meta={
          <>
            {title && <div className="text-[17px] font-medium text-gilt-bright">{title}</div>}
            <div className={title ? 'mt-1' : ''}>
              {level ? `Level ${level}` : 'New in Forever'}
              {kind ? ` ${kind}` : ''}
              {zoneName ? `, ${zoneName}` : ''}
            </div>
          </>
        }
        wash={wash}
        badges={
          <>
            {RANK_LABEL[rank] && <Badge tone="gilt">{RANK_LABEL[rank]}</Badge>}
            <Badge tone={r.tone}>{r.text}</Badge>
          </>
        }
        aside={
          <div className="drop-shadow-[0_30px_50px_rgb(0_0_0/0.6)]">
            <NpcTooltip npc={{ n: name, title: title || undefined, level, rank: RANK_LABEL[rank], zone: zoneName ?? undefined, react }} />
          </div>
        }
      />

      <Container>
        <div className={`grid gap-6 ${hasQuests ? 'lg:grid-cols-[minmax(0,1fr)_340px]' : ''}`}>
          <div className="min-w-0 space-y-6">
            {loot.length > 0 && (
              <section className="frame p-5 sm:p-7">
                <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
                  <h2 className="text-[1.45rem] text-vellum">Loot</h2>
                  <span className="text-[14px] text-mist">Chance per kill</span>
                </div>
                {loot.some((row) => row[2]) && <p className="mt-1 text-[14px] text-fog">Green drops only while you are on the quest.</p>}
                <div className="-mx-3 mt-3">
                  <LootList rows={loot} iconSize={30} columns={hasQuests ? 1 : 2} />
                </div>
              </section>
            )}
            {sells.length > 0 && (
              <section className="frame p-5 sm:p-7">
                <h2 className="text-[1.45rem] text-vellum">Sells</h2>
                <ul className="mt-4 grid gap-2 sm:grid-cols-2">
                  {sells.map((it) => (
                    <li key={it} className="well px-3 py-2.5">
                      <ItemRefLink id={it} size={28} className="text-[15px]" />
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {!loot.length && !sells.length && !quests && <div className="frame p-5 text-parch sm:p-7">Nothing recorded for this NPC beyond where it stands.</div>}
          </div>
          <aside className="h-fit space-y-4">
            {quests && (
              <>
                <QuestCard title="Starts" ids={quests.starts} />
                <QuestCard title="Ends" ids={quests.ends} />
                <QuestCard title="Objective of" ids={quests.objective} />
              </>
            )}
            <p className="px-1 text-[13px] leading-relaxed text-fog">
              Levels, loot and drop chances are Classic’s (patch 1.12, from VMaNGOS): Forever may have changed them.{' '}
              <a href={`https://www.wowhead.com/forever/npc=${id}`} className="text-mist underline-offset-2 hover:text-vellum hover:underline" rel="noreferrer" target="_blank">
                See it on Wowhead
              </a>
              .
            </p>
          </aside>
        </div>
      </Container>
    </>
  );
}
