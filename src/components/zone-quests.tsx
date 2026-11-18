'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { bandByLevel, giverGroupsUseful, groupByGiver, norm, type QuestGroup, type ZoneQuest } from '@/lib/quest-bands';
import { Badge } from './ui';

/** Rows shown in a group before "Show more", on a wide screen and on a phone. The rest stay in the page, hidden, until asked for. */
const CAP = 24;
const CAP_PHONE = 12;

type Side = 'all' | 'alliance' | 'horde';
type Mode = 'level' | 'giver';

/** The wash and edge of the block at the top: green when the zone has new quests, gold when it only has changed ones. */
const TINT = {
  leaf: { wash: 'linear-gradient(180deg, rgb(34 50 26 / 0.42), rgb(14 16 20 / 0.96) 180px)', edge: 'rgb(156 204 116 / 0.22)', line: 'rgb(156 204 116 / 0.7)' },
  gilt: { wash: 'linear-gradient(180deg, rgb(58 44 16 / 0.42), rgb(14 16 20 / 0.96) 180px)', edge: 'rgb(242 182 64 / 0.22)', line: 'rgb(242 182 64 / 0.7)' },
};

function Giver({ by }: { by: NonNullable<ZoneQuest['by']> }) {
  const [kind, id, name] = by;
  if (kind === 'n')
    return (
      <Link href={`/npcs/${id}`} data-tip={`npc:${id}`} className="text-parch underline decoration-white/15 underline-offset-[3px] hover:text-vellum hover:decoration-gilt/60">
        {name}
      </Link>
    );
  if (kind === 'i')
    return (
      <Link href={`/items/${id}`} data-tip={`item:${id}`} className="text-parch underline decoration-white/15 underline-offset-[3px] hover:text-vellum hover:decoration-gilt/60">
        {name}
      </Link>
    );
  return <span className="text-parch">{name}</span>;
}

function Row({ q, hide, showGiver, showChange, quiet }: { q: ZoneQuest; hide: string; showGiver: boolean; showChange: boolean; quiet: number }) {
  // A zone almost all one side's would repeat the same word on every row, so that side is left unmarked.
  const mark = q.s === 1 || q.s === 2 ? (q.s === quiet ? 0 : q.s) : 0;
  return (
    <li className={`flex items-start gap-3 rounded-xl px-2 py-[7px] transition-colors hover:bg-white/[0.04] ${hide}`}>
      <span className="num mt-[3px] grid h-6 min-w-[2rem] shrink-0 place-items-center rounded-md bg-white/[0.07] px-1 text-[13px] leading-none text-parch">{q.l > 0 ? q.l : '?'}</span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <Link href={`/quests/${q.i}`} data-tip={`quest:${q.i}`} className="text-[15.5px] leading-snug text-gilt-bright hover:underline hover:underline-offset-2">
            {q.n}
          </Link>
          {showChange && q.ch === 'n' && <Badge tone="new">New</Badge>}
          {showChange && q.ch === 'u' && <Badge tone="changed">Changed</Badge>}
          {q.ch === 'x' && <Badge tone="neutral">Unconfirmed</Badge>}
          {q.t && <Badge tone="gilt">{q.t}</Badge>}
          {mark === 1 && <span className="text-[12.5px] font-semibold text-[#a9c8f5] sm:hidden">Alliance</span>}
          {mark === 2 && <span className="text-[12.5px] font-semibold text-[#f5a196] sm:hidden">Horde</span>}
        </span>
        {q.cl && (
          <span className="mt-0.5 block text-[13.5px] leading-snug text-parch/85">
            {q.cl[0]}
            {q.cl[1] > 0 && <span className="text-fog">{`, and ${q.cl[1]} more ${q.cl[1] === 1 ? 'change' : 'changes'}`}</span>}
          </span>
        )}
        {showGiver && q.by && (
          <span className="mt-0.5 block text-[13.5px] leading-snug text-mist">
            Starts with <Giver by={q.by} />
          </span>
        )}
      </span>
      {mark === 1 && <span className="mt-[3px] hidden shrink-0 text-[12.5px] font-semibold text-[#a9c8f5] sm:block">Alliance</span>}
      {mark === 2 && <span className="mt-[3px] hidden shrink-0 text-[12.5px] font-semibold text-[#f5a196] sm:block">Horde</span>}
    </li>
  );
}

const MORE = 'mt-2 ml-2 h-9 items-center rounded-full bg-white/[0.06] px-4 text-[14px] font-[560] text-parch ring-1 ring-inset ring-white/[0.08] transition-colors hover:bg-white/[0.1] hover:text-vellum';

/** A list only a few past the cap shows in full, so the button never offers "1 more". */
const limitFor = (total: number, cap: number) => (total > cap + 4 ? cap : total);

