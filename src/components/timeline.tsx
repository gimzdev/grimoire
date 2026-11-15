import { MILESTONES } from '@/lib/site';
import { LaunchLine } from './home-client';

/** Launch milestones as a row of cards; the next one to come is lit in gold. Over art, the cards are frosted. */
export function Timeline({ title = 'Launch and the first raids', id, onArt = false }: { title?: string; id?: string; onArt?: boolean }) {
  const now = Date.now();
  const next = MILESTONES.find((m) => Date.parse(m.date) > now)?.key;
  const fmtDate = (d: string) => new Date(d).toLocaleDateString('en-US', { month: 'long', day: 'numeric', timeZone: 'America/Los_Angeles' });
  return (
    <section id={id} aria-labelledby="timeline-title" className="scroll-mt-28">
      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
        <h2 id="timeline-title" className={`text-[2rem] leading-[1.05] text-vellum sm:text-[2.6rem] ${onArt ? 'drop-shadow-[0_2px_18px_rgb(0_0_0/0.6)]' : ''}`}>
          {title}
        </h2>
        {onArt && (
          <div className="pb-1.5">
            <LaunchLine />
          </div>
        )}
      </div>
      <ol className="mt-8 grid gap-3 md:grid-cols-3">
        {MILESTONES.map((m) => {
          const done = Date.parse(m.date) <= now;
          const isNext = m.key === next;
          const surface = onArt
            ? `border backdrop-blur-xl backdrop-saturate-150 ${isNext ? 'border-gilt/45 bg-[rgb(20_16_8/0.6)]' : 'border-white/[0.12] bg-[rgb(12_13_17/0.55)]'}`
            : `ring-1 ring-inset ${isNext ? 'bg-gilt/[0.06] ring-gilt/30' : 'bg-white/[0.03] ring-white/[0.07]'}`;
          return (
            <li key={m.key} className={`relative rounded-[20px] p-6 ${surface}`}>
              <div className="flex items-center justify-between gap-3">
                <span className={`num text-[15px] font-semibold ${isNext ? 'text-gilt-bright' : done ? 'text-fog' : 'text-parch'}`}>{fmtDate(m.date)}</span>
                {isNext && <span className="rounded-full bg-gilt px-2.5 py-0.5 text-[12px] font-bold text-[#1a1204]">Next</span>}
                {done && <span className="rounded-full bg-white/[0.07] px-2.5 py-0.5 text-[12px] font-semibold text-mist">Done</span>}
              </div>
              <div className="mt-3 text-[1.35rem] font-semibold leading-tight tracking-[-0.02em] text-vellum">{m.label}</div>
              <p className="mt-1.5 text-[15px] leading-snug text-mist">{m.detail}</p>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
