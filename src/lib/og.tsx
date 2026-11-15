// Link pictures (Open Graph, 1200 x 630): what a link to Grimoire shows when it is pasted in Discord, Threads or a chat.
// Drawn with next/og in the site's own type (Mona Sans and IM Fell English SC, the add-on's copies) on the site's dark.
import 'server-only';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { ReactNode } from 'react';
import type { ClassTalents } from './types';

export const OG_SIZE = { width: 1200, height: 630 };

const MEDIA = path.join(process.cwd(), 'addon', 'GrimoireForever', 'Media');
let fonts: { name: string; data: Buffer; weight: 400 | 500 | 600; style: 'normal' }[] | null = null;
export function ogFonts() {
  fonts ??= [
    { name: 'Mona Sans', data: readFileSync(path.join(MEDIA, 'MonaSans-Regular.ttf')), weight: 400, style: 'normal' },
    { name: 'Mona Sans', data: readFileSync(path.join(MEDIA, 'MonaSans-Medium.ttf')), weight: 500, style: 'normal' },
    { name: 'Mona Sans', data: readFileSync(path.join(MEDIA, 'MonaSans-SemiBold.ttf')), weight: 600, style: 'normal' },
    { name: 'IM Fell English SC', data: readFileSync(path.join(MEDIA, 'IMFeENsc28P.ttf')), weight: 400, style: 'normal' },
  ];
  return fonts;
}

export const INK = { night: '#08090c', panel: '#121418', iron: '#2b3038', vellum: '#f4f1ea', parch: '#d7d2c8', mist: '#a29d93', fog: '#827e77', gilt: '#f2b640', giltBright: '#ffd47a', leaf: '#9ccc74' };

/** Cut a text to a length at a word, with an ellipsis. */
export const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).replace(/[\s,.;:]+\S*$/, '')}…` : s);

/** The picture's ground: the night, a glow of the page's color, and Grimoire's name along the bottom. */
export function OgFrame({ color = INK.gilt, children, foot }: { color?: string; children: ReactNode; foot?: string }) {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: `radial-gradient(90% 70% at 85% 0%, ${color}33, transparent 60%), linear-gradient(180deg, #0d0f13, ${INK.night})`,
        color: INK.vellum,
        fontFamily: 'Mona Sans',
        padding: '56px 64px 44px',
      }}
    >
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>{children}</div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 28, fontSize: 24, color: INK.mist }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          {/* the rune stone of components/logo.tsx */}
          <svg width="40" height="40" viewBox="0 0 64 64">
            <defs>
              <linearGradient id="s" x1="0.2" y1="0" x2="0.8" y2="1">
                <stop offset="0" stopColor="#ffdb8a" />
                <stop offset="0.55" stopColor="#f2b640" />
                <stop offset="1" stopColor="#d48f22" />
              </linearGradient>
            </defs>
            <rect x="12" y="12" width="40" height="40" rx="7.5" transform="rotate(45 32 32)" fill="url(#s)" />
            <path d="M41.5 24 L32 14.5 L18.5 28 L18.5 36 L32 49.5 L45.5 36 L45.5 31 L34.5 31" fill="none" stroke="#0b0c0f" strokeWidth="5.4" strokeLinejoin="miter" strokeLinecap="square" />
          </svg>
          <span style={{ fontFamily: 'IM Fell English SC', fontSize: 34, color: INK.vellum, letterSpacing: 1 }}>Grimoire</span>
          {foot && <span style={{ marginLeft: 10 }}>{foot}</span>}
        </div>
        <span>wowgrimoire.app</span>
      </div>
    </div>
  );
}

/**
 * A class's three trees, small: every talent in its place, the ones spent lit with their rank (gold when full, green
 * when not), the rest dark. With `fresh`, unspent talents new in Forever are outlined in green.
 */
export function OgTrees({ t, ranks, color, cell = 36, fresh = false }: { t: ClassTalents; ranks: Record<number, number>; color: string; cell?: number; fresh?: boolean }) {
  const gap = Math.round(cell / 4.5);
  return (
    <div style={{ display: 'flex', gap: 22 }}>
      {t.trees.map((tree) => {
        const spent = tree.talents.reduce((n, x) => n + (ranks[x.id] ?? 0), 0);
        const rows = Math.max(...tree.talents.map((x) => x.row)) + 1;
        const w = 4 * cell + 3 * gap;
        return (
          <div key={tree.id} style={{ display: 'flex', flexDirection: 'column', width: w + 24, padding: 12, borderRadius: 18, background: 'rgba(255,255,255,0.03)', border: `1px solid ${INK.iron}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
              <span style={{ fontSize: 21, fontWeight: 600, color: spent ? INK.vellum : INK.fog }}>{clip(tree.name, 14)}</span>
              <span style={{ fontSize: 26, fontWeight: 600, color: spent ? INK.giltBright : INK.fog }}>{spent}</span>
            </div>
            <div style={{ display: 'flex', position: 'relative', width: w, height: rows * cell + (rows - 1) * gap }}>
              {tree.talents.map((x) => {
                const r = ranks[x.id] ?? 0;
                const full = r >= x.max;
                const edge = r ? (full ? '#ffd100' : '#1eff00') : fresh && x.status === 'new' ? INK.leaf : '#262a31';
                return (
                  <div
                    key={x.id}
                    style={{
                      position: 'absolute',
                      left: x.col * (cell + gap),
                      top: x.row * (cell + gap),
                      width: cell,
                      height: cell,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: 8,
                      border: `2px solid ${edge}`,
                      background: r ? `${color}40` : '#14171c',
                      color: full ? '#ffd100' : '#1eff00',
                      fontSize: Math.round(cell / 2.6),
                      fontWeight: 600,
                    }}
                  >
                    {r ? `${r}/${x.max}` : ''}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** A Blizzard icon as a data URL for a picture, or null when the icon server does not answer in time (the picture goes without). */
export async function ogIcon(icon: string | undefined | null): Promise<string | null> {
  if (!icon) return null;
  try {
    const res = await fetch(`https://render.worldofwarcraft.com/us/icons/56/${icon.toLowerCase()}.jpg`, { signal: AbortSignal.timeout(2500) });
    if (!res.ok) return null;
    return `data:image/jpeg;base64,${Buffer.from(await res.arrayBuffer()).toString('base64')}`;
  } catch {
    return null;
  }
}
