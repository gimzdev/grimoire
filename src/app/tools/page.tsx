import type { Metadata } from 'next';
import Link from 'next/link';
import { WowIcon } from '@/components/icon';
import { Container } from '@/components/ui';
import { Vista } from '@/components/vista';

export const metadata: Metadata = {
  title: 'Tools',
  description: 'Planning tools for World of Warcraft: Forever: talent calculator, gear planner, leveling route, raid composer and Legacy planner.',
  alternates: { canonical: '/tools' },
};

const TOOLS = [
  { href: '/talents', icon: 'ability_marksmanship', title: 'Talent calculator', text: 'Every rebuilt tree with new and changed talents marked, a point order that doubles as a leveling plan, the Talented perk, and links you can share.' },
  { href: '/tools/gear', icon: 'inv_chest_chain_15', title: 'Gear planner', text: 'Best item per slot for your class, spec and level. Hit, crit and haste as percentages, set bonuses, editable stat weights.' },
  { href: '/tools/leveling', icon: 'inv_misc_map02', title: 'Leveling route', text: 'Where to quest and which dungeons to run at every level for your faction, with the upgrades to look for along the way.' },
  { href: '/tools/raid', icon: 'inv_banner_02', title: 'Raid composer', text: 'Build a 10, 20 or 40-player roster and see which buffs, debuffs and utilities it covers in Forever, where several debuffs no longer stack.' },
  { href: '/tools/legacy', icon: 'inv_shield_06', title: 'Legacy planner', text: 'Tick off the sixty-five Legacy Challenges, see your point total and plan which perks each character takes.' },
];

export default function ToolsPage() {
  return (
    <>
      <Vista art="camp" title="Tools" size="compact" />
      <Container>
        <div className="grid gap-4 md:grid-cols-2">
          {TOOLS.map((t) => (
            <Link key={t.href} href={t.href} className="frame group flex gap-5 p-6 transition-colors hover:border-gilt/50">
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
