import { track } from '@vercel/analytics';

type Va = (...params: unknown[]) => void;

/**
 * One anonymous Vercel Analytics event (addon_click, signin_done). The analytics script loads only once a person moves,
 * taps or types (components/analytics.tsx), so an event from the very first click waits in the script's queue instead of
 * being dropped.
 */
export function trackEvent(name: 'addon_click' | 'signin_done', data?: Record<string, string>) {
  if (typeof window === 'undefined') return;
  const w = window as unknown as { va?: Va; vaq?: unknown[][] };
  if (!w.va)
    w.va = (...params: unknown[]) => {
      (w.vaq ??= []).push(params);
    };
  track(name, data);
}
