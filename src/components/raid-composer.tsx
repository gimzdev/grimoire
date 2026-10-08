'use client';

import { useEffect, useState } from 'react';
import { EFFECTS, PERSONAL_NOW, RAID_SPECS, ROLE_TARGETS, provides, type Effect } from '@/lib/raid';
import { WowIcon } from './icon';

type ClassLite = { slug: string; name: string; color: string; icon: string; specIcons: Record<string, string> };
const SIZES = [10, 20, 40] as const;
const ALPH = '0123456789abcdefghijklmnopqrstuvwxyz';
const ROLE_LABEL = { tank: 'Tanks', healer: 'Healers', melee: 'Melee', ranged: 'Ranged' } as const;

function encode(roster: (number | null)[]) {
  return roster.map((x) => (x === null ? '-' : ALPH[x])).join('');
}
function decode(s: string, size: number): (number | null)[] {
  const out: (number | null)[] = Array(size).fill(null);
  for (let i = 0; i < Math.min(size, s.length); i++) {
    const v = ALPH.indexOf(s[i]);
    out[i] = v >= 0 && v < RAID_SPECS.length ? v : null;
  }
  return out;
}

const PRESET_10 = ['warrior/protection', 'paladin/protection', 'priest/holy', 'shaman/restoration', 'druid/restoration', 'rogue/combat', 'mage/fire', 'warlock/affliction', 'hunter/marksmanship', 'warrior/fury'];

