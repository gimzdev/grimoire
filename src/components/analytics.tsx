'use client';
import { useEffect, useState } from 'react';
import { Analytics } from '@vercel/analytics/next';

// Page views from automated browsers stay out of the numbers. Headless Chrome driven by Puppeteer, Playwright or Selenium
// sets navigator.webdriver (or names itself in its user agent), which no person's browser does; and scrapers that hide
// that, opening one page from a fresh address and leaving, never move a mouse, touch the screen or press a key. So a
// visit counts from the first such move: the page it happened on, then every page after it. Most bots meet the
// firewall first.
const NAMED = /HeadlessChrome|PhantomJS|Lightpanda/i;
const automated = () => typeof navigator !== 'undefined' && (navigator.webdriver === true || NAMED.test(navigator.userAgent));
const HUMAN = ['pointermove', 'pointerdown', 'touchstart', 'keydown', 'wheel'] as const;

export function SiteAnalytics() {
  const [human, setHuman] = useState(false);
  useEffect(() => {
    if (human || automated()) return;
    const seen = (event: Event) => {
      if (event.isTrusted) setHuman(true);
    };
    for (const type of HUMAN) window.addEventListener(type, seen, { passive: true });
    return () => {
      for (const type of HUMAN) window.removeEventListener(type, seen);
    };
  }, [human]);
  return human ? <Analytics beforeSend={(event) => (automated() ? null : event)} /> : null;
}
