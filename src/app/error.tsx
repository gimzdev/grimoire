'use client';

import Link from 'next/link';
import { useEffect } from 'react';

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="mx-auto w-full max-w-[1320px] px-4 py-24 sm:px-6">
      <h1 className="text-[2.4rem] leading-tight text-vellum">This page failed to load</h1>
      <p className="mt-3 max-w-2xl text-[17px] leading-relaxed text-parch">This page failed to load. Try again in a moment.</p>
      {error.digest && <p className="num mt-2 text-[14px] text-fog">Reference {error.digest}</p>}
      <div className="mt-6 flex flex-wrap gap-3">
        <button type="button" onClick={reset} className="inline-flex h-11 items-center rounded-full bg-gilt shadow-[inset_0_1px_0_rgb(255_255_255/0.45)] hover:bg-gilt-bright px-5 font-semibold text-[#1a1204]">
          Try again
        </button>
        <Link href="/" className="inline-flex h-11 items-center rounded-full border border-ash px-5 font-semibold text-vellum hover:border-gilt/60">
          Back to the front page
        </Link>
      </div>
    </div>
  );
}
