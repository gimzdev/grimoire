// The signed-in state in the browser, shared by the header, the Save buttons and the profile page. A module, not a context: every
// button on the page reads and changes the same state. A visitor who never signed in makes no request at all.
import { useEffect, useSyncExternalStore } from 'react';
import { ACCOUNTS, BUILD_KINDS, buildPath, type BuildKind, type Tile } from './accounts';

// Storage can be blocked or full: nothing here may throw
const FLAG = 'grimoire:session';
const NOTICE = 'grimoire:notice';
const PENDING = 'grimoire:pending-save';
const local = {
  get: (k: string) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k: string, v: string) => { try { localStorage.setItem(k, v); } catch {} },
  del: (k: string) => { try { localStorage.removeItem(k); } catch {} },
};
const tab = {
  get: (k: string) => { try { return sessionStorage.getItem(k); } catch { return null; } },
  set: (k: string, v: string) => { try { sessionStorage.setItem(k, v); } catch {} },
  del: (k: string) => { try { sessionStorage.removeItem(k); } catch {} },
};
export const drop = (res: Response) => {
  void res.body?.cancel().catch(() => {});
};

const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());
const subscribe = (f: () => void) => {
  subs.add(f);
  return () => {
    subs.delete(f);
  };
};

/** The "signed in" marker: set by signing in, cleared by a 401, read by the page head before paint (no flash of the wrong button). */
export function setSession(on: boolean) {
  if (on) local.set(FLAG, '1');
  else local.del(FLAG);
  document.documentElement.toggleAttribute('data-signed', on);
}

// ── Notices: one short message at the bottom of the screen ──

export interface Notice {
  text: string;
  link?: { href: string; label: string };
}
let notice: Notice | null = null;
let timer: ReturnType<typeof setTimeout> | undefined;
const arm = (n: Notice, ms = n.link ? 10_000 : 6_500) => {
  clearTimeout(timer);
  timer = setTimeout(() => {
    if (notice === n) dismiss();
  }, ms);
};
export function notify(text: string, link?: Notice['link']) {
  const n = { text, link };
  notice = n;
  emit();
  arm(n);
}
export function dismiss() {
  clearTimeout(timer);
  notice = null;
  emit();
}
/** Pointing at or tabbing into the notice keeps it on screen; leaving gives it a few more seconds. */
export function holdNotice(on: boolean) {
  clearTimeout(timer);
  if (!on && notice) arm(notice, 4_000);
}
/** A notice for the next page (after a full navigation). */
const notifyNext = (text: string) => tab.set(NOTICE, text);
export function useNotice() {
  useEffect(() => {
    const m = tab.get(NOTICE);
    if (m) {
      tab.del(NOTICE);
      notify(m);
    }
  }, []);
  return useSyncExternalStore(subscribe, () => notice, () => null);
}

// ── Who is signed in ──

/** idle: not asked yet (server render, first paint). loading: signed in before, asking again. out, in: answered. */
export interface Account {
  phase: 'idle' | 'loading' | 'out' | 'in';
  email: string;
  since: string;
  /** The links this person saved, so a planner can show "Saved". */
  saved: string[];
}
const IDLE: Account = { phase: 'idle', email: '', since: '', saved: [] };
let state = IDLE;
const put = (next: Partial<Account>) => {
  state = { ...state, ...next };
  emit();
};
const out = () => {
  setSession(false);
  put({ ...IDLE, phase: 'out' });
};

let loading: Promise<void> | null = null;
/**
 * Asks the server who is signed in. A question already on its way is shared, unless `fresh`: something just changed (the
 * marker was set, another tab signed in or out), so a new question goes out after it.
 */
export function refresh(fresh = false): Promise<void> {
  if (!ACCOUNTS) return Promise.resolve();
  if (loading && !fresh) return loading;
  const run: Promise<void> = (loading ?? Promise.resolve()).catch(() => {}).then(load).finally(() => {
    if (loading === run) loading = null;
  });
  loading = run;
  return run;
}

