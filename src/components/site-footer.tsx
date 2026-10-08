import Link from 'next/link';
import { getMeta } from '@/lib/data';
import { Wordmark } from './logo';

const COLS = [
  {
    title: 'Plan',
    links: [
      ['/talents', 'Talent calculator'],
      ['/tools/gear', 'Gear planner'],
      ['/tools/leveling', 'Leveling route'],
      ['/tools/raid', 'Raid composer'],
      ['/tools/legacy', 'Legacy planner'],
    ],
  },
  {
    title: 'Learn',
    links: [
      ['/guides', 'All guides'],
      ['/classes', 'Classes'],
      ['/races', 'Races'],
      ['/forever', 'What’s new in Forever'],
    ],
  },
  {
    title: 'Look up',
    links: [
      ['/items', 'Items'],
      ['/quests', 'Quests'],
      ['/sets', 'Item sets'],
      ['/abilities', 'Trainer abilities'],
      ['/world', 'Zones'],
      ['/dungeons', 'Dungeons and raids'],
    ],
  },
];

export function SiteFooter() {
  const meta = getMeta();
  const updated = new Date(meta.extracted).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  return (
    <footer className="mt-24 border-t border-white/[0.06] sm:mt-28">
      <div className="mx-auto grid max-w-[1320px] grid-cols-2 gap-x-6 gap-y-10 px-4 py-14 sm:px-6 md:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div className="col-span-2 max-w-sm md:col-span-1">
          <Wordmark id="grf" />
          <p className="mt-5 max-w-xs text-[14.5px] leading-relaxed text-mist">Talents, guides and a database for World of Warcraft: Forever.</p>
          <p className="mt-2 text-[13.5px] text-fog">
            Game data from build {meta.build}, updated {updated}.
          </p>
        </div>
        {COLS.map((c) => (
          <div key={c.title}>
            <div className="text-[13.5px] font-medium text-fog">{c.title}</div>
            <ul className="mt-3 space-y-2 text-[14.5px]">
              {c.links.map(([href, label]) => (
                <li key={href}>
                  <Link href={href} className="text-parch transition-colors hover:text-vellum">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-white/[0.05]">
        <p className="mx-auto max-w-[1320px] px-4 py-6 text-[13px] leading-relaxed text-fog sm:px-6">
          Grimoire is a fan-made site and is not affiliated with or endorsed by Blizzard Entertainment. World of Warcraft, Warcraft and all related
          artwork, icons and names are trademarks or registered trademarks of Blizzard Entertainment, Inc. Icons from Wowhead; Classic quest and loot data from the VMaNGOS project.
        </p>
      </div>
    </footer>
  );
}
