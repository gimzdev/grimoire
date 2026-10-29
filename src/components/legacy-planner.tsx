'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react';
import { GameText } from '@/components/game-text';
import { WowIcon } from '@/components/icon';
import { SaveBuild } from '@/components/save-build';
import { LEGACY_FORGET, keepLegacy, loadLegacy, signInHref, useAccount } from '@/lib/account';
import { ACCOUNTS } from '@/lib/accounts';
import {
  decodePlan,
  encodePlan,
  findPerk,
  gateMet,
  normalizeDone,
  orderWithout,
  perkBlock,
  perkCanRemove,
  perkOpen,
  pointsEarned,
  ranksFromOrder,
  reqMet,
  toggleChallenge,
  treeSpent,
  type PerkRanks,
} from '@/lib/legacy';
import type { LegacyChallenge, LegacyData, LegacyPerk, LegacyTree } from '@/lib/types';
import { iconUrl } from '@/lib/wow';

export type LegacyTab = 'challenges' | 'perks';
type ClassLite = { slug: string; name: string; color: string; icon: string };

interface Props {
  data: LegacyData;
  classes: ClassLite[];
  /** Dungeon and raid names by page slug. */
  places: Record<string, string>;
  initial: { tab: LegacyTab; plan?: string };
}

// Progress and the plan stay in this browser, and signed in the challenges are kept with the account too. v1 kept the
// challenges only (its perk list had no ranks).
const STORE = 'grimoire.legacy.v2';
const OLD_STORE = 'grimoire.legacy.v1';
interface Saved {
  done: string[];
  plan: string;
  /** The challenges as the account last gave them to this browser, and which account (by when it was made). */
  base?: string[];
  owner?: string;
}
type Base = { owner: string; done: string[] };
/** Where the ticks are: on the profile, on their way (or retried), or in this browser only. */
type Kept = 'account' | 'saving' | 'pending' | 'signin' | 'browser';
const sameSet = (a: Iterable<string>, b: Iterable<string>) => {
  const x = new Set(a), y = new Set(b);
  return x.size === y.size && [...x].every((k) => y.has(k));
};
/** What this browser keeps, read fresh: two tabs write it, so each change keeps what it does not own. */
function readStore(): Partial<Saved> {
  try {
    const raw = localStorage.getItem(STORE);
    const s: unknown = raw ? JSON.parse(raw) : null;
    return s && typeof s === 'object' ? (s as Partial<Saved>) : {};
  } catch {
    return {};
  }
}
function writeStore(s: Saved) {
  try {
    localStorage.setItem(STORE, JSON.stringify(s));
  } catch {
    /* storage unavailable: progress lasts for this visit */
  }
}
/** A failed save is tried again when the connection comes back, the page is looked at again, or every 15 seconds. */
const RETRY_MS = 15_000;

const CELL = 48;
const GAP_X = 24;
const GAP_Y = 16;
const PAD_X = 20;
const PAD_Y = 18;
const GRID = 4;
const TREE_W = PAD_X * 2 + GRID * CELL + (GRID - 1) * GAP_X;
const TREE_H = PAD_Y * 2 + GRID * CELL + (GRID - 1) * GAP_Y;
const cx = (col: number) => PAD_X + (col - 1) * (CELL + GAP_X);
const cy = (row: number) => PAD_Y + (row - 1) * (CELL + GAP_Y);

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

