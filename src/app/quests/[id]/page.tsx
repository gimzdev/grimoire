import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { DetailHead } from '@/components/detail-head';
import { WowIcon } from '@/components/icon';
import { Money } from '@/components/tooltips';
import { Badge, Container } from '@/components/ui';
import { chance, EntityLink, ItemRefLink, QuestLink, SideMark } from '@/components/world-links';
import { ZONE_ART } from '@/lib/art';
import { artThumb } from '@/lib/art-server';
import { getClasses, getDrops, getFactions, getItem, getMinorItem, getQuest, getQuestChain, getQuests, getSpellIndex, placeHref } from '@/lib/data';
import { categoryName, CHANGE_LABEL, entityRef, groupName, questClasses, questText, SKILL_NAME, typeLabel } from '@/lib/quests';
import type { Quest, QuestReq } from '@/lib/types';
import { iconUrl } from '@/lib/wow';

export const revalidate = false;
export const dynamicParams = true;

export function generateStaticParams() {
  // The most visited quests are built ahead of time; the rest render on first request.
  return [...getQuests()]
    .sort((a, b) => (b.pop ?? 0) - (a.pop ?? 0))
    .slice(0, 60)
    .map((q) => ({ id: String(q.i) }));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const q = getQuest(Number(id));
  if (!q) return {};
  const where = categoryName(q.z);
  const desc = `${q.n}: ${q.l > 0 ? `a level ${q.l} quest` : 'a quest'} in ${where}${q.r ? `, requires level ${q.r}` : ''}. ${q.o ?? ''}`.trim();
  return { title: `${q.n} (quest)`, description: desc.slice(0, 160), alternates: { canonical: `/quests/${q.i}` } };
}

function Paragraphs({ text, className = '' }: { text: string; className?: string }) {
  return (
    <div className={`space-y-3 font-serif text-[18px] leading-[1.7] text-parch ${className}`}>
      {questText(text)
        .split(/\n{2,}/)
        .map((p, i) => (
          <p key={i} className="whitespace-pre-line">
            {p}
          </p>
        ))}
    </div>
  );
}

/** Small marks for objective rows: crossed blades for a kill, a spark for anything you use or do. */
function ObjMark({ kind }: { kind: 'kill' | 'use' }) {
  return (
    <span className="inline-grid size-[26px] shrink-0 place-items-center rounded-lg bg-dusk text-gilt" aria-hidden>
      {kind === 'kill' ? (
        <svg viewBox="0 0 16 16" className="size-[15px]" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
          <path d="M3 3l7.5 7.5M13 3L5.5 10.5M9.5 12.5l2-2 2 2-2 2zM6.5 12.5l-2-2-2 2 2 2z" />
        </svg>
      ) : (
        <svg viewBox="0 0 16 16" className="size-[15px]" fill="currentColor">
          <path d="M8 1.5l1.3 4.2L13.5 7 9.3 8.3 8 12.5 6.7 8.3 2.5 7l4.2-1.3z" />
        </svg>
      )}
    </span>
  );
}

function Requirement({ r }: { r: QuestReq }) {
  const [kind, id, text, count] = r;
  const qty = count > 1 ? <span className="num text-mist"> x{count}</span> : null;
  if (kind === 'i' && id) {
    const drops = getDrops(id);
    const best = drops?.s.filter((s) => s[0] === 'n' || s[0] === 'o').slice(0, 3) ?? [];
    return (
      <li className="py-2.5">
        <div className="flex flex-wrap items-center gap-x-2">
          <ItemRefLink id={id} size={26} />
          {qty}
        </div>
        {best.length > 0 && (
          <div className="mt-1 pl-[34px] text-[14.5px] text-mist">
            Drops from{' '}
            {best.map(([k, sid, pct], i) => (
              <span key={`${k}${sid}`}>
                {i > 0 && ', '}
                <EntityLink kind={k as 'n' | 'o'} id={sid} /> <span className="num text-parch">{chance(pct)}</span>
              </span>
            ))}
            {drops && drops.t > best.length && <span> and {drops.t - best.length} more</span>}
          </div>
        )}
      </li>
    );
  }
  if ((kind === 'n' || kind === 'o') && id) {
    const e = entityRef(kind, id);
    return (
      <li className="flex flex-wrap items-center gap-x-2 py-2.5">
        <ObjMark kind={kind === 'n' ? 'kill' : 'use'} />
        {text ? <span className="text-parch">{questText(text)}</span> : null}
        {!text && (
          <span>
            <EntityLink kind={kind} id={id} /> <span className="text-mist">{kind === 'n' ? 'slain' : 'used'}</span>
          </span>
        )}
        {text && e && <span className="text-[14.5px] text-mist">({e.name})</span>}
        {qty}
      </li>
    );
  }
  if (kind === 'r' && id) {
    const f = getFactions()[String(id)];
    return (
      <li className="py-2.5 text-parch">
        Reach {count >= 21000 ? 'Exalted' : count >= 9000 ? 'Revered' : count >= 3000 ? 'Honored' : 'Friendly'} with {f?.n ?? 'a faction'}
      </li>
    );
  }
  return (
    <li className="flex items-center gap-2 py-2.5 text-parch">
      <ObjMark kind="use" />
      {questText(text ?? '')}
      {qty}
    </li>
  );
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2">
      <dt className="text-[14.5px] text-mist">{label}</dt>
      <dd className="text-right text-[15.5px] text-vellum">{children}</dd>
    </div>
  );
}

