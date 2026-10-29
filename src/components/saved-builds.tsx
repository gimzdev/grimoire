'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { deleteAccount, downloadData, removeBuild, renameBuild, seed, signOut, useAccount } from '@/lib/account';
import { KIND_LABEL, NAME_MAX, type BuildKind, type Tile } from '@/lib/accounts';
import { WowIcon } from './icon';
import { BUTTON } from './ui';

// The profile page: one section per kind of build (talent builds, Legacy builds with the account's Legacy progress, raid
// comps), sorted by class, each tile edged in its class colour. Kinds with nothing saved share one short line of links
// instead of a section each; gear sets show only when there are some, since the gear planner is paused.

export interface LegacyOverview {
  earned: number;
  total: number;
  groups: { name: string; done: number; count: number }[];
}
interface Sec {
  kind: BuildKind;
  title: string;
  icon: string;
  href: string;
  start: string;
  another: string;
  paused?: boolean;
}
const SECTIONS: Sec[] = [
  { kind: 'talents', title: 'Talent builds', icon: 'ability_marksmanship', href: '/talents', start: 'Make a talent build', another: 'New talent build' },
  { kind: 'legacy', title: 'Legacy', icon: 'inv_shield_06', href: '/tools/legacy?tab=perks', start: 'Plan Legacy perks', another: 'New Legacy build' },
  { kind: 'raid', title: 'Raid comps', icon: 'inv_banner_02', href: '/tools/raid', start: 'Build a raid comp', another: 'New raid comp' },
  { kind: 'gear', title: 'Gear sets', icon: 'inv_chest_chain_15', href: '/tools/gear', start: '', another: '', paused: true },
];
const quiet = 'text-[14.5px] font-medium text-mist underline decoration-white/20 underline-offset-4 transition-colors hover:text-vellum hover:decoration-white/50';
const action = 'inline-flex h-9 items-center rounded-full px-3 text-[14px] font-medium text-mist transition-colors hover:bg-white/[0.06] hover:text-vellum disabled:opacity-50';

// Dates in UTC, the same on the server and in the browser
const DAY = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
const DAY_YEAR = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
const MONTH = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
const day = (iso: string) => {
  const d = new Date(iso);
  return (d.getUTCFullYear() === new Date().getUTCFullYear() ? DAY : DAY_YEAR).format(d);
};

/** Points per talent tree, the tree it leans into lit. */
function Trees({ trees }: { trees: NonNullable<Tile['trees']> }) {
  const top = Math.max(...trees.map((t) => t.points));
  return (
    <ul className="grid grid-cols-3 gap-1.5" aria-label="Points by tree">
      {trees.map((t) => (
        <li key={t.name} title={`${t.name}: ${t.points}`} className={`flex items-center gap-2 rounded-xl px-2 py-1.5 ${t.points && t.points === top ? 'bg-white/[0.07]' : 'bg-white/[0.025]'}`}>
          <WowIcon icon={t.icon} size={20} name={t.name} />
          <span className={`num text-[15px] font-semibold ${t.points ? 'text-vellum' : 'text-fog'}`}>{t.points}</span>
          <span className="sr-only">{t.name}</span>
        </li>
      ))}
    </ul>
  );
}

/** A gear set's best pieces, in one row. */
function Items({ items }: { items: NonNullable<Tile['items']> }) {
  const shown = items.slice(0, 8);
  return (
    <ul className="flex items-center gap-[5px]" aria-label="Best pieces">
      {shown.map((it, i) => (
        <li key={i} title={it.name}>
          <WowIcon icon={it.icon} size={24} quality={it.q} name={it.name} />
        </li>
      ))}
      {items.length > shown.length && <li className="num pl-1 text-[13px] text-fog">+{items.length - shown.length}</li>}
    </ul>
  );
}

