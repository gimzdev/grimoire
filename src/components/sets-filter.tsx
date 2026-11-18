'use client';

import { useEffect, useState, type CSSProperties, type MouseEvent, type ReactNode } from 'react';

type Band = '' | '60' | '50' | 'low';

const PILL = 'inline-flex h-9 items-center rounded-full px-3.5 text-[14px] font-[560] ring-1 ring-inset transition-colors';
const ON = 'bg-gilt/[0.14] text-gilt-bright ring-gilt/35';
const OFF = 'bg-white/[0.04] text-mist ring-white/[0.08] hover:bg-white/[0.07] hover:text-parch';

const href = (cls: string, band: string) => {
  const q = new URLSearchParams();
  if (cls) q.set('class', cls);
  if (band) q.set('level', band);
  const s = q.toString();
  return s ? `/sets?${s}` : '/sets';
};

/**
 * The class and level filters of the item sets page. The page itself is built once with every set on it, so it comes
 * from the cache at once; the filters then hide the cards that do not fit, here in the browser. The address still says
 * what shows (/sets?class=rogue&level=60), so a link to a filtered list opens filtered, and a link to one set
 * (/sets?set=528#set-528) always shows that set.
 */
export function SetsFilter({ classes, bands }: { classes: { slug: string; name: string; color: string }[]; bands: readonly (readonly [string, string])[] }) {
  const [cls, setCls] = useState('');
  const [band, setBand] = useState<Band | string>('');

  useEffect(() => {
    const read = () => {
      const q = new URLSearchParams(window.location.search);
      setCls(q.get('class') ?? '');
      setBand(q.get('level') ?? '');
    };
    read();
    window.addEventListener('popstate', read);
    return () => window.removeEventListener('popstate', read);
  }, []);

  useEffect(() => {
    const focus = new URLSearchParams(window.location.search).get('set');
    let shown = 0;
    for (const li of document.querySelectorAll<HTMLElement>('#sets > li')) {
      const hi = Number(li.dataset.hi) || 0;
      const inBand = !band || (band === '60' ? hi >= 60 : band === '50' ? hi >= 50 && hi < 60 : hi > 0 && hi < 50);
      const inClass = !cls || !li.dataset.cls || li.dataset.cls.split(' ').includes(cls);
      const on = (inBand && inClass) || (focus !== null && li.id === `set-${focus}`);
      li.hidden = !on;
      if (on) shown++;
    }
    const none = document.getElementById('sets-none');
    if (none) none.hidden = shown > 0;
  }, [cls, band]);

  const pill = (to: { cls: string; band: string }, on: boolean, label: ReactNode, color?: string) => {
    const style: CSSProperties | undefined = on && color ? { color, boxShadow: `inset 0 0 0 1px ${color}55`, background: `${color}14` } : undefined;
    return (
      <a
        key={`${to.cls}/${to.band}`}
        href={href(to.cls, to.band)}
        aria-current={on ? 'true' : undefined}
        className={`${PILL} ${on ? ON : OFF}`}
        style={style}
        onClick={(e: MouseEvent) => {
          if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
          e.preventDefault();
          setCls(to.cls);
          setBand(to.band);
          window.history.replaceState(null, '', href(to.cls, to.band));
        }}
      >
        {label}
      </a>
    );
  };

  return (
    <div className="mt-7 flex flex-col gap-3">
      <div className="flex flex-wrap gap-1.5">
        {pill({ cls: '', band }, !cls, 'Every class')}
        {classes.map((c) => pill({ cls: c.slug, band }, cls === c.slug, c.name, c.color))}
      </div>
      <div className="flex flex-wrap gap-1.5">{bands.map(([v, label]) => pill({ cls, band: v }, band === v, label))}</div>
    </div>
  );
}