function Group({ tier, g, all, open, onOpen, showChange, quiet }: { tier: string; g: QuestGroup; all: boolean; open: boolean; onOpen: (key: string) => void; showChange: boolean; quiet: number }) {
  const key = `${tier}:${g.key}`;
  const total = g.quests.length;
  const wide = all || open ? total : limitFor(total, CAP);
  const phone = all || open ? total : limitFor(total, CAP_PHONE);
  return (
    <div>
      {g.title && (
        <div className="mb-1 flex items-baseline justify-between gap-3 border-b border-iron/60 px-2 pb-1.5">
          <h4 className="font-display text-[1.05rem] text-gilt">
            {g.giver && g.giver[0] === 'n' ? (
              <Link href={`/npcs/${g.giver[1]}`} data-tip={`npc:${g.giver[1]}`} className="hover:text-gilt-bright">
                {g.title}
              </Link>
            ) : (
              g.title
            )}
          </h4>
          <span className="num shrink-0 text-[13px] text-fog">
            {total} {total === 1 ? 'quest' : 'quests'}
          </span>
        </div>
      )}
      <ul className="grid gap-x-8 lg:grid-cols-2">
        {g.quests.map((q, i) => (
          <Row key={q.i} q={q} hide={i >= wide ? 'hidden' : i >= phone ? 'max-sm:hidden' : ''} showGiver={!(g.giver && g.giver[0] === q.by?.[0] && g.giver[1] === q.by?.[1])} showChange={showChange} quiet={quiet} />
        ))}
      </ul>
      {total > phone && (
        <button type="button" onClick={() => onOpen(key)} className={`${MORE} inline-flex sm:hidden`}>
          Show {total - phone} more
        </button>
      )}
      {total > wide && (
        <button type="button" onClick={() => onOpen(key)} className={`${MORE} hidden sm:inline-flex`}>
          Show {total - wide} more
        </button>
      )}
    </div>
  );
}

const pill = (on: boolean, tone: 'gilt' | 'alliance' | 'horde' = 'gilt') =>
  `h-10 rounded-full border px-4 text-[14.5px] transition-colors ${
    on
      ? tone === 'alliance'
        ? 'border-alliance/60 bg-alliance/15 text-[#a9c8f5]'
        : tone === 'horde'
          ? 'border-horde/60 bg-horde/15 text-[#f5a196]'
          : 'border-gilt/50 bg-gilt/15 text-gilt-bright'
      : 'border-iron/70 bg-abyss/50 text-parch hover:border-ash'
  }`;

/**
 * A zone's quests: the new and changed ones in their own block at the top, then the rest, each grouped by
 * level band (or by quest giver), with a search box and a side filter when there is enough to filter.
 */
