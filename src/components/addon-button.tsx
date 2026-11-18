'use client';
import type { ReactNode } from 'react';
import { ADDON } from '@/lib/site';
import { trackEvent } from '@/lib/track';
import { WowIcon } from './icon';
import { BUTTON } from './ui';

/** "Get the add-on": its CurseForge page, counted as addon_click with the place it was clicked from. */
export function AddonButton({ from, children = 'Get the add-on', variant = 'primary', className = '' }: { from: string; children?: ReactNode; variant?: 'primary' | 'ghost'; className?: string }) {
  return (
    <a href={ADDON.url} target="_blank" rel="noopener noreferrer" onClick={() => trackEvent('addon_click', { from })} className={`${BUTTON.base} ${BUTTON[variant]} ${className}`}>
      {children}
    </a>
  );
}

/** Beside a tool the add-on mirrors: what the add-on does with it in game, and the button. */
export function AddonStrip({ from, children, className = '' }: { from: string; children: ReactNode; className?: string }) {
  return (
    <aside className={`frame flex flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3 sm:px-5 ${className}`}>
      <WowIcon icon="inv_misc_book_09" size={34} name="Grimoire add-on" />
      <p className="min-w-[14rem] flex-1 text-[15px] leading-snug text-parch">{children}</p>
      <AddonButton from={from} variant="ghost" className="!h-10 !px-5 !text-[14.5px]" />
    </aside>
  );
}

/** The add-on's CurseForge page as a link in a sentence or a menu, counted as addon_click like the button. */
export function AddonLink({ from, children, className = '', title }: { from: string; children: ReactNode; className?: string; title?: string }) {
  return (
    <a href={ADDON.url} target="_blank" rel="noopener noreferrer" title={title} onClick={() => trackEvent('addon_click', { from })} className={className}>
      {children}
    </a>
  );
}
