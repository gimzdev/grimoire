import Image from 'next/image';
import type { ReactNode } from 'react';
import type { ArtKey } from '@/lib/art';
import { resolveArt } from '@/lib/art-server';

/**
 * The art at the top of a page, in a rounded window inset from the edges of the screen. The floating
 * header sits inside its top edge; the title sits low and left like a zone name on entering a new area.
 */
export function Vista({
  art,
  title,
  kicker,
  children,
  size = 'page',
  priority = true,
  tint,
  aside,
}: {
  art: ArtKey | string;
  title: ReactNode;
  kicker?: ReactNode;
  children?: ReactNode;
  size?: 'hero' | 'page' | 'compact';
  priority?: boolean;
  tint?: string;
  aside?: ReactNode;
}) {
  const a = resolveArt(art);
  const h = size === 'hero' ? 'min-h-[min(860px,calc(100svh-20px))]' : size === 'page' ? 'min-h-[420px] sm:min-h-[480px]' : 'min-h-[300px] sm:min-h-[340px]';
  return (
    <section className="relative -mt-[84px] mb-10 px-2 pt-2 sm:mb-14 sm:px-2.5 sm:pt-2.5">
      <div className={`relative isolate flex ${h} items-end overflow-hidden rounded-[22px] bg-night sm:rounded-[28px]`}>
        <Image
          src={a.src}
          alt={a.alt}
          fill
          priority={priority}
          sizes="100vw"
          quality={75}
          className="-z-20 object-cover"
          style={{ objectPosition: a.focus ?? 'center', transform: a.zoom ? `scale(${a.zoom})` : undefined }}
        />
        {/* Readability: a little shade under the header, more at the bottom left where the title sits. */}
        <div aria-hidden className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgb(8_9_12/0.5)_0%,rgb(8_9_12/0.06)_26%,rgb(8_9_12/0.08)_50%,rgb(8_9_12/0.82)_100%)]" />
        <div aria-hidden className="absolute inset-0 -z-10 bg-[radial-gradient(90%_80%_at_0%_100%,rgb(8_9_12/0.7),transparent_65%)]" />
        {tint && <div aria-hidden className="absolute inset-0 -z-10 mix-blend-soft-light" style={{ background: `radial-gradient(90% 70% at 15% 90%, ${tint}55, transparent 70%)` }} />}
        <div aria-hidden className="pointer-events-none absolute inset-0 rounded-[inherit] ring-1 ring-inset ring-white/[0.08]" />
        <div className="mx-auto w-full max-w-[1320px] px-5 pb-9 pt-32 sm:px-6 sm:pb-12">
          <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl animate-unveil">
              {kicker && <div className="mb-3 text-[15px] font-medium text-parch">{kicker}</div>}
              <h1 className="text-[2.5rem] leading-[1.02] text-vellum drop-shadow-[0_2px_18px_rgb(0_0_0/0.55)] sm:text-[3.6rem]">{title}</h1>
              {children && <div className="mt-4 max-w-2xl text-[17px] leading-relaxed text-parch drop-shadow-[0_1px_8px_rgb(0_0_0/0.8)]">{children}</div>}
            </div>
            {aside && <div className="shrink-0">{aside}</div>}
          </div>
        </div>
      </div>
    </section>
  );
}
