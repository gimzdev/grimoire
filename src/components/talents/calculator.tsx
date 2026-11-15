'use client';

import Link from 'next/link';
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GameText } from '@/components/game-text';
import { SaveBuild } from '@/components/save-build';
import { WowIcon } from '@/components/icon';
import {
  addBlock,
  canRemove,
  decodeBuild,
  decodeOrder,
  defaultOrder,
  encodeBuild,
  encodeOrder,
  isReachable,
  orderWithout,
  MAX_POINTS,
  ranksFromOrder,
  requiredLevel,
  treePoints,
  type Ranks,
  CODE_VERSION,
  upgradeCodes,
} from '@/lib/talents';
import { groupBuilds, roleTag, type BuildGroupKey } from '@/lib/build-groups';
import { pathAt, respecCost, respecName } from '@/lib/respec';
import type { BarSlot, Build, ClassTalents, Talent, TalentTree } from '@/lib/types';
import { iconUrl, ROLE_LABEL } from '@/lib/wow';

export interface CalcClass {
  slug: string;
  name: string;
  color: string;
  icon: string;
}

interface Props {
  cls: CalcClass;
  classes: CalcClass[];
  data: ClassTalents;
  builds: Build[];
  /** v: the code version the link was written in (src/lib/talents.ts); none means one from before versions. */
  initial: { code?: string; order?: string; v?: string; talented?: boolean; focus?: number };
  /** each Grimoire build's suggested bar 1, by build id */
  bars?: Record<string, BarSlot[]>;
}

const CELL = 50;
const GAP_X = 20;
const GAP_Y = 18;
const PAD_X = 22;
const PAD_Y = 18;
const ROWS = 7;
const COLS = 4;
const TREE_W = PAD_X * 2 + COLS * CELL + (COLS - 1) * GAP_X;
const TREE_H = PAD_Y * 2 + ROWS * CELL + (ROWS - 1) * GAP_Y;

const cx = (col: number) => PAD_X + col * (CELL + GAP_X);
const cy = (row: number) => PAD_Y + row * (CELL + GAP_Y);