/** What the quest gives, in a frosted card on the art: items to choose from or receive, experience and money. */
function RewardCard({ q }: { q: Quest }) {
  if (!q.ic?.length && !q.ir?.length && !q.xp && !q.m) return null;
  return (
    <div className="w-[340px] max-w-full rounded-[20px] border border-white/[0.12] bg-[rgb(12_13_17/0.6)] p-5 shadow-[0_30px_60px_-30px_rgb(0_0_0/0.8)] backdrop-blur-xl backdrop-saturate-150">
      {q.ic && q.ic.length > 0 && (
        <>
          <div className="text-[14px] font-medium text-mist">Choose one</div>
          <ul className="mt-2.5 space-y-2">
            {q.ic.map(([id, n]) => (
              <li key={id}>
                <ItemRefLink id={id} count={n} size={34} className="text-[15.5px]" />
              </li>
            ))}
          </ul>
        </>
      )}
      {q.ir && q.ir.length > 0 && (
        <>
          <div className={`text-[14px] font-medium text-mist ${q.ic?.length ? 'mt-4' : ''}`}>{q.ic?.length ? 'You also receive' : 'You receive'}</div>
          <ul className="mt-2.5 space-y-2">
            {q.ir.map(([id, n]) => (
              <li key={id}>
                <ItemRefLink id={id} count={n} size={34} className="text-[15.5px]" />
              </li>
            ))}
          </ul>
        </>
      )}
      {(q.xp || q.m) && (
        <div className={`flex flex-wrap items-center gap-x-5 gap-y-1 text-[15px] text-parch ${q.ic?.length || q.ir?.length ? 'mt-4 border-t border-white/10 pt-4' : ''}`}>
          {q.xp ? (
            <span>
              <span className="num font-semibold text-vellum">{q.xp.toLocaleString('en-US')}</span> experience
            </span>
          ) : null}
          {q.m ? <Money copper={q.m} /> : null}
        </div>
      )}
    </div>
  );
}

function Rewards({ q }: { q: Quest }) {
  const factions = getFactions();
  const spell = q.sp ? getSpellIndex().get(q.sp) : undefined;
  // Wowhead lists a faction at 0 when a quest only needs a standing with it; that is not a reward.
  const rep = (q.rp ?? []).filter(([, v]) => v !== 0);
  if (!rep.length && !spell) return null;
  return (
    <section className="mt-10">
      <h2 className="text-[1.6rem] text-vellum">Also rewards</h2>
      {spell && (
        <p className="mt-4 text-[15.5px] text-parch">
          You will learn <span className="text-gilt-bright">{spell.name}</span>.
        </p>
      )}
      <dl className="mt-5 flex flex-wrap gap-x-10 gap-y-3">
        {rep.length > 0 && (
          <div>
            <dt className="text-[14px] text-mist">Reputation</dt>
            <dd className="text-[15.5px] text-vellum">
              {rep.map(([f, v]) => (
                <span key={f} className="block">
                  <span className={`num ${v < 0 ? 'text-[#f5a196]' : 'text-leaf-bright'}`}>{v > 0 ? `+${v}` : v}</span> {factions[String(f)]?.n ?? `Faction ${f}`}
                </span>
              ))}
            </dd>
          </div>
        )}
      </dl>
    </section>
  );
}

