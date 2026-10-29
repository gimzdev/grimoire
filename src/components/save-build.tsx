'use client';

import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { notify, saveBuild, useAccount } from '@/lib/account';
import { ACCOUNTS, NAME_MAX, buildPath, cleanName, type BuildKind } from '@/lib/accounts';
import { CheckMark, SaveMark } from './marks';
import { BUTTON } from './ui';

/**
 * "Save" for a planner: asks for a name (a suggestion is filled in), then keeps the build on screen on your profile.
 * Signed out, it signs you in first and saves right after, under the name you gave. Without accounts it is not there at all.
 */
export function SaveBuild({ kind, path, name, className, disabled = false }: { kind: BuildKind; path: string; name: string; className: string; disabled?: boolean }) {
  const account = useAccount();
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    // back from the sign-in page with the Back button: the page is restored as it was left, mid-save
    const back = (e: PageTransitionEvent) => {
      if (!e.persisted) return;
      setBusy(false);
      setAsking(false);
    };
    addEventListener('pageshow', back);
    return () => removeEventListener('pageshow', back);
  }, []);
  if (!ACCOUNTS) return null;

  const link = buildPath(kind, path);
  const saved = !!link && account.phase === 'in' && account.saved.includes(link);
  const open = () => {
    if (!link || busy) return;
    if (saved) return notify('This build is already on your profile.', { href: '/profile', label: 'Open profile' });
    setAsking(true);
  };
  const close = () => {
    setAsking(false);
    button.current?.focus();
  };
  const save = async (chosen: string) => {
    setBusy(true);
    const result = await saveBuild(kind, path, chosen);
    if (result === 'signin') return; // signing in leaves the page; the build is saved when you are back
    setBusy(false);
    if (result === 'saved') close();
  };
  const title = saved ? 'This build is on your profile' : account.phase === 'out' ? 'Sign in to save this build' : 'Save this build to your profile';
  return (
    <>
      <button ref={button} type="button" onClick={open} disabled={disabled || !link || busy} aria-haspopup={saved ? undefined : 'dialog'} title={title} className={className}>
        {saved ? <CheckMark className="size-[15px]" /> : <SaveMark className="size-[14px]" />}
        {busy && !asking ? 'Saving…' : saved ? 'Saved' : 'Save'}
      </button>
      {asking && <NameDialog kind={kind} suggestion={name} busy={busy} signedOut={account.phase === 'out'} onCancel={close} onSave={(n) => void save(n)} />}
    </>
  );
}

const WHAT: Record<BuildKind, string> = { talents: 'talent build', gear: 'gear set', raid: 'raid comp', legacy: 'Legacy build' };

function NameDialog({ kind, suggestion, busy, signedOut, onCancel, onSave }: { kind: BuildKind; suggestion: string; busy: boolean; signedOut: boolean; onCancel: () => void; onSave: (name: string) => void }) {
  const id = useId();
  const [draft, setDraft] = useState(suggestion);
  const box = useRef<HTMLDivElement>(null);
  const field = useRef<HTMLInputElement>(null);
  useEffect(() => {
    field.current?.select();
  }, []);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!busy) onSave(cleanName(draft) || cleanName(suggestion));
  };
  // Escape closes; Tab stays inside the dialog
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && !busy) {
      e.stopPropagation();
      onCancel();
    }
    if (e.key !== 'Tab' || !box.current) return;
    const stops = [...box.current.querySelectorAll<HTMLElement>('input:not([disabled]), button:not([disabled])')];
    const first = stops[0];
    const last = stops[stops.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last?.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first?.focus();
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 px-4 pt-[18vh] backdrop-blur-[2px]" onMouseDown={(e) => e.target === e.currentTarget && !busy && onCancel()}>
      <div
        ref={box}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-title`}
        onKeyDown={onKey}
        className="w-full max-w-[420px] animate-menu rounded-[22px] border border-white/[0.08] bg-[#0e1014] p-5 shadow-[inset_0_1px_0_rgb(255_255_255/0.05),0_40px_80px_-30px_rgb(0_0_0/0.95)] sm:p-6"
      >
        <h2 id={`${id}-title`} className="text-[1.3rem] leading-tight text-vellum">
          Save this {WHAT[kind]}
        </h2>
        <form onSubmit={submit} className="mt-4">
          <label htmlFor={`${id}-name`} className="text-[14px] font-medium text-mist">
            Name
          </label>
          <input
            ref={field}
            id={`${id}-name`}
            value={draft}
            maxLength={NAME_MAX}
            disabled={busy}
            onChange={(e) => setDraft(e.target.value)}
            className="field mt-1.5 h-11 px-3 text-[16px]"
            autoComplete="off"
            spellCheck={false}
          />
          <p className="mt-2 text-[13.5px] text-fog">{signedOut ? 'You sign in first, then it is saved under this name.' : 'You can rename it later on your profile.'}</p>
          <div className="mt-5 flex flex-wrap justify-end gap-2.5">
            <button type="button" onClick={onCancel} disabled={busy} className={`${BUTTON.base} ${BUTTON.ghost} h-11 px-5`}>
              Cancel
            </button>
            <button type="submit" disabled={busy} className={`${BUTTON.base} ${BUTTON.primary} h-11 px-5`}>
              {busy ? 'Saving…' : signedOut ? 'Sign in and save' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}
