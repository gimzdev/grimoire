import type { Metadata } from 'next';
import Link from 'next/link';
import { AddonStrip } from '@/components/addon-button';
import { Backdrop } from '@/components/backdrop';
import { GearPlanner } from '@/components/gear-planner';
import { Container } from '@/components/ui';
import { getClasses, getMeta } from '@/lib/data';

export const metadata: Metadata = {
  title: 'Gear planner',
  description: 'The best item for every slot at your level in World of Warcraft: Forever, for any class and spec, with Forever’s stat rules and editable stat weights.',
  alternates: { canonical: '/tools/gear' },
};

export default function GearPage() {
  const classes = getClasses().map((c) => ({ slug: c.slug, name: c.name, color: c.color, icon: c.icon }));
  const changed = getMeta().counts.itemsUpdated;
  return (
    <div className="relative isolate">
      <Backdrop art="camp" strength={0.4} />
      <Container className="pb-8 pt-10">
        <h1 className="text-[2.4rem] leading-tight text-vellum sm:text-[2.9rem]">Gear planner</h1>
        <p className="mt-2 max-w-3xl text-[17.5px] leading-relaxed text-parch">
          The best item for every slot at your level, ranked by stat weights for your spec. Change any weight and fill again to re-rank.
        </p>
        <p className="mt-3 max-w-3xl text-[15px] leading-relaxed text-mist">
          A starting point, not the last word: items have Classic’s stats with Forever’s published rules applied ({changed.toLocaleString('en-US')} items change: one Hit
          and one Critical Strike stat, and healing gear that adds a third as much damage). Blizzard reworked other items it hasn’t shown yet, so check a pick’s
          tooltip in game. The <Link href="/guides/stats-and-combat">stats guide</Link> explains the weights.
        </p>
        <div className="mt-8">
          <GearPlanner classes={classes} />
        </div>
        <AddonStrip from="gear" className="mt-8">
          In game, the add-on shows in each item’s tooltip whether it is an upgrade for your spec.
        </AddonStrip>
      </Container>
    </div>
  );
}
