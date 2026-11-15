'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { MapView } from '@/lib/types';
import { iconUrl } from '@/lib/wow';

export type { MapView };

/** What the hover card says about a boss: prepared on the server from the encounter data. */
export type MapBoss = {
  n: string;
  sub: string;
  abilities: { n: string; c: string }[];
  loot: { id: number; n: string; c: string; ic?: string }[];
  more: number;
};

const PAD = 34;
const PORTRAIT = 'https://render.worldofwarcraft.com/us/npcs/zoom/creature-display-';

type Pin = {
  key: string;
  x: number;
  y: number;
  ox: number;
  oy: number;
  f: number;
  pd?: number;
  alt: boolean;
};

/** Spreads portraits that would sit on one another (view units), keeping each near its true place. */
function spread(view: MapView, min: number): Pin[] {
  const pins: Pin[] = view.bosses.flatMap((b) =>
    b.at.map(([x, y], i) => ({
      key: b.key,
      x,
      y,
      ox: x,
      oy: y,
      f: b.f,
      pd: b.pd,
      alt: b.at.length > 1 && i > 0,
    })),
  );
  for (let round = 0; round < 60; round++) {
    let moved = false;
    for (let i = 0; i < pins.length; i++) {
      for (let j = i + 1; j < pins.length; j++) {
        const a = pins[i],
          b = pins[j];
        if (a.f !== b.f) continue;
        let dx = b.x - a.x,
          dy = b.y - a.y;
        let d = Math.hypot(dx, dy);
        if (d >= min) continue;
        if (d < 0.01) [dx, dy, d] = [1, 0.3, 1.04];
        const push = (min - d) / 2;
        a.x -= (dx / d) * push;
        a.y -= (dy / d) * push;
        b.x += (dx / d) * push;
        b.y += (dy / d) * push;
        moved = true;
      }
    }
    if (!moved) break;
  }
  for (const p of pins) {
    p.x = Math.min(view.w + PAD * 0.5, Math.max(-PAD * 0.5, p.x));
    p.y = Math.min(view.h + PAD * 0.5, Math.max(-PAD * 0.5, p.y));
  }
  return pins;
}

function Pills({ items, value, onChange, label }: { items: string[]; value: number; onChange: (i: number) => void; label: string }) {
  return (
    <div role="tablist" aria-label={label} className="flex flex-wrap gap-1.5">
      {items.map((t, i) => (
        <button
          key={t}
          type="button"
          role="tab"
          aria-selected={i === value}
          onClick={() => onChange(i)}
          className={`h-9 rounded-full px-4 text-[14px] font-[560] ring-1 ring-inset transition-colors ${i === value ? 'bg-gilt/[0.14] text-gilt-bright ring-gilt/35' : 'bg-white/[0.04] text-mist ring-white/[0.08] hover:bg-white/[0.07] hover:text-parch'}`}
        >
          {t}
        </button>
      ))}
    </div>
  );
}

/** A boss's face as the game draws it (Blizzard's render server), or its initial when there is none. */
function Face({ pd, name, className = '' }: { pd?: number; name: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  const img = useRef<HTMLImageElement>(null);
  // a picture that failed before the page woke up never fires onError: look once it has
  useEffect(() => {
    const el = img.current;
    if (el && el.complete && el.naturalWidth === 0) setFailed(true);
  }, [pd]);
  return (
    <span className={`block overflow-hidden rounded-full bg-[radial-gradient(circle_at_50%_35%,#2a2f38,#121418)] ${className}`}>
      {pd && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img ref={img} src={`${PORTRAIT}${pd}.jpg`} alt="" loading="lazy" decoding="async" onError={() => setFailed(true)} className="size-full scale-[1.7] object-cover object-[50%_24%]" />
      ) : (
        <span className="grid size-full place-items-center font-display text-[1.05em] text-gilt-bright">{name.replace(/^The /, '').charAt(0)}</span>
      )}
    </span>
  );
}

/**
 * A dungeon's floor plan with its bosses where they stand: each a portrait that tells its abilities and loot on hover
 * and opens its section on the page on click. Several wings or floors get pills above the map.
 */
