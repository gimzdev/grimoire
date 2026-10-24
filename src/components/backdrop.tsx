import Image from 'next/image';
import type { ArtKey } from '@/lib/art';
import { resolveArt } from '@/lib/art-server';

/**
 * Dimmed art behind the top of a tool or database page: the same rounded window as a page head, fading
 * out downward so the content below sits on the plain page.
 */
export function Backdrop({ art, strength = 0.42, height = 640 }: { art: ArtKey | string; strength?: number; height?: number }) {
  const a = resolveArt(art);
  const fade = 'linear-gradient(180deg, #000 0%, #000 38%, transparent 100%)';
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-x-2 -top-[76px] -z-10 overflow-hidden rounded-t-[22px] sm:inset-x-2.5 sm:-top-[74px] sm:rounded-t-[28px]"
      style={{ height, maskImage: fade, WebkitMaskImage: fade }}
    >
      <Image src={a.src} alt="" fill sizes="100vw" quality={60} className="object-cover" style={{ objectPosition: a.focus ?? 'center', opacity: strength, transform: a.zoom ? `scale(${a.zoom})` : undefined }} priority />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgb(8_9_12/0.45)_0%,rgb(8_9_12/0.2)_45%,rgb(8_9_12/0.5)_100%)]" />
    </div>
  );
}
