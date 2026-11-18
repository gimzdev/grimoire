'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { MapZone } from '@/lib/zone-map';

/** The map's own units (scripts/data/zone-maps.mjs): 1500 by 1000, the game's 3:2. Points come in tenths of a percent. */
const W = 1500;
const H = 1000;

type Pin = { x: number; y: number; g: number; i: number };
/** The part of the map on screen, in tenths of a percent: all of it, or the part around the points. */
type View = { x0: number; y0: number; size: number };
const WHOLE: View = { x0: 0, y0: 0, size: 1000 };

const coords = (p: { x: number; y: number }) => `${(p.x / 10).toFixed(1)}, ${(p.y / 10).toFixed(1)}`;

function Pills({ items, value, onChange, label }: { items: { key: number; name: string; count: number }[]; value: number; onChange: (i: number) => void; label: string }) {
  return (
    <div role="tablist" aria-label={label} className="flex flex-wrap gap-1.5">
      {items.map((t, i) => (
        <button
          key={t.key}
          type="button"
          role="tab"
          aria-selected={i === value}
          onClick={() => onChange(i)}
          className={`h-9 rounded-full px-4 text-[14px] font-[560] ring-1 ring-inset transition-colors ${i === value ? 'bg-gilt/[0.14] text-gilt-bright ring-gilt/35' : 'bg-white/[0.04] text-mist ring-white/[0.08] hover:bg-white/[0.07] hover:text-parch'}`}
        >
          {t.name}
          <span className={`ml-2 tabular-nums ${i === value ? 'text-gilt/80' : 'text-fog'}`}>{t.count}</span>
        </button>
      ))}
    </div>
  );
}

/**
 * A zone's map with points on it: where a creature stands, where a quest sends you, or who serves players in the zone.
 * The nearest point to the pointer tells its coordinates (and whose it is); a click keeps it, to copy. Several zones get
 * pills above the map; `layers` turns the groups into switches; `go` adds the line that sends the add-on's arrow there.
 */