/** A Legacy build's perks, each with its rank. */
function Perks({ perks }: { perks: NonNullable<Tile['perks']> }) {
  return (
    <ul className="flex flex-wrap items-center gap-[6px]" aria-label="Perks">
      {perks.map((p) => (
        <li key={p.name} title={`${p.name} ${p.rank}/${p.max}`} className="relative">
          <WowIcon icon={p.icon} size={26} name={p.name} />
          <span className="num absolute -bottom-1 -right-1 rounded-[3px] bg-[#0c0907] px-[3px] text-[10.5px] font-bold leading-[13px] text-gilt-bright" aria-hidden>
            {p.rank}
          </span>
          <span className="sr-only">
            {p.rank} of {p.max}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** A raid as its slots: one square per player in their class colour, the same size whatever the raid. */
function Roster({ slots }: { slots: string[] }) {
  return (
    <div aria-hidden className="grid gap-[3px]" style={{ gridTemplateColumns: 'repeat(20, minmax(0, 1fr))' }}>
      {slots.map((c, i) => (
        <span key={i} className="aspect-square rounded-[3px]" style={{ background: c || 'rgb(255 255 255 / 0.06)' }} />
      ))}
    </div>
  );
}

function TileCard({ t, onRenamed, onRemoved }: { t: Tile; onRenamed: (t: Tile) => void; onRemoved: (t: Tile) => void }) {
  const [mode, setMode] = useState<'view' | 'rename' | 'delete'>('view');
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState(t.name);
  const field = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (mode === 'rename') field.current?.select();
  }, [mode]);

  const rename = async (e?: FormEvent) => {
    e?.preventDefault();
    const name = draft.trim();
    if (!name || name === t.name) return (setDraft(t.name), setMode('view'));
    setBusy(true);
    const next = await renameBuild(t.id, name);
    setBusy(false);
    if (next) {
      onRenamed(next);
      setMode('view');
    }
  };
  const remove = async () => {
    setBusy(true);
    if (await removeBuild(t)) onRemoved(t);
    else setBusy(false);
  };
  const cancel = () => {
    setDraft(t.name);
    setMode('view');
  };

  return (
    <li className="frame relative flex flex-col overflow-hidden">
      <span aria-hidden className="absolute inset-x-0 top-0 h-[2px]" style={{ background: t.cls?.color ?? 'var(--color-gilt)' }} />
      <div className="flex items-start gap-3.5 px-4 pb-3 pt-4">
        <WowIcon icon={t.icon} size={44} name={t.spec ?? t.name} />
        <div className="min-w-0 flex-1">
          {mode === 'rename' ? (
            <form onSubmit={rename}>
              <label htmlFor={`name-${t.id}`} className="sr-only">
                Name
              </label>
              <input
                ref={field}
                id={`name-${t.id}`}
                value={draft}
                maxLength={NAME_MAX}
                disabled={busy}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => e.key === 'Escape' && cancel()}
                className="field h-9 px-2.5 text-[15.5px] font-semibold"
              />
            </form>
          ) : (
            <h3 className="truncate text-[16.5px] font-semibold leading-snug text-vellum" title={t.name}>
              {t.name}
            </h3>
          )}
          <p className="mt-0.5 truncate text-[14px] text-mist">{t.kind === 'legacy' ? ['Legacy perks', t.spec].filter(Boolean).join(' · ') : [t.spec, t.cls?.name].filter(Boolean).join(' · ') || KIND_LABEL[t.kind]}</p>
        </div>
      </div>

      <div className="space-y-3 px-4 pb-4">
        {t.trees && <Trees trees={t.trees} />}
        {t.perks && t.perks.length > 0 && <Perks perks={t.perks} />}
        {t.items && t.items.length > 0 && <Items items={t.items} />}
        {t.roster && <Roster slots={t.roster} />}
        {t.facts.length > 0 && <p className="text-[14px] text-parch">{t.facts.join(' · ')}</p>}
      </div>

      <div className="mt-auto flex min-h-[52px] items-center gap-1 border-t border-white/[0.06] px-2 py-2">
        {mode === 'view' && (
          <>
            <Link href={t.href} className="inline-flex h-9 items-center rounded-full bg-white/[0.07] px-4 text-[14px] font-semibold text-vellum ring-1 ring-inset ring-white/[0.08] transition-colors hover:bg-gilt hover:text-[#1a1204] hover:ring-gilt">
              Open
            </Link>
            <button type="button" onClick={() => setMode('rename')} className={action}>
              Rename
            </button>
            <button type="button" onClick={() => setMode('delete')} className={action}>
              Delete
            </button>
            <span className="ml-auto pr-2 text-[12.5px] text-fog" title={`Saved ${day(t.savedAt)}`}>
              {day(t.updatedAt)}
            </span>
          </>
        )}
        {mode === 'rename' && (
          <>
            <button type="button" onClick={() => void rename()} disabled={busy} className={`${action} text-gilt-bright hover:text-gilt-bright`}>
              {busy ? 'Saving…' : 'Save name'}
            </button>
            <button type="button" onClick={cancel} disabled={busy} className={action}>
              Cancel
            </button>
          </>
        )}
        {mode === 'delete' && (
          <>
            <span className="px-2 text-[14px] text-parch">Delete this build?</span>
            <button type="button" onClick={() => void remove()} disabled={busy} className={`${action} ml-auto text-[#f5a196] hover:bg-blood/15 hover:text-[#f5a196]`}>
              {busy ? 'Deleting…' : 'Delete'}
            </button>
            <button type="button" onClick={() => setMode('view')} disabled={busy} className={action}>
              Keep
            </button>
          </>
        )}
      </div>
    </li>
  );
}

function DeleteAccount() {
  const [step, setStep] = useState<'closed' | 'ask' | 'busy'>('closed');
  const [failed, setFailed] = useState('');
  const keep = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (step === 'ask') keep.current?.focus();
  }, [step]);
  if (step === 'closed')
    return (
      <button type="button" onClick={() => setStep('ask')} className={`${quiet} hover:decoration-blood`}>
        Delete my account
      </button>
    );
  return (
    <div className="basis-full pt-2">
      <div role="group" aria-labelledby="delete-title" className="max-w-xl rounded-[20px] bg-blood/[0.08] p-5 ring-1 ring-inset ring-blood/30 sm:p-6">
        <h3 id="delete-title" className="text-lg font-semibold text-vellum">
          Delete your account?
        </h3>
        <p className="mt-2 text-[15px] text-[#f3c9c1]">This erases your email address, every build you saved and your Legacy progress, for good. It cannot be undone. Download your data first if you want a copy.</p>
        {failed && (
          <p role="alert" className="mt-3 text-[15px] font-semibold text-[#f5a196]">
            {failed}
          </p>
        )}
        <div className="mt-5 flex flex-wrap gap-3">
          <button
            type="button"
            disabled={step === 'busy'}
            onClick={async () => {
              setStep('busy');
              setFailed('');
              const problem = await deleteAccount();
              if (problem) {
                setFailed(problem);
                setStep('ask');
              }
            }}
            className={`${BUTTON.base} h-11 bg-blood text-[#1b0703] hover:bg-[#f06a54]`}
          >
            {step === 'busy' ? 'Deleting…' : 'Delete everything'}
          </button>
          <button
            ref={keep}
            type="button"
            disabled={step === 'busy'}
            onClick={() => {
              setStep('closed');
              setFailed('');
            }}
            className={`${BUTTON.base} ${BUTTON.ghost} h-11`}
          >
            Keep my account
          </button>
        </div>
      </div>
    </div>
  );
}

