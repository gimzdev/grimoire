import Image from 'next/image';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { resolveArt } from '@/lib/art-server';

/** A picture card: official art in a rounded window, with text set low over a dark gradient. */
export function ArtCard({
  art,
  href,
  children,
  tag,
  className = '',
  outerClassName = '',
  sizes = '(min-width: 1024px) 33vw, 100vw',
  minH = 'min-h-[260px]',
}: {
  art: string;
  href?: string;
  children: ReactNode;
  /** A short label in a frosted chip at the top left. */
  tag?: ReactNode;
  className?: string;
  /** Classes for the outermost element, e.g. grid spans. */
  outerClassName?: string;
  sizes?: string;
  minH?: string;
}) {
  const a = resolveArt(art);
  const body = (
    <div className={`group relative isolate flex h-full ${minH} flex-col justify-end overflow-hidden rounded-[20px] bg-slate ${href ? '' : outerClassName} ${className}`}>
      <Image
        src={a.src}
        alt={a.alt}
        fill
        sizes={sizes}
        quality={75}
        className="-z-20 object-cover transition-transform duration-700 ease-[var(--ease-out-quint)] group-hover:scale-[1.03]"
        style={{ objectPosition: a.focus ?? 'center', transform: a.zoom ? `scale(${a.zoom})` : undefined }}
      />
      <div aria-hidden className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgb(8_9_12/0)_0%,rgb(8_9_12/0.1)_38%,rgb(8_9_12/0.88)_100%)]" />
      <div aria-hidden className="pointer-events-none absolute inset-0 rounded-[inherit] ring-1 ring-inset ring-white/[0.09] transition-[box-shadow] duration-300 group-hover:ring-white/25" />
      {tag && (
        <span className="glass absolute left-4 top-4 rounded-full px-3 py-1 text-[12.5px] font-semibold text-vellum">
          {tag}
        </span>
      )}
      <div className="p-6">{children}</div>
    </div>
  );
  return href ? (
    <Link href={href} className={`block rounded-[20px] outline-offset-4 ${outerClassName}`}>
      {body}
    </Link>
  ) : (
    body
  );
}
