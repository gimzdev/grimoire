import { ImageResponse } from 'next/og';
import { getDungeons, getEncounters, getMap } from '@/lib/data';
import { clip, INK, OG_SIZE, OgFrame, ogFonts } from '@/lib/og';

export const size = OG_SIZE;
export const contentType = 'image/png';
export const alt = 'The dungeon’s map with its bosses, its levels and its size';

export function generateStaticParams() {
  return getDungeons().map((d) => ({ slug: d.slug }));
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const d = getDungeons().find((x) => x.slug === slug);
  if (!d) return new Response('Not found', { status: 404 });
  const enc = getEncounters(slug);
  const view = getMap(slug)?.views[0];
  const raid = d.kind === 'raid';
  const facts = [
    d.levels?.length ? `Levels ${d.levels[0]}${d.levels[1] && d.levels[1] !== d.levels[0] ? `–${d.levels[1]}` : ''}` : null,
    raid && d.size ? `${d.size} players` : null,
    (enc?.bosses ?? d.bossCount) ? `${enc?.bosses ?? d.bossCount} bosses` : null,
  ].filter(Boolean) as string[];
  // the bosses' places on the first wing, numbered in the order the map lists them
  const spots = view ? view.bosses.map((b, i) => ({ n: i + 1, x: b.at[0][0], y: b.at[0][1] })) : [];
  const box = 470;
  const scale = view ? box / Math.max(view.w, view.h) : 1;
  return new ImageResponse(
    (
      <OgFrame color={raid ? '#ec8a3a' : INK.gilt} foot={raid ? 'WoW Forever raids' : 'WoW Forever dungeons'}>
        <div style={{ display: 'flex', flexDirection: 'column', width: view ? 520 : 1000, marginRight: 40 }}>
          <span style={{ fontSize: 26, fontWeight: 500, color: raid ? '#ec8a3a' : INK.giltBright }}>
            {raid ? 'Raid' : 'Dungeon'}
            {d.location ? ` · ${d.location}` : ''}
          </span>
          <span style={{ fontSize: 66, fontWeight: 600, lineHeight: 1.02, marginTop: 10, letterSpacing: -1.6 }}>{d.name}</span>
          {d.summary && <span style={{ fontSize: 23, lineHeight: 1.35, color: INK.parch, marginTop: 20 }}>{clip(d.summary, view ? 150 : 240)}</span>}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 'auto' }}>
            {[...facts, ...(d.isNew && d.status ? [d.status] : [])].map((f) => (
              <span key={f} style={{ fontSize: 24, fontWeight: 500, padding: '6px 16px', borderRadius: 999, background: 'rgba(255,255,255,0.06)', color: INK.vellum }}>
                {f}
              </span>
            ))}
          </div>
        </div>
        {view && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: box, height: box, marginTop: -6 }}>
            <div style={{ display: 'flex', position: 'relative', width: view.w * scale, height: view.h * scale }}>
              <svg width={view.w * scale} height={view.h * scale} viewBox={`0 0 ${view.w} ${view.h}`}>
                {view.floors.map((f, i) => (
                  <path key={i} d={f.d} fill="#1b1f26" stroke="#4a4237" strokeWidth={4} strokeLinejoin="round" />
                ))}
              </svg>
              {spots.map((s) => (
                <div
                  key={s.n}
                  style={{
                    position: 'absolute',
                    left: s.x * scale - 15,
                    top: s.y * scale - 15,
                    width: 30,
                    height: 30,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: 999,
                    background: INK.gilt,
                    border: '3px solid #0b0c0f',
                    color: '#1a1204',
                    fontSize: 16,
                    fontWeight: 600,
                  }}
                >
                  {s.n}
                </div>
              ))}
            </div>
          </div>
        )}
      </OgFrame>
    ),
    { ...OG_SIZE, fonts: ogFonts() },
  );
}