export function ZoneMap({ zones, layers = false, go = false, what }: { zones: MapZone[]; layers?: boolean; go?: boolean; what?: string }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const [zi, setZi] = useState(0);
  const zone = zones[zi] ?? zones[0];
  const [switched, setSwitched] = useState<Record<string, boolean>>({});
  const [hover, setHover] = useState<Pin | null>(null);
  const [kept, setKept] = useState<Pin | null>(null);
  const [copied, setCopied] = useState('');
  const [close, setClose] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const touch = useRef(false);
  const [w, setW] = useState(880);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const measure = () => setW(el.clientWidth || 880);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  useEffect(() => {
    setHover(null);
    setKept(null);
    setClose(false);
  }, [zi]);

  const isOn = (key: string, byDefault: boolean) => !layers || (switched[key] ?? byDefault);
  const pins = useMemo(() => {
    const out: Pin[] = [];
    zone.groups.forEach((g, gi) => {
      if (layers && !(switched[g.key] ?? g.on)) return;
      g.items.forEach((it, ii) => {
        for (let k = 0; k + 1 < it.pts.length; k += 2) out.push({ x: it.pts[k], y: it.pts[k + 1], g: gi, i: ii });
      });
    });
    return out;
  }, [zone, layers, switched]);

  /* Points that crowd a corner of the zone can be looked at closely: the square around them, never less than a quarter
     of the zone across. Nothing to gain when they are spread over more than two thirds of it. */
  const tight = useMemo<View | null>(() => {
    if (!pins.length) return null;
    let x0 = 1000, y0 = 1000, x1 = 0, y1 = 0;
    for (const p of pins) {
      x0 = Math.min(x0, p.x);
      x1 = Math.max(x1, p.x);
      y0 = Math.min(y0, p.y);
      y1 = Math.max(y1, p.y);
    }
    const size = Math.max(x1 - x0 + 90, y1 - y0 + 90, 250);
    if (size > 660) return null;
    const clamp = (v: number) => Math.min(1000 - size, Math.max(0, v));
    return { x0: clamp((x0 + x1) / 2 - size / 2), y0: clamp((y0 + y1) / 2 - size / 2), size };
  }, [pins]);
  const view = close && tight ? tight : WHOLE;
  const sx = (x: number) => ((x - view.x0) / view.size) * 100;
  const sy = (y: number) => ((y - view.y0) / view.size) * 100;
  const seen = (x: number, y: number) => x >= view.x0 && x <= view.x0 + view.size && y >= view.y0 && y <= view.y0 + view.size;
  /* The grid: a line every 10 of the game's coordinates, every 5 or 2 when close. */
  const step = view.size > 600 ? 100 : view.size > 330 ? 50 : 20;
  const ticksX: number[] = [];
  const ticksY: number[] = [];
  for (let t = Math.ceil((view.x0 + 1) / step) * step; t < view.x0 + view.size; t += step) ticksX.push(t);
  for (let t = Math.ceil((view.y0 + 1) / step) * step; t < view.y0 + view.size; t += step) ticksY.push(t);

  /* Place names that fit: the map's own order is the busiest first, and a narrow screen shows fewer. */
  const labels = useMemo(() => {
    const h = (w * H) / W;
    const size = w < 520 ? 10.5 : 11.5;
    const most = w < 420 ? 7 : w < 620 ? 12 : w < 800 ? 18 : 26;
    const boxes: number[][] = [];
    const out: { p: MapZone['places'][number]; flip: boolean }[] = [];
    for (const p of zone.places) {
      if (out.length >= most) break;
      if (p[0] < view.x0 || p[0] > view.x0 + view.size || p[1] < view.y0 || p[1] > view.y0 + view.size) continue;
      const px = ((p[0] - view.x0) / view.size) * w;
      const py = ((p[1] - view.y0) / view.size) * h;
      const tw = p[2].length * size * 0.56 + (p[3] === 'd' ? 20 : 8);
      let left = px + 7;
      let flip = false;
      if (left + tw > w - 6) {
        left = px - 7 - tw;
        flip = true;
      }
      if (left < 18 || py < 16 || py > h - 10) continue;
      const b = [left - 10, py - size * 0.5 - 4, left + tw + 4, py + size * 0.5 + 4];
      if (boxes.some((o) => !(b[2] < o[0] || b[0] > o[2] || b[3] < o[1] || b[1] > o[3]))) continue;
      boxes.push(b);
      out.push({ p, flip });
    }
    return out;
  }, [zone, w, view]);

  const u = (view.size * 1.5) / w; // map units to one screen pixel
  // a quest handed in where it was taken: its two marks stand side by side
  const both = useMemo(() => {
    const at = (mark: string) => new Set(pins.filter((p) => zone.groups[p.g].mark === mark).map((p) => `${p.x},${p.y}`));
    const ends = at('end');
    return new Set([...at('start')].filter((k) => ends.has(k)));
  }, [pins, zone]);
  const dot = pins.length > 320 ? 3 : pins.length > 120 ? 3.6 : 4.4;
  const shown = hover ?? kept;
  const item = shown ? zone.groups[shown.g]?.items[shown.i] : undefined;
  const group = shown ? zone.groups[shown.g] : undefined;
  const many = zone.groups.reduce((n, g) => n + g.items.length, 0) > 1;

  const nearest = (clientX: number, clientY: number, reach: number): Pin | null => {
    const el = box.current;
    if (!el) return null;
    const r = el.getBoundingClientRect();
    let best: Pin | null = null;
    let bestD = reach;
    for (const p of pins) {
      if (!seen(p.x, p.y)) continue;
      const d = Math.hypot((sx(p.x) / 100) * r.width - (clientX - r.left), (sy(p.y) / 100) * r.height - (clientY - r.top));
      if (d < bestD) {
        best = p;
        bestD = d;
      }
    }
    return best;
  };
  const same = (a: Pin | null, b: Pin | null) => a === b || (a !== null && b !== null && a.x === b.x && a.y === b.y && a.g === b.g && a.i === b.i);
  const copy = (key: string, text: string) => {
    void navigator.clipboard?.writeText(text).then(() => {
      setCopied(key);
      setTimeout(() => setCopied(''), 1800);
    });
  };
  const tabs = zones.map((z) => ({ key: z.id, name: z.name, count: z.count }));
  const legend = !layers && zone.groups.length > 1;
  const right = shown ? sx(shown.x) < 60 : true;
  const box3 = `${view.x0 * 1.5} ${view.y0} ${view.size * 1.5} ${view.size}`;
  const BUTTON = 'h-8 shrink-0 rounded-full bg-white/[0.07] px-3.5 text-[13.5px] font-semibold text-vellum ring-1 ring-inset ring-white/[0.12] hover:bg-white/[0.12]';

  return (
    <div className="frame p-3 sm:p-5">
      {(zones.length > 1 || layers) && (
        <div className="mb-4 flex flex-wrap items-center gap-x-6 gap-y-3">
          {zones.length > 1 && <Pills label="Zone" items={tabs} value={zi} onChange={setZi} />}
          {layers && (
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="What the map shows">
              {zone.groups.map((g) => {
                const active = isOn(g.key, g.on);
                return (
                  <button
                    key={g.key}
                    type="button"
                    aria-pressed={active}
                    onClick={() => {
                      setSwitched((s) => ({ ...s, [g.key]: !active }));
                      setHover(null);
                      setKept(null);
                    }}
                    className={`inline-flex h-9 items-center gap-2 rounded-full pl-3 pr-3.5 text-[14px] font-[560] ring-1 ring-inset transition-colors ${active ? 'bg-white/[0.09] text-vellum ring-white/[0.2]' : 'bg-white/[0.03] text-fog ring-white/[0.07] hover:bg-white/[0.06] hover:text-parch'}`}
                  >
                    <span aria-hidden className="size-2.5 rounded-full" style={{ background: g.color, opacity: active ? 1 : 0.35 }} />
                    {g.label}
                    <span className="tabular-nums text-fog">{g.items.length}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
      <div
        ref={box}
        role="img"
        aria-label={`Map of ${zone.name}${what ? `: ${what}` : ''}, ${pins.length} ${pins.length === 1 ? 'point' : 'points'}`}
        className="relative mx-auto w-full max-w-[960px] cursor-crosshair touch-manipulation select-none overflow-hidden rounded-[14px] bg-[#0b0d11] ring-1 ring-inset ring-white/[0.08]"
        style={{ aspectRatio: `${W} / ${H}` }}
        onPointerDown={(e) => {
          touch.current = e.pointerType === 'touch';
        }}
        onPointerMove={(e) => {
          if (e.pointerType === 'touch') return;
          const p = nearest(e.clientX, e.clientY, 22);
          if (!same(p, hover)) setHover(p);
        }}
        onPointerLeave={() => setHover(null)}
        onClick={(e) => {
          if ((e.target as HTMLElement).closest('a, button')) return;
          const p = nearest(e.clientX, e.clientY, touch.current ? 30 : 22);
          const href = p ? zone.groups[p.g]?.items[p.i]?.href : undefined;
          // a point that leads somewhere: a mouse click opens it, a finger shows it first and opens it the second time
          if (p && href && layers && (!touch.current || same(p, kept))) {
            window.location.assign(href);
            return;
          }
          setKept(same(p, kept) ? null : p);
        }}
      >
        <svg viewBox={box3} className="absolute inset-0 size-full" aria-hidden>
          <defs>
            <linearGradient id={`land-${uid}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#f4f1ea" stopOpacity="0.1" />
              <stop offset="1" stopColor="#f4f1ea" stopOpacity="0.045" />
            </linearGradient>
            <filter id={`halo-${uid}`} x="-10%" y="-10%" width="120%" height="120%">
              <feGaussianBlur stdDeviation="14" />
            </filter>
          </defs>
          <path d={ticksX.map((t) => `M${t * 1.5} 0V${H}`).join('') + ticksY.map((t) => `M0 ${t}H${W}`).join('')} stroke="#f4f1ea" strokeOpacity="0.045" strokeWidth={u} fill="none" />
          {zone.out && <path d={zone.out} fillRule="evenodd" fill="#f4f1ea" fillOpacity="0.028" stroke="#f4f1ea" strokeOpacity="0.09" strokeWidth={u} strokeDasharray={`${3 * u} ${5 * u}`} />}
          {zone.land && (
            <>
              <path d={zone.land} fillRule="evenodd" fill="#f2b640" fillOpacity="0.05" filter={`url(#halo-${uid})`} />
              <path d={zone.land} fillRule="evenodd" fill={`url(#land-${uid})`} stroke="#f2b640" strokeOpacity="0.42" strokeWidth={1.4 * u} strokeLinejoin="round" />
            </>
          )}
        </svg>
        {ticksX.map((t, n) => (
          <span key={`x${t}`} aria-hidden className={`pointer-events-none absolute top-[3px] -translate-x-1/2 text-[10px] tabular-nums text-fog/70 ${n % 2 ? '' : 'hidden sm:block'}`} style={{ left: `${sx(t)}%` }}>
            {t / 10}
          </span>
        ))}
        {ticksY.map((t, n) => (
          <span key={`y${t}`} aria-hidden className={`pointer-events-none absolute left-[5px] -translate-y-1/2 text-[10px] tabular-nums text-fog/70 ${n % 2 ? '' : 'hidden sm:block'}`} style={{ top: `${sy(t)}%` }}>
            {t / 10}
          </span>
        ))}
        {labels.map(({ p, flip }) => {
          const [x, y, name, kind, href] = p;
          const text = (
            <span className={`absolute top-1/2 -translate-y-1/2 whitespace-nowrap leading-none ${flip ? 'right-[7px]' : 'left-[7px]'} ${w < 520 ? 'text-[10.5px]' : 'text-[11.5px]'} ${kind === 'd' ? 'font-[560] text-leaf-bright' : 'text-mist'}`}>
              {name}
            </span>
          );
          return (
            <span key={`${name}-${x}-${y}`} className="absolute" style={{ left: `${sx(x)}%`, top: `${sy(y)}%` }}>
              <span aria-hidden className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full ${kind === 'd' ? 'size-[7px] bg-leaf ring-2 ring-[#0b0d11]' : 'size-[3px] bg-mist/70'}`} />
              {kind === 'd' && href ? (
                <a href={href} className="hover:[&>span]:text-vellum hover:[&>span]:underline" title={`${name}: the way in`}>
                  {text}
                </a>
              ) : (
                text
              )}
            </span>
          );
        })}
        <svg viewBox={box3} className="pointer-events-none absolute inset-0 size-full" aria-hidden>
          {pins.map((p, n) => {
            const g = zone.groups[p.g];
            const cx = p.x * 1.5 + (g.mark !== 'dot' && both.has(`${p.x},${p.y}`) ? (g.mark === 'start' ? -9.5 : 9.5) * u : 0);
            const cy = p.y;
            if (g.mark === 'dot') return <circle key={n} cx={cx} cy={cy} r={dot * u} fill={g.color} fillOpacity="0.92" stroke="#0b0d11" strokeOpacity="0.85" strokeWidth={1.1 * u} />;
            return (
              <g key={n}>
                <circle cx={cx} cy={cy} r={8.5 * u} fill="#14110a" stroke={g.color} strokeWidth={1.6 * u} />
                <text x={cx} y={cy + 4.6 * u} textAnchor="middle" fontSize={13 * u} fontWeight="800" fill={g.color} fontFamily="Georgia, serif">
                  {g.mark === 'start' ? '!' : '?'}
                </text>
              </g>
            );
          })}
          {kept && !same(kept, hover) && <circle cx={kept.x * 1.5} cy={kept.y} r={(dot + 4.5) * u} fill="none" stroke="#f4f1ea" strokeOpacity="0.7" strokeWidth={1.4 * u} />}
          {hover && <circle cx={hover.x * 1.5} cy={hover.y} r={(dot + 4.5) * u} fill="none" stroke="#f4f1ea" strokeWidth={1.6 * u} />}
        </svg>
        {tight && (
          <button
            type="button"
            aria-pressed={close}
            onClick={(e) => {
              e.stopPropagation();
              setClose(!close);
              setHover(null);
            }}
            className="absolute bottom-2.5 right-2.5 z-10 inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full bg-[#0f1115]/90 pl-2.5 pr-3.5 text-[13px] font-semibold text-vellum ring-1 ring-inset ring-white/[0.14] backdrop-blur hover:bg-[#1a1d24]"
          >
            <svg viewBox="0 0 16 16" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
              <circle cx="7" cy="7" r="4.6" />
              <path d={close ? 'M11 11l3.2 3.2M5 7h4' : 'M11 11l3.2 3.2M5 7h4M7 5v4'} />
            </svg>
            {close ? 'Whole zone' : 'Look closer'}
          </button>
        )}
        {hover && item && group && (
          <div
            role="tooltip"
            className={`pointer-events-none absolute z-20 hidden -translate-y-1/2 whitespace-nowrap rounded-[10px] bg-[#0f1115]/95 px-3 py-2 text-[13px] ring-1 ring-inset ring-white/[0.1] shadow-[0_18px_36px_-16px_rgba(0,0,0,0.95)] sm:block ${right ? 'translate-x-[16px]' : '-translate-x-[calc(100%+16px)]'}`}
            style={{ left: `${sx(hover.x)}%`, top: `clamp(26px, ${sy(hover.y)}%, calc(100% - 26px))` }}
          >
            {many && <div className="font-semibold text-vellum">{item.n}</div>}
            {many && (item.sub || legend) && <div className="text-[12px] text-mist">{item.sub ?? group.label}</div>}
            <div className="tabular-nums text-gilt-bright">{coords(hover)}</div>
          </div>
        )}
      </div>
      {legend && (
        <ul className="mx-auto mt-3 flex max-w-[960px] flex-wrap gap-x-5 gap-y-1.5 text-[13.5px] text-parch">
          {zone.groups.map((g) => (
            <li key={g.key} className="inline-flex items-center gap-2">
              {g.mark === 'dot' ? (
                <span aria-hidden className="size-2.5 rounded-full" style={{ background: g.color }} />
              ) : (
                <span aria-hidden className="grid size-[18px] place-items-center rounded-full bg-[#14110a] font-serif text-[12px] font-extrabold ring-1" style={{ color: g.color, ['--tw-ring-color' as string]: g.color }}>
                  {g.mark === 'start' ? '!' : '?'}
                </span>
              )}
              {g.label}
              {g.items.length === 1 && g.items[0].n !== g.label ? <span className="text-fog">{g.items[0].n}</span> : null}
            </li>
          ))}
        </ul>
      )}
      <div className="mx-auto mt-3 flex min-h-8 max-w-[960px] flex-wrap items-center justify-between gap-x-4 gap-y-2 text-[14px]" aria-live="polite">
        {shown && item ? (
          <>
            <span className="min-w-0 text-parch">
              {many && <span className="font-semibold text-vellum">{item.n}: </span>}
              {zone.name} <span className="tabular-nums font-semibold text-gilt-bright">{coords(shown)}</span>
            </span>
            {kept && (
              <span className="flex flex-wrap items-center gap-2">
                {layers && item.href && (
                  <a href={item.href} className={`${BUTTON} inline-flex items-center`}>
                    Open its page
                  </a>
                )}
                <button type="button" className={BUTTON} onClick={() => copy('xy', coords(kept))}>
                  {copied === 'xy' ? 'Copied' : 'Copy coordinates'}
                </button>
                {go && zone.go && (
                  <button type="button" className={BUTTON} title="Paste it in the game's chat with the Grimoire add-on: its arrow leads you there" onClick={() => copy('go', `/grim go ${zone.id} ${(kept.x / 10).toFixed(1)} ${(kept.y / 10).toFixed(1)} ${item.n}`)}>
                    {copied === 'go' ? 'Copied' : 'Copy for the add-on'}
                  </button>
                )}
              </span>
            )}
          </>
        ) : (
          <span className="text-fog">{pins.length ? `${layers ? 'Point at a mark to see who stands there' : 'Point at a mark for its coordinates'}; click one to keep it.` : 'Turn a layer on to see it on the map.'}</span>
        )}
      </div>
    </div>
  );
}
