'use client';

import { useEffect } from 'react';

/** Marks the "On this page" link for the section being read. */
export function TocSpy({ ids }: { ids: string[] }) {
  const key = ids.join('|');
  useEffect(() => {
    const list = key ? key.split('|') : [];
    const nav = document.querySelector('nav[aria-label="On this page"]');
    if (!nav || !list.length) return;
    const links = new Map(list.map((id) => [id, nav.querySelector<HTMLAnchorElement>(`a[href="#${CSS.escape(id)}"]`)]));
    let current = '';
    let frame = 0;
    const update = () => {
      frame = 0;
      let active = '';
      const line = Math.max(160, window.innerHeight * 0.22);
      for (const id of list) {
        const el = document.getElementById(id);
        if (!el) continue;
        if (el.getBoundingClientRect().top <= line) active = id;
        else break;
      }
      // Scrolled to the very end: the last section is the one on screen.
      const doc = document.documentElement;
      if (active && window.innerHeight + window.scrollY >= doc.scrollHeight - 4) active = list[list.length - 1];
      if (active === current) return;
      if (current) links.get(current)?.removeAttribute('aria-current');
      if (active) links.get(active)?.setAttribute('aria-current', 'location');
      current = active;
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (frame) cancelAnimationFrame(frame);
      if (current) links.get(current)?.removeAttribute('aria-current');
    };
  }, [key]);
  return null;
}
