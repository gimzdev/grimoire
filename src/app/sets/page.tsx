import type { Metadata } from 'next';
import Link from 'next/link';
import { Backdrop } from '@/components/backdrop';
import { Paused } from '@/components/paused';
import { Container } from '@/components/ui';

export const metadata: Metadata = {
  title: 'Item sets',
  description: 'Item sets in Grimoire are paused until World of Warcraft: Forever’s set data is available from an openly licensed source.',
  alternates: { canonical: '/sets' },
  robots: { index: false },
};

export default function SetsPage() {
  return (
    <div className="relative isolate">
      <Backdrop art="camp" strength={0.4} />
      <Container className="pb-8 pt-10">
        <h1 className="text-[2.4rem] text-vellum sm:text-[2.8rem]">Item sets</h1>
        <Paused title="Back once Forever’s set bonuses are open">
          <p>
            Set bonuses live in the game client, not in the open Classic database Grimoire uses, and no openly licensed source has Forever’s sets yet. The set pages
            return once they can be collected from the game itself.
          </p>
          <p>
            Every set piece is still in the <Link href="/items">item database</Link>.
          </p>
        </Paused>
      </Container>
    </div>
  );
}
