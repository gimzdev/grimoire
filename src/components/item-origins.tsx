import Link from 'next/link';
import { getDrops, getItemQuestIndex, getNpc, getQuest, getVendors } from '@/lib/data';
import { categoryName } from '@/lib/quests';
import type { DropSource, Quest } from '@/lib/types';
import { chance, ChanceBar, EntityLink, ItemRefLink, QuestLink } from './world-links';

const KIND_LABEL: Record<DropSource[0], string> = { n: 'Dropped by', o: 'Contained in', i: 'Found inside', p: 'Pickpocketed from', s: 'Skinned from', f: 'Fished in' };

function Source({ s }: { s: DropSource }) {
  const [kind, id] = s;
  if (kind === 'f') return <span className="text-parch">Fishing in {categoryName(id)}</span>;
  if (kind === 'i') return <ItemRefLink id={id} size={22} />;
  if (kind === 'o') return <EntityLink kind="o" id={id} />;
  return <EntityLink kind="n" id={id} />;
}

function where(s: DropSource) {
  const [kind, id] = s;
  if (kind === 'n' || kind === 'p' || kind === 's') {
    const n = getNpc(id);
    if (!n) return null;
    return { zone: n[6] ? categoryName(n[6]) : null, zoneId: n[6], lv: n[2] <= 0 ? null : n[2] === n[3] ? `${n[2]}` : `${n[2]} to ${n[3]}` };
  }
  return null;
}

/** Drop chances, vendors and quests for any item. */
export function ItemOrigins({ id }: { id: number }) {
  const drops = getDrops(id);
  const vendors = getVendors(id);
  const quests = getItemQuestIndex().get(id);
  const list = (ids: number[]) => ids.map((q) => getQuest(q)).filter((q): q is Quest => Boolean(q));
  const rewards = quests ? list([...quests.reward, ...quests.choice]) : [];
  const objective = quests ? list(quests.objective) : [];
  const starts = quests ? list(quests.starts) : [];
  if (!drops && !vendors.length && !rewards.length && !objective.length && !starts.length) return null;
  const shown = drops?.s ?? [];
  const kinds = [...new Set(shown.map((s) => s[0]))];
  return (
    <div className="space-y-8">
      {drops && (
        <section>
          <h2 className="text-[1.45rem] text-vellum">Drop chances</h2>
          <p className="mt-1 text-[14.5px] text-mist">
            {drops.t > shown.length ? `The ${shown.length} best of ${drops.t.toLocaleString('en-US')} sources. ` : ''}
            {shown.every((s) => s[4]) ? 'Chance per kill, from early Forever kills.' : 'Chance per kill or per loot.'}
            {shown.some((s) => s[3]) ? ' Green drops only while you are on the quest.' : ''}
          </p>
          {kinds.map((k) => (
            <div key={k} className="mt-4">
              {kinds.length > 1 && <div className="px-2 text-[14px] font-semibold text-gilt">{KIND_LABEL[k]}</div>}
              <ul className="mt-2">
                {shown
                  .filter((s) => s[0] === k)
                  .map((s) => {
                    const w = where(s);
                    return (
                      <li key={`${s[0]}${s[1]}`} className="grid grid-cols-[minmax(0,1fr)_96px] items-center gap-4 rounded-xl px-2 py-2.5 transition-colors hover:bg-white/[0.03] sm:grid-cols-[minmax(0,1fr)_190px_104px] [&+&]:border-t [&+&]:border-white/[0.05]">
                        <div className="min-w-0 text-[15.5px]">
                          <Source s={s} />
                          {w?.lv && <span className="num ml-2 text-[13.5px] text-fog">level {w.lv}</span>}
                        </div>
                        <div className="hidden truncate text-[14.5px] text-mist sm:block">
                          {w?.zone ? (
                            w.zoneId > 0 ? (
                              <Link href={`/world/${w.zoneId}`} className="hover:text-vellum">
                                {w.zone}
                              </Link>
                            ) : (
                              w.zone
                            )
                          ) : null}
                        </div>
                        <div className="text-right">
                          <span className={`num block text-[15px] font-semibold ${s[3] ? 'text-leaf-bright' : 'text-vellum'}`}>{chance(s[2])}</span>
                          <ChanceBar pct={s[2]} quest={Boolean(s[3])} />
                        </div>
                      </li>
                    );
                  })}
              </ul>
            </div>
          ))}
        </section>
      )}
      {vendors.length > 0 && (
        <section>
          <h2 className="text-[1.45rem] text-vellum">Sold by</h2>
          <ul className="mt-3 grid gap-x-6 gap-y-1.5 text-[15.5px] sm:grid-cols-2">
            {vendors.map((v) => (
              <li key={v}>
                <EntityLink kind="n" id={v} zone />
              </li>
            ))}
          </ul>
        </section>
      )}
      {(rewards.length > 0 || objective.length > 0 || starts.length > 0) && (
        <section>
          <h2 className="text-[1.45rem] text-vellum">Quests</h2>
          <dl className="mt-3 space-y-3 text-[15.5px]">
            {starts.length > 0 && (
              <div>
                <dt className="text-[14px] text-mist">Starts</dt>
                <dd>
                  {starts.map((q) => (
                    <QuestLink key={q.i} quest={q} level className="mr-4" />
                  ))}
                </dd>
              </div>
            )}
            {rewards.length > 0 && (
              <div>
                <dt className="text-[14px] text-mist">Reward from</dt>
                <dd className="space-y-1">
                  {rewards.map((q) => (
                    <div key={q.i}>
                      <QuestLink quest={q} level />
                    </div>
                  ))}
                </dd>
              </div>
            )}
            {objective.length > 0 && (
              <div>
                <dt className="text-[14px] text-mist">Needed for</dt>
                <dd className="space-y-1">
                  {objective.slice(0, 20).map((q) => (
                    <div key={q.i}>
                      <QuestLink quest={q} level />
                    </div>
                  ))}
                </dd>
              </div>
            )}
          </dl>
        </section>
      )}
    </div>
  );
}

