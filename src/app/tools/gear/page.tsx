import type { Metadata } from 'next';
import { Backdrop } from '@/components/backdrop';
import { GearPlanner } from '@/components/gear-planner';
import { Container } from '@/components/ui';
import { getClasses } from '@/lib/data';

export const metadata: Metadata = {
  title: 'Gear planner',
  description: 'Plan a World of Warcraft: Forever gear set: best items per slot for your class, spec and level, hit and crit as percentages, set bonuses and a shareable link.',
  alternates: { canonical: '/tools/gear' },
};

export default function GearPage() {
  const classes = getClasses().map((c) => ({ slug: c.slug, name: c.name, color: c.color, icon: c.icon }));
  return (
    <div className="relative isolate">
      <Backdrop art="camp" strength={0.4} />
      <Container className="pb-8 pt-10">
        <h1 className="text-[2.4rem] leading-tight text-vellum sm:text-[2.9rem]">Gear planner</h1>
        <p className="mt-2 max-w-3xl text-[17.5px] leading-relaxed text-parch">
          Pick a class, spec and level, and the planner fills every slot with the best item you can use from the Forever item pool. Click any slot to see every alternative, ranked by your stat weights. The link in your address bar always holds the current set.
        </p>
        <div className="mt-8">
          <GearPlanner classes={classes} />
        </div>
      </Container>
    </div>
  );
}
