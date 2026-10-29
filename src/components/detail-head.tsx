import Link from 'next/link';
import type { ReactNode } from 'react';

export type Crumb = [label: string, href?: string];

export function Crumbs({ items, className = '' }: { items: Crumb[]; className?: string }) {
  return (
    <nav aria-label="Breadcrumb" className={`flex flex-wrap items-center gap-1.5 text-[14px] text-mist ${className}`}>
      {items.map(([label, href], i) => (
        <span key={label + i} className="inline-flex items-center gap-1.5">
          {i > 0 && (
            <svg viewBox="0 0 12 12" className="size-3 text-fog" aria-hidden>
              <path d="m4.5 2.5 3.5 3.5-3.5 3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
          {href ? (
            <Link href={href} className="transition-colors hover:text-vellum">
              {label}
            </Link>
          ) : (
            <span className="text-parch">{label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}

/**
 * The top of a database page: the thing itself in a rounded window, lit by a blurred wash of its own
 * picture (an item's icon, a reward, a zone), with its tooltip or key facts on the right.
 */
export function DetailHead({
  crumbs,
  icon,
  title,
  titleColor,
  meta,
  badges,
  aside,
  wash,
  tint,
  children,
}: {
  crumbs: Crumb[];
  icon?: ReactNode;
  title: ReactNode;
  titleColor?: string;
  meta?: ReactNode;
  badges?: ReactNode;
  aside?: ReactNode;
  /** A picture to blur into the background, usually the item's own icon. */
  wash?: string;
  /** A glow behind the right-hand side, usually the quality colour. */
  tint?: string;
  children?: ReactNode;
}) {
  return (
    <section className="relative -mt-[84px] mb-10 px-2 pt-2 sm:mb-12 sm:px-2.5 sm:pt-2.5">
      <div className="relative isolate overflow-hidden rounded-[22px] bg-night sm:rounded-[28px]">
        {wash && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={wash} alt="" aria-hidden className="absolute inset-0 -z-20 size-full scale-110 object-cover opacity-55 blur-[90px] saturate-[1.6]" />
        )}
        <div aria-hidden className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgb(8_9_12/0.25)_0%,rgb(8_9_12/0.55)_55%,rgb(8_9_12/0.85)_100%)]" />
        {tint && <div aria-hidden className="absolute -right-24 top-1/2 -z-10 hidden size-[640px] -translate-y-1/2 rounded-full opacity-[0.16] blur-[100px] lg:block" style={{ background: tint }} />}
        <div aria-hidden className="pointer-events-none absolute inset-0 rounded-[inherit] ring-1 ring-inset ring-white/[0.08]" />
        <div className="mx-auto w-full max-w-[1320px] px-5 pb-9 pt-[108px] sm:px-6 sm:pb-12 sm:pt-[116px]">
          <div className="grid items-center gap-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:gap-12">
            <div className="min-w-0">
              <Crumbs items={crumbs} />
              <div className="mt-5 flex items-center gap-4 sm:gap-5">
                {icon}
                <div className="min-w-0">
                  <h1 className="text-[2.1rem] leading-[1.05] sm:text-[2.9rem]" style={titleColor ? { color: titleColor } : undefined}>
                    {title}
                  </h1>
                  {meta && <div className="mt-2 text-[16px] text-parch">{meta}</div>}
                </div>
              </div>
              {badges && <div className="mt-5 flex flex-wrap gap-2">{badges}</div>}
              {children}
            </div>
            {aside && <div className="min-w-0 lg:justify-self-end">{aside}</div>}
          </div>
        </div>
      </div>
    </section>
  );
}