/** Whether this browser signed in: null when its storage is blocked and cannot say. */
const marked = () => {
  try {
    return localStorage.getItem(FLAG) === '1';
  } catch {
    return null;
  }
};

async function load() {
  // no marker, no question; with storage blocked the server is asked every time, as there is no other way to know
  if (marked() === false) return put({ ...IDLE, phase: 'out' });
  if (state.phase !== 'in') put({ phase: 'loading' });
  try {
    const res = await fetch('/api/me', { cache: 'no-store' });
    if (res.status === 401) {
      drop(res);
      return out();
    }
    if (!res.ok) {
      drop(res);
      throw new Error(String(res.status));
    }
    const me = (await res.json()) as { email: string; since: string; saved?: string[] };
    put({ phase: 'in', email: me.email, since: me.since, saved: me.saved ?? [] });
    await savePending();
  } catch {
    if (state.phase === 'loading') put({ ...IDLE, phase: 'out' }); // unreachable now: signed out until the next page asks again
  }
}

let started = false;
const start = () => {
  if (!started) {
    started = true;
    void refresh();
  }
};

export function useAccount(): Account {
  const account = useSyncExternalStore(subscribe, () => state, () => IDLE);
  useEffect(start, []);
  return account;
}

/** The profile page renders with the account already known: no need to ask again (a fresher answer in this tab stays). */
export function seed(me: { email: string; since: string; saved: string[] }) {
  setSession(true);
  if (state.phase === 'in' && state.email === me.email) return;
  put({ phase: 'in', ...me });
}

// Signing in or out in another tab: this one follows
if (typeof window !== 'undefined')
  window.addEventListener('storage', (e) => {
    if (ACCOUNTS && (e.key === FLAG || e.key === null) && started) void refresh(true);
  });

const ready = () => (ACCOUNTS && (state.phase === 'idle' || state.phase === 'loading') ? refresh() : Promise.resolve());

// ── Saving builds ──

interface Pending {
  kind: BuildKind;
  path: string;
  name: string;
  at: number;
}
const sameLink = (a: string, b: string) => a === b;

/** Saves a planner's build to the profile. Signed out, it waits while you sign in and is saved right after. */
export async function saveBuild(kind: BuildKind, rawPath: string, name: string): Promise<'saved' | 'signin' | 'failed'> {
  const path = buildPath(kind, rawPath);
  if (!path) return 'failed';
  await ready();
  const p = { kind, path, name, at: Date.now() };
  if (state.phase !== 'in') return toSignIn(p);
  return post(p);
}

function toSignIn(p: Pending): 'signin' {
  tab.set(PENDING, JSON.stringify(p));
  location.assign(`/signin?next=${encodeURIComponent(p.path)}`);
  return 'signin';
}

async function post(p: Pending): Promise<'saved' | 'signin' | 'failed'> {
  try {
    const res = await fetch('/api/builds', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ kind: p.kind, path: p.path, name: p.name }) });
    if (res.status === 401) {
      drop(res);
      out();
      return toSignIn(p); // the session ended: sign in again, then it saves
    }
    const body = (await res.json().catch(() => null)) as { build?: Tile; created?: boolean; error?: string } | null;
    if (res.ok && body?.build) {
      if (!state.saved.some((s) => sameLink(s, body.build!.href))) put({ saved: [body.build.href, ...state.saved] });
      notify(body.created ? `Saved to your profile as “${body.build.name}”.` : `Already saved as “${body.build.name}”.`, { href: '/profile', label: 'Open profile' });
      return 'saved';
    }
    notify(body?.error ?? 'Could not save that. Check your connection and try again.');
  } catch {
    notify('Could not save that. Check your connection and try again.');
  }
  return 'failed';
}

