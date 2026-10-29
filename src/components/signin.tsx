'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { AuthError, confirmCode, refresh, requestCode, setSession, startProvider } from '@/lib/account';
import { BUTTON } from './ui';

// Sign in with a six-digit code by email, or with Google or Discord when the site has them. The first code creates the account.

export interface Methods {
  email: boolean;
  google: boolean;
  discord: boolean;
}
type Provider = 'google' | 'discord';
/** Seconds before a new code can be asked for: the server holds the same line (CODE_GAP in lib/auth.ts). */
const WAIT = 45;

const panel = 'frame p-6 sm:p-8';
const link = 'underline decoration-white/25 underline-offset-4 transition-colors hover:text-vellum hover:decoration-gilt';

/** Already signed in (a bookmark, Back, a forgotten marker): note it and carry on. */
export function Resume({ next }: { next: string }) {
  const router = useRouter();
  useEffect(() => {
    setSession(true);
    void refresh(true).finally(() => router.replace(next));
  }, [next, router]);
  return (
    <div className={panel}>
      <p className="text-lg font-semibold text-vellum">You are signed in.</p>
      <Link href={next} className={`${BUTTON.base} ${BUTTON.primary} mt-5`}>
        Continue
      </Link>
    </div>
  );
}

const ERRORS: Record<string, string> = {
  NETWORK: 'No connection. Check your internet and try again.',
  INVALID_OTP: 'That code is not right. Check it and try again.',
  OTP_EXPIRED: 'That code has expired. Ask for a new one.',
  TOO_MANY_ATTEMPTS: 'Too many wrong tries. Ask for a new code.',
  INVALID_EMAIL: 'That email address does not look right.',
};
function describe(e: unknown, sending: boolean) {
  if (!(e instanceof AuthError)) return 'Something went wrong. Try again.';
  if (ERRORS[e.code]) return ERRORS[e.code];
  if (e.status === 429) return sending && e.message ? e.message : 'Too many tries. Wait a minute and try again.';
  return e.status >= 500 && e.message ? e.message : 'Something went wrong. Try again.';
}

