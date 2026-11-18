import { getItem, getMinorItem, type NpcLootRow } from '@/lib/data';
import { LootRow } from './chips';
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
          <LootRow
            key={id}
            id={id}
            n={name}
            q={q}
            ic={icon}
            pct={chance(pct)}
            w={Math.round(w * 10) / 10}
            quest={quest ? true : undefined}
            size={iconSize}
            className={id === highlight ? 'lw bg-white/[0.06] ring-1 ring-inset ring-white/[0.08]' : 'lw'}
          />
        );
      })}
    </ul>
  );
}