/** A build someone tried to save before signing in (in this tab, in the last half hour) is saved now. */
async function savePending() {
  const raw = tab.get(PENDING);
  if (!raw) return;
  tab.del(PENDING);
  let p: Partial<Pending> | null = null;
  try {
    p = JSON.parse(raw) as Partial<Pending>;
  } catch {}
  const kind = BUILD_KINDS.find((k) => k === p?.kind);
  const path = kind && typeof p?.path === 'string' ? buildPath(kind, p.path) : null;
  if (!kind || !path || typeof p?.at !== 'number' || Date.now() - p.at > 30 * 60_000) return;
  await post({ kind, path, name: typeof p.name === 'string' ? p.name : '', at: p.at });
}

/** Signed out mid-change: say so and take the button back to "Sign in". */
function signedOutNow(res: Response) {
  drop(res);
  out();
  notify('You were signed out. Sign in again to keep going.');
}

export async function renameBuild(id: string, name: string): Promise<Tile | null> {
  try {
    const res = await fetch(`/api/builds/${id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name }) });
    if (res.status === 401) return (signedOutNow(res), null);
    const body = (await res.json().catch(() => null)) as { build?: Tile; error?: string } | null;
    if (res.ok && body?.build) return body.build;
    notify(body?.error ?? 'Could not rename that. Try again.');
  } catch {
    notify('Could not rename that. Check your connection and try again.');
  }
  return null;
}

export async function removeBuild(tile: Tile): Promise<boolean> {
  try {
    const res = await fetch(`/api/builds/${tile.id}`, { method: 'DELETE', headers: { 'content-type': 'application/json' }, body: '{}' });
    if (res.status === 401) return (signedOutNow(res), false);
    drop(res);
    if (!res.ok) throw new Error(String(res.status));
    put({ saved: state.saved.filter((s) => !sameLink(s, tile.href)) });
    return true;
  } catch {
    notify('Could not delete that. Check your connection and try again.');
    return false;
  }
}

// ── Legacy Challenges kept with the account ──

export interface LegacyProgress {
  done: string[];
  updatedAt: string;
}

/** The challenges this account ticked: null when it has none yet, 'out' when the session ended, 'failed' when unreachable. */
export async function loadLegacy(): Promise<LegacyProgress | null | 'out' | 'failed'> {
  try {
    const res = await fetch('/api/me/legacy', { cache: 'no-store' });
    if (res.status === 401) {
      drop(res);
      out();
      return 'out';
    }
    if (!res.ok) {
      drop(res);
      return 'failed';
    }
    const body = (await res.json()) as { progress?: LegacyProgress | null };
    return body.progress ?? null;
  } catch {
    return 'failed';
  }
}

/**
 * Puts this browser's changes onto the account: what differs between `base` (the list the account last gave) and `done`
 * is applied to the account's copy as it is now. Returns the account's list after that, or null when it did not work (the
 * browser keeps the ticks meanwhile). keepalive: the page is going away, so the request has to outlive it.
 */
export async function keepLegacy(base: string[], done: string[], keepalive = false): Promise<string[] | null> {
  try {
    const res = await fetch('/api/me/legacy', { method: 'PUT', keepalive, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ base, done }) });
    if (!res.ok) {
      drop(res);
      if (res.status === 401) out();
      return null;
    }
    const body = (await res.json()) as { progress?: LegacyProgress };
    return Array.isArray(body.progress?.done) ? body.progress.done : null;
  } catch {
    return null;
  }
}

// The planner's copy of the ticks in this browser (see legacy-planner.tsx): signing out sends what it has not got onto
// the account yet, then forgets the account's ticks, so the next person on this browser does not see them (the perk plan
// stays).
const LEGACY = 'grimoire.legacy.v2';
export const LEGACY_FORGET = 'grimoire:legacy-forget';
const strings = (v: unknown) => (Array.isArray(v) ? v.filter((k): k is string => typeof k === 'string') : null);
function legacyStore(): Record<string, unknown> | null {
  try {
    const raw = localStorage.getItem(LEGACY);
    const s: unknown = raw ? JSON.parse(raw) : null;
    return s && typeof s === 'object' ? (s as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}
async function flushLegacy() {
  const s = legacyStore();
  const base = strings(s?.base), done = strings(s?.done);
  if (!s || s.owner !== state.since || !base || !done) return;
  const b = new Set(base);
  if (base.length === done.length && done.every((k) => b.has(k))) return;
  await Promise.race([keepLegacy(base, done), new Promise((r) => setTimeout(r, 3000))]);
}
function forgetLegacy() {
  const s = legacyStore();
  if (s) local.set(LEGACY, JSON.stringify({ done: [], plan: typeof s.plan === 'string' ? s.plan : '' }));
  window.dispatchEvent(new Event(LEGACY_FORGET));
}

// ── Signing in and out ──

export class AuthError extends Error {
  constructor(
    public code: string,
    message: string,
    public status = 0,
  ) {
    super(message);
  }
}
async function call(path: string, body: unknown) {
  let res: Response;
  try {
    res = await fetch(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  } catch {
    throw new AuthError('NETWORK', 'No connection.');
  }
  const j = (await res.json().catch(() => null)) as { code?: string; message?: string; error?: string; url?: string } | null;
  if (!res.ok) throw new AuthError(j?.code ?? String(res.status), j?.message ?? j?.error ?? '', res.status);
  return j;
}

export const requestCode = (email: string) => call('/api/signin/code', { email });
export async function confirmCode(email: string, otp: string) {
  await call('/api/auth/sign-in/email-otp', { email, otp });
  setSession(true);
  await refresh(true);
}
export async function startProvider(provider: 'google' | 'discord', next: string) {
  const j = await call('/api/auth/sign-in/social', { provider, callbackURL: next, errorCallbackURL: `/signin?error=provider&next=${encodeURIComponent(next)}` });
  if (!j?.url) throw new AuthError('NO_URL', '');
  setSession(true); // a 401 on the way back clears it again
  location.assign(j.url);
}
/** Ends the session and starts over from the front page. If the server is unreachable the session is still open: say so, forget nothing. */
export async function signOut() {
  await flushLegacy();
  try {
    await call('/api/auth/sign-out', {});
  } catch (e) {
    // already signed out (401, 400) is fine; refused (403) or unreachable is not: the session would still be open
    if (!(e instanceof AuthError) || e.code === 'NETWORK' || e.status === 403 || e.status >= 500) return notify('Could not sign out. Check your connection and try again.');
  }
  forgetLegacy();
  setSession(false);
  location.assign('/');
}
/** Deletes the account for good. Null when done (the page then leaves), else what went wrong, to show. */
export async function deleteAccount(): Promise<string | null> {
  try {
    const res = await fetch('/api/me', { method: 'DELETE', headers: { 'content-type': 'application/json' }, body: '{}' });
    drop(res);
    if (res.status === 401) {
      out();
      return 'You were signed out. Sign in again to delete the account.';
    }
    if (res.status === 429) return 'Too many tries. Wait a minute and try again.';
    if (res.status === 403) return 'This request was refused. Reload the page and try again.';
    if (!res.ok) return 'Could not delete the account. Try again in a minute.';
  } catch {
    return 'Could not delete the account. Check your connection and try again.';
  }
  forgetLegacy();
  setSession(false);
  notifyNext('Your account and your saved builds were deleted.');
  location.assign('/');
  return null;
}
export async function downloadData() {
  try {
    const res = await fetch('/api/me/export', { cache: 'no-store' });
    if (!res.ok) drop(res);
    if (res.status === 401) {
      out();
      return notify('You were signed out. Sign in again to download your data.');
    }
    if (res.status === 429) return notify('That is a lot of downloads. Try again in an hour.');
    if (!res.ok) throw new Error(String(res.status));
    const url = URL.createObjectURL(await res.blob());
    const a = Object.assign(document.createElement('a'), { href: url, download: 'grimoire-my-data.json' });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  } catch {
    notify('Could not download your data. Try again.');
  }
}

/** Where "Sign in" goes from the current page: back here afterwards, planner state included. */
export function signInHref() {
  const here = location.pathname + location.search;
  if (location.pathname === '/signin') return here; // already there: keep where it was going
  return here === '/' ? '/signin' : `/signin?next=${encodeURIComponent(here)}`;
}