export function ZoneQuests({ quests }: { quests: ZoneQuest[] }) {
  const [query, setQuery] = useState('');
  const [side, setSide] = useState<Side>('all');
  const [mode, setMode] = useState<Mode>('level');
  const [open, setOpen] = useState<Record<string, boolean>>({});

  const hasSides = useMemo(() => quests.some((q) => q.s === 1) && quests.some((q) => q.s === 2), [quests]);
  const canGroup = useMemo(() => quests.length >= 20 && giverGroupsUseful(quests), [quests]);
  const haystack = useMemo(() => new Map(quests.map((q) => [q.i, norm(`${q.n} ${q.by?.[2] ?? ''} ${q.cl?.[0] ?? ''}`)])), [quests]);
  const anyGiver = useMemo(() => quests.some((q) => q.by), [quests]);
  // 1 or 2 when at least nine in ten quests are for that side (Alliance or Horde), else 0.
  const quiet = useMemo(() => {
    const a = quests.filter((q) => q.s === 1).length;
    const h = quests.filter((q) => q.s === 2).length;
    return quests.length >= 10 && a >= quests.length * 0.9 ? 1 : quests.length >= 10 && h >= quests.length * 0.9 ? 2 : 0;
  }, [quests]);

  const words = norm(query).split(' ').filter(Boolean);
  const shown = quests.filter((q) => {
    if (side === 'alliance' && q.s === 2) return false;
    if (side === 'horde' && q.s === 1) return false;
    const h = haystack.get(q.i) ?? '';
    return words.every((w) => h.includes(w));
  });
  const filtered = shown.length !== quests.length;

  const fresh = shown.filter((q) => q.ch === 'n' || q.ch === 'u');
  const rest = shown.filter((q) => q.ch !== 'n' && q.ch !== 'u');
  const newCount = fresh.filter((q) => q.ch === 'n').length;
  const changedCount = fresh.length - newCount;
  const group = (list: ZoneQuest[]) => (mode === 'giver' && canGroup ? groupByGiver(list) : bandByLevel(list));
  const onOpen = (key: string) => setOpen((o) => ({ ...o, [key]: true }));
  const showAll = words.length > 0;

  const controls = quests.length >= 12 || hasSides || canGroup;
  const everyNew = rest.length === 0 && changedCount === 0 && !filtered;

  // The block's title says what its quests are. A badge on each row only helps when the block holds both kinds.
  const mixed = newCount > 0 && changedCount > 0;
  const tint = newCount ? TINT.leaf : TINT.gilt;
  const freshTitle = newCount && changedCount ? 'New and changed in Forever' : newCount ? 'New in Forever' : 'Changed from Classic';
  const freshNote = everyNew
    ? newCount === 1
      ? 'This quest is new.'
      : `All ${newCount} quests here are new.`
    : newCount && changedCount
      ? `${newCount} new, ${changedCount} changed.`
      : newCount
        ? `${newCount} ${newCount === 1 ? 'quest' : 'quests'} added for Forever.`
        : 'Each row says what changed.';

  return (
    <div>
      {controls && (
        <div className="mb-5 flex flex-wrap items-center gap-x-3 gap-y-3">
          {quests.length >= 12 && (
            <label className="relative block min-w-[220px] flex-1 sm:max-w-sm">
              <span className="sr-only">Search quests</span>
              <svg viewBox="0 0 20 20" aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 size-[18px] -translate-y-1/2 text-fog">
                <path d="m14 14 3.5 3.5M8.5 15a6.5 6.5 0 1 1 0-13 6.5 6.5 0 0 1 0 13Z" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
              </svg>
              <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={anyGiver ? 'Search quests or givers' : 'Search quests'} className="field !pl-10" autoComplete="off" />
            </label>
          )}
          {hasSides && (
            <div role="group" aria-label="Side" className="flex gap-1.5">
              {(['all', 'alliance', 'horde'] as const).map((s) => (
                <button key={s} type="button" aria-pressed={side === s} onClick={() => setSide(s)} className={pill(side === s, s === 'all' ? 'gilt' : s)}>
                  {s === 'all' ? 'Both sides' : s === 'alliance' ? 'Alliance' : 'Horde'}
                </button>
              ))}
            </div>
          )}
          {canGroup && (
            <div role="group" aria-label="Group quests" className="flex gap-1.5">
              {(['level', 'giver'] as const).map((m) => (
                <button key={m} type="button" aria-pressed={mode === m} onClick={() => setMode(m)} className={pill(mode === m)}>
                  {m === 'level' ? 'By level' : 'By giver'}
                </button>
              ))}
            </div>
          )}
          <p className="num ml-auto text-[14px] text-mist" aria-live="polite">
            {filtered ? `${shown.length} of ${quests.length} quests` : `${quests.length} quests`}
          </p>
        </div>
      )}

      <div className="space-y-5">
        {fresh.length > 0 && (
          <section className="frame relative p-4 pt-5 sm:p-5" style={{ backgroundImage: tint.wash, borderColor: tint.edge }}>
            <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${tint.line} 30%, ${tint.line} 70%, transparent)` }} />
            <header className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 px-2">
              <h3 className="text-[1.3rem] text-vellum">{freshTitle}</h3>
              <p className="text-[14.5px] text-mist">{freshNote}</p>
            </header>
            <div className="space-y-5">
              {group(fresh).map((g) => (
                <Group key={g.key} tier="new" g={g} all={showAll} open={Boolean(open[`new:${g.key}`])} onOpen={onOpen} showChange={mixed} quiet={quiet} />
              ))}
            </div>
          </section>
        )}
        {rest.length > 0 && (
          <section className="frame p-4 sm:p-5">
            {fresh.length > 0 && (
              <header className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 px-2">
                <h3 className="text-[1.3rem] text-vellum">All other quests</h3>
                <p className="text-[14.5px] text-mist">
                  {rest.length} {rest.length === 1 ? 'quest' : 'quests'} not marked new or changed.
                </p>
              </header>
            )}
            <div className="space-y-5">
              {group(rest).map((g) => (
                <Group key={g.key} tier="rest" g={g} all={showAll} open={Boolean(open[`rest:${g.key}`])} onOpen={onOpen} showChange={false} quiet={quiet} />
              ))}
            </div>
          </section>
        )}
        {shown.length === 0 && (
          <div className="frame flex flex-wrap items-center justify-between gap-3 px-5 py-5">
            <p className="text-parch">No quest matches{words.length ? ` “${query.trim()}”` : ' these filters'}.</p>
            <button
              type="button"
              onClick={() => {
                setQuery('');
                setSide('all');
              }}
              className="inline-flex h-9 items-center rounded-full bg-white/[0.06] px-4 text-[14px] font-[560] text-parch ring-1 ring-inset ring-white/[0.08] hover:bg-white/[0.1] hover:text-vellum"
            >
              Clear filters
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
