import type { Metadata } from 'next';
import Link from 'next/link';
import { Backdrop } from '@/components/backdrop';
import { LegacyPlanner, type LegacyTab } from '@/components/legacy-planner';
import { Container } from '@/components/ui';
import { getClasses, getDungeons, getLegacy } from '@/lib/data';

export const metadata: Metadata = {
  title: 'Legacy planner',
  description: 'Tick off the 65 World of Warcraft: Forever Legacy Challenges, count your Legacy Points and plan each character’s 16 perk points in the Adventure, Resourcefulness and Professions trees.',
  alternates: { canonical: '/tools/legacy' },
};

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function LegacyPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const legacy = getLegacy();
  const classes = getClasses().map((c) => ({ slug: c.slug, name: c.name, color: c.color, icon: c.icon }));
  const places = Object.fromEntries(getDungeons().map((d) => [d.slug, d.name]));
  const plan = one(sp.p)?.replace(/[^0-9a-zA-Z]/g, '').slice(0, 64) || undefined;
  const tab: LegacyTab = one(sp.tab) === 'perks' ? 'perks' : 'challenges';
  return (
    <div className="relative isolate">
      <Backdrop art="legacy" strength={0.42} />
      <Container className="pb-8 pt-10">
        <h1 className="text-[2.4rem] leading-tight text-vellum sm:text-[2.9rem]">Legacy planner</h1>
        <p className="mt-2 max-w-3xl text-[17.5px] leading-relaxed text-parch">
          Tick off the Legacy Challenges your account has done to count its points, then plan where a character spends its {legacy.points}. The{' '}
          <Link href="/guides/legacy-system" className="text-gilt-bright underline decoration-gilt/40 underline-offset-2 hover:decoration-gilt">
            Legacy guide
          </Link>{' '}
          explains the challenges, the perks and the rewards.
        </p>
        <div className="mt-8">
          <LegacyPlanner key={plan ?? ''} data={legacy} classes={classes} places={places} initial={{ tab, plan }} />
        </div>
      </Container>
    </div>
  );
}
