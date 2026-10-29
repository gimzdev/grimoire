import type { Metadata } from 'next';
import { Backdrop } from '@/components/backdrop';
import { RaidComposer } from '@/components/raid-composer';
import { Container } from '@/components/ui';
import { getClasses } from '@/lib/data';

export const metadata: Metadata = {
  title: 'Raid composer',
  description: 'Build a 10, 20 or 40-player World of Warcraft: Forever raid and see which buffs, debuffs and utilities it covers, group by group.',
  alternates: { canonical: '/tools/raid' },
};

export default function RaidPage() {
  const classes = getClasses().map((c) => {
    const specIcons: Record<string, string> = Object.fromEntries(c.specs.map((s) => [s.slug, s.icon]));
    if (c.slug === 'druid') specIcons.bear = 'ability_racial_bearform';
    return { slug: c.slug, name: c.name, color: c.color, icon: c.icon, specIcons };
  });
  return (
    <div className="relative isolate">
      <Backdrop art="onyxiasLair" strength={0.4} />
      <Container className="pb-8 pt-10">
        <h1 className="text-[2.4rem] leading-tight text-vellum sm:text-[2.9rem]">Raid composer</h1>
        <p className="mt-2 max-w-3xl text-[17.5px] leading-relaxed text-parch">
          Build a roster for Barrow Deeps, Hyjal Summit or Onyxia’s Lair. Party-wide auras and totems are counted group by group, so you can see what each group is missing.</p>
        <div className="mt-8">
          <RaidComposer classes={classes} />
        </div>
      </Container>
    </div>
  );
}