export function RaidComposer({ classes }: { classes: ClassLite[] }) {
  const [size, setSize] = useState<(typeof SIZES)[number]>(10);
  const [roster, setRoster] = useState<(number | null)[]>(() => Array(10).fill(null));
  const [selected, setSelected] = useState<number | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [booted, setBooted] = useState(false);

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const s = Number(p.get('size'));
    const sz = (SIZES as readonly number[]).includes(s) ? (s as (typeof SIZES)[number]) : 10;
    setSize(sz);
    const r = p.get('r');
    if (r) setRoster(decode(r, sz));
    else setRoster(Array.from({ length: sz }, (_, i) => (i < PRESET_10.length && sz === 10 ? RAID_SPECS.findIndex((x) => `${x.cls}/${x.spec}` === PRESET_10[i]) : null)));
    setBooted(true);
  }, []);

  useEffect(() => {
    if (!booted) return;
    window.history.replaceState(null, '', `${window.location.pathname}?size=${size}&r=${encode(roster)}`);
  }, [booted, size, roster]);

  const changeSize = (s: (typeof SIZES)[number]) => {
    setSize(s);
    setRoster((r) => {
      const filled = r.filter((x) => x !== null);
      return Array.from({ length: s }, (_, i) => filled[i] ?? null);
    });
    setSelected(null);
  };

  const add = (specIdx: number) => {
    setRoster((r) => {
      const i = r.indexOf(null);
      if (i < 0) return r;
      const next = [...r];
      next[i] = specIdx;
      return next;
    });
  };
  const remove = (i: number) => {
    setRoster((r) => r.map((x, j) => (j === i ? null : x)));
    setSelected(null);
  };
  const clickSlot = (i: number) => {
    if (selected === null) {
      if (roster[i] !== null) setSelected(i);
      return;
    }
    if (selected === i) return setSelected(null);
    setRoster((r) => {
      const next = [...r];
      [next[selected], next[i]] = [next[i], next[selected]];
      return next;
    });
    setSelected(null);
  };

  const members = roster.map((x, i) => (x === null ? null : { ...RAID_SPECS[x], slot: i, group: Math.floor(i / 5) }));
  const groups = size / 5;
  const filled = members.filter((m) => m !== null);
  const roles = { tank: 0, healer: 0, melee: 0, ranged: 0 };
  filled.forEach((m) => (roles[m.role] += 1));
  const paladins = filled.filter((m) => m.cls === 'paladin').length;

  const coverage = (() => {
    const res: Record<string, { covered: number; of: number; who: string[] }> = {};
    for (const e of EFFECTS) {
      const who = filled.filter((m) => e.providers.some((p) => provides(p, m.cls, m.spec)));
      const names = [...new Set(who.map((m) => `${m.label} ${classes.find((c) => c.slug === m.cls)?.name ?? m.cls}`))];
      if (e.scope === 'party') {
        const gs = new Set(who.map((m) => m.group));
        res[e.key] = { covered: gs.size, of: groups, who: names };
      } else if (e.key === 'might' || e.key === 'wisdom') {
        res[e.key] = { covered: paladins >= 2 ? 1 : 0, of: 1, who: names };
      } else if (e.key === 'salvation') {
        res[e.key] = { covered: paladins >= 3 ? 1 : 0, of: 1, who: names };
      } else {
        res[e.key] = { covered: who.length ? 1 : 0, of: 1, who: names };
      }
    }
    return res;
  })();

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };

  const target = ROLE_TARGETS[size];
  const row = (e: Effect) => {
    const c = coverage[e.key];
    const full = c.covered >= c.of;
    const none = c.covered === 0;
    return (
      <li key={e.key} className="border-b border-iron/50 last:border-0">
        <button type="button" onClick={() => setOpen(open === e.key ? null : e.key)} aria-expanded={open === e.key} className="flex w-full items-center gap-3 py-2 text-left">
          <span aria-hidden className={`size-2.5 shrink-0 rotate-45 ${full ? 'bg-moss' : none ? 'border border-blood bg-transparent' : 'bg-gilt'}`} />
          <span className={`flex-1 text-[15px] ${none ? 'text-mist' : 'text-vellum'}`}>{e.name}</span>
          <span className={`num shrink-0 text-[13px] ${full ? 'text-[#b9e39c]' : none ? 'text-[#ff8f86]' : 'text-gilt-bright'}`}>
            {e.scope === 'party' ? `${c.covered} of ${c.of} groups` : full ? 'Covered' : 'Missing'}
          </span>
        </button>
        {open === e.key && (
          <div className="pb-3 pl-6 text-[14px] leading-relaxed text-mist">
            <p>{e.text}</p>
            <p className="mt-1">
              {c.who.length ? (
                <>
                  <span className="text-parch">In your raid:</span> {c.who.join(', ')}
                </>
              ) : (
                <>
                  <span className="text-parch">Brought by:</span> {[...new Set(e.providers.map((p) => `${classes.find((x) => x.slug === p.cls)?.name}${p.specs ? ` (${p.specs.map((s) => RAID_SPECS.find((r) => r.cls === p.cls && r.spec === s)?.label ?? s).join(', ')})` : ''}`))].join(', ')}
                </>
              )}
            </p>
          </div>
        )}
      </li>
    );
  };

  return (
    <div className="space-y-6">
      <div className="frame flex flex-wrap items-center gap-x-6 gap-y-3 p-4">
        <div className="flex gap-1.5" role="radiogroup" aria-label="Raid size">
          {SIZES.map((s) => (
            <button key={s} type="button" role="radio" aria-checked={size === s} onClick={() => changeSize(s)} className={`h-9 rounded-full border px-3 text-[15px] ${size === s ? 'border-gilt/70 bg-gilt/15 text-gilt-bright' : 'border-iron/70 bg-abyss/50 text-parch hover:border-ash'}`}>
              {s} players
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-x-5 gap-y-1 text-[15px]">
          {(Object.keys(ROLE_LABEL) as (keyof typeof ROLE_LABEL)[]).map((r) => {
            const t = r === 'tank' || r === 'healer' ? target[r] : null;
            const ok = !t || (roles[r] >= t[0] && roles[r] <= t[1]);
            return (
              <span key={r} className="text-mist">
                {ROLE_LABEL[r]} <span className={`num font-bold ${ok ? 'text-vellum' : 'text-gilt-bright'}`}>{roles[r]}</span>
                {t && <span className="text-[13px] text-fog"> (usually {t[0] === t[1] ? t[0] : `${t[0]} to ${t[1]}`})</span>}
              </span>
            );
          })}
          <span className="num text-mist">
            {filled.length} of {size}
          </span>
        </div>
        <div className="ml-auto flex gap-2">
          <button type="button" onClick={() => setRoster(Array(size).fill(null))} className="h-9 rounded-full border border-iron/70 bg-abyss/50 px-3 text-[15px] text-parch hover:border-ash">
            Clear
          </button>
          <button type="button" onClick={copy} className="h-9 rounded-full border border-iron/70 bg-abyss/50 px-3 text-[15px] text-parch hover:border-ash">
            {copied ? 'Link copied' : 'Copy link'}
          </button>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
        <div className="space-y-6">
          <section className="frame p-4">
            <h2 className="font-display text-[1.3rem] text-vellum">Add players</h2>
            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {classes.map((c) => (
                <div key={c.slug} className="rounded-xl border border-iron bg-night/60 p-2">
                  <div className="flex items-center gap-2 text-[14.5px]" style={{ color: c.color }}>
                    <WowIcon icon={c.icon} size={22} name={c.name} />
                    {c.name}
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {RAID_SPECS.map((s, idx) =>
                      s.cls === c.slug ? (
                        <button key={s.spec} type="button" onClick={() => add(idx)} disabled={filled.length >= size} className="inline-flex items-center gap-1 rounded-lg border border-iron px-1.5 py-0.5 text-[13px] text-parch hover:border-gilt/60 hover:text-vellum disabled:opacity-40">
                          <WowIcon icon={c.specIcons[s.spec] ?? c.icon} size={16} name={s.label} />
                          {s.label}
                        </button>
                      ) : null,
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section>
            <p className="mb-2 text-[14px] text-mist">{selected === null ? 'Click a player, then another slot, to move them between groups.' : 'Now click the slot to move this player to.'}</p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: groups }, (_, g) => (
                <div key={g} className="frame p-2.5">
                  <div className="px-1 pb-1.5 text-[13.5px] text-gilt">Group {g + 1}</div>
                  <ul className="space-y-1">
                    {Array.from({ length: 5 }, (_, k) => {
                      const i = g * 5 + k;
                      const m = members[i];
                      const c = m ? classes.find((x) => x.slug === m.cls) : undefined;
                      return (
                        <li key={i} className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => clickSlot(i)}
                            className={`flex h-9 flex-1 items-center gap-2 rounded-xl border px-1.5 text-left text-[13.5px] ${selected === i ? 'border-gilt bg-gilt/15' : m ? 'border-iron bg-night/70 hover:border-ash' : 'border-dashed border-iron/80 text-fog hover:border-ash'}`}
                          >
                            {m && c ? (
                              <>
                                <WowIcon icon={c.specIcons[m.spec] ?? c.icon} size={24} name={m.label} />
                                <span className="truncate" style={{ color: c.color }}>
                                  {m.label}
                                </span>
                              </>
                            ) : (
                              <span className="pl-1">Empty</span>
                            )}
                          </button>
                          {m && (
                            <button type="button" onClick={() => remove(i)} className="grid size-7 place-items-center rounded-lg text-fog hover:bg-dusk hover:text-vellum" aria-label={`Remove ${m.label}`}>
                              <svg viewBox="0 0 12 12" className="size-3" aria-hidden>
                                <path d="m3 3 6 6M9 3l-6 6" stroke="currentColor" strokeWidth="1.5" />
                              </svg>
                            </button>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          </section>
        </div>

        <aside className="space-y-4">
          {(['buff', 'debuff', 'utility'] as const).map((k) => (
            <section key={k} className="frame p-4">
              <h2 className="font-display text-[1.3rem] text-vellum">{k === 'buff' ? 'Buffs' : k === 'debuff' ? 'Debuffs on the boss' : 'Utility'}</h2>
              <ul className="mt-1">{EFFECTS.filter((e) => e.kind === k).map(row)}</ul>
            </section>
          ))}
          <section className="frame border-gilt/40 p-4">
            <h2 className="font-display text-[1.2rem] text-gilt-bright">No longer shared in Forever</h2>
            <ul className="mt-2 space-y-1.5 text-[14.5px] text-parch">
              {PERSONAL_NOW.map((p) => (
                <li key={p.name}>
                  <span className="text-vellum">{p.name}</span> {p.text}.
                </li>
              ))}
            </ul>
          </section>
        </aside>
      </div>
    </div>
  );
}