export function DungeonMap({ views, bosses }: { views: MapView[]; bosses: Record<string, MapBoss> }) {
  const [vi, setVi] = useState(0);
  const [fi, setFi] = useState(0);
  const [hover, setHover] = useState<Pin | null>(null);
  const box = useRef<HTMLDivElement>(null);
  // on a touch screen the first tap on a boss shows its card, the second opens it
  const touch = useRef(false);
  const view = views[vi];
  // portraits keep apart on screen: the spacing in the map's units follows the map's drawn width and the portrait size
  const [px, setPx] = useState({ w: 900, pin: 44 });
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const measure = () => setPx({ w: el.clientWidth || 900, pin: window.innerWidth < 640 ? 32 : window.innerWidth < 1024 ? 40 : 44 });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const pins = useMemo(() => spread(view, ((px.pin + 6) * (view.w + PAD * 2)) / px.w), [view, px]);
  useEffect(() => {
    setFi(0);
    setHover(null);
  }, [vi]);
  const W = view.w + PAD * 2;
  const H = view.h + PAD * 2;
  const pos = (x: number, y: number) => ({
    left: `${((x + PAD) / W) * 100}%`,
    top: `${((y + PAD) / H) * 100}%`,
  });
  const floor = view.floors[fi] ?? view.floors[0];
  const multi = view.floors.length > 1;
  const card = hover ? bosses[hover.key] : undefined;
  const right = hover ? hover.x + PAD < W * 0.56 : true;
  const go = (key: string) => {
    const el = document.getElementById(key);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    history.replaceState(null, '', `#${key}`);
  };

  return (
    <div className="frame p-3 sm:p-5">
      {(views.length > 1 || multi) && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          {views.length > 1 ? <Pills label="Wing" items={views.map((v, i) => v.name ?? `Part ${i + 1}`)} value={vi} onChange={setVi} /> : <span />}
          {multi && <Pills label="Floor" items={view.floors.map((f, i) => f.name ?? `Level ${i + 1}`)} value={fi} onChange={setFi} />}
        </div>
      )}
      <div
        ref={box}
        className="relative mx-auto"
        style={{
          aspectRatio: `${W} / ${H}`,
          width: `min(100%, ${Math.round((660 * W) / H)}px)`,
        }}
        onMouseLeave={() => setHover(null)}
      >
        <svg viewBox={`${-PAD} ${-PAD} ${W} ${H}`} className="absolute inset-0 size-full" aria-hidden>
          <defs>
            <linearGradient id={`floor-${vi}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#f4f1ea" stopOpacity="0.085" />
              <stop offset="1" stopColor="#f4f1ea" stopOpacity="0.035" />
            </linearGradient>
            <filter id={`halo-${vi}`} x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="9" />
            </filter>
          </defs>
          {view.floors.map((f, i) =>
            i === fi ? null : <path key={i} d={f.d} fillRule="evenodd" fill="#f4f1ea" fillOpacity="0.02" stroke="#f4f1ea" strokeOpacity="0.1" strokeWidth="1.2" strokeDasharray="3 5" />,
          )}
          <path d={floor.d} fillRule="evenodd" fill="#f2b640" fillOpacity="0.06" filter={`url(#halo-${vi})`} />
          <path d={floor.d} fillRule="evenodd" fill={`url(#floor-${vi})`} stroke="#f2b640" strokeOpacity="0.5" strokeWidth="1.6" strokeLinejoin="round" />
          {pins.map((p, i) =>
            Math.hypot(p.x - p.ox, p.y - p.oy) > 8 ? (
              <g key={i} opacity={p.f === fi ? 1 : 0.35}>
                <line x1={p.ox} y1={p.oy} x2={p.x} y2={p.y} stroke="#f2b640" strokeOpacity="0.45" strokeWidth="1.2" />
                <circle cx={p.ox} cy={p.oy} r="3.2" fill="#f2b640" fillOpacity="0.8" />
              </g>
            ) : null,
          )}
          {view.doors.map(([x, y, f], i) => (
            <g key={i} transform={`translate(${x} ${y})`} opacity={f === fi || !multi ? 1 : 0.35}>
              <circle r="15" fill="#0d0f13" stroke="#9ccc74" strokeOpacity="0.75" strokeWidth="1.6" />
              <path d="M-5.5 6.5V-1.5a5.5 5.5 0 0 1 11 0V6.5" fill="none" stroke="#c6e6a5" strokeWidth="2" strokeLinecap="round" />
            </g>
          ))}
        </svg>
        {view.doors.length > 0 && (
          <span
            className="pointer-events-none absolute -translate-x-1/2 translate-y-[14px] whitespace-nowrap text-[12px] font-[560] tracking-wide text-leaf-bright/80"
            style={pos(view.doors[0][0], view.doors[0][1])}
          >
            Entrance
          </span>
        )}
        {pins.map((p, i) => {
          const b = bosses[p.key];
          if (!b) return null;
          const here = p.f === fi || !multi;
          return (
            <a
              key={`${p.key}-${i}`}
              href={`#${p.key}`}
              aria-label={`${b.n}${p.alt ? ' (another place it can appear)' : ''}`}
              onPointerDown={(e) => {
                touch.current = e.pointerType === 'touch';
              }}
              onClick={(e) => {
                e.preventDefault();
                if (touch.current && hover?.key !== p.key) return setHover(p);
                if (!here) setFi(p.f);
                else go(p.key);
              }}
              onMouseEnter={() => setHover(p)}
              onFocus={() => setHover(p)}
              onBlur={() => setHover(null)}
              className={`group absolute z-10 -translate-x-1/2 -translate-y-1/2 rounded-full outline-none transition-opacity ${here ? '' : 'opacity-40 hover:opacity-80'}`}
              style={pos(p.x, p.y)}
            >
              <Face
                pd={p.pd}
                name={b.n}
                className={`${p.alt ? 'size-5 sm:size-7 lg:size-8' : 'size-8 sm:size-10 lg:size-11'} ring-[1.5px] shadow-[0_8px_20px_-8px_rgba(0,0,0,0.95)] transition-transform duration-150 group-hover:scale-110 group-focus-visible:scale-110 ${hover?.key === p.key ? 'ring-gilt-bright' : 'ring-gilt/60'} ${p.alt ? 'opacity-75' : ''}`}
              />
            </a>
          );
        })}
        {hover && card && (
          <div
            role="tooltip"
            className={`pointer-events-none absolute z-20 hidden w-[288px] -translate-y-1/2 sm:block ${right ? 'translate-x-[34px]' : '-translate-x-[calc(100%+34px)]'}`}
            style={{
              ...pos(hover.x, hover.y),
              top: `clamp(110px, ${((hover.y + PAD) / H) * 100}%, calc(100% - 110px))`,
            }}
          >
            <BossCard boss={card} pd={hover.pd} alt={hover.alt} />
          </div>
        )}
      </div>
      {hover && card && (
        <div className="mt-3 sm:hidden">
          <BossCard boss={card} pd={hover.pd} alt={hover.alt} />
        </div>
      )}
    </div>
  );
}

function BossCard({ boss, pd, alt }: { boss: MapBoss; pd?: number; alt: boolean }) {
  return (
    <div className="rounded-[16px] bg-[#0f1115]/95 p-3.5 ring-1 ring-inset ring-white/[0.09] shadow-[0_24px_48px_-20px_rgba(0,0,0,0.95)] backdrop-blur">
      <div className="flex items-center gap-3">
        <Face pd={pd} name={boss.n} className="size-12 shrink-0 ring-1 ring-gilt/50" />
        <div className="min-w-0">
          <div className="truncate font-semibold text-vellum">{boss.n}</div>
          <div className="truncate text-[13px] text-mist">{alt ? 'Can also appear here' : boss.sub}</div>
        </div>
      </div>
      {boss.abilities.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-1.5">
          {boss.abilities.map((a) => (
            <li key={a.n} className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.04] py-1 pl-2 pr-2.5 text-[12.5px] text-parch ring-1 ring-inset ring-white/[0.06]">
              <span aria-hidden className="size-1.5 rotate-45 rounded-[1px]" style={{ background: a.c, boxShadow: `0 0 6px ${a.c}` }} />
              {a.n}
            </li>
          ))}
        </ul>
      )}
      {boss.loot.length > 0 && (
        <ul className="mt-3 space-y-1.5 border-t border-white/[0.06] pt-3">
          {boss.loot.map((l) => (
            <li key={l.id} className="flex items-center gap-2 text-[13.5px]">
              {l.ic ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={iconUrl(l.ic, 'medium')} alt="" className="size-5 rounded-[5px] ring-1 ring-black/60" />
              ) : (
                <span className="size-5 rounded-[5px] bg-white/[0.06]" />
              )}
              <span className="truncate" style={{ color: l.c }}>
                {l.n}
              </span>
            </li>
          ))}
          {boss.more > 0 && <li className="pl-7 text-[12.5px] text-fog">and {boss.more} more</li>}
        </ul>
      )}
      <div className="mt-3 text-[12px] text-fog">Click for its abilities and loot</div>
    </div>
  );
}
