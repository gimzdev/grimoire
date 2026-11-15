import Link from 'next/link';
import { ACCOUNTS } from '@/lib/accounts';
import { getMeta } from '@/lib/data';
import { DISCORD, external, PATREON, STUDIO } from '@/lib/site';
import { Wordmark } from './logo';
import { HeartIcon } from './support';

const COLS = [
  {
    title: 'Plan',
    links: [
      ['/talents', 'Talent calculator'],
      ['/builds', 'Builds'],
      ['/tools/gear', 'Gear planner'],
      ['/tools/leveling', 'Leveling route'],
      ['/tools/raid', 'Raid composer'],
      ['/tools/legacy', 'Legacy planner'],
      ['/tools/addon', 'In-game add-on'],
      ['/tools/tooltips', 'Tooltips for your site'],
      ...(ACCOUNTS ? [['/profile', 'Profile']] : []),
    ],
  },
  {
    title: 'Learn',
    links: [
      ['/guides', 'All guides'],
      ['/classes', 'Classes'],
      ['/races', 'Races'],
      ['/forever', 'What’s new in Forever'],
      ['/news', 'Hotfixes'],
    ],
  },
  {
    title: 'Look up',
    links: [
      ['/items', 'Items'],
      ['/quests', 'Quests'],
      ['/abilities', 'Trainer abilities'],
      ['/world', 'Zones'],
      ['/dungeons', 'Dungeons and raids'],
    ],
  },
];

export function SiteFooter() {
  const meta = getMeta();
  const updated = new Date(meta.extracted).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
  return (
    <footer className="mt-24 border-t border-white/[0.06] sm:mt-28">
      <div className="mx-auto grid max-w-[1320px] grid-cols-2 gap-x-6 gap-y-10 px-4 py-14 sm:px-6 md:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div className="col-span-2 max-w-sm md:col-span-1">
          <Wordmark id="grf" />
          <p className="mt-5 max-w-xs text-[14.5px] leading-relaxed text-mist">Talents, guides and a database for World of Warcraft: Forever.</p>
          <p className="mt-2 text-[13.5px] text-fog">
            Game data from build {meta.build}, updated {updated}.
          </p>
          <a
            href={PATREON}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-6 inline-flex h-10 items-center gap-2 rounded-full bg-white/[0.06] px-[18px] text-[14px] font-[560] text-parch ring-1 ring-inset ring-white/[0.08] transition-colors hover:bg-white/[0.1] hover:text-vellum"
          >
            <HeartIcon className="size-4 text-gilt" />
            Support on Patreon
          </a>
        </div>
        {COLS.map((c) => (
          <div key={c.title}>
            <div className="text-[13.5px] font-medium text-fog">{c.title}</div>
            <ul className="mt-3 space-y-2 text-[14.5px]">
              {c.links.map(([href, label]) => (
                <li key={href}>
                  <Link href={href} {...(external(href) ? { target: '_blank', rel: 'noopener noreferrer' } : {})} className="text-parch transition-colors hover:text-vellum">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-white/[0.05]">
        <div className="mx-auto flex max-w-[1320px] flex-col gap-3 px-4 py-6 text-[13px] leading-relaxed text-fog sm:flex-row sm:items-start sm:justify-between sm:gap-10 sm:px-6">
          <p className="max-w-4xl">
            A fan site, not affiliated with or endorsed by Blizzard Entertainment. World of Warcraft and Warcraft are trademarks or registered trademarks of Blizzard Entertainment, Inc.;
            game names, text, art and icons © Blizzard Entertainment, Inc.
          </p>
          <div className="flex shrink-0 flex-wrap gap-x-5 gap-y-2">
            <Link href="/legal#credits" className="text-parch transition-colors hover:text-vellum">
              Credits
            </Link>
            <Link href="/legal" className="text-parch transition-colors hover:text-vellum">
              Terms and privacy
            </Link>
            <a href={DISCORD} target="_blank" rel="noopener noreferrer" className="text-parch transition-colors hover:text-vellum">
              Discord
            </a>
            {/* No noreferrer: gimzdev.com's analytics can then show Grimoire as where the visit came from */}
            <span>
              <a href={STUDIO.made} target="_blank" rel="noopener" className="text-parch transition-colors hover:text-vellum">
                Made by Gimz
              </a>
              <span aria-hidden className="mx-1.5">·</span>
              <a href={STUDIO.hire} target="_blank" rel="noopener" className="text-parch transition-colors hover:text-vellum">
                Hire me
              </a>
              <span aria-hidden className="mx-1.5">·</span>
              <a href={STUDIO.support} target="_blank" rel="noopener" className="text-parch transition-colors hover:text-vellum">
                Support
              </a>
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