/** The Legacy Points this account has ticked in the planner, and how far each group of challenges is. */
function LegacyProgress({ legacy }: { legacy: LegacyOverview }) {
  return (
    <div className="frame mt-5 flex flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center sm:gap-8 sm:px-6">
      <div className="shrink-0">
        <div className="text-[13.5px] text-mist">Legacy Points</div>
        <div className="num text-[1.9rem] font-bold leading-tight text-vellum">
          {legacy.earned}
          <span className="text-[1.05rem] text-fog"> / {legacy.total}</span>
        </div>
      </div>
      <ul className="flex flex-1 flex-wrap gap-x-5 gap-y-1 text-[14px] text-mist">
        {legacy.groups.map((g) => (
          <li key={g.name}>
            {g.name} <span className="num text-parch">{g.done}/{g.count}</span>
          </li>
        ))}
      </ul>
      <Link href="/tools/legacy" className={`${quiet} shrink-0`}>
        Tick challenges
      </Link>
    </div>
  );
}

/** One kind of build: its tiles sorted by class (then the latest first). Legacy shows the account's progress first. */
function Section({ s: sec, tiles, legacy, classOrder, onRenamed, onRemoved }: { s: Sec; tiles: Tile[]; legacy?: LegacyOverview | null; classOrder: string[]; onRenamed: (t: Tile) => void; onRemoved: (t: Tile) => void }) {
  const sorted = useMemo(() => {
    const rank = (t: Tile) => (t.cls ? classOrder.indexOf(t.cls.slug) : -1);
    return [...tiles].sort((a, b) => rank(a) - rank(b) || b.updatedAt.localeCompare(a.updatedAt));
  }, [tiles, classOrder]);
  return (
    <section aria-labelledby={`kind-${sec.kind}`}>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <h2 id={`kind-${sec.kind}`} className="flex items-center gap-3 text-[1.45rem] leading-none text-vellum">
          <WowIcon icon={sec.icon} size={30} name={sec.title} rounded />
          {sec.title}
          {tiles.length > 0 && <span className="num text-[15px] font-medium text-fog">{tiles.length}</span>}
        </h2>
        {!sec.paused && (
          <Link href={sec.href} className={quiet}>
            {tiles.length ? sec.another : sec.start}
          </Link>
        )}
      </div>
      {legacy && <LegacyProgress legacy={legacy} />}
      {tiles.length > 0 && (
        <ul className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {sorted.map((t) => (
            <TileCard key={t.id} t={t} onRenamed={onRenamed} onRemoved={onRemoved} />
          ))}
        </ul>
      )}
    </section>
  );
}

