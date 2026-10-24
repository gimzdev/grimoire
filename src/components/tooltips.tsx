import type { Item, SpellRecord } from '@/lib/types';
import { DAMAGE_TYPE, QUALITY_COLOR, SLOT, STAT_LABEL, WHITE_STATS, classesFromMask, formatMoney, CLASS_NAMES } from '@/lib/wow';
import { itemTypeLabel } from '@/lib/items';
import { GameText } from './game-text';

export interface ItemTipExtra {
  set?: { id: number; name: string; pieces: { i: number; n: string }[]; bonus: [number, string][] };
  source?: string;
}

/** "Equip:" lines for an item's stats, worded the way the game prints them. */
export function equipLines(st: Record<string, number> | undefined): string[] {
  if (!st) return [];
  const out: string[] = [];
  const dmg = (st.splpwr ?? 0) + (st.spldmg ?? 0);
  const heal = st.splheal ?? 0;
  if (dmg && heal && heal !== dmg) out.push(`Increases healing done by up to ${heal} and damage done by up to ${dmg} for all magical spells and effects.`);
  else if (dmg || heal) out.push(`Increases damage and healing done by magical spells and effects by up to ${dmg || heal}.`);
  const school: [string, string][] = [
    ['shasplpwr', 'Shadow'],
    ['firsplpwr', 'Fire'],
    ['frosplpwr', 'Frost'],
    ['arcsplpwr', 'Arcane'],
    ['holsplpwr', 'Holy'],
    ['natsplpwr', 'Nature'],
  ];
  for (const [k, n] of school) if (st[k]) out.push(`Increases damage done by ${n} spells and effects by up to ${st[k]}.`);
  if (st.hitrtng) out.push(`Improves hit rating by ${st.hitrtng}.`);
  if (st.critstrkrtng) out.push(`Improves critical strike rating by ${st.critstrkrtng}.`);
  if (st.splcritstrkpct) out.push(`Improves your chance to get a critical strike with spells by ${st.splcritstrkpct}%.`);
  if (st.hastertng) out.push(`Improves haste rating by ${st.hastertng}.`);
  if (st.exprtng) out.push(`Improves expertise rating by ${st.exprtng}.`);
  if (st.atkpwr) out.push(`+${st.atkpwr} Attack Power.`);
  if (st.rgdatkpwr) out.push(`+${st.rgdatkpwr} ranged Attack Power.`);
  if (st.feratkpwr) out.push(`+${st.feratkpwr} Attack Power in Cat, Bear, and Dire Bear forms only.`);
  if (st.armorpenrtng) out.push(`Your attacks ignore ${st.armorpenrtng} of your opponent's armor.`);
  if (st.splpen) out.push(`Decreases the magical resistances of your spell targets by ${st.splpen}.`);
  if (st.defrtng) out.push(`Increased Defense +${st.defrtng}.`);
  if (st.dodgertng) out.push(`Improves dodge rating by ${st.dodgertng}.`);
  if (st.parryrtng) out.push(`Improves parry rating by ${st.parryrtng}.`);
  if (st.blockrtng) out.push(`Improves block rating by ${st.blockrtng}.`);
  if (st.blockamount) out.push(`Increases the block value of your shield by ${st.blockamount}.`);
  if (st.manargn) out.push(`Restores ${st.manargn} mana per 5 sec.`);
  if (st.healthrgn) out.push(`Restores ${st.healthrgn} health per 5 sec.`);
  return out.map((l) => `Equip: ${l}`);
}

export function Money({ copper, className = '' }: { copper: number; className?: string }) {
  const { g, s, c } = formatMoney(copper);
  const coin = (n: number, color: string, key: string) =>
    n > 0 ? (
      <span key={key} className="inline-flex items-center gap-0.5">
        {n}
        <span aria-hidden className="inline-block size-[0.62em] rounded-full" style={{ background: color, boxShadow: 'inset 0 -1px 0 rgb(0 0 0 / .35)' }} />
      </span>
    ) : null;
  return (
    <span className={`num inline-flex items-center gap-1.5 ${className}`}>
      {coin(g, 'radial-gradient(circle at 35% 30%, #fff1a8, #d4a017 60%, #8a6408)', 'g')}
      {coin(s, 'radial-gradient(circle at 35% 30%, #ffffff, #b8bec8 60%, #6b717b)', 's')}
      {coin(c, 'radial-gradient(circle at 35% 30%, #ffc9a1, #b8693a 60%, #6e3a1c)', 'c')}
      {g + s + c === 0 && 'None'}
    </span>
  );
}

