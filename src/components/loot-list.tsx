import Link from 'next/link';
import { getItem, getMinorItem, type NpcLootRow } from '@/lib/data';
import { QUALITY_COLOR } from '@/lib/wow';
import { WowIcon } from './icon';
import { chance } from './world-links';

/** Gear and quest items from a loot table: cloth and food crowd out what people look for. */
export function notableLoot(rows: NpcLootRow[], exclude?: number) {
  return rows.filter(([id, , quest]) => id !== exclude && (quest || (getItem(id)?.q ?? getMinorItem(id)?.[1] ?? 0) >= 2 || getMinorItem(id)?.[9]));
}

/** Loot rows with the item's icon, its name in quality colour and the chance as a number and a bar. */
export function LootList({ rows, highlight, iconSize = 32, columns = 1 }: { rows: NpcLootRow[]; highlight?: number; iconSize?: number; columns?: 1 | 2 }) {
  return (
    <ul className={columns === 2 ? 'grid lg:grid-cols-2 lg:gap-x-8' : undefined}>
      {rows.map(([id, pct, quest]) => {
        const it = getItem(id);
        const minor = it ? undefined : getMinorItem(id);
        const name = it?.n ?? minor?.[0] ?? `Item ${id}`;
        const q = it?.q ?? minor?.[1] ?? 1;
        const icon = it?.ic ?? minor?.[2];
        const w = pct <= 0 ? 0 : Math.max(4, Math.min(100, ((Math.log10(pct) + 2) / 4) * 100));
        return (
          <li
            key={id}
            className={`grid grid-cols-[minmax(0,1fr)_80px] items-center gap-4 rounded-[14px] px-3 py-2.5 transition-colors hover:bg-white/[0.03] ${id === highlight ? 'bg-white/[0.06] ring-1 ring-inset ring-white/[0.08]' : ''}`}
          >
            <Link href={`/items/${id}`} data-tip={`item:${id}`} className="flex min-w-0 items-center gap-3 text-[15px] font-medium hover:underline hover:underline-offset-2" style={{ color: QUALITY_COLOR[q] }}>
              <WowIcon icon={icon} size={iconSize} quality={q} name={name} />
              <span className="truncate">{name}</span>
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
