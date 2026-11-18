import Link from 'next/link';
import { getQuest } from '@/lib/data';
import { categoryName, entityRef, itemRef, RANK_LABEL } from '@/lib/quests';
import type { Quest } from '@/lib/types';
import { ItemChip } from './chips';

/** A quest name in quest gold; hovering shows its objectives and rewards. */
export function QuestLink({ quest, id, level = false, className = '' }: { quest?: Quest; id?: number; level?: boolean; className?: string }) {
  const q = quest ?? (id ? getQuest(id) : undefined);
  if (!q) return id ? <span className={`text-mist ${className}`}>Quest {id}</span> : null;
  return (
    <Link href={`/quests/${q.i}`} prefetch={false} data-tip={`quest:${q.i}`} className={className ? `ql ${className}` : 'ql'}>
      {level && q.l > 0 && <span className="num mr-2 inline-block min-w-[1.9em] rounded-md bg-white/[0.07] px-1 text-center text-[0.8em] leading-[1.5] text-mist">{q.l}</span>}
      {q.n}
    </Link>
  );
}

/** An NPC, object or item that starts, ends or is part of a quest. NPCs link to their page. */
export function EntityLink({ kind, id, zone = false, rank: showRank = true, className = '' }: { kind: 'n' | 'o' | 'i'; id: number; zone?: boolean; rank?: boolean; className?: string }) {
  if (kind === 'i') return <ItemRefLink id={id} className={className} />;
  const e = entityRef(kind, id);
  if (!e) return <span className={`text-mist ${className}`}>{kind === 'n' ? 'An NPC' : 'An object'}</span>;
  const where = zone && e.zone ? <span className="text-mist"> in {categoryName(e.zone)}</span> : null;
  if (kind === 'o') {
    return (
      <span className={className}>
        <span className="text-parch">{e.name}</span>
        {where}
      </span>
    );
  }
  const rank = showRank && e.npc && RANK_LABEL[e.npc[4]];
  const link = (
    <Link href={`/npcs/${id}`} prefetch={false} data-tip={`npc:${id}`} className="nl">
      {e.name}
    </Link>
  );
  // the name alone needs no box around it: a guide table with 700 of them is 700 elements lighter
  if (!rank && !where && !className) return link;
  return (
    <span className={className || undefined}>
      {link}
      {rank && <span className="ml-1 text-[0.86em] text-gilt">({rank})</span>}
      {where}
    </span>
  );
}

/** Any item, gear or not, in its quality color with its icon. */
export function ItemRefLink({ id, count, size = 20, className = '' }: { id: number; count?: number; size?: number; className?: string }) {
  const it = itemRef(id);
  if (!it) return <span className={`text-mist ${className}`}>Item {id}</span>;
  return <ItemChip id={id} n={it.n} q={it.q} ic={it.ic} size={size} count={count && count > 1 ? count : undefined} className={className || undefined} />;
}

/** Which factions can take a quest, as small banners. */
export function SideMark({ side, className = '' }: { side: number; className?: string }) {
  if (side === 1) return <span className={`text-[#a9c8f5] ${className}`}>Alliance</span>;
  if (side === 2) return <span className={`text-[#f5a196] ${className}`}>Horde</span>;
  if (side === 0) return <span className={`text-mist ${className}`}>faction not known yet</span>;
  return <span className={`text-mist ${className}`}>Both</span>;
}

/** A drop chance with sensible precision: 34%, 5.1%, 0.42%, under 0.01%. */
export function chance(p: number) {
  if (p >= 99.95) return '100%';
  if (p >= 10) return `${Math.round(p)}%`;
  if (p >= 1) return `${p.toFixed(1)}%`;
  if (p >= 0.1) return `${p.toFixed(2)}%`;
  if (p >= 0.01) return `${p.toFixed(2)}%`;
  return 'under 0.01%';
}

/** A thin bar under a drop chance, on a log scale so 0.1% and 50% both read. */
export function ChanceBar({ pct, quest }: { pct: number; quest?: boolean }) {
  const w = pct <= 0 ? 0 : Math.max(4, Math.min(100, ((Math.log10(pct) + 2) / 4) * 100));
  return (
    <span className="relative block h-1.5 w-full overflow-hidden rounded-full bg-white/[0.07]" aria-hidden>
      <span className={`absolute inset-y-0 left-0 rounded-full ${quest ? 'bg-leaf' : 'bg-gilt'}`} style={{ width: `${w}%` }} />
    </span>
  );
}
