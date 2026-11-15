import Link from 'next/link';
import { getEncounterData, getItem, getMinorItem, getNpc } from '@/lib/data';
import { itemTypeLabel, slotLabel } from '@/lib/items';
import { RANK_LABEL } from '@/lib/quests';
import type { DungeonEncounters, Encounter, EncounterAbility, EncounterLoot, EncounterNpc } from '@/lib/types';
import { CREATURE_TYPE } from '@/lib/zone';
import { QUALITY_COLOR } from '@/lib/wow';
import { WowIcon } from './icon';
import { Badge } from './ui';
import { chance } from './world-links';

/** The schools of magic in the colours the game's combat text gives them, lifted a touch for dark panels. */
export const SCHOOLS = [
  { n: 'Physical', c: '#cfc6b6' },
  { n: 'Holy', c: '#ffe27a' },
  { n: 'Fire', c: '#ff8a4c' },
  { n: 'Nature', c: '#93d86f' },
  { n: 'Frost', c: '#82cbff' },
  { n: 'Shadow', c: '#b994ff' },
  { n: 'Arcane', c: '#f49af8' },
];

const npcName = (id: number) => getEncounterData().npcs[String(id)] ?? getNpc(id)?.[0] ?? `NPC ${id}`;

/** A creature's name, linked to its page when the site has one. plain: no underline until hovered. */
function NpcName({ id, className = '', plain = false }: { id: number; className?: string; plain?: boolean }) {
  const name = npcName(id);
  return getNpc(id) ? (
    <Link href={`/npcs/${id}`} data-tip={`npc:${id}`} className={`underline-offset-[3px] ${plain ? 'hover:underline hover:decoration-gilt' : 'underline decoration-white/20 hover:decoration-gilt'} ${className}`}>
      {name}
    </Link>
  ) : (
    <span className={className}>{name}</span>
  );
}

const levelText = (lv: [number, number]) => (lv[0] === lv[1] ? `Level ${lv[0]}` : `Level ${lv[0]} to ${lv[1]}`);

/** Whether a boss counts among the dungeon's bosses: rare spawns, world-event bosses, quest summons and the ones
 *  players call up with something in the instance (the Blacksmithing Plans' smiths) do not. */
const counted = (b: Encounter) => !b.f?.some((f) => f === 'rare' || f === 'event' || f === 'quest' || f === 'summon');

/** Each counted boss's place in its run, by key: numbered per wing where each wing is a run of its own. */
export function runPlaces(data: DungeonEncounters) {
  const out = new Map<string, number>();
  let n = 0;
  for (const w of data.wings) {
    if (data.runs) n = 0;
    for (const b of w.bosses) if (counted(b)) out.set(b.key, ++n);
  }
  return out;
}

/** The round mark before a boss: its place in the run, or a small diamond for one that is not counted. */
function PlaceMark({ place, large = false }: { place?: number; large?: boolean }) {
  return (
    <span className={`num grid shrink-0 place-items-center rounded-full font-semibold ring-1 ring-inset ${large ? 'size-10 text-[16px]' : 'size-8 text-[14px]'} ${place ? 'bg-gilt/[0.12] text-gilt-bright ring-gilt/25' : 'bg-white/[0.04] ring-white/10'}`}>
      {place ?? <span aria-hidden className="size-2 rotate-45 rounded-[1px] bg-fog" />}
    </span>
  );
}

/** The flags of an encounter as badges, each a fact from the data. */
export function EncounterFlags({ boss }: { boss: Encounter }) {
  const f = new Set(boss.f ?? []);
  const event = boss.npcs.find((n) => n.how === 'event')?.ev;
  return (
    <>
      {f.has('rare') && <Badge tone="gilt">Rare spawn</Badge>}
      {f.has('event') && <Badge tone="removed">{event ? `${event} only` : 'World event only'}</Badge>}
      {f.has('quest') && <Badge tone="neutral">Quest summon</Badge>}
      {f.has('summon') && !f.has('quest') && <Badge tone="neutral">Optional summon</Badge>}
      {f.has('summoned') && !f.has('quest') && !f.has('summon') && <Badge tone="neutral">Summoned</Badge>}
      {f.has('optional') && <Badge tone="neutral">Optional</Badge>}
      {f.has('oneOf') && <Badge tone="neutral">One of {boss.npcs.length}</Badge>}
    </>
  );
}

