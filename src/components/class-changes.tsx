import Link from 'next/link';
import { getClass } from '@/lib/data';
import { inline } from '@/lib/markdown';
import { classChanges } from '@/lib/news';

/** "November 13" */
const day = (date: string) => new Date(`${date}T12:00:00Z`).toLocaleDateString('en-US', { month: 'long', day: 'numeric', timeZone: 'UTC' });

/** What Blizzard's hotfixes changed for one class since launch, day by day, in the lines of the hotfix pages. */
export function ClassChanges({ cls, className = '' }: { cls: string; className?: string }) {
  const c = getClass(cls);
  const changes = classChanges(cls);
  if (!c || !changes.length) return null;
  return (
    <section aria-labelledby="class-changes" className={className}>
      <h2 id="class-changes" className="scroll-mt-6 text-[1.7rem] text-vellum">
        What Blizzard changed for {c.name}s since launch
      </h2>
      <p className="mt-2 text-[15px] leading-relaxed text-mist">
        From the{' '}
        <Link href="/news" className="text-gilt underline decoration-gilt/40 underline-offset-2 hover:text-gilt-bright">
          hotfixes, day by day
        </Link>
        , newest first. Each day opens its page, with every fix and the builds it touches.
      </p>
      <ol className="mt-4 divide-y divide-iron/60 border-y border-iron/60">
        {changes.map((ch) => (
          <li key={ch.date} className="grid gap-x-5 gap-y-1 py-3.5 sm:grid-cols-[7.5rem_minmax(0,1fr)]">
            <Link href={`/news/${ch.date}`} prefetch={false} className="num text-[14.5px] font-medium text-gilt hover:text-gilt-bright">
              <time dateTime={ch.date}>{day(ch.date)}</time>
            </Link>
            <ul className="space-y-1.5 text-[15.5px] leading-relaxed text-parch">
              {ch.lines.map((l, i) => (
                <li key={i}>{inline(l, `${ch.date}-${i}`)}</li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
    </section>
  );
}
