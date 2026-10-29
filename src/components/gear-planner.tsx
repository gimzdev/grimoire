'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DOLL, DOLL_LEFT, DOLL_RIGHT, DOLL_WEAPONS, EXTRA_WEIGHT_LABEL, PRESETS, WEIGHT_KEYS, decodeWeights, encodeWeights, rangedLabel, scoreFor, type Weights } from '@/lib/gear';
import { statLine } from '@/lib/item-format';
import type { Item, ItemSet } from '@/lib/types';
import { QUALITY_COLOR, SLOT, STAT_LABEL } from '@/lib/wow';
import { WowIcon } from './icon';
import { SaveBuild } from './save-build';

type ClassLite = { slug: string; name: string; color: string; icon: string };
type Scored = Item & { score?: number };
type SetLite = Pick<ItemSet, 'id' | 'n' | 'pieces' | 'bonus'>;
type Avail = 'forever' | 'launch' | 'all';

const AVAIL_LABEL: Record<Avail, string> = { forever: 'Items with a known source', launch: 'Plus new items not yet sourced', all: 'Everything, old raid loot too' };
type Side = 'alliance' | 'horde';

function readUrl() {
  if (typeof window === 'undefined') return null;
  const p = new URLSearchParams(window.location.search);
  return {
    cls: p.get('class'),
    spec: p.get('spec'),
    lvl: Number(p.get('lvl')) || undefined,
    src: p.get('src') as Avail | null,
    side: p.get('side') === 'horde' ? ('horde' as const) : ('alliance' as const),
    g: p.get('g'),
    w: p.get('w'),
  };
}