export function LegacyPlanner({ data, classes, places, initial }: Props) {
  const { trees, challenges } = data;
  const cap = data.points;
  const [tab, setTab] = useState<LegacyTab>(initial.tab);
  const [done, setDone] = useState<Set<string>>(() => new Set());
  const [order, setOrder] = useState<string[]>(() => ranksFromOrder(trees, decodePlan(trees, initial.plan), cap).order);
  // Earlier plans, newest last, for Undo (this visit only).
  const [past, setPast] = useState<string[][]>([]);
  const [loaded, setLoaded] = useState(false);
  // While a plan opened from a link is left as it is, this browser keeps its own plan instead of the link's.
  const keptPlan = useRef<string | null>(null);
  const account = useAccount();
  const who = ACCOUNTS && account.phase === 'in' ? account.since : null;
  const [base, setBase] = useState<Base | null>(null);
  // the account whose challenges this page now keeps in step with the server (by when it was made)
  const [synced, setSynced] = useState<string | null>(null);
  // a load or a save that did not get through, and a counter that asks for another try
  const [trouble, setTrouble] = useState(false);
  const [nudge, setNudge] = useState(0);

  // Load what this browser kept; a plan in the link wins over the kept one, and Undo brings the kept one back. The
  // address is read here rather than taken from the first render: coming Back to the page, it holds the plan as it
  // was last changed, while the page itself is the one first opened.
  useEffect(() => {
    let saved: Partial<Saved> | null = null;
    try {
      const raw = localStorage.getItem(STORE) ?? localStorage.getItem(OLD_STORE);
      if (raw) saved = JSON.parse(raw) as Partial<Saved>;
    } catch {
      /* storage unavailable: start empty */
    }
    const strings = (v: unknown) => (Array.isArray(v) ? v.filter((k): k is string => typeof k === 'string') : null);
    const savedDone = strings(saved?.done);
    if (savedDone) setDone(normalizeDone(challenges, savedDone));
    const savedBase = strings(saved?.base);
    if (savedBase && typeof saved?.owner === 'string') setBase({ owner: saved.owner, done: savedBase });
    const here = new URL(window.location.href).searchParams;
    setTab(here.get('tab') === 'perks' ? 'perks' : 'challenges');
    const kept = saved && typeof saved.plan === 'string' ? ranksFromOrder(trees, decodePlan(trees, saved.plan), cap).order : [];
    const linked = ranksFromOrder(trees, decodePlan(trees, here.get('p')), cap).order;
    // A link without a single legal point counts as no plan at all.
    if (!linked.length) setOrder(kept);
    else {
      setOrder(linked);
      const keptCode = encodePlan(trees, kept);
      if (kept.length && keptCode !== encodePlan(trees, linked)) {
        keptPlan.current = keptCode;
        setPast([kept]);
      }
    }
    setLoaded(true);
  }, [challenges, trees, cap]);

  const ranks = useMemo(() => ranksFromOrder(trees, order, cap).ranks, [trees, order, cap]);
  const plan = encodePlan(trees, order);
  const earned = pointsEarned(challenges, done);
  const spent = order.length;

  // The latest of everything, for timers, answers and page events that outlive a render.
  const latest = useRef({ done, base, synced, who, nudge, plan });
  useEffect(() => {
    latest.current = { done, base, synced, who, nudge, plan: keptPlan.current ?? plan };
  }, [done, base, synced, who, nudge, plan]);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // What this browser keeps: the ticks (with what the account last gave) and the plan, each written on its own change, so
  // a tab that only follows another tab's ticks never writes its own plan over that tab's.
  useEffect(() => {
    if (!loaded) return;
    const s = readStore();
    writeStore({ done: [...done], plan: typeof s.plan === 'string' ? s.plan : latest.current.plan, ...(base && { base: base.done, owner: base.owner }) });
  }, [done, base, loaded]);
  useEffect(() => {
    if (!loaded) return;
    const s = readStore();
    const kept = Array.isArray(s.base) && typeof s.owner === 'string' ? { base: s.base, owner: s.owner } : {};
    writeStore({ done: Array.isArray(s.done) ? s.done : [...latest.current.done], plan: keptPlan.current ?? plan, ...kept });
  }, [plan, loaded]);

  // Another tab of the planner ticked something: this one follows, so neither puts back what the other changed. Signing
  // out (in another tab or this one) forgets the account's ticks here too.
  useEffect(() => {
    const forget = () => {
      setDone(new Set());
      setBase(null);
      setSynced(null);
    };
    const on = (e: StorageEvent) => {
      if (e.key !== STORE || !e.newValue) return;
      try {
        const s = JSON.parse(e.newValue) as Partial<Saved>;
        if (Array.isArray(s.done)) {
          const next = normalizeDone(challenges, s.done.filter((k): k is string => typeof k === 'string'));
          setDone((d) => (sameSet(d, next) ? d : next));
        }
        if (Array.isArray(s.base) && typeof s.owner === 'string') {
          const b = { owner: s.owner, done: s.base.filter((k): k is string => typeof k === 'string') };
          setBase((was) => (was && was.owner === b.owner && sameSet(was.done, b.done) ? was : b));
        } else if (s.owner === undefined && latest.current.base) {
          // the other tab holds no account's copy: this one asks the account again rather than trust its own
          setBase(null);
          setSynced(null);
        }
      } catch {
        /* not ours to read */
      }
    };
    window.addEventListener('storage', on);
    window.addEventListener(LEGACY_FORGET, forget);
    return () => {
      window.removeEventListener('storage', on);
      window.removeEventListener(LEGACY_FORGET, forget);
    };
  }, [challenges]);

  // Signed in: the challenges ticked here and the account's own copy become one. What changed in this browser since the
  // account last gave its list goes onto the list it has now; challenges ticked here before ever signing in join the
  // account's; a copy that belonged to another account is left behind. The difference then goes up like any change.
  const loading = useRef(false);
  useEffect(() => {
    if (!loaded) return;
    if (!who) {
      setSynced(null);
      setTrouble(false);
      return;
    }
    if (synced === who || loading.current) return;
    loading.current = true;
    void (async () => {
      const got = await loadLegacy();
      loading.current = false;
      if (latest.current.who !== who) return setNudge((n) => n + 1); // another account by now: ask for that one
      if (got === 'out') return;
      if (got === 'failed') return setTrouble(true); // asked again on the next nudge
      const { done: here, base: was } = latest.current;
      const server = got?.done ?? [];
      let next: Set<string>;
      if (was?.owner === who) {
        const agreed = new Set(was.done);
        next = new Set(server);
        for (const k of here) if (!agreed.has(k)) next.add(k);
        for (const k of agreed) if (!here.has(k)) next.delete(k);
      } else next = new Set([...server, ...(was ? [] : here)]);
      next = normalizeDone(challenges, next);
      setTrouble(false);
      setDone((d) => (sameSet(d, next) ? d : next));
      setBase({ owner: who, done: server });
      setSynced(who);
    })();
  }, [loaded, who, synced, challenges, nudge]);

  // Sends what changed since the account last gave its list. Its answer, with any change made meanwhile on top, is what the
  // page shows next. keepalive: the page is going away.
  const saving = useRef(false);
  const failed = useRef<{ nudge: number; done: Set<string> } | null>(null);
  const send = useCallback(
    (keepalive: boolean) => {
      const { done: now, base: from, synced: owner } = latest.current;
      if (!owner || !from || from.owner !== owner || sameSet(now, from.done)) return;
      if (saving.current && !keepalive) return; // its answer brings the next round
      const sent = [...now];
      saving.current = true;
      void keepLegacy(from.done, sent, keepalive).then((merged) => {
        saving.current = false;
        if (!mounted.current) {
          // the page is gone: what the account now holds is noted for the next visit
          const s = readStore();
          if (merged && s.owner === owner) writeStore({ done: Array.isArray(s.done) ? s.done : sent, plan: typeof s.plan === 'string' ? s.plan : '', base: merged, owner });
          return;
        }
        if (latest.current.synced !== owner) return;
        if (!merged) {
          failed.current = { nudge: latest.current.nudge, done: new Set(sent) };
          setTrouble(true);
          return;
        }
        failed.current = null;
        setTrouble(false);
        setBase({ owner, done: merged });
        setDone((d) => {
          const was = new Set(sent);
          const next = new Set(merged);
          for (const k of d) if (!was.has(k)) next.add(k);
          for (const k of was) if (!d.has(k)) next.delete(k);
          const out = normalizeDone(challenges, next);
          return sameSet(d, out) ? d : out;
        });
      });
    },
    [challenges],
  );

  // Every change goes up a moment after the last tick. After a failure it waits for another tick or a nudge.
  useEffect(() => {
    if (!synced || synced !== who || !base || sameSet(done, base.done) || saving.current) return;
    const f = failed.current;
    if (f && f.nudge === nudge && sameSet(f.done, done)) return;
    const t = setTimeout(() => send(false), 700);
    return () => clearTimeout(t);
  }, [done, base, synced, who, nudge, send]);

  // Nudges while something did not get through: the connection is back, the page is looked at again, every 15 seconds.
  useEffect(() => {
    if (!trouble) return;
    const bump = () => setNudge((n) => n + 1);
    const seen = () => document.visibilityState === 'visible' && bump();
    const t = setInterval(bump, RETRY_MS);
    window.addEventListener('online', bump);
    document.addEventListener('visibilitychange', seen);
    return () => {
      clearInterval(t);
      window.removeEventListener('online', bump);
      document.removeEventListener('visibilitychange', seen);
    };
  }, [trouble]);

  // Leaving with a change not on the account yet (another page of the site, a closed tab, a reload, the app put away): it
  // goes now, on a request that outlives the page.
  useEffect(() => {
    const flush = () => send(true);
    const hidden = () => document.visibilityState === 'hidden' && flush();
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', hidden);
    return () => {
      window.removeEventListener('pagehide', flush);
      document.removeEventListener('visibilitychange', hidden);
      flush();
    };
  }, [send]);

  // Every change to the plan goes through here, so Undo can step back through them.
  const changePlan = useCallback(
    (next: string[]) => {
      if (next.length === order.length && next.every((id, i) => id === order[i])) return;
      keptPlan.current = null;
      setPast((p) => [...p.slice(-99), order]);
      setOrder(next);
    },
    [order],
  );
  const undo = useCallback(() => {
    if (!past.length) return;
    keptPlan.current = null;
    setOrder(past[past.length - 1]);
    setPast(past.slice(0, -1));
  }, [past]);

  // The address carries the open tab and the plan, so a copied link opens the same view.
  useEffect(() => {
    if (!loaded) return;
    const url = new URL(window.location.href);
    if (tab === 'perks') url.searchParams.set('tab', 'perks');
    else url.searchParams.delete('tab');
    if (plan) url.searchParams.set('p', plan);
    else url.searchParams.delete('p');
    if (url.href !== window.location.href) window.history.replaceState(window.history.state, '', url.toString());
  }, [tab, plan, loaded]);

  // Where the ticks are: on the profile only once the account's answer matches what is on screen.
  const kept: Kept = !who
    ? ACCOUNTS && account.phase === 'out'
      ? 'signin'
      : 'browser'
    : synced === who && base && sameSet(done, base.done)
      ? 'account'
      : trouble
        ? 'pending'
        : 'saving';

  const tabs = useRef<Record<LegacyTab, HTMLButtonElement | null>>({ challenges: null, perks: null });
  const open = (t: LegacyTab, focus = false) => {
    setTab(t);
    if (focus) tabs.current[t]?.focus();
  };
  const onTabKey = (e: ReactKeyboardEvent) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      open(tab === 'challenges' ? 'perks' : 'challenges', true);
    } else if (e.key === 'Home' || e.key === 'End') {
      e.preventDefault();
      open(e.key === 'Home' ? 'challenges' : 'perks', true);
    }
  };
  const goPlan = () => {
    setTab('perks');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const goChallenges = () => {
    setTab('challenges');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const tabClass = (t: LegacyTab) =>
    `flex items-center gap-3 rounded-2xl border px-4 py-2.5 text-left transition-colors ${tab === t ? 'border-gilt/60 bg-dusk text-vellum' : 'border-iron/80 bg-night/70 text-mist hover:border-ash hover:text-vellum'}`;

  return (
    <div className="space-y-6">
      <div role="tablist" aria-label="Legacy planner" className="grid gap-2 sm:flex sm:flex-wrap" onKeyDown={onTabKey}>
        <button
          ref={(el) => {
            tabs.current.challenges = el;
          }}
          type="button"
          role="tab"
          id="legacy-tab-challenges"
          aria-selected={tab === 'challenges'}
          aria-controls="legacy-panel-challenges"
          tabIndex={tab === 'challenges' ? 0 : -1}
          onClick={() => open('challenges')}
          className={tabClass('challenges')}
        >
          <WowIcon icon="inv_misc_book_09" size={30} name="Challenges" eager />
          <span>
            <span className="block font-display text-[1.15rem] leading-tight">Challenges</span>
            <span className="num block text-[13px] text-fog">
              {earned} of {data.total} points earned
            </span>
          </span>
        </button>
        <button
          ref={(el) => {
            tabs.current.perks = el;
          }}
          type="button"
          role="tab"
          id="legacy-tab-perks"
          aria-selected={tab === 'perks'}
          aria-controls="legacy-panel-perks"
          tabIndex={tab === 'perks' ? 0 : -1}
          onClick={() => open('perks')}
          className={tabClass('perks')}
        >
          <WowIcon icon="inv_shield_06" size={30} name="Perks" eager />
          <span>
            <span className="block font-display text-[1.15rem] leading-tight">Perk planner</span>
            <span className="num block text-[13px] text-fog">
              {spent} of {cap} points planned
            </span>
          </span>
        </button>
      </div>

      {tab === 'challenges' ? (
        <div id="legacy-panel-challenges" role="tabpanel" aria-labelledby="legacy-tab-challenges">
          <Challenges data={data} classes={classes} places={places} done={done} setDone={setDone} earned={earned} spent={spent} onPlan={goPlan} kept={kept} />
        </div>
      ) : (
        <div id="legacy-panel-perks" role="tabpanel" aria-labelledby="legacy-tab-perks">
          <Perks data={data} ranks={ranks} order={order} setOrder={changePlan} onUndo={undo} canUndo={past.length > 0} earned={earned} onChallenges={goChallenges} />
        </div>
      )}

      <style>{`
        .lp-btn{display:inline-flex;align-items:center;gap:.4rem;height:2.4rem;padding:0 1rem;border-radius:999px;background:rgb(255 255 255/.06);box-shadow:inset 0 0 0 1px rgb(255 255 255/.1);color:var(--color-parch);font-size:14.5px;font-weight:600;transition:background-color .15s,color .15s}
        .lp-btn:hover:not(:disabled){background:rgb(255 255 255/.11);color:var(--color-vellum)}
        .lp-btn:disabled{opacity:.45;cursor:default}
        .lp-btn-primary{background:var(--color-gilt);color:#1a1204;box-shadow:inset 0 1px 0 rgb(255 255 255/.45)}
        .lp-btn-primary:hover:not(:disabled){background:var(--color-gilt-bright);color:#1a1204}
      `}</style>
    </div>
  );
}

/* ── Challenges ────────────────────────────────────────────────────────── */

function Check({ on, label, onToggle }: { on: boolean; label: string; onToggle: () => void }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={on}
      aria-label={label}
      title={label}
      onClick={onToggle}
      className={`grid size-8 shrink-0 place-items-center rounded-xl border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gilt ${on ? 'border-gilt bg-gilt/20 text-gilt-bright' : 'border-iron/70 bg-abyss/50 text-transparent hover:border-ash'}`}
    >
      <svg viewBox="0 0 16 16" className="size-4" aria-hidden>
        <path d="m3.5 8.5 3 3 6-7" fill="none" stroke="currentColor" strokeWidth="2" />
      </svg>
    </button>
  );
}

