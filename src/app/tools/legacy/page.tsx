import type { Metadata } from 'next';
import Link from 'next/link';
import { Backdrop } from '@/components/backdrop';
import { LegacyPlanner } from '@/components/legacy-planner';
import { Container } from '@/components/ui';
import { getClasses } from '@/lib/data';

export const metadata: Metadata = {
  title: 'Legacy planner',
  description: 'Track all 65 World of Warcraft: Forever Legacy Challenges, count your Legacy Points and plan the perks each character takes.',
  alternates: { canonical: '/tools/legacy' },
};

export default function LegacyPage() {
  const classes = getClasses().map((c) => ({ slug: c.slug, name: c.name, color: c.color, icon: c.icon }));
  return (
    <div className="relative isolate">
      <Backdrop art="legacy" strength={0.42} />
      <Container className="pb-8 pt-10">
        <h1 className="text-[2.4rem] leading-tight text-vellum sm:text-[2.9rem]">Legacy planner</h1>
        <p className="mt-2 max-w-3xl text-[17.5px] leading-relaxed text-parch">
          Tick off Legacy Challenges as you complete them and see how many points your account has to spend. The{' '}
          <Link href="/guides/legacy-system" className="text-gilt-bright underline decoration-gilt/40 underline-offset-2 hover:decoration-gilt">
            Legacy guide
          </Link>{' '}
          explains every challenge, perk and reward.
        </p>
        <div className="mt-8">
          <LegacyPlanner classes={classes} />
        </div>
      </Container>
    </div>
  );
}
