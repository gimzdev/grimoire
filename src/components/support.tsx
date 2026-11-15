'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { PATREON } from '@/lib/site';

// Support on Patreon, on the website only: the add-on never asks for anything (Blizzard's add-on policy). A quiet note where
// Grimoire has just been useful (the end of a guide, the end of a stretch of a leveling route); "Not now" hides every note on
// this device for four months. The header, the guides' side column and the footer keep a plain link.

const KEY = 'grimoire:support-hidden';
const QUIET = 120 * 864e5;

export function HeartIcon({ className = 'size-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={className} fill="currentColor" aria-hidden>
      <path d="M8 13.6S2.2 10.2 2.2 6.3A2.9 2.9 0 0 1 8 4.9a2.9 2.9 0 0 1 5.8 1.4c0 3.9-5.8 7.3-5.8 7.3z" />
    </svg>
  );
}

export function SupportNote({ children, className = '' }: { children: ReactNode; className?: string }) {
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    try {
      const at = Number(window.localStorage.getItem(KEY));
      if (at && Date.now() - at < QUIET) setHidden(true);
    } catch {
      // Storage blocked: the note stays.
    }
  }, []);
  if (hidden) return null;
  const hide = () => {
    setHidden(true);
    try {
      window.localStorage.setItem(KEY, String(Date.now()));
    } catch {
      // Storage blocked: hidden until the next visit.
    }
  };
  return (
    <aside aria-label="Support Grimoire" className={`flex items-start gap-3 rounded-2xl border border-dashed border-iron px-5 py-4 text-[15px] leading-relaxed text-mist ${className}`}>
      <HeartIcon className="mt-1 size-4 shrink-0 text-gilt" />
      <p className="min-w-0 flex-1 text-pretty">
        {children}{' '}
        <a
          href={PATREON}
          target="_blank"
          rel="noopener noreferrer"
          className="whitespace-nowrap font-[560] text-gilt-bright underline decoration-gilt/40 underline-offset-2 transition-colors hover:text-gilt"
        >
          Support on Patreon
        </a>
      </p>
      <button
        type="button"
        onClick={hide}
        title="Not now"
        aria-label="Hide this note"
        className="-mr-2 -mt-1.5 inline-flex size-8 shrink-0 items-center justify-center rounded-full text-fog transition-colors hover:bg-white/[0.06] hover:text-vellum"
      >
        <svg viewBox="0 0 20 20" className="size-4" aria-hidden>
          <path d="m5.5 5.5 9 9m0-9-9 9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      </button>
    </aside>
  );
}

/** A plain link, for the guides' side column. */
export function SupportLink({ className = '' }: { className?: string }) {
  return (
    <a href={PATREON} target="_blank" rel="noopener noreferrer" className={`flex items-center gap-2 text-[14px] text-mist transition-colors hover:text-vellum ${className}`}>
      <HeartIcon className="size-3.5 text-gilt" />
      Support on Patreon
    </a>
  );
}
