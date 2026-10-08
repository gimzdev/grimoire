'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { PRESETS } from '@/lib/gear';
import { QUALITY_COLOR, TERRITORY } from '@/lib/wow';
import { WowIcon } from './icon';
import { Badge } from './ui';

type ClassLite = { slug: string; name: string; color: string; icon: string };
type QuestLite = { i: number; n: string; l: number; r: number; ch: 'n' | 'u' | 'x' | 'c'; group: boolean; giver: { kind: 'n' | 'o' | 'i'; id: number; name: string } | null };
interface RouteData {
  level: number;
  notes: { lo: number; hi: number; note: string }[];
  zones: { id: number; name: string; lo: number; hi: number; approx: boolean; territory: number; isNew: boolean; note: string | null }[];
  quests: { zone: number; name: string; total: number; list: QuestLite[] }[];
  questRange: [number, number];
  classQuests: QuestLite[];
  dungeons: { slug: string; name: string; levels: [number, number]; isNew: boolean; status: string; location: string }[];
  talentPoints: number;
  talentPointsTalented: number;
  trainer: { level: number; spells: { id: number; name: string; icon: string; rank?: string }[] }[];
  gear: { slot: string; item: { i: number; n: string; q: number; ic?: string; r: number; l: number; score: number } }[];
}

const SLOT_NAME: Record<string, string> = {
  head: 'Head', neck: 'Neck', shoulder: 'Shoulder', back: 'Back', chest: 'Chest', wrist: 'Wrist', hands: 'Hands', waist: 'Waist', legs: 'Legs', feet: 'Feet',
  finger1: 'Finger', finger2: 'Finger', trinket1: 'Trinket', trinket2: 'Trinket', mainhand: 'Main Hand', offhand: 'Off Hand', ranged: 'Ranged',
};
const TERRITORY_TONE = ['alliance', 'horde', 'neutral', 'good', 'removed'] as const;

function Giver({ g }: { g: QuestLite['giver'] }) {
  if (!g) return <span className="text-fog">Giver not recorded yet</span>;
  if (g.kind === 'n')
    return (
      <Link href={`/npcs/${g.id}`} data-tip={`npc:${g.id}`} className="hover:text-vellum">
        {g.name}
      </Link>
    );
  if (g.kind === 'i')
    return (
      <Link href={`/items/${g.id}`} data-tip={`item:${g.id}`} className="hover:text-vellum">
        {g.name}
      </Link>
    );
  return <span>{g.name}</span>;
}

function QuestRow({ q }: { q: QuestLite }) {
  return (
    <li className="grid grid-cols-[2rem_minmax(0,1fr)] items-baseline gap-x-2 py-[7px] sm:grid-cols-[2rem_minmax(0,1fr)_minmax(0,13rem)]">
      <span className="num text-[14px] text-mist">{q.l > 0 ? q.l : ''}</span>
      <span className="min-w-0">
        <Link href={`/quests/${q.i}`} data-tip={`quest:${q.i}`} className="text-[15.5px] text-gilt-bright hover:underline hover:underline-offset-2">
          {q.n}
        </Link>
        {q.group && (
          <Badge tone="gilt" className="ml-2 align-[1px]">
            Group
          </Badge>
        )}
        {q.ch === 'n' && (
          <Badge tone="new" className="ml-2 align-[1px]">
            New
          </Badge>
        )}
        <span className="block truncate text-[13.5px] text-mist sm:hidden">
          <Giver g={q.giver} />
        </span>
      </span>
      <span className="hidden truncate text-right text-[14px] text-mist sm:block">
        <Giver g={q.giver} />
      </span>
    </li>
  );
}

