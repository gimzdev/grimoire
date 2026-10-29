'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { WowIcon } from './icon';

export interface SearchHit {
  type: string;
  id: string;
  name: string;
  href: string;
  icon?: string;
  sub?: string;
  color?: string;
  tip?: string;
}
export interface SearchGroup {
  type: string;
  title: string;
  hits: SearchHit[];
}

/** Put the cursor in the header's search field, optionally with a query already typed. */
export function openSearch(query = '') {
  window.dispatchEvent(new CustomEvent('grimoire:search', { detail: query }));
}

const RECENT_KEY = 'grimoire.recent';
function readRecent(): SearchHit[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]').slice(0, 6);
  } catch {
    return [];
  }
}
function pushRecent(hit: SearchHit) {
  try {
    const list = [hit, ...readRecent().filter((h) => h.href !== hit.href)].slice(0, 6);
    localStorage.setItem(RECENT_KEY, JSON.stringify(list));
  } catch {
    /* storage unavailable: nothing to remember */
  }
}

function Magnifier({ className }: { className: string }) {
  return (
    <svg viewBox="0 0 20 20" className={className} aria-hidden>
      <circle cx="8.5" cy="8.5" r="5.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="m13 13 4.5 4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

interface Place {
  top: number;
  left: number;
  width: number;
  maxHeight: number;
}

/**
 * A search field that lists results right under itself as you type: no window over the page.
 * "bar" is the compact field in the header, "hero" the large one on the front page.
 */
export function InlineSearch({
  variant = 'bar',
  placeholder = 'Search',
  shortPlaceholder,
  className = '',
  hint,
  inputRef,
  initialQuery,
  autoFocus = false,
  onDone,
}: {
  variant?: 'bar' | 'hero';
  placeholder?: string;
  /** Used instead of the placeholder on phone-sized screens, where a long one gets cut off. */
  shortPlaceholder?: string;
  className?: string;
  /** A keyboard hint shown at the end of the field while it is empty. */
  hint?: string;
  inputRef?: RefObject<HTMLInputElement | null>;
  initialQuery?: string;
  autoFocus?: boolean;
  /** Called after a result is opened or the field is dismissed with Escape. */
  onDone?: () => void;
}) {
  const router = useRouter();
  const path = usePathname();
  const listId = useId();
  const [q, setQ] = useState(initialQuery ?? '');
  const [open, setOpen] = useState(false);
  const [groups, setGroups] = useState<SearchGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [cursor, setCursor] = useState(0);
  const [recent, setRecent] = useState<SearchHit[]>([]);
  const [place, setPlace] = useState<Place | null>(null);
  const [narrow, setNarrow] = useState(false);
  const wrap = useRef<HTMLLabelElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const ownInput = useRef<HTMLInputElement>(null);
  const input = inputRef ?? ownInput;

  useEffect(() => {
    if (initialQuery !== undefined) setQ(initialQuery);
  }, [initialQuery]);

  useEffect(() => {
    if (!shortPlaceholder) return;
    const mq = window.matchMedia('(max-width: 639px)');
    const on = () => setNarrow(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [shortPlaceholder]);

  // A new page closes the list.
  useEffect(() => {
    setOpen(false);
  }, [path]);

  // Where the list goes: under the field, inside the screen.
  const measure = useCallback(() => {
    const r = wrap.current?.getBoundingClientRect();
    if (!r) return;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const top = r.bottom + 10;
    if (variant === 'hero') {
      setPlace({ top, left: r.left, width: r.width, maxHeight: Math.max(220, Math.min(480, vh - top - 16)) });
    } else {
      const width = Math.min(440, vw - 24);
      const left = Math.min(Math.max(12, r.right - width), vw - width - 12);
      setPlace({ top, left, width, maxHeight: Math.max(220, Math.min(520, vh - top - 16)) });
    }
  }, [variant]);

  useEffect(() => {
    if (!open) return;
    measure();
    let frame = 0;
    const on = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    };
    window.addEventListener('scroll', on, { passive: true });
    window.addEventListener('resize', on);
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!wrap.current?.contains(t) && !panel.current?.contains(t)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', on);
      window.removeEventListener('resize', on);
      document.removeEventListener('mousedown', onDown);
    };
  }, [open, measure]);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setGroups([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const ctl = new AbortController();
    const t = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(term)}`, { signal: ctl.signal })
        .then((r) => r.json())
        .then((d: { groups: SearchGroup[] }) => {
          setGroups(d.groups);
          setCursor(0);
          setLoading(false);
        })
        .catch(() => {});
    }, 110);
    return () => {
      clearTimeout(t);
      ctl.abort();
    };
  }, [q]);

  const typed = q.trim().length >= 2;
  const flat = useMemo(() => (typed ? groups.flatMap((g) => g.hits) : recent), [groups, recent, typed]);

  const show = () => {
    setRecent(readRecent());
    setOpen(true);
  };

  const finish = () => {
    setOpen(false);
    setQ('');
    input.current?.blur();
    onDone?.();
  };

  const go = (hit: SearchHit | undefined) => {
    if (hit) {
      pushRecent(hit);
      router.push(hit.href);
      finish();
    } else if (q.trim()) {
      router.push(`/search?q=${encodeURIComponent(q.trim())}`);
      finish();
    }
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!open) show();
      setCursor((c) => Math.min(flat.length - 1, c + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setCursor((c) => Math.max(0, c - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      go(open ? flat[cursor] : undefined);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      if (open) setOpen(false);
      else {
        setQ('');
        input.current?.blur();
        onDone?.();
      }
    } else if (e.key === 'Tab') {
      setOpen(false);
    }
  };

  useEffect(() => {
    panel.current?.querySelector(`[data-i="${cursor}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [cursor]);

  const hero = variant === 'hero';
  let i = -1;
  const row = (h: SearchHit) => {
    i += 1;
    const idx = i;
    return (
      <button
        key={`${h.type}-${h.id}`}
        id={`${listId}-${idx}`}
        type="button"
        role="option"
        aria-selected={idx === cursor}
        data-i={idx}
        data-tip={h.tip}
        onMouseMove={() => setCursor(idx)}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => go(h)}
        className={`flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-colors ${idx === cursor ? 'bg-white/[0.07]' : ''}`}
      >
        <WowIcon icon={h.icon} size={28} name={h.name} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-medium" style={{ color: h.color ?? 'var(--color-vellum)' }}>
            {h.name}
          </span>
          {h.sub && <span className="block truncate text-[13px] text-mist">{h.sub}</span>}
        </span>
      </button>
    );
  };

  const list =
    open && place
      ? createPortal(
          <div
            ref={panel}
            className="animate-menu fixed z-[70] overflow-hidden rounded-[22px] border border-white/[0.08] bg-[#0e1014] shadow-[inset_0_1px_0_rgb(255_255_255/0.05),0_40px_80px_-30px_rgb(0_0_0/0.95)]"
            style={{ top: place.top, left: place.left, width: place.width }}
          >
            <div id={listId} role="listbox" aria-label="Search results" className="scroll-thin overflow-y-auto p-2" style={{ maxHeight: place.maxHeight - 48 }}>
              {!typed ? (
                recent.length ? (
                  <div>
                    <div className="px-2.5 pb-1 pt-1.5 text-[13px] text-fog">Recent</div>
                    {recent.map(row)}
                  </div>
                ) : (
                  <div className="px-2.5 py-3 text-[14.5px] text-mist">Type a name: an item, quest, talent, NPC, zone or guide.</div>
                )
              ) : groups.length === 0 ? (
                <div className="px-2.5 py-3 text-[14.5px] text-mist">{loading ? 'Searching…' : `Nothing matches “${q.trim()}”.`}</div>
              ) : (
                groups.map((g) => (
                  <div key={g.type} className="pb-1">
                    <div className="px-2.5 pb-1 pt-1.5 text-[13px] text-fog">{g.title}</div>
                    {g.hits.map(row)}
                  </div>
                ))
              )}
            </div>
            {typed && (
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => go(undefined)}
                className="flex h-12 w-full items-center justify-between border-t border-white/[0.06] px-4.5 text-left text-[14px] text-parch transition-colors hover:bg-white/[0.04] hover:text-vellum"
              >
                <span className="truncate">All results for “{q.trim()}”</span>
                <span className="shrink-0 text-fog">Enter</span>
              </button>
            )}
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <label
        ref={wrap}
        className={`flex cursor-text items-center ${
          hero
            ? 'glass h-[60px] gap-3.5 rounded-full pl-6 pr-4 transition-[background-color,border-color] duration-200 hover:border-white/25 focus-within:border-white/30 focus-within:bg-[rgb(13_14_18/0.7)]'
            : 'h-10 gap-2.5 rounded-full bg-white/[0.07] pl-4 pr-2.5 ring-1 ring-inset ring-white/[0.08] transition-colors hover:bg-white/[0.11] focus-within:bg-white/[0.1] focus-within:ring-white/20'
        } ${className}`}
      >
        <Magnifier className={hero ? 'size-5 shrink-0 text-gilt' : 'size-4 shrink-0 text-mist'} />
        <span className="sr-only">Search</span>
        <input
          ref={input}
          type="search"
          value={q}
          autoFocus={autoFocus}
          onChange={(e) => {
            setQ(e.target.value);
            if (!open) show();
          }}
          onFocus={show}
          onKeyDown={onKeyDown}
          placeholder={narrow && shortPlaceholder ? shortPlaceholder : placeholder}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && flat.length ? `${listId}-${cursor}` : undefined}
          autoComplete="off"
          spellCheck={false}
          className={`min-w-0 flex-1 bg-transparent outline-none [&::-webkit-search-cancel-button]:hidden ${
            hero ? 'text-[16.5px] text-vellum placeholder:text-mist' : 'text-[14px] text-vellum placeholder:text-mist'
          }`}
        />
        {loading && <span className="size-3.5 shrink-0 animate-spin rounded-full border-2 border-white/15 border-t-gilt" aria-hidden />}
        {hint && !q && !loading && <kbd className="shrink-0 rounded-full bg-white/[0.07] px-2 py-0.5 font-sans text-[11.5px] font-medium text-fog">{hint}</kbd>}
      </label>
      {list}
    </>
  );
}