function SectionHead({ title, count, total, children }: { title: string; count: number; total: number; children?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
      <div>
        <h2 className="font-display text-[1.45rem] text-vellum">{title}</h2>
        {children && <p className="mt-0.5 text-[14px] text-mist">{children}</p>}
      </div>
      <span className="num text-[14px] text-mist">
        {count} of {total}
      </span>
    </div>
  );
}

/** "Reach the rank of Knight-Lieutenant or Blood Guard in …" -> "Knight-Lieutenant or Blood Guard" */
const rankTitle = (desc: string) => /rank of (.+?) in the/.exec(desc)?.[1] ?? '';

function Challenges({
  data,
  classes,
  places,
  done,
  setDone,
  earned,
  spent,
  onPlan,
  kept,
}: {
  data: LegacyData;
  classes: ClassLite[];
  places: Record<string, string>;
  done: Set<string>;
  setDone: (fn: (d: Set<string>) => Set<string>) => void;
  earned: number;
  spent: number;
  onPlan: () => void;
  /** Where the ticks are kept: on the profile, or in this browser (with a way to sign in when accounts are on). */
  kept: Kept;
}) {
  const { challenges } = data;
  const toggle = (key: string) => setDone((d) => toggleChallenge(challenges, d, key));
  const has = (k: string) => done.has(k);
  const place = (slug?: string) => (slug ? (places[slug] ?? slug) : '');
  // The game lists a raid's encounters under its text ("Defeat the following encounters in …"): every boss there.
  const raidGoal = (c: LegacyChallenge) => `${c.raid === 'onyxias-lair' ? 'Defeat Onyxia in' : 'Defeat every boss in'} ${/ in the /.test(c.desc) ? 'the ' : ''}`;
  const label = (c: LegacyChallenge) => `${c.name}: ${c.raid ? `${raidGoal(c)}${place(c.raid)}.` : c.desc}`;
  const inGroup = (g: LegacyChallenge['group']) => challenges.filter((c) => c.group === g);
  const count = (list: LegacyChallenge[]) => list.filter((c) => done.has(c.key)).length;

  const classRows = classes.map((cls) => ({ cls, steps: challenges.filter((c) => c.cls === cls.slug).sort((a, b) => (a.step ?? 0) - (b.step ?? 0)) }));
  const classSteps = classRows[0]?.steps ?? [];
  const profs = [...new Set(inGroup('crafting').map((c) => c.prof!))].map((key) => challenges.filter((c) => c.prof === key).sort((a, b) => (a.step ?? 0) - (b.step ?? 0)));
  const ranks = challenges.filter((c) => c.ladder === 'rank');
  const weeks = challenges.filter((c) => c.ladder === 'season');
  const exalted = inGroup('pvp').filter((c) => c.bg);
  const spelunkers = inGroup('dungeons').filter((c) => c.dungeons);
  const raids = inGroup('dungeons').filter((c) => c.raid);
  const other = inGroup('other');

  const [clearing, setClearing] = useState(false);
  useEffect(() => {
    if (!clearing) return;
    const t = setTimeout(() => setClearing(false), 4000);
    return () => clearTimeout(t);
  }, [clearing]);

  const tierHead = (c: LegacyChallenge) => c.name.split(' ')[0];

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="min-w-0 space-y-6">
        <section className="frame p-5">
          <SectionHead title="Classes" count={count(inGroup('classes'))} total={inGroup('classes').length}>
            The first time a character of each class reaches the level. Ticking a level ticks the ones before it.
          </SectionHead>
          <div className="scroll-thin mt-3 overflow-x-auto">
            <table className="w-full table-fixed text-[15px]">
              <colgroup>
                <col />
                {classSteps.map((s) => (
                  <col key={s.key} className="w-[56px] sm:w-[22%]" />
                ))}
              </colgroup>
              <thead>
                <tr className="text-left text-[13.5px] text-mist">
                  <th className="pb-2 font-normal">Class</th>
                  {classSteps.map((s) => (
                    <th key={s.key} className="pb-2 text-center font-normal">
                      <span className="hidden text-parch sm:block">{tierHead(s)}</span>
                      <span className="num block text-[12.5px] text-fog">level {s.level}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {classRows.map(({ cls, steps }) => (
                  <tr key={cls.slug} className="border-t border-iron/50">
                    <td className="py-1.5">
                      <span className="flex min-w-0 items-center gap-2" style={{ color: cls.color }}>
                        <WowIcon icon={cls.icon} size={24} name={cls.name} />
                        <span className="truncate">{cls.name}</span>
                      </span>
                    </td>
                    {steps.map((s) => (
                      <td key={s.key} className="py-1.5 text-center">
                        <span className="inline-block">
                          <Check on={has(s.key)} label={label(s)} onToggle={() => toggle(s.key)} />
                        </span>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="frame p-5">
          <SectionHead title="Crafting" count={count(inGroup('crafting'))} total={inGroup('crafting').length}>
            The first time you reach each skill in a crafting tradeskill. Gathering tradeskills do not count.
          </SectionHead>
          <div className="scroll-thin mt-3 overflow-x-auto">
            <table className="w-full table-fixed text-[15px]">
              <colgroup>
                <col />
                {(profs[0] ?? []).map((s) => (
                  <col key={s.key} className="w-[56px] sm:w-[22%]" />
                ))}
              </colgroup>
              <thead>
                <tr className="text-left text-[13.5px] text-mist">
                  <th className="pb-2 font-normal">Tradeskill</th>
                  {(profs[0] ?? []).map((s) => (
                    <th key={s.key} className="pb-2 text-center font-normal">
                      <span className="hidden text-parch sm:block">{tierHead(s)}</span>
                      <span className="num block text-[12.5px] text-fog">skill {s.skill}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {profs.map((steps) => (
                  <tr key={steps[0].prof} className="border-t border-iron/50">
                    <td className="py-1.5">
                      <span className="flex min-w-0 items-center gap-2 text-parch">
                        <WowIcon icon={steps[0].icon} size={24} name={steps[0].profName} />
                        <span className="truncate">{steps[0].profName}</span>
                      </span>
                    </td>
                    {steps.map((s) => (
                      <td key={s.key} className="py-1.5 text-center">
                        <span className="inline-block">
                          <Check on={has(s.key)} label={label(s)} onToggle={() => toggle(s.key)} />
                        </span>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="frame p-5">
          <SectionHead title="PvP" count={count(inGroup('pvp'))} total={inGroup('pvp').length} />
          <h3 className="mt-4 text-[15px] font-semibold text-parch">Honor rank</h3>
          <p className="text-[13.5px] text-mist">Ranks are climbed in order, so ticking one ticks the ranks below it.</p>
          <ol className="mt-2 grid gap-2 sm:grid-cols-5">
            {ranks.map((c) => (
              <li key={c.key} className="flex items-center gap-2.5 rounded-xl border border-iron/60 bg-abyss/40 px-2.5 py-2 sm:flex-col sm:items-start">
                <Check on={has(c.key)} label={label(c)} onToggle={() => toggle(c.key)} />
                <span className="min-w-0">
                  <span className={`block text-[15px] ${has(c.key) ? 'text-vellum' : 'text-parch'}`}>{c.name}</span>
                  <span className="block text-[12.5px] leading-snug text-fog">{rankTitle(c.desc)}</span>
                </span>
              </li>
            ))}
          </ol>
          <h3 className="mt-5 text-[15px] font-semibold text-parch">Field of Honor journey</h3>
          <p className="text-[13.5px] text-mist">The PvP season&rsquo;s weekly journey, done week by week.</p>
          <ol className="mt-2 grid gap-2 sm:grid-cols-3">
            {weeks.map((c) => (
              <li key={c.key} className="flex items-center gap-2.5 rounded-xl border border-iron/60 bg-abyss/40 px-2.5 py-2">
                <Check on={has(c.key)} label={label(c)} onToggle={() => toggle(c.key)} />
                <span className={`text-[15px] ${has(c.key) ? 'text-vellum' : 'text-parch'}`}>Week {c.week}</span>
              </li>
            ))}
          </ol>
          <h3 className="mt-5 text-[15px] font-semibold text-parch">Exalted with a battleground faction</h3>
          <ul className="mt-2 grid gap-2 sm:grid-cols-2">
            {exalted.map((c) => (
              <li key={c.key} className="flex items-center gap-2.5 rounded-xl border border-iron/60 bg-abyss/40 px-2.5 py-2">
                <Check on={has(c.key)} label={label(c)} onToggle={() => toggle(c.key)} />
                <span className="min-w-0">
                  <Link href={`/dungeons/${c.bg}`} className={`block text-[15px] hover:text-gilt-bright ${has(c.key) ? 'text-vellum' : 'text-parch'}`}>
                    {c.bgName}
                  </Link>
                  <span className="block text-[12.5px] leading-snug text-fog">
                    <span className="text-[#a9c8f5]">{c.factions?.alliance.name}</span> or <span className="text-[#f5a196]">{c.factions?.horde.name}</span>
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section className="frame p-5">
          <SectionHead title="Dungeons and raids" count={count(inGroup('dungeons'))} total={inGroup('dungeons').length}>
            Each dungeon challenge asks for the final boss of every dungeon on its list.
          </SectionHead>
          <ul className="mt-3 space-y-2">
            {spelunkers.map((c) => (
              <li key={c.key} className="flex items-start gap-3 rounded-xl border border-iron/60 bg-abyss/40 px-3 py-2.5">
                <Check on={has(c.key)} label={label(c)} onToggle={() => toggle(c.key)} />
                <div className="min-w-0">
                  <div className={`text-[15px] ${has(c.key) ? 'text-vellum' : 'text-parch'}`}>
                    {c.name} <span className="text-[13px] text-fog">levels {c.band}</span>
                  </div>
                  <p className="mt-0.5 text-[13.5px] leading-relaxed text-mist">
                    {c.dungeons!.map((d, i) => (
                      <span key={i}>
                        {i > 0 && ', '}
                        {d.either ? (
                          <>
                            <Link href={`/dungeons/${d.either[0]}`} className="text-parch hover:text-gilt-bright">
                              {place(d.either[0])}
                            </Link>{' '}
                            or{' '}
                            <Link href={`/dungeons/${d.either[1]}`} className="text-parch hover:text-gilt-bright">
                              {place(d.either[1])}
                            </Link>
                          </>
                        ) : (
                          <>
                            <Link href={`/dungeons/${d.slug}`} className="text-parch hover:text-gilt-bright">
                              {place(d.slug)}
                            </Link>
                            {d.parts && ` (${d.parts})`}
                          </>
                        )}
                      </span>
                    ))}
                  </p>
                </div>
              </li>
            ))}
            {raids.map((c) => (
              <li key={c.key} className="flex items-center gap-3 rounded-xl border border-iron/60 bg-abyss/40 px-3 py-2.5">
                <Check on={has(c.key)} label={label(c)} onToggle={() => toggle(c.key)} />
                <div className="min-w-0">
                  <div className={`text-[15px] ${has(c.key) ? 'text-vellum' : 'text-parch'}`}>{c.name}</div>
                  <p className="text-[13.5px] text-mist">
                    {raidGoal(c)}
                    <Link href={`/dungeons/${c.raid}`} className="text-parch hover:text-gilt-bright">
                      {place(c.raid)}
                    </Link>
                    .
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="frame p-5">
          <SectionHead title="Other" count={count(other)} total={other.length} />
          <ul className="mt-3 space-y-2">
            {other.map((c) => (
              <li key={c.key} className="flex items-center gap-3 rounded-xl border border-iron/60 bg-abyss/40 px-3 py-2.5">
                <Check on={has(c.key)} label={label(c)} onToggle={() => toggle(c.key)} />
                <WowIcon icon={c.icon} size={28} name={c.name} />
                <div className="min-w-0">
                  <div className={`text-[15px] ${has(c.key) ? 'text-vellum' : 'text-parch'}`}>{c.name}</div>
                  <p className="text-[13.5px] text-mist">{c.desc}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <aside className="space-y-4">
        <section className="frame gilt p-5 xl:sticky xl:top-[88px]">
          <div className="text-[14px] text-mist">Legacy Points earned</div>
          <div className="num mt-1 text-[3rem] font-bold leading-none text-vellum">
            {earned}
            <span className="text-[1.3rem] text-fog"> / {data.total}</span>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-iron" role="progressbar" aria-valuemin={0} aria-valuemax={data.total} aria-valuenow={earned} aria-label="Legacy Points earned">
            <div className="h-2 rounded-full bg-gilt transition-[width]" style={{ width: `${(earned / data.total) * 100}%` }} />
          </div>
          <p className="mt-3 text-[14.5px] leading-relaxed text-parch">
            Every character on the account shares them and spends up to <strong className="text-vellum">{data.points}</strong> on its own perks at launch.{' '}
            {earned >= data.points ? 'You have enough to fill every character.' : `${data.points - earned} more to fill a character.`}
          </p>
          <ul className="mt-3 space-y-1 text-[14px]">
            {data.groups.map((g) => (
              <li key={g.id} className="flex justify-between text-mist">
                <span>{g.name}</span>
                <span className="num text-parch">
                  {count(inGroup(g.id))} / {g.count}
                </span>
              </li>
            ))}
          </ul>
          <button type="button" onClick={onPlan} className="lp-btn lp-btn-primary mt-4 w-full justify-center">
            {spent ? `Your perk plan: ${spent} of ${data.points}` : 'Plan your perks'}
          </button>
          <div className="mt-3 flex items-center justify-between gap-3 text-[13px] text-fog">
            {kept === 'account' ? (
              <span>Kept on your profile.</span>
            ) : kept === 'saving' ? (
              <span>Saving to your profile…</span>
            ) : kept === 'pending' ? (
              <span>Not on your profile yet.</span>
            ) : kept === 'signin' ? (
              <span>
                Saved in this browser.{' '}
                <a href={typeof window === 'undefined' ? '/signin' : signInHref()} className="text-mist underline decoration-white/20 underline-offset-2 hover:text-parch">
                  Sign in
                </a>{' '}
                to keep it everywhere.
              </span>
            ) : (
              <span>Saved in this browser.</span>
            )}
            <button
              type="button"
              disabled={!done.size}
              onClick={() => {
                if (clearing) {
                  setDone(() => new Set());
                  setClearing(false);
                } else setClearing(true);
              }}
              className={`rounded-lg px-2 py-1 disabled:opacity-40 ${clearing ? 'bg-blood/20 text-[#f19a88]' : 'hover:text-parch'}`}
            >
              {clearing ? 'Click again to clear' : 'Clear all'}
            </button>
          </div>
        </section>
      </aside>
    </div>
  );
}

/* ── Perks ─────────────────────────────────────────────────────────────── */

function Perks({
  data,
  ranks,
  order,
  setOrder,
  onUndo,
  canUndo,
  earned,
  onChallenges,
}: {
  data: LegacyData;
  ranks: PerkRanks;
  order: string[];
  setOrder: (o: string[]) => void;
  onUndo: () => void;
  canUndo: boolean;
  earned: number;
  onChallenges: () => void;
}) {
  const { trees } = data;
  const cap = data.points;
  const spent = order.length;
  const left = cap - spent;
  const touch = useIsTouch();
  const [hover, setHover] = useState<{ id: string; rect: DOMRect } | null>(null);
  const [pinned, setPinned] = useState<string | null>(null);
  const [treeTab, setTreeTab] = useState(0);
  const [copied, setCopied] = useState(false);
  const [showBuilds, setShowBuilds] = useState(false);
  const planCode = encodePlan(trees, order);
  const currentBuild = data.builds.find((b) => b.code === planCode)?.id;
  const loadBuild = (code: string) => {
    setOrder(ranksFromOrder(trees, decodePlan(trees, code), cap).order);
    setShowBuilds(false);
  };

  const add = useCallback(
    (id: string) => {
      if (perkBlock(trees, ranks, id, cap) !== null) return false;
      setOrder([...order, id]);
      return true;
    },
    [trees, ranks, order, cap, setOrder],
  );
  const remove = useCallback(
    (id: string) => {
      if (!perkCanRemove(trees, ranks, id)) return false;
      const i = order.lastIndexOf(id);
      if (i < 0) return false;
      setOrder(orderWithout(trees, order, i, cap).order);
      return true;
    },
    [trees, ranks, order, cap, setOrder],
  );
  // The last point of a plan can always come out: every earlier point was legal before it.
  const removeLast = () => setOrder(order.slice(0, -1));
  const resetTree = (tree: LegacyTree) => {
    const ids = new Set(tree.perks.map((p) => p.id));
    setOrder(ranksFromOrder(trees, order.filter((id) => !ids.has(id)), cap).order);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof Element && e.target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="dialog"]')) return;
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'z' && canUndo) {
        e.preventDefault();
        onUndo();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onUndo, canUndo]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };

  const pts = trees.map((t) => treeSpent(t, ranks));
  // the name Save suggests: Grimoire's build by its name, else the tree the plan leans into
  const saveName = data.builds.find((b) => b.id === currentBuild)?.name ?? (spent ? `${trees[pts.indexOf(Math.max(...pts))].name} Legacy build` : 'Legacy build');
  const shown = hover?.id ?? (touch ? pinned : null);
  const shownInfo = shown ? findPerk(trees, shown) : null;
  const shownSlot = shown?.startsWith('slot:') ? shown : null;
  const short = Math.max(0, spent - earned);

  return (
    <div className="space-y-6">
      <div className="frame gilt flex flex-wrap items-center gap-x-8 gap-y-4 px-5 py-4">
        <dl className="flex flex-wrap gap-x-7 gap-y-2">
          <div>
            <dt className="text-[13px] text-fog">Points</dt>
            <dd className="num text-[1.5rem] font-bold leading-tight text-vellum">
              {spent} <span className="text-[1rem] text-fog">/ {cap}</span>
            </dd>
          </div>
          <div>
            <dt className="text-[13px] text-fog">Left</dt>
            <dd className={`num text-[1.5rem] font-bold leading-tight ${left ? 'text-tt-green' : 'text-gilt-bright'}`}>{left}</dd>
          </div>
          <div>
            <dt className="text-[13px] text-fog">{trees.map((t) => t.name).join(' / ')}</dt>
            <dd className="num text-[1.5rem] font-bold leading-tight text-vellum">{pts.join(' / ')}</dd>
          </div>
        </dl>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {data.builds.length > 0 && (
            <button type="button" onClick={() => setShowBuilds((v) => !v)} aria-expanded={showBuilds} aria-controls="legacy-builds" className="lp-btn">
              Grimoire builds
              <svg viewBox="0 0 12 12" className={`size-3 transition-transform ${showBuilds ? 'rotate-180' : ''}`} aria-hidden>
                <path d="m3 4.5 3 3 3-3" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          )}
          <button type="button" onClick={onUndo} disabled={!canUndo} className="lp-btn" title="Undo the last change (Ctrl+Z)">
            Undo
          </button>
          <button type="button" onClick={() => setOrder([])} disabled={!order.length} className="lp-btn">
            Reset
          </button>
          <SaveBuild kind="legacy" path={`/tools/legacy?tab=perks&p=${planCode}`} name={saveName} disabled={!order.length} className="lp-btn" />
          <button type="button" onClick={copy} className="lp-btn lp-btn-primary">
            {copied ? 'Link copied' : 'Copy link'}
          </button>
        </div>
        <p className="w-full text-[14.5px] text-parch">
          {spent === 0 ? (
            <>
              Each character spends up to {cap} points at launch, one per rank. Click a perk to add a point, right-click it (or press Delete) to take one back
              {data.builds.length > 0 && !showBuilds ? (
                <>
                  , or start from one of{' '}
                  <button type="button" onClick={() => setShowBuilds(true)} className="text-gilt-bright underline decoration-gilt/40 underline-offset-2 hover:decoration-gilt">
                    Grimoire&rsquo;s builds
                  </button>
                </>
              ) : null}
              .
            </>
          ) : short > 0 ? (
            <>
              This plan uses {spent} points and your ticked challenges give {earned}: {short} more to go.{' '}
              <button type="button" onClick={onChallenges} className="text-gilt-bright underline decoration-gilt/40 underline-offset-2 hover:decoration-gilt">
                Tick your challenges
              </button>
            </>
          ) : (
            <>Your ticked challenges ({earned} points) cover this plan.</>
          )}
        </p>
        {showBuilds && (
          <div
            id="legacy-builds"
            className="grid w-full gap-2 sm:grid-cols-2 xl:grid-cols-4"
            onKeyDown={(e) => {
              if (e.key === 'Escape') setShowBuilds(false);
            }}
          >
            {data.builds.map((b) => {
              const top = trees[b.points.indexOf(Math.max(...b.points))];
              const on = b.id === currentBuild;
              return (
                <button
                  key={b.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => loadBuild(b.code)}
                  className={`flex items-start gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors ${on ? 'border-gilt/60 bg-dusk' : 'border-iron/70 bg-abyss/50 hover:border-ash'}`}
                >
                  <WowIcon icon={top?.icon} size={30} name={top?.name ?? b.name} />
                  <span className="min-w-0">
                    <span className="flex flex-wrap items-baseline gap-x-2">
                      <span className="text-[15px] font-medium text-vellum">{b.name}</span>
                      <span className="num text-[13px] text-gilt">{b.points.join('/')}</span>
                    </span>
                    <span className="mt-0.5 block text-[13px] leading-snug text-mist">{b.summary}</span>
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="flex gap-1.5 lg:hidden" role="group" aria-label="Show a perk tree">
        {trees.map((t, i) => (
          <button
            key={t.id}
            type="button"
            aria-pressed={treeTab === i}
            aria-controls={`legacy-tree-${t.id}`}
            onClick={() => setTreeTab(i)}
            aria-label={`${t.name}, ${pts[i]} points`}
            className={`flex min-w-0 flex-1 items-center justify-center gap-2 rounded-xl border px-2 py-2 text-[14.5px] ${treeTab === i ? 'border-gilt/60 bg-dusk text-vellum' : 'border-iron/70 bg-abyss/50 text-mist'}`}
          >
            <WowIcon icon={t.icon} size={20} name={t.name} />
            <span className="hidden truncate min-[420px]:inline">{t.name}</span>
            <span className="num text-gilt">{pts[i]}</span>
          </button>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-3 xl:gap-6">
        {trees.map((tree, i) => (
          <div key={tree.id} id={`legacy-tree-${tree.id}`} className={`${treeTab === i ? 'block' : 'hidden'} min-w-0 lg:block`}>
            <TreeView
              tree={tree}
              trees={trees}
              ranks={ranks}
              points={pts[i]}
              cap={cap}
              onAdd={add}
              onRemove={remove}
              onReset={() => resetTree(tree)}
              onHover={(id, rect) => setHover(id ? { id, rect: rect! } : null)}
              touch={touch}
              pinned={pinned}
              onPin={(id) => setPinned((p) => (p === id ? null : id))}
            />
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <OrderStrip trees={trees} order={order} onRemoveLast={removeLast} />
        <PlanSummary trees={trees} ranks={ranks} />
      </div>

      <div className="space-y-1 text-[13.5px] leading-relaxed text-fog">
        <p>
          Perks, ranks and what opens them come from the Forever beta client ({data.source.replace(/^Forever beta client /, 'build ')}) through{' '}
          <a href="https://talentsforever.com" target="_blank" rel="noopener noreferrer" className="text-mist underline decoration-white/20 underline-offset-2 hover:text-parch">
            talentsforever.com
          </a>{' '}
          (
          <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer" className="text-mist underline decoration-white/20 underline-offset-2 hover:text-parch">
            CC BY 4.0
          </a>
          ). Blizzard can still change them before launch.
        </p>
        <p>The question marks are slots the game says will get perks in a future update.</p>
      </div>

      {shownSlot && <SlotTip rect={hover?.rect} touch={touch && !hover} onClose={() => setPinned(null)} />}
      {shownInfo && (
        <PerkTip
          tree={shownInfo.tree}
          perk={shownInfo.perk}
          ranks={ranks}
          rect={hover?.rect}
          touch={touch && !hover}
          canAdd={perkBlock(trees, ranks, shownInfo.perk.id, cap) === null}
          canRemove={perkCanRemove(trees, ranks, shownInfo.perk.id)}
          full={spent >= cap}
          onAdd={() => add(shownInfo.perk.id)}
          onRemove={() => remove(shownInfo.perk.id)}
          onClose={() => setPinned(null)}
        />
      )}
    </div>
  );
}

function TreeView({
  tree,
  trees,
  ranks,
  points,
  cap,
  onAdd,
  onRemove,
  onReset,
  onHover,
  touch,
  pinned,
  onPin,
}: {
  tree: LegacyTree;
  trees: LegacyTree[];
  ranks: PerkRanks;
  points: number;
  cap: number;
  onAdd: (id: string) => boolean;
  onRemove: (id: string) => boolean;
  onReset: () => void;
  onHover: (id: string | null, rect?: DOMRect) => void;
  touch: boolean;
  pinned: string | null;
  onPin: (id: string) => void;
}) {
  const byId = new Map(tree.perks.map((p) => [p.id, p]));
  const arrows = tree.perks
    .filter((p) => p.req && byId.has(p.req))
    .map((p) => {
      const from = byId.get(p.req!)!;
      return { from, to: p, lit: (ranks[from.id] ?? 0) >= from.max };
    });
  const total = trees.reduce((n, t) => n + treeSpent(t, ranks), 0);
  return (
    <section aria-label={`${tree.name} perks`} className="frame relative overflow-hidden" style={{ background: 'radial-gradient(120% 60% at 50% 0%, rgb(242 182 64 / .09), transparent 60%), linear-gradient(180deg, rgb(18 20 24 / .97), rgb(9 10 12 / .98))' }}>
      <header className="flex items-center gap-2.5 border-b border-iron/80 px-4 py-2.5">
        <WowIcon icon={tree.icon} size={28} name={tree.name} />
        <div className="min-w-0 flex-1 truncate font-display text-[1.12rem] leading-tight text-vellum">{tree.name}</div>
        <span className="num text-[1.35rem] font-bold text-gilt-bright">{points}</span>
        <button type="button" onClick={onReset} disabled={!points} aria-label={`Reset ${tree.name}`} className="ml-1 rounded-xl p-1.5 text-fog hover:bg-dusk hover:text-vellum disabled:opacity-30">
          <svg viewBox="0 0 16 16" className="size-4" aria-hidden>
            <path d="M3 8a5 5 0 1 0 1.5-3.6M3 3v3h3" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </header>
      <div className="relative mx-auto" style={{ width: TREE_W, height: TREE_H }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={iconUrl(tree.icon)}
          alt=""
          aria-hidden
          data-fallback="hide"
          onError={(e) => {
            e.currentTarget.style.display = 'none';
          }}
          className="pointer-events-none absolute left-1/2 top-1/2 size-[210px] -translate-x-1/2 -translate-y-1/2 rounded-full object-cover opacity-[0.06] blur-[2px] grayscale"
        />
        <svg className="pointer-events-none absolute inset-0" width={TREE_W} height={TREE_H} aria-hidden>
          {arrows.map(({ from, to, lit }) => {
            const color = lit ? '#e8c96b' : '#4d4237';
            let d: string;
            let head: string;
            if (from.row === to.row) {
              const dir = to.col > from.col ? 1 : -1;
              const y = cy(from.row) + CELL / 2;
              const sx = dir > 0 ? cx(from.col) + CELL + 2 : cx(from.col) - 2;
              const ex = dir > 0 ? cx(to.col) - 7 : cx(to.col) + CELL + 7;
              d = `M${sx} ${y} L${ex} ${y}`;
              head = `M${ex - dir * 2} ${y - 5} L${ex + dir * 5} ${y} L${ex - dir * 2} ${y + 5}`;
            } else {
              const x2 = cx(to.col) + CELL / 2;
              const down = to.row > from.row;
              const sy = down ? cy(from.row) + CELL + 2 : cy(from.row) - 2;
              const ey = down ? cy(to.row) - 7 : cy(to.row) + CELL + 7;
              const x1 = cx(from.col) + CELL / 2;
              d = from.col === to.col ? `M${x1} ${sy} L${x2} ${ey}` : `M${x1} ${sy} L${x1} ${(sy + ey) / 2} L${x2} ${(sy + ey) / 2} L${x2} ${ey}`;
              const dir = down ? 1 : -1;
              head = `M${x2 - 5} ${ey - dir * 2} L${x2} ${ey + dir * 5} L${x2 + 5} ${ey - dir * 2}`;
            }
            return (
              <g key={`${from.id}-${to.id}`} stroke={color} fill="none" strokeLinecap="round" strokeLinejoin="round">
                <path d={d} strokeWidth={lit ? 3 : 2.5} />
                <path d={head} strokeWidth={2.5} />
              </g>
            );
          })}
        </svg>
        {tree.slots.map((s) => (
          <EmptySlot key={`${s.row}-${s.col}`} row={s.row} col={s.col} onHover={onHover} touch={touch} pinned={pinned} onPin={onPin} id={`slot:${tree.id}:${s.row}:${s.col}`} />
        ))}
        {tree.perks.map((p) => (
          <PerkCell
            key={p.id}
            perk={p}
            rank={ranks[p.id] ?? 0}
            open={perkOpen(trees, ranks, p.id)}
            full={total >= cap}
            onAdd={onAdd}
            onRemove={onRemove}
            onHover={onHover}
            touch={touch}
            pinned={pinned === p.id}
            onPin={onPin}
          />
        ))}
      </div>
    </section>
  );
}

function EmptySlot({ row, col, id, onHover, touch, pinned, onPin }: { row: number; col: number; id: string; onHover: (id: string | null, rect?: DOMRect) => void; touch: boolean; pinned: string | null; onPin: (id: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div
      ref={ref}
      role="img"
      aria-label="A perk to be added in a future update"
      className={`absolute grid place-items-center rounded-[6px] border border-dashed border-iron/80 bg-abyss/40 text-[1.3rem] font-bold text-fog/70 outline-none focus-visible:ring-2 focus-visible:ring-gilt ${pinned === id ? 'ring-2 ring-gilt' : ''}`}
      style={{ left: cx(col), top: cy(row), width: CELL, height: CELL }}
      onMouseEnter={() => !touch && onHover(id, ref.current!.getBoundingClientRect())}
      onMouseLeave={() => !touch && onHover(null)}
      onFocus={() => !touch && onHover(id, ref.current!.getBoundingClientRect())}
      onBlur={() => !touch && onHover(null)}
      onClick={() => touch && onPin(id)}
    >
      ?
    </div>
  );
}

function PerkCell({
  perk,
  rank,
  open,
  full,
  onAdd,
  onRemove,
  onHover,
  touch,
  pinned,
  onPin,
}: {
  perk: LegacyPerk;
  rank: number;
  open: boolean;
  full: boolean;
  onAdd: (id: string) => boolean;
  onRemove: (id: string) => boolean;
  onHover: (id: string | null, rect?: DOMRect) => void;
  touch: boolean;
  pinned: boolean;
  onPin: (id: string) => void;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  const [flash, setFlash] = useState(false);
  const maxed = rank >= perk.max;
  // Out of points, an empty perk looks locked like in the game; one with points keeps its colour.
  const state = maxed ? 'max' : rank > 0 ? 'some' : open && !full ? 'open' : 'locked';
  const ring = state === 'max' ? '#ffd100' : state === 'locked' ? '#4a3f34' : '#1eff00';
  const rankColor = state === 'max' ? '#ffd100' : state === 'locked' ? '#8c8273' : '#1eff00';
  const bump = () => {
    setFlash(true);
    setTimeout(() => setFlash(false), 260);
  };
  return (
    <button
      ref={ref}
      type="button"
      data-perk={perk.id}
      aria-label={`${perk.name}, rank ${rank} of ${perk.max}`}
      className={`group absolute rounded-[6px] outline-none transition-transform duration-100 focus-visible:ring-2 focus-visible:ring-gilt ${flash ? 'animate-pop' : ''} ${pinned ? 'ring-2 ring-gilt' : ''}`}
      style={{ left: cx(perk.col), top: cy(perk.row), width: CELL, height: CELL }}
      onMouseEnter={() => !touch && onHover(perk.id, ref.current!.getBoundingClientRect())}
      onMouseLeave={() => !touch && onHover(null)}
      onFocus={() => !touch && onHover(perk.id, ref.current!.getBoundingClientRect())}
      onBlur={() => !touch && onHover(null)}
      onClick={(e) => {
        if (touch) {
          onPin(perk.id);
          return;
        }
        if (e.shiftKey) {
          if (onRemove(perk.id)) bump();
        } else if (onAdd(perk.id)) bump();
        onHover(perk.id, ref.current!.getBoundingClientRect());
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        if (!touch && onRemove(perk.id)) bump();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Backspace' || e.key === 'Delete' || e.key === '-') {
          e.preventDefault();
          if (onRemove(perk.id)) bump();
        } else if (e.key === '+' || e.key === '=') {
          e.preventDefault();
          if (onAdd(perk.id)) bump();
        }
      }}
    >
      <span className="absolute inset-0 overflow-hidden rounded-[6px]" style={{ boxShadow: `0 0 0 2px ${ring}${state === 'locked' ? '' : 'cc'}, 0 0 ${state === 'max' ? 14 : state === 'some' ? 10 : 0}px ${ring}55, inset 0 0 0 1px #000`, background: '#0c0907' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={iconUrl(perk.icon)}
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
      <span className="num absolute -bottom-2 -right-2.5 min-w-[30px] rounded-[3px] border border-black/80 bg-[#0c0907] px-1 text-center text-[12.5px] font-bold leading-[17px]" style={{ color: rankColor }}>
        {rank}/{perk.max}
      </span>
    </button>
  );
}

function PerkTip({
  tree,
  perk,
  ranks,
  rect,
  touch,
  canAdd,
  canRemove,
  full,
  onAdd,
  onRemove,
  onClose,
}: {
  tree: LegacyTree;
  perk: LegacyPerk;
  ranks: PerkRanks;
  rect?: DOMRect;
  touch: boolean;
  canAdd: boolean;
  canRemove: boolean;
  full: boolean;
  onAdd: () => void;
  onRemove: () => void;
  onClose: () => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<React.CSSProperties>({ opacity: 0 });
  const rank = ranks[perk.id] ?? 0;
  useEffect(() => {
    if (touch || !rect || !box.current) return;
    const w = box.current.offsetWidth;
    const h = box.current.offsetHeight;
    let x = rect.right + 14;
    if (x + w > window.innerWidth - 8) x = rect.left - w - 14;
    let y = rect.top - 6;
    if (y + h > window.innerHeight - 8) y = window.innerHeight - h - 8;
    setPos({ transform: `translate3d(${Math.max(8, x)}px, ${Math.max(8, y)}px, 0)`, opacity: 1 });
  }, [rect, touch, perk.id, rank]);
  const req = perk.req ? tree.perks.find((p) => p.id === perk.req) : undefined;
  const cur = rank > 0 ? perk.ranks[rank - 1] : perk.ranks[0];
  const next = rank > 0 && rank < perk.max ? perk.ranks[rank] : undefined;
  const content = (
    <div className="wtt w-[340px] max-w-[calc(100vw-24px)]">
      <div className="flex items-baseline justify-between gap-3">
        <span className="wtt-name text-white">{perk.name}</span>
        <span className="shrink-0 text-[13.5px] text-tt-grey">
          Rank {rank}/{perk.max}
        </span>
      </div>
      {perk.gate > 0 && !gateMet(tree, ranks, perk) && (
        <div className="text-tt-red">
          Requires {perk.gate} points in {tree.name}
        </div>
      )}
      {req && !reqMet(tree, ranks, perk) && (
        <div className="text-tt-red">
          Requires {req.max} point{req.max > 1 ? 's' : ''} in {req.name}
        </div>
      )}
      {perk.active && perk.active.length > 0 && (
        <div className="flex justify-between gap-3 text-white">
          {perk.active.map((a) => (
            <span key={a}>{a}</span>
          ))}
        </div>
      )}
      <GameText text={cur} className="mt-1 block text-tt-yellow" />
      {next && (
        <div className="mt-2.5">
          <div className="text-white">Next rank:</div>
          <GameText text={next} className="block text-tt-yellow" />
        </div>
      )}
      {!touch && <div className="mt-2 text-[12.5px] text-fog">{full && rank === 0 ? 'Every point is spent' : 'Click (or +) to add a point, right-click (or Delete) to take one back'}</div>}
      {touch && (
        <div className="mt-3 flex gap-2">
          <button type="button" onClick={onRemove} disabled={!canRemove} className="lp-btn flex-1 justify-center">
            Remove point
          </button>
          <button type="button" onClick={onAdd} disabled={!canAdd} className="lp-btn lp-btn-primary flex-1 justify-center">
            Add point
          </button>
          <button type="button" onClick={onClose} aria-label="Close" className="lp-btn">
            <svg viewBox="0 0 12 12" className="size-3" aria-hidden>
              <path d="m3 3 6 6m0-6-6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
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

/** The tooltip of a slot the game keeps for a later perk. */
function SlotTip({ rect, touch, onClose }: { rect?: DOMRect; touch: boolean; onClose: () => void }) {
  const box = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<React.CSSProperties>({ opacity: 0 });
  useEffect(() => {
    if (touch || !rect || !box.current) return;
    const w = box.current.offsetWidth;
    let x = rect.right + 14;
    if (x + w > window.innerWidth - 8) x = rect.left - w - 14;
    setPos({ transform: `translate3d(${Math.max(8, x)}px, ${Math.max(8, rect.top - 6)}px, 0)`, opacity: 1 });
  }, [rect, touch]);
  const content = (
    <div className="wtt w-[260px] max-w-[calc(100vw-24px)]">
      <div className="flex items-start justify-between gap-3">
        <span className="wtt-name text-white">Unknown</span>
        {touch && (
          <button type="button" onClick={onClose} aria-label="Close" className="text-tt-grey">
            <svg viewBox="0 0 12 12" className="size-3" aria-hidden>
              <path d="m3 3 6 6m0-6-6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
        )}
      </div>
      <div className="text-tt-yellow">To be added in a future update.</div>
    </div>
  );
  if (touch) return <div className="fixed inset-x-0 bottom-3 z-[80] flex justify-center px-3">{content}</div>;
  return (
    <div ref={box} className="pointer-events-none fixed left-0 top-0 z-[80]" style={pos}>
      {content}
    </div>
  );
}

function OrderStrip({ trees, order, onRemoveLast }: { trees: LegacyTree[]; order: string[]; onRemoveLast: () => void }) {
  return (
    <section className="frame p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-[1.2rem] text-vellum">Point order</h2>
        <p className="text-[14px] text-mist">Spend them in this order as you earn them. Undo with Ctrl+Z.</p>
      </div>
      {order.length === 0 ? (
        <p className="mt-3 text-[15px] text-fog">No points yet.</p>
      ) : (
        <ol className="mt-3 grid grid-cols-[repeat(auto-fill,minmax(42px,1fr))] gap-x-1.5 gap-y-3">
          {order.map((id, i) => {
            const info = findPerk(trees, id);
            if (!info) return null;
            return (
              <li key={i} className="flex flex-col items-center gap-1">
                <span className="relative" title={`Point ${i + 1}: ${info.perk.name}`}>
                  <WowIcon icon={info.perk.icon} size={32} name={info.perk.name} />
                  {i === order.length - 1 && (
                    <button type="button" onClick={onRemoveLast} aria-label="Take back the last point" title="Take back the last point" className="absolute -right-1.5 -top-1.5 grid size-4 place-items-center rounded-full bg-blood text-white">
                      <svg viewBox="0 0 12 12" className="size-2.5" aria-hidden>
                        <path d="m3 3 6 6m0-6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                      </svg>
                    </button>
                  )}
                </span>
                <span className="num text-[11.5px] text-fog">{i + 1}</span>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

function PlanSummary({ trees, ranks }: { trees: LegacyTree[]; ranks: PerkRanks }) {
  const picked = trees.map((t) => ({ tree: t, perks: t.perks.filter((p) => (ranks[p.id] ?? 0) > 0) })).filter((x) => x.perks.length);
  return (
    <section className="frame p-4">
      <h2 className="font-display text-[1.2rem] text-vellum">What the plan gives</h2>
      {picked.length === 0 ? (
        <p className="mt-3 text-[15px] text-fog">Pick perks to see their effects here.</p>
      ) : (
        <div className="mt-2 space-y-3">
          {picked.map(({ tree, perks }) => (
            <div key={tree.id}>
              <div className="text-[13.5px] text-gilt">{tree.name}</div>
              <ul className="mt-1 space-y-2">
                {perks.map((p) => (
                  <li key={p.id} className="flex gap-2.5">
                    <WowIcon icon={p.icon} size={28} name={p.name} />
                    <div className="min-w-0 text-[14px] leading-snug">
                      <span className="text-vellum">{p.name}</span>{' '}
                      <span className="num text-gilt-bright">
                        {ranks[p.id]}/{p.max}
                      </span>
                      <GameText text={p.ranks[(ranks[p.id] ?? 1) - 1]} className="block text-mist" />
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
