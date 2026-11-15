import Link from 'next/link';
import type { Item } from '@/lib/types';
import { ItemChip } from './chips';
import { WowIcon } from './icon';

/** An item name in its quality color, with its icon and a hover tooltip. */
export function ItemLink({ item, size = 20, showIcon = true, className = '', brackets = false }: { item: Pick<Item, 'i' | 'n' | 'q' | 'ic'>; size?: number; showIcon?: boolean; className?: string; brackets?: boolean }) {
  // only the four words the chip shows cross to the page's data, never the whole item
  return <ItemChip id={item.i} n={item.n} q={item.q} ic={item.ic} size={size} icon={showIcon} brackets={brackets || undefined} className={className || undefined} />;
}

/** A spell or talent name with its icon; hovering shows the rank text. */
export function SpellLink({ id, name, icon, href, size = 20, className = '' }: { id: number; name: string; icon?: string; href?: string; size?: number; className?: string }) {
  const body = (
    <>
      {icon && <WowIcon icon={icon} size={size} name={name} decorative />}
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
