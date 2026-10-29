'use client';

import { useEffect, useRef, useState } from 'react';
import type { Item, SpellRecord } from '@/lib/types';
import { ItemTooltip, NpcTooltip, QuestTooltip, SpellTooltip, type ItemTipExtra, type NpcTip, type QuestTip } from './tooltips';

type Tip = { type: 'item'; item: Item; extra?: ItemTipExtra } | { type: 'spell'; spell: SpellRecord } | { type: 'quest'; quest: QuestTip } | { type: 'npc'; npc: NpcTip };

const cache = new Map<string, Promise<Tip | null>>();

function load(key: string): Promise<Tip | null> {
  let p = cache.get(key);
  if (!p) {
    p = fetch(`/api/tip?k=${encodeURIComponent(key)}`)
      .then((r) => (r.ok ? (r.json() as Promise<Tip>) : null))
      .catch(() => null);
    cache.set(key, p);
  }
  return p;
}

/**
 * Hover tooltips for any element with data-tip="item:123" or data-tip="spell:456", in the game's own style.
 * One listener on the document, so server-rendered pages get tooltips without shipping their data.
 */
export function TipLayer() {
  const [tip, setTip] = useState<Tip | null>(null);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const active = useRef<string | null>(null);
  const pointer = useRef({ x: 0, y: 0 });

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const fine = window.matchMedia('(hover: hover) and (pointer: fine)');

    const show = (el: Element, at?: { x: number; y: number }) => {
      const key = el.getAttribute('data-tip');
      if (!key) return;
      active.current = key;
      clearTimeout(timer);
      timer = setTimeout(async () => {
        const data = await load(key);
        if (active.current !== key) return;
        setTip(data);
        if (at) setPos(at);
        else {
          const r = el.getBoundingClientRect();
          setPos({ x: r.left, y: r.bottom + 4 });
        }
      }, 70);
    };
    const hide = () => {
      active.current = null;
      clearTimeout(timer);
      setTip(null);
      setPos(null);
    };

    const over = (e: PointerEvent) => {
      if (!fine.matches || e.pointerType === 'touch') return;
      const el = (e.target as Element | null)?.closest?.('[data-tip]');
      if (!el) return;
      pointer.current = { x: e.clientX, y: e.clientY };
      if (el.getAttribute('data-tip') !== active.current) show(el, pointer.current);
    };
    const out = (e: PointerEvent) => {
      const el = (e.target as Element | null)?.closest?.('[data-tip]');
      const to = (e.relatedTarget as Element | null)?.closest?.('[data-tip]');
      if (el && el !== to) hide();
    };
    const move = (e: PointerEvent) => {
      if (!active.current) return;
      pointer.current = { x: e.clientX, y: e.clientY };
      setPos({ x: e.clientX, y: e.clientY });
    };
    const focus = (e: FocusEvent) => {
      const el = (e.target as Element | null)?.closest?.('[data-tip]');
      if (el) show(el);
    };

    document.addEventListener('pointerover', over);
    document.addEventListener('pointerout', out);
    document.addEventListener('pointermove', move, { passive: true });
    document.addEventListener('focusin', focus);
    document.addEventListener('focusout', hide);
    window.addEventListener('scroll', hide, { passive: true });
    return () => {
      document.removeEventListener('pointerover', over);
      document.removeEventListener('pointerout', out);
      document.removeEventListener('pointermove', move);
      document.removeEventListener('focusin', focus);
      document.removeEventListener('focusout', hide);
      window.removeEventListener('scroll', hide);
      clearTimeout(timer);
    };
  }, []);

  // Keep the box on screen: flip to the left or above the pointer when it would overflow.
  const [style, setStyle] = useState<React.CSSProperties>({ opacity: 0 });
  useEffect(() => {
    if (!tip || !pos || !box.current) return;
    const w = box.current.offsetWidth;
    const h = box.current.offsetHeight;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let x = pos.x + 18;
    let y = pos.y + 18;
    if (x + w > vw - 8) x = Math.max(8, pos.x - w - 14);
    if (y + h > vh - 8) y = Math.max(8, vh - h - 8);
    setStyle({ transform: `translate3d(${Math.round(x)}px, ${Math.round(y)}px, 0)`, opacity: 1 });
  }, [tip, pos]);

  if (!tip || !pos) return null;
  return (
    <div ref={box} role="tooltip" className="pointer-events-none fixed left-0 top-0 z-[100] transition-opacity duration-75" style={style}>
      {tip.type === 'item' ? (
        <ItemTooltip item={tip.item} extra={tip.extra} compact />
      ) : tip.type === 'spell' ? (
        <SpellTooltip spell={tip.spell} />
      ) : tip.type === 'quest' ? (
        <QuestTooltip quest={tip.quest} />
      ) : (
        <NpcTooltip npc={tip.npc} />
      )}
    </div>
  );
}
