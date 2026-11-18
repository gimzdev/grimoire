'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

/**
 * The controls over a leveling route's page (/tools/leveling/<route>). The page itself is server-rendered and complete, and
 * every step has its box. This adds what needs the browser, without rendering anything that depends on it on the server
 * (so nothing can mismatch):
 *   - ticks (localStorage grimoire:route:<id>, the step numbers): one change listener on the page container, not one per row;
 *   - "Clear ticks": forgets them all;
 *   - "I'm level": scrolls to the first step of that level, or opens the page it is on.
 */

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string | null) {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    // Storage can be off (private windows, blocked cookies): the page still works, it just forgets.
  }
}

export function RouteTools({
  route,
  levels,
}: {
  route: string;
  /** The first step of each level: its number and the page it is on. */
  levels: { level: number; n: number; href: string }[];
}) {
  const router = useRouter();
  const box = useRef<HTMLDivElement>(null);
  const ticked = useRef(new Set<number>());
  const [hasTicks, setHasTicks] = useState(false);
  const key = `grimoire:route:${route}`;

  /** The page container (it holds every row). */
  const page = () => box.current?.closest<HTMLElement>('[data-route-page]') ?? null;

  const store = () => {
    write(key, ticked.current.size ? JSON.stringify([...ticked.current].sort((a, b) => a - b)) : null);
    setHasTicks(ticked.current.size > 0);
  };

  // After hydration: what this browser remembers, and the listener for the boxes.
  useEffect(() => {
    const root = page();
    if (!root) return;
    try {
      const saved: unknown = JSON.parse(read(key) ?? '[]');
      ticked.current = new Set(Array.isArray(saved) ? saved.filter((n): n is number => Number.isInteger(n) && n > 0) : []);
    } catch {
      ticked.current = new Set();
    }
    root.querySelectorAll<HTMLInputElement>('input.tk').forEach((el) => {
      el.checked = ticked.current.has(Number(el.dataset.n));
    });
    setHasTicks(ticked.current.size > 0);
    const onChange = (e: Event) => {
      const el = e.target;
      if (!(el instanceof HTMLInputElement) || !el.classList.contains('tk')) return;
      const n = Number(el.dataset.n);
      if (el.checked) ticked.current.add(n);
      else ticked.current.delete(n);
      store();
    };
    root.addEventListener('change', onChange);
    return () => root.removeEventListener('change', onChange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const clear = () => {
    if (!window.confirm('Clear every tick on this route?')) return;
    ticked.current = new Set();
    page()
      ?.querySelectorAll<HTMLInputElement>('input.tk')
      .forEach((el) => {
        el.checked = false;
      });
    store();
  };

  const jump = (value: string) => {
    const to = levels.find((l) => l.level === Number(value));
    if (!to) return;
    const id = `s${to.n}`;
    const row = document.getElementById(id);
    if (!row) router.push(`${to.href}#${id}`);
    else if (window.location.hash === `#${id}`) row.scrollIntoView({ block: 'start' });
    else window.location.hash = id;
  };

  return (
    <div ref={box} className="rt" role="group" aria-label="Route tools">
      <label className="rt-l">
        I’m level
        {/* Always "choose" again after a pick (a controlled value), so the same level can be picked twice. */}
        <select value="" onChange={(e) => jump(e.target.value)} className="field !h-9 !w-auto !text-[14px]">
          <option value="">choose</option>
          {levels.map((l) => (
            <option key={l.level} value={l.level}>
              {l.level}
            </option>
          ))}
        </select>
      </label>
      <button type="button" onClick={clear} disabled={!hasTicks} className="rt-b">
        Clear ticks
      </button>
    </div>
  );
}
