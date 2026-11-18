'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react';
import { signInHref, signOut, useAccount } from '@/lib/account';
import { ACCOUNTS } from '@/lib/accounts';
import { SaveMark } from './marks';

const ring = 'ring-1 ring-inset ring-white/[0.08]';

function Person({ className = 'size-[18px]' }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" className={className} aria-hidden>
      <circle cx="10" cy="7" r="3.4" fill="none" stroke="currentColor" strokeWidth="1.7" />
      <path d="M3.8 17c.9-3.1 3.4-4.8 6.2-4.8s5.3 1.7 6.2 4.8" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

/**
 * Sign in, or the account menu. Until the browser knows who is signed in, both are in the page and the CSS shows the right one
 * (<html data-signed> is set before the first paint), so the header never flashes the wrong button.
 */
export function AccountMenu() {
  const account = useAccount();
  const path = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => setOpen(false), [path]);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        box.current?.querySelector('button')?.focus();
      }
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (!ACCOUNTS) return null;

  // Back to this very page afterwards, planner state included (it lives in the address).
  const toSignIn = (e: ReactMouseEvent<HTMLAnchorElement>) => {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    router.push(signInHref());
  };
  const signIn = (extra = '') => (
    <Link
      href="/signin"
      onClick={toSignIn}
      className={`inline-flex h-10 items-center gap-2 rounded-full bg-white/[0.07] px-[11px] text-[14.5px] font-[560] text-parch ${ring} transition-colors hover:bg-white/[0.12] hover:text-vellum sm:px-4 ${extra}`}
    >
      <Person />
      <span className="hidden sm:inline">Sign in</span>
    </Link>
  );

  if (account.phase === 'idle' || account.phase === 'loading')
    return (
      <>
        {signIn('signed:hidden')}
        <span aria-hidden className={`hidden size-10 rounded-full bg-gilt/[0.12] ${ring} signed:inline-block`} />
      </>
    );
  if (account.phase === 'out') return signIn();

  const item = 'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[14.5px] font-medium text-parch transition-colors hover:bg-white/[0.06] hover:text-vellum';
  return (
    <div ref={box} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={open ? 'account-menu' : undefined}
        aria-label={`Account, ${account.email}`}
        className="inline-flex size-10 items-center justify-center rounded-full bg-gilt/[0.14] text-[15px] font-semibold uppercase text-gilt-bright ring-1 ring-inset ring-gilt/30 transition-colors hover:bg-gilt/[0.22]"
      >
        {account.email.slice(0, 1)}
      </button>
      {open && (
        <div
          id="account-menu"
          className="absolute right-0 top-[calc(100%+12px)] z-20 w-64 animate-menu rounded-[18px] border border-white/[0.08] bg-[#0e1014] p-1.5 shadow-[inset_0_1px_0_rgb(255_255_255/0.05),0_30px_60px_-24px_rgb(0_0_0/0.95)]"
        >
          <p className="truncate px-3 pb-2 pt-2 text-[13px] text-fog" title={account.email}>
            {account.email}
          </p>
          <Link href="/profile" className={item}>
            <SaveMark className="size-4 text-gilt" />
            Profile
            {account.saved.length > 0 && <span className="num ml-auto text-[13px] text-fog">{account.saved.length}</span>}
          </Link>
          <div className="my-1.5 border-t border-white/[0.06]" />
          <button type="button" onClick={() => void signOut()} className={item}>
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
