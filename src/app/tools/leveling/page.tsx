import type { Metadata } from 'next';
import Link from 'next/link';
import { Backdrop } from '@/components/backdrop';
import { LevelingRoute } from '@/components/leveling-route';
import { Container } from '@/components/ui';
import { getClasses } from '@/lib/data';

export const metadata: Metadata = {
  title: 'Leveling route',
  description: 'Where to quest and which dungeons to run at every level in World of Warcraft: Forever, for Alliance and Horde, with trainer spells, talent points and gear upgrades for your class.',
  alternates: { canonical: '/tools/leveling' },
};

export default function LevelingPage() {
  const classes = getClasses().map((c) => ({ slug: c.slug, name: c.name, color: c.color, icon: c.icon }));
  return (
    <div className="relative isolate">
      <Backdrop art="barrens" strength={0.42} />
      <Container className="pb-8 pt-10">
        <h1 className="text-[2.4rem] leading-tight text-vellum sm:text-[2.9rem]">Leveling route</h1>
        <p className="mt-2 max-w-3xl text-[17.5px] leading-relaxed text-parch">
          Slide to your level to see where to quest, which dungeons are in range, what your trainer teaches next and which upgrades just unlocked. The <Link href="/guides/leveling" className="text-gilt-bright underline decoration-gilt/40 underline-offset-2 hover:decoration-gilt">leveling guide</Link> explains the route in full.
        </p>
        <div className="mt-8">
          <LevelingRoute classes={classes} />
        </div>
      </Container>
    </div>
  );
}
