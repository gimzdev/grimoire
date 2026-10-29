import Link from 'next/link';
import type { ReactNode } from 'react';

/** A page that is switched off until its data has an openly licensed source. */
export function Paused({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="frame mt-8 max-w-3xl p-6 sm:p-8">
      <div className="text-[13.5px] font-semibold uppercase tracking-[0.14em] text-gilt">Paused</div>
      <h2 className="mt-2 text-[1.7rem] leading-tight text-vellum">{title}</h2>
      <div className="prose-grim mt-3 text-[16.5px] leading-relaxed text-parch">{children}</div>
      <p className="mt-5 text-[15px] text-mist">
        Where Grimoire’s data comes from: <Link href="/legal#credits" className="text-gilt hover:text-gilt-bright">credits</Link>.
      </p>
    </div>
  );
}
