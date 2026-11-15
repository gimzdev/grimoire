import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { SavedBuilds } from '@/components/saved-builds';
import { Container } from '@/components/ui';
import { ACCOUNTS } from '@/lib/accounts';
import { me, type Me } from '@/lib/auth';
import { describe, getLegacyProgress, legacySummary, listBuilds, type LegacyProgress, type Row } from '@/lib/builds';
import { getClasses } from '@/lib/data';

export const metadata: Metadata = { title: 'Profile', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

const down = (what: string) => (e: unknown) => {
  console.error(`[grimoire] could not ${what}:`, e instanceof Error ? e.message : e);
  return undefined;
};

export default async function ProfilePage() {
  if (!ACCOUNTS) notFound();
  const user: Me | null | undefined = await me(await headers(), { render: true }).catch(down('check the session'));
  if (user === null) redirect('/signin?next=/profile');
  const [rows, legacy]: [Row[] | undefined, LegacyProgress | null | undefined] = user
    ? await Promise.all([listBuilds(user.id).catch(down('load the saved builds')), getLegacyProgress(user.id).catch(down('load the Legacy progress'))])
    : [undefined, undefined];
  return (
    <Container className="pb-6 pt-10 sm:pt-14">
      <h1 className="text-[2.6rem] leading-none text-vellum sm:text-[3.4rem]">Profile</h1>
      <p className="mt-4 max-w-2xl text-[17px] leading-relaxed text-mist">Your saved builds and your Legacy progress.</p>
      {user && rows ? (
        <SavedBuilds user={{ email: user.email, since: user.since }} tiles={rows.map(describe)} legacy={legacySummary(legacy ?? null)} classOrder={getClasses().map((c) => c.slug)} />
      ) : (
        <p className="frame mt-10 px-6 py-8 text-[16px] text-mist">Your saved builds are unavailable for a moment. Reload the page in a minute.</p>
      )}
    </Container>
  );
}
