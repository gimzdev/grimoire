'use client';

import Link from 'next/link';
import { dismiss, holdNotice, useNotice } from '@/lib/account';

/** A short message at the bottom of the screen. The region stays in the page so screen readers announce what appears in it. */
export function Notice() {
  const n = useNotice();
  return (
    <div role="status" aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-5 z-[70] flex justify-center px-4">
      {n && (
        <div
          key={n.text}
          onMouseEnter={() => holdNotice(true)}
          onMouseLeave={() => holdNotice(false)}
          onFocus={() => holdNotice(true)}
          onBlur={(e) => !e.currentTarget.contains(e.relatedTarget as Node | null) && holdNotice(false)}
          className="pointer-events-auto flex max-w-xl animate-rise items-center gap-3 rounded-2xl border border-white/[0.1] bg-[rgb(18_20_25/0.96)] py-2 pl-5 pr-2 text-[15px] leading-snug text-vellum shadow-[inset_0_1px_0_rgb(255_255_255/0.06),0_24px_60px_-20px_rgb(0_0_0/0.9)] backdrop-blur-xl"
        >
          <span className="min-w-0 py-1">{n.text}</span>
          {n.link && (
            <Link href={n.link.href} onClick={dismiss} className="shrink-0 rounded-full bg-gilt px-3.5 py-1.5 text-[14px] font-semibold text-[#1a1204] transition-colors hover:bg-gilt-bright">
              {n.link.label}
            </Link>
          )}
          <button type="button" onClick={dismiss} aria-label="Dismiss" className="grid size-8 shrink-0 place-items-center rounded-full text-mist transition-colors hover:bg-white/10 hover:text-vellum">
            <svg viewBox="0 0 20 20" className="size-4" aria-hidden>
              <path d="m5.5 5.5 9 9m0-9-9 9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}
