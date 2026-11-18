import { existsSync } from 'node:fs';
import path from 'node:path';
import { ART, type Art, type ArtKey } from './art';

const EXT = ['avif', 'webp', 'jpg', 'jpeg', 'png'];
const found = new Map<string, string | null>();

function ownPicture(k: string): string | null {
  if (!found.has(k)) {
    const hit = /^[A-Za-z0-9_-]+$/.test(k) ? EXT.map((e) => `art/${k}.${e}`).find((f) => existsSync(path.join(process.cwd(), 'public', f))) : undefined;
    found.set(k, hit ? `/${hit}` : null);
  }
  return found.get(k) ?? null;
}

/**
 * The picture for an art key, or for several separated by "|" (a zone page passes "zone<id>|<official key>"): your own
 * file in public/art/<key>.* for the first key that has one, else the official image of the first official key.
 */
export function resolveArt(key: ArtKey | string | undefined): Art {
  const keys = String(key ?? '').split('|').filter(Boolean);
  const base = ART[(keys.find((k) => k in ART) ?? 'expanses') as ArtKey];
  for (const k of keys) {
    const local = ownPicture(k);
    // Your own picture has no painted frame to crop.
    if (local) return { ...base, src: local, zoom: undefined };
  }
  return base;
}

/** A small copy of a picture through the image optimizer, for blurred washes where detail does not matter. */
export function artThumb(key: ArtKey | string | undefined, width = 640) {
  return `/_next/image?url=${encodeURIComponent(resolveArt(key).src)}&w=${width}&q=60`;
}
