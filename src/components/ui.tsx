import Link from 'next/link';
import type { ReactNode } from 'react';

export function Container({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`mx-auto w-full max-w-[1320px] px-4 sm:px-6 ${className}`}>{children}</div>;
}

/** A small rounded link for "see all" style actions next to a heading. */
export function PillLink({ href, children, className = '' }: { href: string; children: ReactNode; className?: string }) {
  return (
    <Link
      href={href}
      className={`inline-flex h-10 shrink-0 items-center rounded-full bg-white/[0.06] px-[18px] text-[14px] font-[560] text-parch ring-1 ring-inset ring-white/[0.08] transition-colors hover:bg-white/[0.1] hover:text-vellum ${className}`}
    >
      {children}
    </Link>
  );
}

export function SectionTitle({ title, children, href, linkLabel, id }: { title: ReactNode; children?: ReactNode; href?: string; linkLabel?: string; id?: string }) {
  return (
    <div id={id} className="mb-8 flex scroll-mt-28 flex-wrap items-end justify-between gap-x-8 gap-y-4">
      <div className="max-w-3xl">
        <h2 className="text-[2rem] leading-[1.05] text-vellum sm:text-[2.6rem]">{title}</h2>
        {children && <p className="mt-3 max-w-2xl text-[16.5px] leading-relaxed text-mist">{children}</p>}
      </div>
      {href && <PillLink href={href}>{linkLabel ?? 'See all'}</PillLink>}
    </div>
  );
}

export function Panel({ children, className = '', gilt = false, as: As = 'div' }: { children: ReactNode; className?: string; gilt?: boolean; as?: 'div' | 'section' | 'aside' | 'article' }) {
  return <As className={`frame ${gilt ? 'gilt' : ''} ${className}`}>{children}</As>;
}

type Tone = 'new' | 'changed' | 'removed' | 'gilt' | 'neutral' | 'alliance' | 'horde' | 'good';
const TONES: Record<Tone, string> = {
  new: 'bg-leaf/[0.12] text-leaf-bright ring-leaf/25',
  changed: 'bg-gilt/[0.12] text-gilt-bright ring-gilt/25',
  removed: 'bg-blood/[0.12] text-[#f19a88] ring-blood/30',
  gilt: 'bg-gilt/[0.14] text-gilt-bright ring-gilt/30',
  neutral: 'bg-white/[0.06] text-parch ring-white/10',
  alliance: 'bg-alliance/[0.12] text-[#a9c8f5] ring-alliance/30',
  horde: 'bg-horde/[0.12] text-[#f5a196] ring-horde/30',
  good: 'bg-moss/[0.12] text-[#c6e2a4] ring-moss/30',
};

export function Badge({ tone = 'neutral', children, className = '', title }: { tone?: Tone; children: ReactNode; className?: string; title?: string }) {
  return (
    <span title={title} className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-[2px] text-[12.5px] font-semibold leading-[1.35] ring-1 ring-inset ${TONES[tone]} ${className}`}>
      {children}
    </span>
  );
}

export function StatusBadge({ status, className = '' }: { status: 'new' | 'changed' | 'same' | 'updated' | 'removed' | 'unconfirmed' | string | null | undefined; className?: string }) {
  if (status === 'new') return <Badge tone="new" className={className}>New in Forever</Badge>;
  if (status === 'changed' || status === 'updated') return <Badge tone="changed" className={className}>Changed</Badge>;
  if (status === 'removed') return <Badge tone="removed" className={className}>Removed</Badge>;
  if (status === 'unconfirmed') return <Badge tone="neutral" className={className} title="Stats are hidden until a player discovers the item">Stats unconfirmed</Badge>;
  return null;
}

export const BUTTON = {
  base: 'inline-flex h-12 items-center justify-center gap-2 rounded-full px-6 text-[15px] font-semibold transition-[background-color,color,box-shadow] duration-150',
  primary: 'bg-gilt text-[#1a1204] shadow-[inset_0_1px_0_rgb(255_255_255/0.45),0_12px_32px_-14px_rgb(242_182_64/0.6)] hover:bg-gilt-bright',
  ghost: 'bg-white/[0.07] text-vellum ring-1 ring-inset ring-white/[0.12] backdrop-blur-md hover:bg-white/[0.12]',
};

export function ButtonLink({ href, children, variant = 'primary', className = '' }: { href: string; children: ReactNode; variant?: 'primary' | 'ghost'; className?: string }) {
  return (
    <Link href={href} className={`${BUTTON.base} ${BUTTON[variant]} ${className}`}>
      {children}
    </Link>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="rounded-md bg-white/[0.07] px-1.5 py-px font-sans text-[12px] font-medium text-mist ring-1 ring-inset ring-white/10">{children}</kbd>;
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="frame px-6 py-10 text-center">
      <div className="text-xl font-semibold tracking-[-0.015em] text-vellum">{title}</div>
      {children && <div className="mx-auto mt-2 max-w-md text-mist">{children}</div>}
    </div>
  );
}