export function GearPlanner({ classes }: { classes: ClassLite[] }) {
  const [cls, setCls] = useState('warrior');
  const [spec, setSpec] = useState('arms');
  const [level, setLevel] = useState(60);
  const [src, setSrc] = useState<Avail>('forever');
  const [side, setSide] = useState<Side>('alliance');
  const [weights, setWeights] = useState<Weights>(PRESETS.warrior[0].weights);
  const [customWeights, setCustomWeights] = useState(false);
  const [gear, setGear] = useState<Record<string, Scored | null>>({});
  const [sets, setSets] = useState<Record<number, SetLite>>({});
  const [picker, setPicker] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [booted, setBooted] = useState(false);
  const [showWeights, setShowWeights] = useState(false);
  const [copied, setCopied] = useState(false);

  const info = classes.find((c) => c.slug === cls) ?? classes[0];
  const presets = PRESETS[cls] ?? [];
  const preset = presets.find((p) => p.key === spec) ?? presets[0];

  // Only the latest request counts: a slow answer for a class you already left is dropped
  const asked = useRef(0);
  const fill = useCallback(async (c: string, w: Weights, lvl: number, s: Avail, f: Side) => {
    const n = ++asked.current;
    setBusy(true);
    try {
      const res = await fetch(`/api/gear?class=${c}&max=${lvl}&src=${s}&side=${f}&w=${encodeURIComponent(JSON.stringify(w))}`);
      const data = await res.json();
      if (n !== asked.current) return;
      setGear(data.slots ?? {});
      setSets((prev) => ({ ...prev, ...(data.sets ?? {}) }));
    } finally {
      if (n === asked.current) setBusy(false);
    }
  }, []);

  // First load: restore a shared link, or fill the best set for the requested class.
  useEffect(() => {
    const u = readUrl();
    const c = u?.cls && PRESETS[u.cls] ? u.cls : 'warrior';
    const pr = PRESETS[c].find((p) => p.key === u?.spec) ?? PRESETS[c][0];
    const lvl = Math.min(60, Math.max(1, u?.lvl ?? 60));
    const s: Avail = u?.src && ['forever', 'launch', 'all'].includes(u.src) ? u.src : 'forever';
    const w = (u?.w && decodeWeights(u.w)) || pr.weights;
    setCls(c);
    setSpec(pr.key);
    setLevel(lvl);
    setSrc(s);
    const f: Side = u?.side ?? 'alliance';
    setSide(f);
    setWeights(w);
    setCustomWeights(Boolean(u?.w));
    const ids = (u?.g ?? '').split('.').map((x) => Number(x) || 0);
    if (ids.some(Boolean)) {
      setBusy(true);
      fetch(`/api/items?ids=${ids.filter(Boolean).join(',')}`)
        .then((r) => r.json())
        .then((data: { items: Item[]; sets: Record<number, SetLite> }) => {
          const byId = new Map(data.items.map((it) => [it.i, it]));
          const g: Record<string, Scored | null> = {};
          DOLL.forEach((d, i) => (g[d.key] = byId.get(ids[i]) ?? null));
          setGear(g);
          setSets(data.sets ?? {});
        })
        .finally(() => {
          setBusy(false);
          setBooted(true);
        });
    } else {
      fill(c, w, lvl, s, f).finally(() => setBooted(true));
    }
  }, [fill]);

  // The set as a link: kept in the address bar so it can be shared, and what Save keeps on the profile.
  const sharePath = useMemo(() => {
    const p = new URLSearchParams();
    p.set('class', cls);
    p.set('spec', spec);
    if (level !== 60) p.set('lvl', String(level));
    if (src !== 'forever') p.set('src', src);
    if (side !== 'alliance') p.set('side', side);
    // with a two-handed weapon the off-hand slot is empty, whatever it held before
    p.set('g', DOLL.map((d) => (d.key === 'offhand' && gear.mainhand?.s === 17 ? 0 : (gear[d.key]?.i ?? 0))).join('.'));
    if (customWeights) p.set('w', encodeWeights(weights));
    return `/tools/gear?${p.toString()}`;
  }, [cls, spec, level, src, side, gear, weights, customWeights]);
  useEffect(() => {
    if (booted) window.history.replaceState(null, '', sharePath);
  }, [booted, sharePath]);

  const chooseClass = (c: string) => {
    const pr = PRESETS[c][0];
    setCls(c);
    setSpec(pr.key);
    setWeights(pr.weights);
    setCustomWeights(false);
    fill(c, pr.weights, level, src, side);
  };
  const chooseSpec = (key: string) => {
    const pr = presets.find((p) => p.key === key);
    if (!pr) return;
    setSpec(key);
    setWeights(pr.weights);
    setCustomWeights(false);
    fill(cls, pr.weights, level, src, side);
  };

  const levelTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const chooseLevel = (lvl: number) => {
    setLevel(lvl);
    clearTimeout(levelTimer.current);
    levelTimer.current = setTimeout(() => fill(cls, weights, lvl, src, side), 350);
  };
  const chooseSrc = (s: Avail) => {
    setSrc(s);
    fill(cls, weights, level, s, side);
  };
  const chooseSide = (f: Side) => {
    setSide(f);
    fill(cls, weights, level, src, f);
  };

  const equip = (slot: string, it: Scored | null, newSets?: Record<number, SetLite>) => {
    // a two-handed weapon takes both hands: the off-hand comes off
    setGear((g) => ({ ...g, [slot]: it, ...(slot === 'mainhand' && it?.s === 17 ? { offhand: null } : {}) }));
    if (newSets) setSets((s) => ({ ...s, ...newSets }));
    setPicker(null);
  };

  const equipped = useMemo(() => DOLL.map((d) => (d.key === 'offhand' && gear.mainhand?.s === 17 ? null : gear[d.key])).filter((x): x is Scored => Boolean(x)), [gear]);
  const totals = useMemo(() => {
    const t: Record<string, number> = {};
    for (const it of equipped) {
      for (const [k, v] of Object.entries(it.st ?? {})) t[k] = (t[k] ?? 0) + v;
      if (it.ar) t.armor = (t.armor ?? 0) + it.ar;
    }
    return t;
  }, [equipped]);
  const totalScore = equipped.reduce((s, it) => s + scoreFor(it, weights), 0);
  const avgIlvl = equipped.length ? equipped.reduce((s, it) => s + it.l, 0) / equipped.length : 0;
  const twoHander = gear.mainhand?.s === 17;

  const setCounts = useMemo(() => {
    const m = new Map<number, number>();
    for (const it of equipped) if (it.set) m.set(it.set, (m.get(it.set) ?? 0) + 1);
    return [...m.entries()].filter(([id]) => sets[id]).map(([id, n]) => ({ set: sets[id], n }));
  }, [equipped, sets]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };

  const slotTile = (d: { key: string; label: string }, align: 'left' | 'right' = 'left') => {
    const it = gear[d.key];
    const disabled = d.key === 'offhand' && twoHander;
    const label = d.key === 'ranged' ? rangedLabel(cls) : d.label;
    const tooHigh = it && it.r > level;
    return (
      <button
        key={d.key}
        type="button"
        disabled={disabled}
        onClick={() => setPicker(d.key)}
        data-tip={it ? `item:${it.i}` : undefined}
        className={`frame group flex w-full items-center gap-3 p-2.5 text-left transition-colors hover:border-ash disabled:cursor-not-allowed disabled:opacity-40 ${align === 'right' ? 'lg:flex-row-reverse lg:text-right' : ''}`}
      >
        {it ? (
          <WowIcon icon={it.ic} size={42} quality={it.q} name={it.n} />
        ) : (
          <span className="grid size-[42px] shrink-0 place-items-center rounded-xl border border-dashed border-ash bg-abyss/60 text-[11px] text-fog">{label.slice(0, 4)}</span>
        )}
        <span className="min-w-0 flex-1">
          <span className="block text-[12.5px] text-fog">{disabled ? 'Two-hander equipped' : label}</span>
          {it ? (
            <>
              <span className="block truncate text-[15px] font-medium" style={{ color: QUALITY_COLOR[it.q] }}>
                {it.n}
              </span>
              <span className={`block truncate text-[12.5px] ${tooHigh ? 'text-tt-red' : 'text-mist'}`}>{tooHigh ? (it.nr ? `Found around level ${it.r}` : `Requires level ${it.r}`) : statLine(it, 3).join(', ') || `Item level ${it.l}`}</span>
            </>
          ) : (
            <span className="block text-[14.5px] text-mist">{disabled ? '' : 'Empty'}</span>
          )}
        </span>
      </button>
    );
  };

  const statRows = (keys: string[]) =>
    keys
      .filter((k) => totals[k])
      .map((k) => (
        <div key={k} className="flex items-baseline justify-between gap-3 py-1">
          <span className="text-[14.5px] text-mist">{k === 'armor' ? 'Armor' : STAT_LABEL[k] ?? k}</span>
          <span className="num text-[15px] text-vellum">
            {totals[k]}
          </span>
        </div>
      ));

  const weightKeys = showWeights ? WEIGHT_KEYS : WEIGHT_KEYS.filter((k) => weights[k]);

  return (
    <div className="space-y-6">
      {/* Class, spec, level and pool */}
      <div className="frame p-4">
        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Class">
          {classes.map((c) => (
            <button
              key={c.slug}
              type="button"
              role="radio"
              aria-checked={c.slug === cls}
              aria-label={c.name}
              title={c.name}
              onClick={() => chooseClass(c.slug)}
              className={`rounded-xl p-1 transition-[box-shadow,opacity] ${c.slug === cls ? 'opacity-100 shadow-[0_0_0_2px_var(--color-gilt)]' : 'opacity-60 hover:opacity-100'}`}
            >
              <WowIcon icon={c.icon} size={36} name={c.name} />
            </button>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap items-end gap-x-6 gap-y-4">
          <div>
            <div className="text-[13.5px] text-mist">Faction</div>
            <div className="mt-1 flex gap-1.5">
              {(['alliance', 'horde'] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => chooseSide(f)}
                  className={`h-9 rounded-full border px-3 text-[15px] capitalize ${side === f ? (f === 'alliance' ? 'border-alliance/70 bg-alliance/15 text-[#a9c8f5]' : 'border-horde/70 bg-horde/15 text-[#f5a196]') : 'border-iron/70 bg-abyss/50 text-parch hover:border-ash'}`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="text-[13.5px] text-mist">Spec</div>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {presets.map((p) => (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => chooseSpec(p.key)}
                  className={`h-9 rounded-full border px-3 text-[15px] ${p.key === spec ? 'border-gilt/70 bg-gilt/15 text-gilt-bright' : 'border-iron/70 bg-abyss/50 text-parch hover:border-ash'}`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
          <label className="min-w-[220px] flex-1">
            <span className="flex justify-between text-[13.5px] text-mist">
              <span>Character level</span>
              <span className="num font-bold text-vellum">{level}</span>
            </span>
            <input type="range" min={1} max={60} value={level} onChange={(e) => chooseLevel(Number(e.target.value))} className="mt-2 w-full accent-[var(--color-gilt)]" />
          </label>
          <label>
            <span className="block text-[13.5px] text-mist">Item pool</span>
            <select value={src} onChange={(e) => chooseSrc(e.target.value as Avail)} className="field mt-1 !h-9 !w-auto !px-2">
              {(Object.keys(AVAIL_LABEL) as Avail[]).map((k) => (
                <option key={k} value={k}>
                  {AVAIL_LABEL[k]}
                </option>
              ))}
            </select>
          </label>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => fill(cls, weights, level, src, side)} className="h-9 rounded-full bg-gilt shadow-[inset_0_1px_0_rgb(255_255_255/0.45)] hover:bg-gilt-bright px-4 text-[15px] font-semibold text-[#1a1204]">
              Fill best in every slot
            </button>
            <button type="button" onClick={() => setGear({})} className="h-9 rounded-full border border-iron/70 bg-abyss/50 px-3 text-[15px] text-parch hover:border-ash">
              Clear
            </button>
            <SaveBuild
              kind="gear"
              path={sharePath}
              name={`${preset?.label ?? ''} ${info.name}`.trim()}
              disabled={!booted || !equipped.length}
              className="inline-flex h-9 items-center gap-1.5 rounded-full border border-iron/70 bg-abyss/50 px-3 text-[15px] text-parch hover:border-ash disabled:opacity-50 aria-pressed:border-gilt/50 aria-pressed:text-gilt-bright"
            />
            <button type="button" onClick={copy} className="h-9 rounded-full border border-iron/70 bg-abyss/50 px-3 text-[15px] text-parch hover:border-ash">
              {copied ? 'Link copied' : 'Copy link'}
            </button>
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        {/* Paper doll */}
        <div className={`transition-opacity ${busy ? 'opacity-60' : ''}`} aria-busy={busy}>
          <div className="grid gap-3 lg:grid-cols-[1fr_minmax(200px,0.8fr)_1fr]">
            <div className="space-y-2.5">{DOLL_LEFT.map((d) => slotTile(d))}</div>
            <div className="frame gilt order-first flex flex-col items-center justify-center gap-2 p-6 text-center lg:order-none">
              <WowIcon icon={info.icon} size={76} name={info.name} />
              <div className="font-display text-[1.6rem] leading-tight" style={{ color: info.color }}>
                {preset?.label} {info.name}
              </div>
              <div className="text-[15px] text-mist">Level {level}</div>
              <dl className="mt-3 grid w-full grid-cols-2 gap-2 text-left">
                <div className="rounded-xl border border-iron bg-night/70 px-3 py-2">
                  <dt className="text-[12.5px] text-fog">Average item level</dt>
                  <dd className="num text-[1.3rem] font-bold text-vellum">{avgIlvl ? avgIlvl.toFixed(1) : '--'}</dd>
                </div>
                <div className="rounded-xl border border-iron bg-night/70 px-3 py-2">
                  <dt className="text-[12.5px] text-fog">Weighted score</dt>
                  <dd className="num text-[1.3rem] font-bold text-gilt-bright">{Math.round(totalScore)}</dd>
                </div>
              </dl>
              {busy && <div className="text-[13.5px] text-mist">Finding the best items…</div>}
            </div>
            <div className="space-y-2.5">{DOLL_RIGHT.map((d) => slotTile(d, 'right'))}</div>
          </div>
          <div className="mt-3 grid gap-2.5 sm:grid-cols-3">{DOLL_WEAPONS.map((d) => slotTile(d))}</div>
        </div>

        {/* Totals */}
        <aside className="space-y-4">
          <div className="frame p-4">
            <h2 className="font-display text-[1.3rem] text-vellum">Stats from gear</h2>
            <p className="mt-0.5 text-[13px] text-fog">Ratings shown as percentages at level 60. Base stats and talents are not included.</p>
            {equipped.length === 0 ? (
              <p className="mt-3 text-mist">Nothing equipped yet.</p>
            ) : (
              <div className="mt-2 divide-y divide-iron/60">
                <div className="py-1.5">{statRows(['str', 'agi', 'sta', 'int', 'spi'])}</div>
                <div className="py-1.5">{statRows(['atkpwr', 'rgdatkpwr', 'feratkpwr', 'splpwr', 'spldmg', 'splheal', 'shasplpwr', 'firsplpwr', 'frosplpwr', 'arcsplpwr', 'natsplpwr', 'holsplpwr'])}</div>
                <div className="py-1.5">{statRows(['hitrtng', 'critstrkrtng', 'hastertng', 'exprtng', 'armorpenrtng', 'splpen', 'manargn', 'healthrgn'])}</div>
                <div className="py-1.5">{statRows(['armor', 'armorbonus', 'defrtng', 'dodgertng', 'parryrtng', 'blockrtng', 'blockamount'])}</div>
                <div className="py-1.5">{statRows(['firres', 'frores', 'natres', 'shares', 'arcres', 'holres'])}</div>
              </div>
            )}
          </div>

          {setCounts.length > 0 && (
            <div className="frame p-4">
              <h2 className="font-display text-[1.3rem] text-vellum">Set bonuses</h2>
              {setCounts.map(({ set, n }) => (
                <div key={set.id} className="mt-3">
                  <div className="text-[15px] text-tt-yellow">
                    {set.n} <span className="num text-mist">({n}/{set.pieces.length})</span>
                  </div>
                  <ul className="mt-1 space-y-0.5 text-[14px]">
                    {(set.bonus ?? []).map(([need, text], i) => (
                      <li key={i} className={need <= n ? 'text-tt-green' : 'text-tt-grey'}>
                        ({need}) {text}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}

          <div className="frame p-4">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="font-display text-[1.3rem] text-vellum">Stat weights</h2>
              <button type="button" onClick={() => setShowWeights((s) => !s)} className="text-[14px] text-gilt hover:text-gilt-bright">
                {showWeights ? 'Hide unused' : 'Edit all'}
              </button>
            </div>
            <p className="mt-0.5 text-[13px] text-fog">Starting values for {preset?.label}. Change any number and fill again to re-rank items.</p>
            <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2">
              {weightKeys.map((k) => (
                <label key={k} className="flex items-center justify-between gap-2 text-[13.5px] text-mist">
                  <span className="truncate">{EXTRA_WEIGHT_LABEL[k] ?? STAT_LABEL[k] ?? k}</span>
                  <input
                    type="number"
                    step={0.05}
                    value={weights[k] ?? 0}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      setWeights((w) => ({ ...w, [k]: Number.isFinite(v) ? v : 0 }));
                      setCustomWeights(true);
                    }}
                    className="field num !h-8 !w-16 !px-1.5 text-right"
                  />
                </label>
              ))}
            </div>
            {customWeights && preset && (
              <button
                type="button"
                onClick={() => {
                  setWeights(preset.weights);
                  setCustomWeights(false);
                }}
                className="mt-3 text-[14px] text-gilt hover:text-gilt-bright"
              >
                Reset to {preset.label} defaults
              </button>
            )}
          </div>
        </aside>
      </div>

      {picker && <Picker slot={picker} cls={cls} level={level} src={src} side={side} weights={weights} current={gear[picker] ?? null} onPick={equip} onClose={() => setPicker(null)} />}
    </div>
  );
}

function Picker({
  slot,
  cls,
  level,
  src,
  side,
  weights,
  current,
  onPick,
  onClose,
}: {
  slot: string;
  cls: string;
  level: number;
  src: Avail;
  side: Side;
  weights: Weights;
  current: Scored | null;
  onPick: (slot: string, it: Scored | null, sets?: Record<number, SetLite>) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState('');
  const [items, setItems] = useState<Scored[] | null>(null);
  const [sets, setSets] = useState<Record<number, SetLite>>({});
  const input = useRef<HTMLInputElement>(null);
  const label = DOLL.find((d) => d.key === slot)?.label ?? slot;

  useEffect(() => {
    input.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      fetch(`/api/items?doll=${slot}&class=${cls}&max=${level}&src=${src}&side=${side}&q=${encodeURIComponent(q)}&w=${encodeURIComponent(JSON.stringify(weights))}`, { signal: ctrl.signal })
        .then((r) => r.json())
        .then((d) => {
          setItems(d.items ?? []);
          setSets(d.sets ?? {});
        })
        .catch(() => undefined);
    }, 160);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [slot, cls, level, src, side, q, weights]);

  const best = items?.[0]?.score ?? 0;
  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center bg-abyss/80 p-3 pt-[8vh] backdrop-blur-sm" onMouseDown={(e) => e.target === e.currentTarget && onClose()} role="dialog" aria-modal="true" aria-label={`Choose an item for ${label}`}>
      <div className="frame gilt flex max-h-[80vh] w-full max-w-3xl flex-col animate-pop">
        <div className="flex items-center gap-3 border-b border-iron p-3">
          <input
            ref={input}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={`Search ${label.toLowerCase()} items`}
            className="field !h-11 flex-1 !text-[16px]"
          />
          {current && (
            <button type="button" onClick={() => onPick(slot, null)} className="h-11 rounded-full border border-iron px-3 text-[14.5px] text-parch hover:border-ash">
              Unequip
            </button>
          )}
          <button type="button" onClick={onClose} className="h-11 rounded-full border border-iron px-3 text-[14.5px] text-parch hover:border-ash" aria-label="Close">
            Close
          </button>
        </div>
        <div className="scroll-thin flex-1 overflow-y-auto">
          {items === null ? (
            <div className="p-6 text-center text-mist">Loading items…</div>
          ) : items.length === 0 ? (
            <div className="p-6 text-center text-mist">No items fit this slot at level {level}. Try another item pool or a higher level.</div>
          ) : (
            <ul className="divide-y divide-iron/60">
              {items.map((it) => (
                <li key={it.i}>
                  <button type="button" data-tip={`item:${it.i}`} onClick={() => onPick(slot, it, sets)} className={`flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-dusk ${current?.i === it.i ? 'bg-gilt/10' : ''}`}>
                    <WowIcon icon={it.ic} size={36} quality={it.q} name={it.n} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15.5px] font-medium" style={{ color: QUALITY_COLOR[it.q] }}>
                        {it.n}
                      </span>
                      <span className="block truncate text-[13px] text-mist">
                        {SLOT[it.s]}
                        {it.r > 1 ? `, level ${it.r}` : ''}
                        {statLine(it, 4).length ? `: ${statLine(it, 4).join(', ')}` : ''}
                      </span>
                    </span>
                    <span className="w-24 shrink-0">
                      <span className="num block text-right text-[14px] text-vellum">{it.score ?? 0}</span>
                      <span className="mt-1 block h-1 rounded-full bg-iron">
                        <span className="block h-1 rounded-full bg-gilt" style={{ width: `${best > 0 ? Math.max(4, ((it.score ?? 0) / best) * 100) : 0}%` }} />
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