function useIsTouch() {
  const [touch, setTouch] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(hover: none), (pointer: coarse)');
    setTouch(mq.matches);
    const on = () => setTouch(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return touch;
}

export function TalentCalculator({ cls, classes, data, builds, bars = {}, initial }: Props) {
  const trees = data.trees;
  const byId = useMemo(() => {
    const m = new Map<number, { talent: Talent; tree: TalentTree; treeIndex: number }>();
    trees.forEach((tree, treeIndex) => tree.talents.forEach((talent) => m.set(talent.id, { talent, tree, treeIndex })));
    return m;
  }, [trees]);

  const start = useMemo(() => {
    // a link written before the trees last moved is read in its own code order (src/lib/talents.ts)
    const up = upgradeCodes(trees, data.layouts, initial.v, initial.code, initial.order);
    const ranks = decodeBuild(trees, up.code);
    let order = decodeOrder(trees, up.order);
    const replay = ranksFromOrder(trees, order);
    const same = Object.keys(ranks).length === Object.keys(replay.ranks).length && Object.entries(ranks).every(([k, v]) => replay.ranks[Number(k)] === v);
    // the order as replayed (steps that were not legal drop out), or a fresh one when it does not make this build
    order = same ? replay.order : defaultOrder(trees, ranks);
    return { ranks, order };
  }, [trees, data.layouts, initial.v, initial.code, initial.order]);

  const [ranks, setRanks] = useState<Ranks>(start.ranks);
  const [order, setOrder] = useState<number[]>(start.order);
  const [talented, setTalented] = useState(Boolean(initial.talented));
  const [showChanges, setShowChanges] = useState(true);
  const [hover, setHover] = useState<{ id: number; rect: DOMRect } | null>(null);
  const [pinned, setPinned] = useState<number | null>(initial.focus ?? null);
  const [tab, setTab] = useState(0);
  const [copied, setCopied] = useState<string | null>(null);
  const [openGroups, setOpenGroups] = useState<Partial<Record<BuildGroupKey, boolean>>>({});
  const touch = useIsTouch();

  const total = order.length;
  const left = MAX_POINTS - total;
  const code = encodeBuild(trees, ranks);
  const orderCode = encodeOrder(trees, order);
  const groups = useMemo(() => groupBuilds(builds), [builds]);
  // the Grimoire build now on the trees, if any: the same talents, and the same order when two builds share them
  const activeBuild = builds.find((b) => b.code === code && b.order === orderCode)?.id ?? builds.find((b) => b.code === code)?.id;
  const active = builds.find((b) => b.id === activeBuild);
  // the build its players respec into (data/builds.json next)
  const respecInto = active?.next ? builds.find((b) => b.id === active.next!.id) : undefined;
  // a look at the build as it stands at a level (20, 30... the points a character has there), the trees read-only; past a
  // Grimoire build's respec, the build its players respecced into
  const [at, setAt] = useState<number | null>(null);
  const along = at && active ? pathAt(active, at, builds) : null;
  const alongBuild = along?.at ? along.build : null;
  const atOrder = useMemo(() => (alongBuild ? ranksFromOrder(trees, decodeOrder(trees, alongBuild.order)).order : order), [alongBuild, order, trees]);
  const atPoints = at ? Math.max(0, Math.min(atOrder.length, at - 9 + (talented ? 5 : 0))) : order.length;
  const shownRanks = useMemo(() => (at ? ranksFromOrder(trees, atOrder.slice(0, atPoints)).ranks : ranks), [at, atPoints, atOrder, ranks, trees]);
  const pts = trees.map((t) => treePoints(t, ranks));
  const shownPts = trees.map((t) => treePoints(t, shownRanks));
  const level = total ? requiredLevel(total, talented) : null;

  // Keep the address bar shareable without adding history entries.
  useEffect(() => {
    const url = new URL(window.location.href);
    if (code) url.searchParams.set('b', code);
    else url.searchParams.delete('b');
    if (order.length) url.searchParams.set('o', orderCode);
    else url.searchParams.delete('o');
    if (talented) url.searchParams.set('t', '1');
    else url.searchParams.delete('t');
    if (code) url.searchParams.set('v', String(CODE_VERSION));
    else url.searchParams.delete('v');
    url.searchParams.delete('focus');
    window.history.replaceState(window.history.state, '', url.toString());
    // initial.focus: a talent picked from search swaps the address for ?focus=…; the build goes back into it
  }, [code, orderCode, order.length, talented, initial.focus]);

  // Bring a talent that was linked from search into view.
  useEffect(() => {
    if (!initial.focus) return;
    const el = document.querySelector(`[data-talent="${initial.focus}"]`);
    if (el) {
      const i = byId.get(initial.focus)?.treeIndex ?? 0;
      setTab(i);
      el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
  }, [initial.focus, byId]);

  const add = useCallback(
    (id: number) => {
      if (addBlock(trees, ranks, id) !== null) return false;
      setRanks((r) => ({ ...r, [id]: (r[id] ?? 0) + 1 }));
      setOrder((o) => [...o, id]);
      return true;
    },
    [trees, ranks],
  );

  const remove = useCallback(
    (id: number) => {
      if (!canRemove(trees, ranks, id)) return false;
      const i = order.lastIndexOf(id);
      if (i < 0) return false;
      // ranks and order from one replay, so they never drift apart
      const next = orderWithout(trees, order, i);
      setRanks(next.ranks);
      setOrder(next.order);
      return true;
    },
    [trees, ranks, order],
  );

  const resetTree = (i: number) => {
    const ids = new Set(trees[i].talents.map((t) => t.id));
    const next = order.filter((id) => !ids.has(id));
    const replay = ranksFromOrder(trees, next);
    setRanks(replay.ranks);
    setOrder(replay.order);
  };
  const resetAll = () => {
    setRanks({});
    setOrder([]);
  };
  const undo = () => {
    if (!order.length) return;
    const replay = ranksFromOrder(trees, order.slice(0, -1));
    setRanks(replay.ranks);
    setOrder(replay.order);
  };
  const loadBuild = (b: Build) => {
    const r = decodeBuild(trees, b.code);
    const o = decodeOrder(trees, b.order);
    const replay = ranksFromOrder(trees, o);
    const ok = Object.entries(r).every(([k, v]) => replay.ranks[Number(k)] === v);
    setRanks(ok ? replay.ranks : r);
    setOrder(ok ? replay.order : defaultOrder(trees, r));
  };

  // 'game': the build and its point order as a link for the add-on (/grim talents, New build, From a link), which reads
  // b and o the way this calculator does.
  const copy = async (what: 'link' | 'code' | 'game') => {
    const text =
      what === 'link'
        ? window.location.href
        : what === 'game'
          ? `${window.location.origin}/talents/${cls.slug}?b=${code}${order.length ? `&o=${orderCode}` : ''}&v=${CODE_VERSION}`
          : `${cls.name} ${pts.join('/')} ${code}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(what);
      setTimeout(() => setCopied((c) => (c === what ? null : c)), what === 'game' ? 8000 : 1600);
    } catch {
      setCopied(null);
    }
  };

  const onKey = useCallback(
    (e: KeyboardEvent) => {
      // typing somewhere (a name field, a dialog) keeps its own undo
      if (e.target instanceof Element && e.target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="dialog"]')) return;
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        undo();
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [order],
  );
  useEffect(() => {
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onKey]);

  const specName = (() => {
    const max = Math.max(...pts);
    if (!max) return null;
    const i = pts.indexOf(max);
    return trees[i].name;
  })();

  // The build as a planner link, for Save (the same parameters the address bar carries).
  const savePath = `/talents/${cls.slug}?b=${code}${order.length ? `&o=${orderCode}` : ''}${talented ? '&t=1' : ''}&v=${CODE_VERSION}`;

  const shown = hover?.id ?? (touch ? pinned : null);
  const shownInfo = shown ? byId.get(shown) : undefined;

  return (
    <div className="space-y-6">
      {/* Class strip */}
      <nav aria-label="Classes" className="scroll-thin -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
        {classes.map((c) => (
          <Link
            key={c.slug}
            href={`/talents/${c.slug}`}
            aria-current={c.slug === cls.slug ? 'page' : undefined}
            className={`group flex shrink-0 items-center gap-2 rounded-full border px-2.5 py-1.5 text-[15px] transition-colors ${
              c.slug === cls.slug ? 'border-gilt/60 bg-dusk text-vellum' : 'border-iron bg-night/70 text-mist hover:border-ash hover:text-vellum'
            }`}
          >
            <WowIcon icon={c.icon} size={24} name={c.name} />
            <span style={{ color: c.slug === cls.slug ? c.color : undefined }}>{c.name}</span>
          </Link>
        ))}
      </nav>

      {/* Summary bar */}
      <div className="frame gilt flex flex-wrap items-center gap-x-8 gap-y-4 px-5 py-4">
        <div className="flex items-center gap-3">
          <WowIcon icon={cls.icon} size={44} name={cls.name} eager />
          <div>
            <div className="font-display text-[1.6rem] leading-none" style={{ color: cls.color }}>
              {cls.name}
            </div>
            <div className="mt-1 text-[15px] text-mist">{specName ? `${specName} build` : 'Spend your first point'}</div>
          </div>
        </div>
        <dl className="flex flex-wrap gap-x-7 gap-y-2">
          <div>
            <dt className="text-[13px] text-fog">Points</dt>
            <dd className="num text-[1.5rem] font-bold leading-tight text-vellum">{pts.join(' / ')}</dd>
          </div>
          <div>
            <dt className="text-[13px] text-fog">Left</dt>
            <dd className={`num text-[1.5rem] font-bold leading-tight ${left ? 'text-tt-green' : 'text-gilt-bright'}`}>{left}</dd>
          </div>
          <div>
            <dt className="text-[13px] text-fog">Required level</dt>
            <dd className="num text-[1.5rem] font-bold leading-tight text-vellum">{level ?? 'None'}</dd>
          </div>
        </dl>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <button type="button" onClick={undo} disabled={!order.length} className="calc-btn">
            Undo
          </button>
          <button type="button" onClick={resetAll} disabled={!order.length} className="calc-btn">
            Reset
          </button>
          <button type="button" onClick={() => copy('code')} disabled={!order.length} className="calc-btn">
            {copied === 'code' ? 'Copied' : 'Copy build'}
          </button>
          <SaveBuild kind="talents" path={savePath} name={`${specName ?? ''} ${cls.name}`.trim()} disabled={!order.length} className="calc-btn" />
          <button type="button" onClick={() => copy('game')} disabled={!order.length} className="calc-btn" title="Copy this build for the Grimoire add-on">
            {copied === 'game' ? 'Link copied' : 'Use in game'}
          </button>
          <button type="button" onClick={() => copy('link')} className="calc-btn calc-btn-primary">
            {copied === 'link' ? 'Link copied' : 'Copy link'}
          </button>
        </div>
        {copied === 'game' && (
          <p role="status" className="w-full text-[14px] text-mist lg:text-right">
            In game: <span className="text-gilt-bright">/grim talents</span>, New build, From a link, then paste it with Ctrl+V.
          </p>
        )}
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0">
          {/* Tree tabs on narrow screens */}
          <div className="mb-3 flex gap-1.5 lg:hidden" role="tablist" aria-label="Talent trees">
            {trees.map((t, i) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={tab === i}
                onClick={() => setTab(i)}
                className={`flex flex-1 items-center justify-center gap-2 rounded-xl border px-2 py-2 text-[14.5px] ${tab === i ? 'border-gilt/60 bg-dusk text-vellum' : 'border-iron/70 bg-abyss/50 text-mist'}`}
              >
                <WowIcon icon={t.icon} size={20} name={t.name} />
                <span className="truncate">{t.name}</span>
                <span className="num text-gilt">{pts[i]}</span>
              </button>
            ))}
          </div>
          <div className="flex justify-center gap-4 lg:justify-between">
            {trees.map((tree, i) => (
              <div key={tree.id} className={`${tab === i ? 'block' : 'hidden'} lg:block`}>
                <TreeView
                  tree={tree}
                  ranks={shownRanks}
                  trees={trees}
                  points={shownPts[i]}
                  showChanges={showChanges}
                  classColor={cls.color}
                  onAdd={(id) => {
                    setAt(null);
                    return add(id);
                  }}
                  onRemove={(id) => {
                    setAt(null);
                    return remove(id);
                  }}
                  onReset={() => resetTree(i)}
                  onHover={(id, rect) => setHover(id ? { id, rect: rect! } : null)}
                  touch={touch}
                  pinned={pinned}
                  onPin={(id) => setPinned((p) => (p === id ? null : id))}
                />
              </div>
            ))}
          </div>
          {order.length > 0 && (
            <div className="mt-5 flex flex-wrap items-center gap-2" role="group" aria-label="See the build at a level">
              <span className="mr-1 text-[14px] text-mist">At level</span>
              {[20, 30, 40, 50, 60].map((lv) => (
                <button
                  key={lv}
                  type="button"
                  aria-pressed={at === lv}
                  onClick={() => setAt((a) => (a === lv ? null : lv))}
                  className={`num h-8 rounded-full px-3 text-[14px] font-[560] ring-1 ring-inset transition-colors ${at === lv ? 'bg-gilt/[0.14] text-gilt-bright ring-gilt/35' : 'bg-white/[0.04] text-mist ring-white/[0.08] hover:bg-white/[0.07] hover:text-parch'}`}
                >
                  {lv}
                </button>
              ))}
              {at && (
                <span className="text-[13.5px] text-fog">
                  {alongBuild ? `${respecName(alongBuild)}, after the respec at ${along?.at}: ` : ''}
                  {atPoints} of {atOrder.length} points, {shownPts.join(' / ')}. Click a talent to edit the whole build.
                </span>
              )}
            </div>
          )}
          {order.length > 0 && respecInto && active?.next && (
            <p className="mt-2 text-[14px] leading-relaxed text-mist">
              At {active.next.at}, respec into{' '}
              <button type="button" onClick={() => loadBuild(respecInto)} className="font-medium text-gilt hover:text-gilt-bright" title="Load it in the calculator">
                {respecName(respecInto)}
              </button>
              : {respecCost(active.next.at)}
            </p>
          )}
          <OrderStrip order={order} byId={byId} talented={talented} onUndo={undo} respec={respecInto && active?.next ? { at: active.next.at, name: respecName(respecInto) } : undefined} />
        </div>

        <aside className="space-y-4">
          <div className="frame p-4">
            <div className="font-display text-[1.15rem] text-vellum">Options</div>
            <label className="mt-3 flex cursor-pointer items-start gap-3">
              <input type="checkbox" className="calc-check" checked={showChanges} onChange={(e) => setShowChanges(e.target.checked)} />
              <span className="text-[15px] leading-snug text-parch">
                Mark changes from Classic
                <span className="mt-1 flex flex-wrap gap-2 text-[13px]">
                  <span className="inline-flex items-center gap-1.5 text-leaf-bright">
                    <span className="size-2.5 rotate-45 bg-leaf" /> new talent
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-gilt-bright">
                    <span className="size-2.5 rotate-45 bg-gilt" /> reworked
                  </span>
                </span>
              </span>
            </label>
            <label className="mt-3 flex cursor-pointer items-start gap-3">
              <input type="checkbox" className="calc-check" checked={talented} onChange={(e) => setTalented(e.target.checked)} />
              <span className="text-[15px] leading-snug text-parch">
                Talented legacy perk
                <span className="block text-[13px] text-mist">Talent points unlock up to 5 levels earlier.</span>
              </span>
            </label>
          </div>

          {groups.length > 0 && (
            <div className="frame p-4">
              <div className="font-display text-[1.15rem] text-vellum">Grimoire builds</div>
              {groups.map((g) => {
                // a group opens by itself when the build on the trees is one of its hidden ones
                const open = openGroups[g.key] ?? g.rest.some((b) => b.id === activeBuild);
                const shown = open ? [g.top, ...g.rest] : [g.top];
                return (
                  <div key={g.key} className="mt-3">
                    <div className="flex items-center justify-between gap-2 px-2">
                      <span className="text-[13.5px] font-semibold text-mist">{g.label}</span>
                      {g.rest.length > 0 && (
                        <button
                          type="button"
                          aria-expanded={open}
                          aria-controls={`builds-${g.key}`}
                          onClick={() => setOpenGroups((s) => ({ ...s, [g.key]: !open }))}
                          className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[13px] font-medium text-gilt hover:text-gilt-bright"
                        >
                          {open ? 'Show less' : `${g.rest.length} more`}
                          <svg viewBox="0 0 12 12" aria-hidden className={`size-3 transition-transform ${open ? 'rotate-180' : ''}`}>
                            <path d="M2.5 4.5 6 8l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </button>
                      )}
                    </div>
                    <ul id={`builds-${g.key}`} className="mt-1 space-y-1">
                      {shown.map((b) => (
                        <li key={b.id}>
                          <button
                            type="button"
                            onClick={() => loadBuild(b)}
                            aria-current={b.id === activeBuild ? 'true' : undefined}
                            className={`flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-dusk ${b.id === activeBuild ? 'bg-dusk/70' : ''}`}
                          >
                            <WowIcon icon={trees[b.points.indexOf(Math.max(...b.points))]?.icon} size={30} name={b.name} />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-[15.5px] font-medium text-vellum">{b.name}</span>
                              <span className="flex flex-wrap gap-x-2 text-[13px] text-mist">
                                <span className="num text-gilt">{b.points.join('/')}</span>
                                {roleTag(b) && <span>{roleTag(b)}</span>}
                              </span>
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
              <Link href={`/guides/${cls.slug}`} className="mt-3 block px-2 text-[14px] text-gilt hover:text-gilt-bright">
                Read the {cls.name} guide
              </Link>
            </div>
          )}

          {activeBuild && bars[activeBuild] && <BarCard slots={bars[activeBuild]} />}

          <div className="frame p-4">
            <div className="font-display text-[1.15rem] text-vellum">This build</div>
            {total === 0 ? (
              <p className="mt-2 text-[15px] text-mist">Click a talent to add a point, right-click to remove one. Shift-click also removes.</p>
            ) : (
              <ul className="mt-2 space-y-3">
                {trees.map((t, i) =>
                  pts[i] ? (
                    <li key={t.id}>
                      <div className="flex items-center justify-between text-[14px] text-mist">
                        <span>{t.name}</span>
                        <span className="num text-gilt">{pts[i]}</span>
                      </div>
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {t.talents
                          .filter((x) => ranks[x.id])
                          .map((x) => (
                            <span key={x.id} className="relative" title={`${x.name} ${ranks[x.id]}/${x.max}`}>
                              <WowIcon icon={x.icon} size={26} name={x.name} />
                              <span className="num absolute -bottom-1 -right-1 rounded-[2px] bg-abyss px-[3px] text-[10.5px] leading-tight text-gilt-bright">{ranks[x.id]}</span>
                            </span>
                          ))}
                      </div>
                    </li>
                  ) : null,
                )}
              </ul>
            )}
          </div>
        </aside>
      </div>

      {shownInfo && (
        <TalentTip
          info={shownInfo}
          rank={ranks[shownInfo.talent.id] ?? 0}
          trees={trees}
          ranks={ranks}
          rect={hover?.rect}
          showChanges={showChanges}
          touch={touch && !hover}
          onAdd={() => add(shownInfo.talent.id)}
          onRemove={() => remove(shownInfo.talent.id)}
          onClose={() => setPinned(null)}
        />
      )}

      <style>{`
        .calc-btn{display:inline-flex;align-items:center;gap:.4rem;height:2.4rem;padding:0 1rem;border-radius:999px;background:rgb(255 255 255/.06);box-shadow:inset 0 0 0 1px rgb(255 255 255/.1);color:var(--color-parch);font-size:14.5px;font-weight:600;transition:background-color .15s,color .15s}
        .calc-btn:hover:not(:disabled){background:rgb(255 255 255/.11);color:var(--color-vellum)}
        .calc-btn:disabled{opacity:.45;cursor:default}
        .calc-btn[aria-pressed=true]{color:var(--color-gilt-bright);box-shadow:inset 0 0 0 1px rgb(242 182 64/.45)}
        .calc-btn-primary{background:var(--color-gilt);color:#1a1204;box-shadow:inset 0 1px 0 rgb(255 255 255/.45)}
        .calc-btn-primary:hover:not(:disabled){background:var(--color-gilt-bright);color:#1a1204}
        .calc-check{appearance:none;flex:none;margin-top:3px;width:18px;height:18px;border-radius:6px;border:1px solid var(--color-ash);background:var(--color-abyss);display:grid;place-items:center}
        .calc-check:checked{background:var(--color-gilt);border-color:var(--color-gilt)}
        .calc-check:checked::after{content:'';width:9px;height:5px;border:2px solid #1a1204;border-top:0;border-right:0;transform:rotate(-45deg) translate(1px,-1px)}
      `}</style>
    </div>
  );
}

function TreeView({
  tree,
  trees,
  ranks,
  points,
  showChanges,
  classColor,
  onAdd,
  onRemove,
  onReset,
  onHover,
  touch,
  pinned,
  onPin,
}: {
  tree: TalentTree;
  trees: TalentTree[];
  ranks: Ranks;
  points: number;
  showChanges: boolean;
  classColor: string;
  onAdd: (id: number) => boolean;
  onRemove: (id: number) => boolean;
  onReset: () => void;
  onHover: (id: number | null, rect?: DOMRect) => void;
  touch: boolean;
  pinned: number | null;
  onPin: (id: number) => void;
}) {
  const byId = new Map(tree.talents.map((t) => [t.id, t]));
  const occupied = new Set(tree.talents.map((t) => `${t.row}:${t.col}`));
  const arrows = tree.talents
    .filter((t) => t.req && byId.has(t.req.id))
    .map((t) => {
      const from = byId.get(t.req!.id)!;
      const lit = (ranks[from.id] ?? 0) >= t.req!.qty;
      return { from, to: t, lit };
    });
  return (
    <section
      aria-label={`${tree.name} talents`}
      className="frame relative overflow-hidden"
      style={{ width: TREE_W, background: `radial-gradient(120% 60% at 50% 0%, ${classColor}1f, transparent 60%), linear-gradient(180deg, rgb(18 20 24 / .97), rgb(9 10 12 / .98))` }}
    >
      <header className="flex items-center gap-2.5 border-b border-iron/80 px-4 py-2.5">
        <WowIcon icon={tree.icon} size={28} name={tree.name} />
        <div className="min-w-0 flex-1">
          <div className="truncate font-display text-[1.12rem] leading-tight text-vellum">{tree.name}</div>
          <div className="text-[12.5px] text-fog">{ROLE_LABEL[tree.role]}</div>
        </div>
        <span className="num text-[1.35rem] font-bold text-gilt-bright">{points}</span>
        <button
          type="button"
          onClick={onReset}
          disabled={!points}
          aria-label={`Reset ${tree.name}`}
          className="ml-1 rounded-xl p-1.5 text-fog hover:bg-dusk hover:text-vellum disabled:opacity-30"
        >
          <svg viewBox="0 0 16 16" className="size-4" aria-hidden>
            <path d="M3 8a5 5 0 1 0 1.5-3.6M3 3v3h3" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </header>
      <div className="relative" style={{ width: TREE_W, height: TREE_H }}>
        {/* Watermark of the tree's icon */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={iconUrl(tree.icon)}
          alt=""
          aria-hidden
          data-fallback="hide"
          onError={(e) => {
            e.currentTarget.style.display = 'none';
          }}
          className="pointer-events-none absolute left-1/2 top-1/2 size-[230px] -translate-x-1/2 -translate-y-1/2 rounded-full object-cover opacity-[0.06] blur-[2px] grayscale"
        />
        <svg className="pointer-events-none absolute inset-0" width={TREE_W} height={TREE_H} aria-hidden>
          {arrows.map(({ from, to, lit }) => {
            const color = lit ? '#e8c96b' : '#4d4237';
            const x1 = cx(from.col) + CELL / 2;
            const y1 = cy(from.row) + CELL / 2;
            const x2 = cx(to.col) + CELL / 2;
            const y2 = cy(to.row) + CELL / 2;
            let d: string;
            let head: string;
            const between = Array.from({ length: Math.max(0, to.row - from.row - 1) }, (_, i) => from.row + 1 + i);
            if (from.col === to.col && between.some((r) => occupied.has(`${r}:${from.col}`))) {
              // Another talent sits between the two: go round it through the gap beside the column and come in from the
              // side, so the arrow does not read as a chain through that talent.
              const right = from.col < COLS - 1;
              const gx = right ? cx(from.col) + CELL + GAP_X / 2 : cx(from.col) - GAP_X / 2;
              const sx = right ? cx(from.col) + CELL + 2 : cx(from.col) - 2;
              const ex = right ? cx(to.col) + CELL + 7 : cx(to.col) - 7;
              const dir = right ? -1 : 1;
              d = `M${sx} ${y1} L${gx} ${y1} L${gx} ${y2} L${ex} ${y2}`;
              head = `M${ex - dir * 2} ${y2 - 5} L${ex + dir * 5} ${y2} L${ex - dir * 2} ${y2 + 5}`;
            } else if (from.col === to.col) {
              d = `M${x1} ${cy(from.row) + CELL + 2} L${x2} ${cy(to.row) - 7}`;
              head = `M${x2 - 5} ${cy(to.row) - 9} L${x2} ${cy(to.row) - 2} L${x2 + 5} ${cy(to.row) - 9}`;
            } else if (from.row === to.row) {
              const dir = to.col > from.col ? 1 : -1;
              const sx = dir > 0 ? cx(from.col) + CELL + 2 : cx(from.col) - 2;
              const ex = dir > 0 ? cx(to.col) - 7 : cx(to.col) + CELL + 7;
              d = `M${sx} ${y1} L${ex} ${y2}`;
              head = `M${ex - dir * 2} ${y2 - 5} L${ex + dir * 5} ${y2} L${ex - dir * 2} ${y2 + 5}`;
            } else {
              const dir = to.col > from.col ? 1 : -1;
              const sx = dir > 0 ? cx(from.col) + CELL + 2 : cx(from.col) - 2;
              d = `M${sx} ${y1} L${x2} ${y1} L${x2} ${cy(to.row) - 7}`;
              head = `M${x2 - 5} ${cy(to.row) - 9} L${x2} ${cy(to.row) - 2} L${x2 + 5} ${cy(to.row) - 9}`;
            }
            return (
              <g key={`${from.id}-${to.id}`} stroke={color} fill="none" strokeLinecap="round" strokeLinejoin="round">
                <path d={d} strokeWidth={lit ? 3 : 2.5} opacity={lit ? 1 : 0.9} />
                <path d={head} strokeWidth={2.5} />
              </g>
            );
          })}
        </svg>
        {tree.talents.map((t) => (
          <TalentCell
            key={t.id}
            t={t}
            rank={ranks[t.id] ?? 0}
            reachable={isReachable(trees, ranks, t.id)}
            canAdd={addBlock(trees, ranks, t.id) === null}
            showChanges={showChanges}
            onAdd={onAdd}
            onRemove={onRemove}
            onHover={onHover}
            touch={touch}
            pinned={pinned === t.id}
            onPin={onPin}
          />
        ))}
      </div>
    </section>
  );
}

function TalentCell({
  t,
  rank,
  reachable,
  canAdd,
  showChanges,
  onAdd,
  onRemove,
  onHover,
  touch,
  pinned,
  onPin,
}: {
  t: Talent;
  rank: number;
  reachable: boolean;
  canAdd: boolean;
  showChanges: boolean;
  onAdd: (id: number) => boolean;
  onRemove: (id: number) => boolean;
  onHover: (id: number | null, rect?: DOMRect) => void;
  touch: boolean;
  pinned: boolean;
  onPin: (id: number) => void;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  const [flash, setFlash] = useState(false);
  const maxed = rank >= t.max;
  const state = maxed ? 'max' : rank > 0 ? 'some' : reachable ? 'open' : 'locked';
  const ring = state === 'max' ? '#ffd100' : state === 'some' || state === 'open' ? '#1eff00' : '#4a3f34';
  const rankColor = state === 'max' ? '#ffd100' : state === 'locked' ? '#8c8273' : '#1eff00';
  const bump = () => {
    setFlash(true);
    setTimeout(() => setFlash(false), 260);
  };
  return (
    <button
      ref={ref}
      type="button"
      data-talent={t.id}
      aria-label={`${t.name}, rank ${rank} of ${t.max}${state === 'locked' ? ', locked' : ''}`}
      aria-disabled={state === 'locked' || undefined}
      className={`group absolute rounded-[6px] outline-none transition-transform duration-100 focus-visible:ring-2 focus-visible:ring-gilt ${flash ? 'animate-pop' : ''} ${pinned ? 'ring-2 ring-gilt' : ''}`}
      style={{ left: cx(t.col), top: cy(t.row), width: CELL, height: CELL }}
      onMouseEnter={() => !touch && onHover(t.id, ref.current!.getBoundingClientRect())}
      onMouseLeave={() => !touch && onHover(null)}
      onFocus={() => !touch && onHover(t.id, ref.current!.getBoundingClientRect())}
      onBlur={() => !touch && onHover(null)}
      onClick={(e) => {
        if (touch) {
          onPin(t.id);
          return;
        }
        if (e.shiftKey) {
          if (onRemove(t.id)) bump();
        } else if (onAdd(t.id)) bump();
        onHover(t.id, ref.current!.getBoundingClientRect());
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        if (!touch && onRemove(t.id)) bump();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Backspace' || e.key === 'Delete' || e.key === '-') {
          e.preventDefault();
          if (onRemove(t.id)) bump();
        } else if (e.key === '+' || e.key === '=') {
          e.preventDefault();
          if (onAdd(t.id)) bump();
        }
      }}
    >
      <span
        className="absolute inset-0 overflow-hidden rounded-[6px]"
        style={{
          boxShadow: `0 0 0 2px ${ring}${state === 'locked' ? '' : 'cc'}, 0 0 ${state === 'max' ? 14 : state === 'some' ? 10 : 0}px ${ring}55, inset 0 0 0 1px #000`,
          background: '#0c0907',
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={iconUrl(t.icon)}
          alt=""
          width={CELL}
          height={CELL}
          draggable={false}
          data-fallback="hide"
          onError={(e) => {
            e.currentTarget.style.visibility = 'hidden';
          }}
          className={`size-full scale-110 object-cover transition-[filter] ${state === 'locked' ? 'brightness-[0.45] grayscale' : ''}`}
        />
        <span className="absolute inset-0 rounded-[6px] shadow-[inset_0_0_0_1px_rgb(255_255_255/0.18),inset_0_10px_14px_-10px_rgb(255_255_255/0.25)]" />
      </span>
      {showChanges && t.status !== 'same' && (
        <span
          aria-hidden
          className="absolute -left-1 -top-1 size-[11px] rotate-45 border border-abyss"
          style={{ background: t.status === 'new' ? 'var(--color-leaf)' : 'var(--color-gilt)', boxShadow: `0 0 8px ${t.status === 'new' ? 'var(--color-leaf)' : 'var(--color-gilt)'}` }}
        />
      )}
      <span
        className="num absolute -bottom-2 -right-2.5 min-w-[30px] rounded-[3px] border border-black/80 bg-[#0c0907] px-1 text-center text-[12.5px] font-bold leading-[17px]"
        style={{ color: rankColor }}
      >
        {rank}/{t.max}
      </span>
    </button>
  );
}

function TalentTip({
  info,
  rank,
  trees,
  ranks,
  rect,
  showChanges,
  touch,
  onAdd,
  onRemove,
  onClose,
}: {
  info: { talent: Talent; tree: TalentTree; treeIndex: number };
  rank: number;
  trees: TalentTree[];
  ranks: Ranks;
  rect?: DOMRect;
  showChanges: boolean;
  touch: boolean;
  onAdd: () => void;
  onRemove: () => void;
  onClose: () => void;
}) {
  const { talent: t, tree } = info;
  const box = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<React.CSSProperties>({ opacity: 0 });
  useEffect(() => {
    if (touch || !rect || !box.current) return;
    const w = box.current.offsetWidth;
    const h = box.current.offsetHeight;
    let x = rect.right + 14;
    if (x + w > window.innerWidth - 8) x = rect.left - w - 14;
    let y = rect.top - 6;
    if (y + h > window.innerHeight - 8) y = window.innerHeight - h - 8;
    setPos({ transform: `translate3d(${Math.max(8, x)}px, ${Math.max(8, y)}px, 0)`, opacity: 1 });
  }, [rect, touch, t.id, rank]);
  const tierNeed = t.row * 5;
  const have = trees[info.treeIndex].talents.filter((x) => x.row < t.row).reduce((n, x) => n + (ranks[x.id] ?? 0), 0);
  const req = t.req ? tree.talents.find((x) => x.id === t.req!.id) : undefined;
  const reqMet = !req || (ranks[req.id] ?? 0) >= t.req!.qty;
  const cur = rank > 0 ? t.desc[rank - 1] : t.desc[0];
  const next = rank > 0 && rank < t.max ? t.desc[rank] : undefined;
  const content = (
    <div className="wtt w-[340px] max-w-[calc(100vw-24px)]">
      <div className="flex items-baseline justify-between gap-3">
        <span className="wtt-name text-white">{t.name}</span>
        <span className="shrink-0 text-[13.5px] text-tt-grey">
          Rank {rank}/{t.max}
        </span>
      </div>
      {have < tierNeed && <div className="text-tt-red">Requires {tierNeed} points in {tree.name} Talents</div>}
      {req && !reqMet && (
        <div className="text-tt-red">
          Requires {t.req!.qty} point{t.req!.qty > 1 ? 's' : ''} in {req.name}
        </div>
      )}
      <GameText text={cur} className="mt-1 block text-tt-yellow" />
      {next && (
        <div className="mt-2.5">
          <div className="text-white">Next rank:</div>
          <GameText text={next} className="block text-tt-yellow" />
        </div>
      )}
      {showChanges && t.status === 'new' && <div className="mt-2.5 border-t border-white/10 pt-2 text-[14px] text-leaf-bright">New in WoW: Forever</div>}
      {showChanges && t.status === 'changed' && t.was && (
        <div className="mt-2.5 border-t border-white/10 pt-2 text-[14px]">
          <div className="text-gilt-bright">
            Changed from Classic
            {t.was.tree && t.was.tree !== tree.name ? `, moved from ${t.was.tree}` : ''}
          </div>
          {t.was.desc && (
            <div className="mt-1 text-tt-grey">
              Was{t.was.max && t.was.max !== t.max ? ` (${t.was.max} ranks)` : ''}: <GameText text={t.was.desc} />
            </div>
          )}
        </div>
      )}
      {!touch && <div className="mt-2 text-[12.5px] text-fog">Click to learn, right-click to unlearn</div>}
      {touch && (
        <div className="mt-3 flex gap-2">
          <button type="button" onClick={onRemove} className="calc-btn flex-1 justify-center">
            Remove point
          </button>
          <button type="button" onClick={onAdd} className="calc-btn calc-btn-primary flex-1 justify-center">
            Add point
          </button>
          <button type="button" onClick={onClose} aria-label="Close" className="calc-btn">
            <svg viewBox="0 0 12 12" className="size-3" aria-hidden><path d="m3 3 6 6m0-6-6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
          </button>
        </div>
      )}
    </div>
  );
  if (touch) return <div className="fixed inset-x-0 bottom-3 z-[80] flex justify-center px-3">{content}</div>;
  return (
    <div ref={box} className="pointer-events-none fixed left-0 top-0 z-[80]" style={pos}>
      {content}
    </div>
  );
}

function OrderStrip({
  order,
  byId,
  talented,
  onUndo,
  respec,
}: {
  order: number[];
  byId: Map<number, { talent: Talent; tree: TalentTree; treeIndex: number }>;
  talented: boolean;
  onUndo: () => void;
  /** The level a Grimoire build's players respec at, and the build they respec into: marked before that level's point. */
  respec?: { at: number; name: string };
}) {
  const first = talented ? 5 : 10;
  return (
    <div className="frame mt-6 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-[1.2rem] text-vellum">Point order</h2>
        <p className="text-[14px] text-mist">The order you spend points is your leveling path. Undo with Ctrl+Z.</p>
      </div>
      {order.length === 0 ? (
        <p className="mt-3 text-[15px] text-fog">No points yet.</p>
      ) : (
        <ol className="mt-3 grid grid-cols-[repeat(auto-fill,minmax(42px,1fr))] gap-x-1.5 gap-y-3">
          {order.map((id, i) => {
            const info = byId.get(id);
            if (!info) return null;
            const isLast = i === order.length - 1;
            return (
              <Fragment key={i}>
                {respec && first + i === respec.at && (
                  <li className="flex flex-col items-center gap-1" title={`Level ${respec.at}: respec into ${respec.name}`}>
                    <span className="grid size-8 place-items-center rounded-full bg-gilt/[0.14] text-gilt-bright ring-1 ring-inset ring-gilt/35">
                      <svg viewBox="0 0 16 16" className="size-4" aria-hidden>
                        <path d="M3 8a5 5 0 1 0 1.6-3.7M3 2.5v2.8h2.8" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </span>
                    <span className="text-[11.5px] text-gilt">Respec</span>
                  </li>
                )}
                <li className="flex flex-col items-center gap-1">
                  <span className="relative" title={`Level ${first + i}: ${info.talent.name}`}>
                    <WowIcon icon={info.talent.icon} size={32} name={info.talent.name} />
                    {isLast && (
                      <button type="button" onClick={onUndo} aria-label="Undo last point" className="absolute -right-1.5 -top-1.5 grid size-4 place-items-center rounded-full bg-blood text-white">
                        <svg viewBox="0 0 12 12" className="size-2.5" aria-hidden><path d="m3 3 6 6m0-6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
                      </button>
                    )}
                  </span>
                  <span className="num text-[11.5px] text-fog">{first + i}</span>
                </li>
              </Fragment>
            );
          })}
        </ol>
      )}
    </div>
  );
}

const BAR_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-', '='];

/** A Grimoire build's suggested bar 1: the rotation on 1 to 6, cooldowns on 7 to 0, utility on - and =. */
function BarCard({ slots }: { slots: BarSlot[] }) {
  return (
    <div className="frame p-4">
      <div className="font-display text-[1.15rem] text-vellum">Action bar</div>
      <p className="mt-1 text-[13.5px] leading-snug text-mist">Rotation on 1 to 6, cooldowns on 7 to 0, utility on - and =. In game, the add-on sets it up for you.</p>
      <div className="mt-3 grid grid-cols-6 gap-1.5">
        {slots.map((s, i) => (
          <div key={i} className="relative" title={s ? `${s.n}${s.lv && s.lv > 1 ? `, from level ${s.lv}` : ''}` : 'Free'}>
            {s ? (
              <WowIcon icon={s.ic} size={38} name={s.n} />
            ) : (
              <span className="block size-[38px] rounded-[9px] bg-white/[0.03] ring-1 ring-inset ring-white/[0.06]" />
            )}
            <span className="num pointer-events-none absolute left-1 top-0.5 text-[11px] font-semibold text-vellum [text-shadow:0_1px_2px_rgb(0_0_0/0.9)]">{BAR_KEYS[i]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
