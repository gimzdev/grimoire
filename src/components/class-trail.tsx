import Link from 'next/link';
import { getClass, getGuide, getRace } from '@/lib/data';
import { getRoutes, routeHref } from '@/lib/guide';

const CHIP = 'inline-flex h-8 items-center rounded-full bg-white/[0.03] px-3 text-[13.5px] font-[560] text-parch ring-1 ring-inset ring-white/[0.07] transition-colors hover:bg-white/[0.08] hover:text-vellum';

/** One class's pages, each one click from the others: its guide, its builds, its calculator, its trainer list and the
 * leveling route of every race that can play it. `here` is the page this sits on, which is left out. */
export function ClassTrail({ cls, here, className = '' }: { cls: string; here: 'build' | 'guide' | 'class'; className?: string }) {
  const c = getClass(cls);
  if (!c) return null;
  const pages = [
    here !== 'guide' && getGuide(cls) ? { href: `/guides/${cls}`, text: `${c.name} guide` } : null,
    here !== 'build' ? { href: `/builds#${cls}`, text: `${c.name} builds` } : null,
    { href: `/talents/${cls}`, text: 'Talent calculator' },
    { href: `/abilities?class=${cls}`, text: 'Trainer abilities' },
    here !== 'class' ? { href: `/classes/${cls}`, text: 'Specs, races and changes' } : null,
  ].filter((x): x is { href: string; text: string } => Boolean(x));
  const routes = getRoutes().filter((r) => r.class === cls);
  const row = 'flex items-baseline gap-3';
  const label = 'w-[5.5rem] shrink-0 text-[13px] text-fog sm:w-28';
  return (
    <nav aria-labelledby="class-trail" className={className}>
      <h2 id="class-trail" className="scroll-mt-6 text-[1.7rem] text-vellum">
        Also for {c.name}s
      </h2>
      <div className="mt-4 space-y-2">
        <div className={row}>
          <div className={label}>{c.name}</div>
          <ul className="flex min-w-0 flex-wrap gap-1.5">
            {pages.map((p) => (
              <li key={p.href}>
                <Link href={p.href} prefetch={false} className={CHIP}>
                  {p.text}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        {routes.length > 0 && (
          <div className={row}>
            <div className={label}>Leveling routes</div>
            <ul className="flex min-w-0 flex-wrap gap-1.5">
              {routes.map((r) => (
                <li key={r.id}>
                  <Link href={routeHref(r.id)} prefetch={false} className={CHIP}>
                    {getRace(r.race)?.name ?? r.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </nav>
  );
}