export default async function QuestPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const q = getQuest(Number(id));
  if (!q) notFound();
  const chain = getQuestChain(q.i);
  const zone = categoryName(q.z);
  const kind = typeLabel(q);
  const change = CHANGE_LABEL[q.ch];
  const classes = questClasses(q.rc);
  const prev = q.pv && q.pv > 0 ? getQuest(q.pv) : undefined;
  const zoneHref = placeHref(q.z);
  const classIcon = classes.length === 1 ? getClasses().find((c) => c.name === classes[0])?.icon : undefined;
  const headIcon = classIcon ?? (q.ty === 81 ? 'achievement_dungeon_classicdungeonmaster' : q.ty === 62 ? 'inv_misc_head_dragon_01' : q.ty === 41 ? 'inv_banner_02' : 'inv_misc_note_01');
  const reward = q.ic?.[0]?.[0] ?? q.ir?.[0]?.[0];
  const rewardIcon = reward ? (getItem(reward)?.ic ?? getMinorItem(reward)?.[2]) : undefined;
  return (
    <>
      <DetailHead
        crumbs={[
          ['Quests', '/quests'],
          [zone, `/quests?zone=${q.z}`],
        ]}
        icon={<WowIcon icon={headIcon} size={72} name={q.n} eager />}
        title={q.n}
        titleColor="var(--color-gilt-bright)"
        meta={
          <>
            {q.l > 0 ? (
              <>
                Level <span className="num text-vellum">{q.l}</span>
                {q.r ? (
                  <>
                    , requires level <span className="num text-vellum">{q.r}</span>
                  </>
                ) : null}
                {kind ? `, ${kind.toLowerCase()} quest` : ''} in{' '}
              </>
            ) : (
              <>{kind ? `${kind} quest` : 'A quest'} in </>
            )}
            {zoneHref ? (
              <Link href={zoneHref} className="text-vellum underline decoration-white/25 underline-offset-4 hover:decoration-white/60">
                {zone}
              </Link>
            ) : (
              zone
            )}
            , for <SideMark side={q.s} />
            {classes.length > 0 && <> {classes.join(' and ')}s</>}
          </>
        }
        badges={change ? <Badge tone={q.ch === 'n' ? 'new' : q.ch === 'u' ? 'changed' : 'neutral'}>{change}</Badge> : undefined}
        wash={ZONE_ART[q.z] ? artThumb(ZONE_ART[q.z]) : iconUrl(rewardIcon ?? headIcon)}
        aside={<RewardCard q={q} />}
      />
      <Container className="pb-8">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_340px]">
          <article className="min-w-0 max-w-[780px]">
            {q.cl && q.cl.length > 0 && (
              <div className="mb-8 rounded-2xl border border-leaf/25 bg-leaf/[0.06] px-5 py-4">
                <div className="text-[15px] font-semibold text-leaf-bright">{q.ch === 'n' ? 'New in Forever' : 'What Forever changed'}</div>
                <ul className="mt-2 space-y-1 text-[15.5px] text-parch">
                  {q.cl.map((l) => (
                    <li key={l}>{l}</li>
                  ))}
                </ul>
              </div>
            )}

            <section>
              <h2 className="text-[1.6rem] text-vellum">Objectives</h2>
              {q.o ? <Paragraphs text={q.o} className="mt-3" /> : <p className="mt-3 text-parch">Speak to the quest giver to complete it.</p>}
              {q.rq && q.rq.length > 0 && (
                <ul className="mt-4 divide-y divide-iron/60 border-y border-iron/60">
                  {q.rq.map((r, i) => (
                    <Requirement key={i} r={r} />
                  ))}
                </ul>
              )}
              {q.pi && (
                <p className="mt-4 text-[15.5px] text-mist">
                  Provided: <ItemRefLink id={q.pi} />
                </p>
              )}
            </section>

            {q.d && (
              <section className="mt-10">
                <h2 className="text-[1.6rem] text-vellum">Description</h2>
                <Paragraphs text={q.d} className="mt-3" />
              </section>
            )}
            {!q.d && q.ch === 'u' && <p className="mt-10 text-[15.5px] text-mist">Forever rewrote this quest’s story text, so the Classic version is not shown here.</p>}

            {(q.pg || q.cp) && (
              <section className="mt-8 space-y-3">
                {q.pg && (
                  <details className="group rounded-2xl bg-slate/70 px-5 py-3 open:pb-5">
                    <summary className="cursor-pointer list-none text-[16px] text-gilt-bright marker:hidden">
                      <span className="mr-2 inline-block transition-transform group-open:rotate-90" aria-hidden>
                        <svg viewBox="0 0 12 12" className="size-3" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="m4.5 2.5 3.5 3.5-3.5 3.5" /></svg>
                      </span>
                      Progress
                    </summary>
                    <Paragraphs text={q.pg} className="mt-3" />
                  </details>
                )}
                {q.cp && (
                  <details className="group rounded-2xl bg-slate/70 px-5 py-3 open:pb-5">
                    <summary className="cursor-pointer list-none text-[16px] text-gilt-bright marker:hidden">
                      <span className="mr-2 inline-block transition-transform group-open:rotate-90" aria-hidden>
                        <svg viewBox="0 0 12 12" className="size-3" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="m4.5 2.5 3.5 3.5-3.5 3.5" /></svg>
                      </span>
                      Completion
                    </summary>
                    <Paragraphs text={q.cp} className="mt-3" />
                  </details>
                )}
              </section>
            )}

            <Rewards q={q} />
          </article>

          <aside className="space-y-6">
            <div className="frame p-5">
              <h2 className="text-[1.05rem] font-semibold tracking-[-0.01em] text-vellum">Quick facts</h2>
              <dl className="mt-2 divide-y divide-iron/50">
                {q.l > 0 && <Fact label="Level">{q.l}</Fact>}
                {q.r ? <Fact label="Requires level">{q.r}</Fact> : null}
                <Fact label="Side">
                  <SideMark side={q.s} />
                </Fact>
                <Fact label="Category">{groupName(q)}</Fact>
                {kind && <Fact label="Type">{kind}</Fact>}
                {classes.length > 0 && <Fact label="Class">{classes.join(', ')}</Fact>}
                {q.sk && <Fact label="Profession">{`${SKILL_NAME[q.sk[0]] ?? 'Skill'}${q.sk[1] ? ` (${q.sk[1]})` : ''}`}</Fact>}
                {q.rep && <Fact label="Repeatable">Yes</Fact>}
                {q.tl ? <Fact label="Timer">{`${Math.round(q.tl / 60)} minutes`}</Fact> : null}
              </dl>
              <div className="mt-4 space-y-3 text-[15.5px]">
                <div>
                  <div className="text-[14px] text-mist">Starts with</div>
                  {q.st?.length ? (
                    q.st.map(([k, eid]) => (
                      <div key={`${k}${eid}`} className="mt-0.5">
                        <EntityLink kind={k} id={eid} zone />
                      </div>
                    ))
                  ) : (
                    <div className="mt-0.5 text-parch">{q.ch === 'c' ? 'Not recorded' : 'Not recorded yet'}</div>
                  )}
                </div>
                <div>
                  <div className="text-[14px] text-mist">Turn in to</div>
                  {q.en?.length ? (
                    q.en.map(([k, eid]) => (
                      <div key={`${k}${eid}`} className="mt-0.5">
                        <EntityLink kind={k} id={eid} zone />
                      </div>
                    ))
                  ) : (
                    <div className="mt-0.5 text-parch">{q.ch === 'c' ? 'Not recorded' : 'Not recorded yet'}</div>
                  )}
                </div>
              </div>
            </div>

            {chain.length > 1 && (
              <div className="frame p-5">
                <h2 className="text-[1.05rem] font-semibold tracking-[-0.01em] text-vellum">Quest chain</h2>
                <ol className="mt-3 space-y-1.5">
                  {chain.map((c, i) => (
                    <li key={c.i} className="flex gap-3 text-[15.5px]">
                      <span className="num w-5 shrink-0 text-right text-mist">{i + 1}.</span>
                      {c.i === q.i ? <span className="font-semibold text-vellum">{c.n}</span> : <QuestLink quest={c} />}
                    </li>
                  ))}
                </ol>
              </div>
            )}
            {prev && !chain.some((c) => c.i === prev.i) && (
              <div className="frame p-5">
                <h2 className="text-[1.05rem] font-semibold tracking-[-0.01em] text-vellum">Requires</h2>
                <div className="mt-2 text-[15.5px]">
                  <QuestLink quest={prev} level />
                </div>
              </div>
            )}

            <p className="px-1 text-[13.5px] leading-relaxed text-fog">
              {q.ch !== 'n' && 'Quest text is the Classic version; Forever may have reworded it. '}
              <a href={`https://www.wowhead.com/forever/quest=${q.i}`} className="text-mist underline-offset-2 hover:text-vellum hover:underline" rel="noreferrer" target="_blank">
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
