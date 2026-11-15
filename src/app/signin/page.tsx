import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { Resume, SignIn } from '@/components/signin';
import { Container } from '@/components/ui';
import { ACCOUNTS, safeNext } from '@/lib/accounts';
import { me, methods } from '@/lib/auth';
import { devCodes } from '@/lib/db';

export const metadata: Metadata = { title: 'Sign in', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };
const first = (v?: string | string[]) => (Array.isArray(v) ? v[0] : v);

export default async function SignInPage({ searchParams }: Props) {
  if (!ACCOUNTS) notFound();
  const sp = await searchParams;
  const next = safeNext(first(sp.next));
  const signedIn = !!(await me(await headers(), { render: true }).catch(() => null));
  return (
    <Container className="pb-6 pt-10 sm:pt-16">
      <div className="mx-auto max-w-md">
        <h1 className="text-[2.6rem] leading-none text-vellum sm:text-[3.2rem]">{signedIn ? 'Welcome back' : 'Sign in'}</h1>
        {!signedIn && <p className="mb-8 mt-4 text-[17px] leading-relaxed text-mist">Save your talent builds, Legacy builds and raid comps, keep your Legacy progress, and open them on any device.</p>}
        {signedIn ? (
          <div className="mt-8">
            <Resume next={next} />
          </div>
        ) : (
          <SignIn next={next} methods={methods()} dev={devCodes() && !process.env.RESEND_API_KEY} failed={!!(first(sp.error) || first(sp.failed))} />
        )}
      </div>
    </Container>
  );
}
