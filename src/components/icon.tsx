import { iconUrl } from '@/lib/wow';

function initials(name?: string) {
  if (!name) return '?';
  const parts = name.replace(/[^A-Za-z ]/g, ' ').trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '?';
}

/**
 * A game icon in the in-game bevel. Pictures come from Blizzard's own icon server; when one fails to load,
 * the layout's error listener marks the frame and it shows the name's initials instead.
 */
export function WowIcon({
  icon,
  size = 36,
  quality,
  name,
  className = '',
  rounded,
  eager,
}: {
  icon?: string | null;
  size?: number;
  quality?: number;
  name?: string;
  className?: string;
  rounded?: boolean;
  eager?: boolean;
}) {
  // 36px pictures stay sharp up to ~20 CSS px on a 2x screen; anything larger takes the 56px set.
  const src = iconUrl(icon, size <= 20 ? 'medium' : 'large');
  return (
    <span
      className={`wi ${className}`}
      data-q={quality ?? undefined}
      data-initials={initials(name)}
      style={{ width: size, height: size, borderRadius: rounded ? '999px' : undefined }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={name ?? ''}
        width={size}
        height={size}
        loading={eager ? 'eager' : 'lazy'}
        decoding="async"
        draggable={false}
      />
    </span>
  );
}