/** Lines the client prints in green; charges and other notes stay white. */
const isGreen = (l: string) => /^(Equip|Use|Chance on hit):/.test(l);

export function ItemTooltip({ item, extra, compact }: { item: Item; extra?: ItemTipExtra; compact?: boolean }) {
  const color = QUALITY_COLOR[item.q] ?? '#fff';
  const slot = SLOT[item.s];
  const type = itemTypeLabel(item);
  const showType = item.c === 2 || (item.c === 4 && [1, 2, 3, 4, 6, 7, 8, 9].includes(item.sc) && ![2, 11, 12, 16].includes(item.s));
  // Forever tooltips are stored line by line; older records fall back to lines built from their stats.
  const whites = item.wl ?? Object.entries(item.st ?? {})
    .filter(([k]) => WHITE_STATS.has(k))
    .map(([k, v]) => `${v > 0 ? '+' : ''}${v} ${STAT_LABEL[k]}`);
  const greens = item.fx?.length ? item.fx : equipLines(item.st);
  const classes = classesFromMask(item.cls);
  const unique = item.u ?? (item.uq ? (item.uq > 1 ? `Unique (${item.uq})` : 'Unique') : null);
  return (
    <div className={`wtt ${compact ? 'max-w-[320px]' : 'max-w-[360px]'}`}>
      <div className="wtt-name" style={{ color }}>
        {item.n}
      </div>
      {item.lb && <div className="text-tt-green">{item.lb}</div>}
      <div className="text-tt-yellow">Item Level {item.l}</div>
      {item.b && <div>{item.b}</div>}
      {unique && <div>{unique}</div>}
      {item.bq ? <div>This Item Begins a Quest</div> : null}
      {(slot || showType) && item.s > 0 && (
        <div className="flex justify-between gap-6">
          <span>{slot}</span>
          {showType && <span>{type}</span>}
        </div>
      )}
      {item.w && (
        <>
          <div className="flex justify-between gap-6">
            <span>
              {Math.round(item.w[0])} - {Math.round(item.w[1])} {item.w[4] ? `${DAMAGE_TYPE[item.w[4]]} ` : ''}Damage
            </span>
            {item.w[2] ? <span>Speed {Number(item.w[2]).toFixed(2)}</span> : null}
          </div>
          {item.w[3] ? <div>({Number(item.w[3]).toFixed(1)} damage per second)</div> : null}
        </>
      )}
      {item.ar ? <div>{item.ar} Armor</div> : null}
      {whites.map((l, i) => (
        <div key={i}>{l}</div>
      ))}
      {item.du ? (
        <div>
          Durability {item.du} / {item.du}
        </div>
      ) : null}
      {item.dur && <div>Duration: {item.dur}</div>}
      {classes.length > 0 && <div>Classes: {classes.map((c) => CLASS_NAMES[c]).join(', ')}</div>}
      {item.races && <div>Races: {item.races}</div>}
      {item.r > 1 && !item.nr && <div>Requires Level {item.r}</div>}
      {item.rq?.map((l) => (
        <div key={l}>{l}</div>
      ))}
      {greens.map((g, i) => (
        <div key={i} className={isGreen(g) ? 'text-tt-green' : undefined}>
          {g}
        </div>
      ))}
      {extra?.set && (
        <div className="mt-2.5">
          <div className="text-tt-yellow">
            {extra.set.name} (0/{extra.set.pieces.length})
          </div>
          <div className="pl-3 text-tt-grey">
            {extra.set.pieces.map((p) => (
              <div key={p.i}>{p.n}</div>
            ))}
          </div>
          {extra.set.bonus.length > 0 && (
            <div className="mt-2 text-tt-grey">
              {extra.set.bonus.map(([n, t], i) => (
                <div key={i}>
                  ({n}) Set: {t}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      {item.f && <div className="mt-1.5 text-tt-yellow">&ldquo;{item.f}&rdquo;</div>}
      {!compact && item.sell ? (
        <div className="mt-1.5 flex items-center gap-1.5 text-[14px]">
          Sell Price: <Money copper={item.sell} />
        </div>
      ) : null}
      {extra?.source && <div className="mt-1.5 text-[13.5px] text-mist">{extra.source}</div>}
    </div>
  );
}

export function SpellTooltip({ spell, rankLabel, nextDesc, footer }: { spell: Pick<SpellRecord, 'name' | 'rank' | 'desc'>; rankLabel?: string; nextDesc?: string; footer?: React.ReactNode }) {
  return (
    <div className="wtt max-w-[340px]">
      <div className="flex items-baseline justify-between gap-4">
        <span className="wtt-name text-white">{spell.name}</span>
        {(rankLabel || spell.rank) && <span className="shrink-0 text-[13.5px] text-tt-grey">{rankLabel || spell.rank}</span>}
      </div>
      {spell.desc && <GameText text={spell.desc} className="mt-1 block text-tt-yellow" />}
      {nextDesc && (
        <div className="mt-2.5">
          <div className="text-white">Next rank:</div>
          <GameText text={nextDesc} className="block text-tt-yellow" />
        </div>
      )}
      {footer}
    </div>
  );
}

export interface QuestTip {
  n: string;
  l: number;
  r: number;
  side: string;
  zone: string;
  o?: string;
  rq: string[];
  rewards: { n: string; q: number; ic?: string; c: number }[];
  choose: boolean;
  xp?: number;
  m?: number;
  change?: string;
}

/** A quest as the game's quest log would summarize it. */
export function QuestTooltip({ quest }: { quest: QuestTip }) {
  return (
    <div className="wtt max-w-[340px]">
      <div className="wtt-name text-tt-yellow">{quest.n}</div>
      <div className="text-[13.5px] text-tt-grey">
        Level {quest.l}
        {quest.r ? `, requires ${quest.r}` : ''}, {quest.side}, {quest.zone}
      </div>
      {quest.change && <div className="text-[13.5px] text-tt-green">{quest.change}</div>}
      {quest.o && <div className="mt-2 text-white">{quest.o}</div>}
      {quest.rq.length > 0 && (
        <div className="mt-2">
          {quest.rq.map((r, i) => (
            <div key={i} className="text-tt-grey">
              - {r}
            </div>
          ))}
        </div>
      )}
      {quest.rewards.length > 0 && (
        <div className="mt-2">
          <div className="text-tt-yellow">{quest.choose ? 'Choose a reward:' : 'Rewards:'}</div>
          {quest.rewards.map((r, i) => (
            <div key={i} style={{ color: QUALITY_COLOR[r.q] ?? '#fff' }}>
              {r.n}
              {r.c > 1 ? ` x${r.c}` : ''}
            </div>
          ))}
        </div>
      )}
      {(quest.xp || quest.m) && (
        <div className="mt-2 flex items-center gap-3 text-[14px] text-tt-grey">
          {quest.xp ? <span>{quest.xp.toLocaleString('en-US')} experience</span> : null}
          {quest.m ? <Money copper={quest.m} /> : null}
        </div>
      )}
    </div>
  );
}

export interface NpcTip {
  n: string;
  title?: string;
  level?: string;
  rank?: string;
  zone?: string;
  react: string;
}

export function NpcTooltip({ npc }: { npc: NpcTip }) {
  const color = npc.react === 'hh' ? '#ff4a3d' : npc.react === 'ff' ? '#3ce23c' : npc.react === 'nn' ? '#ffd100' : '#f0e7d4';
  return (
    <div className="wtt max-w-[300px]">
      <div className="wtt-name" style={{ color }}>
        {npc.n}
      </div>
      {npc.title && <div className="text-white">&lt;{npc.title}&gt;</div>}
      {(npc.level || npc.rank) && (
        <div className="text-white">
          {npc.level ? `Level ${npc.level}` : npc.rank}
          {npc.level && npc.rank ? ` (${npc.rank})` : ''}
        </div>
      )}
      {npc.zone && <div className="text-tt-grey">{npc.zone}</div>}
    </div>
  );
}