export function SignIn({ next, methods, dev, failed }: { next: string; methods: Methods; dev: boolean; failed: boolean }) {
  const router = useRouter();
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState<'' | 'email' | 'code' | Provider>('');
  const [wait, setWait] = useState(0);
  const misses = useRef(0); // wrong tries with the current code: after five it no longer works
  const [info, setInfo] = useState('');
  const [error, setError] = useState(failed ? 'That sign-in did not go through. Try again, or use an email code.' : '');
  const codeBox = useRef<HTMLInputElement>(null);
  const providers = (['google', 'discord'] as const).filter((p) => methods[p]);
  const say = (err: string, note = '') => {
    setError(err);
    setInfo(note);
  };

  useEffect(() => {
    if (step === 'code') codeBox.current?.focus();
  }, [step]);
  useEffect(() => {
    // the seconds until a new code may be asked for
    if (wait <= 0) return;
    const t = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);
  useEffect(() => {
    // back from a provider with the Back button: the page is restored as it was left
    const back = (e: PageTransitionEvent) => {
      if (e.persisted) setBusy('');
    };
    addEventListener('pageshow', back);
    return () => removeEventListener('pageshow', back);
  }, []);

  async function send(again: boolean) {
    const to = email.trim().toLowerCase();
    if (!to || busy) return;
    setBusy('email');
    say('');
    const toCode = (note: string) => {
      misses.current = 0;
      setEmail(to);
      setStep('code');
      setCode('');
      setWait(WAIT);
      setInfo(note);
    };
    try {
      await requestCode(to);
      toCode(again ? 'A new code is on its way.' : '');
    } catch (e) {
      // a code that went out a moment ago still works
      if (e instanceof AuthError && e.code === 'CODE_FRESH') toCode('A code was just sent to this address. Enter it, or wait a moment to ask for a new one.');
      else setError(describe(e, true));
    }
    setBusy('');
  }
  async function verify(value: string) {
    if (busy || value.length !== 6) return;
    setBusy('code');
    say('');
    try {
      await confirmCode(email, value);
      router.replace(next); // stays busy: the page changes
    } catch (e) {
      const wrong = e instanceof AuthError && e.code === 'INVALID_OTP';
      if (wrong) misses.current++;
      setError(wrong && misses.current >= 5 ? ERRORS.TOO_MANY_ATTEMPTS : describe(e, false));
      setCode('');
      setBusy('');
      codeBox.current?.focus();
    }
  }
  async function provider(name: Provider) {
    if (busy) return;
    setBusy(name);
    say('');
    try {
      await startProvider(name, next);
    } catch (e) {
      setError(describe(e, false));
      setBusy('');
    }
  }

  const submitEmail = (e: FormEvent) => {
    e.preventDefault();
    void send(false);
  };
  const submitCode = (e: FormEvent) => {
    e.preventDefault();
    void verify(code);
  };
  const feedback = (
    <div aria-live="polite">
      {error && (
        <p role="alert" className="mt-4 rounded-xl bg-blood/10 px-4 py-3 text-[15px] text-[#f5b2a6] ring-1 ring-inset ring-blood/30">
          {error}
        </p>
      )}
      {!error && info && <p className="mt-4 rounded-xl bg-leaf/10 px-4 py-3 text-[15px] text-leaf-bright ring-1 ring-inset ring-leaf/25">{info}</p>}
    </div>
  );
  if (!methods.email && !providers.length) return <p className={`${panel} text-mist`}>Signing in is not available right now. Please try again later.</p>;

  return (
    <div>
      <div className={`${panel} gilt`}>
        {step === 'email' ? (
          <>
            {methods.email && (
              <form onSubmit={submitEmail}>
                <label htmlFor="email" className="text-[15px] font-semibold text-vellum">
                  Email address
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  autoFocus
                  autoComplete="email"
                  inputMode="email"
                  autoCapitalize="none"
                  spellCheck={false}
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="field mt-2 h-12 text-[16px] placeholder:text-fog"
                />
                <button type="submit" disabled={!!busy} className={`${BUTTON.base} ${BUTTON.primary} mt-4 w-full disabled:opacity-60`}>
                  {busy === 'email' ? 'Sending…' : 'Email me a code'}
                </button>
              </form>
            )}
            {methods.email && providers.length > 0 && (
              <div className="my-6 flex items-center gap-4 text-[13px] text-fog">
                <span className="h-px flex-1 bg-white/10" />
                or
                <span className="h-px flex-1 bg-white/10" />
              </div>
            )}
            {providers.length > 0 && (
              <div className="grid gap-3">
                {providers.map((p) => (
                  <button key={p} type="button" onClick={() => void provider(p)} disabled={!!busy} className={`${BUTTON.base} ${BUTTON.ghost} w-full disabled:opacity-60`}>
                    {busy === p ? 'Opening…' : `Continue with ${p === 'google' ? 'Google' : 'Discord'}`}
                  </button>
                ))}
              </div>
            )}
            {feedback}
          </>
        ) : (
          <>
            <h2 className="text-[1.9rem] leading-tight text-vellum">Check your email</h2>
            <p className="mt-3 text-mist">
              We sent a six-digit code to <strong className="break-words text-vellum">{email}</strong>. It works for 10 minutes.
            </p>
            <form onSubmit={submitCode} className="mt-6">
              <label htmlFor="code" className="sr-only">
                Six-digit code
              </label>
              <input
                ref={codeBox}
                id="code"
                name="code"
                required
                autoComplete="one-time-code"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                placeholder="000000"
                value={code}
                onChange={(e) => {
                  const v = e.target.value.replace(/\D/g, '').slice(0, 6);
                  setCode(v);
                  if (v.length === 6) void verify(v);
                }}
                className="field num h-16 pl-[0.4em] text-center text-[30px] tracking-[0.4em] placeholder:text-ash"
              />
              <button type="submit" disabled={code.length !== 6 || !!busy} className={`${BUTTON.base} ${BUTTON.primary} mt-4 w-full disabled:opacity-60`}>
                {busy === 'code' ? 'Checking…' : 'Sign in'}
              </button>
            </form>
            {feedback}
            <div className="mt-6 flex flex-wrap items-center justify-between gap-x-6 gap-y-3 text-[15px] text-mist">
              <button
                type="button"
                onClick={() => {
                  setStep('email');
                  say('');
                }}
                className={link}
              >
                Use another email
              </button>
              <button type="button" onClick={() => void send(true)} disabled={wait > 0 || !!busy} className={`${link} disabled:pointer-events-none disabled:no-underline disabled:opacity-60`}>
                {wait > 0 ? `Send a new code in ${wait}s` : 'Send a new code'}
              </button>
            </div>
            <p className="mt-5 text-[13px] text-fog">Nothing yet? Look in the spam folder too.</p>
          </>
        )}
        {dev && (
          <p className="mt-5 rounded-xl bg-gilt/10 px-4 py-3 text-[13.5px] text-gilt-bright ring-1 ring-inset ring-gilt/25">
            Running on your computer without an email service: the code is printed in the terminal where Grimoire is running.
          </p>
        )}
      </div>
      <p className="mt-6 text-center text-[13.5px] leading-relaxed text-fog">
        New here? Your first code creates your account. By continuing you confirm you are 16 or older and accept the{' '}
        <Link href="/legal" className={link}>
          terms and privacy policy
        </Link>
        .
      </p>
    </div>
  );
}