/** The clickable list of bosses in run order, by wing: each entry jumps to the boss's section. */
export function BossIndex({ data }: { data: DungeonEncounters }) {
  const places = runPlaces(data);
  return (
    <div className="space-y-6">
      {data.wings.map((w, wi) => (
        <div key={w.name ?? wi}>
          {w.name && (
            <h3 className="mb-2.5 text-[1.15rem] text-gilt-bright">
              {w.name}
              {data.runs && (
                <span className="text-[14px] text-mist">
                  {' · '}
                  {w.bosses.filter(counted).length} {w.bosses.filter(counted).length === 1 ? 'boss' : 'bosses'}
                </span>
              )}
            </h3>
          )}
          <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {w.bosses.map((b) => {
              const main = b.npcs[0];
              return (
                <li key={b.key}>
                  <a href={`#${b.key}`} className="group flex h-full items-center gap-3 rounded-[14px] bg-white/[0.035] px-3.5 py-2.5 ring-1 ring-inset ring-white/[0.06] transition-colors hover:bg-white/[0.07] hover:ring-gilt/30">
                    <PlaceMark place={places.get(b.key)} />
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-vellum group-hover:text-gilt-bright">{b.n}</span>
                      <span className="block truncate text-[13px] text-mist">
                        {[main.lv[0] > 0 ? levelText(main.lv) : null, b.f?.includes('rare') ? 'rare spawn' : null, b.f?.includes('event') ? 'world event' : null, b.f?.includes('quest') ? 'quest summon' : b.f?.includes('summon') ? 'optional summon' : b.f?.includes('summoned') ? 'summoned' : null, b.f?.includes('optional') ? 'optional' : null]
                          .filter(Boolean)
                          .join(' · ')}
                      </span>
                    </span>
                  </a>
                </li>
              );
            })}
          </ol>
        </div>
      ))}
    </div>
  );
}

/** A school-coloured mark for an ability: the game has no icon names for creature spells, so none is made up. */
function SchoolMark({ school }: { school: number }) {
  const s = SCHOOLS[school] ?? SCHOOLS[0];
  return (
    <span aria-hidden className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-[10px] ring-1 ring-inset" style={{ background: `${s.c}17`, boxShadow: `inset 0 0 0 1px ${s.c}55` }}>
      <span className="size-2.5 rotate-45 rounded-[2px]" style={{ background: s.c, boxShadow: `0 0 10px ${s.c}99` }} />
    </span>
  );
}

function AbilityRow({ a, boss }: { a: EncounterAbility; boss: Encounter }) {
  const s = SCHOOLS[a.s] ?? SCHOOLS[0];
  return (
    <li className="flex gap-3 py-3">
      <SchoolMark school={a.s} />
      <div className="min-w-0">
        <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
          <span className="font-semibold text-vellum">{a.n}</span>
          <span className="text-[13.5px] font-medium" style={{ color: s.c }}>
            {s.n}
          </span>
          {a.t && <Badge tone={a.t === 'passive' ? 'neutral' : 'changed'}>{a.t === 'passive' ? 'Passive' : a.t}</Badge>}
          {a.by && boss.npcs.length > 1 && <span className="text-[13.5px] text-fog">{npcName(a.by)}</span>}
          {a.on?.length ? <span className="text-[13.5px] text-fog">on {[...new Set(a.on.map(npcName))].join(', ')}</span> : null}
        </div>
        {a.d && <p className="mt-1 text-[15px] leading-relaxed text-parch">{a.d}</p>}
      </div>
    </li>
  );
}

