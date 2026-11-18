'use client';

// Links, rows and cards a page repeats by the hundred. They are client components on purpose: the page's data then
// carries each one's few words (an id, a name, an icon) instead of its whole markup a second time beside the HTML,
// and their classes are the short ones of globals.css (.il, .lr, .zc). Nothing here fetches or keeps state.
import Link from 'next/link';
import type { CSSProperties } from 'react';
import { WowIcon } from './icon';

/** An item's name in its quality colour, with its icon and its tooltip on hover. */
export function ItemChip({ id, n, q, ic, size = 20, icon = true, brackets, count, className }: { id: number; n: string; q: number; ic?: string; size?: number; icon?: boolean; brackets?: boolean; count?: number; className?: string }) {
  return (
    <Link href={`/items/${id}`} prefetch={false} data-tip={`item:${id}`} className={`il iq${q}${className ? ` ${className}` : ''}`}>
      {icon && <WowIcon icon={ic} size={size} quality={q} name={n} decorative />}
      <span className="t">{brackets ? `[${n}]` : n}</span>
      {count && count > 1 ? <span className="num text-[0.9em] text-mist">x{count}</span> : null}
    </Link>
  );
}

/** One row of a loot table: the item with what it is under its name, then its chance over a bar (w, in percent of the bar). */
export function LootRow({ id, n, q, ic, sub, pct, w, quest, size = 30, className }: { id: number; n: string; q: number; ic?: string; sub?: string; pct: string; w: number; quest?: boolean; size?: number; className?: string }) {
  return (
    <li className={className ? `lr ${className}` : 'lr'}>
      <Link href={`/items/${id}`} prefetch={false} data-tip={`item:${id}`} className={`iq${q}`}>
        <WowIcon icon={ic} size={size} quality={q} name={n} decorative />
        <span>
          <span>{n}</span>
          {sub && <span>{sub}</span>}
        </span>
      </Link>
      <span className={quest ? 'p q' : 'p'} style={{ '--w': `${w}%` } as CSSProperties}>
        {pct}
      </span>
    </li>
  );
}

/** A zone's card for an item (in its quality colour) or a creature: icon, name, and up to two lines under it. */
export function ZoneCard({ href, tip, icon, q, n, meta, cap, more }: { href: string; tip: string; icon?: string; q?: number; n: string; meta?: string; cap?: boolean; more?: string }) {
  return (
    <Link href={href} prefetch={false} data-tip={tip} className={q === undefined ? 'zc' : `zc iq${q}`}>
      <WowIcon icon={icon} size={40} quality={q} name={n} decorative />
      <span>
        <span>{n}</span>
        {meta && <span className={cap ? 'm u' : 'm'}>{meta}</span>}
        {more && <span>{more}</span>}
      </span>
    </Link>
  );
}
