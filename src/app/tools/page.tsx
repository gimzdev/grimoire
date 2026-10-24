import type { Metadata } from 'next';
import Link from 'next/link';
import { WowIcon } from '@/components/icon';
import { Container } from '@/components/ui';
import { Vista } from '@/components/vista';
import { ADDON, external } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Tools',
  description: 'Planning tools for World of Warcraft: Forever: talent calculator, leveling route, raid composer and Legacy planner.',
  alternates: { canonical: '/tools' },
};

const TOOLS = [
  { href: '/talents', icon: 'ability_marksmanship', title: 'Talent calculator', text: 'Every rebuilt tree with new and changed talents marked, a point order that doubles as a leveling plan, the Talented perk, and links you can share.' },
  { href: '/tools/gear', icon: 'inv_chest_chain_15', title: 'Gear planner (paused)', text: 'Back after launch, once Forever’s item stats are available from an openly licensed source.' },
  { href: '/tools/leveling', icon: 'inv_misc_map02', title: 'Leveling route', text: 'A step-by-step route to 60 for every race and class, every quest with its map coordinates, and where to quest, which dungeons to run and what to wear at any level.' },
  { href: '/tools/raid', icon: 'inv_banner_02', title: 'Raid composer', text: 'Build a 10, 20 or 40-player roster and see which buffs, debuffs and utilities it covers in Forever, where several debuffs no longer stack.' },
  { href: '/tools/legacy', icon: 'inv_shield_06', title: 'Legacy planner', text: 'Tick off the sixty-five Legacy Challenges for your point total, then plan where a character spends its 16 points on the three perk trees.' },
  { href: ADDON.url, icon: 'inv_misc_book_09', title: 'In-game add-on', text: 'Grimoire inside WoW Forever: the leveling route with an arrow and on your map, gear upgrades for your build, dungeon quests, rare alerts and your build point by point. On CurseForge.' },
];

export default function ToolsPage() {
  return (
    <>
      <Vista art="camp" title="Tools" size="compact" />
      <Container>
        <div className="grid gap-4 md:grid-cols-2">
          {TOOLS.map((t) => (
            <Link key={t.href} href={t.href} {...(external(t.href) ? { target: '_blank', rel: 'noopener noreferrer' } : {})} className="frame group flex gap-5 p-6 transition-colors hover:border-gilt/50">
              <WowIcon icon={t.icon} size={56} name={t.title} />
              <div>
                <h2 className="text-[1.6rem] leading-tight text-vellum group-hover:text-gilt-bright">{t.title}</h2>
                <p className="mt-2 text-[16px] leading-relaxed text-mist">{t.text}</p>
              </div>
            </Link>
          ))}
        </div>
      </Container>
    </>
  );
}