/** The planners nothing was saved from yet, in one line: a new account sees only this. */
function StartRow({ sections, nothing }: { sections: Sec[]; nothing: boolean }) {
  return (
    <section aria-label="Save from a planner" className="frame flex flex-col gap-4 px-5 py-5 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
      <p className="text-[15.5px] text-mist">{nothing ? 'Nothing saved yet. Press Save in a planner and it shows up here.' : 'Also saves here:'}</p>
      <div className="flex flex-wrap gap-2">
        {sections.map((sec) => (
          <Link key={sec.kind} href={sec.href} className={`${BUTTON.base} ${nothing ? BUTTON.primary : BUTTON.ghost} h-10 gap-2 px-4 text-[14.5px]`}>
            <WowIcon icon={sec.icon} size={20} name="" rounded />
            {sec.start}
          </Link>
        ))}
      </div>
    </section>
  );
}

export function SavedBuilds({ user, tiles: first, legacy, classOrder }: { user: { email: string; since: string }; tiles: Tile[]; legacy: LegacyOverview | null; classOrder: string[] }) {
  const account = useAccount();
  const router = useRouter();
  const [tiles, setTiles] = useState(first);
  useEffect(() => setTiles(first), [first]);
  useEffect(() => seed({ email: user.email, since: user.since, saved: first.map((t) => t.href) }), [first, user.email, user.since]);
  // Back can show this page as it was: a build saved since then is missing, so ask the server again (once)
  const refreshed = useRef(false);
  useEffect(() => {
    if (refreshed.current || account.phase !== 'in' || account.email !== user.email) return;
    if (account.saved.some((href) => !tiles.some((t) => t.href === href))) {
      refreshed.current = true;
      router.refresh();
    }
  }, [account.phase, account.email, account.saved, tiles, user.email, router]);

  if (account.phase === 'out')
    return (
      <div className="frame mt-10 flex flex-col items-center px-6 py-14 text-center">
        <p className="text-xl font-semibold text-vellum">You were signed out</p>
        <p className="mx-auto mt-2 max-w-sm text-mist">Sign in again to see your saved builds.</p>
        <Link href="/signin?next=/profile" className={`${BUTTON.base} ${BUTTON.primary} mt-7`}>
          Sign in
        </Link>
      </div>
    );

  const renamed = (next: Tile) => setTiles((all) => all.map((x) => (x.id === next.id ? next : x)));
  const removed = (gone: Tile) => setTiles((all) => all.filter((x) => x.id !== gone.id));
  const shown = SECTIONS.filter((sec) => tiles.some((t) => t.kind === sec.kind) || (sec.kind === 'legacy' && legacy));
  const unused = SECTIONS.filter((sec) => !sec.paused && !shown.includes(sec));
  return (
    <>
      <div className="mt-10 space-y-12">
        {shown.map((sec) => (
          <Section key={sec.kind} s={sec} tiles={tiles.filter((t) => t.kind === sec.kind)} legacy={sec.kind === 'legacy' ? legacy : null} classOrder={classOrder} onRenamed={renamed} onRemoved={removed} />
        ))}
        {unused.length > 0 && <StartRow sections={unused} nothing={shown.length === 0} />}
      </div>

      <section aria-labelledby="account-title" className="mt-20 border-t border-white/[0.06] pt-8">
        <h2 id="account-title" className="text-[1.3rem] text-vellum">
          Your account
        </h2>
        <p className="mt-1 text-[15px] text-mist">
          <span className="break-words text-parch">{user.email}</span>
          <span className="mx-2 text-fog" aria-hidden>
            ·
          </span>
          Member since {MONTH.format(new Date(user.since))}
        </p>
        <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-3">
          <button type="button" onClick={() => void signOut()} className={`${BUTTON.base} ${BUTTON.ghost} h-10 px-5 text-[14.5px]`}>
            Sign out
          </button>
          <button type="button" onClick={() => void downloadData()} className={quiet}>
            Download my data
          </button>
          <DeleteAccount />
        </div>
      </section>
    </>
  );
}