/** The boss's spells with their text at its level, then what it summons and when it flees. */
export function AbilityList({ boss }: { boss: Encounter }) {
  if (!boss.abilities.length && !boss.summons?.length && !boss.flees) return <p className="text-[15px] text-mist">VMaNGOS lists no spells for this boss.</p>;
  return (
    <div>
      {boss.abilities.length > 0 && (
        <ul className="-my-3 divide-y divide-white/[0.06]">
          {boss.abilities.map((a) => (
            <AbilityRow key={`${a.id}-${a.by ?? 0}`} a={a} boss={boss} />
          ))}
        </ul>
      )}
      {(boss.summons?.length || boss.flees) && (
        <ul className={`space-y-1.5 text-[15px] text-parch ${boss.abilities.length ? 'mt-4 border-t border-white/[0.06] pt-4' : ''}`}>
          {boss.summons?.map((s) => (
            <li key={`${s.npc}-${s.t ?? ''}`} className="flex items-baseline gap-2.5">
              <span aria-hidden className="mt-[0.55em] size-1.5 shrink-0 rotate-45 bg-gilt-deep" />
              <span>
                Calls <NpcName id={s.npc} className="text-vellum" />
                {s.c && s.c > 1 ? ` (${s.c})` : ''}
                {s.t ? ` ${s.t}` : ''}
                {s.by && boss.npcs.length > 1 ? <span className="text-fog"> ({npcName(s.by)})</span> : null}.
              </span>
            </li>
          ))}
          {boss.flees && (
            <li className="flex items-baseline gap-2.5">
              <span aria-hidden className="mt-[0.55em] size-1.5 shrink-0 rotate-45 bg-gilt-deep" />
              <span>Flees {boss.flees}.</span>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}

function itemOf(id: number) {
  const it = getItem(id);
  if (it) {
    // "Chest Cloth", "One-Hand Sword", "Finger Ring": the slot and the type, as the item list and the add-on show them
    const slot = slotLabel(it);
    const type = itemTypeLabel(it);
    const both = slot && type && type !== 'Item' && !slot.toLowerCase().includes(type.toLowerCase());
    return { n: it.n, q: it.q, ic: it.ic, type: both ? `${slot} ${type}` : slot || type };
  }
  const m = getMinorItem(id);
  if (m) return { n: m[0], q: m[1], ic: m[2], type: '' };
  return null;
}

/** A loot table: icon, name in quality colour with the item tooltip, what it is, and the chance per kill as a number and a bar. */
export function LootTable({ rows, boss }: { rows: EncounterLoot[]; boss?: Encounter }) {
  const many = boss && (boss.npcs.length > 1 || boss.chest);
  return (
    <ul>
      {rows.map(([id, pct, flags, from]) => {
        const it = itemOf(id);
        if (!it) return null;
        const w = pct <= 0 ? 0 : Math.max(4, Math.min(100, ((Math.log10(pct) + 2) / 4) * 100));
        const quest = Boolean(flags & 1);
        const sub = [flags & 1 ? 'Quest item' : null, flags & 4 ? 'Starts a quest' : null, flags & 2 ? 'Recipe' : null, it.type && it.type !== 'Item' ? it.type : null, many && from ? (from < 0 ? boss?.chest?.n : npcName(from)) : null].filter(Boolean).join(' · ');
        return (
          <li key={id} className="grid grid-cols-[minmax(0,1fr)_76px] items-center gap-4 rounded-[14px] px-3 py-2 transition-colors hover:bg-white/[0.03]">
            <Link href={`/items/${id}`} data-tip={`item:${id}`} className="flex min-w-0 items-center gap-3" style={{ color: QUALITY_COLOR[it.q] }}>
              <WowIcon icon={it.ic} size={30} quality={it.q} name={it.n} />
              <span className="min-w-0">
                <span className="block truncate text-[15px] font-medium hover:underline hover:underline-offset-2">{it.n}</span>
                {sub && <span className="block truncate text-[13px] text-mist">{sub}</span>}
              </span>
            </Link>
            <span className="text-right">
              <span className={`num block text-[14.5px] font-semibold ${quest ? 'text-leaf-bright' : 'text-vellum'}`}>{chance(pct)}</span>
              <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-white/[0.07]">
                <span className={`block h-full rounded-full ${quest ? 'bg-leaf' : 'bg-gilt'}`} style={{ width: `${w}%` }} />
              </span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/** The creatures of an encounter with their levels, when there is more than one. */
function NpcLine({ npcs }: { npcs: EncounterNpc[] }) {
  return (
    <p className="mt-2 text-[15px] text-mist">
      {npcs.map((n, i) => (
        <span key={n.id}>
          {i > 0 && ', '}
          <NpcName id={n.id} className="text-parch" /> <span className="num text-fog">({n.lv[0] === n.lv[1] ? n.lv[0] : `${n.lv[0]}–${n.lv[1]}`})</span>
        </span>
      ))}
    </p>
  );
}

/** One boss: name, level, rank and flags, then its abilities beside its loot. */
export function BossSection({ boss, place }: { boss: Encounter; place?: number }) {
  const main = boss.npcs[0];
  const meta = [levelText(main.lv), RANK_LABEL[main.r], CREATURE_TYPE[main.ty] && main.ty !== 10 ? CREATURE_TYPE[main.ty] : null].filter(Boolean).join(' · ');
  return (
    <section id={boss.key} className="frame scroll-mt-[150px] p-5 sm:p-7">
      <div className="flex flex-wrap items-start gap-x-4 gap-y-3">
        <PlaceMark place={place} large />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <h3 className="text-[1.6rem] leading-tight text-vellum">{boss.npcs.length === 1 && getNpc(main.id) ? <NpcName id={main.id} plain /> : boss.n}</h3>
            <EncounterFlags boss={boss} />
          </div>
          <p className="mt-1 text-[15px] text-mist">{meta}</p>
          {boss.npcs.length > 1 && <NpcLine npcs={boss.npcs} />}
          {boss.note && <p className="mt-2 text-[15px] text-parch">{boss.note}</p>}
        </div>
        <a href="#bosses" className="shrink-0 text-[14px] text-fog transition-colors hover:text-vellum">
          All bosses
        </a>
      </div>
      <div className="mt-6 grid gap-x-10 gap-y-8 lg:grid-cols-2">
        <div className="min-w-0">
          <h4 className="mb-3 text-[13px] font-semibold uppercase tracking-[0.08em] text-fog">Abilities</h4>
          <AbilityList boss={boss} />
        </div>
        <div className="min-w-0">
          <h4 className="mb-2 text-[13px] font-semibold uppercase tracking-[0.08em] text-fog">
            Loot{boss.chest ? <span className="normal-case tracking-normal"> · {boss.chest.n}</span> : null}
          </h4>
          {boss.loot.length ? (
            <div className="-mx-3">
              <LootTable rows={boss.loot} boss={boss} />
            </div>
          ) : (
            <p className="text-[15px] text-mist">No loot of its own.</p>
          )}
        </div>
      </div>
    </section>
  );
}

/** Items the dungeon's regular mobs drop that are found mainly here, with the best chance and the mobs that drop them. */
export function TrashDrops({ data }: { data: DungeonEncounters }) {
  return (
    <ul className="divide-y divide-white/[0.06] border-y border-white/[0.06]">
      {data.trash.map((t) => {
        const it = itemOf(t.i);
        if (!it) return null;
        return (
          <li key={t.i} className="grid gap-x-6 gap-y-1.5 py-3 sm:grid-cols-[minmax(0,1.1fr)_minmax(0,1.4fr)_76px] sm:items-center">
            <Link href={`/items/${t.i}`} data-tip={`item:${t.i}`} className="flex min-w-0 items-center gap-3" style={{ color: QUALITY_COLOR[it.q] }}>
              <WowIcon icon={it.ic} size={30} quality={it.q} name={it.n} />
              <span className="min-w-0">
                <span className="block truncate text-[15px] font-medium hover:underline hover:underline-offset-2">{it.n}</span>
                {it.type && it.type !== 'Item' && <span className="block truncate text-[13px] text-mist">{it.type}</span>}
              </span>
            </Link>
            <p className="min-w-0 text-[14.5px] text-mist">
              {t.by.map(([npc, pct], i) => (
                <span key={npc}>
                  {i > 0 && ', '}
                  <NpcName id={npc} plain className="text-parch" />
                  {t.by.length > 1 && <span className="num text-fog"> {chance(pct)}</span>}
                </span>
              ))}
              {t.more ? <span className="text-fog">, and {t.more} more</span> : null}
            </p>
            <span className="num text-[14.5px] font-semibold text-vellum sm:text-right">{chance(t.p)}</span>
          </li>
        );
      })}
    </ul>
  );
}
