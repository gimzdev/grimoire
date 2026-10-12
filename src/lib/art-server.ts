import { existsSync } from 'node:fs';
import path from 'node:path';
import { ART, type Art, type ArtKey } from './art';

const EXT = ['avif', 'webp', 'jpg', 'jpeg', 'png'];
const found = new Map<string, string | null>();

/** The picture for an art key: your own file in public/art/<key>.* when present, else the official image. */
export function resolveArt(key: ArtKey | string | undefined): Art {
  const k = (key && key in ART ? key : 'keyArt') as ArtKey;
  const base = ART[k];
  if (!found.has(k)) {
    const hit = EXT.map((e) => `art/${k}.${e}`).find((f) => existsSync(path.join(process.cwd(), 'public', f)));
    found.set(k, hit ? `/${hit}` : null);
  }
  const local = found.get(k);
  // Your own picture has no painted frame to crop.
  return local ? { ...base, src: local, zoom: undefined } : base;
}

/** A small copy of a picture through the image optimizer, for blurred washes where detail does not matter. */
export function artThumb(key: ArtKey | string | undefined, width = 640) {
  return `/_next/image?url=${encodeURIComponent(resolveArt(key).src)}&w=${width}&q=60`;
}