export function LevelingRoute({ classes }: { classes: ClassLite[] }) {
  const [faction, setFaction] = useState<'alliance' | 'horde'>('alliance');
  const [cls, setCls] = useState('warrior');
  const [spec, setSpec] = useState('arms');
  const [level, setLevel] = useState(20);
  const [data, setData] = useState<RouteData | null>(null);
  const [loading, setLoading] = useState(true);
  const booted = useRef(false);

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const c = p.get('class');
    if (c && PRESETS[c]) {
      setCls(c);
      setSpec(PRESETS[c][0].key);
    }
    if (p.get('faction') === 'horde') setFaction('horde');
    const l = Number(p.get('lvl'));
    if (l >= 1 && l <= 60) setLevel(l);
    booted.current = true;
  }, []);

  useEffect(() => {
    const ctrl = new AbortController();
    setLoading(true);
    const t = setTimeout(() => {
      fetch(`/api/route?lvl=${level}&faction=${faction}&class=${cls}&spec=${spec}`, { signal: ctrl.signal })
        .then((r) => r.json())
        .then((d: RouteData) => setData(d))
        .catch(() => undefined)
        .finally(() => setLoading(false));
      if (booted.current) window.history.replaceState(null, '', `${window.location.pathname}?faction=${faction}&class=${cls}&lvl=${level}`);
    }, 220);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [level, faction, cls, spec]);

  const c = classes.find((x) => x.slug === cls) ?? classes[0];
  const upgrades = data?.gear.filter((g) => g.item.r >= level - 4 && g.item.r > 1) ?? [];
  const nextTalentLevel = level < 10 ? 10 : level < 60 ? level + 1 : null;
  const questTotal = data?.quests.reduce((n, g) => n + g.total, 0) ?? 0;

  return (
    <div className="space-y-6">
      <div className="frame flex flex-wrap items-end gap-x-8 gap-y-4 p-4 sm:p-5">
        <div>
          <div className="text-[13.5px] text-mist">Faction</div>
          <div className="mt-1.5 flex gap-1.5">
            {(['alliance', 'horde'] as const).map((f) => (
              <button
                key={f}
                type="button"
                aria-pressed={faction === f}
                onClick={() => setFaction(f)}
                className={`h-10 rounded-full border px-4 text-[15px] capitalize transition-colors ${faction === f ? (f === 'alliance' ? 'border-alliance/60 bg-alliance/15 text-[#a9c8f5]' : 'border-horde/60 bg-horde/15 text-[#f5a196]') : 'border-iron/70 bg-abyss/50 text-parch hover:border-ash'}`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>
        <div>
          <div className="text-[13.5px] text-mist">Class</div>
          <div className="mt-1.5 flex flex-wrap gap-1" role="radiogroup" aria-label="Class">
            {classes.map((x) => (
              <button
                key={x.slug}
                type="button"
                role="radio"
                aria-checked={x.slug === cls}
                aria-label={x.name}
                title={x.name}
                onClick={() => {
                  setCls(x.slug);
                  setSpec(PRESETS[x.slug][0].key);
                }}
                className={`rounded-xl p-[3px] transition-opacity ${x.slug === cls ? 'bg-gilt/15 shadow-[0_0_0_1.5px_var(--color-gilt)]' : 'opacity-55 hover:opacity-100'}`}
              >
                <WowIcon icon={x.icon} size={32} name={x.name} />
              </button>
            ))}
          </div>
        </div>
        <label className="min-w-[240px] flex-1">
          <span className="flex justify-between text-[13.5px] text-mist">
            <span>Your level</span>
            <span className="num text-[15px] font-semibold text-vellum">{level}</span>
          </span>
          <input type="range" min={1} max={60} value={level} onChange={(e) => setLevel(Number(e.target.value))} className="mt-2.5 w-full accent-[var(--color-gilt)]" />
        </label>
      </div>

      <div className={`grid gap-6 transition-opacity lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] ${loading ? 'opacity-60' : ''}`} aria-busy={loading}>
        <div className="space-y-6">
          <section className="frame p-5 sm:p-6">
            <h2 className="font-display text-[1.45rem] text-vellum">Where to quest at {level}</h2>
            {data?.notes.map((n) => (
              <p key={n.lo} className="mt-2 text-[15.5px] leading-relaxed text-parch">
                <span className="num text-gilt-bright">
                  {n.lo} to {n.hi}:
                </span>{' '}
                {n.note}
              </p>
            ))}
            <ul className="mt-4 grid gap-2 sm:grid-cols-2">
              {data?.zones.map((z) => (
                <li key={z.id}>
                  <Link href={`/world/${z.id}`} className="well flex h-full flex-col px-3.5 py-3 transition-colors hover:bg-[rgb(52_43_33/0.7)]">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="font-display text-[1.15rem] text-vellum">{z.name}</span>
                      {z.isNew && <Badge tone="new">New</Badge>}
                    </span>
                    <span className="mt-1 flex flex-wrap items-center gap-2 text-[13.5px] text-mist">
                      {z.lo > 0 && (
                        <span className="num">
                          {z.approx ? 'about ' : ''}
                          {z.lo} to {z.hi}
                        </span>
                      )}
                      <Badge tone={TERRITORY_TONE[z.territory] ?? 'neutral'}>{TERRITORY[z.territory] ?? 'Zone'}</Badge>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          <section className="frame p-5 sm:p-6">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <h2 className="font-display text-[1.45rem] text-vellum">Quests to pick up</h2>
              {data && (
                <span className="num text-[14px] text-mist">
                  {questTotal} {questTotal === 1 ? 'quest' : 'quests'}, level {data.questRange[0]} to {data.questRange[1]}
                </span>
              )}
            </div>
            <p className="mt-1 text-[14.5px] text-mist">Quests in these zones that you can accept right now, lowest first. Hover one for its objectives and rewards.</p>
            {data && data.quests.length === 0 && <p className="mt-4 text-parch">No zone quests sit right at this level for your faction. Try a level or two higher, or look at the dungeons below.</p>}
            {data?.quests.map((g) => (
              <div key={g.zone} className="mt-5">
                <div className="flex items-baseline justify-between gap-3 border-b border-iron/60 pb-1.5">
                  <Link href={`/world/${g.zone}`} className="font-display text-[1.12rem] text-vellum hover:text-gilt-bright">
                    {g.name}
                  </Link>
                  {g.total > g.list.length && (
                    <Link href={`/quests?zone=${g.zone}&min=${data.questRange[0]}&max=${data.questRange[1]}&side=${faction}`} className="text-[14px] text-gilt hover:text-gilt-bright">
                      All {g.total}
                    </Link>
                  )}
                </div>
                <ul className="divide-y divide-iron/35">
                  {g.list.map((q) => (
                    <QuestRow key={q.i} q={q} />
                  ))}
                </ul>
              </div>
            ))}
          </section>

          <section className="frame p-5 sm:p-6">
            <h2 className="font-display text-[1.45rem] text-vellum">Dungeons around your level</h2>
            {data && data.dungeons.length === 0 && <p className="mt-2 text-mist">No dungeons sit at this level. The first ones open around 13.</p>}
            <ul className="mt-3 divide-y divide-iron/50">
              {data?.dungeons.map((d) => (
                <li key={d.slug} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2.5">
                  <span className="flex flex-wrap items-center gap-2">
                    <Link href={`/dungeons/${d.slug}`} className="font-display text-[1.12rem] text-vellum hover:text-gilt-bright">
                      {d.name}
                    </Link>
                    {d.isNew && <Badge tone="new">New</Badge>}
                    {d.status === 'announced' && <Badge tone="neutral">Opens later</Badge>}
                  </span>
                  <span className="num text-[14px] text-mist">
                    {d.levels[0]} to {d.levels[1]}, {d.location}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <div className="space-y-6">
          <section className="frame p-5 sm:p-6">
            <h2 className="font-display text-[1.45rem]" style={{ color: c.color }}>
              {c.name} at level {level}
            </h2>
            <dl className="mt-3 grid grid-cols-2 gap-2">
              <div className="well px-3.5 py-2.5">
                <dt className="text-[12.5px] text-fog">Talent points</dt>
                <dd className="num text-[1.35rem] font-semibold text-vellum">{data?.talentPoints ?? '--'}</dd>
              </div>
              <div className="well px-3.5 py-2.5">
                <dt className="text-[12.5px] text-fog">With the Talented perk</dt>
                <dd className="num text-[1.35rem] font-semibold text-leaf-bright">{data?.talentPointsTalented ?? '--'}</dd>
              </div>
            </dl>
            {nextTalentLevel && <p className="mt-2 text-[14px] text-mist">Your next talent point comes at level {nextTalentLevel}.</p>}
            <Link href={`/talents/${cls}`} className="mt-2 inline-block text-[15px] text-gilt hover:text-gilt-bright">
              Plan your talents
            </Link>
            {data?.trainer.map((t) => (
              <div key={t.level} className="mt-4">
                <div className="text-[14px] text-mist">{t.level === level ? 'At your trainer now' : `Next at your trainer, level ${t.level}`}</div>
                <ul className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1.5">
                  {t.spells.map((s) => (
                    <li key={s.id}>
                      <span data-tip={`spell:${s.id}`} tabIndex={0} className="inline-flex cursor-help items-center gap-1.5 text-[14.5px] text-gilt-bright">
                        <WowIcon icon={s.icon} size={22} name={s.name} />
                        {s.name}
                        {s.rank && <span className="text-[12.5px] text-fog">{s.rank}</span>}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            {data && data.classQuests.length > 0 && (
              <div className="mt-5">
                <div className="text-[14px] text-mist">{c.name} quests around now</div>
                <ul className="mt-0.5 divide-y divide-iron/35">
                  {data.classQuests.map((q) => (
                    <QuestRow key={q.i} q={q} />
                  ))}
                </ul>
              </div>
            )}
          </section>

          <section className="frame p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-display text-[1.45rem] text-vellum">Upgrades to look for</h2>
              <select value={spec} onChange={(e) => setSpec(e.target.value)} className="field !h-9 !w-auto !text-[14px]" aria-label="Spec">
                {(PRESETS[cls] ?? []).map((p) => (
                  <option key={p.key} value={p.key}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
            <p className="mt-1 text-[14px] text-mist">The best items you can wear that unlock between level {Math.max(1, level - 4)} and {level}.</p>
            {data && upgrades.length === 0 && <p className="mt-3 text-mist">Nothing new in this window; open the gear planner to see your whole set.</p>}
            <ul className="mt-3 space-y-2">
              {upgrades.map((g) => (
                <li key={g.slot} className="flex items-center gap-3">
                  <Link href={`/items/${g.item.i}`} data-tip={`item:${g.item.i}`} className="flex min-w-0 flex-1 items-center gap-2.5">
                    <WowIcon icon={g.item.ic} size={30} quality={g.item.q} name={g.item.n} />
                    <span className="min-w-0">
                      <span className="block truncate text-[15px] font-medium" style={{ color: QUALITY_COLOR[g.item.q] }}>
                        {g.item.n}
                      </span>
                      <span className="block text-[12.5px] text-fog">
                        {SLOT_NAME[g.slot]}, level {g.item.r}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
            <Link href={`/tools/gear?class=${cls}&spec=${spec}&lvl=${level}`} className="mt-4 inline-block text-[15px] text-gilt hover:text-gilt-bright">
              Open the full set in the gear planner
            </Link>
          </section>
        </div>
      </div>
    </div>
  );
}
