'use client';

import { useEffect, useState } from 'react';
import { WowIcon } from './icon';

type ClassLite = { slug: string; name: string; color: string; icon: string };

const PROFESSIONS = [
  { key: 'alchemy', name: 'Alchemy', icon: 'trade_alchemy' },
  { key: 'blacksmithing', name: 'Blacksmithing', icon: 'trade_blacksmithing' },
  { key: 'enchanting', name: 'Enchanting', icon: 'trade_engraving' },
  { key: 'engineering', name: 'Engineering', icon: 'trade_engineering' },
  { key: 'leatherworking', name: 'Leatherworking', icon: 'trade_leatherworking' },
  { key: 'tailoring', name: 'Tailoring', icon: 'trade_tailoring' },
];
const CLASS_LEVELS = [25, 45, 60];
const SKILL_LEVELS = [150, 225, 300];

const SINGLES: { cat: string; items: { key: string; label: string }[] }[] = [
  {
    cat: 'Player vs. Player',
    items: [
      ...[3, 7, 10, 13, 14].map((r) => ({ key: `rank-${r}`, label: `Reach honor rank ${r}` })),
      ...[
        ['Warsong Gulch', 'Silverwing Sentinels or Warsong Outriders'],
        ['Arathi Basin', 'League of Arathor or The Defilers'],
        ['Alterac Valley', 'Stormpike Guard or Frostwolf Clan'],
        ['Darkspear Islands', 'Theramore Expeditionary Force or Darkspear Raiders'],
      ].map(([bg, f]) => ({ key: `exalted-${bg}`, label: `Exalted with ${f}` })),
      ...[4, 7, 10].map((w) => ({ key: `season-${w}`, label: `Field of Honor season, week ${w} quest` })),
    ],
  },
  {
    cat: 'Adventure',
    items: [
      { key: 'explore', label: 'Explore the entire world map on one character' },
      { key: 'valthalak', label: 'Complete the Lord Valthalak dungeon set questline' },
    ],
  },
  {
    cat: 'Dungeons',
    items: [
      { key: 'dungeons-15', label: 'Final boss of every level 15 to 25 dungeon' },
      { key: 'dungeons-26', label: 'Final boss of every level 26 to 45 dungeon' },
      { key: 'dungeons-46', label: 'Final boss of every level 46 to 60 dungeon' },
    ],
  },
  {
    cat: 'Raids',
    items: [
      { key: 'onyxia', label: 'Defeat Onyxia' },
      { key: 'hyjal', label: 'Defeat all 13 Hyjal Summit bosses' },
      { key: 'barrow', label: 'Defeat all 8 Barrow Deeps bosses' },
    ],
  },
];

const PERKS: { tree: string; perks: { name: string; text: string }[] }[] = [
  {
    tree: 'Professions',
    perks: [
      { name: 'Working Overtime', text: 'Better chance to gain skill in every tradeskill, including Lockpicking.' },
      { name: 'Bountiful Harvest', text: 'Find extra Scarce resources when mining, herbing or skinning.' },
      { name: 'Bartering', text: 'Lower prices at vendors.' },
      { name: 'Performance Bonus', text: 'Sometimes earn extra Merchant’s Favor from the Azeroth Commerce Authority or Durotar Supply and Logistics.' },
      { name: 'Master Chef', text: 'Cooking can produce extra results.' },
      { name: 'Luremaster', text: 'A chance to fish up extra fish.' },
      { name: 'Dedicated Study', text: 'A daily cooldown that speeds up tradeskills, or grants Elemental Essences at 300.' },
    ],
  },
  {
    tree: 'Adventure',
    perks: [
      { name: 'Well Rested', text: 'Higher rested experience cap that fills faster.' },
      { name: 'Thrill of Adventure', text: 'Regain some health and mana after every non-trivial kill.' },
      { name: 'High Alert', text: 'Better stealth detection outside battlegrounds.' },
      { name: 'Field Guide', text: 'Shorter cooldown on placing camping features.' },
      { name: 'Field Medicine', text: 'Shorter Recently Bandaged outside dungeons, raids and battlegrounds.' },
      { name: 'Talented', text: 'Talent points unlock up to 5 levels earlier.' },
      { name: 'Frequent Flier', text: 'Cheaper, faster flights.' },
    ],
  },
  {
    tree: 'Resourcefulness',
    perks: [
      { name: 'Gourmand', text: 'Food buffs last longer.' },
      { name: 'The Quick and the Dead', text: 'Faster corpse runs; party and raid buffs are free after you resurrect.' },
      { name: 'Reinforce', text: 'Less durability loss on death.' },
      { name: 'For Great Honor', text: 'More Honor from PvP.' },
      { name: 'Permanence', text: 'Party, raid and camping buffs last longer.' },
      { name: 'Diplomat', text: 'More reputation.' },
      { name: 'Reagent Economy', text: 'Class abilities need no purchasable reagents; tier 1 camping features need no materials.' },
    ],
  },
];

