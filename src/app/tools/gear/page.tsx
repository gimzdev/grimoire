import type { Metadata } from 'next';
import Link from 'next/link';
import { Backdrop } from '@/components/backdrop';
import { Paused } from '@/components/paused';
import { Container } from '@/components/ui';

export const metadata: Metadata = {
  title: 'Gear planner',
  description: 'The Grimoire gear planner is paused until World of Warcraft: Forever’s item stats are available from an openly licensed source.',
  alternates: { canonical: '/tools/gear' },
  robots: { index: false },
};

export default function GearPage() {
  return (
    <div className="relative isolate">
      <Backdrop art="camp" strength={0.4} />
      <Container className="pb-8 pt-10">
        <h1 className="text-[2.4rem] leading-tight text-vellum sm:text-[2.9rem]">Gear planner</h1>
        <Paused title="Back once Forever’s item stats are open">
          <p>
            The planner ranks items by their stats, and Forever changed the stats of thousands of items. No openly licensed source has Forever’s item stats yet, so
            rather than rank gear on numbers we may not use, the planner is off for now. It comes back after launch, once those stats can be collected from the
            game itself.
          </p>
          <p>
            In the meantime the <Link href="/items">item database</Link> shows every piece with its Classic stats, drop chances and sources.
          </p>
        </Paused>
      </Container>
    </div>
  );
}
