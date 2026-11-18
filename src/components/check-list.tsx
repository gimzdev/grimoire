'use client';

import { useEffect, useState, type ReactNode } from 'react';

/** This browser's ticks for one list ("dungeon:the-deadmines"), kept on the device only. */
const KEY = (list: string) => `grimoire:check:${list}`;
function read(list: string): number[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY(list)) ?? '[]');
    return Array.isArray(v) ? v.filter((x) => typeof x === 'number') : [];
  } catch {
    return [];
  }
}
function write(list: string, ids: number[]) {
  try {
    if (ids.length) localStorage.setItem(KEY(list), JSON.stringify(ids));
    else localStorage.removeItem(KEY(list));
  } catch {
    /* private mode: ticks last as long as the page */
  }
}

/** A row with a tick box in front: ticked rows dim, and the ticks stay on this device. */
export function CheckRow({ list, id, children }: { list: string; id: number; children: ReactNode }) {
  const [on, setOn] = useState(false);
  useEffect(() => {
    setOn(read(list).includes(id));
    const sync = () => setOn(read(list).includes(id));
    window.addEventListener('grimoire-check', sync);
    return () => window.removeEventListener('grimoire-check', sync);
  }, [list, id]);
  const toggle = () => {
    const ids = new Set(read(list));
    if (ids.has(id)) ids.delete(id);
    else ids.add(id);
    write(list, [...ids]);
    setOn(ids.has(id));
    window.dispatchEvent(new Event('grimoire-check'));
  };
  return (
    <li className={`flex items-start gap-3 py-2.5 transition-opacity ${on ? 'opacity-55' : ''}`}>
      <button
        type="button"
        role="checkbox"
        aria-checked={on}
        aria-label={on ? 'Picked up' : 'Not picked up yet'}
        onClick={toggle}
        className={`mt-[3px] grid size-[18px] shrink-0 place-items-center rounded-[6px] ring-1 ring-inset transition-colors ${on ? 'bg-gilt ring-gilt' : 'bg-abyss ring-ash hover:ring-gilt/60'}`}
      >
        {on && <span aria-hidden className="mb-[2px] h-[5px] w-[9px] -rotate-45 border-b-2 border-l-2 border-[#1a1204]" />}
      </button>
      <div className="min-w-0 flex-1">{children}</div>
    </li>
  );
}

/** "3 of 7 picked up", live as rows are ticked, with a way to clear them. */
export function CheckCount({ list, ids }: { list: string; ids: number[] }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    const sync = () => setN(read(list).filter((x) => ids.includes(x)).length);
    sync();
    window.addEventListener('grimoire-check', sync);
    return () => window.removeEventListener('grimoire-check', sync);
  }, [list, ids]);
  if (!n) return null;
  return (
    <span className="inline-flex items-center gap-2 text-[14px] text-mist">
      <span className="num text-gilt-bright">
        {n} of {ids.length}
      </span>{' '}
      picked up
      <button
        type="button"
        onClick={() => {
          write(list, read(list).filter((x) => !ids.includes(x)));
          window.dispatchEvent(new Event('grimoire-check'));
        }}
        className="text-fog underline decoration-white/20 underline-offset-2 hover:text-parch"
      >
        Clear
      </button>
    </span>
  );
}
