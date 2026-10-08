import Link from 'next/link';
import type { Item } from '@/lib/types';
import { QUALITY_COLOR } from '@/lib/wow';
import { WowIcon } from './icon';

/** An item name in its quality color, with its icon and a hover tooltip. */
export function ItemLink({ item, size = 20, showIcon = true, className = '', brackets = false }: { item: Pick<Item, 'i' | 'n' | 'q' | 'ic'>; size?: number; showIcon?: boolean; className?: string; brackets?: boolean }) {
  return (
    <Link
      href={`/items/${item.i}`}
      data-tip={`item:${item.i}`}
      className={`group inline-flex max-w-full items-center gap-1.5 align-middle font-medium hover:underline hover:decoration-1 hover:underline-offset-2 ${className}`}
      style={{ color: QUALITY_COLOR[item.q] }}
    >
      {showIcon && <WowIcon icon={item.ic} size={size} quality={item.q} name={item.n} />}
      <span className="truncate">{brackets ? `[${item.n}]` : item.n}</span>
    </Link>
  );
}

/** A spell or talent name with its icon; hovering shows the rank text. */
export function SpellLink({ id, name, icon, href, size = 20, className = '' }: { id: number; name: string; icon?: string; href?: string; size?: number; className?: string }) {
  const body = (
    <>
      {icon && <WowIcon icon={icon} size={size} name={name} />}
      <span className="truncate">{name}</span>
    </>
  );
  const cls = `inline-flex max-w-full items-center gap-1.5 align-middle font-medium text-gilt-bright hover:underline hover:underline-offset-2 ${className}`;
  return href ? (
    <Link href={href} data-tip={`spell:${id}`} className={cls}>
      {body}
    </Link>
  ) : (
    <span data-tip={`spell:${id}`} tabIndex={0} className={`${cls} cursor-help`}>
      {body}
    </span>
  );
}