const KEY = 'grimoire.legacy.v1';
interface Saved {
  done: string[];
  plan: string[];
}

export function LegacyPlanner({ classes }: { classes: ClassLite[] }) {
  const [done, setDone] = useState<Set<string>>(new Set());
  const [plan, setPlan] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const s = JSON.parse(raw) as Saved;
        setDone(new Set(s.done ?? []));
        setPlan(s.plan ?? []);
      }
    } catch {
      /* storage unavailable: start empty */
    }
    setLoaded(true);
  }, []);
  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(KEY, JSON.stringify({ done: [...done], plan } satisfies Saved));
    } catch {
      /* storage unavailable: progress lasts for this visit */
    }
  }, [done, plan, loaded]);

  const toggle = (k: string) =>
    setDone((d) => {
      const n = new Set(d);
      if (n.has(k)) n.delete(k);
      else n.add(k);
      return n;
    });
  const togglePerk = (name: string) => setPlan((p) => (p.includes(name) ? p.filter((x) => x !== name) : [...p, name]));

  const classKeys = classes.flatMap((c) => CLASS_LEVELS.map((l) => `class-${c.slug}-${l}`));
  const profKeys = PROFESSIONS.flatMap((p) => SKILL_LEVELS.map((l) => `prof-${p.key}-${l}`));
  const cats = [
    { name: 'Classes', keys: classKeys, max: 27 },
    { name: 'Tradeskills', keys: profKeys, max: 18 },
    ...SINGLES.map((s) => ({ name: s.cat, keys: s.items.map((i) => i.key), max: s.items.length })),
  ];
  const earned = cats.reduce((n, c) => n + c.keys.filter((k) => done.has(k)).length, 0);

  const check = (k: string, label: string) => (
    <button
      type="button"
      role="checkbox"
      aria-checked={done.has(k)}
      aria-label={label}
      title={label}
      onClick={() => toggle(k)}
      className={`grid size-8 place-items-center rounded-xl border transition-colors ${done.has(k) ? 'border-gilt bg-gilt/20 text-gilt-bright' : 'border-iron/70 bg-abyss/50 text-transparent hover:border-ash'}`}
    >
      <svg viewBox="0 0 16 16" className="size-4" aria-hidden>
        <path d="m3.5 8.5 3 3 6-7" fill="none" stroke="currentColor" strokeWidth="2" />
      </svg>
    </button>
  );

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
      <div className="space-y-6">
        <section className="frame p-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 className="font-display text-[1.45rem] text-vellum">Classes</h2>
            <span className="num text-[14px] text-mist">{classKeys.filter((k) => done.has(k)).length} of 27</span>
          </div>
          <div className="mt-3 overflow-x-auto scroll-thin">
            <table className="w-full min-w-[420px] text-[15px]">
              <thead>
                <tr className="text-left text-[13.5px] text-mist">
                  <th className="pb-2 font-normal">Reach level</th>
                  {CLASS_LEVELS.map((l) => (
                    <th key={l} className="num pb-2 text-center font-normal">
                      {l}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {classes.map((c) => (
                  <tr key={c.slug} className="border-t border-iron/50">
                    <td className="py-1.5">
                      <span className="inline-flex items-center gap-2" style={{ color: c.color }}>
                        <WowIcon icon={c.icon} size={24} name={c.name} />
                        {c.name}
                      </span>
                    </td>
                    {CLASS_LEVELS.map((l) => (
                      <td key={l} className="py-1.5 text-center">
                        <span className="inline-block">
                          {check(`class-${c.slug}-${l}`, `${c.name} reaches level ${l}`)}
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
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 className="font-display text-[1.45rem] text-vellum">Tradeskills</h2>
            <span className="num text-[14px] text-mist">{profKeys.filter((k) => done.has(k)).length} of 18</span>
          </div>
          <div className="mt-3 overflow-x-auto scroll-thin">
            <table className="w-full min-w-[420px] text-[15px]">
              <thead>
                <tr className="text-left text-[13.5px] text-mist">
                  <th className="pb-2 font-normal">Reach skill</th>
                  {SKILL_LEVELS.map((l) => (
                    <th key={l} className="num pb-2 text-center font-normal">
                      {l}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {PROFESSIONS.map((p) => (
                  <tr key={p.key} className="border-t border-iron/50">
                    <td className="py-1.5">
                      <span className="inline-flex items-center gap-2 text-parch">
                        <WowIcon icon={p.icon} size={24} name={p.name} />
                        {p.name}
                      </span>
                    </td>
                    {SKILL_LEVELS.map((l) => (
                      <td key={l} className="py-1.5 text-center">
                        <span className="inline-block">
                          {check(`prof-${p.key}-${l}`, `${p.name} reaches ${l}`)}
                        </span>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <div className="grid gap-6 md:grid-cols-2">
          {SINGLES.map((s) => (
            <section key={s.cat} className="frame p-5">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <h2 className="font-display text-[1.3rem] text-vellum">{s.cat}</h2>
                <span className="num text-[14px] text-mist">
                  {s.items.filter((i) => done.has(i.key)).length} of {s.items.length}
                </span>
              </div>
              <ul className="mt-3 space-y-1.5">
                {s.items.map((i) => (
                  <li key={i.key} className="flex items-center gap-3">
                    {check(i.key, i.label)}
                    <span className={`text-[15px] ${done.has(i.key) ? 'text-vellum' : 'text-parch'}`}>{i.label}</span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>

      <aside className="space-y-4">
        <section className="frame gilt p-5 xl:sticky xl:top-[88px]">
          <div className="text-[14px] text-mist">Legacy Points earned</div>
          <div className="num mt-1 text-[3rem] font-bold leading-none text-vellum">
            {earned}
            <span className="text-[1.3rem] text-fog"> / 65</span>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-iron">
            <div className="h-2 rounded-full bg-gilt" style={{ width: `${(earned / 65) * 100}%` }} />
          </div>
          <p className="mt-3 text-[14.5px] leading-relaxed text-parch">
            Each character can spend up to <strong className="text-vellum">16</strong> of these on perks at launch.{' '}
            {earned >= 16 ? 'You have enough to fill a character.' : `${16 - earned} more to fill one character.`}
          </p>
          <ul className="mt-3 space-y-1 text-[14px]">
            {cats.map((c) => (
              <li key={c.name} className="flex justify-between text-mist">
                <span>{c.name}</span>
                <span className="num text-parch">
                  {c.keys.filter((k) => done.has(k)).length} / {c.max}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[13px] text-fog">Saved in this browser only.</p>
        </section>

        <section className="frame p-5">
          <h2 className="font-display text-[1.3rem] text-vellum">Your perk plan</h2>
          <p className="mt-1 text-[14px] text-mist">Blizzard has not published what each perk costs, so list them in the order you want them. Tap a perk to add or remove it.</p>
          {plan.length > 0 ? (
            <ol className="mt-3 space-y-1">
              {plan.map((p, i) => (
                <li key={p} className="flex items-center gap-2 text-[15px] text-vellum">
                  <span className="num w-5 text-right text-gilt">{i + 1}</span>
                  {p}
                </li>
              ))}
            </ol>
          ) : (
            <p className="mt-3 text-[14.5px] text-fog">No perks planned yet.</p>
          )}
          <div className="mt-4 space-y-4">
            {PERKS.map((t) => (
              <div key={t.tree}>
                <div className="text-[14px] text-gilt">{t.tree}</div>
                <ul className="mt-1.5 space-y-1">
                  {t.perks.map((p) => {
                    const on = plan.includes(p.name);
                    return (
                      <li key={p.name}>
                        <button type="button" aria-pressed={on} onClick={() => togglePerk(p.name)} className={`w-full rounded-xl border px-2.5 py-1.5 text-left ${on ? 'border-gilt/60 bg-gilt/10' : 'border-iron bg-night/60 hover:border-ash'}`}>
                          <span className={`block text-[14.5px] ${on ? 'text-gilt-bright' : 'text-vellum'}`}>{p.name}</span>
                          <span className="block text-[13px] leading-snug text-mist">{p.text}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        </section>
      </aside>
    </div>
  );
}
