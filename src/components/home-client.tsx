'use client';

import { useEffect, useState } from 'react';
import { MILESTONES } from '@/lib/site';
import { InlineSearch } from './inline-search';

/** The front page's search field: results open right under it as you type. */
export function HeroSearch({ placeholder }: { placeholder: string }) {
  return <InlineSearch variant="hero" placeholder={placeholder} shortPlaceholder="Search items, quests, talents" />;
}

/** One line about the next milestone: launch day, then the first raids. */
export function LaunchLine() {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);
  const next = MILESTONES.filter((m) => m.key === 'launch' || m.key === 'raids').find((m) => now === null || Date.parse(m.date) > now);
  if (!next) return null;
  const ms = now === null ? null : Date.parse(next.date) - now;
  const days = ms === null ? null : Math.floor(ms / 86_400_000);
  const hours = ms === null ? null : Math.floor((ms % 86_400_000) / 3_600_000);
  const what = next.key === 'launch' ? 'Launches November 4 at 3 p.m. PST' : 'The first raids open December 9';
  return (
    <p className="flex items-center gap-2.5 text-[14.5px] text-parch">
      <span aria-hidden className="size-2 rounded-full bg-gilt" />
      <span>
        {what}
        {days !== null && hours !== null && (
          <>
            , in <span className="num font-semibold text-gilt-bright">{days > 0 ? `${days} days` : `${hours} hours`}</span>
          </>
        )}
      </span>
    </p>
  );
}
